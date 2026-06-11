#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SEMANTIC_IMAGE_CACHE_PREFIX = 'generated-images/v2';

const CONTENT_TYPE_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function usage() {
  console.log(`Usage: node scripts/upload-curated-r2-images.mjs <manifest.json> [--dry-run] [--include-grade-band-alias] [--include-all-grades-alias]

Manifest shape:
{
  "defaults": {
    "collection": "english-poetry-imagery",
    "subject": "english",
    "topic": "poetry-descriptions-imagery",
    "gradeLevel": "grade-7",
    "gradeBand": "7-10",
    "learningCompetency": "EN7LIT-I-1"
  },
  "images": [
    {
      "file": "./approved-images/core-memory-sharing.png",
      "slideTemplate": "activity",
      "visualRole": "activity",
      "semanticAnchor": "core-memory-sharing"
    }
  ]
}`);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function slugify(value, fallback = '') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || fallback;
}

function semanticSubjectSlug(metadata) {
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

function contentTypeForFile(filePath, override) {
  if (override) return override;
  const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    throw new Error(`Unsupported image extension for ${filePath}. Use PNG, JPEG, or WebP.`);
  }
  return contentType;
}

function buildObjectKeys(metadata, options, contentType) {
  const extension = contentType === 'image/jpeg'
    ? 'jpg'
    : contentType.split('/')[1];
  const subject = semanticSubjectSlug(metadata);
  const template = slugify(metadata.slideTemplate || metadata.visualRole, 'content');
  const anchor = slugify(metadata.semanticAnchor, '');
  const competency = slugify(metadata.learningCompetency, '');
  const gradeScopes = [
    slugify(metadata.gradeLevel, ''),
    options.includeGradeBandAlias ? slugify(metadata.gradeBand, '') : '',
    options.includeAllGradesAlias ? 'all-grades' : '',
  ].filter(Boolean);
  const scopes = gradeScopes.length > 0 ? Array.from(new Set(gradeScopes)) : ['all-grades'];

  return scopes.flatMap((gradeScope) => {
    const keys = [];
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

function parseArgs(argv) {
  const manifestPath = argv.find((arg) => !arg.startsWith('--'));
  if (!manifestPath || argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exit(manifestPath ? 0 : 1);
  }

  return {
    manifestPath,
    dryRun: argv.includes('--dry-run'),
    includeGradeBandAlias: argv.includes('--include-grade-band-alias'),
    includeAllGradesAlias: argv.includes('--include-all-grades-alias'),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestFile = path.resolve(options.manifestPath);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const images = Array.isArray(manifest.images) ? manifest.images : [];
  if (images.length === 0) {
    throw new Error('Manifest must include a non-empty images array.');
  }

  const bucketName = options.dryRun
    ? (process.env.R2_BUCKET_NAME?.trim() || 'dry-run-bucket')
    : requireEnv('R2_BUCKET_NAME');
  const s3Module = options.dryRun ? null : await import('@aws-sdk/client-s3');
  const client = s3Module
    ? new s3Module.S3Client({
        region: 'auto',
        endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
          secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
        },
      })
    : null;

  for (const image of images) {
    const metadata = {
      ...(manifest.defaults || {}),
      ...image,
    };
    const filePath = path.resolve(path.dirname(manifestFile), image.file);
    const contentType = contentTypeForFile(filePath, image.contentType);
    const objectKeys = buildObjectKeys(metadata, options, contentType);
    if (objectKeys.length === 0) {
      throw new Error(`No object keys built for ${image.file}; provide semanticAnchor, learningCompetency, or a generic template.`);
    }

    const body = options.dryRun ? null : await readFile(filePath);
    for (const objectKey of objectKeys) {
      if (options.dryRun) {
        console.log(`[dry-run] ${image.file} -> r2://${bucketName}/${objectKey}`);
        continue;
      }

      await client.send(new s3Module.PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          curated: 'true',
          subject: semanticSubjectSlug(metadata).slice(0, 128),
          slideTemplate: slugify(metadata.slideTemplate || metadata.visualRole, 'content').slice(0, 64),
          semanticAnchor: slugify(metadata.semanticAnchor, '').slice(0, 128),
        },
      }));
      console.log(`uploaded ${image.file} -> r2://${bucketName}/${objectKey}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
