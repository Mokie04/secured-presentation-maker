import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';

export type SourcePrimarySceneRolloutStage =
  | 'off'
  | 'internal'
  | 'beta'
  | 'canary-5'
  | 'canary-25'
  | 'all';

export type SourcePrimarySceneGenerationFlow =
  | 'k12-single-lesson'
  | 'k12-weekly-plan'
  | 'k12-daily-unit';

export type SourcePrimarySceneRolloutContext = {
  isAdmin?: boolean;
  optedInToSourcePrimaryScenes?: boolean;
  stableBucketSeed?: string;
};

export type SourcePrimarySceneRolloutReason =
  | 'rollout_off'
  | 'route_not_source_primary_uploaded'
  | 'internal_admin'
  | 'internal_non_admin'
  | 'beta_opted_in'
  | 'beta_not_opted_in'
  | 'canary_in_bucket'
  | 'canary_out_of_bucket'
  | 'all_eligible'
  | 'missing_stable_bucket_seed';

export type SourcePrimarySceneRolloutDecision = {
  eligible: boolean;
  stage: SourcePrimarySceneRolloutStage;
  reason: SourcePrimarySceneRolloutReason;
  originalRoutePolicy: K12GenerationRoutePolicy;
  effectiveRoutePolicy: K12GenerationRoutePolicy;
  canaryBucket?: number;
};

export type SourcePrimarySceneRolloutFlowDecision = SourcePrimarySceneRolloutDecision & {
  flow: SourcePrimarySceneGenerationFlow;
};

const SOURCE_PRIMARY_SCENE_ROLLOUT_STAGES = new Map<string, SourcePrimarySceneRolloutStage>([
  ['internal', 'internal'],
  ['beta', 'beta'],
  ['5', 'canary-5'],
  ['5%', 'canary-5'],
  ['canary-5', 'canary-5'],
  ['25', 'canary-25'],
  ['25%', 'canary-25'],
  ['canary-25', 'canary-25'],
  ['100', 'all'],
  ['100%', 'all'],
  ['all', 'all'],
]);

const SAFE_STABLE_BUCKET_SEED_PATTERN = /^[A-Za-z0-9._:-]{6,128}$/;
const UNSAFE_STABLE_BUCKET_SEED_PATTERNS = [
  /\s/,
  /\b(?:teacher|learner|student|school|lesson|objective|assessment|prompt|notes?)\b/i,
  /@/,
  /(?:\/|\\|\.docx\b|\.pptx\b|\.pdf\b|\.txt\b|\.md\b)/i,
];

export const parseSourcePrimarySceneRolloutStage = (
  flagValue: unknown,
): SourcePrimarySceneRolloutStage => {
  const normalized = String(flagValue ?? '').trim().toLowerCase();
  if (!normalized || normalized === '0' || normalized === 'false' || normalized === 'off') {
    return 'off';
  }

  return SOURCE_PRIMARY_SCENE_ROLLOUT_STAGES.get(normalized) ?? 'off';
};

export const toLegacyEffectiveRoutePolicy = (
  policy: K12GenerationRoutePolicy,
): K12GenerationRoutePolicy => ({
  inputOrigin: policy.inputOrigin,
  mode: 'legacy',
  allowReusableSeeds: true,
  cacheKeyParts: [],
});

const isSourcePrimaryUploadedRoute = (policy: K12GenerationRoutePolicy): boolean => (
  policy.mode === 'source-primary' && policy.inputOrigin === 'uploaded-file'
);

const isSafeStableBucketSeed = (value: string | undefined): value is string => {
  if (!value || !SAFE_STABLE_BUCKET_SEED_PATTERN.test(value)) return false;
  return !UNSAFE_STABLE_BUCKET_SEED_PATTERNS.some((pattern) => pattern.test(value));
};

export const getSourcePrimarySceneCanaryBucket = (stableBucketSeed: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < stableBucketSeed.length; index += 1) {
    hash ^= stableBucketSeed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
};

const ineligibleDecision = (
  policy: K12GenerationRoutePolicy,
  stage: SourcePrimarySceneRolloutStage,
  reason: SourcePrimarySceneRolloutReason,
  canaryBucket?: number,
): SourcePrimarySceneRolloutDecision => ({
  eligible: false,
  stage,
  reason,
  originalRoutePolicy: policy,
  effectiveRoutePolicy: toLegacyEffectiveRoutePolicy(policy),
  ...(typeof canaryBucket === 'number' ? { canaryBucket } : {}),
});

const eligibleDecision = (
  policy: K12GenerationRoutePolicy,
  stage: SourcePrimarySceneRolloutStage,
  reason: SourcePrimarySceneRolloutReason,
  canaryBucket?: number,
): SourcePrimarySceneRolloutDecision => ({
  eligible: true,
  stage,
  reason,
  originalRoutePolicy: policy,
  effectiveRoutePolicy: policy,
  ...(typeof canaryBucket === 'number' ? { canaryBucket } : {}),
});

export const resolveSourcePrimarySceneRolloutEligibility = (
  policy: K12GenerationRoutePolicy,
  stage: SourcePrimarySceneRolloutStage,
  context: SourcePrimarySceneRolloutContext = {},
): SourcePrimarySceneRolloutDecision => {
  if (!isSourcePrimaryUploadedRoute(policy)) {
    return {
      eligible: false,
      stage,
      reason: 'route_not_source_primary_uploaded',
      originalRoutePolicy: policy,
      effectiveRoutePolicy: policy,
    };
  }

  if (stage === 'off') return ineligibleDecision(policy, stage, 'rollout_off');

  if (stage === 'internal') {
    return context.isAdmin
      ? eligibleDecision(policy, stage, 'internal_admin')
      : ineligibleDecision(policy, stage, 'internal_non_admin');
  }

  if (stage === 'beta') {
    return context.optedInToSourcePrimaryScenes
      ? eligibleDecision(policy, stage, 'beta_opted_in')
      : ineligibleDecision(policy, stage, 'beta_not_opted_in');
  }

  if (stage === 'all') return eligibleDecision(policy, stage, 'all_eligible');

  if (!isSafeStableBucketSeed(context.stableBucketSeed)) {
    return ineligibleDecision(policy, stage, 'missing_stable_bucket_seed');
  }

  const canaryBucket = getSourcePrimarySceneCanaryBucket(context.stableBucketSeed);
  const threshold = stage === 'canary-5' ? 5 : 25;
  return canaryBucket < threshold
    ? eligibleDecision(policy, stage, 'canary_in_bucket', canaryBucket)
    : ineligibleDecision(policy, stage, 'canary_out_of_bucket', canaryBucket);
};

export const resolveSourcePrimarySceneRolloutForGeneration = (
  flow: SourcePrimarySceneGenerationFlow,
  originalRoutePolicy: K12GenerationRoutePolicy,
  flagValue: unknown,
  context: SourcePrimarySceneRolloutContext = {},
): SourcePrimarySceneRolloutFlowDecision => ({
  flow,
  ...resolveSourcePrimarySceneRolloutEligibility(
    originalRoutePolicy,
    parseSourcePrimarySceneRolloutStage(flagValue),
    context,
  ),
});

export const shouldRunSourcePrimaryScenePreflight = (
  decision: Pick<SourcePrimarySceneRolloutDecision, 'eligible' | 'effectiveRoutePolicy'>,
): boolean => (
  decision.eligible
    && decision.effectiveRoutePolicy.mode === 'source-primary'
    && decision.effectiveRoutePolicy.inputOrigin === 'uploaded-file'
);
