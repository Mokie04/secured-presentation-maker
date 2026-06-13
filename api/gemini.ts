import { GoogleGenAI } from "@google/genai";
import { requireSession } from "./_sessionAuth.js";
import { getCachedR2Image, setCachedR2Image } from "./_r2ImageCache.js";
import { getCachedR2TextGeneration, setCachedR2TextGeneration } from "./_r2TextGenerationCache.js";
import { getPexelsImageForPrompt } from "./_pexelsImageSearch.js";
import {
  generateReplicateImage,
  generateXaiImage,
  normalizeReplicateImageModels,
  normalizeXaiImageModels,
} from "../lib/serverImageGeneration.js";

type GeminiProxyRequest = {
  task?: 'text' | 'image' | 'cacheImage' | 'cachedImage';
  model?: string | string[];
  contents?: unknown;
  config?: Record<string, unknown>;
};

export const config = {
  maxDuration: 300,
};

type GeminiErrorInfo = {
  status: number;
  code?: number;
  message: string;
  retryable: boolean;
};

type ImageRequestDetails = {
  prompt: string;
  aspectRatio: string;
  cacheId?: string;
  semanticCacheId?: string;
  semanticMetadata?: ImageSemanticMetadata;
  allowPaidImageGeneration: boolean;
};

type ImageSemanticMetadata = Record<string, string>;

type TextGenerationResponse = {
  text: string;
  groundingChunks: unknown[];
  modelUsed?: string | null;
  provider?: string;
};

type TextProvider = 'gemini' | 'xai' | 'deepseek';
type ImageProvider = 'gemini' | 'xai' | 'pexels' | 'replicate';
type AIProvider = TextProvider | ImageProvider;
const MAX_UPLOADED_IMAGE_BYTES = 6 * 1024 * 1024;
const GENERIC_REQUEST_ERROR = 'The request could not be completed. Please try again.';
const INVALID_REQUEST_ERROR = 'The request is missing required data.';
const SERVER_CONFIG_ERROR = 'A required server configuration is missing or invalid. Please contact the administrator.';
const SERVICE_BUSY_ERROR = 'The service is temporarily busy. Please try again in about 1 minute.';
const SERVICE_LIMIT_ERROR = 'A service limit or billing issue prevented this request. Please contact the administrator.';
const IMAGE_BLOCKED_ERROR = 'Image generation was blocked. Try a different prompt.';
const IMAGE_DATA_ERROR = 'Image generation did not return usable image data.';

function parseConfiguredOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value || '')
      .split(/[,\s]+/)
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return '';
        }
      })
      .filter(Boolean)
  );
}

function getRequestOrigin(req: any): string {
  const protocol = typeof req.headers?.['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim()
    : 'https';
  const host = typeof req.headers?.host === 'string' ? req.headers.host : '';
  return host ? `${protocol}://${host}` : '';
}

function applyCorsHeaders(req: any, res: any): boolean {
  const requestOrigin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins = parseConfiguredOrigins(process.env.API_ALLOWED_ORIGINS);
  const isSameOrigin = requestOrigin === getRequestOrigin(req);
  const isAllowedOrigin = isSameOrigin || allowedOrigins.has(requestOrigin);
  if (!isAllowedOrigin) {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Appstore-Access');
  res.setHeader('Vary', 'Origin');
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number): number {
  const baseDelay = Math.min(4000, 900 * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * 450);
  return baseDelay + jitter;
}

function parseBooleanEnv(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());
}

function paidImageGenerationDisabled(): boolean {
  return parseBooleanEnv(process.env.PAID_IMAGE_GENERATION_DISABLED)
    || parseBooleanEnv(process.env.AI_PAID_IMAGE_GENERATION_DISABLED);
}

function shouldSkipPaidImageGeneration(provider: ImageProvider, imageRequest: ImageRequestDetails): boolean {
  return provider === 'pexels' || !imageRequest.allowPaidImageGeneration || paidImageGenerationDisabled();
}

function sendPaidImageGenerationSkipped(res: any, modelUsed: string, provider: ImageProvider) {
  return res.status(200).json({
    dataUrl: '',
    modelUsed,
    provider,
    paidImageGenerationSkipped: true,
    cache: {
      hit: false,
      provider: 'none',
    },
  });
}

async function getCachedImageWithPromptFallback(input: {
  prompt: string;
  model: string;
  aspectRatio: string;
  cacheId?: string;
  semanticCacheId?: string;
  semanticMetadata?: ImageSemanticMetadata;
}) {
  const stableCachedImage = await getCachedR2Image(input);
  if (stableCachedImage || (!input.cacheId && !input.semanticCacheId)) {
    return stableCachedImage;
  }

  return getCachedR2Image({
    prompt: input.prompt,
    model: input.model,
    aspectRatio: input.aspectRatio,
  });
}

async function getPexelsImageWithCache(input: {
  prompt: string;
  model: string;
  aspectRatio: string;
  cacheId?: string;
  semanticCacheId?: string;
  semanticMetadata?: ImageSemanticMetadata;
}) {
  const pexelsImage = await getPexelsImageForPrompt({
    prompt: input.prompt,
    semanticMetadata: input.semanticMetadata,
  });
  if (!pexelsImage) return null;

  const storedImage = await setCachedR2Image({
    prompt: input.prompt,
    model: input.model,
    aspectRatio: input.aspectRatio,
    cacheId: input.cacheId,
    semanticCacheId: input.semanticCacheId,
    semanticMetadata: input.semanticMetadata,
    imageAttribution: pexelsImage.attribution,
  }, pexelsImage.base64, pexelsImage.mime);

  console.info('Pexels image fallback hit', {
    query: pexelsImage.query,
    photoId: pexelsImage.attribution.sourceId,
    cacheProvider: storedImage ? 'r2' : 'none',
  });

  return {
    dataUrl: storedImage?.dataUrl || pexelsImage.dataUrl,
    attribution: storedImage?.attribution || pexelsImage.attribution,
    cacheProvider: storedImage ? 'r2' : 'pexels',
  };
}

function buildTextCacheInput(
  provider: AIProvider,
  modelCandidates: string[],
  contents: unknown,
  requestConfig: Record<string, unknown> | undefined,
) {
  return {
    provider,
    models: modelCandidates,
    contents,
    config: requestConfig,
  };
}

function extractGeminiErrorInfo(error: unknown): GeminiErrorInfo {
  const fallback: GeminiErrorInfo = {
    status: 500,
    message: 'Unknown generation proxy error.',
    retryable: false,
  };

  if (!error) {
    return fallback;
  }

  const statusFromObject = typeof (error as any)?.status === 'number' ? (error as any).status : undefined;
  const messageFromObject = error instanceof Error ? error.message : String(error);
  let status = statusFromObject ?? 500;
  let code: number | undefined;
  let message = messageFromObject || fallback.message;

  try {
    const parsed = JSON.parse(message);
    if (parsed?.error) {
      const parsedStatus = parsed.error.status;
      const parsedCode = parsed.error.code;
      const parsedMessage = parsed.error.message;

      if (typeof parsedCode === 'number') {
        code = parsedCode;
      }
      if (typeof parsedCode === 'number' && !statusFromObject) {
        status = parsedCode;
      }
      if (typeof parsedMessage === 'string' && parsedMessage.trim().length > 0) {
        message = parsedMessage;
      }
      if (!statusFromObject && parsedStatus === 'UNAVAILABLE') {
        status = 503;
      }
    }
  } catch {
    // Ignore parsing errors; keep original message.
  }

  const upperMessage = message.toUpperCase();
  const isSpendingCapError = upperMessage.includes('SPENDING CAP');
  const retryable = !isSpendingCapError && ([429, 500, 502, 503, 504].includes(status)
    || upperMessage.includes('UNAVAILABLE')
    || upperMessage.includes('HIGH DEMAND')
    || upperMessage.includes('TRY AGAIN LATER'));

  return { status, code, message, retryable };
}

function getSafeProxyErrorMessage(info: GeminiErrorInfo): string {
  const message = info.message.toLowerCase();

  if (message.includes('api key')
    || message.includes('api_key')
    || message.includes('credential')
    || message.includes('server configuration')
    || (message.includes('missing') && message.includes('key'))) {
    return SERVER_CONFIG_ERROR;
  }

  if (info.status === 401
    || info.status === 403
    || info.status === 402
    || info.status === 429
    || message.includes('rate_limit')
    || message.includes('quota')
    || message.includes('billing')
    || message.includes('payment')
    || message.includes('credit')
    || message.includes('balance')
    || message.includes('spending cap')
    || message.includes('permission')) {
    return SERVICE_LIMIT_ERROR;
  }

  if (info.retryable
    || [500, 502, 503, 504].includes(info.status)
    || message.includes('unavailable')
    || message.includes('high demand')
    || message.includes('try again later')
    || message.includes('timed out')
    || message.includes('timeout')) {
    return SERVICE_BUSY_ERROR;
  }

  if (info.status === 400) {
    return INVALID_REQUEST_ERROR;
  }

  if (info.status === 422) {
    return 'The request could not be completed. Please revise the input and try again.';
  }

  return GENERIC_REQUEST_ERROR;
}

function getSafeProxyStatus(info: GeminiErrorInfo): number {
  if (info.status === 400 || info.status === 422 || info.status === 429) {
    return info.status;
  }

  if (info.status === 503 || info.status === 504) {
    return info.status;
  }

  if (info.status === 401 || info.status === 402 || info.status === 403) {
    return 502;
  }

  if (info.status >= 500 && info.status <= 599) {
    return info.status;
  }

  return 500;
}

function normalizeBody(body: unknown): GeminiProxyRequest {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as GeminiProxyRequest;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as GeminiProxyRequest;
  }

  return {};
}

function getImageRequestDetails(contents: unknown, requestConfig: Record<string, unknown> | undefined): ImageRequestDetails {
  const imagePrompt =
    typeof contents === 'string'
      ? contents
      : (contents as any)?.parts?.[0]?.text
        || (contents as any)?.prompt
        || JSON.stringify(contents);

  const imageConfig = (requestConfig as any)?.imageConfig ?? {};
  const cacheId = typeof (contents as any)?.cacheId === 'string'
    ? (contents as any).cacheId.trim()
    : typeof imageConfig.cacheId === 'string'
      ? imageConfig.cacheId.trim()
      : '';
  const semanticCacheId = typeof (contents as any)?.semanticCacheId === 'string'
    ? (contents as any).semanticCacheId.trim()
    : typeof imageConfig.semanticCacheId === 'string'
      ? imageConfig.semanticCacheId.trim()
      : '';
  const rawSemanticMetadata = (contents as any)?.semanticMetadata || imageConfig.semanticMetadata;
  const semanticMetadata = normalizeImageSemanticMetadata(rawSemanticMetadata);
  const rawAllowPaidImageGeneration = (contents as any)?.allowPaidImageGeneration ?? imageConfig.allowPaidImageGeneration;
  const allowPaidImageGeneration = rawAllowPaidImageGeneration !== false
    && rawAllowPaidImageGeneration !== 'false';

  return {
    prompt: imagePrompt,
    aspectRatio: imageConfig.aspectRatio || '16:9',
    allowPaidImageGeneration,
    ...(cacheId ? { cacheId } : {}),
    ...(semanticCacheId ? { semanticCacheId } : {}),
    ...(semanticMetadata ? { semanticMetadata } : {}),
  };
}

function normalizeImageSemanticMetadata(value: unknown): ImageSemanticMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const normalized = Object.entries(value as Record<string, unknown>)
    .reduce<ImageSemanticMetadata>((acc, [key, rawValue]) => {
      if (typeof rawValue !== 'string') return acc;
      const normalizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
      const normalizedValue = rawValue.replace(/\s+/g, ' ').trim().slice(0, 500);
      if (normalizedKey && normalizedValue) {
        acc[normalizedKey] = normalizedValue;
      }
      return acc;
    }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function parseUploadedImageDataUrl(contents: unknown): { base64: string; mime: string } | null {
  const rawDataUrl = (contents as any)?.dataUrl;
  if (typeof rawDataUrl !== 'string') {
    return null;
  }

  const match = rawDataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    return null;
  }

  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, '');
  const byteLength = Buffer.byteLength(base64, 'base64');
  if (byteLength === 0 || byteLength > MAX_UPLOADED_IMAGE_BYTES) {
    return null;
  }

  return { base64, mime };
}

function normalizeTextProvider(value: string | undefined): TextProvider | null {
  const configuredProvider = value?.trim().toLowerCase();
  if (configuredProvider === 'xai' || configuredProvider === 'grok') return 'xai';
  if (configuredProvider === 'deepseek' || configuredProvider === 'deepseek-ai') return 'deepseek';
  if (configuredProvider === 'gemini') return 'gemini';
  return null;
}

function normalizeImageProvider(value: string | undefined): ImageProvider | null {
  const configuredProvider = value?.trim().toLowerCase();
  if (configuredProvider === 'xai' || configuredProvider === 'grok') return 'xai';
  if (configuredProvider === 'replicate' || configuredProvider === 'flux' || configuredProvider === 'flux-schnell') return 'replicate';
  if (configuredProvider === 'pexels' || configuredProvider === 'stock' || configuredProvider === 'free') return 'pexels';
  if (configuredProvider === 'gemini') return 'gemini';
  return null;
}

function getTextProvider(): TextProvider {
  const configuredProvider = normalizeTextProvider(process.env.AI_TEXT_PROVIDER);
  if (configuredProvider) return configuredProvider;
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  return process.env.XAI_API_KEY ? 'xai' : 'gemini';
}

function getImageProvider(): ImageProvider {
  const configuredProvider = normalizeImageProvider(process.env.AI_IMAGE_PROVIDER);
  if (configuredProvider) return configuredProvider;
  if (process.env.XAI_IMAGE_MODEL?.trim()) return 'xai';
  if (!process.env.GEMINI_API_KEY && process.env.XAI_API_KEY) return 'xai';
  if (!process.env.GEMINI_API_KEY && !process.env.XAI_API_KEY && process.env.REPLICATE_API_TOKEN) return 'replicate';
  return 'gemini';
}

function normalizeXaiModels(model: string | string[] | undefined): string[] {
  const configuredModel = process.env.XAI_TEXT_MODEL?.trim();
  const requestedModels = Array.isArray(model) ? model : [model];

  const models = [
    configuredModel,
    ...requestedModels,
    'grok-4.3',
  ]
    .map((m) => (typeof m === 'string' ? m.trim().replace(/^models\//, '') : ''))
    .filter((m): m is string => Boolean(m) && m.toLowerCase().startsWith('grok-'));

  return Array.from(new Set(models));
}

function normalizeDeepSeekModels(model: string | string[] | undefined): string[] {
  const configuredModel = process.env.DEEPSEEK_TEXT_MODEL?.trim();
  const requestedModels = Array.isArray(model) ? model : [model];

  const models = [
    configuredModel,
    ...requestedModels,
    'deepseek-v4-flash',
  ]
    .map((m) => (typeof m === 'string' ? m.trim().replace(/^models\//, '') : ''))
    .filter((m): m is string => Boolean(m) && m.toLowerCase().startsWith('deepseek-'));

  return Array.from(new Set(models));
}

function buildChatMessages(contents: unknown): Array<{ role: 'user'; content: string }> {
  const content =
    typeof contents === 'string'
      ? contents
      : (contents as any)?.parts?.[0]?.text
        || (contents as any)?.prompt
        || JSON.stringify(contents);

  return [{ role: 'user', content }];
}

function buildXaiResponseFormat(requestConfig: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const schema = (requestConfig as any)?.responseSchema;
  const responseMimeType = (requestConfig as any)?.responseMimeType;

  if (!schema || responseMimeType !== 'application/json') {
    return undefined;
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: 'presentation_generation_response',
      schema,
      strict: true,
    },
  };
}

function buildDeepSeekResponseFormat(requestConfig: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const responseMimeType = (requestConfig as any)?.responseMimeType;
  if (responseMimeType !== 'application/json') {
    return undefined;
  }

  return {
    type: 'json_object',
  };
}

async function generateXaiText(
  modelCandidates: string[],
  contents: unknown,
  requestConfig: Record<string, unknown> | undefined,
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    const error = new Error('Server is missing XAI_API_KEY.') as Error & { status?: number };
    error.status = 500;
    throw error;
  }

  let lastError: unknown = null;
  let lastErrorInfo: GeminiErrorInfo | null = null;
  const messages = buildChatMessages(contents);
  const responseFormat = buildXaiResponseFormat(requestConfig);
  const temperature = typeof (requestConfig as any)?.temperature === 'number'
    ? (requestConfig as any).temperature
    : undefined;

  for (const candidateModel of modelCandidates) {
    const maxAttemptsForModel = 3;
    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt += 1) {
      try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: candidateModel,
            messages,
            ...(temperature !== undefined ? { temperature } : {}),
            ...(responseFormat ? { response_format: responseFormat } : {}),
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = typeof payload?.error?.message === 'string'
            ? payload.error.message
            : typeof payload?.error === 'string'
              ? payload.error
              : `Text request failed with status ${response.status}.`;
          const error = new Error(message) as Error & { status?: number };
          error.status = response.status;
          throw error;
        }

        const text = payload?.choices?.[0]?.message?.content;
        if (typeof text !== 'string') {
          throw new Error('Text generation returned an empty response.');
        }

        return {
          text,
          modelUsed: payload?.model || candidateModel,
        };
      } catch (error) {
        lastError = error;
        lastErrorInfo = extractGeminiErrorInfo(error);
        const shouldRetry = lastErrorInfo.retryable && attempt < maxAttemptsForModel;
        if (shouldRetry) {
          await sleep(getRetryDelayMs(attempt));
          continue;
        }
      }
    }
  }

  if (lastErrorInfo?.retryable && lastErrorInfo.status === 503) {
    const error = new Error('The service is temporarily busy. Please try again in about 1 minute.') as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  throw lastError || new Error('All text generation candidates failed.');
}

async function generateDeepSeekText(
  modelCandidates: string[],
  contents: unknown,
  requestConfig: Record<string, unknown> | undefined,
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const error = new Error('Server is missing DEEPSEEK_API_KEY.') as Error & { status?: number };
    error.status = 500;
    throw error;
  }

  let lastError: unknown = null;
  let lastErrorInfo: GeminiErrorInfo | null = null;
  const messages = buildChatMessages(contents);
  const responseFormat = buildDeepSeekResponseFormat(requestConfig);
  const temperature = typeof (requestConfig as any)?.temperature === 'number'
    ? (requestConfig as any).temperature
    : undefined;

  for (const candidateModel of modelCandidates) {
    const maxAttemptsForModel = 3;
    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt += 1) {
      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: candidateModel,
            messages,
            stream: false,
            thinking: { type: 'disabled' },
            ...(temperature !== undefined ? { temperature } : {}),
            ...(responseFormat ? { response_format: responseFormat } : {}),
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = typeof payload?.error?.message === 'string'
            ? payload.error.message
            : typeof payload?.error === 'string'
              ? payload.error
              : `Text request failed with status ${response.status}.`;
          const error = new Error(message) as Error & { status?: number };
          error.status = response.status;
          throw error;
        }

        const text = payload?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || text.trim().length === 0) {
          throw new Error('Text generation returned an empty response.');
        }

        return {
          text,
          modelUsed: payload?.model || candidateModel,
        };
      } catch (error) {
        lastError = error;
        lastErrorInfo = extractGeminiErrorInfo(error);
        const shouldRetry = lastErrorInfo.retryable && attempt < maxAttemptsForModel;
        if (shouldRetry) {
          await sleep(getRetryDelayMs(attempt));
          continue;
        }
      }
    }
  }

  if (lastErrorInfo?.retryable && lastErrorInfo.status === 503) {
    const error = new Error('The service is temporarily busy. Please try again in about 1 minute.') as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  throw lastError || new Error('All text generation candidates failed.');
}

export default async function handler(req: any, res: any) {
  const corsAllowed = applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return corsAllowed
      ? res.status(204).end()
      : res.status(403).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireSession(req, res)) {
    return;
  }

  const { task = 'text', model, contents, config: requestConfig } = normalizeBody(req.body);

  const provider = task === 'text' ? getTextProvider() : getImageProvider();
  const isImageTask = task === 'image' || task === 'cacheImage' || task === 'cachedImage';
  const modelList = provider === 'xai'
    ? (isImageTask ? normalizeXaiImageModels(model) : normalizeXaiModels(model))
    : provider === 'deepseek'
      ? normalizeDeepSeekModels(model)
      : provider === 'replicate'
        ? normalizeReplicateImageModels(model)
        : (Array.isArray(model) ? model : [model]);
  const normalizedModels = modelList
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .map((m) => m.trim())
    .map((m) => {
      if (provider === 'xai' || provider === 'deepseek' || provider === 'replicate') return m;
      // Map older/fallback names to supported ones for the v1beta generateContent endpoint
      if (m.startsWith('gemini-1.5-flash')) return 'models/gemini-1.5-flash-001';
      if (m.startsWith('gemini-2.5-flash-image')) return 'models/gemini-2.5-flash-image';
      if (m.startsWith('imagen-4.0-fast')) return 'models/imagen-4.0-fast-generate-001';
      return m;
    })
    .map((m) => {
      if (provider === 'xai' || provider === 'deepseek' || provider === 'replicate') return m.replace(/^models\//, '');
      return m.startsWith('models/') ? m : `models/${m}`;
    });
  if (!model || !contents) {
    return res.status(400).json({ error: INVALID_REQUEST_ERROR });
  }

  const modelCandidates = normalizedModels;

  if (task === 'text' && provider === 'gemini' && modelCandidates.some((m) => m.includes('grok-'))) {
    return res.status(500).json({
      error: SERVER_CONFIG_ERROR,
    });
  }

  if (modelCandidates.length === 0) {
    return res.status(400).json({ error: INVALID_REQUEST_ERROR });
  }

  try {
    const textCacheInput = task === 'text'
      ? buildTextCacheInput(provider, modelCandidates, contents, requestConfig)
      : null;

    if (textCacheInput) {
      const cachedTextResponse = await getCachedR2TextGeneration<TextGenerationResponse>(textCacheInput);
      if (cachedTextResponse) {
        return res.status(200).json(cachedTextResponse);
      }
    }

    if (task === 'cachedImage' || task === 'cacheImage') {
      const imageRequest = getImageRequestDetails(contents, requestConfig);
      const cacheModel = modelCandidates[0];

      if (task === 'cachedImage') {
        for (const candidateModel of modelCandidates) {
          const cachedImage = await getCachedImageWithPromptFallback({
            prompt: imageRequest.prompt,
            model: candidateModel,
            aspectRatio: imageRequest.aspectRatio,
            cacheId: imageRequest.cacheId,
            semanticCacheId: imageRequest.semanticCacheId,
            semanticMetadata: imageRequest.semanticMetadata,
          });

          if (cachedImage) {
            return res.status(200).json({
              dataUrl: cachedImage.dataUrl,
              attribution: cachedImage.attribution,
              ok: true,
              modelUsed: candidateModel,
              provider,
              cache: {
                hit: true,
                provider: 'r2',
              },
            });
          }
        }

        return res.status(200).json({
          dataUrl: '',
          ok: true,
          modelUsed: cacheModel,
          provider,
          cache: {
            hit: false,
            provider: 'none',
          },
        });
      }

      const uploadedImage = parseUploadedImageDataUrl(contents);
      if (!uploadedImage) {
        return res.status(400).json({
          error: `Uploaded image must be a PNG, JPEG, or WebP data URL under ${MAX_UPLOADED_IMAGE_BYTES / (1024 * 1024)}MB.`,
        });
      }

      const storedImage = await setCachedR2Image({
        prompt: imageRequest.prompt,
        model: cacheModel,
        aspectRatio: imageRequest.aspectRatio,
        cacheId: imageRequest.cacheId,
        semanticCacheId: imageRequest.semanticCacheId,
        semanticMetadata: imageRequest.semanticMetadata,
        imageSource: 'manual-upload',
        imageAttribution: {
          provider: 'upload',
          label: 'Teacher uploaded image',
        },
      }, uploadedImage.base64, uploadedImage.mime);

      console.info('Manual image cache write', {
        imageProvider: provider,
        cacheProvider: storedImage ? 'r2' : 'none',
        model: cacheModel,
      });

      return res.status(200).json({
        ok: Boolean(storedImage),
        modelUsed: cacheModel,
        provider,
        cache: {
          hit: false,
          provider: storedImage ? 'r2' : 'none',
        },
      });
    }

    if (task === 'text' && provider === 'xai') {
      const textResponse = await generateXaiText(modelCandidates, contents, requestConfig);
      const responsePayload: TextGenerationResponse = {
        text: textResponse.text,
        groundingChunks: [],
        modelUsed: textResponse.modelUsed,
        provider: 'xai',
      };
      if (textCacheInput) {
        await setCachedR2TextGeneration(textCacheInput, responsePayload);
      }
      return res.status(200).json(responsePayload);
    }

    if (task === 'text' && provider === 'deepseek') {
      const textResponse = await generateDeepSeekText(modelCandidates, contents, requestConfig);
      const responsePayload: TextGenerationResponse = {
        text: textResponse.text,
        groundingChunks: [],
        modelUsed: textResponse.modelUsed,
        provider: 'deepseek',
      };
      if (textCacheInput) {
        await setCachedR2TextGeneration(textCacheInput, responsePayload);
      }
      return res.status(200).json(responsePayload);
    }

    if (task === 'image' && provider === 'xai') {
      const imageRequest = getImageRequestDetails(contents, requestConfig);
      let lastError: unknown = null;
      let lastErrorInfo: GeminiErrorInfo | null = null;

      for (const candidateModel of modelCandidates) {
        const maxAttemptsForModel = 1;
        for (let attempt = 1; attempt <= maxAttemptsForModel; attempt += 1) {
          try {
            const cachedImage = attempt === 1
              ? await getCachedImageWithPromptFallback({
                prompt: imageRequest.prompt,
                model: candidateModel,
                aspectRatio: imageRequest.aspectRatio,
                cacheId: imageRequest.cacheId,
                semanticCacheId: imageRequest.semanticCacheId,
                semanticMetadata: imageRequest.semanticMetadata,
              })
              : null;

            if (cachedImage) {
              console.info('Generated image cache hit', {
                imageProvider: 'xai',
                cacheProvider: 'r2',
                model: candidateModel,
              });

              return res.status(200).json({
                dataUrl: cachedImage.dataUrl,
                attribution: cachedImage.attribution,
                modelUsed: candidateModel,
                provider: 'xai',
                cache: {
                  hit: true,
                  provider: 'r2',
                },
              });
            }

            const pexelsImage = await getPexelsImageWithCache({
              prompt: imageRequest.prompt,
              model: candidateModel,
              aspectRatio: imageRequest.aspectRatio,
              cacheId: imageRequest.cacheId,
              semanticCacheId: imageRequest.semanticCacheId,
              semanticMetadata: imageRequest.semanticMetadata,
            });
            if (pexelsImage) {
              return res.status(200).json({
                dataUrl: pexelsImage.dataUrl,
                attribution: pexelsImage.attribution,
                modelUsed: candidateModel,
                provider: 'pexels',
                cache: {
                  hit: false,
                  provider: pexelsImage.cacheProvider,
                },
              });
            }

            if (shouldSkipPaidImageGeneration(provider, imageRequest)) {
              return sendPaidImageGenerationSkipped(res, candidateModel, provider);
            }

            const generatedImage = await generateXaiImage(candidateModel, imageRequest);
            const storedImage = await setCachedR2Image({
              prompt: imageRequest.prompt,
              model: candidateModel,
              aspectRatio: imageRequest.aspectRatio,
              cacheId: imageRequest.cacheId,
              semanticCacheId: imageRequest.semanticCacheId,
              semanticMetadata: imageRequest.semanticMetadata,
            }, generatedImage.base64, generatedImage.mime);
            console.info('Generated image cache write', {
              imageProvider: 'xai',
              cacheProvider: storedImage ? 'r2' : 'none',
              model: candidateModel,
            });

            return res.status(200).json({
              dataUrl: `data:${generatedImage.mime};base64,${generatedImage.base64}`,
              modelUsed: generatedImage.modelUsed,
              provider: 'xai',
              cache: {
                hit: false,
                provider: storedImage ? 'r2' : 'none',
              },
            });
          } catch (error) {
            lastError = error;
            lastErrorInfo = extractGeminiErrorInfo(error);
            const shouldRetry = lastErrorInfo.retryable && attempt < maxAttemptsForModel;
            if (shouldRetry) {
              await sleep(getRetryDelayMs(attempt));
              continue;
            }
          }
        }
      }

      if (lastErrorInfo?.retryable && lastErrorInfo.status === 503) {
        return res.status(503).json({
          error: SERVICE_BUSY_ERROR,
        });
      }
      throw lastError || new Error('All image generation candidates failed.');
    }

    if (task === 'image' && provider === 'replicate') {
      const imageRequest = getImageRequestDetails(contents, requestConfig);
      let lastError: unknown = null;
      let lastErrorInfo: GeminiErrorInfo | null = null;

      for (const candidateModel of modelCandidates) {
        const maxAttemptsForModel = 1;
        for (let attempt = 1; attempt <= maxAttemptsForModel; attempt += 1) {
          try {
            const cachedImage = attempt === 1
              ? await getCachedImageWithPromptFallback({
                prompt: imageRequest.prompt,
                model: candidateModel,
                aspectRatio: imageRequest.aspectRatio,
                cacheId: imageRequest.cacheId,
                semanticCacheId: imageRequest.semanticCacheId,
                semanticMetadata: imageRequest.semanticMetadata,
              })
              : null;

            if (cachedImage) {
              console.info('Generated image cache hit', {
                imageProvider: 'replicate',
                cacheProvider: 'r2',
                model: candidateModel,
              });

              return res.status(200).json({
                dataUrl: cachedImage.dataUrl,
                attribution: cachedImage.attribution,
                modelUsed: candidateModel,
                provider: 'replicate',
                cache: {
                  hit: true,
                  provider: 'r2',
                },
              });
            }

            const pexelsImage = await getPexelsImageWithCache({
              prompt: imageRequest.prompt,
              model: candidateModel,
              aspectRatio: imageRequest.aspectRatio,
              cacheId: imageRequest.cacheId,
              semanticCacheId: imageRequest.semanticCacheId,
              semanticMetadata: imageRequest.semanticMetadata,
            });
            if (pexelsImage) {
              return res.status(200).json({
                dataUrl: pexelsImage.dataUrl,
                attribution: pexelsImage.attribution,
                modelUsed: candidateModel,
                provider: 'pexels',
                cache: {
                  hit: false,
                  provider: pexelsImage.cacheProvider,
                },
              });
            }

            if (shouldSkipPaidImageGeneration(provider, imageRequest)) {
              return sendPaidImageGenerationSkipped(res, candidateModel, provider);
            }

            const generatedImage = await generateReplicateImage(candidateModel, imageRequest);
            const storedImage = await setCachedR2Image({
              prompt: imageRequest.prompt,
              model: candidateModel,
              aspectRatio: imageRequest.aspectRatio,
              cacheId: imageRequest.cacheId,
              semanticCacheId: imageRequest.semanticCacheId,
              semanticMetadata: imageRequest.semanticMetadata,
            }, generatedImage.base64, generatedImage.mime);
            console.info('Generated image cache write', {
              imageProvider: 'replicate',
              cacheProvider: storedImage ? 'r2' : 'none',
              model: candidateModel,
            });

            return res.status(200).json({
              dataUrl: `data:${generatedImage.mime};base64,${generatedImage.base64}`,
              modelUsed: generatedImage.modelUsed,
              provider: 'replicate',
              cache: {
                hit: false,
                provider: storedImage ? 'r2' : 'none',
              },
            });
          } catch (error) {
            lastError = error;
            lastErrorInfo = extractGeminiErrorInfo(error);
            const shouldRetry = lastErrorInfo.retryable && attempt < maxAttemptsForModel;
            if (shouldRetry) {
              await sleep(getRetryDelayMs(attempt));
              continue;
            }
          }
        }
      }

      if (lastErrorInfo?.retryable && lastErrorInfo.status === 503) {
        return res.status(503).json({
          error: SERVICE_BUSY_ERROR,
        });
      }
      throw lastError || new Error('All Replicate image generation candidates failed.');
    }

    if (task === 'image') {
      const imageRequest = getImageRequestDetails(contents, requestConfig);
      for (const candidateModel of modelCandidates) {
        const cachedImage = await getCachedImageWithPromptFallback({
          prompt: imageRequest.prompt,
          model: candidateModel,
          aspectRatio: imageRequest.aspectRatio,
          cacheId: imageRequest.cacheId,
          semanticCacheId: imageRequest.semanticCacheId,
          semanticMetadata: imageRequest.semanticMetadata,
        });

        if (cachedImage) {
          console.info('Generated image cache hit', {
            imageProvider: 'gemini',
            cacheProvider: 'r2',
            model: candidateModel,
          });

          return res.status(200).json({
            dataUrl: cachedImage.dataUrl,
            attribution: cachedImage.attribution,
            modelUsed: candidateModel,
            provider: 'gemini',
            cache: {
              hit: true,
              provider: 'r2',
            },
          });
        }
      }

      const pexelsImage = await getPexelsImageWithCache({
        prompt: imageRequest.prompt,
        model: modelCandidates[0],
        aspectRatio: imageRequest.aspectRatio,
        cacheId: imageRequest.cacheId,
        semanticCacheId: imageRequest.semanticCacheId,
        semanticMetadata: imageRequest.semanticMetadata,
      });
      if (pexelsImage) {
        return res.status(200).json({
          dataUrl: pexelsImage.dataUrl,
          attribution: pexelsImage.attribution,
          modelUsed: modelCandidates[0],
          provider: 'pexels',
          cache: {
            hit: false,
            provider: pexelsImage.cacheProvider,
          },
        });
      }

      const imageProvider: ImageProvider = provider === 'pexels' ? 'pexels' : 'gemini';
      if (shouldSkipPaidImageGeneration(imageProvider, imageRequest)) {
        return sendPaidImageGenerationSkipped(res, modelCandidates[0], imageProvider);
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: SERVER_CONFIG_ERROR });
    }

    const ai = new GoogleGenAI({ apiKey });
    let response: any = null;
    let lastError: unknown = null;
    let lastErrorInfo: GeminiErrorInfo | null = null;
    let modelUsed: string | null = null;

    for (const candidateModel of modelCandidates) {
      const maxAttemptsForModel = 3;
      for (let attempt = 1; attempt <= maxAttemptsForModel; attempt += 1) {
        try {
          if (task === 'image') {
            const imageRequest = getImageRequestDetails(contents, requestConfig);
            const imgConfig = {
              aspectRatio: imageRequest.aspectRatio,
              numberOfImages: 1,
            };

            response = await ai.models.generateImages({
              model: candidateModel,
              prompt: imageRequest.prompt,
              config: imgConfig,
            });
          } else {
            response = await ai.models.generateContent({
              model: candidateModel,
              contents,
              config: requestConfig,
            });
          }

          modelUsed = candidateModel;
          break;
        } catch (error) {
          lastError = error;
          lastErrorInfo = extractGeminiErrorInfo(error);
          const shouldRetry = lastErrorInfo.retryable && attempt < maxAttemptsForModel;
          if (shouldRetry) {
            await sleep(getRetryDelayMs(attempt));
            continue;
          }
        }
      }

      if (response) {
        break;
      }
    }

    if (!response) {
      if (lastErrorInfo?.retryable && lastErrorInfo.status === 503) {
        return res.status(503).json({
          error: SERVICE_BUSY_ERROR,
        });
      }
      throw lastError || new Error('All generation candidates failed.');
    }

    if (task === 'image') {
      const generated = response.generatedImages?.[0];
      const inline = generated?.image?.imageBytes;
      if (inline) {
        const mime = generated?.image?.mimeType || 'image/png';
        const imageRequest = getImageRequestDetails(contents, requestConfig);
        const cachedImage = await setCachedR2Image({
          prompt: imageRequest.prompt,
          model: modelUsed || modelCandidates[0],
          aspectRatio: imageRequest.aspectRatio,
          cacheId: imageRequest.cacheId,
          semanticCacheId: imageRequest.semanticCacheId,
          semanticMetadata: imageRequest.semanticMetadata,
        }, inline, mime);
        console.info('Generated image cache write', {
          imageProvider: 'gemini',
          cacheProvider: cachedImage ? 'r2' : 'none',
          model: modelUsed || modelCandidates[0],
        });

        return res.status(200).json({
          dataUrl: `data:${mime};base64,${inline}`,
          modelUsed,
          provider: 'gemini',
          cache: {
            hit: false,
            provider: cachedImage ? 'r2' : 'none',
          },
        });
      }

      const raiReason = generated?.raiFilteredReason;
      if (raiReason) {
        return res.status(422).json({
          error: IMAGE_BLOCKED_ERROR,
          blockReason: 'blocked',
        });
      }

      return res.status(502).json({ error: IMAGE_DATA_ERROR });
    }

    const responsePayload: TextGenerationResponse = {
      text: response.text ?? '',
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [],
      modelUsed,
    };
    if (textCacheInput) {
      await setCachedR2TextGeneration(textCacheInput, responsePayload);
    }
    return res.status(200).json(responsePayload);
  } catch (error) {
    const info = extractGeminiErrorInfo(error);
    const safeMessage = getSafeProxyErrorMessage(info);
    const safeStatus = getSafeProxyStatus(info);
    console.error('Generation proxy request failed.', {
      status: info.status,
      code: info.code,
      retryable: info.retryable,
      message: safeMessage,
    });
    return res.status(safeStatus).json({ error: safeMessage });
  }
}
