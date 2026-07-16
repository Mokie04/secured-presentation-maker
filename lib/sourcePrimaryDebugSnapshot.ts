import type { K12RouteMode } from './k12GenerationRoutePolicy.ts';
import type { SourcePrimarySceneGenerationFlow } from './sourcePrimarySceneRollout.ts';

export const SOURCE_PRIMARY_DEBUG_CONSOLE_LABEL = 'SOURCE_PRIMARY_DEBUG_SNAPSHOT';

export type SourcePrimaryDebugDeckPath =
  | 'unknown'
  | 'legacy'
  | 'source-primary deterministic scenes'
  | 'source-primary visual composer';

export type SourcePrimaryDebugComposerStatus =
  | 'skipped'
  | 'success'
  | 'failure';

export type SourcePrimaryDebugFlagKey =
  | 'VITE_SOURCE_PRIMARY_ROUTING_V1'
  | 'VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1'
  | 'VITE_SOURCE_PRIMARY_PRODUCTION_ARMED'
  | 'VITE_SEMANTIC_SLIDES_V1'
  | 'VITE_DECK_VISUAL_SYSTEM_V1'
  | 'VITE_END_TO_END_VALIDATION_V1'
  | 'VITE_VISUAL_TEACHING_COMPOSER_V1';

export type SourcePrimaryDebugSnapshot = {
  flags: Record<SourcePrimaryDebugFlagKey, string>;
  flow: SourcePrimarySceneGenerationFlow | 'none';
  originalRouteMode: K12RouteMode | 'unknown';
  effectiveRouteMode: K12RouteMode | 'unknown';
  manifestBuiltValid: boolean | null;
  storyboardBuiltValid: boolean | null;
  gate3SemanticEnabled: boolean;
  gate4VisualSystemEnabled: boolean;
  gate5ValidationEnabled: boolean;
  composerEligible: boolean;
  composerAttempted: boolean;
  composerStatus: SourcePrimaryDebugComposerStatus;
  composerReason: string;
  finalDeckPath: SourcePrimaryDebugDeckPath;
};

export type SourcePrimaryDebugSnapshotInput = Omit<SourcePrimaryDebugSnapshot, 'flags' | 'composerReason'> & {
  flags: Partial<Record<SourcePrimaryDebugFlagKey, unknown>>;
  composerReason: unknown;
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LOCAL_PATH_PATTERN = /(?:\/Users|\/var|\/tmp|[A-Za-z]:\\)[^\s]*/g;
const PRIVATE_FILE_PATTERN = /\b[^\s/\\]+\.(?:docx|pptx|pdf|txt|md|png|jpe?g|webp)\b/gi;

const FLAG_KEYS: SourcePrimaryDebugFlagKey[] = [
  'VITE_SOURCE_PRIMARY_ROUTING_V1',
  'VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1',
  'VITE_SOURCE_PRIMARY_PRODUCTION_ARMED',
  'VITE_SEMANTIC_SLIDES_V1',
  'VITE_DECK_VISUAL_SYSTEM_V1',
  'VITE_END_TO_END_VALIDATION_V1',
  'VITE_VISUAL_TEACHING_COMPOSER_V1',
];

export const isSourcePrimaryDebugEnabled = (search: string): boolean => {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  return params.get('debugSourcePrimary') === '1';
};

export const sanitizeSourcePrimaryDebugValue = (value: unknown): string => {
  const raw = value === undefined ? 'undefined' : String(value);
  return raw
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(LOCAL_PATH_PATTERN, '[redacted-path]')
    .replace(PRIVATE_FILE_PATTERN, '[redacted-file]')
    .slice(0, 160);
};

export const buildSourcePrimaryDebugSnapshot = (
  input: SourcePrimaryDebugSnapshotInput,
): SourcePrimaryDebugSnapshot => ({
  ...input,
  flags: Object.fromEntries(FLAG_KEYS.map((key) => [
    key,
    sanitizeSourcePrimaryDebugValue(input.flags[key]),
  ])) as Record<SourcePrimaryDebugFlagKey, string>,
  composerReason: sanitizeSourcePrimaryDebugValue(input.composerReason),
});
