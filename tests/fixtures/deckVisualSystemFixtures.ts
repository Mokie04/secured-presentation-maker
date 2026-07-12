import { buildSemanticSlideSpecs } from '../../lib/semanticSlideSpec.ts';
import type { TeachingStoryboard } from '../../lib/teachingStoryboard.ts';
import {
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
  MULTI_OBJECTIVE_STORYBOARD,
} from './semanticSlideFixtures.ts';

const specsFor = (storyboard: TeachingStoryboard) => {
  const result = buildSemanticSlideSpecs(storyboard);
  if (!result.ok) throw new Error('visual-system fixture semantic specs failed');
  return result.specs;
};

export const FIVE_SESSION_VISUAL_FIXTURE = {
  storyboard: FIVE_SESSION_STORYBOARD,
  specs: specsFor(FIVE_SESSION_STORYBOARD),
};

export const MULTI_OBJECTIVE_VISUAL_FIXTURE = {
  storyboard: MULTI_OBJECTIVE_STORYBOARD,
  specs: specsFor(MULTI_OBJECTIVE_STORYBOARD),
};

export const EVIDENCE_OUTPUT_VISUAL_FIXTURE = {
  storyboard: EVIDENCE_OUTPUT_STORYBOARD,
  specs: specsFor(EVIDENCE_OUTPUT_STORYBOARD),
};
