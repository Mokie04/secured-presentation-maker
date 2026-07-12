import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import {
  END_TO_END_VALIDATION_VERSION,
  isEndToEndValidationV1Enabled,
  validateEndToEndScenePresentation,
} from '../lib/endToEndValidation.ts';
import { resolveEndToEndValidatedScenePresentationForGeneration } from '../lib/endToEndSceneBoundary.ts';
import {
  buildDenseStoryboardEndToEndFixture,
  buildEvidenceOutputEndToEndFixture,
} from './fixtures/endToEndValidationFixtures.ts';

test('accepts only documented true-like Gate 5 flag values', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(isEndToEndValidationV1Enabled(value), true);
  }
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) {
    assert.equal(isEndToEndValidationV1Enabled(value), false);
  }
});

test('builds a passing end-to-end validation report for a valid source-primary scene deck', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = validateEndToEndScenePresentation(fixture);

  assert.equal(result.ok, true);
  assert.equal(result.report.contractVersion, END_TO_END_VALIDATION_VERSION);
  assert.equal(result.report.storyboard.sourceStepCoverageRatio, 1);
  assert.equal(result.report.semanticSpecs.objectiveCoverageRatio, 1);
  assert.equal(result.report.scenes.fullSlideRasterCount, 0);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, true);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, true);
});

test('preserves complete source coverage across dense continuation scenes', async () => {
  const fixture = await buildDenseStoryboardEndToEndFixture();
  const result = validateEndToEndScenePresentation(fixture);

  assert.equal(result.ok, true);
  assert.equal(result.report.storyboard.sourceStepCoverageRatio, 1);
  assert.equal(result.report.semanticSpecs.objectiveCoverageRatio, 1);
  assert.equal(result.report.scenes.overflowCount, 0);
  assert.equal(result.report.scenes.uneditableVisibleTextCount, 0);
  assert.equal(result.report.scenes.fullSlideRasterCount, 0);
  assert.equal(result.report.storyboard.teacherScriptViolationCount, 0);
  assert.equal(result.report.scenes.renderedSceneCount <= fixture.storyboard.screens.length * 2 + 2, true);
  assert.equal(result.report.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_scene_budget_exceeded'), false);
});

test('keeps delivery and cache success available for a nonblocking scene-budget warning', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const lastScene = fixture.presentation.scenes.at(-1);
  assert.ok(lastScene);
  const presentation = {
    ...fixture.presentation,
    scenes: [
      ...fixture.presentation.scenes,
      ...Array.from({ length: 10 }, (_, index) => ({
        ...lastScene,
        id: `scene-warning-${String(index + 1).padStart(3, '0')}`,
        elements: lastScene.elements.map((element) => ({
          ...element,
          id: `${element.id}-warning-${String(index + 1).padStart(3, '0')}`,
        })),
        readingOrder: lastScene.readingOrder.map((id) => `${id}-warning-${String(index + 1).padStart(3, '0')}`),
      })),
    ],
  };

  const result = validateEndToEndScenePresentation({ ...fixture, presentation });

  assert.equal(result.ok, true);
  assert.equal(result.report.scenes.sceneBudgetWarningCount, 1);
  assert.equal(result.report.scenes.blocking, 0);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, true);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, true);
});

test('returns exact Gate 4 behavior when Gate 5 flag is disabled', async () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'false',
    fixture.sourceManifest,
    fixture.storyboard,
    { title: 'Sanitized Fixture Deck' },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.presentation);
  assert.equal('validationReport' in result, false);
});

test('blocks source-primary scene delivery on a release-threshold failure', async () => {
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

  const result = validateEndToEndScenePresentation(invalid);

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_source_step_coverage_failed'), true);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, false);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, false);
});

test('source-primary Gate 5 blocks before delivery and before adapter-side cache success', async () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.sourceManifest,
    {
      ...fixture.storyboard,
      screens: [],
    },
    { title: 'Sanitized Fixture Deck' },
  );

  assert.equal(result.ok, false);
});

test('topic-only Gate 5 remains unchanged', async () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.sourceManifest,
    fixture.storyboard,
    { title: 'Sanitized Fixture Deck' },
  );

  assert.deepEqual(result, { ok: true, presentation: null });
});
