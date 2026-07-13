import assert from 'node:assert/strict';
import test from 'node:test';

import {
  composeVisualTeachingPlanWithProvider,
  type StructuredComposerRequest,
} from '../services/visualTeachingComposerService.ts';
import { visualComposerFixture } from './fixtures/visualTeachingComposerFixtures.ts';

const assertStrictObjectSchemas = (schema: unknown): void => {
  if (Array.isArray(schema)) {
    schema.forEach(assertStrictObjectSchemas);
    return;
  }
  if (!schema || typeof schema !== 'object') return;

  const record = schema as Record<string, unknown>;
  if (record.type === 'object') {
    assert.equal(record.additionalProperties, false);
  }
  Object.values(record).forEach(assertStrictObjectSchemas);
};

test('returns a validated provider plan with local provenance', async () => {
  const fixture = visualComposerFixture();
  const calls: StructuredComposerRequest[] = [];
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async (request) => {
    calls.push(request);
    return {
      value: {
        ...fixture.providerPlan,
        provenance: {
          sourceHash: 'provider-controlled-hash',
          storyboardVersion: 'provider-controlled-version',
          selectedUnitIds: ['provider-controlled-unit'],
          provider: 'provider-controlled-provider',
          model: 'provider-controlled-model',
        },
      },
      provider: 'fixture',
      model: 'fixture-model',
    };
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(calls.length, 1);
  assert.equal(result.plan.provenance.sourceHash, fixture.input.manifest.provenance.sourceHash);
  assert.equal(result.plan.provenance.storyboardVersion, fixture.input.storyboard.contractVersion);
  assert.deepEqual(result.plan.provenance.selectedUnitIds, fixture.input.storyboard.provenance.selectedUnitIds);
  assert.equal(result.plan.provenance.provider, 'fixture');
  assert.equal(result.plan.provenance.model, 'fixture-model');
  assert.equal(result.plan.scenes.some((scene) => scene.visualGrammar === 'relationship-diagram'), true);
});

test('uses version-isolated prompts and recursively strict object schemas', async () => {
  const fixture = visualComposerFixture();
  const calls: StructuredComposerRequest[] = [];
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async (request) => {
    calls.push(request);
    return { value: fixture.providerPlan, provider: 'fixture', model: 'fixture-model' };
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].prompt, /^visual-teaching-plan-v1\nprompt-schema-version: visual-teaching-composer-schema-v1\npurpose: compose\n/);
  assert.match(calls[0].prompt, /Create a coherent teaching arc; do not create one slide for every source row by default\./);
  assert.doesNotMatch(calls[0].prompt, /provider-controlled|api[_ -]?key|cache secret/i);
  assertStrictObjectSchemas(calls[0].responseSchema);
});

test('allows one repair call and validates the repaired plan from scratch', async () => {
  const fixture = visualComposerFixture();
  const calls: StructuredComposerRequest[] = [];
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async (request) => {
    calls.push(request);
    return {
      value: calls.length === 1 ? fixture.planWithoutRelationshipStep : fixture.providerPlan,
      provider: 'fixture',
      model: 'fixture-model',
    };
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.purpose), ['compose', 'repair']);
  assert.match(calls[1].prompt, /^visual-teaching-plan-v1\nprompt-schema-version: visual-teaching-composer-schema-v1\npurpose: repair\n/);
  assert.equal(result.ok, true);
});

test('sends only blocking diagnostic codes and messages to repair', async () => {
  const fixture = visualComposerFixture();
  const calls: StructuredComposerRequest[] = [];
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async (request) => {
    calls.push(request);
    return {
      value: calls.length === 1 ? fixture.planWithoutRelationshipStep : fixture.providerPlan,
      provider: 'fixture',
      model: 'fixture-model',
    };
  });

  assert.equal(result.ok, true);
  const diagnosticJson = calls[1].prompt
    .split('Blocking diagnostics (codes and messages only):\n')[1]
    .split('\nInvalid object:\n')[0];
  const diagnostics = JSON.parse(diagnosticJson) as Array<Record<string, unknown>>;
  assert.ok(diagnostics.length > 0);
  assert.deepEqual(Object.keys(diagnostics[0]).sort(), ['code', 'message']);
});

test('does not deliver a generic fallback after two invalid responses', async () => {
  const fixture = visualComposerFixture();
  let callCount = 0;
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async () => {
    callCount += 1;
    return { value: fixture.planWithoutRelationshipStep, provider: 'fixture', model: 'fixture-model' };
  });

  assert.equal(callCount, 2);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
  assert.match(result.message, /could not be validated/i);
});

test('repairs malformed provider output without trusting its runtime shape', async () => {
  const fixture = visualComposerFixture();
  let callCount = 0;
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async () => {
    callCount += 1;
    return {
      value: callCount === 1 ? { contractVersion: 'visual-teaching-plan-v1' } : fixture.providerPlan,
      provider: 'fixture',
      model: 'fixture-model',
    };
  });

  assert.equal(callCount, 2);
  assert.equal(result.ok, true);
});

test('stops after one repair when both provider objects are malformed', async () => {
  const fixture = visualComposerFixture();
  let callCount = 0;
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async () => {
    callCount += 1;
    return { value: null, provider: 'fixture', model: 'fixture-model' };
  });

  assert.equal(callCount, 2);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((item) => item.code === 'visual_plan_contract_invalid'), true);
});
