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
  buildVisualTeachingQualityEndToEndFixture,
} from './fixtures/endToEndValidationFixtures.ts';
import { validVisualPlanFixture } from './fixtures/visualTeachingComposerFixtures.ts';

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
  assert.equal('presentationQuality' in result.report, false);
});

test('includes a passing presentation quality report when a visual teaching plan exists', () => {
  const fixture = buildVisualTeachingQualityEndToEndFixture();
  const result = validateEndToEndScenePresentation(fixture);

  assert.equal(result.ok, true);
  assert.ok(result.report.presentationQuality);
  assert.equal(result.report.presentationQuality.contractVersion, 'presentation-quality-v1');
  assert.equal(result.report.presentationQuality.meaningfulVisualGrammarRatio >= 0.75, true);
  assert.equal(result.report.presentationQuality.explanatoryStructureRatio >= 0.40, true);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, true);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, true);
});

test('blocks delivery and success-cache writes when visual presentation quality fails', () => {
  const fixture = buildVisualTeachingQualityEndToEndFixture();
  const presentation = structuredClone(fixture.presentation);
  for (const [index, title] of ['Learning Task 1', 'Learning Task (continued)'].entries()) {
    const titleElement = presentation.scenes[index].elements.find((element) => (
      element.kind === 'text' && element.role === 'title'
    ));
    assert.ok(titleElement?.kind === 'text');
    titleElement.runs = [{ text: title }];
  }

  const result = validateEndToEndScenePresentation({ ...fixture, presentation });

  assert.equal(result.ok, false);
  assert.ok(result.report.presentationQuality);
  assert.equal(result.report.presentationQuality.repeatedGenericTitleCount, 1);
  assert.equal(result.diagnostics.some((diagnostic) => (
    diagnostic.code === 'e2e_presentation_quality_failed'
  )), true);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, false);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, false);
});

test('blocks delivery and cache when rich metadata points to stripped title-and-body scenes', () => {
  const fixture = buildVisualTeachingQualityEndToEndFixture();
  const presentation = structuredClone(fixture.presentation);
  for (const scene of presentation.scenes.slice(0, 4)) {
    const title = scene.elements.find((element) => element.kind === 'text' && element.role === 'title');
    const body = scene.elements.find((element) => element.kind === 'text' && element.role !== 'title');
    assert.ok(title);
    assert.ok(body);
    scene.elements = [title, body];
    scene.readingOrder = [title.id, body.id];
  }

  const result = validateEndToEndScenePresentation({ ...fixture, presentation });

  assert.equal(result.ok, false);
  assert.ok(result.report.presentationQuality);
  assert.equal(result.report.presentationQuality.meaningfulVisualGrammarRatio < 0.75, true);
  assert.equal(result.report.presentationQuality.plainTitleBodyRatio > 0.25, true);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, false);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, false);
});

test('blocks an invalid visual plan explicitly before delivery and cache success', () => {
  const fixture = buildVisualTeachingQualityEndToEndFixture();
  const visualTeachingPlan = structuredClone(fixture.visualTeachingPlan);
  const accounting = visualTeachingPlan.sourceAccounting.find((entry) => (
    entry.disposition === 'learner-visible' && entry.sceneIds.length > 0
  ));
  assert.ok(accounting);
  accounting.sceneIds = [];

  const result = validateEndToEndScenePresentation({ ...fixture, visualTeachingPlan });

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((diagnostic) => (
    diagnostic.code === 'e2e_visual_teaching_plan_invalid'
  )), true);
  assert.equal(result.diagnostics.some((diagnostic) => (
    diagnostic.code === 'e2e_presentation_quality_failed'
  )), true);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, false);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, false);
});

test('blocks delivery and cache when a scene would export a clipped overflowing table', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const presentation = structuredClone(fixture.presentation);
  const scene = presentation.scenes[0];
  assert.ok(scene);
  const clippedTable = {
    id: 'dense-single-row-table',
    kind: 'table' as const,
    frame: { x: 648, y: 158, w: 506, h: 340 },
    editable: true,
    readingOrder: 99,
    headers: ['#', 'Required evidence or output'],
    rows: [[
      '1',
      'This source-backed row needs several wrapped lines in one table cell while the table still has frame height.',
    ]],
    fontSize: 21,
    headerFill: '0F766E',
    cellFill: 'ECFDF5',
    textColor: '111827',
  };
  scene.elements = [...scene.elements, clippedTable];
  scene.readingOrder = [...scene.readingOrder, clippedTable.id];

  const result = validateEndToEndScenePresentation({ ...fixture, presentation });

  assert.equal(result.ok, false);
  assert.equal(result.report.scenes.overflowCount >= 1, true);
  assert.equal(result.diagnostics.some((diagnostic) => (
    diagnostic.code === 'e2e_scene_render_invalid' && diagnostic.severity === 'blocking'
  )), true);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, false);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, false);
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

test('composed visual-plan quality failure blocks delivery and cache success', async () => {
  const fixture = validVisualPlanFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const plan = structuredClone(fixture.plan);
  for (const [index, title] of ['Learning Task 1', 'Learning Task (continued)'].entries()) {
    plan.scenes[index].learnerTitle = title;
  }
  let releaseCalls = 0;

  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.manifest,
    fixture.storyboard,
    {
      title: 'Sanitized Fixture Deck',
      visualComposer: {
        flagValue: 'true',
        language: 'EN',
        compose: async () => ({ ok: true as const, plan }),
        authorizeGeneration: () => true,
        releaseGeneration: () => {
          releaseCalls += 1;
        },
        authorizationFailureMessage: 'Synthetic generation authorization failure.',
      },
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.validationReport?.presentationQuality);
  assert.equal(result.validationReport.presentationQuality.repeatedGenericTitleCount, 1);
  assert.equal(result.validationReport.cacheSafety.mayDeliverPresentation, false);
  assert.equal(result.validationReport.cacheSafety.mayWriteSuccessCache, false);
  assert.equal(releaseCalls, 1);
});
