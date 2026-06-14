import type { Slide } from '../types';

export type TitleSlideContext = {
  unitLabel: string;
  unitNumber: string;
  unitFocus: string;
  metadataItems: string[];
};

const UNIT_CONTEXT_PATTERN = /^\s*(session|day|lesson)\s+(\d+)(?:\s*[:\-–—]\s*(.+))?\s*$/i;

export function getTitleSlideContext(slide: Pick<Slide, 'content'>): TitleSlideContext {
  const content = Array.isArray(slide.content)
    ? slide.content.map((item) => item.trim()).filter(Boolean)
    : [];
  const unitIndex = content.findIndex((item) => UNIT_CONTEXT_PATTERN.test(item));
  const unitMatch = unitIndex >= 0 ? content[unitIndex].match(UNIT_CONTEXT_PATTERN) : null;

  return {
    unitLabel: unitMatch?.[1] ? unitMatch[1].toUpperCase() : '',
    unitNumber: unitMatch?.[2] || '',
    unitFocus: unitMatch?.[3]?.trim() || '',
    metadataItems: content.filter((_, index) => index !== unitIndex).slice(0, 3),
  };
}

