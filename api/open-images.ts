type OpenImage = {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
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

  const normalizedQuery = lang === 'FIL' ? `${query} educational` : query;
  const queryTokens = tokenize(normalizedQuery);
  if (queryTokens.length === 0) {
    return res.status(200).json({ image: null });
  }

  try {
    const openverseUrl = new URL('https://api.openverse.org/v1/images/');
    openverseUrl.searchParams.set('q', normalizedQuery);
    openverseUrl.searchParams.set('mature', 'false');
    openverseUrl.searchParams.set('page_size', '25');
    openverseUrl.searchParams.set('license', 'by,by-sa,cc0,pdm');
    openverseUrl.searchParams.set('source', 'wikimedia,smithsonian,met,flickr');

    const openverseResponse = await fetch(openverseUrl.toString(), {
      headers: {
        'User-Agent': 'SAYUNA-AI/1.0 (+educational-use)',
      },
    });

    if (!openverseResponse.ok) {
      return res.status(200).json({ image: null });
    }

    const payload = await openverseResponse.json().catch(() => ({ results: [] }));
    const images: OpenImage[] = Array.isArray(payload?.results) ? payload.results : [];

    const ranked = images
      .map((image) => ({
        image,
        confidence: computeConfidence(queryTokens, image),
      }))
      .filter((item) => Boolean(item.image.url || item.image.thumbnail))
      .sort((a, b) => b.confidence - a.confidence);

    const best = ranked[0];
    const MIN_CONFIDENCE = 0.75;

    if (!best || best.confidence < MIN_CONFIDENCE) {
      return res.status(200).json({ image: null });
    }

    const imageUrl = best.image.url || best.image.thumbnail;
    if (!imageUrl) {
      return res.status(200).json({ image: null });
    }

    return res.status(200).json({
      image: {
        url: imageUrl,
        title: best.image.title || 'Educational image',
        source: best.image.source || best.image.provider || 'openverse',
        license: best.image.license || 'open',
        creator: best.image.creator || '',
        attribution: buildAttribution(best.image),
        confidence: Number(best.confidence.toFixed(3)),
      },
    });
  } catch {
    return res.status(200).json({ image: null });
  }
}
