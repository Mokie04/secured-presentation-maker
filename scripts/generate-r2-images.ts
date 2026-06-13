#!/usr/bin/env node
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GoogleGenAI } from '@google/genai';
import * as mammoth from 'mammoth';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCachedR2Image, setCachedR2Image } from '../api/_r2ImageCache.ts';
import { buildFinalImagePrompt } from '../lib/imagePrompting.ts';
import { buildImageSemanticCacheId, getGradeBand, slugifyImageSemanticText } from '../lib/imageSemantic.ts';
import {
  generateImageForProvider,
  getDefaultImageProvider,
  getImageModelCandidates,
  normalizeImageProvider,
  type ImageProvider,
} from '../lib/serverImageGeneration.ts';
import type { ImageSemanticMetadata, ImageStyle } from '../types.ts';

type CliOptions = {
  manifestPath: string;
  envFiles: string[];
  dryRun: boolean;
  count?: number;
  force: boolean;
  autoCurated: boolean;
};

type ManifestSource = {
  path: string;
  kind?: string;
  label?: string;
};

type ManifestDefaults = {
  collection?: string;
  level?: string;
  format?: string;
  subject?: string;
  topic?: string;
  gradeLevel?: string;
  gradeBand?: string;
  learningCompetency?: string;
  language?: 'EN' | 'FIL';
  style?: ImageStyle;
};

type GenerationConfig = {
  count?: number;
  aspectRatio?: string;
  provider?: string;
  model?: string | string[];
  concurrency?: number;
  autoCurated?: boolean;
  batchName?: string;
};

type BatchManifest = {
  defaults?: ManifestDefaults;
  sources?: ManifestSource[];
  generation?: GenerationConfig;
};

type ExtractedSource = ManifestSource & {
  absolutePath: string;
  text: string;
  charCount: number;
};

type ImageBrief = {
  title?: string;
  prompt: string;
  style?: ImageStyle;
  slideTemplate?: string;
  visualRole?: string;
  semanticAnchor?: string;
  sourceRationale?: string;
  learningCompetency?: string;
};

type NormalizedImageBrief = Required<Pick<ImageBrief, 'prompt' | 'style' | 'slideTemplate' | 'visualRole' | 'semanticAnchor'>> & {
  title?: string;
  sourceRationale?: string;
  learningCompetency?: string;
};

type CuratedUploadResult = {
  objectKeys: string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SEMANTIC_IMAGE_CACHE_PREFIX = 'generated-images/v2';
const SUPPORTED_IMAGE_STYLES = new Set<ImageStyle>([
  'photorealistic',
  'illustration',
  'infographic',
  'diagram',
  'historical photo',
  'none',
]);
const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function usage(): void {
  console.log(`Usage: npm run generate:r2-images -- <manifest.json> [--env .env.r2.local] [--env .env.replicate.local] [--auto-curated] [--dry-run] [--count 1] [--force]

Dry-run validates the manifest and source extraction only. It does not call text/image providers or write to R2.`);
}

function parseArgs(argv: string[]): CliOptions {
  const envFiles: string[] = [];
  let manifestPath = '';
  let dryRun = false;
  let force = false;
  let autoCurated = false;
  let count: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--auto-curated') {
      autoCurated = true;
      continue;
    }
    if (arg === '--env') {
      const envFile = argv[index + 1];
      if (!envFile || envFile.startsWith('--')) {
        throw new Error('--env requires a file path.');
      }
      envFiles.push(envFile);
      index += 1;
      continue;
    }
    if (arg === '--count') {
      const rawCount = argv[index + 1];
      const parsed = Number.parseInt(rawCount || '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--count requires a positive integer.');
      }
      count = parsed;
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!manifestPath) {
      manifestPath = arg;
      continue;
    }
    throw new Error(`Unexpected positional argument: ${arg}`);
  }

  if (!manifestPath) {
    usage();
    process.exit(1);
  }

  return {
    manifestPath,
    envFiles,
    dryRun,
    force,
    autoCurated,
    ...(count ? { count } : {}),
  };
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
  const equalsIndex = normalized.indexOf('=');
  if (equalsIndex <= 0) return null;

  const key = normalized.slice(0, equalsIndex).trim();
  let value = normalized.slice(equalsIndex + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function loadEnvFiles(envFiles: string[]): Promise<void> {
  for (const envFile of envFiles) {
    const envPath = path.resolve(REPO_ROOT, envFile);
    const contents = await readFile(envPath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function normalizeLanguage(value: unknown): 'EN' | 'FIL' {
  return value === 'FIL' ? 'FIL' : 'EN';
}

function normalizeImageStyle(value: unknown, fallback: ImageStyle): ImageStyle {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUPPORTED_IMAGE_STYLES.has(normalized as ImageStyle) ? normalized as ImageStyle : fallback;
}

async function readManifest(manifestPath: string): Promise<{ manifest: BatchManifest; manifestFile: string; manifestDir: string }> {
  const manifestFile = path.resolve(REPO_ROOT, manifestPath);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as BatchManifest;
  assertRecord(manifest, 'Manifest');

  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new Error('Manifest must include a non-empty sources array.');
  }

  manifest.sources.forEach((source, index) => {
    if (!source || typeof source !== 'object' || typeof source.path !== 'string' || !source.path.trim()) {
      throw new Error(`sources[${index}] must include a non-empty path.`);
    }
  });

  return {
    manifest,
    manifestFile,
    manifestDir: path.dirname(manifestFile),
  };
}

async function extractPdfText(filePath: string): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buffer = await readFile(filePath);
  const document = await getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    pages.push(pageText);
  }

  return normalizeWhitespace(pages.join('\n\n'));
}

async function extractDocxText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(result.value || '');
}

async function extractSourceText(filePath: string): Promise<string> {
  const extension = path.extname(filePath).toLowerCase();
  if (SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
    return normalizeWhitespace(await readFile(filePath, 'utf8'));
  }
  if (extension === '.docx') {
    return extractDocxText(filePath);
  }
  if (extension === '.pdf') {
    return extractPdfText(filePath);
  }

  throw new Error(`Unsupported source format for ${filePath}. Use PDF, DOCX, TXT, or MD.`);
}

async function extractSources(sources: ManifestSource[], manifestDir: string): Promise<ExtractedSource[]> {
  const extractedSources: ExtractedSource[] = [];
  for (const source of sources) {
    const absolutePath = path.resolve(manifestDir, source.path);
    const text = await extractSourceText(absolutePath);
    if (text.length < 120) {
      throw new Error(`${source.path} has too little extractable text. V1 does not perform OCR, so scanned PDFs must be converted to text first.`);
    }
    extractedSources.push({
      ...source,
      absolutePath,
      text,
      charCount: text.length,
    });
  }
  return extractedSources;
}

function getCount(manifest: BatchManifest, options: CliOptions): number {
  const rawCount = options.count || manifest.generation?.count || 12;
  if (!Number.isFinite(rawCount) || rawCount <= 0) {
    throw new Error('generation.count must be a positive integer.');
  }
  return Math.min(60, Math.max(1, Math.floor(rawCount)));
}

function getConcurrency(manifest: BatchManifest): number {
  const rawConcurrency = manifest.generation?.concurrency || 1;
  if (!Number.isFinite(rawConcurrency) || rawConcurrency <= 0) {
    return 1;
  }
  return Math.min(3, Math.max(1, Math.floor(rawConcurrency)));
}

function getAspectRatio(manifest: BatchManifest): string {
  const aspectRatio = manifest.generation?.aspectRatio || '16:9';
  if (aspectRatio !== '16:9') {
    throw new Error('V1 image generation only supports generation.aspectRatio "16:9".');
  }
  return aspectRatio;
}

function resolveTextProvider(): 'gemini' | 'xai' | 'deepseek' {
  const configured = process.env.AI_TEXT_PROVIDER?.trim().toLowerCase();
  if (configured === 'gemini' || configured === 'xai' || configured === 'deepseek') return configured;
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.XAI_API_KEY) return 'xai';
  return 'gemini';
}

function validateRequiredEnv(options: {
  dryRun: boolean;
  provider: ImageProvider;
}): void {
  if (options.dryRun) return;

  [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_IMAGE_CACHE_SECRET',
  ].forEach(requireEnv);

  const textProvider = resolveTextProvider();
  if (textProvider === 'deepseek') requireEnv('DEEPSEEK_API_KEY');
  if (textProvider === 'xai') requireEnv('XAI_API_KEY');
  if (textProvider === 'gemini') requireEnv('GEMINI_API_KEY');

  if (options.provider === 'replicate') requireEnv('REPLICATE_API_TOKEN');
  if (options.provider === 'xai') requireEnv('XAI_API_KEY');
  if (options.provider === 'gemini') requireEnv('GEMINI_API_KEY');
}

function slugify(value: string | undefined, fallback = 'batch'): string {
  const slug = (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || fallback;
}

function createBatchId(manifest: BatchManifest, manifestFile: string): string {
  const configuredName = manifest.generation?.batchName;
  const sourceName = configuredName
    || manifest.defaults?.collection
    || manifest.defaults?.topic
    || path.basename(manifestFile, path.extname(manifestFile));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${timestamp}-${slugify(sourceName)}`;
}

async function prepareOutputDir(batchId: string, force: boolean): Promise<string> {
  const outputDir = path.resolve(REPO_ROOT, 'outputs', batchId);
  if (force) {
    await rm(outputDir, { recursive: true, force: true });
  }
  await mkdir(path.join(outputDir, 'images'), { recursive: true });
  return outputDir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sourceSummary(extractedSources: ExtractedSource[]): unknown {
  return {
    sources: extractedSources.map((source) => ({
      path: source.path,
      kind: source.kind || '',
      label: source.label || '',
      charCount: source.charCount,
      excerpt: source.text.slice(0, 1200),
    })),
  };
}

function clipSourceText(extractedSources: ExtractedSource[]): string {
  const maxCharsPerSource = Math.max(12_000, Math.floor(70_000 / Math.max(1, extractedSources.length)));
  return extractedSources
    .map((source) => [
      `SOURCE: ${source.label || source.path}`,
      `KIND: ${source.kind || 'source'}`,
      source.text.slice(0, maxCharsPerSource),
    ].join('\n'))
    .join('\n\n---\n\n');
}

function buildBriefGenerationPrompt(input: {
  defaults: ManifestDefaults;
  sourceText: string;
  count: number;
}): string {
  return `You are creating classroom image generation briefs for a teacher presentation app.

Use the Lesson Exemplar and Budget of Work source text below. Generate exactly ${input.count} distinct image briefs that are useful for instruction, not decorative backgrounds.

Defaults:
${JSON.stringify(input.defaults, null, 2)}

Rules:
- Each image must be directly grounded in the source material, competency, activity, concept, assessment, or expected classroom output.
- Prefer classroom evidence visuals: demos, manipulatives, process models, comparison setups, output templates, misconception checks, or assessment evidence.
- Do not request readable words, letters, numbers, labels, formulas, captions, logos, UI, signatures, or watermarks inside the image.
- Use concise semantic anchors in kebab case.
- Use one of these styles: photorealistic, illustration, infographic, diagram, historical photo.
- Return valid JSON only, with this shape:
{
  "images": [
    {
      "title": "short title",
      "prompt": "specific image prompt",
      "style": "photorealistic",
      "slideTemplate": "activity",
      "visualRole": "activity",
      "semanticAnchor": "specific-anchor",
      "sourceRationale": "brief reason from source"
    }
  ]
}

Source text:
${input.sourceText}`;
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseBriefResponse(text: string): ImageBrief[] {
  const parsed = JSON.parse(stripJsonFence(text)) as { images?: ImageBrief[] };
  if (!Array.isArray(parsed.images) || parsed.images.length === 0) {
    throw new Error('Text provider did not return an images array.');
  }
  return parsed.images;
}

async function generateBriefsWithGemini(prompt: string): Promise<ImageBrief[]> {
  const apiKey = requireEnv('GEMINI_API_KEY');
  const ai = new GoogleGenAI({ apiKey });
  const response: any = await ai.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || process.env.VITE_GEMINI_TEXT_MODEL || 'gemini-2.0-flash-lite',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.35,
    },
  });
  return parseBriefResponse(response.text || '');
}

async function generateBriefsWithXai(prompt: string): Promise<ImageBrief[]> {
  const apiKey = requireEnv('XAI_API_KEY');
  const model = process.env.XAI_TEXT_MODEL || 'grok-4.3';
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.35,
      response_format: { type: 'json_object' },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error?.message === 'string' ? payload.error.message : `xAI text request failed with status ${response.status}.`);
  }
  return parseBriefResponse(payload?.choices?.[0]?.message?.content || '');
}

async function generateBriefsWithDeepSeek(prompt: string): Promise<ImageBrief[]> {
  const apiKey = requireEnv('DEEPSEEK_API_KEY');
  const model = process.env.DEEPSEEK_TEXT_MODEL || 'deepseek-v4-flash';
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      thinking: { type: 'disabled' },
      temperature: 0.35,
      response_format: { type: 'json_object' },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error?.message === 'string' ? payload.error.message : `DeepSeek text request failed with status ${response.status}.`);
  }
  return parseBriefResponse(payload?.choices?.[0]?.message?.content || '');
}

async function generateBriefs(input: {
  defaults: ManifestDefaults;
  extractedSources: ExtractedSource[];
  count: number;
}): Promise<ImageBrief[]> {
  const prompt = buildBriefGenerationPrompt({
    defaults: input.defaults,
    sourceText: clipSourceText(input.extractedSources),
    count: input.count,
  });
  const provider = resolveTextProvider();
  if (provider === 'deepseek') return generateBriefsWithDeepSeek(prompt);
  if (provider === 'xai') return generateBriefsWithXai(prompt);
  return generateBriefsWithGemini(prompt);
}

function normalizeBriefs(briefs: ImageBrief[], defaults: ManifestDefaults, count: number): NormalizedImageBrief[] {
  return briefs.slice(0, count).map((brief, index) => {
    const prompt = typeof brief.prompt === 'string' ? normalizeWhitespace(brief.prompt) : '';
    if (!prompt) {
      throw new Error(`Brief ${index + 1} is missing prompt.`);
    }
    const style = normalizeImageStyle(brief.style, defaults.style || 'photorealistic');
    if (style === 'none') {
      throw new Error(`Brief ${index + 1} uses image style "none"; batch-generated images require a visual style.`);
    }
    const slideTemplate = slugify(brief.slideTemplate || brief.visualRole || 'content', 'content');
    const visualRole = slugify(brief.visualRole || brief.slideTemplate || 'content', 'content');
    const fallbackAnchor = brief.title || prompt.slice(0, 96);
    const semanticAnchor = slugifyImageSemanticText(brief.semanticAnchor || fallbackAnchor).slice(0, 120) || `generated-image-${index + 1}`;

    return {
      prompt,
      style,
      slideTemplate,
      visualRole,
      semanticAnchor,
      ...(brief.title ? { title: brief.title } : {}),
      ...(brief.sourceRationale ? { sourceRationale: brief.sourceRationale } : {}),
      ...(brief.learningCompetency ? { learningCompetency: brief.learningCompetency } : {}),
    };
  });
}

function metadataForBrief(defaults: ManifestDefaults, brief: NormalizedImageBrief): ImageSemanticMetadata {
  const gradeLevel = defaults.gradeLevel || '';
  return {
    level: defaults.level || 'k12',
    format: defaults.format || 'K-12',
    subject: defaults.subject || 'general',
    topic: defaults.topic || defaults.collection || 'general',
    gradeLevel,
    gradeBand: defaults.gradeBand || getGradeBand(gradeLevel) || 'all-grades',
    learningCompetency: brief.learningCompetency || defaults.learningCompetency || '',
    visualRole: brief.visualRole,
    slideTemplate: brief.slideTemplate,
    semanticAnchor: brief.semanticAnchor,
    language: normalizeLanguage(defaults.language),
    style: brief.style,
  };
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  return 'png';
}

function dataUrlToImageBytes(dataUrl: string): { base64: string; mime: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  return {
    mime: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(),
    base64: match[2].replace(/\s+/g, ''),
  };
}

async function writeImageFile(filePath: string, base64: string): Promise<void> {
  await writeFile(filePath, Buffer.from(base64, 'base64'));
}

function semanticSubjectSlug(metadata: ManifestDefaults & NormalizedImageBrief): string {
  if (metadata.collection) {
    return slugify(metadata.collection, 'general');
  }

  const subjectSlug = slugify(metadata.subject || metadata.topic, 'general');
  const searchable = slugify([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '), 'general');

  if (
    subjectSlug === 'english'
    || subjectSlug.includes('english')
    || searchable.includes('english')
  ) {
    if (
      searchable.includes('poetry-descriptions-imagery')
      || searchable.includes('descriptions-and-imagery')
      || searchable.includes('poetry')
      || searchable.includes('imagery')
      || searchable.includes('en7lit-i-1')
    ) {
      return 'english-poetry-imagery';
    }
  }

  return subjectSlug;
}

function buildCuratedObjectKeys(metadata: ManifestDefaults & NormalizedImageBrief, contentType: string): string[] {
  const extension = extensionFromContentType(contentType);
  const subject = semanticSubjectSlug(metadata);
  const template = slugify(metadata.slideTemplate || metadata.visualRole, 'content');
  const anchor = slugify(metadata.semanticAnchor, '');
  const competency = slugify(metadata.learningCompetency, '');
  const gradeScopes = [
    slugify(metadata.gradeLevel, ''),
    slugify(metadata.gradeBand, ''),
  ].filter(Boolean);
  const scopes = gradeScopes.length > 0 ? Array.from(new Set(gradeScopes)) : ['all-grades'];

  return scopes.flatMap((gradeScope) => {
    const keys: string[] = [];
    if (anchor) {
      keys.push(`${SEMANTIC_IMAGE_CACHE_PREFIX}/_curated/${subject}/${template}/${gradeScope}/anchors/${anchor}/image.${extension}`);
    }
    if (!anchor && competency) {
      keys.push(`${SEMANTIC_IMAGE_CACHE_PREFIX}/_curated/${subject}/${template}/${gradeScope}/competencies/${competency}/image.${extension}`);
    }
    if (!anchor && !competency) {
      keys.push(`${SEMANTIC_IMAGE_CACHE_PREFIX}/_curated/${subject}/${template}/${gradeScope}/image.${extension}`);
    }
    return keys;
  });
}

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

async function uploadCuratedImage(input: {
  client: S3Client;
  metadata: ManifestDefaults & NormalizedImageBrief;
  base64: string;
  contentType: string;
}): Promise<CuratedUploadResult> {
  const bucketName = requireEnv('R2_BUCKET_NAME');
  const body = Buffer.from(input.base64, 'base64');
  const objectKeys = buildCuratedObjectKeys(input.metadata, input.contentType);
  if (objectKeys.length === 0) {
    throw new Error(`No curated object keys built for ${input.metadata.semanticAnchor}.`);
  }

  for (const objectKey of objectKeys) {
    await input.client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: body,
      ContentType: input.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        curated: 'true',
        source: 'batch-generated',
        subject: semanticSubjectSlug(input.metadata).slice(0, 128),
        slideTemplate: slugify(input.metadata.slideTemplate || input.metadata.visualRole, 'content').slice(0, 64),
        semanticAnchor: slugify(input.metadata.semanticAnchor, '').slice(0, 128),
      },
    }));
  }

  return { objectKeys };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));

  return results;
}

async function processBriefs(input: {
  briefs: NormalizedImageBrief[];
  defaults: ManifestDefaults;
  outputDir: string;
  provider: ImageProvider;
  modelCandidates: string[];
  aspectRatio: string;
  concurrency: number;
  force: boolean;
  autoCurated: boolean;
}): Promise<{ results: unknown[]; curatedManifest: unknown }> {
  const language = normalizeLanguage(input.defaults.language);
  const r2Client = input.autoCurated ? getR2Client() : null;

  const results = await runWithConcurrency(input.briefs, input.concurrency, async (brief, index) => {
    const semanticMetadata = metadataForBrief(input.defaults, brief);
    const cacheSemanticMetadata: Record<string, string | undefined> = { ...semanticMetadata };
    const semanticCacheId = await buildImageSemanticCacheId(semanticMetadata, language);
    const cacheId = `batch:${slugify(input.defaults.collection || input.defaults.topic || 'general')}:${brief.semanticAnchor}`;
    const finalPrompt = buildFinalImagePrompt(brief.prompt, brief.style, language);
    const cacheInput = {
      prompt: finalPrompt,
      model: input.modelCandidates[0],
      aspectRatio: input.aspectRatio,
      cacheId,
      semanticCacheId,
      semanticMetadata: cacheSemanticMetadata,
    };

    let imageBytes: { base64: string; mime: string };
    let cacheProvider = 'none';
    let imageProvider = input.provider;
    let modelUsed = input.modelCandidates[0];

    if (!input.force) {
      const cached = await getCachedR2Image(cacheInput);
      const cachedBytes = cached?.dataUrl ? dataUrlToImageBytes(cached.dataUrl) : null;
      if (cachedBytes) {
        imageBytes = cachedBytes;
        cacheProvider = 'r2';
      } else {
        const generated = await generateImageForProvider(input.provider, input.modelCandidates, {
          prompt: finalPrompt,
          aspectRatio: input.aspectRatio,
          cacheId,
          semanticCacheId,
          semanticMetadata: cacheSemanticMetadata,
          allowPaidImageGeneration: true,
        });
        imageBytes = generated;
        modelUsed = generated.modelUsed;
      }
    } else {
      const generated = await generateImageForProvider(input.provider, input.modelCandidates, {
        prompt: finalPrompt,
        aspectRatio: input.aspectRatio,
        cacheId,
        semanticCacheId,
        semanticMetadata: cacheSemanticMetadata,
        allowPaidImageGeneration: true,
      });
      imageBytes = generated;
      modelUsed = generated.modelUsed;
    }

    if (cacheProvider !== 'r2') {
      const storedImage = await setCachedR2Image({
        prompt: finalPrompt,
        model: modelUsed,
        aspectRatio: input.aspectRatio,
        cacheId,
        semanticCacheId,
        semanticMetadata: cacheSemanticMetadata,
      }, imageBytes.base64, imageBytes.mime);
      cacheProvider = storedImage ? 'r2' : 'none';
    }

    const extension = extensionFromContentType(imageBytes.mime);
    const fileName = `${String(index + 1).padStart(2, '0')}-${brief.semanticAnchor}.${extension}`;
    const imageFile = path.join(input.outputDir, 'images', fileName);
    await writeImageFile(imageFile, imageBytes.base64);

    const curatedMetadata = {
      ...input.defaults,
      ...brief,
      file: `./images/${fileName}`,
      contentType: imageBytes.mime,
    };
    let curatedUpload: CuratedUploadResult | null = null;
    if (input.autoCurated && r2Client) {
      curatedUpload = await uploadCuratedImage({
        client: r2Client,
        metadata: curatedMetadata,
        base64: imageBytes.base64,
        contentType: imageBytes.mime,
      });
    }

    console.log(`${index + 1}/${input.briefs.length} ${brief.semanticAnchor} -> ${cacheProvider}${curatedUpload ? ' + curated' : ''}`);

    return {
      index,
      title: brief.title || '',
      semanticAnchor: brief.semanticAnchor,
      prompt: brief.prompt,
      style: brief.style,
      slideTemplate: brief.slideTemplate,
      visualRole: brief.visualRole,
      modelUsed,
      provider: imageProvider,
      cacheProvider,
      imageFile: path.relative(input.outputDir, imageFile),
      curatedObjectKeys: curatedUpload?.objectKeys || [],
    };
  });

  const curatedManifest = {
    defaults: input.defaults,
    images: results.map((result: any) => ({
      file: `./${result.imageFile}`,
      slideTemplate: result.slideTemplate,
      visualRole: result.visualRole,
      semanticAnchor: result.semanticAnchor,
      contentType: CONTENT_TYPE_BY_EXTENSION[path.extname(result.imageFile).toLowerCase()] || 'image/png',
    })),
  };

  return { results, curatedManifest };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await loadEnvFiles(options.envFiles);

  const { manifest, manifestFile, manifestDir } = await readManifest(options.manifestPath);
  const defaults = manifest.defaults || {};
  const count = getCount(manifest, options);
  const aspectRatio = getAspectRatio(manifest);
  const provider = normalizeImageProvider(manifest.generation?.provider) || getDefaultImageProvider();
  const concurrency = getConcurrency(manifest);
  const autoCurated = manifest.generation?.autoCurated === true && options.autoCurated;
  const batchId = createBatchId(manifest, manifestFile);
  const outputDir = await prepareOutputDir(batchId, options.force);
  const extractedSources = await extractSources(manifest.sources || [], manifestDir);

  await writeJson(path.join(outputDir, 'source-summary.json'), sourceSummary(extractedSources));

  if (options.dryRun) {
    await writeJson(path.join(outputDir, 'dry-run-report.json'), {
      dryRun: true,
      manifest: path.relative(REPO_ROOT, manifestFile),
      sourceCount: extractedSources.length,
      plannedImageCount: count,
      provider,
      aspectRatio,
      autoCuratedWouldRun: manifest.generation?.autoCurated === true && options.autoCurated,
      outputDir: path.relative(REPO_ROOT, outputDir),
    });
    console.log(`dry-run ok: validated ${extractedSources.length} source(s), planned ${count} image(s).`);
    console.log(`artifacts: ${path.relative(REPO_ROOT, outputDir)}`);
    return;
  }

  validateRequiredEnv({ dryRun: options.dryRun, provider });
  if (manifest.generation?.autoCurated === true && !options.autoCurated) {
    console.warn('generation.autoCurated is true, but --auto-curated was not provided. Curated R2 upload will be skipped.');
  }
  if (manifest.generation?.autoCurated !== true && options.autoCurated) {
    console.warn('--auto-curated was provided, but generation.autoCurated is not true. Curated R2 upload will be skipped.');
  }

  const rawBriefs = await generateBriefs({ defaults, extractedSources, count });
  const briefs = normalizeBriefs(rawBriefs, defaults, count);
  if (briefs.length < count) {
    throw new Error(`Text provider returned ${briefs.length} usable brief(s), expected ${count}.`);
  }

  await writeJson(path.join(outputDir, 'briefs.generated.json'), { images: briefs });

  const modelCandidates = getImageModelCandidates(provider, manifest.generation?.model);
  if (modelCandidates.length === 0) {
    throw new Error(`No image model candidates resolved for provider ${provider}.`);
  }

  const { results, curatedManifest } = await processBriefs({
    briefs,
    defaults,
    outputDir,
    provider,
    modelCandidates,
    aspectRatio,
    concurrency,
    force: options.force,
    autoCurated,
  });

  await writeJson(path.join(outputDir, 'curated-upload-manifest.generated.json'), curatedManifest);
  await writeJson(path.join(outputDir, 'upload-report.json'), {
    dryRun: false,
    manifest: path.relative(REPO_ROOT, manifestFile),
    outputDir: path.relative(REPO_ROOT, outputDir),
    provider,
    modelCandidates,
    aspectRatio,
    concurrency,
    autoCurated,
    count: results.length,
    results,
  });

  console.log(`done: ${results.length} image(s).`);
  console.log(`artifacts: ${path.relative(REPO_ROOT, outputDir)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
