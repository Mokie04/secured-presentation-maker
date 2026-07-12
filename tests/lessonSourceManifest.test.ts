import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLessonSourceManifest,
  formatSourceManifestDiagnostics,
  hasBlockingSourceDiagnostics,
  resolveSourceManifestForGeneration,
} from '../lib/lessonSourceManifest.ts';
import {
  buildPlainTextSourceDocument,
  buildTableSourceDocument,
} from '../lib/lessonSourceDocument.ts';
import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import {
  AMBIGUOUS_OBJECTIVE_DOCUMENT,
  FIVE_SESSION_MATRIX_DOCUMENT,
  FOUR_A_DOCUMENT,
  MISSING_AND_BLANK_DOCUMENT,
  MULTI_TABLE_SESSION_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
  REPEATED_MISSING_OBJECTIVE_DOCUMENT,
  UNSUPPORTED_SCANNED_DOCUMENT,
} from './fixtures/lessonSourceManifestFixtures.ts';

test('builds a five-session manifest with one objective per source unit', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.contractVersion, 'lesson-source-manifest-v1');
  assert.equal(result.manifest.provenance.origin, 'uploaded-file');
  assert.equal(result.manifest.provenance.format, 'docx');
  assert.deepEqual(
    result.manifest.units.map((unit) => unit.sourceLabel),
    ['Learning Session 1', 'Learning Session 2', 'Learning Session 3', 'Learning Session 4', 'Learning Session 5'],
  );
  assert.equal(result.manifest.objectives.length, 5);
  assert.deepEqual(
    result.manifest.units.map((unit) => unit.objectiveIds.length),
    [1, 1, 1, 1, 1],
  );
  assert.match(result.manifest.objectives[0].rawText, /S1-OBJ-CIRCUIT-A/);
  assert.match(result.manifest.objectives[4].rawText, /S5-OBJ-CIRCUIT-E/);
});

test('reuses matching session units when objectives and learning experiences are in separate tables', () => {
  const result = buildLessonSourceManifest(MULTI_TABLE_SESSION_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.units.length, 5);
  assert.deepEqual(
    result.manifest.units.map((unit) => unit.sourceLabel),
    ['Learning Session 1', 'Learning Session 2', 'Learning Session 3', 'Learning Session 4', 'Learning Session 5'],
  );
  assert.equal(result.manifest.objectives.length, 5);

  for (const [index, unit] of result.manifest.units.entries()) {
    const objective = result.manifest.objectives.find((candidate) => candidate.id === unit.objectiveIds[0]);
    assert.equal(unit.objectiveIds.length, 1);
    assert.equal(objective?.unitId, unit.id);
    assert.equal(unit.steps.length, 3);
    assert.equal(unit.steps.every((step) => step.unitId === unit.id), true);
    assert.match(objective?.rawText || '', new RegExp(`MT-S${index + 1}-OBJ`));
    assert.match(unit.steps[0].rawBlocks.join('\n'), new RegExp(`MT-S${index + 1}-OBSERVE`));
    assert.match(unit.steps[1].rawBlocks.join('\n'), new RegExp(`MT-S${index + 1}-PRACTICE`));
  }

  const sourceOrders = [
    ...result.manifest.objectives.map((objective) => objective.sourceOrder),
    ...result.manifest.units.flatMap((unit) => unit.steps.map((step) => step.sourceOrder)),
  ].sort((a, b) => a - b);
  assert.deepEqual(sourceOrders, Array.from({ length: sourceOrders.length }, (_, index) => index + 1));
});

test('does not treat a Grade 9 title cell as a unit header because it contains a number', () => {
  const result = buildLessonSourceManifest(MULTI_TABLE_SESSION_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.units.some((unit) => /Grade 9 Science/i.test(unit.sourceLabel)), false);
  assert.equal(result.manifest.units[0].sourceLabel, 'Learning Session 1');
});

test('treats descriptive objective mentions as steps or fields, not objective rows', () => {
  const result = buildLessonSourceManifest(MULTI_TABLE_SESSION_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.objectives.length, 5);
  assert.equal(
    result.manifest.objectives.some((objective) => /meet the learning objectives|reaching our objectives/i.test(objective.rawText)),
    false,
  );

  for (const [index, unit] of result.manifest.units.entries()) {
    assert.equal(unit.objectiveIds.length, 1);
    assert.equal(unit.steps.some((step) => /Flow to help learners meet the learning objectives/i.test(step.sourceLabel)), true);
    assert.match(
      unit.steps.find((step) => /Flow to help learners meet the learning objectives/i.test(step.sourceLabel))?.rawBlocks.join('\n') || '',
      new RegExp(`MT-S${index + 1}-FLOW`),
    );

    const resourceField = Object.values(unit.fields).find(
      (field) => /Learning Resources for reaching our objectives/i.test(field.label),
    );
    assert.equal(resourceField?.state, 'present');
    assert.match(resourceField?.value || '', /Reusable/);
  }
});

test('keeps 5E labels as source data while assigning monotonic step ids', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const allSteps = result.manifest.units
    .flatMap((unit) => unit.steps)
    .sort((a, b) => a.sourceOrder - b.sourceOrder);
  assert.equal(allSteps[0].id, 'step-001');
  assert.equal(allSteps[allSteps.length - 1].id, `step-${String(allSteps.length).padStart(3, '0')}`);
  assert.deepEqual(
    allSteps.slice(0, 5).map((step) => step.sourceLabel),
    ['Engage - 5 min', 'Engage - 5 min', 'Engage - 5 min', 'Engage - 5 min', 'Engage - 5 min'],
  );
  assert.match(allSteps[0].rawBlocks.join('\n'), /S1-ENGAGE-WARMUP/);
  assert.match(allSteps[allSteps.length - 1].rawBlocks.join('\n'), /S5-EVALUATE-TAIL-OMEGA/);
});

test('does not require a 5E schema for block-oriented 4A or custom labels', () => {
  const result = buildLessonSourceManifest(FOUR_A_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.manifest.units.map((unit) => unit.sourceLabel), ['Day 1', 'Day 2']);
  assert.deepEqual(result.manifest.units.map((unit) => unit.objectiveIds.length), [1, 1]);
  assert.deepEqual(
    result.manifest.units[0].steps.map((step) => step.sourceLabel),
    ['Activity', 'Analysis', 'Abstraction', 'Application'],
  );
  assert.deepEqual(
    result.manifest.units[1].steps.map((step) => step.sourceLabel),
    ['Launch', 'Practice'],
  );
});

test('preserves multiple legitimate objectives for one unit in source order', () => {
  const result = buildLessonSourceManifest(MULTI_OBJECTIVE_UNIT_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.objectives.length, 3);
  assert.deepEqual(result.manifest.objectives.map((objective) => objective.id), ['obj-001', 'obj-002', 'obj-003']);
  assert.deepEqual(result.manifest.units.map((unit) => unit.objectiveIds.length), [2, 1]);
  assert.deepEqual(result.manifest.units[0].objectiveIds, ['obj-001', 'obj-002']);
  assert.match(result.manifest.objectives[0].rawText, /M1-OBJ-A/);
  assert.match(result.manifest.objectives[1].rawText, /M1-OBJ-B/);
  assert.equal(result.manifest.objectives[0].unitId, result.manifest.units[0].id);
  assert.equal(result.manifest.objectives[1].unitId, result.manifest.units[0].id);
});

test('attaches explicit shared colspan fields to every covered unit', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  for (const unit of result.manifest.units) {
    assert.equal(unit.fields.sharedMaterials.state, 'present');
    assert.match(unit.fields.sharedMaterials.value, /Shared safe battery pack/);
    assert.equal(unit.fields.sharedMaterials.sourceLocation.rowIndex, 2);
  }
});

test('distinguishes blank cells from missing cells', () => {
  const result = buildLessonSourceManifest(MISSING_AND_BLANK_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.units[0].fields.reflection.state, 'blank');
  assert.equal(result.manifest.units[1].fields.reflection.state, 'present');
  assert.equal(result.manifest.units[4].fields.reflection.state, 'missing');
});

test('rejects ambiguous objective ownership visibly', () => {
  const result = buildLessonSourceManifest(AMBIGUOUS_OBJECTIVE_DOCUMENT);

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(hasBlockingSourceDiagnostics(result.diagnostics), true);
  assert.equal(result.diagnostics[0].code, 'source_structure_ambiguous');
  assert.match(formatSourceManifestDiagnostics(result.diagnostics), /objective/i);
});

test('summarizes repeated missing-objective diagnostics instead of repeating one sentence per unit', () => {
  const result = buildLessonSourceManifest(REPEATED_MISSING_OBJECTIVE_DOCUMENT);

  assert.equal(result.ok, false);
  if (result.ok) return;

  const missingObjectiveDiagnostics = result.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'source_unit_missing_objective',
  );
  assert.equal(missingObjectiveDiagnostics.length, 1);
  assert.match(missingObjectiveDiagnostics[0].message, /3 source units/i);
  assert.match(missingObjectiveDiagnostics[0].message, /Learning Session 2/);
  assert.match(missingObjectiveDiagnostics[0].message, /Learning Session 4/);

  const formatted = formatSourceManifestDiagnostics(result.diagnostics);
  const repeatedPhraseCount = formatted.match(/missing a unit-owned objective/g)?.length || 0;
  assert.equal(repeatedPhraseCount, 1);
});

test('rejects unsupported scanned input visibly', () => {
  const result = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.diagnostics[0].code, 'source_parse_unsupported');
  assert.equal(result.diagnostics[0].severity, 'blocking');
});

test('preserves the source tail sentinel instead of silently truncating', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const allText = result.manifest.units
    .flatMap((unit) => unit.steps)
    .flatMap((step) => step.rawBlocks)
    .join('\n');
  assert.match(allText, /S5-EVALUATE-TAIL-OMEGA/);
});

test('builds a block source document from plain text without inventing units', () => {
  const document = buildPlainTextSourceDocument({
    format: 'md',
    fileName: 'custom-sequence.md',
    sourceHash: 'plain-hash',
    byteLength: 900,
    text: [
      '# Lesson Sequence',
      'Custom Unit 1',
      'Objective: CU1-OBJ Explain one pattern.',
      'Launch: CU1-LAUNCH Inspect the first card.',
      'Build: CU1-BUILD Arrange the evidence cards.',
      'Custom Unit 2',
      'Objective: CU2-OBJ Defend one pattern.',
      'Critique: CU2-CRITIQUE Improve the evidence claim.',
    ].join('\n'),
  });

  assert.equal(document.blocks.length, 8);
  assert.equal(document.tables.length, 0);
  assert.equal(document.blocks[1].kind, 'heading');
  assert.equal(document.blocks[2].kind, 'paragraph');
});

test('builds a table source document preserving blank and missing cells', () => {
  const document = buildTableSourceDocument({
    format: 'docx',
    fileName: 'table.docx',
    sourceHash: 'table-hash',
    byteLength: 1000,
    rows: [
      ['Field', 'Session 1', 'Session 2'],
      ['Objective', 'OBJ-1', 'OBJ-2'],
      ['Reflection', '', undefined],
    ],
  });

  assert.equal(document.tables[0].rows[2].cells[1].state, 'blank');
  assert.equal(document.tables[0].rows[2].cells.length, 2);
});

test('requires a valid manifest for enabled source-primary routes', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const manifestResult = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  const boundary = resolveSourceManifestForGeneration(policy, manifestResult);

  assert.equal(boundary.ok, false);
  if (boundary.ok) return;
  assert.match(boundary.message, /extractable lesson text/i);
});

test('does not require a manifest for topic-only legacy routes', () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  const manifestResult = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  const boundary = resolveSourceManifestForGeneration(policy, manifestResult);

  assert.deepEqual(boundary, { ok: true, manifest: null });
});

test('does not require a manifest when source-primary routing is disabled', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'false');
  const manifestResult = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  const boundary = resolveSourceManifestForGeneration(policy, manifestResult);

  assert.deepEqual(boundary, { ok: true, manifest: null });
});
