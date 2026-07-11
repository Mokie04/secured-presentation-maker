import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGenerationCacheKey } from '../lib/generationCache.ts';
import {
  SOURCE_PRIMARY_ROUTE_SCOPE,
  loadReusableSeedWhenAllowed,
  resolveK12GenerationRoutePolicy,
} from '../lib/k12GenerationRoutePolicy.ts';
import { SANITIZED_SEED_SIGNAL_UPLOAD } from './fixtures/k12RouteInputs.ts';

const LEGACY_CACHE_PARTS = [
  'lesson-plan-cache-v38',
  SANITIZED_SEED_SIGNAL_UPLOAD,
  'K-12',
  'EN',
];

test('routes an uploaded lesson plan to source-primary when the flag is enabled', () => {
  const policy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'true');

  assert.deepEqual(policy, {
    inputOrigin: 'uploaded-file',
    mode: 'source-primary',
    allowReusableSeeds: false,
    cacheKeyParts: [SOURCE_PRIMARY_ROUTE_SCOPE],
  });
});

test('keeps uploaded lesson plans on the exact legacy policy when the flag is disabled or unset', () => {
  for (const flagValue of [undefined, '', 'false', '0', 'off']) {
    const policy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, flagValue);

    assert.equal(policy.inputOrigin, 'uploaded-file');
    assert.equal(policy.mode, 'legacy');
    assert.equal(policy.allowReusableSeeds, true);
    assert.deepEqual(policy.cacheKeyParts, []);
  }
});

test('keeps whitespace-only upload content on the topic-only legacy route', () => {
  const policy = resolveK12GenerationRoutePolicy('  \n\t ', 'true');

  assert.deepEqual(policy, {
    inputOrigin: 'topic-only',
    mode: 'legacy',
    allowReusableSeeds: true,
    cacheKeyParts: [],
  });
});

test('accepts only documented case-insensitive true-like flag values', () => {
  for (const flagValue of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(
      resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, flagValue).mode,
      'source-primary',
    );
  }
});

test('isolates enabled uploaded cache keys while preserving the legacy key when disabled', async () => {
  const sourcePolicy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'true');
  const disabledUploadPolicy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'false');
  const topicPolicy = resolveK12GenerationRoutePolicy('', 'true');

  const oldUnscopedKey = await buildGenerationCacheKey('k12-lesson-plan', LEGACY_CACHE_PARTS);
  const enabledUploadKey = await buildGenerationCacheKey('k12-lesson-plan', [
    LEGACY_CACHE_PARTS[0],
    ...sourcePolicy.cacheKeyParts,
    ...LEGACY_CACHE_PARTS.slice(1),
  ]);
  const disabledUploadKey = await buildGenerationCacheKey('k12-lesson-plan', [
    LEGACY_CACHE_PARTS[0],
    ...disabledUploadPolicy.cacheKeyParts,
    ...LEGACY_CACHE_PARTS.slice(1),
  ]);
  const identicalTopicOnlyKey = await buildGenerationCacheKey('k12-lesson-plan', [
    LEGACY_CACHE_PARTS[0],
    ...topicPolicy.cacheKeyParts,
    ...LEGACY_CACHE_PARTS.slice(1),
  ]);

  assert.notEqual(enabledUploadKey, oldUnscopedKey);
  assert.equal(disabledUploadKey, oldUnscopedKey);
  assert.equal(identicalTopicOnlyKey, oldUnscopedKey);
});

test('does not invoke a reusable-seed loader on the source-primary route', async () => {
  const policy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'true');
  let callCount = 0;

  const result = await loadReusableSeedWhenAllowed(policy, () => {
    callCount += 1;
    return { id: 'must-not-load' };
  });

  assert.equal(result, null);
  assert.equal(callCount, 0);
});

test('invokes a reusable-seed loader exactly once on the legacy route', async () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  let callCount = 0;

  const result = await loadReusableSeedWhenAllowed(policy, async () => {
    callCount += 1;
    return { id: 'legacy-seed' };
  });

  assert.deepEqual(result, { id: 'legacy-seed' });
  assert.equal(callCount, 1);
});

test('preserves reusable-seed loader failures on the legacy route', async () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  const expectedError = new Error('seed load failed');

  await assert.rejects(
    loadReusableSeedWhenAllowed(policy, async () => {
      throw expectedError;
    }),
    expectedError,
  );
});
