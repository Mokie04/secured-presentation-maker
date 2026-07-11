import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import {
  buildSemanticSlideSpecs,
  formatSemanticSlideDiagnostics,
  isSemanticSlidesV1Enabled,
  resolveSemanticScenePresentationForGeneration,
  validateSemanticSlideSpecs,
} from '../lib/semanticSlideSpec.ts';
import {
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
  MULTI_OBJECTIVE_STORYBOARD,
  TEACHER_SCRIPT_STORYBOARD,
} from './fixtures/semanticSlideFixtures.ts';

test('accepts only documented true-like Gate 3 flag values', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(isSemanticSlidesV1Enabled(value), true);
  }
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) {
    assert.equal(isSemanticSlidesV1Enabled(value), false);
  }
});

test('builds stable semantic slide specs from storyboard screens', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.specs.map((spec) => spec.id), ['semslide-001', 'semslide-002', 'semslide-003']);
  assert.deepEqual(
    result.specs.map((spec) => spec.storyboardScreenId),
    EVIDENCE_OUTPUT_STORYBOARD.screens.map((screen) => screen.id),
  );
});

test('preserves source-step and source-objective mapping from storyboard screens', () => {
  const result = buildSemanticSlideSpecs(MULTI_OBJECTIVE_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const spec of result.specs) {
    const screen = MULTI_OBJECTIVE_STORYBOARD.screens.find((item) => item.id === spec.storyboardScreenId);
    assert.ok(screen);
    assert.deepEqual(spec.sourceStepIds, screen.sourceStepIds);
    assert.deepEqual(spec.sourceObjectiveIds, screen.sourceObjectiveIds);
  }
});

test('selects semantic layouts for at least 80 percent of non-title instructional specs', () => {
  const result = buildSemanticSlideSpecs(FIVE_SESSION_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const instructional = result.specs.filter((spec) => spec.intent !== 'title-context');
  const semanticCount = instructional.filter((spec) => spec.layoutId !== 'generic-bullets').length;
  assert.equal(semanticCount / instructional.length >= 0.8, true);
});

test('maps evidence and output storyboard screens to evidence or exit layouts', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.specs.some((spec) => spec.layoutId === 'evidence-capture-board'));
  assert.ok(result.specs.some((spec) => spec.layoutId === 'exit-ticket-card'));
});

test('keeps teacher-script out of visible semantic slots', () => {
  const result = buildSemanticSlideSpecs(TEACHER_SCRIPT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visible = JSON.stringify(result.specs.map((spec) => spec.slots));
  assert.doesNotMatch(visible, /the teacher will ask learners/i);
});

test('rejects semantic specs with missing storyboard mappings', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = [{ ...result.specs[0], storyboardScreenId: 'screen-999' }, ...result.specs.slice(1)];
  const diagnostics = validateSemanticSlideSpecs(invalid, EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_storyboard_mapping_invalid'), true);
  assert.match(formatSemanticSlideDiagnostics(diagnostics), /storyboard/i);
});

test('rejects omitted storyboard screen mappings', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const diagnostics = validateSemanticSlideSpecs(result.specs.slice(1), EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_storyboard_mapping_invalid'), true);
});

test('rejects duplicate non-adjacent storyboard screen mappings', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const duplicate = {
    ...result.specs[0],
    id: 'semslide-999',
  };
  const invalid = [result.specs[0], result.specs[1], duplicate, result.specs[2]];
  const diagnostics = validateSemanticSlideSpecs(invalid, EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_storyboard_mapping_invalid'), true);
});

test('rejects out-of-order storyboard screen mappings', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const diagnostics = validateSemanticSlideSpecs([...result.specs].reverse(), EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_storyboard_mapping_invalid'), true);
});

test('allows adjacent continuation specs only when source mappings match', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const continuation = {
    ...result.specs[1],
    id: 'semslide-002b',
    slots: {
      ...result.specs[1].slots,
      body: { kind: 'list' as const, items: ['Continuation content from the same source step.'] },
    },
  };
  const diagnostics = validateSemanticSlideSpecs(
    [result.specs[0], result.specs[1], continuation, result.specs[2]],
    EVIDENCE_OUTPUT_STORYBOARD,
  );

  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_storyboard_mapping_invalid'), false);
});

test('rejects semantic specs with changed source-step ownership', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = [{ ...result.specs[1], sourceStepIds: ['step-999'] }, ...result.specs.slice(1)];
  const diagnostics = validateSemanticSlideSpecs(invalid, EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_source_step_mismatch'), true);
});

test('rejects semantic specs with changed objective ownership', () => {
  const result = buildSemanticSlideSpecs(MULTI_OBJECTIVE_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const objectiveSpecIndex = result.specs.findIndex((spec) => spec.sourceObjectiveIds.length > 0);
  assert.notEqual(objectiveSpecIndex, -1);
  const invalid = result.specs.map((spec, index) => index === objectiveSpecIndex
    ? { ...spec, sourceObjectiveIds: [...spec.sourceObjectiveIds].reverse() }
    : spec);
  const diagnostics = validateSemanticSlideSpecs(invalid, MULTI_OBJECTIVE_STORYBOARD);

  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_objective_mismatch'), true);
});

test('rejects low semantic-layout coverage', () => {
  const result = buildSemanticSlideSpecs(FIVE_SESSION_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = result.specs.map((spec) => spec.intent === 'title-context' ? spec : { ...spec, layoutId: 'generic-bullets' as const });
  const diagnostics = validateSemanticSlideSpecs(invalid, FIVE_SESSION_STORYBOARD);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_generic_layout_coverage_low'), true);
});

test('Gate 3 builder emits no asset requests unless Gate 4 adds them', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.specs.every((spec) => spec.assetRequests.length === 0), true);
});

test('semantic scene route is source-primary and flag gated', () => {
  const sourcePolicy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const topicPolicy = resolveK12GenerationRoutePolicy('', 'true');

  assert.deepEqual(
    resolveSemanticScenePresentationForGeneration(topicPolicy, 'true', EVIDENCE_OUTPUT_STORYBOARD, { title: 'Fixture' }),
    { ok: true, presentation: null },
  );
  assert.deepEqual(
    resolveSemanticScenePresentationForGeneration(sourcePolicy, 'false', EVIDENCE_OUTPUT_STORYBOARD, { title: 'Fixture' }),
    { ok: true, presentation: null },
  );
  const enabled = resolveSemanticScenePresentationForGeneration(sourcePolicy, 'true', EVIDENCE_OUTPUT_STORYBOARD, { title: 'Fixture' });
  assert.equal(enabled.ok, true);
  if (!enabled.ok) return;
  assert.ok(enabled.presentation);
});

test('semantic scene route blocks enabled source-primary routes without a storyboard', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const boundary = resolveSemanticScenePresentationForGeneration(policy, 'true', null, { title: 'Fixture' });

  assert.equal(boundary.ok, false);
  if (boundary.ok) return;
  assert.match(boundary.message, /storyboard/i);
});
