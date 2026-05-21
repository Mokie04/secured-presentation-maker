import { GoogleGenAI } from "@google/genai";
import { requireSession } from "./_sessionAuth.js";
import { getCachedR2Image, setCachedR2Image } from "./_r2ImageCache.js";

type GeminiProxyRequest = {
  task?: 'text' | 'image';
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

type TextProvider = 'gemini' | 'xai';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number): number {
  const baseDelay = Math.min(4000, 900 * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * 450);
  return baseDelay + jitter;
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

function getTextProvider(): TextProvider {
  const configuredProvider = process.env.AI_TEXT_PROVIDER?.trim().toLowerCase();
  if (configuredProvider === 'xai' || configuredProvider === 'grok') return 'xai';
  if (configuredProvider === 'gemini') return 'gemini';
  return process.env.XAI_API_KEY ? 'xai' : 'gemini';
}

function normalizeXaiModels(model: string | string[] | undefined): string[] {
  const configuredModel = process.env.XAI_TEXT_MODEL?.trim();
  const requestedModels = Array.isArray(model) ? model : [model];

  const models = [
    configuredModel,
    ...requestedModels.filter((m): m is string => (
      typeof m === 'string'
      && m.trim().length > 0
      && m.trim().toLowerCase().startsWith('grok-')
    )),
    'grok-4.3',
  ]
    .map((m) => m?.trim())
    .filter((m): m is string => Boolean(m));

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireSession(req, res)) {
    return;
  }

  const { task = 'text', model, contents, config: requestConfig } = normalizeBody(req.body);

  // Force v1 text-to-image models that are supported by @google/genai 1.42.0 (Gemini API v1beta)
  const textProvider = task === 'text' ? getTextProvider() : 'gemini';
  const modelList = textProvider === 'xai' ? normalizeXaiModels(model) : (Array.isArray(model) ? model : [model]);
  const normalizedModels = modelList
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .map((m) => m.trim())
    .map((m) => {
      if (textProvider === 'xai') return m;
      // Map older/fallback names to supported ones for the v1beta generateContent endpoint
      if (m.startsWith('gemini-1.5-flash')) return 'models/gemini-1.5-flash-001';
      if (m.startsWith('gemini-2.5-flash-image')) return 'models/gemini-2.5-flash-image';
      if (m.startsWith('imagen-4.0-fast')) return 'models/imagen-4.0-fast-generate-001';
      return m;
    })
    .map((m) => (m.startsWith('models/') ? m : `models/${m}`));
  if (!model || !contents) {
    return res.status(400).json({ error: 'Request must include model and contents.' });
  }

  const modelCandidates = normalizedModels;

  if (modelCandidates.length === 0) {
    return res.status(400).json({ error: 'Request model list is empty.' });
  }

  try {
    if (task === 'text' && textProvider === 'xai') {
      const textResponse = await generateXaiText(modelCandidates, contents, requestConfig);
      return res.status(200).json({
        text: textResponse.text,
        groundingChunks: [],
        modelUsed: textResponse.modelUsed,
        provider: 'xai',
      });
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
