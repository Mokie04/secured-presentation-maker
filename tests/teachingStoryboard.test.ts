import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import { buildLessonSourceManifest } from '../lib/lessonSourceManifest.ts';
import {
  buildTeachingStoryboard,
  detectVisibleTeacherScript,
  formatStoryboardDiagnostics,
  hasBlockingStoryboardDiagnostics,
  resolveTeachingStoryboardForGeneration,
  validateTeachingStoryboard,
} from '../lib/teachingStoryboard.ts';
import {
  FIVE_SESSION_MATRIX_DOCUMENT,
  MISSING_AND_BLANK_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
  UI_FLATTENED_MULTI_TABLE_DOCUMENT,
} from './fixtures/lessonSourceManifestFixtures.ts';
import {
  EVIDENCE_OUTPUT_DOCUMENT,
  TEACHER_SCRIPT_DOCUMENT,
} from './fixtures/teachingStoryboardFixtures.ts';

const manifestFrom = (document: Parameters<typeof buildLessonSourceManifest>[0]) => {
  const result = buildLessonSourceManifest(document);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('fixture manifest failed');
  return result.manifest;
};

test('accounts for 100 percent of selected source steps', () => {
  const manifest = manifestFrom(FIVE_SESSION_MATRIX_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const sourceStepIds = manifest.units.flatMap((unit) => unit.steps.map((step) => step.id));
  assert.equal(result.storyboard.sourceStepAccounting.length, sourceStepIds.length);
  assert.deepEqual(
    result.storyboard.sourceStepAccounting.map((entry) => entry.sourceStepId).sort(),
    sourceStepIds.sort(),
  );
  assert.equal(result.storyboard.sourceStepAccounting.every((entry) => entry.status === 'screened'), true);
});

test('preserves objective count, source order, and unit ownership', () => {
  const manifest = manifestFrom(MULTI_OBJECTIVE_UNIT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(
    result.storyboard.objectives.map((objective) => objective.sourceObjectiveId),
    manifest.objectives.map((objective) => objective.id),
  );
  assert.deepEqual(
    result.storyboard.objectives.map((objective) => objective.unitId),
    manifest.objectives.map((objective) => objective.unitId),
  );
  assert.equal(result.storyboard.objectives.length, 3);
});

test('preserves source-step order without inversions', () => {
  const manifest = manifestFrom(FIVE_SESSION_MATRIX_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const sourceOrderByStepId = new Map(
    manifest.units.flatMap((unit) => unit.steps.map((step) => [step.id, step.sourceOrder] as const)),
  );
  const screenOrders = result.storyboard.screens
    .filter((screen) => screen.sourceStepIds.length > 0)
    .map((screen) => Math.min(...screen.sourceStepIds.map((id) => sourceOrderByStepId.get(id) ?? Number.POSITIVE_INFINITY)));
  assert.deepEqual(screenOrders, [...screenOrders].sort((a, b) => a - b));
});

test('removes visible teacher-script while retaining source action in notes', () => {
  const manifest = manifestFrom(TEACHER_SCRIPT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const visibleText = result.storyboard.screens
    .map((screen) => [
      screen.learnerTitle,
      screen.learnerContent.prompt,
      screen.learnerContent.task,
      ...screen.learnerContent.directions,
      ...screen.requiredEvidence,
      ...screen.requiredOutputs,
    ].join(' '))
    .join('\n');
  assert.equal(detectVisibleTeacherScript(visibleText), false);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /teacher will ask learners/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /teacher will guide the learners/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /Teacher will model/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /The teacher checks learners draft claims/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /The teacher clarifies the comparison pattern/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /The teacher presents a sanitized model/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /The teacher reviews the exit response checklist/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /The teacher restates the comparison goal/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /The teacher reviews the key pattern/i);
  assert.match(visibleText, /Compare two sanitized evidence cards/);
  assert.match(visibleText, /Explain one evidence choice/);
  assert.match(visibleText, /Check learners draft claims for evidence/);
  assert.match(visibleText, /Clarify the comparison pattern with one sanitized example/);
  assert.match(visibleText, /Inspect a sanitized model/);
  assert.match(visibleText, /Review the exit response checklist/);
  assert.match(visibleText, /Restate the comparison goal with sanitized circuit cards/);
  assert.match(visibleText, /Use the comparison chart first\. Review the key pattern with sanitized labels/);
});

test('normalizes browser-flattened objectives and scaffold rows into learner-facing screens', () => {
  const manifest = manifestFrom(UI_FLATTENED_MULTI_TABLE_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const visibleText = result.storyboard.screens
    .map((screen) => [
      screen.learnerTitle,
      screen.learnerContent.prompt,
      screen.learnerContent.task,
      ...screen.learnerContent.directions,
      ...screen.learnerContent.successCriteria,
    ].join(' '))
    .join('\n');
  assert.equal(detectVisibleTeacherScript(visibleText), false);
  assert.doesNotMatch(visibleText, /learners will/i);
  assert.match(visibleText, /you will compare two source-backed observations/i);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /The teacher checks the first source record/i);
});

test('attaches required evidence and outputs to source-backed screens', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const evidenceScreen = result.storyboard.screens.find((screen) => screen.requiredEvidence.join(' ').includes('EO-EVIDENCE-A'));
  const outputScreen = result.storyboard.screens.find((screen) => screen.requiredOutputs.join(' ').includes('EO-OUTPUT-A'));
  assert.ok(evidenceScreen);
  assert.ok(outputScreen);
});

test('preserves blank and missing source fields without inventing content', () => {
  const manifest = manifestFrom(MISSING_AND_BLANK_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const blankEntries = result.storyboard.sourceFieldAccounting.filter((entry) => entry.state === 'blank');
  const missingEntries = result.storyboard.sourceFieldAccounting.filter((entry) => entry.state === 'missing');
  assert.equal(blankEntries.length > 0, true);
  assert.equal(missingEntries.length > 0, true);
  assert.equal(blankEntries.every((entry) => entry.status === 'blank-preserved'), true);
  assert.equal(missingEntries.every((entry) => entry.status === 'intentionally-omitted'), true);
});

test('rejects foreign or invented source-step references', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const invalidStoryboard = {
    ...result.storyboard,
    screens: [
      {
        ...result.storyboard.screens[0],
        sourceStepIds: ['step-999'],
      },
    ],
  };
  const diagnostics = validateTeachingStoryboard(invalidStoryboard, manifest);

  assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
  assert.equal(diagnostics[0].code, 'storyboard_foreign_source_step');
  assert.match(formatStoryboardDiagnostics(diagnostics), /source step/i);
});

test('rejects unaccounted selected source steps', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const removedEntry = result.storyboard.sourceStepAccounting[0];
  const invalidStoryboard = {
    ...result.storyboard,
    sourceStepAccounting: result.storyboard.sourceStepAccounting.slice(1),
    screens: result.storyboard.screens.map((screen) => ({
      ...screen,
      sourceStepIds: screen.sourceStepIds.filter((sourceStepId) => sourceStepId !== removedEntry.sourceStepId),
    })),
  };
  const diagnostics = validateTeachingStoryboard(invalidStoryboard, manifest);

  assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'storyboard_source_step_unaccounted'), true);
});

test('rejects source-step order inversions', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const invalidStoryboard = {
    ...result.storyboard,
    screens: [...result.storyboard.screens].reverse(),
  };
  const diagnostics = validateTeachingStoryboard(invalidStoryboard, manifest);

  assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'storyboard_order_inversion'), true);
});

test('rejects objective count, order, identity, or ownership mismatches', () => {
  const manifest = manifestFrom(MULTI_OBJECTIVE_UNIT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const mutations = [
    result.storyboard.objectives.slice(1),
    [...result.storyboard.objectives].reverse(),
    [result.storyboard.objectives[0], result.storyboard.objectives[0], ...result.storyboard.objectives.slice(1)],
    [
      {
        ...result.storyboard.objectives[0],
        sourceObjectiveId: 'obj-999',
      },
      ...result.storyboard.objectives.slice(1),
    ],
    [
      {
        ...result.storyboard.objectives[0],
        unitId: 'unit-999',
      },
      ...result.storyboard.objectives.slice(1),
    ],
  ];

  for (const objectives of mutations) {
    const diagnostics = validateTeachingStoryboard({ ...result.storyboard, objectives }, manifest);
    assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
    assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'storyboard_objective_mismatch'), true);
  }
});

test('rejects visible teacher-script injected into learner-visible fields', () => {
  const manifest = manifestFrom(TEACHER_SCRIPT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const injectedText = 'The teacher will ask learners to explain the answer.';
  const baseScreen = result.storyboard.screens[0];
  const mutations = [
    { ...baseScreen, learnerTitle: injectedText },
    { ...baseScreen, learnerContent: { ...baseScreen.learnerContent, prompt: injectedText } },
    { ...baseScreen, learnerContent: { ...baseScreen.learnerContent, task: injectedText } },
    { ...baseScreen, learnerContent: { ...baseScreen.learnerContent, directions: [injectedText] } },
  ];

  for (const screen of mutations) {
    const diagnostics = validateTeachingStoryboard({
      ...result.storyboard,
      screens: [screen, ...result.storyboard.screens.slice(1)],
    }, manifest);
    assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
    assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'storyboard_teacher_script_visible'), true);
  }
});

test('rejects missing required evidence attachments', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const evidenceScreen = result.storyboard.screens.find((screen) => screen.requiredEvidence.length > 0);
  assert.ok(evidenceScreen);

  const missingEvidenceStoryboard = {
    ...result.storyboard,
    screens: result.storyboard.screens.map((screen) => (
      screen.id === evidenceScreen.id ? { ...screen, requiredEvidence: [] } : screen
    )),
  };
  const evidenceDiagnostics = validateTeachingStoryboard(missingEvidenceStoryboard, manifest);
  assert.equal(hasBlockingStoryboardDiagnostics(evidenceDiagnostics), true);
  assert.equal(evidenceDiagnostics.some((diagnostic) => diagnostic.code === 'storyboard_required_evidence_missing'), true);
});

test('rejects missing required output attachments', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const outputScreen = result.storyboard.screens.find((screen) => screen.requiredOutputs.length > 0);
  assert.ok(outputScreen);

  const missingOutputStoryboard = {
    ...result.storyboard,
    screens: result.storyboard.screens.map((screen) => (
      screen.id === outputScreen.id ? { ...screen, requiredOutputs: [] } : screen
    )),
  };
  const outputDiagnostics = validateTeachingStoryboard(missingOutputStoryboard, manifest);
  assert.equal(hasBlockingStoryboardDiagnostics(outputDiagnostics), true);
  assert.equal(outputDiagnostics.some((diagnostic) => diagnostic.code === 'storyboard_required_output_missing'), true);
});

test('rejects invented visible content from blank source fields', () => {
  const manifest = manifestFrom(MISSING_AND_BLANK_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const blankEntry = result.storyboard.sourceFieldAccounting.find((entry) => entry.state === 'blank');
  assert.ok(blankEntry);

  const invalidScreen = {
    id: 'screen-blank-invention',
    unitId: blankEntry.unitId,
    sourceStepIds: [],
    sourceObjectiveIds: [],
    sourceFieldIds: [blankEntry.sourceFieldId],
    instructionalPurpose: 'Invented blank-field content',
    learnerTitle: 'Reflection answer',
    learnerContent: {
      prompt: 'Write the reflection that was missing from the source.',
      task: undefined,
      questions: [],
      directions: ['Complete the blank reflection now.'],
      successCriteria: [],
      expectedOutput: undefined,
    },
    teacherNotes: 'This screen intentionally mutates a blank field for validator coverage.',
    requiredEvidence: [],
    requiredOutputs: [],
    communicationIntent: 'teacher-note' as const,
  };
  const invalidStoryboard = {
    ...result.storyboard,
    screens: [...result.storyboard.screens, invalidScreen],
    sourceFieldAccounting: result.storyboard.sourceFieldAccounting.map((entry) => (
      entry.sourceFieldId === blankEntry.sourceFieldId
        ? { ...entry, status: 'screened' as const, screenIds: [invalidScreen.id] }
        : entry
    )),
  };
  const diagnostics = validateTeachingStoryboard(invalidStoryboard, manifest);

  assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'storyboard_blank_field_invented'), true);
});

test('requires storyboard validation for enabled source-primary routes', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  const boundary = resolveTeachingStoryboardForGeneration(policy, manifest, result);

  assert.equal(boundary.ok, true);
  if (!boundary.ok) return;
  assert.ok(boundary.storyboard);
});

test('does not require a storyboard for legacy or topic-only routes', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.deepEqual(
    resolveTeachingStoryboardForGeneration(resolveK12GenerationRoutePolicy('', 'true'), manifest, result),
    { ok: true, storyboard: null },
  );
  assert.deepEqual(
    resolveTeachingStoryboardForGeneration(resolveK12GenerationRoutePolicy('uploaded source text', 'false'), manifest, result),
    { ok: true, storyboard: null },
  );
});

test('blocks enabled source-primary routes when storyboard validation fails', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const failedResult = {
    ok: false as const,
    diagnostics: [{
      code: 'storyboard_source_step_unaccounted' as const,
      severity: 'blocking' as const,
      message: 'Missing source-step accounting.',
      sourceStepId: 'step-001',
    }],
  };

  const boundary = resolveTeachingStoryboardForGeneration(policy, manifest, failedResult);

  assert.equal(boundary.ok, false);
  if (boundary.ok) return;
  assert.match(boundary.message, /Missing source-step accounting/);
});
