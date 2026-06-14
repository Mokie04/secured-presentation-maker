import type { Slide } from '../types';

export type TitleSlideContext = {
  unitLabel: string;
  unitNumber: string;
  unitFocus: string;
  metadataItems: string[];
};

const UNIT_CONTEXT_PATTERN = /^\s*(session|day|lesson)\s+(\d+)(?:\s*[:\-–—]\s*(.+))?\s*$/i;
const BAD_TITLE_CONTEXT_PATTERN = /\b(?:formative\s+assessment|formatibong\s+pagtataya|ebidensiyang\s+pormatibo|what\s+task,\s*activity|what\s+can\s+we\s+do\s+together|uploaded\s+lesson\s+plan|source\s+extract|source\s+material|lesson\s+blueprint)\b/i;
const UNKNOWN_METADATA_PATTERN = /^(?:subject|grade\s+level)\s*:\s*(?:not\s+specified|not\s+provided|not\s+available|unknown|uploaded\s+lesson\s+plan|source\s+material|n\/?a|none)$/i;

function isRenderableTitleContextItem(item: string): boolean {
  return Boolean(item.trim())
    && !BAD_TITLE_CONTEXT_PATTERN.test(item)
    && !UNKNOWN_METADATA_PATTERN.test(item)
    && !(item.length > 130 && item.includes('?'));
}

export function getTitleSlideContext(slide: Pick<Slide, 'content'>): TitleSlideContext {
  const content = Array.isArray(slide.content)
    ? slide.content.map((item) => item.trim()).filter(Boolean)
    : [];
  const unitIndex = content.findIndex((item) => UNIT_CONTEXT_PATTERN.test(item));
  const unitMatch = unitIndex >= 0 ? content[unitIndex].match(UNIT_CONTEXT_PATTERN) : null;
  const unitFocus = unitMatch?.[3]?.trim() || '';

  return {
    unitLabel: unitMatch?.[1] ? unitMatch[1].toUpperCase() : '',
    unitNumber: unitMatch?.[2] || '',
    unitFocus: isRenderableTitleContextItem(unitFocus) ? unitFocus : '',
    metadataItems: content
      .filter((_, index) => index !== unitIndex)
      .filter(isRenderableTitleContextItem)
      .slice(0, 3),
  };
}
