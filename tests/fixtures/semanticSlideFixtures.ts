import { buildLessonSourceManifest } from '../../lib/lessonSourceManifest.ts';
import { buildTeachingStoryboard, type TeachingStoryboard } from '../../lib/teachingStoryboard.ts';
import {
  EVIDENCE_OUTPUT_DOCUMENT,
  TEACHER_SCRIPT_DOCUMENT,
} from './teachingStoryboardFixtures.ts';
import {
  FIVE_SESSION_MATRIX_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
} from './lessonSourceManifestFixtures.ts';

const storyboardFrom = (document: Parameters<typeof buildLessonSourceManifest>[0]): TeachingStoryboard => {
  const manifestResult = buildLessonSourceManifest(document);
  if (!manifestResult.ok) throw new Error('semantic fixture manifest failed');
  const storyboardResult = buildTeachingStoryboard(manifestResult.manifest);
  if (!storyboardResult.ok) throw new Error('semantic fixture storyboard failed');
  return storyboardResult.storyboard;
};

export const FIVE_SESSION_STORYBOARD = storyboardFrom(FIVE_SESSION_MATRIX_DOCUMENT);
export const MULTI_OBJECTIVE_STORYBOARD = storyboardFrom(MULTI_OBJECTIVE_UNIT_DOCUMENT);
export const TEACHER_SCRIPT_STORYBOARD = storyboardFrom(TEACHER_SCRIPT_DOCUMENT);
export const EVIDENCE_OUTPUT_STORYBOARD = storyboardFrom(EVIDENCE_OUTPUT_DOCUMENT);
