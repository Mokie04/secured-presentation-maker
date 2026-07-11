import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import { resolveEndToEndValidatedScenePresentationForGeneration } from '../lib/endToEndSceneBoundary.ts';
import { resolveSourceManifestForGeneration } from '../lib/lessonSourceManifest.ts';
import { resolveTeachingStoryboardForGeneration } from '../lib/teachingStoryboard.ts';
import {
  getSourcePrimarySceneCanaryBucket,
  parseSourcePrimarySceneRolloutStage,
  resolveSourcePrimarySceneRolloutEligibility,
  resolveSourcePrimarySceneRolloutForGeneration,
  shouldRunSourcePrimaryScenePreflight,
} from '../lib/sourcePrimarySceneRollout.ts';

test('parses Gate 6 rollout stages with safe off defaults', () => {
  for (const value of [undefined, '', '0', 'false', 'off', 'unexpected', '  FALSE  ']) {
    assert.equal(parseSourcePrimarySceneRolloutStage(value), 'off');
  }

  assert.equal(parseSourcePrimarySceneRolloutStage('internal'), 'internal');
  assert.equal(parseSourcePrimarySceneRolloutStage('beta'), 'beta');
  assert.equal(parseSourcePrimarySceneRolloutStage('5'), 'canary-5');
  assert.equal(parseSourcePrimarySceneRolloutStage('5%'), 'canary-5');
  assert.equal(parseSourcePrimarySceneRolloutStage('canary-5'), 'canary-5');
  assert.equal(parseSourcePrimarySceneRolloutStage('25'), 'canary-25');
  assert.equal(parseSourcePrimarySceneRolloutStage('25%'), 'canary-25');
  assert.equal(parseSourcePrimarySceneRolloutStage('canary-25'), 'canary-25');
  assert.equal(parseSourcePrimarySceneRolloutStage('100'), 'all');
  assert.equal(parseSourcePrimarySceneRolloutStage('100%'), 'all');
  assert.equal(parseSourcePrimarySceneRolloutStage('all'), 'all');
});

test('keeps topic-only and legacy routes unchanged for Gate 6 rollout', () => {
  const topicPolicy = resolveK12GenerationRoutePolicy('', 'true');
  const legacyPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'false');

  for (const policy of [topicPolicy, legacyPolicy]) {
    const decision = resolveSourcePrimarySceneRolloutEligibility(policy, 'all', {});
    assert.equal(decision.eligible, false);
    assert.equal(decision.reason, 'route_not_source_primary_uploaded');
    assert.deepEqual(decision.originalRoutePolicy, policy);
    assert.deepEqual(decision.effectiveRoutePolicy, policy);
    assert.equal(shouldRunSourcePrimaryScenePreflight(decision), false);
  }
});

test('falls back to effective legacy route before source manifest and storyboard preflight', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');

  for (const decision of [
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'off', {}),
    resolveSourcePrimarySceneRolloutForGeneration('k12-single-lesson', originalPolicy, 'malformed', {}),
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'internal', { isAdmin: false }),
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'beta', { optedInToSourcePrimaryScenes: false }),
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'canary-5', {}),
  ]) {
    assert.equal(decision.eligible, false);
    assert.deepEqual(decision.originalRoutePolicy, originalPolicy);
    assert.deepEqual(decision.effectiveRoutePolicy, {
      inputOrigin: 'uploaded-file',
      mode: 'legacy',
      allowReusableSeeds: true,
      cacheKeyParts: [],
    });
    assert.equal(shouldRunSourcePrimaryScenePreflight(decision), false);

    const manifestBoundary = resolveSourceManifestForGeneration(decision.effectiveRoutePolicy, null);
    assert.deepEqual(manifestBoundary, { ok: true, manifest: null });

    const storyboardBoundary = resolveTeachingStoryboardForGeneration(
      decision.effectiveRoutePolicy,
      null,
      null,
    );
    assert.deepEqual(storyboardBoundary, { ok: true, storyboard: null });
  }
});

test('internal, beta, and all stages keep source-primary route only for eligible users', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');

  for (const decision of [
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'internal', { isAdmin: true }),
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'beta', { optedInToSourcePrimaryScenes: true }),
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'all', {}),
  ]) {
    assert.equal(decision.eligible, true);
    assert.deepEqual(decision.originalRoutePolicy, originalPolicy);
    assert.deepEqual(decision.effectiveRoutePolicy, originalPolicy);
    assert.equal(shouldRunSourcePrimaryScenePreflight(decision), true);

    const manifestBoundary = resolveSourceManifestForGeneration(decision.effectiveRoutePolicy, null);
    assert.equal(manifestBoundary.ok, false);
  }
});

test('canary stages require deterministic bucket and a safe stable seed', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');
  let inBucketSeed = '';
  let outOfBucketSeed = '';

  for (let index = 0; index < 300; index += 1) {
    const seed = `source-hash-${String(index).padStart(3, '0')}`;
    const bucket = getSourcePrimarySceneCanaryBucket(seed);
    if (!inBucketSeed && bucket < 5) inBucketSeed = seed;
    if (!outOfBucketSeed && bucket >= 25) outOfBucketSeed = seed;
    if (inBucketSeed && outOfBucketSeed) break;
  }

  assert.ok(inBucketSeed);
  assert.ok(outOfBucketSeed);

  const inBucket = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'canary-5', {
    stableBucketSeed: inBucketSeed,
  });
  assert.equal(inBucket.eligible, true);
  assert.equal(inBucket.reason, 'canary_in_bucket');
  assert.deepEqual(inBucket.effectiveRoutePolicy, originalPolicy);

  const outBucket = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'canary-25', {
    stableBucketSeed: outOfBucketSeed,
  });
  assert.equal(outBucket.eligible, false);
  assert.equal(outBucket.reason, 'canary_out_of_bucket');
  assert.equal(outBucket.effectiveRoutePolicy.mode, 'legacy');

  const missingSeed = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'canary-5', {});
  assert.equal(missingSeed.eligible, false);
  assert.equal(missingSeed.reason, 'missing_stable_bucket_seed');
  assert.equal(missingSeed.effectiveRoutePolicy.mode, 'legacy');

  const unsafeSeed = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'canary-5', {
    stableBucketSeed: 'The teacher will ask learners to copy the private lesson objective.',
  });
  assert.equal(unsafeSeed.eligible, false);
  assert.equal(unsafeSeed.reason, 'missing_stable_bucket_seed');
});

test('single lesson and daily unit flows use the same effective-route decision helper', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');
  const singleDecision = resolveSourcePrimarySceneRolloutForGeneration(
    'k12-single-lesson',
    originalPolicy,
    'off',
    {},
  );
  const dailyDecision = resolveSourcePrimarySceneRolloutForGeneration(
    'k12-daily-unit',
    originalPolicy,
    'off',
    {},
  );

  assert.equal(singleDecision.flow, 'k12-single-lesson');
  assert.equal(dailyDecision.flow, 'k12-daily-unit');
  assert.deepEqual(singleDecision.effectiveRoutePolicy, dailyDecision.effectiveRoutePolicy);
  assert.equal(singleDecision.effectiveRoutePolicy.mode, 'legacy');
});

test('ineligible decisions preserve legacy cache, quota, seed, AI, image, and delivery ordering inputs', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');
  const decision = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'beta', {
    optedInToSourcePrimaryScenes: false,
  });

  assert.equal(decision.effectiveRoutePolicy.inputOrigin, 'uploaded-file');
  assert.equal(decision.effectiveRoutePolicy.mode, 'legacy');
  assert.equal(decision.effectiveRoutePolicy.allowReusableSeeds, true);
  assert.deepEqual(decision.effectiveRoutePolicy.cacheKeyParts, []);
});

test('eligible source-primary decisions still enter lower-gate validation boundaries', async () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');
  const decision = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'all', {});

  assert.equal(shouldRunSourcePrimaryScenePreflight(decision), true);
  assert.equal(resolveSourceManifestForGeneration(decision.effectiveRoutePolicy, null).ok, false);

  const sceneBoundary = await resolveEndToEndValidatedScenePresentationForGeneration(
    decision.effectiveRoutePolicy,
    'true',
    'true',
    'true',
    null,
    null,
    { title: 'Sanitized Gate 6 Boundary Test' },
  );
  assert.equal(sceneBoundary.ok, false);
});
