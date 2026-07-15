import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isVisualTeachingComposerV1Enabled,
  validateVisualTeachingPlan,
} from '../lib/visualTeachingPlan.ts';
import { classifySourceContent } from '../lib/sourceContentDisposition.ts';
import type { StructuredSourceDocument } from '../lib/lessonSourceDocument.ts';
import { buildLessonSourceManifest } from '../lib/lessonSourceManifest.ts';
import { buildTeachingStoryboard } from '../lib/teachingStoryboard.ts';
import {
  questionChoicesSemanticFixture,
  relationshipDiagramSemanticFixture,
  validVisualPlanFixture,
} from './fixtures/visualTeachingComposerFixtures.ts';

const fieldCell = (
  tableId: string,
  rowIndex: number,
  columnIndex: number,
  text: string,
) => ({
  text,
  state: text.trim() ? 'present' as const : 'blank' as const,
  rowSpan: 1,
  columnSpan: 1,
  sourceLocation: { tableId, rowIndex, columnIndex },
});

const PUBLIC_FIELD_DOCUMENT: StructuredSourceDocument = {
  format: 'docx',
  fileName: 'sanitized-public-field-source.docx',
  sourceHash: 'fixture-public-field-source-hash',
  byteLength: 1800,
  plainText: 'Sanitized public field fixture.',
  blocks: [],
  tables: [{
    id: 'table-public-field',
    sourceOrder: 1,
    rows: [
      {
        index: 0,
        cells: [
          fieldCell('table-public-field', 0, 0, 'Field'),
          fieldCell('table-public-field', 0, 1, 'Learning Session 1'),
          fieldCell('table-public-field', 0, 2, 'Learning Session 2'),
        ],
      },
      {
        index: 1,
        cells: [
          fieldCell('table-public-field', 1, 0, 'Objective'),
          fieldCell('table-public-field', 1, 1, 'Compare two source-provided perspectives.'),
          fieldCell('table-public-field', 1, 2, 'Explain one source-provided perspective.'),
        ],
      },
      {
        index: 2,
        cells: [
          fieldCell('table-public-field', 2, 0, 'References (Learning Resources)'),
          fieldCell('table-public-field', 2, 1, 'Learners consult the source before comparing both perspectives.'),
          fieldCell('table-public-field', 2, 2, 'Learners consult the source before explaining one perspective.'),
        ],
      },
      {
        index: 3,
        cells: [
          fieldCell('table-public-field', 3, 0, 'References (Administrative Resources)'),
          fieldCell('table-public-field', 3, 1, 'Planning-only source filing note.'),
          fieldCell('table-public-field', 3, 2, 'Planning-only source filing note.'),
        ],
      },
      {
        index: 4,
        cells: [
          fieldCell('table-public-field', 4, 0, 'Source Comparison'),
          fieldCell('table-public-field', 4, 1, 'Identify one shared claim and one meaningful difference.'),
          fieldCell('table-public-field', 4, 2, 'Identify one supported claim.'),
        ],
      },
    ],
  }],
};

const publicFieldPlanFixture = () => {
  const manifestResult = buildLessonSourceManifest(PUBLIC_FIELD_DOCUMENT);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) throw new Error('public field manifest fixture failed');
  const storyboardResult = buildTeachingStoryboard(manifestResult.manifest, {
    selectedUnitIds: [manifestResult.manifest.units[0].id],
  });
  assert.equal(storyboardResult.ok, true);
  if (!storyboardResult.ok) throw new Error('public field storyboard fixture failed');
  const dispositionResult = classifySourceContent(manifestResult.manifest, storyboardResult.storyboard);
  assert.equal(dispositionResult.ok, true);
  if (!dispositionResult.ok) throw new Error('public field disposition fixture failed');

  const templatePlan = validVisualPlanFixture().plan;
  const templateScene = templatePlan.scenes[0];
  const objective = manifestResult.manifest.objectives[0];
  const step = manifestResult.manifest.units[0].steps[0];
  const objectiveScreen = storyboardResult.storyboard.screens.find((screen) => screen.sourceObjectiveIds.includes(objective.id));
  const stepScreen = storyboardResult.storyboard.screens.find((screen) => screen.sourceStepIds.includes(step.id));
  const fieldDecision = dispositionResult.decisions.find((item) => (
    item.sourceKind === 'field' && item.disposition === 'learner-visible'
  ));
  const administrativeFieldDecision = dispositionResult.decisions.find((item) => (
    item.sourceKind === 'field' && item.disposition === 'omit-administrative'
  ));
  assert.ok(objectiveScreen);
  assert.ok(stepScreen);
  assert.ok(fieldDecision);
  assert.ok(administrativeFieldDecision);

  const objectiveScene = {
    ...templateScene,
    id: 'visual-scene-public-objective',
    unitId: objective.unitId,
    sourceStepIds: [],
    sourceObjectiveIds: [objective.id],
    sourceFieldIds: [],
    storyboardScreenIds: [objectiveScreen.id],
    learnerTitle: 'Learning Target',
    visibleContent: { statement: objective.rawText, points: [], cards: [], steps: [] },
    visualGrammar: 'visual-thesis' as const,
    teacherNotes: objectiveScreen.teacherNotes,
  };
  const fieldScene = {
    ...templateScene,
    id: 'visual-scene-public-field',
    unitId: fieldDecision.unitId,
    sourceStepIds: [],
    sourceObjectiveIds: [objective.id],
    sourceFieldIds: [fieldDecision.sourceId],
    storyboardScreenIds: [objectiveScreen.id],
    learnerTitle: 'Reference Comparison',
    visibleContent: {
      statement: 'Learners consult the source before comparing both perspectives.',
      points: [],
      cards: [],
      steps: [],
    },
    visualGrammar: 'activity-board' as const,
    teacherNotes: objectiveScreen.teacherNotes,
  };
  const stepScene = {
    ...templateScene,
    id: 'visual-scene-public-step',
    unitId: step.unitId,
    sourceStepIds: [step.id],
    sourceObjectiveIds: [],
    sourceFieldIds: [],
    storyboardScreenIds: [stepScreen.id],
    learnerTitle: step.sourceLabel,
    visibleContent: { statement: step.rawBlocks.join(' '), points: [], cards: [], steps: [] },
    visualGrammar: 'comparison-panels' as const,
    teacherNotes: stepScreen.teacherNotes,
    requiredEvidence: [...stepScreen.requiredEvidence],
    requiredOutputs: [...stepScreen.requiredOutputs],
  };
  const sceneIdsBySourceId = new Map<string, string[]>([
    [objective.id, [objectiveScene.id, fieldScene.id]],
    [fieldDecision.sourceId, [fieldScene.id]],
    [step.id, [stepScene.id]],
  ]);
  const plan = {
    ...templatePlan,
    unitId: manifestResult.manifest.units[0].id,
    sourceObjectiveIds: [objective.id],
    scenes: [objectiveScene, fieldScene, stepScene],
    sourceAccounting: dispositionResult.decisions.map((decision) => ({
      ...decision,
      sceneIds: sceneIdsBySourceId.get(decision.sourceId) ?? [],
    })),
    provenance: {
      sourceHash: manifestResult.manifest.provenance.sourceHash,
      storyboardVersion: storyboardResult.storyboard.contractVersion,
      selectedUnitIds: [...storyboardResult.storyboard.provenance.selectedUnitIds],
    },
  };

  return {
    manifest: manifestResult.manifest,
    storyboard: storyboardResult.storyboard,
    dispositions: dispositionResult.decisions,
    plan,
    fieldScene,
    fieldDecision,
    administrativeFieldDecision,
  };
};

test('accepts a fully reconciled visual teaching plan', () => {
  const fixture = validVisualPlanFixture();
  assert.deepEqual(validateVisualTeachingPlan(
    fixture.plan,
    fixture.manifest,
    fixture.storyboard,
    fixture.dispositions,
  ), []);
});

test('requires scene evidence to preserve the ordered storyboard evidence', () => {
  const fixture = validVisualPlanFixture();
  const evidenceScene = fixture.plan.scenes.find((scene) => scene.requiredEvidence.length > 0);
  assert.ok(evidenceScene);

  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === evidenceScene.id
      ? { ...scene, requiredEvidence: [] }
      : scene),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);

  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
});

test('allows a concise exact source excerpt for a long evidence requirement', () => {
  const fixture = validVisualPlanFixture();
  const evidenceScene = fixture.plan.scenes.find((scene) => scene.requiredEvidence.length > 0);
  assert.ok(evidenceScene);
  const sourceRequirement = evidenceScene.requiredEvidence[0];
  const exactExcerpt = 'two observations and one measurement';
  assert.equal(sourceRequirement.toLowerCase().includes(exactExcerpt), true);

  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === evidenceScene.id
      ? { ...scene, requiredEvidence: [exactExcerpt] }
      : scene),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);

  assert.deepEqual(diagnostics, []);
});

test('requires scene outputs to preserve the ordered storyboard outputs', () => {
  const fixture = validVisualPlanFixture();
  const outputScene = fixture.plan.scenes.find((scene) => scene.requiredOutputs.length > 0);
  assert.ok(outputScene);

  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === outputScene.id
      ? { ...scene, requiredOutputs: [] }
      : scene),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);

  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
});

test('requires speaker-note source dispositions to retain teacher-note ownership', () => {
  const fixture = validVisualPlanFixture();
  const speakerNoteEntry = fixture.plan.sourceAccounting.find((entry) => entry.disposition === 'speaker-notes');
  assert.ok(speakerNoteEntry);
  const speakerNoteScreen = fixture.storyboard.screens.find((screen) => (
    screen.sourceStepIds.includes(speakerNoteEntry.sourceId)
    || screen.sourceFieldIds.includes(speakerNoteEntry.sourceId)
  ));
  assert.ok(speakerNoteScreen);
  const ownerScene = fixture.plan.scenes.find((scene) => scene.storyboardScreenIds.includes(speakerNoteScreen.id));
  assert.ok(ownerScene);
  const remainingScreens = ownerScene.storyboardScreenIds
    .filter((screenId) => screenId !== speakerNoteScreen.id)
    .map((screenId) => fixture.storyboard.screens.find((screen) => screen.id === screenId)!);
  const mutatedPlan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === ownerScene.id
      ? {
          ...scene,
          storyboardScreenIds: remainingScreens.map((screen) => screen.id),
          sourceStepIds: remainingScreens.flatMap((screen) => screen.sourceStepIds),
          sourceObjectiveIds: remainingScreens.flatMap((screen) => screen.sourceObjectiveIds),
          sourceFieldIds: remainingScreens.flatMap((screen) => screen.sourceFieldIds),
          teacherNotes: remainingScreens.map((screen) => screen.teacherNotes).filter(Boolean).join('\n'),
          requiredEvidence: remainingScreens.flatMap((screen) => screen.requiredEvidence),
          requiredOutputs: remainingScreens.flatMap((screen) => screen.requiredOutputs),
        }
      : scene),
    sourceAccounting: fixture.plan.sourceAccounting.map((entry) => entry.sourceId === speakerNoteEntry.sourceId
      ? { ...entry, sceneIds: [] }
      : entry),
  };

  const diagnostics = validateVisualTeachingPlan(
    mutatedPlan,
    fixture.manifest,
    fixture.storyboard,
    fixture.dispositions,
  );

  assert.equal(diagnostics.some((item) => (
    item.code === 'visual_plan_source_unaccounted'
    && item.sourceId === speakerNoteEntry.sourceId
  )), true);
});

test('keeps speaker-note evidence out of learner-visible requirement slots', () => {
  const fixture = validVisualPlanFixture();
  const speakerNoteEntry = fixture.plan.sourceAccounting.find((entry) => entry.disposition === 'speaker-notes');
  assert.ok(speakerNoteEntry);
  const speakerNoteScreen = fixture.storyboard.screens.find((screen) => (
    screen.sourceStepIds.includes(speakerNoteEntry.sourceId)
    || screen.sourceFieldIds.includes(speakerNoteEntry.sourceId)
  ));
  assert.ok(speakerNoteScreen);
  assert.notEqual(speakerNoteScreen.requiredEvidence.length, 0);

  const visibleRequirements = fixture.plan.scenes.flatMap((scene) => [
    ...scene.requiredEvidence,
    ...scene.requiredOutputs,
  ]);
  for (const planningOnlyRequirement of speakerNoteScreen.requiredEvidence) {
    assert.equal(visibleRequirements.includes(planningOnlyRequirement), false);
  }
  const ownerScene = fixture.plan.scenes.find((scene) => scene.storyboardScreenIds.includes(speakerNoteScreen.id));
  assert.ok(ownerScene);
  assert.equal(ownerScene.teacherNotes.includes(speakerNoteScreen.teacherNotes), true);
});

test('preserves a planning-context source field in speaker notes without making it visible', () => {
  const fixture = validVisualPlanFixture();
  const speakerNoteField = {
    id: 'field-speaker-note-context',
    label: 'Learner Context',
    value: 'Planning observation about prior classroom experience.',
    state: 'present' as const,
    sourceOrder: 99,
    sourceLocation: { blockId: 'field-speaker-note-context' },
  };
  const manifest = {
    ...fixture.manifest,
    units: fixture.manifest.units.map((unit) => unit.id === fixture.plan.unitId
      ? { ...unit, fields: { ...unit.fields, speakerNoteContext: speakerNoteField } }
      : unit),
  };
  const dispositionResult = classifySourceContent(manifest, fixture.storyboard);
  assert.equal(dispositionResult.ok, true);
  if (!dispositionResult.ok) return;
  const speakerNoteDecision = dispositionResult.decisions.find((item) => item.sourceId === speakerNoteField.id);
  assert.equal(speakerNoteDecision?.disposition, 'speaker-notes');
  const ownerScene = fixture.plan.scenes.at(-1);
  assert.ok(ownerScene);
  const plan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === ownerScene.id
      ? {
          ...scene,
          sourceFieldIds: [...scene.sourceFieldIds, speakerNoteField.id],
          teacherNotes: `${scene.teacherNotes}\nSource field (${speakerNoteField.label}): ${speakerNoteField.value}`,
        }
      : scene),
    sourceAccounting: dispositionResult.decisions.map((decision) => ({
      ...decision,
      sceneIds: decision.sourceId === speakerNoteField.id
        ? [ownerScene.id]
        : fixture.plan.sourceAccounting.find((entry) => entry.sourceId === decision.sourceId)?.sceneIds ?? [],
    })),
  };

  const diagnostics = validateVisualTeachingPlan(
    plan,
    manifest,
    fixture.storyboard,
    dispositionResult.decisions,
  );

  assert.deepEqual(diagnostics, []);
  assert.equal(ownerScene.visibleContent.statement?.includes(speakerNoteField.value) ?? false, false);
});

test('rejects a visual plan that drops a learner-visible source step', () => {
  const fixture = validVisualPlanFixture();
  const mutated = {
    ...fixture.plan,
    sourceAccounting: fixture.plan.sourceAccounting.filter((item) => item.sourceId !== fixture.relationshipStepId),
  };
  const diagnostics = validateVisualTeachingPlan(mutated, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
});

test('accepts only documented true-like composer flags', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) assert.equal(isVisualTeachingComposerV1Enabled(value), true);
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) assert.equal(isVisualTeachingComposerV1Enabled(value), false);
});

test('rejects foreign source and storyboard references', () => {
  const fixture = validVisualPlanFixture();
  const firstScene = fixture.plan.scenes[0];
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: [{
      ...firstScene,
      sourceStepIds: ['step-999'],
      storyboardScreenIds: ['screen-999'],
    }, ...fixture.plan.scenes.slice(1)],
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_foreign_source'), true);
});

test('rejects learner-visible scenes without storyboard ownership', () => {
  const fixture = validVisualPlanFixture();
  const firstScene = fixture.plan.scenes[0];
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: [{
      ...firstScene,
      storyboardScreenIds: [],
      learnerTitle: 'Arbitrary learner content',
      visibleContent: {
        statement: 'This statement has no storyboard provenance.',
        points: [],
        cards: [],
        steps: [],
      },
    }, ...fixture.plan.scenes.slice(1)],
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);

  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_contract_invalid'), true);
});

test('rejects scene source references that do not match their storyboard screens', () => {
  const fixture = validVisualPlanFixture();
  const stepScenes = fixture.plan.scenes.filter((scene) => scene.sourceStepIds.length > 0);
  const firstScene = stepScenes[0];
  const secondScene = stepScenes[1];
  assert.ok(firstScene);
  assert.ok(secondScene);

  const mutations = [
    {
      ...firstScene,
      sourceStepIds: [],
      sourceObjectiveIds: [],
      sourceFieldIds: [],
    },
    {
      ...firstScene,
      storyboardScreenIds: [...secondScene.storyboardScreenIds],
    },
  ];

  for (const scene of mutations) {
    const diagnostics = validateVisualTeachingPlan({
      ...fixture.plan,
      scenes: fixture.plan.scenes.map((candidate) => candidate.id === firstScene.id ? scene : candidate),
    }, fixture.manifest, fixture.storyboard, fixture.dispositions);
    assert.equal(
      diagnostics.some((item) => item.code === 'visual_plan_foreign_source'),
      true,
      scene.id,
    );
  }
});

test('rejects source order inversions', () => {
  const fixture = validVisualPlanFixture();
  const objectiveScenes = fixture.plan.scenes.filter((scene) => scene.sourceStepIds.length === 0);
  const stepScenes = fixture.plan.scenes.filter((scene) => scene.sourceStepIds.length > 0);
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: [...objectiveScenes, ...stepScenes].reverse(),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_order_inversion'), true);
});

test('rejects objective identity or order mismatches', () => {
  const fixture = validVisualPlanFixture();
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    sourceObjectiveIds: ['obj-999'],
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_objective_mismatch'), true);
});

test('rejects changed dispositions and scene-owned administrative omissions', () => {
  const fixture = validVisualPlanFixture();
  const administrative = fixture.plan.sourceAccounting.find((item) => item.disposition === 'omit-administrative');
  assert.ok(administrative);
  const firstScene = fixture.plan.scenes[0];
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    sourceAccounting: fixture.plan.sourceAccounting.map((item) => (
      item.sourceId === administrative.sourceId
        ? { ...item, disposition: 'learner-visible', sceneIds: [firstScene.id] }
        : item
    )),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_unauthorized_omission'), true);
});

test('rejects planning-only source text in learner-visible content', () => {
  const fixture = validVisualPlanFixture();
  const firstScene = fixture.plan.scenes[0];
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: [{
      ...firstScene,
      learnerTitle: 'Learner Context',
      visibleContent: { ...firstScene.visibleContent, statement: 'Planning observation about prior classroom experience.' },
    }, ...fixture.plan.scenes.slice(1)],
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_planning_text_visible'), true);
});

test('rejects multiple-choice source checks that are not parsed into choices', () => {
  const fixture = validVisualPlanFixture();
  const checkScene = fixture.plan.scenes.find((scene) => scene.visualGrammar === 'question-choices');
  assert.ok(checkScene);
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => (
      scene.id === checkScene.id
        ? { ...scene, visualGrammar: 'activity-board', visibleContent: { ...scene.visibleContent, question: undefined } }
        : scene
    )),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_assessment_unparsed'), true);
});

test('rejects unsupported visual grammars and invalid contract versions', () => {
  const fixture = validVisualPlanFixture();
  const firstScene = fixture.plan.scenes[0];
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    contractVersion: 'visual-teaching-plan-v2' as typeof fixture.plan.contractVersion,
    scenes: [{ ...firstScene, visualGrammar: 'poster-collage' as typeof firstScene.visualGrammar }, ...fixture.plan.scenes.slice(1)],
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_contract_invalid'), true);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_grammar_unsupported'), true);
});

test('rejects plans where minimal statements exceed twenty percent of scenes', () => {
  const fixture = validVisualPlanFixture();
  assert.equal(fixture.plan.scenes.length, 6);
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene, index) => (
      index < 2 ? { ...scene, visualGrammar: 'minimal-statement' as const } : scene
    )),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);

  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_minimal_statement_overuse'), true);
});

test('requires each disposition exactly once', () => {
  const fixture = validVisualPlanFixture();
  const duplicated = fixture.plan.sourceAccounting[0];
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    sourceAccounting: [...fixture.plan.sourceAccounting, { ...duplicated }],
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
});

test('rejects an administrative omission referenced directly by a scene', () => {
  const fixture = validVisualPlanFixture();
  const administrative = fixture.plan.sourceAccounting.find((item) => item.disposition === 'omit-administrative');
  assert.ok(administrative);
  const firstScene = fixture.plan.scenes[0];
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: [{
      ...firstScene,
      sourceStepIds: [...firstScene.sourceStepIds, administrative.sourceId],
    }, ...fixture.plan.scenes.slice(1)],
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_unauthorized_omission'), true);
});

test('rejects hidden step and field text reproduced in learner-visible scenes', () => {
  const fixture = validVisualPlanFixture();
  const unit = fixture.manifest.units[0];
  const administrativeStep = unit.steps.find((step) => step.sourceLabel.startsWith('References'));
  const planningStep = unit.steps.find((step) => step.sourceLabel === 'Learner Context');
  assert.ok(administrativeStep);
  assert.ok(planningStep);
  const administrativeField = {
    id: 'field-administrative',
    label: 'Administrative Notes',
    value: 'Private filing instruction.',
    state: 'present' as const,
    sourceOrder: 9,
    sourceLocation: { blockId: 'field-administrative' },
  };
  const planningField = {
    id: 'field-learner-context',
    label: 'Learner Context',
    value: 'Private planning observation.',
    state: 'present' as const,
    sourceOrder: 10,
    sourceLocation: { blockId: 'field-learner-context' },
  };
  const manifest = {
    ...fixture.manifest,
    units: [{
      ...unit,
      fields: { administrativeField, planningField },
    }],
  };
  const dispositionResult = classifySourceContent(manifest, fixture.storyboard);
  assert.equal(dispositionResult.ok, true);
  if (!dispositionResult.ok) return;
  const firstScene = fixture.plan.scenes[0];

  for (const hiddenText of [
    administrativeStep.rawBlocks[0],
    planningStep.rawBlocks[0],
    administrativeField.value,
    planningField.value,
  ]) {
    const diagnostics = validateVisualTeachingPlan({
      ...fixture.plan,
      scenes: [{
        ...firstScene,
        visibleContent: { ...firstScene.visibleContent, statement: hiddenText },
      }, ...fixture.plan.scenes.slice(1)],
    }, manifest, fixture.storyboard, dispositionResult.decisions);
    assert.equal(
      diagnostics.some((item) => item.code === 'visual_plan_planning_text_visible'),
      true,
      hiddenText,
    );
  }
});

test('anchors a learner-visible public source field to a same-unit storyboard screen', () => {
  const fixture = publicFieldPlanFixture();
  assert.equal(fixture.fieldDecision.disposition, 'learner-visible');
  assert.equal(fixture.storyboard.screens.every((screen) => screen.sourceFieldIds.length === 0), true);
  assert.deepEqual(validateVisualTeachingPlan(
    fixture.plan,
    fixture.manifest,
    fixture.storyboard,
    fixture.dispositions,
  ), []);
});

test('rejects a public field scene that drops its storyboard anchor sources', () => {
  const fixture = publicFieldPlanFixture();
  const anchorObjectiveId = fixture.fieldScene.sourceObjectiveIds[0];
  assert.ok(anchorObjectiveId);
  const diagnostics = validateVisualTeachingPlan({
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === fixture.fieldScene.id
      ? { ...scene, sourceObjectiveIds: [] }
      : scene),
    sourceAccounting: fixture.plan.sourceAccounting.map((entry) => entry.sourceId === anchorObjectiveId
      ? { ...entry, sceneIds: entry.sceneIds.filter((sceneId) => sceneId !== fixture.fieldScene.id) }
      : entry),
  }, fixture.manifest, fixture.storyboard, fixture.dispositions);

  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_foreign_source'), true);
});

test('rejects foreign, administrative, or undeclared field attachments', () => {
  const fixture = publicFieldPlanFixture();
  const mutations = [
    {
      expectedCode: 'visual_plan_foreign_source',
      plan: {
        ...fixture.plan,
        scenes: fixture.plan.scenes.map((scene) => scene.id === fixture.fieldScene.id
          ? { ...scene, sourceFieldIds: ['field-999'] }
          : scene),
      },
    },
    {
      expectedCode: 'visual_plan_unauthorized_omission',
      plan: {
        ...fixture.plan,
        scenes: fixture.plan.scenes.map((scene) => scene.id === fixture.fieldScene.id
          ? { ...scene, sourceFieldIds: [fixture.administrativeFieldDecision.sourceId] }
          : scene),
      },
    },
    {
      expectedCode: 'visual_plan_source_unaccounted',
      plan: {
        ...fixture.plan,
        sourceAccounting: fixture.plan.sourceAccounting.filter((entry) => entry.sourceId !== fixture.fieldDecision.sourceId),
      },
    },
  ];

  for (const mutation of mutations) {
    const diagnostics = validateVisualTeachingPlan(
      mutation.plan,
      fixture.manifest,
      fixture.storyboard,
      fixture.dispositions,
    );
    assert.equal(diagnostics.some((item) => item.code === mutation.expectedCode), true, mutation.expectedCode);
  }
});

test('rejects cross-unit ownership for steps, objectives, fields, and storyboard screens', () => {
  const fixture = validVisualPlanFixture();
  const originalUnit = fixture.manifest.units[0];
  const field = {
    id: 'field-owned-by-unit-one',
    label: 'Shared Materials',
    value: 'Sanitized source material.',
    state: 'present' as const,
    sourceOrder: 9,
    sourceLocation: { blockId: 'field-owned-by-unit-one' },
  };
  const secondUnit = {
    ...originalUnit,
    id: 'unit-002',
    sourceOrdinal: 2,
    sourceLabel: 'Session 2',
    objectiveIds: [],
    steps: [],
    fields: {},
  };
  const manifest = {
    ...fixture.manifest,
    units: [{ ...originalUnit, fields: { ownedField: field } }, secondUnit],
  };
  const storyboard = {
    ...fixture.storyboard,
    provenance: {
      ...fixture.storyboard.provenance,
      selectedUnitIds: [originalUnit.id, secondUnit.id],
    },
  };
  const basePlan = {
    ...fixture.plan,
    provenance: {
      ...fixture.plan.provenance,
      selectedUnitIds: [originalUnit.id, secondUnit.id],
    },
  };
  const objectiveScene = fixture.plan.scenes.find((scene) => scene.sourceObjectiveIds.length > 0);
  const stepScene = fixture.plan.scenes.find((scene) => scene.sourceStepIds.length > 0);
  assert.ok(objectiveScene);
  assert.ok(stepScene);
  const mutations = [
    {
      ...objectiveScene,
      unitId: secondUnit.id,
      sourceStepIds: [...stepScene.sourceStepIds],
      sourceObjectiveIds: [],
      storyboardScreenIds: [],
    },
    { ...objectiveScene, unitId: secondUnit.id, storyboardScreenIds: [] },
    {
      ...objectiveScene,
      unitId: secondUnit.id,
      sourceStepIds: [],
      sourceObjectiveIds: [],
      sourceFieldIds: [field.id],
      storyboardScreenIds: [],
    },
    {
      ...objectiveScene,
      unitId: secondUnit.id,
      sourceStepIds: [],
      sourceObjectiveIds: [],
      sourceFieldIds: [],
    },
  ];

  for (const scene of mutations) {
    const diagnostics = validateVisualTeachingPlan({
      ...basePlan,
      scenes: [{
        ...scene,
        storyboardScreenIds: scene === mutations[3] ? objectiveScene.storyboardScreenIds : scene.storyboardScreenIds,
      }, ...fixture.plan.scenes.slice(1)],
    }, manifest, storyboard, fixture.dispositions);
    assert.equal(diagnostics.some((item) => item.code === 'visual_plan_foreign_source'), true);
  }
});

test('requires accounting scene ids to exactly match direct scene ownership', () => {
  const fixture = validVisualPlanFixture();
  const relationshipEntry = fixture.plan.sourceAccounting.find((item) => item.sourceId === fixture.relationshipStepId);
  assert.ok(relationshipEntry);
  const ownerScene = fixture.plan.scenes.find((scene) => scene.sourceStepIds.includes(fixture.relationshipStepId));
  const unrelatedScene = fixture.plan.scenes.find((scene) => !scene.sourceStepIds.includes(fixture.relationshipStepId));
  assert.ok(ownerScene);
  assert.ok(unrelatedScene);
  const mutatedPlans = [
    {
      ...fixture.plan,
      sourceAccounting: fixture.plan.sourceAccounting.map((entry) => (
        entry.sourceId === relationshipEntry.sourceId
          ? { ...entry, sceneIds: [ownerScene.id, ownerScene.id] }
          : entry
      )),
    },
    {
      ...fixture.plan,
      sourceAccounting: fixture.plan.sourceAccounting.map((entry) => (
        entry.sourceId === relationshipEntry.sourceId
          ? { ...entry, sceneIds: [ownerScene.id, unrelatedScene.id] }
          : entry
      )),
    },
    {
      ...fixture.plan,
      scenes: fixture.plan.scenes.map((scene) => (
        scene.id === unrelatedScene.id
          ? { ...scene, sourceStepIds: [...scene.sourceStepIds, relationshipEntry.sourceId] }
          : scene
      )),
    },
  ];

  for (const plan of mutatedPlans) {
    const diagnostics = validateVisualTeachingPlan(
      plan,
      fixture.manifest,
      fixture.storyboard,
      fixture.dispositions,
    );
    assert.equal(diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
  }
});

test('returns self-validated future semantic fixtures', () => {
  assert.equal(relationshipDiagramSemanticFixture().layoutId, 'relationship-diagram');
  assert.equal(questionChoicesSemanticFixture().layoutId, 'question-choices');
});
