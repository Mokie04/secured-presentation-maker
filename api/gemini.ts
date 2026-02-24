import { GoogleGenAI } from "@google/genai";
import { requireSession } from "./_sessionAuth.js";

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
  const retryable = [429, 500, 502, 503, 504].includes(status)
    || upperMessage.includes('UNAVAILABLE')
    || upperMessage.includes('HIGH DEMAND')
    || upperMessage.includes('TRY AGAIN LATER');

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireSession(req, res)) {
    return;
  }

    const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  const { task = 'text', model, contents, config: requestConfig } = normalizeBody(req.body);

  // Force v1 text-to-image models that are supported by @google/genai 1.42.0 (Gemini API v1beta)
  const modelList = Array.isArray(model) ? model : [model];
  const normalizedModels = modelList
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .map((m) => m.trim())
    .map((m) => {
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
            const imagePrompt =
              typeof contents === 'string'
                ? contents
                : (contents as any)?.parts?.[0]?.text
                  || (contents as any)?.prompt
                  || JSON.stringify(contents);

            const imageConfig = (requestConfig as any)?.imageConfig ?? {};
            const imgConfig = {
              aspectRatio: imageConfig.aspectRatio || '16:9',
              numberOfImages: 1,
            };

            response = await ai.models.generateImages({
              model: candidateModel,
              prompt: imagePrompt,
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
        return res.status(200).json({
          dataUrl: `data:${mime};base64,${inline}`,
          modelUsed,
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
