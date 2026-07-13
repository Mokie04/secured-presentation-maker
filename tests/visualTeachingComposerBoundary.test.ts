import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  resolveEndToEndValidatedScenePresentationForGeneration,
  shouldRunVisualTeachingComposer,
} from '../lib/endToEndSceneBoundary.ts';
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

const authorizationFailureMessage = 'Synthetic generation authorization failure.';

const inactiveAuthorization = {
  authorizeGeneration: (): never => {
    throw new Error('generation authorization must not run');
  },
  releaseGeneration: (): never => {
    throw new Error('generation release must not run');
  },
  authorizationFailureMessage,
};

test('requires the complete Gate 3 through Gate 5 chain before composer activation', () => {
  const sourcePrimary = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const legacy = resolveK12GenerationRoutePolicy('uploaded source text', 'false');
  const topicOnly = resolveK12GenerationRoutePolicy('', 'true');

  assert.equal(shouldRunVisualTeachingComposer(
    sourcePrimary,
    'true',
    'true',
    'true',
    'true',
  ), true);
  for (const values of [
    [sourcePrimary, 'false', 'true', 'true', 'true'],
    [sourcePrimary, 'true', 'false', 'true', 'true'],
    [sourcePrimary, 'true', 'true', 'false', 'true'],
    [sourcePrimary, 'true', 'true', 'true', 'false'],
    [legacy, 'true', 'true', 'true', 'true'],
    [topicOnly, 'true', 'true', 'true', 'true'],
  ] as const) {
    const [policy, composerFlag, semanticFlag, deckVisualFlag, endToEndFlag] = values;
    assert.equal(shouldRunVisualTeachingComposer(
      policy,
      composerFlag,
      semanticFlag,
      deckVisualFlag,
      endToEndFlag,
    ), false);
  }
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
        ...inactiveAuthorization,
      },
    },
  );

  assert.deepEqual(disabled, existing);
});

test('enabled source-primary composer runs once with classified source before semantic compilation', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  let calls = 0;
  const events: string[] = [];
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
          events.push('compose');
          assert.equal(input.manifest, fixture.manifest);
          assert.equal(input.storyboard, fixture.storyboard);
          assert.deepEqual(input.dispositions, fixture.dispositions);
          return { ok: true as const, plan: fixture.plan };
        },
        authorizeGeneration: () => {
          events.push('authorize');
          return true;
        },
        releaseGeneration: () => {
          events.push('release');
        },
        authorizationFailureMessage,
      },
    },
  );

  assert.equal(calls, 1);
  assert.deepEqual(events, ['authorize', 'compose']);
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
  const events: string[] = [];
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
        compose: async () => {
          events.push('compose');
          return failingComposer();
        },
        authorizeGeneration: () => {
          events.push('authorize');
          return true;
        },
        releaseGeneration: () => {
          events.push('release');
        },
        authorizationFailureMessage,
      },
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal('presentation' in result, false);
  assert.equal(result.message.toLowerCase().includes('visual teaching composition'), true);
  assert.deepEqual(events, ['authorize', 'compose', 'release']);
});

test('authorization failure prevents provider composition without releasing an unheld reservation', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const events: string[] = [];
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
        compose: async () => {
          events.push('compose');
          return { ok: true as const, plan: fixture.plan };
        },
        authorizeGeneration: () => {
          events.push('authorize');
          return false;
        },
        releaseGeneration: () => {
          events.push('release');
        },
        authorizationFailureMessage,
      },
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.message, authorizationFailureMessage);
  assert.deepEqual(events, ['authorize']);
});

test('provider exceptions release an authorized generation exactly once', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const events: string[] = [];
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
        compose: async () => {
          events.push('compose');
          throw new Error('Synthetic provider exception.');
        },
        authorizeGeneration: () => {
          events.push('authorize');
          return true;
        },
        releaseGeneration: () => {
          events.push('release');
        },
        authorizationFailureMessage,
      },
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(events, ['authorize', 'compose', 'release']);
});

test('invalid composed plan stops at the hardened bridge before generic scene delivery', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const invalidPlan = structuredClone(fixture.plan);
  invalidPlan.provenance.sourceHash = 'foreign-source-hash';
  const events: string[] = [];
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
        compose: async () => {
          events.push('compose');
          return { ok: true as const, plan: invalidPlan };
        },
        authorizeGeneration: () => {
          events.push('authorize');
          return true;
        },
        releaseGeneration: () => {
          events.push('release');
        },
        authorizationFailureMessage,
      },
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal('presentation' in result, false);
  assert.equal(result.diagnostics.some((diagnostic) => (
    diagnostic.code === 'semantic_spec_contract_invalid'
  )), true);
  assert.deepEqual(events, ['authorize', 'compose', 'release']);
});

test('source validation finishes before generation authorization', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const storyboard = structuredClone(fixture.storyboard);
  storyboard.provenance.sourceHash = 'foreign-source-hash';
  const events: string[] = [];
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.manifest,
    storyboard,
    {
      title: 'Fixture',
      visualComposer: {
        flagValue: 'true',
        language: 'EN',
        compose: async () => {
          events.push('compose');
          return { ok: true as const, plan: fixture.plan };
        },
        authorizeGeneration: () => {
          events.push('authorize');
          return true;
        },
        releaseGeneration: () => {
          events.push('release');
        },
        authorizationFailureMessage,
      },
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(events, []);
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
      ...inactiveAuthorization,
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

test('partial Gate 3 through Gate 5 activation delegates exactly without authorization or composition', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const lowQualityPlan = structuredClone(fixture.plan);
  for (const [index, title] of ['Learning Task 1', 'Learning Task (continued)'].entries()) {
    lowQualityPlan.scenes[index].learnerTitle = title;
  }

  for (const [semanticFlag, deckVisualFlag, endToEndFlag] of [
    ['false', 'true', 'true'],
    ['true', 'false', 'true'],
    ['true', 'true', 'false'],
  ] as const) {
    const existing = await resolveEndToEndValidatedScenePresentationForGeneration(
      policy,
      semanticFlag,
      deckVisualFlag,
      endToEndFlag,
      fixture.manifest,
      fixture.storyboard,
      { title: 'Fixture' },
    );
    let callbackCalls = 0;
    const partial = await resolveEndToEndValidatedScenePresentationForGeneration(
      policy,
      semanticFlag,
      deckVisualFlag,
      endToEndFlag,
      fixture.manifest,
      fixture.storyboard,
      {
        title: 'Fixture',
        visualComposer: {
          flagValue: 'true',
          language: 'EN',
          compose: async () => {
            callbackCalls += 1;
            return { ok: true as const, plan: lowQualityPlan };
          },
          authorizeGeneration: () => {
            callbackCalls += 1;
            return true;
          },
          releaseGeneration: () => {
            callbackCalls += 1;
          },
          authorizationFailureMessage,
        },
      },
    );

    assert.deepEqual(partial, existing);
    assert.equal(callbackCalls, 0);
  }
});

test('App wires quota authorization inside both composer options and skips a second increment', () => {
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

  assert.equal((appSource.match(/visualComposer:\s*{/g) ?? []).length, 2);
  assert.equal((appSource.match(/authorizeGeneration:\s*\(\)\s*=>/g) ?? []).length, 2);
  assert.equal((appSource.match(/releaseGeneration:\s*\(\)\s*=>/g) ?? []).length, 2);
  assert.equal((appSource.match(/authorizationFailureMessage:\s*t\.presentation\.errorGenerationLimit/g) ?? []).length, 2);
  assert.equal((appSource.match(/visualComposerGenerationReserved\s*\|\|\s*adminGenerationLimitBypassed\s*\|\|\s*tryIncrementCount\('generations'\)/g) ?? []).length, 2);
});
