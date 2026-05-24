import { createHmac } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type R2TextCacheConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  cacheSecret: string;
};

type TextGenerationCacheInput = {
  provider: string;
  models: string[];
  contents: unknown;
  config?: Record<string, unknown>;
};

const TEXT_CACHE_PREFIX = 'generated-text/v1';

let s3Client: S3Client | null = null;
let s3ClientAccountId: string | null = null;

function getConfig(): R2TextCacheConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const cacheSecret = (
    process.env.R2_GENERATION_CACHE_SECRET
    || process.env.R2_IMAGE_CACHE_SECRET
  )?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !cacheSecret) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, cacheSecret };
}

function getClient(config: R2TextCacheConfig): S3Client {
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

function normalizeCachePart(part: unknown): unknown {
  if (typeof part === 'string') {
    return part.replace(/\s+/g, ' ').trim();
  }

  if (Array.isArray(part)) {
    return part.map(normalizeCachePart);
  }

  if (part && typeof part === 'object') {
    return Object.keys(part as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeCachePart((part as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return part;
}

function createCacheKey(input: TextGenerationCacheInput, cacheSecret: string): string {
  const payload = JSON.stringify({
    provider: input.provider,
    models: input.models.map((model) => model.trim()).filter(Boolean),
    contents: normalizeCachePart(input.contents),
    config: normalizeCachePart(input.config || {}),
    version: TEXT_CACHE_PREFIX,
  });

  return createHmac('sha256', cacheSecret).update(payload).digest('hex');
}

function objectKeyForCacheKey(cacheKey: string): string {
  return `${TEXT_CACHE_PREFIX}/${cacheKey}.json`;
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

export async function getCachedR2TextGeneration<T>(input: TextGenerationCacheInput): Promise<T | null> {
  const config = getConfig();
  if (!config) return null;

  const cacheKey = createCacheKey(input, config.cacheSecret);
  const objectKey = objectKeyForCacheKey(cacheKey);

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
      console.warn('Failed to read saved generation data.', { statusCode });
    }
    return null;
  }
}

export async function setCachedR2TextGeneration<T>(
  input: TextGenerationCacheInput,
  value: T,
): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  const cacheKey = createCacheKey(input, config.cacheSecret);
  const objectKey = objectKeyForCacheKey(cacheKey);
  const body = JSON.stringify(value);

  try {
    await getClient(config).send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'private, max-age=31536000, immutable',
      Metadata: {
        cacheKey,
      },
    }));
    return true;
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    console.warn('Failed to write saved generation data.', statusCode ? { statusCode } : undefined);
    return false;
  }
}
