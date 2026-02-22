const ALLOWED_HOST_SUFFIXES = [
  '.wikimedia.org',
  '.si.edu',
  '.metmuseum.org',
  '.metmuseum.net',
  '.nasa.gov',
];

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const imageUrl = typeof req.query?.u === 'string' ? req.query.u : '';
  if (!imageUrl || !isAllowedUrl(imageUrl)) {
    return res.status(400).send('Invalid or disallowed image URL');
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'SAYUNA-AI/1.0 (+educational-use)',
      },
    });

    if (!upstream.ok) {
      return res.status(502).send('Failed to fetch upstream image');
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(415).send('Upstream content is not an image');
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch {
    return res.status(502).send('Image proxy request failed');
  }
}
