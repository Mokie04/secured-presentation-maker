import { GoogleGenAI } from "@google/genai";

type GeminiProxyRequest = {
  task?: 'text' | 'image';
  model?: string | string[];
  contents?: unknown;
  config?: Record<string, unknown>;
};

export const config = {
  maxDuration: 60,
};

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  const { task = 'text', model, contents, config: requestConfig } = normalizeBody(req.body);
  if (!model || !contents) {
    return res.status(400).json({ error: 'Request must include model and contents.' });
  }

  const modelCandidates = Array.isArray(model)
    ? model
      .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
      .map((candidate) => candidate.trim())
    : [model]
      .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
      .map((candidate) => candidate.trim());

  if (modelCandidates.length === 0) {
    return res.status(400).json({ error: 'Request model list is empty.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    let response: any = null;
    let lastError: unknown = null;
    let modelUsed: string | null = null;

    for (const candidateModel of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model: candidateModel,
          contents,
          config: requestConfig,
        });
        modelUsed = candidateModel;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) {
      throw lastError || new Error('All candidate models failed.');
    }

    if (task === 'image') {
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          return res.status(200).json({
            dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            modelUsed,
          });
        }
      }

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        return res.status(422).json({
          error: `Image generation was blocked. Reason: ${blockReason}`,
          blockReason,
        });
      }

      const explanation = parts.filter((part) => Boolean(part.text)).map((part) => part.text).join(' ').trim();
      if (explanation) {
        return res.status(422).json({
          error: 'The model returned text instead of an image.',
          explanation,
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
    const status = typeof (error as any)?.status === 'number'
      ? (error as any).status
      : 500;
    const message = error instanceof Error ? error.message : 'Unknown Gemini proxy error.';
    return res.status(status).json({ error: message });
  }
}
