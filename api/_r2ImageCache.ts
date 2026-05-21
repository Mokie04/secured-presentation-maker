import { createHmac } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type R2ImageCacheConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  cacheSecret: string;
};

type CachedImage = {
  dataUrl: string;
  cacheKey: string;
  objectKey: string;
};

type ImageCacheInput = {
  prompt: string;
  model: string;
  aspectRatio: string;
};

const IMAGE_CACHE_PREFIX = 'generated-images/v1';

let s3Client: S3Client | null = null;
let s3ClientAccountId: string | null = null;

function getConfig(): R2ImageCacheConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const cacheSecret = process.env.R2_IMAGE_CACHE_SECRET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !cacheSecret) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, cacheSecret };
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

function createCacheKey(input: ImageCacheInput, cacheSecret: string): string {
  const payload = JSON.stringify({
    prompt: normalizePrompt(input.prompt),
    model: input.model.trim(),
    aspectRatio: input.aspectRatio.trim(),
    version: IMAGE_CACHE_PREFIX,
  });

  return createHmac('sha256', cacheSecret).update(payload).digest('hex');
}

function objectKeyForCacheKey(cacheKey: string): string {
  return `${IMAGE_CACHE_PREFIX}/${cacheKey}.png`;
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

function dataUrlFromBuffer(buffer: Buffer, contentType: string | undefined): string {
  const mime = contentType || 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export async function getCachedR2Image(input: ImageCacheInput): Promise<CachedImage | null> {
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

    return {
      dataUrl: dataUrlFromBuffer(buffer, response.ContentType),
      cacheKey,
      objectKey,
    };
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (statusCode !== 404) {
      console.warn('Failed to read R2 image cache:', error);
    }
    return null;
  }
}

export async function setCachedR2Image(input: ImageCacheInput, imageBytes: string, contentType: string): Promise<CachedImage | null> {
  const config = getConfig();
  if (!config) return null;

  const cacheKey = createCacheKey(input, config.cacheSecret);
  const objectKey = objectKeyForCacheKey(cacheKey);
  const buffer = Buffer.from(imageBytes, 'base64');

  if (buffer.length === 0) return null;

  try {
    await getClient(config).send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        cacheKey,
      },
    }));

    return {
      dataUrl: dataUrlFromBuffer(buffer, contentType),
      cacheKey,
      objectKey,
    };
  } catch (error) {
    console.warn('Failed to write R2 image cache:', error);
    return null;
  }
}
