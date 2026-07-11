import assert from 'node:assert/strict';
import test from 'node:test';

import { compileSemanticSlideSpecsToScenes, createPreviewSceneDescriptors } from '../lib/compiledSlideScene.ts';
import { compilePptxSceneOperations, getPptxSceneOperationText } from '../lib/compiledScenePptx.ts';
import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import { EVIDENCE_OUTPUT_STORYBOARD } from './fixtures/semanticSlideFixtures.ts';

const sceneFromFixture = () => {
  const specs = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(specs.ok, true);
  if (!specs.ok) throw new Error('semantic specs failed');
  const scenes = compileSemanticSlideSpecsToScenes(specs.specs, { title: 'Fixture Deck' });
  assert.equal(scenes.ok, true);
  if (!scenes.ok) throw new Error('scene compile failed');
  return scenes.presentation.scenes[0];
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
