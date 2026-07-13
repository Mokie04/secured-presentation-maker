import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isVisualTeachingComposerV1Enabled,
  validateVisualTeachingPlan,
} from '../lib/visualTeachingPlan.ts';
import { classifySourceContent } from '../lib/sourceContentDisposition.ts';
import {
  questionChoicesSemanticFixture,
  relationshipDiagramSemanticFixture,
  validVisualPlanFixture,
} from './fixtures/visualTeachingComposerFixtures.ts';

test('accepts a fully reconciled visual teaching plan', () => {
  const fixture = validVisualPlanFixture();
  assert.deepEqual(validateVisualTeachingPlan(
    fixture.plan,
    fixture.manifest,
    fixture.storyboard,
    fixture.dispositions,
  ), []);
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

test('accounts for a learner-visible source field through scene field ownership', () => {
  const fixture = validVisualPlanFixture();
  const field = {
    id: 'field-learner-reference',
    label: 'References',
    value: 'Learners consult the source before comparing both perspectives.',
    state: 'present' as const,
    sourceOrder: 9,
    sourceLocation: { blockId: 'field-learner-reference' },
  };
  const manifest = {
    ...fixture.manifest,
    units: [{
      ...fixture.manifest.units[0],
      fields: { learnerReference: field },
    }],
  };
  const fieldScreenId = 'screen-field-reference';
  const storyboard = {
    ...fixture.storyboard,
    screens: [...fixture.storyboard.screens, {
      id: fieldScreenId,
      unitId: fixture.plan.unitId,
      sourceStepIds: [],
      sourceObjectiveIds: [],
      sourceFieldIds: [field.id],
      instructionalPurpose: 'Expose a source-required learner reference action.',
      learnerTitle: 'Reference Comparison',
      learnerContent: {
        task: field.value,
        questions: [],
        directions: [field.value],
        successCriteria: [],
      },
      teacherNotes: '',
      requiredEvidence: [],
      requiredOutputs: [],
      communicationIntent: 'activity-task' as const,
    }],
    sourceFieldAccounting: [...fixture.storyboard.sourceFieldAccounting, {
      sourceFieldId: field.id,
      unitId: fixture.plan.unitId,
      screenIds: [fieldScreenId],
      state: field.state,
      status: 'metadata' as const,
    }],
  };
  const dispositionResult = classifySourceContent(manifest, storyboard);
  assert.equal(dispositionResult.ok, true);
  if (!dispositionResult.ok) return;
  const fieldDecision = dispositionResult.decisions.find((item) => item.sourceId === field.id);
  assert.ok(fieldDecision);
  const lastScene = fixture.plan.scenes.at(-1);
  assert.ok(lastScene);
  const fieldScene = {
    ...lastScene,
    id: 'visual-scene-field',
    sourceStepIds: [],
    sourceObjectiveIds: [],
    sourceFieldIds: [field.id],
    storyboardScreenIds: [fieldScreenId],
    learnerTitle: 'Reference Comparison',
    visibleContent: {
      statement: field.value,
      points: [],
      cards: [],
      steps: [],
    },
    visualGrammar: 'activity-board' as const,
  };
  const plan = {
    ...fixture.plan,
    scenes: [...fixture.plan.scenes, fieldScene],
    sourceAccounting: [...fixture.plan.sourceAccounting, {
      ...fieldDecision,
      sceneIds: [fieldScene.id],
    }],
  };

  assert.deepEqual(validateVisualTeachingPlan(
    plan,
    manifest,
    storyboard,
    dispositionResult.decisions,
  ), []);
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
