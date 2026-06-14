import { createHash, createHmac } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type R2ImageCacheConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  cacheSecret: string;
};

type CloudflareKvConfig = {
  accountId: string;
  apiToken: string;
  namespaceId: string;
};

type CachedImage = {
  dataUrl: string;
  cacheKey: string;
  objectKey: string;
  attribution?: ImageAttribution;
};

type ImageAttribution = {
  provider?: string;
  label?: string;
  photographer?: string;
  photographerUrl?: string;
  sourceUrl?: string;
  sourceId?: string;
  cacheVersion?: string;
};

type ImageSemanticMetadata = Record<string, string | undefined>;

type ImageCacheInput = {
  prompt: string;
  model: string;
  aspectRatio: string;
  cacheId?: string;
  semanticCacheId?: string;
  semanticMetadata?: ImageSemanticMetadata;
  imageAttribution?: ImageAttribution;
  imageSource?: 'manual-upload';
};

type SemanticImageCacheRecord = {
  version: 'generated-images/v2';
  cacheKey: string;
  objectKey: string;
  contentType: string;
  createdAt: string;
  promptHash: string;
  metadata: Record<string, string>;
};

type UploadedImageCacheRecord = SemanticImageCacheRecord & {
  source: 'manual-upload';
  aliases: string[];
};

const IMAGE_CACHE_PREFIX = 'generated-images/v1';
const SEMANTIC_IMAGE_CACHE_PREFIX = 'generated-images/v2';
const SEMANTIC_IMAGE_INDEX_PREFIX = 'image-semantic:v2';
const SEMANTIC_IMAGE_ALIAS_VERSION = 'image-semantic-alias-v1';
const UPLOADED_IMAGE_ALIAS_VERSION = 'image-uploaded-alias-v1';
const SEMANTIC_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CURRENT_PEXELS_CACHE_VERSION = 'pexels-selection-v5';

let s3Client: S3Client | null = null;
let s3ClientAccountId: string | null = null;
let loggedMissingConfig = false;
let kvAccessDisabledReason: string | null = null;

function getConfig(): R2ImageCacheConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const cacheSecret = process.env.R2_IMAGE_CACHE_SECRET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !cacheSecret) {
    if (!loggedMissingConfig) {
      loggedMissingConfig = true;
      console.warn('R2 image cache disabled because required configuration is missing.', {
        hasAccountId: Boolean(accountId),
        hasAccessKeyId: Boolean(accessKeyId),
        hasSecretAccessKey: Boolean(secretAccessKey),
        hasBucketName: Boolean(bucketName),
        hasCacheSecret: Boolean(cacheSecret),
      });
    }
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, cacheSecret };
}

function getKvConfig(): CloudflareKvConfig | null {
  if (process.env.R2_IMAGE_CACHE_KV_DISABLED === 'true' || kvAccessDisabledReason) {
    return null;
  }

  const accountId = (
    process.env.CLOUDFLARE_ACCOUNT_ID
    || process.env.CF_ACCOUNT_ID
    || process.env.R2_ACCOUNT_ID
  )?.trim();
  const apiToken = (
    process.env.CLOUDFLARE_API_TOKEN
    || process.env.CF_API_TOKEN
  )?.trim();
  const namespaceId = (
    process.env.R2_IMAGE_CACHE_KV_NAMESPACE_ID
    || process.env.IMAGE_CACHE_KV_NAMESPACE_ID
    || process.env.CLOUDFLARE_IMAGE_CACHE_KV_NAMESPACE_ID
  )?.trim();

  if (!accountId || !apiToken || !namespaceId) {
    return null;
  }

  return { accountId, apiToken, namespaceId };
}

function disableKvAccess(reason: string, status?: number): void {
  if (kvAccessDisabledReason) return;
  kvAccessDisabledReason = reason;
  console.warn('Semantic image KV index disabled for this runtime.', status ? { reason, status } : { reason });
}

function getClient(config: R2ImageCacheConfig): S3Client {
  if (s3Client && s3ClientAccountId === config.accountId) {
    return s3Client;
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  s3ClientAccountId = config.accountId;
  return s3Client;
}

function normalizePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, ' ').trim();
}

function normalizeCacheId(cacheId: string): string {
  return cacheId.replace(/\s+/g, ' ').trim();
}

function normalizeSemanticMetadata(metadata: ImageSemanticMetadata | undefined): Record<string, string> {
  if (!metadata) return {};

  return Object.keys(metadata)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      const value = metadata[key];
      if (typeof value !== 'string') return acc;
      const normalizedValue = value.replace(/\s+/g, ' ').trim();
      if (normalizedValue) {
        acc[key] = normalizedValue.slice(0, 500);
      }
      return acc;
    }, {});
}

function slugify(value: string | undefined, fallback: string): string {
  const slug = (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || fallback;
}

function semanticSubjectSlug(metadata: Record<string, string>): string {
  const subjectSlug = slugify(metadata.subject || metadata.topic, 'general');
  const parts = subjectSlug.split('-');
  if (
    subjectSlug.includes('values-education')
    || subjectSlug.includes('edukasyon-sa-pagpapakatao')
    || parts.includes('esp')
  ) {
    return 'values-education';
  }

  const searchable = slugify([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '), 'general');
  const hasScienceSubject = subjectSlug === 'science'
    || subjectSlug.includes('science')
    || searchable.includes('science');
  const hasParticleModelTopic = searchable.includes('particle-model')
    || searchable.includes('particle-motion')
    || searchable.includes('particle-arrangement')
    || searchable.includes('states-of-matter')
    || searchable.includes('changes-of-state')
    || searchable.includes('phase-change')
    || (searchable.includes('particle') && searchable.includes('matter'));
  if (hasScienceSubject && hasParticleModelTopic) {
    return 'science-particle-model';
  }

  const hasDigestiveTopic = searchable.includes('digestive-tract')
    || searchable.includes('digestive-process')
    || searchable.includes('digestion')
    || searchable.includes('mechanical-processing')
    || searchable.includes('chemical-digestion')
    || searchable.includes('secretion')
    || searchable.includes('absorption')
    || searchable.includes('elimination')
    || searchable.includes('small-intestine')
    || searchable.includes('villi')
    || searchable.includes('accessory-organ')
    || searchable.includes('food-path');
  if (hasScienceSubject && hasDigestiveTopic) {
    return 'science-digestive-system';
  }

  const hasEnglishSubject = subjectSlug === 'english'
    || subjectSlug.includes('english')
    || searchable.includes('english');
  const hasPoetryImageryTopic = searchable.includes('poetry-descriptions-imagery')
    || searchable.includes('descriptions-and-imagery')
    || searchable.includes('poetry')
    || searchable.includes('imagery')
    || searchable.includes('descriptive-words')
    || searchable.includes('literary-text')
    || searchable.includes('en7lit-i-1')
    || searchable.includes('context-clues')
    || searchable.includes('figurative-language')
    || searchable.includes('personification')
    || searchable.includes('rhyme')
    || searchable.includes('stanza')
    || searchable.includes('tone')
    || searchable.includes('diction')
    || searchable.includes('biographical-context')
    || searchable.includes('historical-context')
    || searchable.includes('sociocultural-context')
    || searchable.includes('for-the-young-yearning-a-song-of-green');
  if (hasEnglishSubject && hasPoetryImageryTopic) {
    return 'english-poetry-imagery';
  }

  return subjectSlug;
}

function semanticGradeScopeSlug(metadata: Record<string, string>): string {
  return slugify(metadata.gradeLevel || metadata.gradeBand, 'all-grades');
}

function semanticTopicSlug(metadata: Record<string, string>, subject: string): string {
  const subjectSlug = slugify(metadata.subject || metadata.topic, 'general');
  if (subject !== subjectSlug && subject !== 'values-education') {
    return subject;
  }

  return slugify(
    [
      metadata.learningCompetency,
      metadata.topic,
    ].filter(Boolean).join(' '),
    subject,
  );
}

function isSpecificSemanticAnchor(anchor: string): boolean {
  if (!anchor || anchor.length < 10) return false;

  const genericAnchors = new Set([
    'activity',
    'application',
    'assessment',
    'concept',
    'content',
    'discussion',
    'generalization',
    'learning-roadmap',
    'model',
    'objectives',
    'overview',
    'practice',
    'review',
    'situation',
    'summary',
    'success-criteria',
  ]);

  return !genericAnchors.has(anchor);
}

function extensionFromContentType(contentType: string): string {
  const normalized = normalizeImageContentType(contentType);
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  return 'png';
}

function normalizeImageContentType(contentType: string | undefined): string | null {
  if (!contentType) return 'image/png';
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  if (normalized === 'image/jpg') return 'image/jpeg';
  return SUPPORTED_IMAGE_CONTENT_TYPES.has(normalized) ? normalized : null;
}

function normalizeMetadataValue(value: string | undefined, maxLength: number): string {
  return (value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, maxLength);
}

function attributionMetadata(attribution: ImageAttribution | undefined): Record<string, string> {
  if (!attribution?.provider) return {};
  const metadata = {
    attributionProvider: normalizeMetadataValue(attribution.provider, 32),
    attributionLabel: normalizeMetadataValue(attribution.label, 256),
    attributionPhotographer: normalizeMetadataValue(attribution.photographer, 128),
    attributionPhotographerUrl: normalizeMetadataValue(attribution.photographerUrl, 256),
    attributionSourceUrl: normalizeMetadataValue(attribution.sourceUrl, 256),
    attributionSourceId: normalizeMetadataValue(attribution.sourceId, 64),
    attributionCacheVersion: normalizeMetadataValue(attribution.cacheVersion, 64),
  };

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => Boolean(value))
  );
}

function attributionFromMetadata(metadata: Record<string, string> | undefined): ImageAttribution | undefined {
  if (!metadata?.attributionprovider && !metadata?.attributionProvider) return undefined;
  const provider = metadata.attributionprovider || metadata.attributionProvider;
  const label = metadata.attributionlabel || metadata.attributionLabel;
  const photographer = metadata.attributionphotographer || metadata.attributionPhotographer;
  const photographerUrl = metadata.attributionphotographerurl || metadata.attributionPhotographerUrl;
  const sourceUrl = metadata.attributionsourceurl || metadata.attributionSourceUrl;
  const sourceId = metadata.attributionsourceid || metadata.attributionSourceId;
  const cacheVersion = metadata.attributioncacheversion || metadata.attributionCacheVersion;

  return {
    provider,
    ...(label ? { label } : {}),
    ...(photographer ? { photographer } : {}),
    ...(photographerUrl ? { photographerUrl } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(cacheVersion ? { cacheVersion } : {}),
  };
}

function isStalePexelsAttribution(attribution: ImageAttribution | undefined): boolean {
  return attribution?.provider === 'pexels' && attribution.cacheVersion !== CURRENT_PEXELS_CACHE_VERSION;
}

function createPromptHash(input: ImageCacheInput, cacheSecret: string): string {
  return createHmac('sha256', cacheSecret)
    .update(JSON.stringify({
      prompt: normalizePrompt(input.prompt),
      model: input.model.trim(),
      aspectRatio: input.aspectRatio.trim(),
      version: SEMANTIC_IMAGE_CACHE_PREFIX,
    }))
    .digest('hex');
}

function createCacheKey(input: ImageCacheInput, cacheSecret: string, cacheId?: string): string {
  const stableCacheId = cacheId ? normalizeCacheId(cacheId) : '';
  const payload = stableCacheId
    ? JSON.stringify({
      cacheId: stableCacheId,
      aspectRatio: input.aspectRatio.trim(),
      version: IMAGE_CACHE_PREFIX,
    })
    : JSON.stringify({
      prompt: normalizePrompt(input.prompt),
      model: input.model.trim(),
      aspectRatio: input.aspectRatio.trim(),
      version: IMAGE_CACHE_PREFIX,
    });

  return createHmac('sha256', cacheSecret).update(payload).digest('hex');
}

function createSemanticCacheKey(input: ImageCacheInput, cacheSecret: string): string | null {
  const stableSemanticId = input.semanticCacheId ? normalizeCacheId(input.semanticCacheId) : '';
  if (!stableSemanticId) return null;

  const semanticMetadata = normalizeSemanticMetadata(input.semanticMetadata);
  const payload = JSON.stringify({
    semanticCacheId: stableSemanticId,
    aspectRatio: input.aspectRatio.trim(),
    style: semanticMetadata.style || '',
    version: SEMANTIC_IMAGE_CACHE_PREFIX,
  });

  return createHmac('sha256', cacheSecret).update(payload).digest('hex');
}

function getStableCacheIds(input: ImageCacheInput): string[] {
  return Array.from(new Set([
    input.cacheId,
    input.semanticCacheId,
    ...getSemanticAliasCacheIds(input),
  ]
    .map((cacheId) => (typeof cacheId === 'string' ? normalizeCacheId(cacheId) : ''))
    .filter(Boolean)));
}

function getSemanticAliasCacheIds(input: ImageCacheInput): string[] {
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  if (Object.keys(metadata).length === 0) return [];

  const subject = semanticSubjectSlug(metadata);
  const gradeScope = semanticGradeScopeSlug(metadata);
  const topic = semanticTopicSlug(metadata, subject);
  const role = slugify(metadata.slideTemplate || metadata.visualRole, 'content');
  const style = slugify(metadata.style, 'illustration');
  const anchor = slugify(metadata.semanticAnchor, '');
  const competency = slugify(metadata.learningCompetency, '');
  const aliasBase = `${SEMANTIC_IMAGE_ALIAS_VERSION}:subject=${subject}:grade=${gradeScope}:role=${role}:style=${style}`;
  const anchorPart = anchor || role;
  const aliases = [
    `${aliasBase}:topic=${topic}:anchor=${anchorPart}`,
  ];

  if (competency) {
    aliases.push(`${aliasBase}:competency=${competency}:anchor=${anchorPart}`);
  }

  if (isSpecificSemanticAnchor(anchor)) {
    aliases.push(`${aliasBase}:anchor=${anchor}`);
  }

  return aliases;
}

function objectKeyForCacheKey(cacheKey: string): string {
  return `${IMAGE_CACHE_PREFIX}/${cacheKey}.png`;
}

function objectKeyForSemanticCacheKey(
  input: ImageCacheInput,
  cacheKey: string,
  contentType: string,
): string {
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  const subject = slugify(metadata.subject || metadata.topic, 'general');
  const role = slugify(metadata.visualRole, 'content');
  const gradeBand = slugify(metadata.gradeBand, 'all-grades');
  const extension = extensionFromContentType(contentType);

  return `${SEMANTIC_IMAGE_CACHE_PREFIX}/${subject}/${role}/${gradeBand}/${cacheKey}/image.${extension}`;
}

function curatedObjectKeysForSemanticMetadata(input: ImageCacheInput): string[] {
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  const hasCuratedScope = Boolean(
    metadata.collection
    || metadata.subject
    || metadata.topic
    || metadata.learningCompetency
    || metadata.semanticAnchor
  );
  if (!hasCuratedScope) return [];

  const subject = semanticSubjectSlug(metadata);
  const template = slugify(metadata.slideTemplate || metadata.visualRole, 'content');
  const anchor = slugify(metadata.semanticAnchor, '');
  const competency = slugify(metadata.learningCompetency, '');
  const gradeScopes = Array.from(new Set([
    slugify(metadata.gradeLevel, ''),
    slugify(metadata.gradeBand, ''),
    'all-grades',
  ].filter(Boolean)));

  const keyBases = anchor
    ? gradeScopes.map((gradeScope) => `${SEMANTIC_IMAGE_CACHE_PREFIX}/_curated/${subject}/${template}/${gradeScope}/anchors/${anchor}/image`)
    : [
        ...(competency
          ? gradeScopes.map((gradeScope) => `${SEMANTIC_IMAGE_CACHE_PREFIX}/_curated/${subject}/${template}/${gradeScope}/competencies/${competency}/image`)
          : []),
        ...gradeScopes.map((gradeScope) => `${SEMANTIC_IMAGE_CACHE_PREFIX}/_curated/${subject}/${template}/${gradeScope}/image`),
      ];

  return keyBases.flatMap((keyBase) => (
    SEMANTIC_IMAGE_EXTENSIONS.map((extension) => `${keyBase}.${extension}`)
  ));
}

function semanticLookupLogMetadata(input: ImageCacheInput, config: R2ImageCacheConfig): Record<string, string> {
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  return {
    bucketName: config.bucketName,
    subject: metadata.subject || metadata.topic || '',
    template: metadata.slideTemplate || metadata.visualRole || '',
    gradeBand: metadata.gradeBand || '',
  };
}

async function getCachedCuratedSemanticR2Image(
  input: ImageCacheInput,
  config: R2ImageCacheConfig,
  cacheKey: string,
): Promise<CachedImage | null> {
  const curatedObjectKeys = curatedObjectKeysForSemanticMetadata(input);
  for (const objectKey of curatedObjectKeys) {
    const curatedImage = await getCachedR2ImageObject(objectKey, cacheKey, config);
    if (curatedImage) {
      console.info('Curated semantic image fallback hit.', {
        ...semanticLookupLogMetadata(input, config),
        objectKey,
      });
      return curatedImage;
    }
  }

  if (curatedObjectKeys.length > 0) {
    console.info('Curated semantic image fallback missed.', {
      ...semanticLookupLogMetadata(input, config),
      firstObjectKey: curatedObjectKeys[0],
      keyCount: curatedObjectKeys.length,
    });
  }

  return null;
}

function semanticIndexKey(input: ImageCacheInput): string | null {
  const semanticCacheId = input.semanticCacheId ? normalizeCacheId(input.semanticCacheId) : '';
  if (!semanticCacheId) return null;

  return `${SEMANTIC_IMAGE_INDEX_PREFIX}:${semanticCacheId}`;
}

function semanticIndexObjectKey(input: ImageCacheInput): string | null {
  const semanticCacheId = input.semanticCacheId ? normalizeCacheId(input.semanticCacheId) : '';
  if (!semanticCacheId) return null;

  const indexHash = createHash('sha256').update(semanticCacheId).digest('hex');
  return `${SEMANTIC_IMAGE_CACHE_PREFIX}/_index/${indexHash}.json`;
}

function uploadedImageUnitSlug(metadata: Record<string, string>): string {
  return slugify([
    metadata.planUnitLabel,
    metadata.planUnitNumber,
    metadata.planUnitTitle,
  ].filter(Boolean).join(' '), '');
}

function uploadedImageAliases(input: ImageCacheInput): string[] {
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  if (Object.keys(metadata).length === 0) return [];

  const subject = semanticSubjectSlug(metadata);
  const gradeScope = semanticGradeScopeSlug(metadata);
  const topic = semanticTopicSlug(metadata, subject);
  const unit = uploadedImageUnitSlug(metadata);
  const role = slugify(metadata.slideTemplate || metadata.visualRole, 'content');
  const style = slugify(metadata.style, 'illustration');
  const anchor = slugify(metadata.semanticAnchor, '');
  const competency = slugify(metadata.learningCompetency, '');
  const base = `${UPLOADED_IMAGE_ALIAS_VERSION}:subject=${subject}:grade=${gradeScope}:role=${role}:style=${style}`;
  const aliases: string[] = [];

  if (unit) {
    if (topic && anchor) aliases.push(`${base}:topic=${topic}:unit=${unit}:anchor=${anchor}`);
    if (topic) aliases.push(`${base}:topic=${topic}:unit=${unit}`);
    if (competency && anchor) aliases.push(`${base}:competency=${competency}:unit=${unit}:anchor=${anchor}`);
    if (competency) aliases.push(`${base}:competency=${competency}:unit=${unit}`);
  } else {
    if (topic && anchor) aliases.push(`${base}:topic=${topic}:anchor=${anchor}`);
    if (topic) aliases.push(`${base}:topic=${topic}`);
    if (competency && anchor) aliases.push(`${base}:competency=${competency}:anchor=${anchor}`);
    if (competency) aliases.push(`${base}:competency=${competency}`);
  }

  return Array.from(new Set(aliases));
}

function uploadedImageIndexObjectKey(alias: string): string {
  const indexHash = createHash('sha256').update(alias).digest('hex');
  return `${SEMANTIC_IMAGE_CACHE_PREFIX}/_uploaded-index/${indexHash}.json`;
}

function uploadedImageObjectKey(input: ImageCacheInput, cacheKey: string, contentType: string): string {
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  const subject = semanticSubjectSlug(metadata);
  const gradeScope = semanticGradeScopeSlug(metadata);
  const topic = semanticTopicSlug(metadata, subject);
  const unit = uploadedImageUnitSlug(metadata) || 'all-units';
  const role = slugify(metadata.slideTemplate || metadata.visualRole, 'content');
  const anchor = slugify(metadata.semanticAnchor, 'manual-upload');
  const extension = extensionFromContentType(contentType);

  return `${SEMANTIC_IMAGE_CACHE_PREFIX}/_uploaded/${subject}/${gradeScope}/${topic}/${unit}/${role}/${anchor}-${cacheKey.slice(0, 12)}/image.${extension}`;
}

async function getUploadedSemanticR2Image(
  input: ImageCacheInput,
  config: R2ImageCacheConfig,
  cacheKey: string,
): Promise<CachedImage | null> {
  const aliases = uploadedImageAliases(input);
  const records = await Promise.all(
    aliases.map((alias) => getR2JsonRecord<UploadedImageCacheRecord>(uploadedImageIndexObjectKey(alias), config)),
  );

  for (const record of records) {
    if (!record?.objectKey) continue;

    const uploadedImage = await getCachedR2ImageObject(record.objectKey, record.cacheKey || cacheKey, config);
    if (uploadedImage) {
      console.info('Uploaded semantic image override hit.', {
        ...semanticLookupLogMetadata(input, config),
        objectKey: record.objectKey,
      });
      return uploadedImage;
    }
  }

  return null;
}

async function getKvRecord<T>(key: string): Promise<T | null> {
  const config = getKvConfig();
  if (!config) return null;

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        disableKvAccess('cloudflare-api-token-rejected', response.status);
      }
      console.warn('Failed to read semantic image index.', { status: response.status });
      return null;
    }

    return await response.json() as T;
  } catch {
    console.warn('Failed to read semantic image index.');
    return null;
  }
}

async function setKvRecord<T>(key: string, value: T): Promise<boolean> {
  const config = getKvConfig();
  if (!config) return false;

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(value),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        disableKvAccess('cloudflare-api-token-rejected', response.status);
      }
      console.warn('Failed to write semantic image index.', { status: response.status });
      return false;
    }

    return true;
  } catch {
    console.warn('Failed to write semantic image index.');
    return false;
  }
}

async function getR2JsonRecord<T>(
  objectKey: string,
  config: R2ImageCacheConfig,
): Promise<T | null> {
  try {
    const response = await getClient(config).send(new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    }));
    const buffer = await streamToBuffer(response.Body);
    if (buffer.length === 0) return null;
    return JSON.parse(buffer.toString('utf8')) as T;
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (statusCode !== 404) {
      console.warn('Failed to read semantic image R2 index.', { statusCode });
    }
    return null;
  }
}

async function setR2JsonRecord<T>(
  objectKey: string,
  value: T,
  config: R2ImageCacheConfig,
): Promise<boolean> {
  try {
    await getClient(config).send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: JSON.stringify(value),
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'private, max-age=31536000, immutable',
    }));
    return true;
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    console.warn('Failed to write semantic image R2 index.', statusCode ? { statusCode } : undefined);
    return false;
  }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  const stream = body as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function dataUrlFromBuffer(buffer: Buffer, contentType: string | undefined): string | null {
  const mime = normalizeImageContentType(contentType);
  if (!mime) return null;
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function getCachedR2ImageObject(
  objectKey: string,
  cacheKey: string,
  config: R2ImageCacheConfig,
): Promise<CachedImage | null> {
  try {
    const response = await getClient(config).send(new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    }));
    const buffer = await streamToBuffer(response.Body);
    if (buffer.length === 0) return null;
    const dataUrl = dataUrlFromBuffer(buffer, response.ContentType);
    if (!dataUrl) {
      console.warn('Ignored saved image data with unsupported content type.', {
        objectKey,
        contentType: response.ContentType,
      });
      return null;
    }

    const attribution = attributionFromMetadata(response.Metadata);
    if (isStalePexelsAttribution(attribution)) {
      console.info('Ignored stale Pexels cached image created by an older selection strategy.', { objectKey });
      return null;
    }

    return {
      dataUrl,
      cacheKey,
      objectKey,
      attribution,
    };
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (statusCode !== 404) {
      console.warn('Failed to read saved image data.', { statusCode });
    }
    return null;
  }
}

async function getCachedSemanticR2Image(
  input: ImageCacheInput,
  config: R2ImageCacheConfig,
): Promise<CachedImage | null> {
  const semanticCacheKey = createSemanticCacheKey(input, config.cacheSecret);
  if (!semanticCacheKey) {
    const promptCacheKey = createPromptHash(input, config.cacheSecret);
    const curatedImage = await getCachedCuratedSemanticR2Image(input, config, promptCacheKey);
    if (curatedImage) return curatedImage;
    return getUploadedSemanticR2Image(input, config, promptCacheKey);
  }

  const curatedImage = await getCachedCuratedSemanticR2Image(input, config, semanticCacheKey);
  if (curatedImage) return curatedImage;

  const uploadedImage = await getUploadedSemanticR2Image(input, config, semanticCacheKey);
  if (uploadedImage) return uploadedImage;

  const indexObjectKey = semanticIndexObjectKey(input);
  if (indexObjectKey) {
    const record = await getR2JsonRecord<SemanticImageCacheRecord>(indexObjectKey, config);
    if (record?.objectKey) {
      const indexedImage = await getCachedR2ImageObject(record.objectKey, record.cacheKey || semanticCacheKey, config);
      if (indexedImage) return indexedImage;
    }
  }

  const indexKey = semanticIndexKey(input);
  if (indexKey) {
    const record = await getKvRecord<SemanticImageCacheRecord>(indexKey);
    if (record?.objectKey) {
      const indexedImage = await getCachedR2ImageObject(record.objectKey, record.cacheKey || semanticCacheKey, config);
      if (indexedImage) return indexedImage;
    }
  }

  for (const extension of SEMANTIC_IMAGE_EXTENSIONS) {
    const objectKey = objectKeyForSemanticCacheKey(input, semanticCacheKey, `image/${extension === 'jpg' ? 'jpeg' : extension}`);
    const cachedImage = await getCachedR2ImageObject(objectKey, semanticCacheKey, config);
    if (cachedImage) return cachedImage;
  }

  return null;
}

async function getCachedR2ImageForKey(
  input: ImageCacheInput,
  config: R2ImageCacheConfig,
  cacheId?: string,
): Promise<CachedImage | null> {
  const cacheKey = createCacheKey(input, config.cacheSecret, cacheId);
  const objectKey = objectKeyForCacheKey(cacheKey);

  try {
    const response = await getClient(config).send(new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    }));
    const buffer = await streamToBuffer(response.Body);
    if (buffer.length === 0) return null;
    const dataUrl = dataUrlFromBuffer(buffer, response.ContentType);
    if (!dataUrl) {
      console.warn('Ignored saved image data with unsupported content type.', {
        objectKey,
        contentType: response.ContentType,
      });
      return null;
    }

    const attribution = attributionFromMetadata(response.Metadata);
    if (isStalePexelsAttribution(attribution)) {
      console.info('Ignored stale Pexels cached image created by an older selection strategy.', { objectKey });
      return null;
    }

    return {
      dataUrl,
      cacheKey,
      objectKey,
      attribution,
    };
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (statusCode !== 404) {
      console.warn('Failed to read saved image data.', { statusCode });
    }
    return null;
  }
}

export async function getCachedR2Image(input: ImageCacheInput): Promise<CachedImage | null> {
  const config = getConfig();
  if (!config) return null;

  const semanticCachedImage = await getCachedSemanticR2Image(input, config);
  if (semanticCachedImage) return semanticCachedImage;

  const stableCacheIds = getStableCacheIds(input);
  for (const cacheId of stableCacheIds) {
    const cachedImage = await getCachedR2ImageForKey(input, config, cacheId);
    if (cachedImage) return cachedImage;
  }

  return getCachedR2ImageForKey(input, config);
}

async function setCachedR2ImageForKey(
  input: ImageCacheInput,
  imageBytes: string,
  contentType: string,
  config: R2ImageCacheConfig,
  cacheId?: string,
): Promise<CachedImage | null> {
  const safeContentType = normalizeImageContentType(contentType);
  if (!safeContentType) {
    console.warn('Refused to cache image with unsupported content type.', { contentType });
    return null;
  }

  const cacheKey = createCacheKey(input, config.cacheSecret, cacheId);
  const objectKey = objectKeyForCacheKey(cacheKey);
  const buffer = Buffer.from(imageBytes, 'base64');

  if (buffer.length === 0) return null;

  try {
    await getClient(config).send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: safeContentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        cacheKey,
        ...attributionMetadata(input.imageAttribution),
      },
    }));

    const dataUrl = dataUrlFromBuffer(buffer, safeContentType);
    if (!dataUrl) return null;

    return {
      dataUrl,
      cacheKey,
      objectKey,
      attribution: input.imageAttribution,
    };
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    console.warn('Failed to write saved image data.', statusCode ? { statusCode } : undefined);
    return null;
  }
}

async function setCachedSemanticR2Image(
  input: ImageCacheInput,
  imageBytes: string,
  contentType: string,
  config: R2ImageCacheConfig,
): Promise<CachedImage | null> {
  const safeContentType = normalizeImageContentType(contentType);
  if (!safeContentType) {
    console.warn('Refused to cache semantic image with unsupported content type.', { contentType });
    return null;
  }

  const cacheKey = createSemanticCacheKey(input, config.cacheSecret);
  const indexKey = semanticIndexKey(input);
  if (!cacheKey || !indexKey) return null;

  const buffer = Buffer.from(imageBytes, 'base64');
  if (buffer.length === 0) return null;

  const objectKey = objectKeyForSemanticCacheKey(input, cacheKey, safeContentType);
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  const promptHash = createPromptHash(input, config.cacheSecret);
  const record: SemanticImageCacheRecord = {
    version: SEMANTIC_IMAGE_CACHE_PREFIX,
    cacheKey,
    objectKey,
    contentType: safeContentType,
    createdAt: new Date().toISOString(),
    promptHash,
    metadata,
  };

  try {
    await getClient(config).send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: safeContentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        cacheKey,
        semanticCacheId: normalizeMetadataValue(normalizeCacheId(input.semanticCacheId || ''), 256),
        subject: normalizeMetadataValue(metadata.subject || metadata.topic || 'general', 128),
        visualRole: normalizeMetadataValue(metadata.visualRole || 'content', 64),
        ...attributionMetadata(input.imageAttribution),
      },
    }));

    const indexObjectKey = semanticIndexObjectKey(input);
    if (indexObjectKey) {
      await setR2JsonRecord<SemanticImageCacheRecord>(indexObjectKey, record, config);
    }
    await setKvRecord<SemanticImageCacheRecord>(indexKey, record);

    const dataUrl = dataUrlFromBuffer(buffer, safeContentType);
    if (!dataUrl) return null;

    return {
      dataUrl,
      cacheKey,
      objectKey,
      attribution: input.imageAttribution,
    };
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    console.warn('Failed to write semantic image data.', statusCode ? { statusCode } : undefined);
    return null;
  }
}

async function setUploadedSemanticR2Image(
  input: ImageCacheInput,
  imageBytes: string,
  contentType: string,
  config: R2ImageCacheConfig,
): Promise<CachedImage | null> {
  if (input.imageSource !== 'manual-upload') return null;

  const safeContentType = normalizeImageContentType(contentType);
  if (!safeContentType) {
    console.warn('Refused to cache uploaded image with unsupported content type.', { contentType });
    return null;
  }

  const aliases = uploadedImageAliases(input);
  if (aliases.length === 0) return null;

  const buffer = Buffer.from(imageBytes, 'base64');
  if (buffer.length === 0) return null;

  const cacheKey = createSemanticCacheKey(input, config.cacheSecret) || createPromptHash(input, config.cacheSecret);
  const objectKey = uploadedImageObjectKey(input, cacheKey, safeContentType);
  const metadata = normalizeSemanticMetadata(input.semanticMetadata);
  const promptHash = createPromptHash(input, config.cacheSecret);
  const record: UploadedImageCacheRecord = {
    version: SEMANTIC_IMAGE_CACHE_PREFIX,
    source: 'manual-upload',
    cacheKey,
    objectKey,
    contentType: safeContentType,
    createdAt: new Date().toISOString(),
    promptHash,
    metadata,
    aliases,
  };

  try {
    await getClient(config).send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: safeContentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        cacheKey,
        source: 'manual-upload',
        subject: normalizeMetadataValue(metadata.subject || metadata.topic || 'general', 128),
        visualRole: normalizeMetadataValue(metadata.visualRole || 'content', 64),
        ...attributionMetadata(input.imageAttribution),
      },
    }));

    await Promise.all(
      aliases.map((alias) => setR2JsonRecord<UploadedImageCacheRecord>(uploadedImageIndexObjectKey(alias), record, config)),
    );

    const dataUrl = dataUrlFromBuffer(buffer, safeContentType);
    if (!dataUrl) return null;

    return {
      dataUrl,
      cacheKey,
      objectKey,
      attribution: input.imageAttribution,
    };
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    console.warn('Failed to write uploaded semantic image data.', statusCode ? { statusCode } : undefined);
    return null;
  }
}

export async function setCachedR2Image(input: ImageCacheInput, imageBytes: string, contentType: string): Promise<CachedImage | null> {
  const config = getConfig();
  if (!config) return null;

  const uploadedStoredImage = await setUploadedSemanticR2Image(input, imageBytes, contentType, config);
  const semanticStoredImage = await setCachedSemanticR2Image(input, imageBytes, contentType, config);
  const stableCacheIds = getStableCacheIds(input);
  if (stableCacheIds.length === 0) {
    const storedImage = await setCachedR2ImageForKey(input, imageBytes, contentType, config);
    return uploadedStoredImage || semanticStoredImage || storedImage;
  }

  let firstStoredImage: CachedImage | null = uploadedStoredImage || semanticStoredImage;
  for (const cacheId of stableCacheIds) {
    const storedImage = await setCachedR2ImageForKey(input, imageBytes, contentType, config, cacheId);
    if (!firstStoredImage && storedImage) {
      firstStoredImage = storedImage;
    }
  }

  return firstStoredImage;
}
