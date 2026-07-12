import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import {
  buildDeckVisualSystems,
  isDeckVisualSystemV1Enabled,
  validateDeckVisualSystem,
} from '../lib/deckVisualSystem.ts';
import { resolveDeckVisualScenePresentationForGeneration } from '../lib/deckVisualSceneBoundary.ts';
import { resolveSemanticScenePresentationForGeneration } from '../lib/semanticSlideSpec.ts';
import {
  EVIDENCE_OUTPUT_VISUAL_FIXTURE,
  FIVE_SESSION_VISUAL_FIXTURE,
  MULTI_OBJECTIVE_VISUAL_FIXTURE,
} from './fixtures/deckVisualSystemFixtures.ts';

test('accepts only documented true-like Gate 4 flag values', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(isDeckVisualSystemV1Enabled(value), true);
  }
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) {
    assert.equal(isDeckVisualSystemV1Enabled(value), false);
  }
});

test('builds one validated visual system per selected source unit', () => {
  const result = buildDeckVisualSystems(
    FIVE_SESSION_VISUAL_FIXTURE.storyboard,
    FIVE_SESSION_VISUAL_FIXTURE.specs,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.bundle.systemsByUnitId), ['unit-001', 'unit-002', 'unit-003', 'unit-004', 'unit-005']);
  for (const system of Object.values(result.bundle.systemsByUnitId)) {
    assert.deepEqual(validateDeckVisualSystem(system), []);
  }
});

test('is deterministic for the same storyboard and specs', () => {
  const first = buildDeckVisualSystems(EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard, EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs);
  const second = buildDeckVisualSystems(EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard, EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs);

  assert.deepEqual(first, second);
});

test('assigns the same semantic color to repeated concepts', () => {
  const result = buildDeckVisualSystems(
    MULTI_OBJECTIVE_VISUAL_FIXTURE.storyboard,
    MULTI_OBJECTIVE_VISUAL_FIXTURE.specs,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const system = result.bundle.systemsByUnitId['unit-001'];
  const concept = system.semanticColors['objective:obj-001'];
  assert.ok(concept);
  assert.equal(system.semanticColors['objective:obj-001'].color, concept.color);
});

test('rejects visual systems with insufficient contrast', () => {
  const result = buildDeckVisualSystems(EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard, EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const system = Object.values(result.bundle.systemsByUnitId)[0];
  const invalid = {
    ...system,
    palette: { ...system.palette, ink: 'FFFFFF', background: 'FFFFFF' },
  };

  const diagnostics = validateDeckVisualSystem(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'visual_system_contrast_failed'), true);
});

test('delegates to exact Gate 3 scene behavior when Gate 4 flag is disabled', async () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const gate3 = resolveSemanticScenePresentationForGeneration(
    policy,
    'true',
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    { title: 'Fixture Deck' },
  );
  const gate4Disabled = await resolveDeckVisualScenePresentationForGeneration(
    policy,
    'true',
    'false',
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    { title: 'Fixture Deck' },
  );

  assert.deepEqual(gate4Disabled, gate3);
});

test('returns no scene for topic-only routes even when Gate 4 flag is enabled', async () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  const boundary = await resolveDeckVisualScenePresentationForGeneration(
    policy,
    'true',
    'true',
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    { title: 'Fixture Deck' },
  );

  assert.deepEqual(boundary, { ok: true, presentation: null });
});

test('builds visual systems before compiling source-primary Gate 4 scenes', async () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const boundary = await resolveDeckVisualScenePresentationForGeneration(
    policy,
    'true',
    'true',
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    { title: 'Fixture Deck' },
  );

  assert.equal(boundary.ok, true);
  if (!boundary.ok) return;
  assert.ok(boundary.presentation);
  assert.ok(boundary.visualSystems);
  assert.deepEqual(Object.keys(boundary.visualSystems.systemsByUnitId), ['unit-001']);
});

test('blocks validation failures before asset adapters run', async () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  let adapterCalls = 0;
  const boundary = await resolveDeckVisualScenePresentationForGeneration(
    policy,
    'true',
    'true',
    null,
    {
      title: 'Fixture Deck',
      adapters: {
        resolveBundledIcon: async () => {
          adapterCalls += 1;
          return null;
        },
      },
    },
  );

  assert.equal(boundary.ok, false);
  assert.equal(adapterCalls, 0);
});
