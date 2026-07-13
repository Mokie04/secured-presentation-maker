import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDeckVisualSystems } from '../lib/deckVisualSystem.ts';
import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import {
  buildSceneAssetRequests,
  validateSceneAssetRequests,
  type SceneAssetRequest,
} from '../lib/sceneAssetRequests.ts';
import { EVIDENCE_OUTPUT_VISUAL_FIXTURE } from './fixtures/deckVisualSystemFixtures.ts';
import { DENSE_STORYBOARD } from './fixtures/semanticSlideFixtures.ts';
import { validVisualPlanFixture } from './fixtures/visualTeachingComposerFixtures.ts';
import { buildSemanticSlideSpecsFromVisualTeachingPlan } from '../lib/visualTeachingSemanticBridge.ts';

const requestFixture = () => {
  const visualSystems = buildDeckVisualSystems(EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard, EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs);
  assert.equal(visualSystems.ok, true);
  if (!visualSystems.ok) throw new Error('visual systems failed');
  const requests = buildSceneAssetRequests(
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
    visualSystems.bundle,
  );
  assert.equal(requests.ok, true);
  if (!requests.ok) throw new Error('asset requests failed');
  return { visualSystems: visualSystems.bundle, requests: requests.requests };
};

test('builds source-owned privacy-sanitized asset requests', () => {
  const { visualSystems, requests } = requestFixture();

  assert.equal(requests.length > 0, true);
  assert.deepEqual(
    validateSceneAssetRequests(
      requests,
      EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
      EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
      visualSystems,
    ),
    [],
  );
  for (const request of requests) {
    const spec = EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs.find((item) => item.id === request.semanticSlideSpecId);
    assert.ok(spec);
    assert.equal(request.unitId, spec.unitId);
    assert.equal(request.storyboardScreenId, spec.storyboardScreenId);
    assert.deepEqual(request.sourceStepIds, spec.sourceStepIds);
    assert.deepEqual(request.sourceObjectiveIds, spec.sourceObjectiveIds);
    assert.equal(request.privacy.sanitized, true);
    assert.equal(request.privacy.containsRawSourceText, false);
    assert.equal(request.privacy.containsPersonalData, false);
  }
});

test('never asks providers to put text inside image briefs', () => {
  const { requests } = requestFixture();

  assert.equal(requests.every((request) => request.brief.mustNotContainText === true), true);
  assert.equal(
    requests.every((request) => request.brief.negativeConstraints.some((constraint) => /no text/i.test(constraint))),
    true,
  );
});

test('creates at most one asset request for adjacent continuations of one storyboard screen', () => {
  const semanticResult = buildSemanticSlideSpecs(DENSE_STORYBOARD);
  assert.equal(semanticResult.ok, true);
  if (!semanticResult.ok) return;
  const visualSystems = buildDeckVisualSystems(DENSE_STORYBOARD, semanticResult.specs);
  assert.equal(visualSystems.ok, true);
  if (!visualSystems.ok) return;

  const result = buildSceneAssetRequests(DENSE_STORYBOARD, semanticResult.specs, visualSystems.bundle);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const requestedScreenIds = result.requests.map((request) => request.storyboardScreenId);
  assert.equal(new Set(requestedScreenIds).size, requestedScreenIds.length);
  for (const request of result.requests) {
    const firstSpec = semanticResult.specs.find((spec) => spec.storyboardScreenId === request.storyboardScreenId);
    assert.equal(request.semanticSlideSpecId, firstSpec?.id);
  }
});

test('prefers one validated visual asset brief while preserving legacy inference without a brief', () => {
  const fixture = validVisualPlanFixture();
  const briefScene = fixture.plan.scenes.find((scene) => scene.visualGrammar === 'relationship-diagram');
  assert.ok(briefScene);
  const plan = {
    ...fixture.plan,
    scenes: fixture.plan.scenes.map((scene) => scene.id === briefScene.id
      ? {
          ...scene,
          assetBrief: {
            purpose: 'Show the observable source-backed setup without slide copy.',
            subject: 'A generic instructional apparatus',
            style: 'illustration' as const,
            mustNotContainText: true as const,
          },
        }
      : scene),
  };
  const semantic = buildSemanticSlideSpecsFromVisualTeachingPlan(plan, fixture.storyboard);
  assert.equal(semantic.ok, true);
  if (!semantic.ok) return;
  const visualSystems = buildDeckVisualSystems(fixture.storyboard, semantic.specs);
  assert.equal(visualSystems.ok, true);
  if (!visualSystems.ok) return;

  const withBrief = buildSceneAssetRequests(fixture.storyboard, semantic.specs, visualSystems.bundle);
  assert.equal(withBrief.ok, true);
  if (!withBrief.ok) return;
  const briefRequests = withBrief.requests.filter((request) => request.storyboardScreenId === briefScene.storyboardScreenIds[0]);
  assert.equal(briefRequests.length, 1);
  assert.equal(briefRequests[0].brief.sceneDescription, 'Show the observable source-backed setup without slide copy.');
  assert.equal(briefRequests[0].brief.mustNotContainText, true);

  const legacySpec = EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs[0];
  const legacySystems = buildDeckVisualSystems(
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
  );
  assert.equal(legacySystems.ok, true);
  if (!legacySystems.ok) return;
  const legacyBefore = buildSceneAssetRequests(
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
    legacySystems.bundle,
  );
  const legacyAfter = buildSceneAssetRequests(
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs.map((spec) => ({ ...spec, visualAssetBrief: undefined })),
    legacySystems.bundle,
  );
  assert.deepEqual(legacyAfter, legacyBefore);
  assert.equal(legacySpec.visualAssetBrief, undefined);
});

test('rejects decorative or random asset requests', () => {
  const { visualSystems, requests } = requestFixture();
  const decorative: SceneAssetRequest = {
    ...requests[0],
    id: 'assetreq-decorative-001',
    necessity: 'forbidden',
    decisionReason: 'decorative_only_rejected',
    instructionalPurpose: 'Decorative random classroom filler.',
  };

  const diagnostics = validateSceneAssetRequests(
    [decorative],
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
    visualSystems,
  );
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_asset_decorative_forbidden'), true);
});

test('rejects request briefs that leak raw or private source text', () => {
  const { visualSystems, requests } = requestFixture();
  const leaked: SceneAssetRequest = {
    ...requests[0],
    altTextBasis: {
      ...requests[0].altTextBasis,
      sanitizedSummary: 'Teacher Maria from Sample School asks learners to copy this exact private sentence.',
    },
    brief: {
      ...requests[0].brief,
      sceneDescription: 'Teacher Maria from Sample School asks learners to copy this exact private sentence.',
    },
  };

  const diagnostics = validateSceneAssetRequests(
    [leaked],
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
    visualSystems,
  );
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_asset_request_private_text_leak'), true);
});

test('rejects image briefs that request visible text or labels inside the image', () => {
  const { visualSystems, requests } = requestFixture();
  const textInImage: SceneAssetRequest = {
    ...requests[0],
    brief: {
      ...requests[0].brief,
      sceneDescription: 'Concept illustration with labels and caption text inside the picture.',
    },
  };

  const diagnostics = validateSceneAssetRequests(
    [textInImage],
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
    visualSystems,
  );
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_asset_request_text_in_image'), true);
});
