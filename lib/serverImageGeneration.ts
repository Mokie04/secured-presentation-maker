import { GoogleGenAI } from '@google/genai';

export type ImageSemanticMetadata = Record<string, string | undefined>;

export type ImageRequestDetails = {
  prompt: string;
  aspectRatio: string;
  cacheId?: string;
  semanticCacheId?: string;
  semanticMetadata?: ImageSemanticMetadata;
  allowPaidImageGeneration?: boolean;
};

export type ImageProvider = 'gemini' | 'xai' | 'replicate';

export type GeneratedImageBytes = {
  base64: string;
  mime: string;
  modelUsed: string;
};

type ReplicatePredictionResponse = {
  id?: string;
  status?: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | string;
  output?: unknown;
  error?: unknown;
  model?: string;
  version?: string;
  urls?: {
    get?: string;
  };
};

const DEFAULT_XAI_IMAGE_TIMEOUT_MS = 25_000;
const DEFAULT_REPLICATE_IMAGE_TIMEOUT_MS = 45_000;
export const DEFAULT_REPLICATE_IMAGE_MODEL = 'black-forest-labs/flux-schnell';
const REPLICATE_POLL_INTERVAL_MS = 1_200;
const REPLICATE_CREATE_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number): number {
  const baseDelay = Math.min(4000, 900 * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * 450);
  return baseDelay + jitter;
}

function getXaiImageTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.XAI_IMAGE_TIMEOUT_MS || '', 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_XAI_IMAGE_TIMEOUT_MS;
  }

  return Math.max(5_000, Math.min(50_000, parsed));
}

function getReplicateImageTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.REPLICATE_IMAGE_TIMEOUT_MS || '', 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REPLICATE_IMAGE_TIMEOUT_MS;
  }

  return Math.max(10_000, Math.min(55_000, parsed));
}

export function normalizeImageProvider(value: string | undefined): ImageProvider | null {
  const configuredProvider = value?.trim().toLowerCase();
  if (configuredProvider === 'xai' || configuredProvider === 'grok') return 'xai';
  if (configuredProvider === 'replicate' || configuredProvider === 'flux' || configuredProvider === 'flux-schnell') return 'replicate';
  if (configuredProvider === 'gemini') return 'gemini';
  return null;
}

export function getDefaultImageProvider(): ImageProvider {
  const configuredProvider = normalizeImageProvider(process.env.AI_IMAGE_PROVIDER);
  if (configuredProvider) return configuredProvider;
  if (process.env.REPLICATE_API_TOKEN) return 'replicate';
  if (process.env.XAI_API_KEY) return 'xai';
  return 'gemini';
}

export function normalizeXaiImageModels(model: string | string[] | undefined): string[] {
  const configuredModel = process.env.XAI_IMAGE_MODEL?.trim();
  const requestedModels = Array.isArray(model) ? model : [model];

  const models = [
    configuredModel,
    ...requestedModels,
    'grok-imagine-image-quality',
  ]
    .map((m) => (typeof m === 'string' ? m.trim().replace(/^models\//, '') : ''))
    .filter((m): m is string => Boolean(m) && m.toLowerCase().startsWith('grok-imagine-image'));

  return Array.from(new Set(models));
}

export function normalizeReplicateModelName(model: string | undefined): string {
  const rawModel = typeof model === 'string' ? model.trim() : '';
  if (!rawModel) return '';

  try {
    const url = new URL(rawModel);
    if (url.hostname === 'replicate.com') {
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        return `${segments[0]}/${segments[1]}`;
      }
    }
  } catch {
    // Not a URL; normalize the plain model name below.
  }

  return rawModel
    .replace(/^replicate\//, '')
    .replace(/^models\//, '')
    .split(':')[0]
    .trim();
}

export function normalizeReplicateImageModels(model: string | string[] | undefined): string[] {
  const configuredModel = process.env.REPLICATE_IMAGE_MODEL?.trim();
  const requestedModels = Array.isArray(model) ? model : [model];

  const models = [
    configuredModel,
    ...requestedModels,
    DEFAULT_REPLICATE_IMAGE_MODEL,
  ]
    .map(normalizeReplicateModelName)
    .filter((m): m is string => Boolean(m) && /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(m));

  return Array.from(new Set(models));
}

export function normalizeGeminiImageModels(model: string | string[] | undefined): string[] {
  const configuredModel = (process.env.GEMINI_IMAGE_MODEL || process.env.VITE_GEMINI_IMAGE_MODEL)?.trim();
  const requestedModels = Array.isArray(model) ? model : [model];

  const models = [
    configuredModel,
    ...requestedModels,
    'models/gemini-2.5-flash-image',
    'models/imagen-4.0-fast-generate-001',
  ]
    .map((m) => (typeof m === 'string' ? m.trim() : ''))
    .filter(Boolean)
    .map((m) => {
      if (m.startsWith('gemini-2.5-flash-image')) return 'models/gemini-2.5-flash-image';
      if (m.startsWith('imagen-4.0-fast')) return 'models/imagen-4.0-fast-generate-001';
      return m.startsWith('models/') ? m : `models/${m}`;
    });

  return Array.from(new Set(models));
}

export function getImageModelCandidates(provider: ImageProvider, model: string | string[] | undefined): string[] {
  if (provider === 'xai') return normalizeXaiImageModels(model);
  if (provider === 'replicate') return normalizeReplicateImageModels(model);
  return normalizeGeminiImageModels(model);
}

function isFluxSchnellModel(model: string): boolean {
  return normalizeReplicateModelName(model).toLowerCase() === DEFAULT_REPLICATE_IMAGE_MODEL;
}

function buildFluxSchnellPrompt(imageRequest: ImageRequestDetails): string {
  const prompt = imageRequest.prompt.replace(/\s+/g, ' ').trim();
  const style = (imageRequest.semanticMetadata?.style || '').toLowerCase();
  const promptSuggestsDiagram = /\b(diagram|infographic|chart|process map|flowchart|particle diagram|force diagram|relationship diagram)\b/i.test(prompt);
  const isDiagram = style === 'diagram' || style === 'infographic' || promptSuggestsDiagram;
  const sceneInstruction = isDiagram
    ? 'Create one clean raster educational visual with simple shapes, precise spacing, and a clear single focus.'
    : 'Create one realistic classroom evidence photograph with natural lighting, accurate scale, sharp focus, and real material textures.';

  return [
    prompt,
    'FLUX Schnell quality constraints:',
    sceneInstruction,
    'Use a simple 16:9 slide composition with one main subject, uncluttered background, and enough empty space for editable slide overlays.',
    'If worksheets, cards, tables, posters, screens, or boards appear, keep them blank or unreadable; do not render actual words, labels, letters, numbers, formulas, captions, logos, UI, signatures, or watermarks.',
    'Do not create a collage, split panel, contact sheet, decorative stock background, cartoon, flat vector icon set, or 3D render unless the original prompt explicitly requires a diagram.',
  ].join(' ');
}

function getXaiErrorMessage(payload: any, status: number): string {
  const message = typeof payload?.error?.message === 'string'
    ? payload.error.message
    : typeof payload?.error === 'string'
      ? payload.error
      : `Image request failed with status ${status}.`;

  if (status === 429 && !message.toLowerCase().includes('rate')) {
    return `rate_limit_exceeded: ${message}`;
  }

  return message;
}

export function detectImageMimeFromBase64(base64: string): string {
  const header = Buffer.from(base64.slice(0, 24), 'base64');
  if (header.length >= 4 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return 'image/png';
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image/jpeg';
  }
  if (header.length >= 12 && header.slice(0, 4).toString('ascii') === 'RIFF' && header.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export async function generateXaiImage(
  candidateModel: string,
  imageRequest: ImageRequestDetails,
): Promise<GeneratedImageBytes> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    const error = new Error('Server is missing XAI_API_KEY.') as Error & { status?: number };
    error.status = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getXaiImageTimeoutMs());
  let response: Response;

  try {
    response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: candidateModel,
        prompt: imageRequest.prompt,
        n: 1,
        response_format: 'b64_json',
        aspect_ratio: imageRequest.aspectRatio,
      }),
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      const timeoutError = new Error('Image generation timed out. Try again later.') as Error & { status?: number };
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(getXaiErrorMessage(payload, response.status)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const base64 = payload?.data?.[0]?.b64_json;
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new Error('Image generation returned no image data.');
  }

  return {
    base64,
    mime: detectImageMimeFromBase64(base64),
    modelUsed: payload?.model || candidateModel,
  };
}

function createStatusError(message: string, status: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function getReplicateErrorMessage(payload: any, status: number): string {
  const rawMessage = payload?.detail || payload?.error || payload?.title || payload?.message;
  if (typeof rawMessage === 'string' && rawMessage.trim()) {
    return rawMessage;
  }
  if (rawMessage && typeof rawMessage === 'object') {
    return JSON.stringify(rawMessage);
  }
  return `Replicate image request failed with status ${status}.`;
}

function isRetryableReplicateStatus(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

function getRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) return null;

  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

async function sleepUntilDeadline(delayMs: number, deadline: number): Promise<void> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw createReplicateTimeoutError();
  }

  await sleep(Math.min(delayMs, remainingMs));
}

function buildReplicatePredictionUrl(model: string): string {
  const [owner, name] = model.split('/');
  if (!owner || !name) {
    throw createStatusError('Server is missing a valid REPLICATE_IMAGE_MODEL.', 500);
  }

  return `https://api.replicate.com/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`;
}

function getReplicateOutputUrls(output: unknown): string[] {
  if (typeof output === 'string') {
    return [output];
  }

  if (Array.isArray(output)) {
    return output.flatMap(getReplicateOutputUrls);
  }

  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>;
    return ['url', 'image', 'output']
      .flatMap((key) => getReplicateOutputUrls(record[key]));
  }

  return [];
}

function parseImageDataUrl(dataUrl: string): { base64: string; mime: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;

  return {
    mime: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(),
    base64: match[2].replace(/\s+/g, ''),
  };
}

function getSupportedImageMime(contentType: string | null, base64: string): string {
  const mime = (contentType || '').split(';')[0].trim().toLowerCase();
  if (['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
    return mime;
  }

  return detectImageMimeFromBase64(base64);
}

function createReplicateTimeoutError(): Error & { status?: number } {
  return createStatusError('Replicate image generation timed out. Try again later.', 504);
}

async function fetchWithDeadline(url: string, init: RequestInit, deadline: number): Promise<Response> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw createReplicateTimeoutError();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remainingMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      throw createReplicateTimeoutError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function pollReplicatePrediction(
  initialPrediction: ReplicatePredictionResponse,
  apiKey: string,
  deadline: number,
): Promise<ReplicatePredictionResponse> {
  let prediction = initialPrediction;

  while (prediction.status !== 'succeeded') {
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw createStatusError(
        typeof prediction.error === 'string' && prediction.error.trim()
          ? prediction.error
          : `Replicate prediction ${prediction.status}.`,
        502,
      );
    }

    if (!prediction.urls?.get) {
      throw createStatusError('Replicate image generation did not return a polling URL.', 502);
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw createReplicateTimeoutError();
    }

    await sleep(Math.min(REPLICATE_POLL_INTERVAL_MS, remainingMs));
    const response = await fetchWithDeadline(prediction.urls.get, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    }, deadline);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (isRetryableReplicateStatus(response.status)) {
        const retryAfterMs = getRetryAfterMs(response) ?? REPLICATE_POLL_INTERVAL_MS;
        await sleepUntilDeadline(retryAfterMs, deadline);
        continue;
      }

      throw createStatusError(getReplicateErrorMessage(payload, response.status), response.status);
    }

    prediction = payload as ReplicatePredictionResponse;
  }

  return prediction;
}

async function fetchReplicateOutputImage(
  outputUrl: string,
  deadline: number,
): Promise<{ base64: string; mime: string }> {
  const parsedDataUrl = parseImageDataUrl(outputUrl);
  if (parsedDataUrl) {
    return parsedDataUrl;
  }

  const response = await fetchWithDeadline(outputUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
    },
  }, deadline);

  if (!response.ok) {
    throw createStatusError(`Replicate image download failed with status ${response.status}.`, response.status);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw createStatusError('Replicate image generation returned empty image data.', 502);
  }

  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    base64,
    mime: getSupportedImageMime(response.headers.get('content-type'), base64),
  };
}

export async function generateReplicateImage(
  candidateModel: string,
  imageRequest: ImageRequestDetails,
): Promise<GeneratedImageBytes> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw createStatusError('Server is missing REPLICATE_API_TOKEN.', 500);
  }

  const deadline = Date.now() + getReplicateImageTimeoutMs();
  let payload: ReplicatePredictionResponse | null = null;
  const prompt = isFluxSchnellModel(candidateModel)
    ? buildFluxSchnellPrompt(imageRequest)
    : imageRequest.prompt;

  for (let attempt = 1; attempt <= REPLICATE_CREATE_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchWithDeadline(buildReplicatePredictionUrl(candidateModel), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: imageRequest.aspectRatio || '16:9',
          num_outputs: 1,
          output_format: 'webp',
          go_fast: true,
        },
      }),
    }, deadline);
    const responsePayload = await response.json().catch(() => ({}));

    if (response.ok) {
      payload = responsePayload as ReplicatePredictionResponse;
      break;
    }

    const canRetry = isRetryableReplicateStatus(response.status) && attempt < REPLICATE_CREATE_MAX_ATTEMPTS;
    if (!canRetry) {
      throw createStatusError(getReplicateErrorMessage(responsePayload, response.status), response.status);
    }

    const retryAfterMs = getRetryAfterMs(response);
    const retryDelayMs = retryAfterMs ?? getRetryDelayMs(attempt);
    console.warn('Replicate image request was rate-limited; retrying.', {
      status: response.status,
      attempt,
      model: candidateModel,
    });
    await sleepUntilDeadline(retryDelayMs, deadline);
  }

  if (!payload) {
    throw createStatusError('Replicate image generation did not start.', 502);
  }

  const prediction = await pollReplicatePrediction(payload, apiKey, deadline);
  const outputUrl = getReplicateOutputUrls(prediction.output)[0];
  if (!outputUrl) {
    throw createStatusError('Replicate image generation returned no image URL.', 502);
  }

  const image = await fetchReplicateOutputImage(outputUrl, deadline);
  return {
    ...image,
    modelUsed: prediction.model || candidateModel,
  };
}

export async function generateGeminiImage(
  candidateModel: string,
  imageRequest: ImageRequestDetails,
): Promise<GeneratedImageBytes> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createStatusError('Server is missing GEMINI_API_KEY.', 500);
  }

  const ai = new GoogleGenAI({ apiKey });
  const response: any = await ai.models.generateImages({
    model: candidateModel,
    prompt: imageRequest.prompt,
    config: {
      aspectRatio: imageRequest.aspectRatio || '16:9',
      numberOfImages: 1,
    },
  });

  const generated = response.generatedImages?.[0];
  const inline = generated?.image?.imageBytes;
  if (inline) {
    return {
      base64: inline,
      mime: generated?.image?.mimeType || 'image/png',
      modelUsed: candidateModel,
    };
  }

  if (generated?.raiFilteredReason) {
    throw createStatusError('Image generation was blocked. Try a different prompt.', 422);
  }

  throw createStatusError('Image generation did not return usable image data.', 502);
}

export async function generateImageForProvider(
  provider: ImageProvider,
  modelCandidates: string[],
  imageRequest: ImageRequestDetails,
): Promise<GeneratedImageBytes> {
  let lastError: unknown = null;

  for (const candidateModel of modelCandidates) {
    try {
      if (provider === 'xai') return await generateXaiImage(candidateModel, imageRequest);
      if (provider === 'replicate') return await generateReplicateImage(candidateModel, imageRequest);
      return await generateGeminiImage(candidateModel, imageRequest);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('All image generation candidates failed.');
}
