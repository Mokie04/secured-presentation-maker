import { GoogleGenAI } from "@google/genai";
import { requireSession } from "./_sessionAuth.js";
import { getCachedR2Image, setCachedR2Image } from "./_r2ImageCache.js";

type GeminiProxyRequest = {
  task?: 'text' | 'image' | 'cacheImage' | 'cachedImage';
  model?: string | string[];
  contents?: unknown;
  config?: Record<string, unknown>;
};

export const config = {
  maxDuration: 60,
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
};

type AIProvider = 'gemini' | 'xai';
const DEFAULT_XAI_IMAGE_TIMEOUT_MS = 25_000;
const MAX_UPLOADED_IMAGE_BYTES = 6 * 1024 * 1024;

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

function extractGeminiErrorInfo(error: unknown): GeminiErrorInfo {
  const fallback: GeminiErrorInfo = {
    status: 500,
    message: 'Unknown Gemini proxy error.',
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

  return {
    prompt: imagePrompt,
    aspectRatio: imageConfig.aspectRatio || '16:9',
  };
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

function normalizeProvider(value: string | undefined): AIProvider | null {
  const configuredProvider = value?.trim().toLowerCase();
  if (configuredProvider === 'xai' || configuredProvider === 'grok') return 'xai';
  if (configuredProvider === 'gemini') return 'gemini';
  return null;
}

function getTextProvider(): AIProvider {
  const configuredProvider = normalizeProvider(process.env.AI_TEXT_PROVIDER);
  if (configuredProvider) return configuredProvider;
  return process.env.XAI_API_KEY ? 'xai' : 'gemini';
}

function getImageProvider(): AIProvider {
  const configuredProvider = normalizeProvider(process.env.AI_IMAGE_PROVIDER);
  if (configuredProvider) return configuredProvider;
  if (process.env.XAI_IMAGE_MODEL?.trim()) return 'xai';
  if (!process.env.GEMINI_API_KEY && process.env.XAI_API_KEY) return 'xai';
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

function normalizeXaiImageModels(model: string | string[] | undefined): string[] {
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

function buildXaiMessages(contents: unknown): Array<{ role: 'user'; content: string }> {
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
  const messages = buildXaiMessages(contents);
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
              : `xAI request failed with status ${response.status}.`;
          const error = new Error(message) as Error & { status?: number };
          error.status = response.status;
          throw error;
        }

        const text = payload?.choices?.[0]?.message?.content;
        if (typeof text !== 'string') {
          throw new Error('xAI returned an empty text response.');
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
    const error = new Error('xAI is temporarily experiencing high demand. Please retry in 20-60 seconds.') as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  throw lastError || new Error('All xAI model candidates failed.');
}

function getXaiErrorMessage(payload: any, status: number): string {
  const message = typeof payload?.error?.message === 'string'
    ? payload.error.message
    : typeof payload?.error === 'string'
      ? payload.error
      : `xAI request failed with status ${status}.`;

  if (status === 429 && !message.toLowerCase().includes('rate')) {
    return `rate_limit_exceeded: ${message}`;
  }

  return message;
}

function detectImageMimeFromBase64(base64: string): string {
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

async function generateXaiImage(
  candidateModel: string,
  imageRequest: ImageRequestDetails,
): Promise<{ base64: string; mime: string; modelUsed: string }> {
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
      const timeoutError = new Error('xAI image generation timed out before the server limit. Placeholder added; try again later.') as Error & { status?: number };
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
    throw new Error('xAI returned no image data.');
  }

  return {
    base64,
    mime: detectImageMimeFromBase64(base64),
    modelUsed: payload?.model || candidateModel,
  };
}

export default async function handler(req: any, res: any) {
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
    : (Array.isArray(model) ? model : [model]);
  const normalizedModels = modelList
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .map((m) => m.trim())
    .map((m) => {
      if (provider === 'xai') return m;
      // Map older/fallback names to supported ones for the v1beta generateContent endpoint
      if (m.startsWith('gemini-1.5-flash')) return 'models/gemini-1.5-flash-001';
      if (m.startsWith('gemini-2.5-flash-image')) return 'models/gemini-2.5-flash-image';
      if (m.startsWith('imagen-4.0-fast')) return 'models/imagen-4.0-fast-generate-001';
      return m;
    })
    .map((m) => {
      if (provider === 'xai') return m.replace(/^models\//, '');
      return m.startsWith('models/') ? m : `models/${m}`;
    });
  if (!model || !contents) {
    return res.status(400).json({ error: 'Request must include model and contents.' });
  }

  const modelCandidates = normalizedModels;

  if (task === 'text' && provider === 'gemini' && modelCandidates.some((m) => m.includes('grok-'))) {
    return res.status(500).json({
      error: 'Grok text model was routed to Gemini. Set AI_TEXT_PROVIDER=xai and XAI_API_KEY in Vercel, or remove Grok from Gemini model env vars.',
    });
  }

  if (modelCandidates.length === 0) {
    return res.status(400).json({ error: 'Request model list is empty.' });
  }

  try {
    if (task === 'cachedImage' || task === 'cacheImage') {
      const imageRequest = getImageRequestDetails(contents, requestConfig);
      const cacheModel = modelCandidates[0];

      if (task === 'cachedImage') {
        const cachedImage = await getCachedR2Image({
          prompt: imageRequest.prompt,
          model: cacheModel,
          aspectRatio: imageRequest.aspectRatio,
        });

        return res.status(200).json({
          dataUrl: cachedImage?.dataUrl || '',
          ok: true,
          modelUsed: cacheModel,
          provider,
          cache: {
            hit: Boolean(cachedImage),
            provider: cachedImage ? 'r2' : 'none',
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
      return res.status(200).json({
        text: textResponse.text,
        groundingChunks: [],
        modelUsed: textResponse.modelUsed,
        provider: 'xai',
      });
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
              ? await getCachedR2Image({
                prompt: imageRequest.prompt,
                model: candidateModel,
                aspectRatio: imageRequest.aspectRatio,
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
                modelUsed: candidateModel,
                provider: 'xai',
                cache: {
                  hit: true,
                  provider: 'r2',
                },
              });
            }

            const generatedImage = await generateXaiImage(candidateModel, imageRequest);
            const storedImage = await setCachedR2Image({
              prompt: imageRequest.prompt,
              model: candidateModel,
              aspectRatio: imageRequest.aspectRatio,
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
          error: 'xAI image generation is temporarily experiencing high demand. Please retry in 20-60 seconds.',
        });
      }
      throw lastError || new Error('All xAI image model candidates failed.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
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
            const cachedImage = attempt === 1
              ? await getCachedR2Image({
                prompt: imageRequest.prompt,
                model: candidateModel,
                aspectRatio: imageRequest.aspectRatio,
              })
              : null;

            if (cachedImage) {
              console.info('Generated image cache hit', {
                imageProvider: 'gemini',
                cacheProvider: 'r2',
                model: candidateModel,
              });

              return res.status(200).json({
                dataUrl: cachedImage.dataUrl,
                modelUsed: candidateModel,
                cache: {
                  hit: true,
                  provider: 'r2',
                },
              });
            }

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
          error: 'Gemini is temporarily experiencing high demand. Please retry in 20-60 seconds.',
        });
      }
      throw lastError || new Error('All candidate models failed.');
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
        }, inline, mime);
        console.info('Generated image cache write', {
          imageProvider: 'gemini',
          cacheProvider: cachedImage ? 'r2' : 'none',
          model: modelUsed || modelCandidates[0],
        });

        return res.status(200).json({
          dataUrl: `data:${mime};base64,${inline}`,
          modelUsed,
          cache: {
            hit: false,
            provider: cachedImage ? 'r2' : 'none',
          },
        });
      }

      const raiReason = generated?.raiFilteredReason;
      if (raiReason) {
        return res.status(422).json({
          error: `Image generation was blocked. Reason: ${raiReason}`,
          blockReason: raiReason,
        });
      }

      return res.status(502).json({ error: 'No image data found in the model response.' });
    }

    return res.status(200).json({
      text: response.text ?? '',
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [],
      modelUsed,
    });
  } catch (error) {
    const info = extractGeminiErrorInfo(error);
    return res.status(info.status).json({ error: info.message });
  }
}
