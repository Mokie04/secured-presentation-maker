import type { ImageSemanticMetadata } from '../types';
import { buildGenerationCacheKey } from './generationCache.ts';

export const IMAGE_SEMANTIC_CACHE_VERSION = 'image-semantic-cache-v25';

export const normalizeImageSemanticText = (value: string | undefined): string => (
  (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
);

export const slugifyImageSemanticText = (value: string | undefined): string => (
  normalizeImageSemanticText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

export const getGradeBand = (gradeLevel: string | undefined): string => {
  const normalized = normalizeImageSemanticText(gradeLevel);
  const gradeMatch = normalized.match(/\b(?:grade|baitang)\s*(\d{1,2})\b/) || normalized.match(/\b(\d{1,2})\b/);
  if (!gradeMatch) {
    return normalized.includes('college') ? 'college' : '';
  }

  const grade = Number.parseInt(gradeMatch[1], 10);
  if (!Number.isFinite(grade)) return '';
  if (grade <= 3) return 'k-3';
  if (grade <= 6) return '4-6';
  if (grade <= 10) return '7-10';
  return '11-12';
};

export async function buildImageSemanticCacheId(
  semanticMetadata: ImageSemanticMetadata,
  semanticLanguage: 'EN' | 'FIL',
): Promise<string | undefined> {
  const template = semanticMetadata.slideTemplate || semanticMetadata.visualRole || 'content';
  if (!template || semanticMetadata.style === 'none') {
    return undefined;
  }
  const semanticAnchor = slugifyImageSemanticText(semanticMetadata.semanticAnchor || template).slice(0, 120);

  return buildGenerationCacheKey('image-semantic', [
    IMAGE_SEMANTIC_CACHE_VERSION,
    semanticMetadata.level || 'general',
    semanticMetadata.subject || 'general',
    semanticMetadata.topic || 'general',
    semanticMetadata.gradeBand || semanticMetadata.gradeLevel || 'all-grades',
    semanticLanguage,
    template,
    semanticMetadata.visualRole || 'content',
    semanticMetadata.style || 'illustration',
    semanticAnchor || template,
  ]);
}
