import { GoogleGenAI } from "@google/genai";

type GeminiProxyRequest = {
  task?: 'text' | 'image';
  model?: string;
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

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents,
      config: requestConfig,
    });

    if (task === 'image') {
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          return res.status(200).json({
            dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
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
    });
  } catch (error) {
    const status = typeof (error as any)?.status === 'number'
      ? (error as any).status
      : 500;
    const message = error instanceof Error ? error.message : 'Unknown Gemini proxy error.';
    return res.status(status).json({ error: message });
  }
}
