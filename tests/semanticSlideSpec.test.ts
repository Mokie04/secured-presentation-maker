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
  DENSE_STORYBOARD,
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
  assert.deepEqual(
    result.specs.map((spec) => spec.storyboardScreenIds),
    EVIDENCE_OUTPUT_STORYBOARD.screens.map((screen) => [screen.id]),
  );
});

test('legacy semantic builder behavior is unchanged apart from explicit screen provenance', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const spec of result.specs) {
    assert.deepEqual(spec.storyboardScreenIds, [spec.storyboardScreenId]);
    assert.deepEqual(spec.sourceFieldIds, []);
    assert.equal(spec.visualGrammar, undefined);
    assert.equal(spec.visualAssetBrief, undefined);
  }
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

test('compacts repeated learning-target text without losing success-criteria provenance', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const targetSpec = result.specs.find((spec) => spec.storyboardScreenId === 'screen-001');
  assert.ok(targetSpec);
  const body = targetSpec.slots.body;
  const successCriteria = targetSpec.slots.successCriteria;
  assert.equal(body.kind, 'list');
  assert.equal(successCriteria.kind, 'list');
  assert.deepEqual(body.items, []);
  assert.deepEqual(successCriteria.items, ['EO-OBJ-A Use observations to support a claim.']);
});

test('retains combined evidence, output, and success-criteria provenance for repeated text', () => {
  const repeatedText = 'EO-OUTPUT-A Submit a conclusion that uses the recorded evidence.';
  const storyboard = {
    ...EVIDENCE_OUTPUT_STORYBOARD,
    screens: EVIDENCE_OUTPUT_STORYBOARD.screens.map((screen) => screen.id === 'screen-003'
      ? {
          ...screen,
          learnerContent: {
            ...screen.learnerContent,
            successCriteria: [repeatedText],
          },
        }
      : screen),
  };
  const result = buildSemanticSlideSpecs(storyboard);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const spec = result.specs.find((item) => item.storyboardScreenId === 'screen-003');
  assert.ok(spec);
  const requirements = spec.slots.requirements;
  assert.equal(requirements.kind, 'list');
  assert.deepEqual(requirements.items, [`Evidence/output/success criterion: ${repeatedText}`]);
});

test('keeps teacher-script out of visible semantic slots', () => {
  const result = buildSemanticSlideSpecs(TEACHER_SCRIPT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visible = JSON.stringify(result.specs.map((spec) => spec.slots));
  assert.doesNotMatch(visible, /the teacher will ask learners/i);
});

test('splits dense storyboard screens into adjacent source-bound continuation specs', () => {
  const result = buildSemanticSlideSpecs(DENSE_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.specs.length >= DENSE_STORYBOARD.screens.length, true);
  assert.equal(result.specs.length <= DENSE_STORYBOARD.screens.length * 2 + 2, true);

  for (const screen of DENSE_STORYBOARD.screens) {
    const indices = result.specs
      .map((spec, index) => spec.storyboardScreenId === screen.id ? index : -1)
      .filter((index) => index >= 0);
    assert.equal(indices.length >= 1, true);
    assert.equal(indices.length <= 3, true);
    assert.deepEqual(indices, Array.from({ length: indices.length }, (_, index) => indices[0] + index));
    for (const index of indices) {
      assert.deepEqual(result.specs[index].sourceStepIds, screen.sourceStepIds);
      assert.deepEqual(result.specs[index].sourceObjectiveIds, screen.sourceObjectiveIds);
    }

    const screenSpecs = indices.map((index) => result.specs[index]);
    const expectedBody = [...new Set([
      screen.learnerContent.prompt,
      screen.learnerContent.task,
      ...screen.learnerContent.questions,
      ...screen.learnerContent.directions,
    ].filter((value): value is string => Boolean(value)).map((value) => value.replace(/\s+/g, ' ').trim()))];
    const expectedRequirements = [...screen.requiredEvidence, ...screen.requiredOutputs]
      .map((value) => value.replace(/\s+/g, ' ').trim());
    const expectedSuccess = screen.learnerContent.successCriteria
      .map((value) => value.replace(/\s+/g, ' ').trim());
    const expectedContent = [...new Set([...expectedBody, ...expectedRequirements, ...expectedSuccess])].join(' ');
    const actualContent = screenSpecs.flatMap((spec) => ['body', 'requirements', 'successCriteria'].flatMap((slotName) => {
      const slot = spec.slots[slotName];
      return slot?.kind === 'list'
        ? slot.items.map((item) => item.replace(/^(?:Evidence\/output|Evidence|Output):\s*/i, ''))
        : [];
    })).join(' ');
    assert.equal(actualContent, expectedContent);
  }

  assert.deepEqual(
    result.specs.map((spec) => spec.id),
    result.specs.map((_, index) => `semslide-${String(index + 1).padStart(3, '0')}`),
  );
  const visibleSlots = JSON.stringify(result.specs.map((spec) => spec.slots));
  for (const sentinel of ['first source-backed observation', 'limitation in each alternative', 'provided evidence record', 'required output']) {
    assert.match(visibleSlots, new RegExp(sentinel, 'i'));
  }
  assert.doesNotMatch(visibleSlots, /the teacher\s+(?:will\s+)?[a-z]+/i);
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

test('rejects multiple storyboard screens unless they are contiguous with exact merged provenance', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const merged = {
    ...result.specs[0],
    storyboardScreenIds: ['screen-001', 'screen-003'],
    sourceStepIds: [
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[0].sourceStepIds,
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[2].sourceStepIds,
    ],
    sourceObjectiveIds: [
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[0].sourceObjectiveIds,
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[2].sourceObjectiveIds,
    ],
  };
  const diagnostics = validateSemanticSlideSpecs([merged, ...result.specs.slice(1)], EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(diagnostics.some((item) => item.code === 'semantic_spec_storyboard_mapping_invalid'), true);
});

test('rejects overlapping storyboard groups unless they are exact adjacent continuations', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const merged = {
    ...result.specs[0],
    storyboardScreenIds: ['screen-001', 'screen-002'],
    sourceStepIds: [
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[0].sourceStepIds,
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[1].sourceStepIds,
    ],
    sourceObjectiveIds: [
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[0].sourceObjectiveIds,
      ...EVIDENCE_OUTPUT_STORYBOARD.screens[1].sourceObjectiveIds,
    ],
  };
  const diagnostics = validateSemanticSlideSpecs([merged, result.specs[1], result.specs[2]], EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(diagnostics.some((item) => item.code === 'semantic_spec_storyboard_mapping_invalid'), true);
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
