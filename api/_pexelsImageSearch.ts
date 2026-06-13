type ImageSemanticMetadata = Record<string, string | undefined>;

export type ImageAttribution = {
  provider: 'pexels';
  label: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  sourceId: string;
  cacheVersion: string;
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

type PexelsSearchPlan = {
  query: string;
  requiredTerms: string[];
  selectionSeed: string;
};

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';
const PEXELS_MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const PEXELS_SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PEXELS_TIMEOUT_MS = 8_000;
const PEXELS_CACHE_VERSION = 'pexels-selection-v3';
const PEXELS_SEARCH_TERM_STOPWORDS = new Set([
  'able', 'about', 'accurate', 'activity', 'against', 'artifact', 'background', 'class', 'classroom',
  'area', 'areas', 'clear', 'concept', 'content', 'criteria', 'criterion', 'decorative', 'depict',
  'draft', 'education', 'educational', 'evidence', 'example', 'focus', 'generic', 'grade', 'group',
  'groups', 'high', 'image', 'instructional', 'key',
  'lesson', 'learning', 'learners', 'material', 'materials', 'notebook', 'output', 'photo',
  'photorealistic', 'picture', 'professional', 'question', 'questions', 'realistic', 'resolution',
  'school', 'session', 'slide', 'specific', 'student', 'students', 'subject', 'teacher', 'teaching',
  'work', 'worksheet', 'worksheets', 'write', 'writing',
]);
const PEXELS_TERM_SYNONYMS: Record<string, string[]> = {
  equipment: ['equipment', 'tool', 'tools', 'gear'],
  facility: ['facility', 'facilities', 'building', 'workshop', 'farm'],
  facilities: ['facility', 'facilities', 'building', 'workshop', 'farm'],
  house: ['house', 'housing', 'shed', 'shelter', 'coop'],
  housing: ['housing', 'house', 'shed', 'shelter', 'coop'],
  maintenance: ['maintenance', 'cleaning', 'repair', 'inspection'],
  poultry: ['poultry', 'chicken', 'chickens', 'hen', 'hens', 'coop', 'farm'],
  procedure: ['procedure', 'process', 'steps', 'sequence'],
  tools: ['tool', 'tools', 'equipment'],
};

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

function normalizeSearchText(value: string | undefined): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractSpecificSearchTerms(value: string | undefined, maxTerms = 12): string[] {
  const seen = new Set<string>();
  const normalized = normalizeSearchText(value).replace(/[^a-z0-9\s]+/g, ' ');
  const terms: string[] = [];

  normalized.split(/\s+/).forEach((rawToken) => {
    const token = rawToken.replace(/^-+|-+$/g, '');
    if (token.length < 4 || /^\d+$/.test(token) || PEXELS_SEARCH_TERM_STOPWORDS.has(token)) return;
    const canonical = token.endsWith('s') && token.length > 5 ? token.slice(0, -1) : token;
    if (PEXELS_SEARCH_TERM_STOPWORDS.has(canonical) || seen.has(canonical)) return;
    seen.add(canonical);
    terms.push(canonical);
  });

  return terms.slice(0, maxTerms);
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
  if (style === 'none' || style === 'diagram' || style === 'infographic' || style === 'historical photo') return false;

  const role = normalizeText(metadata?.slideTemplate || metadata?.visualRole).toLowerCase();
  if (role.includes('diagram') || role.includes('infographic')) return false;

  return true;
}

function buildPexelsSearchPlan(prompt: string, metadata: ImageSemanticMetadata | undefined): PexelsSearchPlan | null {
  const anchor = normalizeText(metadata?.semanticAnchor);
  const topic = normalizeText(metadata?.topic);
  const subject = normalizeText(metadata?.subject);
  const competency = normalizeText(metadata?.learningCompetency);
  const planUnitTitle = normalizeText(metadata?.planUnitTitle);
  const promptSubject = extractDepictedSubject(prompt);
  const roleTerm = roleSearchTerm(metadata?.slideTemplate || metadata?.visualRole || '');
  const specificTerms = extractSpecificSearchTerms([
    promptSubject,
    anchor,
    planUnitTitle,
    topic,
    competency,
    subject,
  ].filter(Boolean).join(' '), 10);

  if (specificTerms.length < 2) return null;

  const isGenericRoleTerm = /\b(?:classroom|students?|teacher|education|school|books?)\b/i.test(roleTerm);
  const query = [
    specificTerms.slice(0, 8).join(' '),
    !isGenericRoleTerm ? roleTerm : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 96)
    .trim();

  if (!query) return null;

  return {
    query,
    requiredTerms: specificTerms.slice(0, 6),
    selectionSeed: [
      query,
      promptSubject,
      anchor,
      planUnitTitle,
      topic,
      subject,
      normalizeText(metadata?.slideTemplate || metadata?.visualRole),
    ].filter(Boolean).join('\n'),
  };
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

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function expandPhotoMatchTerms(term: string): string[] {
  const synonyms = PEXELS_TERM_SYNONYMS[term] || [];
  const plural = term.endsWith('s') ? term.slice(0, -1) : `${term}s`;
  return Array.from(new Set([term, plural, ...synonyms].filter((candidate) => candidate.length >= 4)));
}

function scorePhotoSubjectMatch(photo: PexelsPhoto, requiredTerms: string[]): number {
  const haystack = normalizeSearchText(`${photo.alt || ''} ${photo.url || ''}`);
  if (!haystack) return 0;

  return requiredTerms.reduce((score, term) => {
    const matchesTerm = expandPhotoMatchTerms(term).some((candidate) => haystack.includes(candidate));
    return score + (matchesTerm ? 1 : 0);
  }, 0);
}

function pickPhoto(photos: PexelsPhoto[], plan: PexelsSearchPlan): PexelsPhoto | null {
  const candidates = photos.filter((photo) => photo.src?.large && photo.width >= photo.height);
  if (candidates.length === 0) return null;

  const scoredCandidates = candidates
    .map((photo) => ({
      photo,
      score: scorePhotoSubjectMatch(photo, plan.requiredTerms),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.photo.width - a.photo.width);

  if (scoredCandidates.length === 0) return null;

  const bestScore = scoredCandidates[0].score;
  const relevantCandidates = scoredCandidates
    .filter((candidate) => candidate.score === bestScore)
    .slice(0, Math.min(scoredCandidates.length, 8));
  const selected = relevantCandidates[hashString(plan.selectionSeed) % relevantCandidates.length];
  return selected?.photo || relevantCandidates[0]?.photo || null;
}

export async function getPexelsImageForPrompt(input: {
  prompt: string;
  semanticMetadata?: ImageSemanticMetadata;
}): Promise<PexelsImageResult | null> {
  const apiKey = pexelsApiKey();
  if (!apiKey || pexelsFallbackDisabled() || !shouldUsePexels(input.semanticMetadata)) {
    return null;
  }

  const searchPlan = buildPexelsSearchPlan(input.prompt, input.semanticMetadata);
  if (!searchPlan) return null;

  const searchUrl = new URL(PEXELS_SEARCH_URL);
  searchUrl.searchParams.set('query', searchPlan.query);
  searchUrl.searchParams.set('orientation', 'landscape');
  searchUrl.searchParams.set('size', 'large');
  searchUrl.searchParams.set('per_page', '12');

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
    const photo = pickPhoto(Array.isArray(payload.photos) ? payload.photos : [], searchPlan);
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
      cacheVersion: PEXELS_CACHE_VERSION,
    };

    return {
      dataUrl: `data:${mime};base64,${base64}`,
      base64,
      mime,
      attribution,
      query: searchPlan.query,
    };
  } catch (error) {
    console.warn('Pexels image fallback failed.');
    return null;
  }
}
