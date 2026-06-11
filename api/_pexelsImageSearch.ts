type ImageSemanticMetadata = Record<string, string | undefined>;

export type ImageAttribution = {
  provider: 'pexels';
  label: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  sourceId: string;
};

export type PexelsImageResult = {
  dataUrl: string;
  base64: string;
  mime: string;
  attribution: ImageAttribution;
  query: string;
};

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt?: string;
  src?: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
  };
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
};

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';
const PEXELS_MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const PEXELS_SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PEXELS_TIMEOUT_MS = 8_000;

function pexelsApiKey(): string {
  return process.env.PEXELS_API_KEY?.trim() || '';
}

function pexelsFallbackDisabled(): boolean {
  return process.env.PEXELS_IMAGE_FALLBACK_DISABLED === 'true';
}

function normalizeText(value: string | undefined): string {
  return (value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b[a-z]{2,}\d+[a-z]*\b/gi, ' ')
    .replace(/\bq[1-4]\b/gi, ' ')
    .replace(/\bweek\s*\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDepictedSubject(prompt: string): string {
  const match = prompt.match(/The image should depict:\s*"([^"]+)"/i);
  return normalizeText(match?.[1] || prompt)
    .replace(/\b(no|without)\s+(text|labels|numbers|watermarks|signatures)\b/gi, ' ')
    .replace(/\bcreate\b|\bprofessional\b|\bhigh resolution\b|\billustration\b|\bphotorealistic\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 140)
    .trim();
}

function roleSearchTerm(role: string): string {
  const normalized = normalizeText(role).toLowerCase();
  if (['activity', 'practice', 'application', 'discussion'].some((token) => normalized.includes(token))) {
    return 'classroom students';
  }
  if (normalized.includes('vocabulary')) return 'books classroom';
  if (normalized.includes('assessment')) return 'student writing classroom';
  if (normalized.includes('objective') || normalized.includes('overview')) return 'teacher classroom';
  return 'education classroom';
}

function shouldUsePexels(metadata: ImageSemanticMetadata | undefined): boolean {
  const style = normalizeText(metadata?.style).toLowerCase();
  if (style === 'none' || style === 'diagram' || style === 'infographic') return false;

  const role = normalizeText(metadata?.slideTemplate || metadata?.visualRole).toLowerCase();
  if (role.includes('diagram') || role.includes('infographic')) return false;

  return true;
}

function buildPexelsQuery(prompt: string, metadata: ImageSemanticMetadata | undefined): string {
  const anchor = normalizeText(metadata?.semanticAnchor);
  const topic = normalizeText(metadata?.topic);
  const subject = normalizeText(metadata?.subject);
  const promptSubject = extractDepictedSubject(prompt);
  const roleTerm = roleSearchTerm(metadata?.slideTemplate || metadata?.visualRole || '');

  const primary = anchor || topic || promptSubject;
  return [primary, subject, roleTerm]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 96)
    .trim();
}

function contentTypeFromResponse(value: string | null): string | null {
  const normalized = (value || '').split(';')[0].trim().toLowerCase();
  if (normalized === 'image/jpg') return 'image/jpeg';
  return PEXELS_SUPPORTED_IMAGE_TYPES.has(normalized) ? normalized : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function pickPhoto(photos: PexelsPhoto[]): PexelsPhoto | null {
  return photos
    .filter((photo) => photo.src?.large && photo.width >= photo.height)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || null;
}

export async function getPexelsImageForPrompt(input: {
  prompt: string;
  semanticMetadata?: ImageSemanticMetadata;
}): Promise<PexelsImageResult | null> {
  const apiKey = pexelsApiKey();
  if (!apiKey || pexelsFallbackDisabled() || !shouldUsePexels(input.semanticMetadata)) {
    return null;
  }

  const query = buildPexelsQuery(input.prompt, input.semanticMetadata);
  if (!query) return null;

  const searchUrl = new URL(PEXELS_SEARCH_URL);
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('orientation', 'landscape');
  searchUrl.searchParams.set('size', 'large');
  searchUrl.searchParams.set('per_page', '8');

  try {
    const searchResponse = await fetchWithTimeout(searchUrl.toString(), {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
    }, PEXELS_TIMEOUT_MS);

    if (!searchResponse.ok) {
      console.warn('Pexels image fallback search failed.', { status: searchResponse.status });
      return null;
    }

    const payload = await searchResponse.json() as PexelsSearchResponse;
    const photo = pickPhoto(Array.isArray(payload.photos) ? payload.photos : []);
    const imageUrl = photo?.src?.large;
    if (!photo || !imageUrl) return null;

    const imageResponse = await fetchWithTimeout(imageUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
      },
    }, PEXELS_TIMEOUT_MS);

    if (!imageResponse.ok) {
      console.warn('Pexels image fallback download failed.', { status: imageResponse.status });
      return null;
    }

    const mime = contentTypeFromResponse(imageResponse.headers.get('content-type'));
    if (!mime) {
      console.warn('Pexels image fallback returned unsupported content type.');
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > PEXELS_MAX_IMAGE_BYTES) {
      console.warn('Pexels image fallback returned unusable image bytes.', { bytes: arrayBuffer.byteLength });
      return null;
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const photographer = normalizeText(photo.photographer) || 'Pexels photographer';
    const attribution: ImageAttribution = {
      provider: 'pexels',
      label: `Photo by ${photographer} on Pexels`,
      photographer,
      photographerUrl: photo.photographer_url,
      sourceUrl: photo.url,
      sourceId: String(photo.id),
    };

    return {
      dataUrl: `data:${mime};base64,${base64}`,
      base64,
      mime,
      attribution,
      query,
    };
  } catch (error) {
    console.warn('Pexels image fallback failed.');
    return null;
  }
}
