type OpenImage = {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  source?: string;
  provider?: string;
  license?: string;
  license_version?: string;
  creator?: string;
  tags?: Array<{ name?: string } | string>;
};

const STOPWORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'from', 'by', 'at',
  'about', 'into', 'over', 'under', 'after', 'before', 'during', 'without', 'within', 'through',
  'sa', 'ang', 'ng', 'mga', 'para', 'mula', 'ito', 'iyan', 'iyon', 'at', 'o', 'na', 'nang',
  'image', 'photo', 'pictures', 'picture', 'illustration', 'diagram', 'infographic', 'slide',
  'showing', 'show', 'educational', 'education', 'learning', 'classroom', 'teacher', 'students',
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function tagsToText(tags?: Array<{ name?: string } | string>): string {
  if (!Array.isArray(tags)) return '';
  return tags
    .map((tag) => typeof tag === 'string' ? tag : tag?.name || '')
    .filter(Boolean)
    .join(' ');
}

function computeConfidence(queryTokens: string[], image: OpenImage): number {
  if (queryTokens.length === 0) return 0;

  const title = normalizeText(image.title || '');
  const tags = normalizeText(tagsToText(image.tags));
  const combined = `${title} ${tags}`.trim();
  if (!combined) return 0;

  let tokenMatches = 0;
  for (const token of queryTokens) {
    if (combined.includes(token)) {
      tokenMatches += 1;
    }
  }

  const coverage = tokenMatches / queryTokens.length;
  const titleBoost = title ? (tokenize(title).filter((token) => queryTokens.includes(token)).length / Math.max(1, queryTokens.length)) * 0.25 : 0;
  const sourceBoost = image.source === 'wikimedia' || image.source === 'smithsonian' || image.source === 'met'
    ? 0.1
    : 0;

  return Math.min(1, coverage + titleBoost + sourceBoost);
}

function buildSearchCandidates(query: string, lang: string): string[] {
  const normalized = normalizeText(query);
  const rawTokens = normalized.split(' ').filter(Boolean);
  const keywordTokens = rawTokens.filter((token) => token.length > 2 && !STOPWORDS.has(token));
  const compact = keywordTokens.slice(0, 8).join(' ');

  const candidates = new Set<string>();
  if (compact) {
    candidates.add(compact);
    candidates.add(`${compact} education`);
    candidates.add(`${compact} classroom`);
  }

  candidates.add(query.trim().slice(0, 140));
  if (lang === 'FIL') {
    candidates.add(`${compact || query} larawan pang-edukasyon`);
  }

  return Array.from(candidates).filter((candidate) => candidate.trim().length > 0);
}

function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

async function fetchOpenverseImages(searchQuery: string): Promise<OpenImage[]> {
  const openverseUrl = new URL('https://api.openverse.org/v1/images/');
  openverseUrl.searchParams.set('q', searchQuery);
  openverseUrl.searchParams.set('mature', 'false');
  openverseUrl.searchParams.set('page_size', '25');
  openverseUrl.searchParams.set('license', 'by,by-sa,cc0,pdm');
  openverseUrl.searchParams.set('source', 'wikimedia,smithsonian,met');

  let lastStatus = 0;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(openverseUrl.toString(), {
      headers: {
        'User-Agent': 'SAYUNA-AI/1.0 (+educational-use)',
      },
    });
    if (response.ok) {
      const payload = await response.json().catch(() => ({ results: [] }));
      return Array.isArray(payload?.results) ? payload.results : [];
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

function mergeAndDedupeResults(results: OpenImage[]): OpenImage[] {
  const seen = new Set<string>();
  const merged: OpenImage[] = [];

  for (const image of results) {
    const key = image.id || image.url || image.thumbnail || '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(image);
  }

  return merged;
}

async function convertImageToDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'SAYUNA-AI/1.0 (+educational-use)',
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const contentLength = Number(response.headers.get('content-length') || '0');
    const MAX_BYTES = 8 * 1024 * 1024;
    if (contentLength > MAX_BYTES) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) return null;

    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function buildAttribution(image: OpenImage): string {
  const source = image.source || image.provider || 'open source';
  const creator = image.creator || 'Unknown creator';
  const version = image.license_version ? ` ${image.license_version}` : '';
  const license = image.license ? `${String(image.license).toUpperCase()}${version}` : 'Open license';
  return `${creator} | ${source} | ${license}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const rawQuery = typeof req.query?.q === 'string' ? req.query.q : '';
  const lang = typeof req.query?.lang === 'string' ? req.query.lang.toUpperCase() : 'EN';
  const query = rawQuery.trim().slice(0, 200);
  if (!query) {
    return res.status(400).json({ error: 'Missing q query parameter.' });
  }

  const searchCandidates = buildSearchCandidates(query, lang);
  const queryTokens = tokenize(searchCandidates[0] || query);
  if (queryTokens.length === 0) {
    return res.status(200).json({ image: null });
  }

  try {
    const allResults: OpenImage[] = [];
    for (const searchQuery of searchCandidates.slice(0, 3)) {
      const batch = await fetchOpenverseImages(searchQuery);
      allResults.push(...batch);
    }

    const images = mergeAndDedupeResults(allResults);
    if (images.length === 0) {
      return res.status(200).json({ image: null });
    }

    const ranked = images
      .map((image) => ({
        image,
        confidence: computeConfidence(queryTokens, image),
      }))
      .filter((item) => Boolean(item.image.url || item.image.thumbnail))
      .sort((a, b) => b.confidence - a.confidence);

    const best = ranked[0];
    const MIN_CONFIDENCE = 0.65;

    if (!best || best.confidence < MIN_CONFIDENCE) {
      return res.status(200).json({ image: null });
    }

    const imageUrl = best.image.url || best.image.thumbnail;
    if (!imageUrl) {
      return res.status(200).json({ image: null });
    }

    const dataUrl = await convertImageToDataUrl(imageUrl);
    if (!dataUrl) {
      return res.status(200).json({ image: null });
    }

    return res.status(200).json({
      image: {
        url: imageUrl,
        dataUrl,
        title: best.image.title || 'Educational image',
        source: best.image.source || best.image.provider || 'openverse',
        license: best.image.license || 'open',
        creator: best.image.creator || '',
        attribution: buildAttribution(best.image),
        confidence: Number(best.confidence.toFixed(3)),
        landingUrl: best.image.foreign_landing_url || '',
      },
    });
  } catch {
    return res.status(200).json({ image: null });
  }
}
