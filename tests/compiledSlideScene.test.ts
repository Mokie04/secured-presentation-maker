import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileSemanticSlideSpecsToScenes,
  createPreviewSceneDescriptors,
  getSceneVisibleText,
  validateCompiledSlideScene,
} from '../lib/compiledSlideScene.ts';
import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import {
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
} from './fixtures/semanticSlideFixtures.ts';

const specsFrom = () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('semantic specs failed');
  return result.specs;
};

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

test('does not emit image or full-slide raster elements in Gate 3', () => {
  const specsResult = buildSemanticSlideSpecs(FIVE_SESSION_STORYBOARD);
  assert.equal(specsResult.ok, true);
  if (!specsResult.ok) return;
  const result = compileSemanticSlideSpecsToScenes(specsResult.specs, { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes.flatMap((scene) => scene.elements).some((element) => element.kind === 'image'), false);
});

test('preview descriptors are derived from the compiled scene contract', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const descriptors = createPreviewSceneDescriptors(scene);
  assert.deepEqual(descriptors.map((descriptor) => descriptor.elementId), scene.elements.map((element) => element.id));
});
