import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDeckVisualSystems } from '../lib/deckVisualSystem.ts';
import { buildSceneAssetRequests, type SceneAssetRequest } from '../lib/sceneAssetRequests.ts';
import {
  resolveSceneAssets,
  type SceneAssetAdapters,
  type SceneAssetBudget,
  type SceneResolvedAsset,
} from '../lib/sceneAssetResolver.ts';
import { EVIDENCE_OUTPUT_VISUAL_FIXTURE } from './fixtures/deckVisualSystemFixtures.ts';

const assetRequests = (): SceneAssetRequest[] => {
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
  return requests.requests;
};

const budget = (overrides: Partial<SceneAssetBudget> = {}): SceneAssetBudget => ({
  maxPaidGeneratedAssetsPerDeck: 4,
  maxConcurrentAssetResolutions: 3,
  allowPaidGeneration: false,
  ...overrides,
});

const resolved = (request: SceneAssetRequest, kind: SceneResolvedAsset['kind'], src?: string): SceneResolvedAsset => ({
  contractVersion: 'scene-asset-resolution-v1',
  requestId: request.id,
  semanticSlideSpecId: request.semanticSlideSpecId,
  storyboardScreenId: request.storyboardScreenId,
  sourceStepIds: [...request.sourceStepIds],
  kind,
  src,
  altText: request.altTextBasis.sanitizedSummary,
  noEmbeddedText: true,
  editableFallbackAvailable: true,
  costClass: kind === 'generated-image' ? 'paid' : kind === 'curated-cache' ? 'cached' : 'free',
});

test('resolves deterministic native assets before external adapters', async () => {
  const [request] = assetRequests().map((item) => ({ ...item, visualRole: 'native-diagram' as const }));
  let externalCalls = 0;
  const result = await resolveSceneAssets([request], budget(), {
    resolveCuratedVisual: async () => {
      externalCalls += 1;
      return resolved(request, 'curated-cache', 'data:image/svg+xml;base64,curated');
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.assets[0].kind, 'native');
  assert.equal(externalCalls, 0);
});

test('uses curated cached assets before generated image adapters', async () => {
  const request = { ...assetRequests()[0], visualRole: 'curated-educational-visual' as const };
  let generatedCalls = 0;
  const result = await resolveSceneAssets([request], budget({ allowPaidGeneration: true }), {
    resolveCuratedVisual: async () => resolved(request, 'curated-cache', 'data:image/svg+xml;base64,curated'),
    generateTextFreeImage: async () => {
      generatedCalls += 1;
      return resolved(request, 'generated-image', 'data:image/png;base64,generated');
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.assets[0].kind, 'curated-cache');
  assert.equal(generatedCalls, 0);
});

test('returns editable omitted fallback for optional asset failures', async () => {
  const request = { ...assetRequests()[0], necessity: 'optional' as const, visualRole: 'generated-illustration' as const };
  const result = await resolveSceneAssets([request], budget({ allowPaidGeneration: true }), {});

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.assets[0].kind, 'omitted');
  assert.equal(result.assets[0].editableFallbackAvailable, true);
});

test('blocks required asset failure when no safe editable fallback exists', async () => {
  const request = { ...assetRequests()[0], necessity: 'required' as const, visualRole: 'generated-illustration' as const };
  const result = await resolveSceneAssets([request], budget({ allowPaidGeneration: false }), {});

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'scene_asset_required_unavailable'), true);
});

test('enforces paid generated asset ceiling', async () => {
  const requests = assetRequests().map((request, index) => ({
    ...request,
    id: `${request.id}-generated-${index}`,
    visualRole: 'generated-illustration' as const,
    necessity: 'optional' as const,
  }));
  let generatedCalls = 0;
  const result = await resolveSceneAssets(requests, budget({ allowPaidGeneration: true, maxPaidGeneratedAssetsPerDeck: 1 }), {
    generateTextFreeImage: async (request) => {
      generatedCalls += 1;
      return resolved(request, 'generated-image', `data:image/png;base64,generated-${generatedCalls}`);
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(generatedCalls, 1);
  assert.equal(result.assets.filter((asset) => asset.kind === 'generated-image').length, 1);
});

test('never exceeds configured generated-image concurrency', async () => {
  const requests = assetRequests().map((request, index) => ({
    ...request,
    id: `${request.id}-parallel-${index}`,
    visualRole: 'generated-illustration' as const,
    necessity: 'optional' as const,
  }));
  let active = 0;
  let maxActive = 0;
  const adapters: SceneAssetAdapters = {
    generateTextFreeImage: async (request) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return resolved(request, 'generated-image', 'data:image/png;base64,generated');
    },
  };

  const result = await resolveSceneAssets(requests, budget({ allowPaidGeneration: true, maxConcurrentAssetResolutions: 2 }), adapters);

  assert.equal(result.ok, true);
  assert.equal(maxActive <= 2, true);
});

test('blocks invalid requests before adapter calls', async () => {
  const request = {
    ...assetRequests()[0],
    necessity: 'forbidden' as const,
    decisionReason: 'decorative_only_rejected' as const,
  };
  let adapterCalls = 0;
  const result = await resolveSceneAssets([request], budget(), {
    resolveBundledIcon: async () => {
      adapterCalls += 1;
      return null;
    },
  });

  assert.equal(result.ok, false);
  assert.equal(adapterCalls, 0);
});
