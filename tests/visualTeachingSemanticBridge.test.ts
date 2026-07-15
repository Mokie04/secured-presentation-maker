import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileSemanticSlideSpecsToScenes,
  getSceneVisibleText,
} from '../lib/compiledSlideScene.ts';
import { validateSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import {
  validateVisualTeachingPlan,
  type VisualTeachingScene,
} from '../lib/visualTeachingPlan.ts';
import { buildSemanticSlideSpecsFromVisualTeachingPlan } from '../lib/visualTeachingSemanticBridge.ts';
import { validVisualPlanFixture } from './fixtures/visualTeachingComposerFixtures.ts';

const buildFixtureSemanticSpecs = (
  fixture: ReturnType<typeof validVisualPlanFixture>,
  plan = fixture.plan,
) => buildSemanticSlideSpecsFromVisualTeachingPlan({
  sourceManifest: fixture.manifest,
  storyboard: fixture.storyboard,
  dispositions: fixture.dispositions,
  plan,
});

const mergeSceneOwnership = (
  fixture: ReturnType<typeof validVisualPlanFixture>,
  firstScene: VisualTeachingScene,
  nextScene: VisualTeachingScene,
): VisualTeachingScene => {
  const storyboardScreenIds = [...firstScene.storyboardScreenIds, ...nextScene.storyboardScreenIds];
  const screens = storyboardScreenIds.map((screenId) => (
    fixture.storyboard.screens.find((screen) => screen.id === screenId)!
  ));
  const learnerVisibleSourceIds = new Set(fixture.dispositions
    .filter((item) => item.disposition === 'learner-visible')
    .map((item) => item.sourceId));
  const learnerVisibleScreens = screens.filter((screen) => (
    [...screen.sourceObjectiveIds, ...screen.sourceStepIds, ...screen.sourceFieldIds]
      .some((sourceId) => learnerVisibleSourceIds.has(sourceId))
  ));

  return {
    ...firstScene,
    sourceStepIds: screens.flatMap((screen) => screen.sourceStepIds),
    sourceObjectiveIds: screens.flatMap((screen) => screen.sourceObjectiveIds),
    sourceFieldIds: screens.flatMap((screen) => screen.sourceFieldIds),
    storyboardScreenIds,
    teacherNotes: screens.map((screen) => screen.teacherNotes).filter(Boolean).join('\n'),
    requiredEvidence: learnerVisibleScreens.flatMap((screen) => screen.requiredEvidence),
    requiredOutputs: learnerVisibleScreens.flatMap((screen) => screen.requiredOutputs),
  };
};

test('maps visual scenes to semantic specs with merged provenance and typed structures', () => {
  const fixture = validVisualPlanFixture();
  const result = buildFixtureSemanticSpecs(fixture);

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
    assert.equal(spec.visualTeachingSceneId, scene.id);
    assert.equal(spec.storyboardScreenId, scene.storyboardScreenIds[0]);
  }

  const relationship = result.specs.find((spec) => spec.layoutId === 'relationship-diagram');
  const question = result.specs.find((spec) => spec.layoutId === 'question-choices');
  assert.equal(relationship?.slots.diagram?.kind, 'diagram');
  assert.equal(question?.slots.question?.kind, 'question');
});

test('maps process cards to separate bounded native process steps', () => {
  const fixture = validVisualPlanFixture();
  const target = fixture.plan.scenes.find((scene) => scene.visualGrammar === 'activity-board');
  assert.ok(target);
  const processScene = {
    ...target,
    teachingMove: 'explain' as const,
    visualGrammar: 'process-flow' as const,
    visibleContent: {
      points: [],
      cards: [
        { id: 'phase-1', title: 'Observe', body: 'Inspect the supplied setup, record the first pattern, compare it with the reference observation, and note the measurement that supports the comparison.' },
        { id: 'phase-2', title: 'Compare', body: 'Compare the two recorded observations, identify the strongest evidence, and explain how the measured result supports the source-backed relationship.' },
        { id: 'phase-3', title: 'Explain', body: 'State the relationship supported by the record, cite the measured result, and describe how the evidence rules out the alternative pattern.' },
      ],
      steps: [],
    },
  };
  const plan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === target.id ? processScene : scene),
  };
  const result = buildFixtureSemanticSpecs(fixture, plan);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const spec = result.specs.find((candidate) => candidate.visualTeachingSceneId === processScene.id);
  assert.equal(spec?.slots.body?.kind, 'list');
  if (spec?.slots.body?.kind !== 'list') return;
  assert.equal(spec.slots.body.items.length, 3);
  assert.equal(compileSemanticSlideSpecsToScenes(result.specs, {
    title: 'Process Fixture',
    visualSystemsByUnitId: fixture.endToEndInput.visualSystems.systemsByUnitId,
  }).ok, true);
});

test('keeps bounded question choices readable with visual-system typography', () => {
  const fixture = validVisualPlanFixture();
  const result = buildFixtureSemanticSpecs(fixture);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const question = result.specs.find((spec) => spec.layoutId === 'question-choices');
  assert.ok(question?.slots.question?.kind === 'question');
  const denseQuestion = {
    ...question,
    slots: {
      ...question.slots,
      question: {
        ...question.slots.question,
        choices: question.slots.question.choices.map((choice, index) => ({
          ...choice,
          text: `${choice.text} with a source-backed explanation that distinguishes recorded pattern ${index + 1}`,
        })),
      },
    },
  };

  assert.equal(compileSemanticSlideSpecsToScenes([denseQuestion], {
    title: 'Question Fixture',
    visualSystemsByUnitId: fixture.endToEndInput.visualSystems.systemsByUnitId,
  }).ok, true);
});

test('revalidates plan accounting before authorizing an omitted learner-visible screen', () => {
  const fixture = validVisualPlanFixture();
  const relationshipScene = fixture.plan.scenes.find((scene) => scene.sourceStepIds.includes(fixture.relationshipStepId));
  assert.ok(relationshipScene);
  const invalidPlan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.filter((scene) => scene.id !== relationshipScene.id),
    sourceAccounting: fixture.plan.sourceAccounting.map((entry) => entry.sourceId === fixture.relationshipStepId
      ? {
          ...entry,
          disposition: 'speaker-notes' as const,
          reason: 'teacher-action-notes' as const,
          sceneIds: [],
        }
      : entry),
  };

  const result = buildFixtureSemanticSpecs(fixture, invalidPlan);

  assert.equal(result.ok, false);
});

test('does not trust caller-supplied dispositions that disagree with deterministic classification', () => {
  const fixture = validVisualPlanFixture();
  const relationshipScene = fixture.plan.scenes.find((scene) => scene.sourceStepIds.includes(fixture.relationshipStepId));
  assert.ok(relationshipScene);
  const dispositions = fixture.dispositions.map((entry) => entry.sourceId === fixture.relationshipStepId
    ? { ...entry, disposition: 'speaker-notes' as const, reason: 'teacher-action-notes' as const }
    : entry);
  const plan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.filter((scene) => scene.id !== relationshipScene.id),
    sourceAccounting: fixture.plan.sourceAccounting.map((entry) => entry.sourceId === fixture.relationshipStepId
      ? { ...dispositions.find((item) => item.sourceId === entry.sourceId)!, sceneIds: [] }
      : entry),
  };

  const result = buildSemanticSlideSpecsFromVisualTeachingPlan({
    sourceManifest: fixture.manifest,
    storyboard: fixture.storyboard,
    dispositions,
    plan,
  });

  assert.equal(result.ok, false);
});

test('merges only contiguous storyboard ownership into one semantic spec', () => {
  const fixture = validVisualPlanFixture();
  const relationshipIndex = fixture.plan.scenes.findIndex((scene) => scene.visualGrammar === 'relationship-diagram');
  assert.notEqual(relationshipIndex, -1);
  const nextScene = fixture.plan.scenes[relationshipIndex + 1];
  assert.ok(nextScene);
  const mergedScene = mergeSceneOwnership(
    fixture,
    fixture.plan.scenes[relationshipIndex],
    nextScene,
  );
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

  const result = buildFixtureSemanticSpecs(fixture, plan);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const merged = result.specs[relationshipIndex];
  assert.deepEqual(merged.storyboardScreenIds, mergedScene.storyboardScreenIds);
  assert.deepEqual(merged.sourceStepIds, mergedScene.sourceStepIds);
});

test('allows merged storyboard ownership across validated non-learner screens', () => {
  const fixture = validVisualPlanFixture();
  const firstScene = fixture.plan.scenes[0];
  const nextScene = fixture.plan.scenes[1];
  const mergedScene = mergeSceneOwnership(fixture, firstScene, nextScene);
  const plan = {
    ...fixture.plan,
    scenes: [mergedScene, ...fixture.plan.scenes.slice(2)],
    sourceAccounting: fixture.plan.sourceAccounting.map((entry) => ({
      ...entry,
      sceneIds: entry.sceneIds.includes(nextScene.id) ? [mergedScene.id] : entry.sceneIds,
    })),
  };
  assert.deepEqual(validateVisualTeachingPlan(
    plan,
    fixture.manifest,
    fixture.storyboard,
    fixture.dispositions,
  ), []);

  const result = buildFixtureSemanticSpecs(fixture, plan);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.specs[0].storyboardScreenIds, [
    ...firstScene.storyboardScreenIds,
    ...nextScene.storyboardScreenIds,
  ]);
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

  const result = buildFixtureSemanticSpecs(fixture, invalid);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((item) => item.code === 'semantic_spec_contract_invalid'), true);
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

  const result = buildFixtureSemanticSpecs(fixture, plan);

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
  const semantic = buildFixtureSemanticSpecs(fixture);
  assert.equal(semantic.ok, true);
  if (!semantic.ok) return;

  const compiled = compileSemanticSlideSpecsToScenes(semantic.specs, { title: 'Compatibility Fixture' });
  assert.equal(compiled.ok, true);
  if (!compiled.ok) return;
  const visibleText = compiled.presentation.scenes.flatMap(getSceneVisibleText).join(' ');

  assert.match(visibleText, /supplied push/i);
  assert.match(visibleText, /pattern alpha/i);
});

test('retains distinct evidence and output requirements as editable compiled text', () => {
  const fixture = validVisualPlanFixture();
  const evidence = fixture.plan.scenes.flatMap((scene) => scene.requiredEvidence)[0];
  const output = fixture.plan.scenes.flatMap((scene) => scene.requiredOutputs)[0];
  assert.ok(evidence);
  assert.ok(output);
  const semantic = buildFixtureSemanticSpecs(fixture);
  assert.equal(semantic.ok, true);
  if (!semantic.ok) return;
  const compiled = compileSemanticSlideSpecsToScenes(semantic.specs, { title: 'Requirement Fixture' });
  assert.equal(compiled.ok, true);
  if (!compiled.ok) return;
  const visibleText = compiled.presentation.scenes.flatMap(getSceneVisibleText).join(' ');
  const editableText = compiled.presentation.scenes.flatMap((scene) => scene.elements).flatMap((element) => {
    if (!element.editable) return [];
    if (element.kind === 'text') return element.runs.map((run) => run.text);
    if (element.kind === 'table') return [...element.headers, ...element.rows.flat()];
    return [];
  }).join(' ');

  assert.equal(visibleText.includes(evidence), true);
  assert.equal(visibleText.includes(output), true);
  assert.equal(editableText.includes(evidence), true);
  assert.equal(editableText.includes(output), true);
});

test('rejects semantic field provenance that differs from its exact visual scene', () => {
  const fixture = validVisualPlanFixture();
  const semantic = buildFixtureSemanticSpecs(fixture);
  assert.equal(semantic.ok, true);
  if (!semantic.ok) return;
  const invalid = semantic.specs.map((spec, index) => index === 0
    ? { ...spec, sourceFieldIds: ['field-foreign'] }
    : spec);

  const diagnostics = validateSemanticSlideSpecs(invalid, fixture.storyboard, {
    sourceManifest: fixture.manifest,
    dispositions: fixture.dispositions,
    visualTeachingPlan: fixture.plan,
  });

  assert.equal(diagnostics.some((item) => item.code === 'semantic_spec_source_field_mismatch'), true);
});

test('rejects foreign and cross-unit visual scene field ownership before mapping', () => {
  const fixture = validVisualPlanFixture();
  const templateUnit = fixture.manifest.units[0];
  const foreignField = {
    id: 'field-owned-by-unit-002',
    key: 'crossUnitField',
    label: 'Cross-unit source field',
    value: 'Source-safe field content.',
    state: 'present' as const,
    sourceOrder: 99,
    sourceLocation: { blockId: 'field-owned-by-unit-002' },
  };
  const secondUnit = {
    ...templateUnit,
    id: 'unit-002',
    label: 'Session 2',
    sourceOrder: 99,
    objectiveIds: [],
    steps: [],
    fields: { crossUnitField: foreignField },
  };
  const storyboard = {
    ...fixture.storyboard,
    provenance: {
      ...fixture.storyboard.provenance,
      selectedUnitIds: [...fixture.storyboard.provenance.selectedUnitIds, secondUnit.id],
    },
  };
  const targetScene = fixture.plan.scenes[0];
  const plan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene): VisualTeachingScene => scene.id === targetScene.id
      ? { ...scene, sourceFieldIds: [foreignField.id] }
      : scene),
    sourceAccounting: [
      ...fixture.plan.sourceAccounting,
      {
        sourceKind: 'field' as const,
        sourceId: foreignField.id,
        unitId: secondUnit.id,
        sourceOrder: foreignField.sourceOrder,
        sourceLabel: foreignField.label,
        disposition: 'learner-visible' as const,
        reason: 'instructional-step-visible' as const,
        sceneIds: [targetScene.id],
      },
    ],
    provenance: {
      ...fixture.plan.provenance,
      selectedUnitIds: [...fixture.plan.provenance.selectedUnitIds, secondUnit.id],
    },
  };
  const manifest = { ...fixture.manifest, units: [...fixture.manifest.units, secondUnit] };

  const dispositions = [
    ...fixture.dispositions,
    {
      sourceKind: 'field' as const,
      sourceId: foreignField.id,
      unitId: secondUnit.id,
      sourceOrder: foreignField.sourceOrder,
      sourceLabel: foreignField.label,
      disposition: 'learner-visible' as const,
      reason: 'instructional-step-visible' as const,
    },
  ];
  const result = buildSemanticSlideSpecsFromVisualTeachingPlan({
    sourceManifest: manifest,
    storyboard,
    dispositions,
    plan,
  });

  assert.equal(result.ok, false);
  assert.ok(manifest.units.some((unit) => unit.id === secondUnit.id));
});
