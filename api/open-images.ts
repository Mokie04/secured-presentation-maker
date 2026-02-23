import { requireSession } from './_sessionAuth.js';

type ImageSource = 'wikimedia' | 'nasa' | 'openverse';

type OpenImageCandidate = {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail?: string;
  sourceUrl?: string;
  landingUrl?: string;
  source: ImageSource;
  provider: string;
  license: string;
  creator: string;
  tags: string[];
  width?: number;
  height?: number;
  assetId?: string;
};

type RankedImage = OpenImageCandidate & {
  confidence: number;
};

type ResolvedImagePayload = {
  url: string;
  dataUrl?: string;
  proxyUrl?: string;
};

const ALLOWED_PROXY_SUFFIXES = [
  '.wikimedia.org',
  '.si.edu',
  '.metmuseum.org',
  '.metmuseum.net',
  '.nasa.gov',
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'from', 'by', 'at',
  'about', 'into', 'over', 'under', 'after', 'before', 'during', 'without', 'within', 'through',
  'sa', 'ang', 'ng', 'mga', 'para', 'mula', 'ito', 'iyan', 'iyon', 'o', 'na', 'nang',
  'image', 'photo', 'pictures', 'picture', 'illustration', 'diagram', 'infographic', 'slide',
  'showing', 'show', 'educational', 'education', 'learning', 'classroom', 'teacher', 'students',
  'high', 'quality', 'detailed', 'realistic', 'photorealistic', 'cinematic', 'style', 'without',
  'text', 'labels', 'caption', 'captions', 'words', 'inside', 'with', 'clean', 'background',
]);

const EDUCATIONAL_TERMS = [
  'diagram', 'anatomy', 'map', 'experiment', 'microscope', 'classroom', 'education', 'historical',
  'geography', 'biology', 'chemistry', 'physics', 'mathematics', 'science', 'lesson', 'curriculum',
  'planet', 'solar', 'earth', 'moon', 'mars', 'galaxy',
];

const SPACE_TERMS = [
  'space', 'planet', 'solar', 'orbit', 'galaxy', 'astronomy', 'astronaut', 'nasa', 'rocket',
  'moon', 'mars', 'satellite', 'nebula', 'cosmos', 'universe', 'apollo', 'telescope',
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  biology: ['cell', 'plant', 'animal', 'ecosystem', 'photosynthesis', 'anatomy', 'organism'],
  chemistry: ['atom', 'molecule', 'reaction', 'chemical', 'periodic', 'acid', 'base', 'compound'],
  physics: ['force', 'motion', 'energy', 'electric', 'magnet', 'wave', 'gravity', 'momentum'],
  geography: ['map', 'region', 'country', 'climate', 'mountain', 'river', 'continent'],
  history: ['historical', 'century', 'war', 'revolution', 'civilization', 'artifact', 'ancient'],
  math: ['algebra', 'geometry', 'equation', 'graph', 'triangle', 'fraction', 'calculus'],
  space: SPACE_TERMS,
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return decodeEntities(raw.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function isAllowedProxyHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_PROXY_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'SAYUNA-AI/1.0 (+educational-use)',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function tryFetchAsDataUrl(rawUrl: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(rawUrl, {}, 6000);
    if (!response.ok) return null;

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) return null;

    const contentLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > 6_000_000) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 6_000_000) return null;

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function buildSearchCandidates(query: string, lang: string): string[] {
  const normalized = normalizeText(query);
  const tokens = normalized.split(' ').filter(Boolean);
  const keywordTokens = tokens.filter((token) => token.length > 2 && !STOPWORDS.has(token));
  const compact = keywordTokens.slice(0, 10).join(' ');

  const candidates = new Set<string>();
  if (compact) {
    candidates.add(compact);
    candidates.add(`${compact} educational`);
    candidates.add(`${compact} diagram`);
  }

  candidates.add(query.trim().slice(0, 180));

  if (lang === 'FIL' && compact) {
    candidates.add(`${compact} larawan`);
    candidates.add(`${compact} pang edukasyon`);
  }

  return Array.from(candidates).filter((candidate) => candidate.trim().length > 0).slice(0, 4);
}

function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return url;
  }
}

function mergeAndDedupeResults(results: OpenImageCandidate[]): OpenImageCandidate[] {
  const seen = new Set<string>();
  const merged: OpenImageCandidate[] = [];

  for (const image of results) {
    const key = normalizeUrlKey(image.url || image.thumbnail || image.id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(image);
  }

  return merged;
}

function extractDomain(tokens: string[]): string | null {
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (tokens.some((token) => keywords.includes(token))) {
      return domain;
    }
  }
  return null;
}

function containsAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function buildAttribution(image: OpenImageCandidate): string {
  const source = image.source || image.provider || 'open source';
  const creator = image.creator || 'Unknown creator';
  const license = image.license || 'Open license';
  return `${creator} | ${source} | ${license}`;
}

function computeConfidence(queryTokens: string[], image: OpenImageCandidate, domain: string | null, isSpaceTopic: boolean): number {
  if (queryTokens.length === 0) return 0;

  const title = normalizeText(image.title || '');
  const description = normalizeText(image.description || '');
  const tags = normalizeText((image.tags || []).join(' '));
  const combined = `${title} ${description} ${tags}`.trim();

  if (!combined) return 0;

  const matches = queryTokens.filter((token) => combined.includes(token));
  const titleMatches = queryTokens.filter((token) => title.includes(token));

  if (queryTokens.length >= 3 && matches.length === 0) {
    return 0;
  }

  const coverage = matches.length / Math.max(1, Math.min(7, queryTokens.length));
  const titleCoverage = titleMatches.length / Math.max(1, Math.min(6, queryTokens.length));

  let providerBoost = 0;
  if (image.source === 'wikimedia') providerBoost = 0.12;
  if (image.source === 'nasa') providerBoost = isSpaceTopic ? 0.18 : 0.07;
  if (image.source === 'openverse') providerBoost = 0.03;

  let qualityBoost = 0;
  if (image.width && image.height) {
    const pixels = image.width * image.height;
    qualityBoost += Math.min(0.12, pixels / 24000000);

    const ratio = image.width / Math.max(1, image.height);
    if (ratio >= 1.15 && ratio <= 2.2) qualityBoost += 0.07;
    else if (ratio >= 0.8 && ratio <= 2.6) qualityBoost += 0.03;
  }

  const educationalBoost = containsAny(combined, EDUCATIONAL_TERMS) ? 0.08 : 0;

  const phrase = queryTokens.slice(0, 3).join(' ');
  const phraseBoost = phrase.length >= 6 && title.includes(phrase) ? 0.1 : 0;

  let domainScore = 0;
  if (domain && DOMAIN_KEYWORDS[domain]) {
    if (containsAny(combined, DOMAIN_KEYWORDS[domain])) {
      domainScore += 0.08;
    } else {
      domainScore -= 0.14;
    }
  }

  let mismatchPenalty = 0;
  if (isSpaceTopic && !containsAny(combined, SPACE_TERMS)) {
    mismatchPenalty += 0.2;
  }

  const noisyVisualTerms = ['logo', 'icon', 'poster', 'advertisement', 'meme', 'wallpaper', 'template'];
  if (containsAny(combined, noisyVisualTerms) && !containsAny(normalizeText(queryTokens.join(' ')), noisyVisualTerms)) {
    mismatchPenalty += 0.18;
  }

  const rawScore = (coverage * 0.5)
    + (titleCoverage * 0.2)
    + providerBoost
    + qualityBoost
    + educationalBoost
    + phraseBoost
    + domainScore
    - mismatchPenalty;

  return clamp(rawScore, 0, 1);
}

async function fetchWikimediaImages(searchQuery: string): Promise<OpenImageCandidate[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', searchQuery);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrwhat', 'text');
  url.searchParams.set('gsrlimit', '40');
  url.searchParams.set('prop', 'imageinfo|info|categories');
  url.searchParams.set('inprop', 'url');
  url.searchParams.set('cllimit', '10');
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '1600');

  let lastStatus = 0;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetchWithTimeout(url.toString());

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      const pages = Object.values((payload?.query?.pages || {}) as Record<string, any>);

      const parsed: OpenImageCandidate[] = [];
      for (const page of pages) {
        const imageInfo = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
        if (!imageInfo) continue;

        const mime = String(imageInfo?.mime || '');
        if (mime && !mime.startsWith('image/')) continue;

        const title = String(page?.title || '').replace(/^File:/i, '').trim();
        const ext = imageInfo?.extmetadata || {};

        const license = stripHtml(ext?.LicenseShortName?.value || ext?.License?.value || 'CC');
        if (/non[\s-]?free|fair\s?use/i.test(license)) continue;

        const creator = stripHtml(ext?.Artist?.value || ext?.Credit?.value || '') || 'Unknown creator';
        const description = stripHtml(ext?.ImageDescription?.value || title);
        const categories = Array.isArray(page?.categories)
          ? page.categories
              .map((item: any) => String(item?.title || '').replace(/^Category:/i, '').trim())
              .filter(Boolean)
          : [];

        const thumbnail = typeof imageInfo?.thumburl === 'string' ? imageInfo.thumburl : '';
        const original = typeof imageInfo?.url === 'string' ? imageInfo.url : '';
        const bestUrl = thumbnail || original;
        if (!bestUrl) continue;

        parsed.push({
          id: `wikimedia-${String(page?.pageid || title || Math.random())}`,
          title: title || 'Wikimedia educational image',
          description,
          url: bestUrl,
          thumbnail,
          sourceUrl: original,
          landingUrl: typeof page?.fullurl === 'string' ? page.fullurl : '',
          source: 'wikimedia',
          provider: 'wikimedia-commons',
          license: license || 'CC',
          creator,
          tags: categories,
          width: Number(imageInfo?.width || 0) || undefined,
          height: Number(imageInfo?.height || 0) || undefined,
        });
      }

      return parsed;
    }

    lastStatus = response.status;
    if (!isRetryableStatus(response.status) || attempt >= 2) {
      break;
    }
  }

  if (lastStatus) {
    return [];
  }
  return [];
}

async function fetchNasaImages(searchQuery: string): Promise<OpenImageCandidate[]> {
  const url = new URL('https://images-api.nasa.gov/search');
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('media_type', 'image');
  url.searchParams.set('page', '1');

  const response = await fetchWithTimeout(url.toString(), {}, 7500).catch(() => null);
  if (!response || !response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => ({}));
  const items = Array.isArray(payload?.collection?.items) ? payload.collection.items : [];

  const parsed: OpenImageCandidate[] = [];
  for (const item of items.slice(0, 25)) {
    const data = Array.isArray(item?.data) ? item.data[0] : null;
    if (!data) continue;

    const links = Array.isArray(item?.links) ? item.links : [];
    const thumbnail = links
      .map((link: any) => (typeof link?.href === 'string' ? link.href : ''))
      .find((href: string) => Boolean(href));

    if (!thumbnail) continue;

    const keywords = Array.isArray(data?.keywords)
      ? data.keywords.map((keyword: unknown) => String(keyword)).filter(Boolean)
      : [];

    const creator = String(data?.photographer || data?.secondary_creator || data?.center || '').trim() || 'NASA';
    const nasaId = String(data?.nasa_id || '').trim();

    parsed.push({
      id: `nasa-${nasaId || String(data?.title || Math.random())}`,
      title: String(data?.title || 'NASA educational image').trim(),
      description: String(data?.description || '').trim(),
      url: thumbnail,
      thumbnail,
      landingUrl: nasaId ? `https://images.nasa.gov/details-${encodeURIComponent(nasaId)}` : '',
      source: 'nasa',
      provider: 'nasa-image-library',
      license: 'Public domain (NASA media usage policy)',
      creator,
      tags: keywords,
      assetId: nasaId || undefined,
    });
  }

  return parsed;
}

async function fetchOpenverseImages(searchQuery: string): Promise<OpenImageCandidate[]> {
  const openverseUrl = new URL('https://api.openverse.org/v1/images/');
  openverseUrl.searchParams.set('q', searchQuery);
  openverseUrl.searchParams.set('mature', 'false');
  openverseUrl.searchParams.set('page_size', '20');
  openverseUrl.searchParams.set('license', 'by,by-sa,cc0,pdm');
  openverseUrl.searchParams.set('source', 'wikimedia,smithsonian,met');

  let lastStatus = 0;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetchWithTimeout(openverseUrl.toString());
    if (response.ok) {
      const payload = await response.json().catch(() => ({ results: [] }));
      const results = Array.isArray(payload?.results) ? payload.results : [];

      return results
        .map((item: any): OpenImageCandidate | null => {
          const url = String(item?.url || item?.thumbnail || '').trim();
          if (!url) return null;

          const tags = Array.isArray(item?.tags)
            ? item.tags
                .map((tag: any) => (typeof tag === 'string' ? tag : String(tag?.name || '')))
                .filter(Boolean)
            : [];

          return {
            id: String(item?.id || `openverse-${Math.random()}`),
            title: String(item?.title || 'Open image').trim(),
            description: '',
            url,
            thumbnail: String(item?.thumbnail || '').trim() || undefined,
            landingUrl: String(item?.foreign_landing_url || '').trim() || undefined,
            source: 'openverse',
            provider: String(item?.source || 'openverse').trim(),
            license: String(item?.license || 'open').toUpperCase(),
            creator: String(item?.creator || '').trim() || 'Unknown creator',
            tags,
            width: Number(item?.width || 0) || undefined,
            height: Number(item?.height || 0) || undefined,
          };
        })
        .filter((item: OpenImageCandidate | null): item is OpenImageCandidate => Boolean(item));
    }

    lastStatus = response.status;
    if (!isRetryableStatus(response.status) || attempt >= 2) {
      break;
    }
  }

  if (lastStatus) {
    return [];
  }
  return [];
}

async function resolveNasaAssetUrl(assetId: string): Promise<string | null> {
  const safeId = assetId.trim();
  if (!safeId) return null;

  const url = `https://images-api.nasa.gov/asset/${encodeURIComponent(safeId)}`;
  const response = await fetchWithTimeout(url, {}, 7000).catch(() => null);
  if (!response || !response.ok) return null;

  const payload = await response.json().catch(() => ({}));
  const items = Array.isArray(payload?.collection?.items) ? payload.collection.items : [];

  const hrefs = items
    .map((item: any) => (typeof item?.href === 'string' ? item.href : ''))
    .filter(Boolean);

  const preferred = hrefs.find((href: string) => /\.(jpe?g|png|webp)$/i.test(href) && !/~thumb\./i.test(href));
  if (preferred) return preferred;

  const fallback = hrefs.find((href: string) => /\.(jpe?g|png|webp)$/i.test(href));
  return fallback || null;
}

function createProxyUrl(imageUrl: string): string {
  return `/api/image-proxy?u=${encodeURIComponent(imageUrl)}`;
}

async function resolveUsableImage(image: OpenImageCandidate): Promise<ResolvedImagePayload | null> {
  const candidates: string[] = [];

  if (image.source === 'nasa' && image.assetId) {
    const nasaAssetUrl = await resolveNasaAssetUrl(image.assetId).catch(() => null);
    if (nasaAssetUrl) candidates.push(nasaAssetUrl);
  }

  for (const candidate of [image.sourceUrl, image.url, image.thumbnail]) {
    if (candidate && candidate.trim()) {
      candidates.push(candidate.trim());
    }
  }

  const uniqueCandidates = Array.from(new Set(candidates));
  for (const candidate of uniqueCandidates) {
    if (isAllowedProxyHost(candidate)) {
      return {
        url: candidate,
        proxyUrl: createProxyUrl(candidate),
      };
    }
    // For non-allowlisted hosts, fetch server-side and return a stable data URL.
    if (/^https?:\/\//i.test(candidate)) {
      const dataUrl = await tryFetchAsDataUrl(candidate);
      if (dataUrl) {
        return { url: candidate, dataUrl };
      }
    }
  }

  return null;
}

function rankImages(images: OpenImageCandidate[], queryTokens: string[]): RankedImage[] {
  const domain = extractDomain(queryTokens);
  const isSpaceTopic = queryTokens.some((token) => SPACE_TERMS.includes(token));

  return images
    .map((image) => ({
      ...image,
      confidence: computeConfidence(queryTokens, image, domain, isSpaceTopic),
    }))
    .filter((image) => image.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  if (!requireSession(req, res)) {
    return;
  }

  const rawQuery = typeof req.query?.q === 'string' ? req.query.q : '';
  const lang = typeof req.query?.lang === 'string' ? req.query.lang.toUpperCase() : 'EN';
  const query = rawQuery.trim().slice(0, 220);
  if (!query) {
    return res.status(400).json({ error: 'Missing q query parameter.' });
  }

  const searchCandidates = buildSearchCandidates(query, lang);
  const queryTokens = tokenize(searchCandidates[0] || query);
  if (queryTokens.length === 0) {
    return res.status(200).json({ image: null });
  }

  try {
    const wikimediaTasks = searchCandidates.slice(0, 3).map((searchQuery) => fetchWikimediaImages(searchQuery));
    const nasaTasks = searchCandidates.slice(0, 2).map((searchQuery) => fetchNasaImages(searchQuery));
    const openverseTasks = searchCandidates.slice(0, 1).map((searchQuery) => fetchOpenverseImages(searchQuery));

    const settled = await Promise.allSettled([
      ...wikimediaTasks,
      ...nasaTasks,
      ...openverseTasks,
    ]);

    const allResults = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const merged = mergeAndDedupeResults(allResults);

    if (merged.length === 0) {
      return res.status(200).json({ image: null });
    }

    const ranked = rankImages(merged, queryTokens)
      .filter((item) => Boolean(item.url || item.thumbnail));

    const MIN_CONFIDENCE = 0.35; // relax threshold to increase hit rate
    const viable = ranked.filter((candidate) => candidate.confidence >= MIN_CONFIDENCE).slice(0, 8);
    const candidatePool = viable.length > 0 ? viable : ranked.slice(0, 8);
    if (candidatePool.length === 0) {
      return res.status(200).json({ image: null });
    }

    let best: RankedImage | null = null;
    let resolved: ResolvedImagePayload | null = null;
    for (const candidate of candidatePool) {
      const maybeResolved = await resolveUsableImage(candidate);
      if (maybeResolved) {
        best = candidate;
        resolved = maybeResolved;
        break;
      }
    }

    if (!best || !resolved) {
      // Last resort: try unresolved merged results so we still return an image when possible.
      for (const fallback of merged.slice(0, 10)) {
        const maybeResolved = await resolveUsableImage(fallback);
        if (maybeResolved) {
          best = { ...fallback, confidence: 0.2 };
          resolved = maybeResolved;
          break;
        }
      }
    }

    if (!best || !resolved) {
      return res.status(200).json({ image: null });
    }

    const alternatives = ranked
      .filter((item) => item.id !== best.id && item.confidence >= 0.45)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        thumbnail: item.thumbnail || '',
        source: item.source,
        confidence: Number(item.confidence.toFixed(3)),
        license: item.license,
        creator: item.creator,
        landingUrl: item.landingUrl || '',
      }));

    return res.status(200).json({
      image: {
        id: best.id,
        url: resolved.url,
        dataUrl: resolved.dataUrl || '',
        proxyUrl: resolved.proxyUrl || '',
        title: best.title || 'Educational image',
        source: best.source,
        provider: best.provider,
        license: best.license || 'open',
        creator: best.creator || '',
        attribution: buildAttribution(best),
        confidence: Number(best.confidence.toFixed(3)),
        landingUrl: best.landingUrl || '',
        alternatives,
      },
    });
  } catch {
    return res.status(200).json({ image: null });
  }
}
