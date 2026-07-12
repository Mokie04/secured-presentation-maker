import assert from 'node:assert/strict';

import { buildDeckVisualSystems } from '../../lib/deckVisualSystem.ts';
import { compileSemanticSlideSpecsToScenes } from '../../lib/compiledSlideScene.ts';
import { buildLessonSourceManifest } from '../../lib/lessonSourceManifest.ts';
import {
  buildSceneAssetRequests,
  type SceneAssetRequest,
} from '../../lib/sceneAssetRequests.ts';
import {
  resolveSceneAssets,
  type SceneResolvedAsset,
} from '../../lib/sceneAssetResolver.ts';
import { buildSemanticSlideSpecs } from '../../lib/semanticSlideSpec.ts';
import { buildTeachingStoryboard } from '../../lib/teachingStoryboard.ts';
import {
  EVIDENCE_OUTPUT_DOCUMENT,
  TEACHER_SCRIPT_DOCUMENT,
} from './teachingStoryboardFixtures.ts';
import {
  FIVE_SESSION_MATRIX_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
} from './lessonSourceManifestFixtures.ts';

const materializeFixture = async (document: Parameters<typeof buildLessonSourceManifest>[0]) => {
  const manifestResult = buildLessonSourceManifest(document);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) throw new Error('manifest fixture failed');

  const storyboardResult = buildTeachingStoryboard(manifestResult.manifest);
  assert.equal(storyboardResult.ok, true);
  if (!storyboardResult.ok) throw new Error('storyboard fixture failed');

  const semanticResult = buildSemanticSlideSpecs(storyboardResult.storyboard);
  assert.equal(semanticResult.ok, true);
  if (!semanticResult.ok) throw new Error('semantic fixture failed');

  const visualResult = buildDeckVisualSystems(storyboardResult.storyboard, semanticResult.specs);
  assert.equal(visualResult.ok, true);
  if (!visualResult.ok) throw new Error('visual fixture failed');

  const requestsResult = buildSceneAssetRequests(
    storyboardResult.storyboard,
    semanticResult.specs,
    visualResult.bundle,
  );
  assert.equal(requestsResult.ok, true);
  if (!requestsResult.ok) throw new Error('asset request fixture failed');

  const resolverResult = await resolveSceneAssets(requestsResult.requests);
  assert.equal(resolverResult.ok, true);
  if (!resolverResult.ok) throw new Error('asset resolver fixture failed');

  const resolvedAssetsBySpecId = Object.fromEntries(semanticResult.specs.map((spec) => [
    spec.id,
    resolverResult.assets.filter((asset) => asset.semanticSlideSpecId === spec.id),
  ]));
  const specsWithRequests = semanticResult.specs.map((spec) => ({
    ...spec,
    assetRequests: requestsResult.requests.filter((request) => request.semanticSlideSpecId === spec.id),
  }));

  const sceneResult = compileSemanticSlideSpecsToScenes(specsWithRequests, {
    title: 'Sanitized Fixture Deck',
    visualSystemsByUnitId: visualResult.bundle.systemsByUnitId,
    resolvedAssetsBySpecId,
  });
  assert.equal(sceneResult.ok, true);
  if (!sceneResult.ok) throw new Error('scene fixture failed');

  return {
    sourceManifest: manifestResult.manifest,
    storyboard: storyboardResult.storyboard,
    semanticSpecs: specsWithRequests,
    visualSystems: visualResult.bundle,
    assetRequests: requestsResult.requests,
    resolvedAssetsBySpecId,
    presentation: sceneResult.presentation,
  };
};

export const buildEvidenceOutputEndToEndFixture = () => materializeFixture(EVIDENCE_OUTPUT_DOCUMENT);
export const buildTeacherScriptEndToEndFixture = () => materializeFixture(TEACHER_SCRIPT_DOCUMENT);
export const buildFiveSessionEndToEndFixture = () => materializeFixture(FIVE_SESSION_MATRIX_DOCUMENT);
export const buildMultiObjectiveEndToEndFixture = () => materializeFixture(MULTI_OBJECTIVE_UNIT_DOCUMENT);

export const flattenResolvedAssets = (resolvedAssetsBySpecId: Record<string, SceneResolvedAsset[]>): SceneResolvedAsset[] => (
  Object.values(resolvedAssetsBySpecId).flat()
);

export const cloneAssetRequest = (request: SceneAssetRequest): SceneAssetRequest => ({
  ...request,
  sourceStepIds: [...request.sourceStepIds],
  sourceObjectiveIds: [...request.sourceObjectiveIds],
  conceptAnchor: { ...request.conceptAnchor },
  altTextBasis: {
    ...request.altTextBasis,
    sourceStepIds: [...request.altTextBasis.sourceStepIds],
  },
  brief: {
    ...request.brief,
    negativeConstraints: [...request.brief.negativeConstraints],
  },
  privacy: { ...request.privacy },
});
