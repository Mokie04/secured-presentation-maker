import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEndToEndValidatedScenePresentationForGeneration } from '../lib/endToEndSceneBoundary.ts';
import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import { buildEvidenceOutputEndToEndFixture } from './fixtures/endToEndValidationFixtures.ts';
import { validVisualPlanFixture } from './fixtures/visualTeachingComposerFixtures.ts';

const throwingComposer = async (): Promise<never> => {
  throw new Error('visual teaching composer must not run');
};

const failingComposer = async () => ({
  ok: false as const,
  diagnostics: [{
    code: 'visual_plan_contract_invalid' as const,
    severity: 'blocking' as const,
    message: 'Synthetic structured composition failure.',
  }],
  message: 'Synthetic structured composition failure.',
});

test('disabled composer delegates to exact existing behavior without calling the provider', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const existing = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.sourceManifest,
    fixture.storyboard,
    { title: 'Fixture' },
  );
  const disabled = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.sourceManifest,
    fixture.storyboard,
    {
      title: 'Fixture',
      visualComposer: {
        flagValue: 'false',
        language: 'EN',
        compose: throwingComposer,
      },
    },
  );

  assert.deepEqual(disabled, existing);
});

test('enabled source-primary composer runs once with classified source before semantic compilation', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  let calls = 0;
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.manifest,
    fixture.storyboard,
    {
      title: 'Fixture',
      visualComposer: {
        flagValue: 'true',
        language: 'EN',
        compose: async (input) => {
          calls += 1;
          assert.equal(input.manifest, fixture.manifest);
          assert.equal(input.storyboard, fixture.storyboard);
          assert.deepEqual(input.dispositions, fixture.dispositions);
          return { ok: true as const, plan: fixture.plan };
        },
      },
    },
  );

  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.presentation);
  assert.equal(
    (result.validationReport?.presentationQuality?.meaningfulVisualGrammarRatio ?? 0) >= 0.75,
    true,
  );
});

test('composition failure stops before generic scene delivery', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.manifest,
    fixture.storyboard,
    {
      title: 'Fixture',
      visualComposer: {
        flagValue: 'true',
        language: 'EN',
        compose: failingComposer,
      },
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal('presentation' in result, false);
  assert.equal(result.message.toLowerCase().includes('visual teaching composition'), true);
});

test('invalid composed plan stops at the hardened bridge before generic scene delivery', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const invalidPlan = structuredClone(fixture.plan);
  invalidPlan.provenance.sourceHash = 'foreign-source-hash';
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.manifest,
    fixture.storyboard,
    {
      title: 'Fixture',
      visualComposer: {
        flagValue: 'true',
        language: 'EN',
        compose: async () => ({ ok: true as const, plan: invalidPlan }),
      },
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal('presentation' in result, false);
  assert.equal(result.diagnostics.some((diagnostic) => (
    diagnostic.code === 'semantic_spec_contract_invalid'
  )), true);
});

test('legacy uploaded and topic-only routes never call the composer', async () => {
  const fixture = validVisualPlanFixture();
  const legacyPolicy = resolveK12GenerationRoutePolicy('uploaded source text', 'false');
  const topicOnlyPolicy = resolveK12GenerationRoutePolicy('', 'true');
  const options = {
    title: 'Fixture',
    visualComposer: {
      flagValue: 'true',
      language: 'EN' as const,
      compose: throwingComposer,
    },
  };

  const legacy = await resolveEndToEndValidatedScenePresentationForGeneration(
    legacyPolicy,
    'true',
    'true',
    'true',
    fixture.manifest,
    fixture.storyboard,
    options,
  );
  const topicOnly = await resolveEndToEndValidatedScenePresentationForGeneration(
    topicOnlyPolicy,
    'true',
    'true',
    'true',
    fixture.manifest,
    fixture.storyboard,
    options,
  );

  assert.deepEqual(legacy, { ok: true, presentation: null });
  assert.deepEqual(topicOnly, { ok: true, presentation: null });
});
