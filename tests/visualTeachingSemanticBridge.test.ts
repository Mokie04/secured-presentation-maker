import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileSemanticSlideSpecsToScenes,
  getSceneVisibleText,
} from '../lib/compiledSlideScene.ts';
import { validateVisualTeachingPlan } from '../lib/visualTeachingPlan.ts';
import { buildSemanticSlideSpecsFromVisualTeachingPlan } from '../lib/visualTeachingSemanticBridge.ts';
import { validVisualPlanFixture } from './fixtures/visualTeachingComposerFixtures.ts';

test('maps visual scenes to semantic specs with merged provenance and typed structures', () => {
  const fixture = validVisualPlanFixture();
  const result = buildSemanticSlideSpecsFromVisualTeachingPlan(fixture.plan, fixture.storyboard);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.specs.map((spec) => spec.id),
    result.specs.map((_, index) => `semslide-${String(index + 1).padStart(3, '0')}`),
  );
  assert.equal(result.specs.some((spec) => spec.layoutId === 'relationship-diagram'), true);
  assert.equal(result.specs.some((spec) => spec.layoutId === 'question-choices'), true);
  assert.equal(result.specs.flatMap((spec) => spec.sourceStepIds).includes(fixture.relationshipStepId), true);
  assert.equal(result.specs.every((spec) => spec.storyboardScreenIds.length > 0), true);

  for (const [index, spec] of result.specs.entries()) {
    const scene = fixture.plan.scenes[index];
    assert.deepEqual(spec.storyboardScreenIds, scene.storyboardScreenIds);
    assert.deepEqual(spec.sourceStepIds, scene.sourceStepIds);
    assert.deepEqual(spec.sourceObjectiveIds, scene.sourceObjectiveIds);
    assert.deepEqual(spec.sourceFieldIds, scene.sourceFieldIds);
    assert.equal(spec.storyboardScreenId, scene.storyboardScreenIds[0]);
  }

  const relationship = result.specs.find((spec) => spec.layoutId === 'relationship-diagram');
  const question = result.specs.find((spec) => spec.layoutId === 'question-choices');
  assert.equal(relationship?.slots.diagram?.kind, 'diagram');
  assert.equal(question?.slots.question?.kind, 'question');
});

test('merges only contiguous storyboard ownership into one semantic spec', () => {
  const fixture = validVisualPlanFixture();
  const relationshipIndex = fixture.plan.scenes.findIndex((scene) => scene.visualGrammar === 'relationship-diagram');
  assert.notEqual(relationshipIndex, -1);
  const nextScene = fixture.plan.scenes[relationshipIndex + 1];
  assert.ok(nextScene);
  const mergedScene = {
    ...fixture.plan.scenes[relationshipIndex],
    sourceStepIds: [
      ...fixture.plan.scenes[relationshipIndex].sourceStepIds,
      ...nextScene.sourceStepIds,
    ],
    sourceObjectiveIds: [
      ...fixture.plan.scenes[relationshipIndex].sourceObjectiveIds,
      ...nextScene.sourceObjectiveIds,
    ],
    sourceFieldIds: [
      ...fixture.plan.scenes[relationshipIndex].sourceFieldIds,
      ...nextScene.sourceFieldIds,
    ],
    storyboardScreenIds: [
      ...fixture.plan.scenes[relationshipIndex].storyboardScreenIds,
      ...nextScene.storyboardScreenIds,
    ],
  };
  const plan = {
    ...fixture.plan,
    scenes: [
      ...fixture.plan.scenes.slice(0, relationshipIndex),
      mergedScene,
      ...fixture.plan.scenes.slice(relationshipIndex + 2),
    ],
    sourceAccounting: fixture.plan.sourceAccounting.map((entry) => ({
      ...entry,
      sceneIds: entry.sceneIds.includes(nextScene.id)
        ? [mergedScene.id]
        : entry.sceneIds,
    })),
  };
  assert.deepEqual(validateVisualTeachingPlan(
    plan,
    fixture.manifest,
    fixture.storyboard,
    fixture.dispositions,
  ), []);

  const result = buildSemanticSlideSpecsFromVisualTeachingPlan(plan, fixture.storyboard);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const merged = result.specs[relationshipIndex];
  assert.deepEqual(merged.storyboardScreenIds, mergedScene.storyboardScreenIds);
  assert.deepEqual(merged.sourceStepIds, mergedScene.sourceStepIds);
});

test('rejects non-contiguous or mismatched merged storyboard provenance', () => {
  const fixture = validVisualPlanFixture();
  const first = fixture.plan.scenes[1];
  const nonAdjacent = fixture.plan.scenes[3];
  const invalid = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === first.id
      ? { ...scene, storyboardScreenIds: [first.storyboardScreenIds[0], nonAdjacent.storyboardScreenIds[0]] }
      : scene),
  };

  const result = buildSemanticSlideSpecsFromVisualTeachingPlan(invalid, fixture.storyboard);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((item) => item.code === 'semantic_spec_storyboard_mapping_invalid'), true);
});

test('maps every structured visible-content shape into typed semantic slots', () => {
  const fixture = validVisualPlanFixture();
  const baseScene = fixture.plan.scenes[1];
  const screen = fixture.storyboard.screens.find((item) => item.id === baseScene.storyboardScreenIds[0]);
  assert.ok(screen);
  const scene = {
    ...baseScene,
    visibleContent: {
      statement: 'Concise source-backed statement.',
      points: ['Point one'],
      cards: [{ id: 'card-1', title: 'Claim', body: 'Source-backed body' }],
      steps: [{ id: 'stage-1', label: 'Observe', body: 'Record the supplied evidence.' }],
      table: { headers: ['Observation', 'Evidence'], rows: [['Pattern', 'Recorded']] },
      question: { prompt: 'Which pattern is supported?', choices: [{ id: 'A', text: 'Pattern alpha' }] },
      diagram: {
        nodes: [{ id: 'node-1', label: 'Evidence', role: 'source' as const }],
        edges: [],
      },
    },
  };
  const plan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((item) => item.id === scene.id ? scene : item),
  };

  const result = buildSemanticSlideSpecsFromVisualTeachingPlan(plan, fixture.storyboard);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const slots = result.specs.find((spec) => spec.storyboardScreenId === screen.id)?.slots;
  assert.ok(slots);
  assert.equal(slots.statement?.kind, 'text');
  assert.equal(slots.points?.kind, 'list');
  assert.equal(slots.cards?.kind, 'cards');
  assert.equal(slots.steps?.kind, 'steps');
  assert.equal(slots.table?.kind, 'table');
  assert.equal(slots.question?.kind, 'question');
  assert.equal(slots.diagram?.kind, 'diagram');
});

test('retains question and diagram copy in the generic native compatibility scene', () => {
  const fixture = validVisualPlanFixture();
  const semantic = buildSemanticSlideSpecsFromVisualTeachingPlan(fixture.plan, fixture.storyboard);
  assert.equal(semantic.ok, true);
  if (!semantic.ok) return;

  const compiled = compileSemanticSlideSpecsToScenes(semantic.specs, { title: 'Compatibility Fixture' });
  assert.equal(compiled.ok, true);
  if (!compiled.ok) return;
  const visibleText = compiled.presentation.scenes.flatMap(getSceneVisibleText).join(' ');

  assert.match(visibleText, /supplied push/i);
  assert.match(visibleText, /pattern alpha/i);
});
