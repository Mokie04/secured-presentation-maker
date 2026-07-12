import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileSemanticSlideSpecsToScenes,
  createPreviewSceneDescriptors,
  doesSemanticSlideSpecFitScene,
  getSceneVisibleText,
  validateCompiledSlideScene,
} from '../lib/compiledSlideScene.ts';
import { SCENE_ASSET_REQUEST_VERSION, type SceneAssetRequest } from '../lib/sceneAssetRequests.ts';
import { SCENE_ASSET_RESOLUTION_VERSION, type SceneResolvedAsset } from '../lib/sceneAssetResolver.ts';
import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import {
  DENSE_STORYBOARD,
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
} from './fixtures/semanticSlideFixtures.ts';

const specsFrom = () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('semantic specs failed');
  return result.specs;
};

const assetRequestForSpec = (spec: ReturnType<typeof specsFrom>[number]): SceneAssetRequest => ({
  contractVersion: SCENE_ASSET_REQUEST_VERSION,
  id: `assetreq-${spec.id}-001`,
  unitId: spec.unitId,
  sourceStepIds: [...spec.sourceStepIds],
  sourceObjectiveIds: [...spec.sourceObjectiveIds],
  storyboardScreenId: spec.storyboardScreenId,
  semanticSlideSpecId: spec.id,
  visualRole: 'curated-educational-visual',
  necessity: 'optional',
  decisionReason: 'source_requires_concept_model',
  conceptAnchor: {
    conceptId: spec.sourceStepIds[0] ? `step:${spec.sourceStepIds[0]}` : `screen:${spec.storyboardScreenId}`,
  },
  instructionalPurpose: 'Support a source-backed concept without replacing native slide text.',
  visualSystemVersion: 'deck-visual-system-v1',
  altTextBasis: {
    sourceStepIds: [...spec.sourceStepIds],
    storyboardScreenId: spec.storyboardScreenId,
    sanitizedSummary: 'Source-backed concept visual.',
  },
  brief: {
    subject: 'K-12',
    gradeBand: 'secondary',
    conceptId: spec.sourceStepIds[0] ? `step:${spec.sourceStepIds[0]}` : `screen:${spec.storyboardScreenId}`,
    sceneDescription: 'Text-free concept illustration for a source-backed learning task.',
    composition: 'concept-illustration',
    style: 'illustration',
    mustNotContainText: true,
    negativeConstraints: ['No text, labels, captions, letters, numbers, watermarks, or UI chrome inside the image.'],
  },
  privacy: {
    sanitized: true,
    containsRawSourceText: false,
    containsPersonalData: false,
  },
});

const resolvedAssetForRequest = (request: SceneAssetRequest): SceneResolvedAsset => ({
  contractVersion: SCENE_ASSET_RESOLUTION_VERSION,
  requestId: request.id,
  semanticSlideSpecId: request.semanticSlideSpecId,
  storyboardScreenId: request.storyboardScreenId,
  sourceStepIds: [...request.sourceStepIds],
  kind: 'curated-cache',
  src: 'data:image/svg+xml;base64,PHN2Zy8+',
  altText: request.altTextBasis.sanitizedSummary,
  noEmbeddedText: true,
  editableFallbackAvailable: true,
  costClass: 'cached',
});

test('compiles semantic specs into 16:9 scenes with stable ids', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.kind, 'compiled-scene-presentation');
  assert.deepEqual(result.presentation.scenes.map((scene) => scene.id), ['scene-001', 'scene-002', 'scene-003']);
  assert.equal(result.presentation.scenes.every((scene) => scene.size.width === 1280 && scene.size.height === 720), true);
});

test('validates every compiled element is inside the 16:9 canvas', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const scene of result.presentation.scenes) {
    assert.deepEqual(validateCompiledSlideScene(scene), []);
  }
});

test('represents visible text as editable text or table elements', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const textValues = result.presentation.scenes.flatMap(getSceneVisibleText);
  assert.equal(textValues.length > 0, true);
  for (const scene of result.presentation.scenes) {
    const invalid = scene.elements.filter((element) => {
      const hasText = element.kind === 'text' || element.kind === 'table';
      return hasText && !element.editable;
    });
    assert.deepEqual(invalid, []);
  }
});

test('rejects off-canvas elements', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const invalid = {
    ...scene,
    elements: [{ ...scene.elements[0], frame: { ...scene.elements[0].frame, x: -10 } }, ...scene.elements.slice(1)],
  };
  const diagnostics = validateCompiledSlideScene(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_element_off_canvas'), true);
});

test('rejects text overflow without truncating content', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const firstText = scene.elements.find((element) => element.kind === 'text');
  assert.ok(firstText);
  const invalid = {
    ...scene,
    elements: scene.elements.map((element) => element.id === firstText.id
      ? {
          ...element,
          frame: { ...element.frame, h: 8 },
        }
      : element),
  };
  const diagnostics = validateCompiledSlideScene(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_text_overflow'), true);
});

test('compiles dense storyboard continuations without overflow or rasterized text', () => {
  const specsResult = buildSemanticSlideSpecs(DENSE_STORYBOARD);
  assert.equal(specsResult.ok, true);
  if (!specsResult.ok) return;

  const result = compileSemanticSlideSpecsToScenes(specsResult.specs, { title: 'Dense Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes.length > DENSE_STORYBOARD.screens.length, true);
  assert.equal(result.presentation.scenes.flatMap((scene) => validateCompiledSlideScene(scene))
    .some((diagnostic) => diagnostic.code === 'scene_text_overflow'), false);
  assert.equal(result.presentation.scenes.flatMap((scene) => scene.elements)
    .every((element) => (element.kind !== 'text' && element.kind !== 'table') || element.editable), true);
  assert.equal(result.presentation.scenes.flatMap((scene) => scene.elements)
    .some((element) => element.kind === 'image'), false);
});

test('moves every guided list item to a continuation instead of truncating after four', () => {
  const storyboard = structuredClone(EVIDENCE_OUTPUT_STORYBOARD);
  const guidedScreen = storyboard.screens[1];
  guidedScreen.communicationIntent = 'guided-example';
  guidedScreen.requiredEvidence = [];
  guidedScreen.requiredOutputs = [];
  guidedScreen.learnerContent = {
    questions: [],
    directions: [
      'GI-STEP-ONE Inspect the first source-backed item and record the feature that matters for the stated comparison.',
      'GI-STEP-TWO Compare the second source-backed item with the first and preserve the stated evidence order.',
      'GI-STEP-THREE Record the third source-backed item and connect it to the criterion supplied by the source.',
      'GI-STEP-FOUR Explain the fourth source-backed item using the same comparison frame and no added requirement.',
      'GI-STEP-FIVE Check the fifth source-backed item against the earlier evidence and note the supported difference.',
      'GI-STEP-SIX Review the sixth source-backed item and prepare the final source-aligned sequence for discussion.',
    ],
    successCriteria: [],
  };
  const specsResult = buildSemanticSlideSpecs(storyboard);
  assert.equal(specsResult.ok, true);
  if (!specsResult.ok) return;

  const guidedSpecs = specsResult.specs.filter((spec) => spec.storyboardScreenId === guidedScreen.id);
  assert.equal(guidedSpecs.length > 1, true);
  const result = compileSemanticSlideSpecsToScenes(specsResult.specs, { title: 'Guided Continuation Fixture' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visible = result.presentation.scenes.flatMap(getSceneVisibleText).join(' ');
  for (const sentinel of ['GI-STEP-ONE', 'GI-STEP-TWO', 'GI-STEP-THREE', 'GI-STEP-FOUR', 'GI-STEP-FIVE', 'GI-STEP-SIX']) {
    assert.match(visible, new RegExp(sentinel));
  }
});

test('rejects semantic candidates beyond the layout item ceiling', () => {
  const specs = specsFrom();
  const sourceSpec = specs.find((spec) => spec.sourceStepIds.length > 0);
  assert.ok(sourceSpec);
  const overCapacity = {
    ...sourceSpec,
    intent: 'guided-example' as const,
    layoutId: 'guided-example-steps' as const,
    slots: {
      ...sourceSpec.slots,
      body: {
        kind: 'list' as const,
        items: Array.from({ length: 7 }, (_, index) => `Item ${index + 1}`),
      },
      requirements: { kind: 'list' as const, items: [] },
      successCriteria: { kind: 'list' as const, items: [] },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(overCapacity), false);
  const result = compileSemanticSlideSpecsToScenes([overCapacity], { title: 'Over Capacity Fixture' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'scene_text_overflow'), true);
});

test('accounts for preview cell padding when estimating table text fit', () => {
  const specs = specsFrom();
  const exitSpec = specs.find((spec) => spec.layoutId === 'exit-ticket-card');
  assert.ok(exitSpec);
  const paddedWrap = {
    ...exitSpec,
    slots: {
      ...exitSpec.slots,
      requirements: {
        kind: 'list' as const,
        items: [
          'Required response one',
          'Required response two',
          'Required response three',
          'Required response four',
          'Required response five',
        ],
      },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(paddedWrap), false);
});

test('does not emit image or full-slide raster elements in Gate 3', () => {
  const specsResult = buildSemanticSlideSpecs(FIVE_SESSION_STORYBOARD);
  assert.equal(specsResult.ok, true);
  if (!specsResult.ok) return;
  const result = compileSemanticSlideSpecsToScenes(specsResult.specs, { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes.flatMap((scene) => scene.elements).some((element) => element.kind === 'image'), false);
});

test('adds only bounded source-backed image elements when resolved assets are supplied', () => {
  const specs = specsFrom();
  const request = assetRequestForSpec(specs[1]);
  const specWithRequest = { ...specs[1], assetRequests: [request] };
  const result = compileSemanticSlideSpecsToScenes(
    [specs[0], specWithRequest, specs[2]],
    {
      title: 'Fixture Deck',
      resolvedAssetsBySpecId: {
        [specWithRequest.id]: [resolvedAssetForRequest(request)],
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const image = result.presentation.scenes[1].elements.find((element) => element.kind === 'image');
  assert.ok(image);
  assert.equal(image.noEmbeddedText, true);
  assert.equal(image.assetId, request.id);
  assert.deepEqual(image.sourceStepIds, request.sourceStepIds);
  assert.equal(image.storyboardScreenId, request.storyboardScreenId);
  assert.equal(image.semanticSlideSpecId, request.semanticSlideSpecId);
  assert.equal(image.frame.w < 1280 && image.frame.h < 720, true);
  assert.deepEqual(validateCompiledSlideScene(result.presentation.scenes[1]), []);
});

test('compiles a valid editable scene when optional assets are omitted', () => {
  const specs = specsFrom();
  const request = assetRequestForSpec(specs[1]);
  const specWithRequest = { ...specs[1], assetRequests: [request] };
  const result = compileSemanticSlideSpecsToScenes([specs[0], specWithRequest, specs[2]], { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes[1].elements.some((element) => element.kind === 'image'), false);
  assert.deepEqual(validateCompiledSlideScene(result.presentation.scenes[1]), []);
});

test('rejects full-slide raster image frames', () => {
  const specs = specsFrom();
  const request = assetRequestForSpec(specs[1]);
  const specWithRequest = { ...specs[1], assetRequests: [request] };
  const result = compileSemanticSlideSpecsToScenes(
    [specs[0], specWithRequest, specs[2]],
    {
      title: 'Fixture Deck',
      resolvedAssetsBySpecId: {
        [specWithRequest.id]: [resolvedAssetForRequest(request)],
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = {
    ...result.presentation.scenes[1],
    elements: result.presentation.scenes[1].elements.map((element) => element.kind === 'image'
      ? { ...element, frame: { x: 0, y: 0, w: 1280, h: 720 } }
      : element),
  };
  const diagnostics = validateCompiledSlideScene(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_full_slide_raster_forbidden'), true);
});

test('preview descriptors are derived from the compiled scene contract', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const descriptors = createPreviewSceneDescriptors(scene);
  assert.deepEqual(descriptors.map((descriptor) => descriptor.elementId), scene.elements.map((element) => element.id));
});
