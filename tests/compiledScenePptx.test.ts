import assert from 'node:assert/strict';
import test from 'node:test';

import { compileSemanticSlideSpecsToScenes, createPreviewSceneDescriptors } from '../lib/compiledSlideScene.ts';
import { compilePptxSceneOperations, getPptxSceneOperationText } from '../lib/compiledScenePptx.ts';
import { SCENE_ASSET_REQUEST_VERSION, type SceneAssetRequest } from '../lib/sceneAssetRequests.ts';
import { SCENE_ASSET_RESOLUTION_VERSION, type SceneResolvedAsset } from '../lib/sceneAssetResolver.ts';
import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import { EVIDENCE_OUTPUT_STORYBOARD } from './fixtures/semanticSlideFixtures.ts';
import {
  relationshipDiagramSemanticFixture,
  visualLayoutSceneFixture,
} from './fixtures/visualTeachingComposerFixtures.ts';

const sceneFromFixture = () => {
  const specs = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(specs.ok, true);
  if (!specs.ok) throw new Error('semantic specs failed');
  const scenes = compileSemanticSlideSpecsToScenes(specs.specs, { title: 'Fixture Deck' });
  assert.equal(scenes.ok, true);
  if (!scenes.ok) throw new Error('scene compile failed');
  return scenes.presentation.scenes[0];
};

const sceneWithBoundedAsset = () => {
  const specs = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(specs.ok, true);
  if (!specs.ok) throw new Error('semantic specs failed');
  const spec = specs.specs[1];
  const request: SceneAssetRequest = {
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
  };
  const asset: SceneResolvedAsset = {
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
  };
  const scenes = compileSemanticSlideSpecsToScenes(
    [specs.specs[0], { ...spec, assetRequests: [request] }, specs.specs[2]],
    {
      title: 'Fixture Deck',
      resolvedAssetsBySpecId: {
        [spec.id]: [asset],
      },
    },
  );
  assert.equal(scenes.ok, true);
  if (!scenes.ok) throw new Error('scene compile failed');
  return scenes.presentation.scenes[1];
};

test('compiles PPTX operations from the same scene used by preview', () => {
  const scene = sceneFromFixture();
  const previewDescriptors = createPreviewSceneDescriptors(scene);
  const pptxOperations = compilePptxSceneOperations(scene);

  assert.deepEqual(
    pptxOperations.filter((operation) => 'elementId' in operation).map((operation) => operation.elementId),
    previewDescriptors.map((descriptor) => descriptor.elementId),
  );
});

test('preserves visible text between preview descriptors and PPTX operations', () => {
  const scene = sceneFromFixture();
  const previewText = createPreviewSceneDescriptors(scene).flatMap((descriptor) => descriptor.text ?? []);
  const pptxText = getPptxSceneOperationText(compilePptxSceneOperations(scene));

  assert.deepEqual(pptxText.filter(Boolean), previewText.filter(Boolean));
});

test('adds speaker notes as native notes operation', () => {
  const scene = sceneFromFixture();
  const operations = compilePptxSceneOperations(scene);

  assert.equal(operations.some((operation) => operation.kind === 'addNotes' && operation.text === scene.speakerNotes), true);
});

test('uses native text, shape, table, and connector operations only', () => {
  const scene = sceneFromFixture();
  const operations = compilePptxSceneOperations(scene);

  assert.equal(operations.some((operation) => (operation as { kind: string }).kind === 'addImage'), false);
  assert.equal(operations.every((operation) => ['addText', 'addShape', 'addTable', 'addNotes'].includes(operation.kind)), true);
});

test('exports bounded image scene elements as native PPTX image operations', () => {
  const scene = sceneWithBoundedAsset();
  const operations = compilePptxSceneOperations(scene);
  const imageOperation = operations.find((operation) => operation.kind === 'addImage');

  assert.ok(imageOperation);
  const options = imageOperation.options as { x: number; y: number; w: number; h: number; altText: string };
  assert.equal(options.w < 10 && options.h < 5.625, true);
  assert.equal(options.x >= 0 && options.y >= 0, true);
  assert.equal(options.altText, 'Source-backed concept visual.');
});

test('preserves the collision-free bounded image frame in PPTX operations', () => {
  const scene = sceneWithBoundedAsset();
  const image = scene.elements.find((element) => element.kind === 'image');
  const previewDescriptor = createPreviewSceneDescriptors(scene).find((descriptor) => descriptor.kind === 'image');
  const imageOperation = compilePptxSceneOperations(scene).find((operation) => operation.kind === 'addImage');

  assert.ok(image);
  assert.ok(previewDescriptor);
  assert.ok(imageOperation);
  assert.deepEqual(previewDescriptor.frame, image.frame);
  const options = imageOperation.options as { x: number; y: number; w: number; h: number };
  assert.deepEqual(options, {
    x: image.frame.x / 128,
    y: image.frame.y / 128,
    w: image.frame.w / 128,
    h: image.frame.h / 128,
    altText: image.altText,
  });
});

test('preserves preview and PPTX visible-text parity for visual layouts', () => {
  const scene = visualLayoutSceneFixture();
  const previewText = createPreviewSceneDescriptors(scene).flatMap((descriptor) => descriptor.text);
  const operations = compilePptxSceneOperations(scene);

  assert.deepEqual(getPptxSceneOperationText(operations), previewText);
});

test('exports relationship nodes and connectors as matching native PPTX shapes', () => {
  const scenes = compileSemanticSlideSpecsToScenes(
    [relationshipDiagramSemanticFixture()],
    { title: 'Sanitized Relationship Deck' },
  );
  assert.equal(scenes.ok, true);
  if (!scenes.ok) return;
  const scene = scenes.presentation.scenes[0];
  const previewDescriptors = createPreviewSceneDescriptors(scene);
  const operations = compilePptxSceneOperations(scene);
  const shapeOperations = operations.filter((operation) => operation.kind === 'addShape');

  assert.equal(shapeOperations.some((operation) => operation.shape === 'ellipse'), true);
  assert.equal(shapeOperations.some((operation) => operation.shape === 'diamond'), true);
  assert.equal(shapeOperations.filter((operation) => operation.shape === 'line').length, 2);
  assert.deepEqual(
    operations.filter((operation) => 'elementId' in operation).map((operation) => operation.elementId),
    previewDescriptors.map((descriptor) => descriptor.elementId),
  );
  assert.deepEqual(
    getPptxSceneOperationText(operations).filter(Boolean),
    previewDescriptors.flatMap((descriptor) => descriptor.text).filter(Boolean),
  );
});
