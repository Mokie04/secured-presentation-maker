import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSourceAlignment } from '../lib/sourceAlignmentValidation.ts';
import {
  buildEvidenceOutputEndToEndFixture,
  buildFiveSessionEndToEndFixture,
  buildMultiObjectiveEndToEndFixture,
  buildSourceBackedBlankTaskEndToEndFixture,
  buildTeacherScriptEndToEndFixture,
} from './fixtures/endToEndValidationFixtures.ts';

test('passes mandatory source-step coverage and objective preservation for valid fixtures', async () => {
  for (const fixtureBuilder of [
    buildEvidenceOutputEndToEndFixture,
    buildFiveSessionEndToEndFixture,
    buildMultiObjectiveEndToEndFixture,
    buildTeacherScriptEndToEndFixture,
  ]) {
    const result = validateSourceAlignment(await fixtureBuilder());
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.summary.sourceStepCoverageRatio, 1);
    assert.equal(result.summary.objectiveCoverageRatio, 1);
  }
});

test('blocks omitted source-step coverage', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, index) => index === 1
        ? { ...scene, sourceStepIds: [] }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_source_step_coverage_failed'), true);
});

test('blocks objective reorder, duplicate, or ownership mismatch', async () => {
  const fixture = await buildMultiObjectiveEndToEndFixture();
  const invalid = {
    ...fixture,
    semanticSpecs: fixture.semanticSpecs.map((spec, index) => index === 0
      ? { ...spec, sourceObjectiveIds: [...spec.sourceObjectiveIds].reverse() }
      : spec),
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_objective_preservation_failed'), true);
});

test('blocks sequence inversions', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: [...fixture.presentation.scenes].reverse(),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_sequence_inversion'), true);
});

test('blocks foreign-session source IDs in compiled scenes', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, index) => index === 0
        ? { ...scene, unitId: 'unit-999', sourceStepIds: ['step-999'] }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_foreign_session_content'), true);
});

test('blocks unsupported invented visible activity or assessment text', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
        ? {
            ...scene,
            elements: scene.elements.map((element, elementIndex) => element.kind === 'text' && elementIndex === 1
              ? { ...element, runs: [{ ...element.runs[0], text: 'Complete an unlisted homework assignment and quiz.' }] }
              : element),
          }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_unsupported_invention'), true);
});

test('blocks visible teacher-script and blank-field invention', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
        ? {
            ...scene,
            elements: scene.elements.map((element, elementIndex) => element.kind === 'text' && elementIndex === 1
              ? { ...element, runs: [{ ...element.runs[0], text: 'The teacher will ask learners to answer the blank source field.' }] }
              : element),
          }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_teacher_script_visible'), true);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_blank_field_invented'), true);
});

test('allows source-backed blank-response wording without treating it as invented', async () => {
  const fixture = await buildSourceBackedBlankTaskEndToEndFixture();
  const result = validateSourceAlignment(fixture);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_blank_field_invented'), false);
});

test('blocks blank-response wording invented by both storyboard and scene when source text does not support it', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const targetScreen = fixture.storyboard.screens[1];
  const invalid = {
    ...fixture,
    storyboard: {
      ...fixture.storyboard,
      screens: fixture.storyboard.screens.map((screen) => screen.id === targetScreen.id
        ? {
            ...screen,
            learnerContent: {
              ...screen.learnerContent,
              task: 'Complete an invented blank response field.',
            },
          }
        : screen),
    },
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene) => scene.storyboardScreenId === targetScreen.id
        ? {
            ...scene,
            elements: scene.elements.map((element) => element.kind === 'text' && element.role !== 'title'
              ? { ...element, runs: [{ ...element.runs[0], text: 'Complete an invented blank response field.' }] }
              : element),
          }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_blank_field_invented'), true);
});

test('does not let source-backed blank-space wording authorize invented missing-source wording', async () => {
  const fixture = await buildSourceBackedBlankTaskEndToEndFixture();
  const targetScene = fixture.presentation.scenes.find((scene) => scene.sourceStepIds.length > 0);
  assert.ok(targetScene);
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene) => scene.id === targetScene.id
        ? {
            ...scene,
            elements: scene.elements.map((element) => element.kind === 'text' && element.role === 'body'
              ? { ...element, runs: [{ ...element.runs[0], text: 'The required source is not provided. Create a replacement response.' }] }
              : element),
          }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_blank_field_invented'), true);
});
