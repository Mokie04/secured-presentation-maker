import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isVisualTeachingComposerV1Enabled,
  validateVisualTeachingPlan,
} from '../lib/visualTeachingPlan.ts';
import { validVisualPlanFixture } from './fixtures/visualTeachingComposerFixtures.ts';

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
