import assert from 'node:assert/strict';
import test from 'node:test';

import { validateRenderedScenes } from '../lib/renderedSceneValidation.ts';
import { buildEvidenceOutputEndToEndFixture } from './fixtures/endToEndValidationFixtures.ts';

test('validates every compiled scene as a 1280 by 720 rendered preview surface', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = validateRenderedScenes(fixture.presentation);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.summary.renderedSceneCount, fixture.presentation.scenes.length);
  assert.equal(result.summary.canvasWidth, 1280);
  assert.equal(result.summary.canvasHeight, 720);
  assert.equal(result.summary.uneditableVisibleTextCount, 0);
  assert.equal(result.summary.fullSlideRasterCount, 0);
});

test('blocks uneditable visible preview text', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture.presentation,
    scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
      ? {
          ...scene,
          elements: scene.elements.map((element) => element.kind === 'text'
            ? { ...element, editable: false }
            : element),
        }
      : scene),
  };

  const result = validateRenderedScenes(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_preview_text_not_editable'), true);
});

test('blocks off-canvas, overflow, unreadable text, and full-slide raster images', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const firstScene = fixture.presentation.scenes[0];
  const invalidText = firstScene.elements.find((element) => element.kind === 'text');
  assert.ok(invalidText);
  const invalid = {
    ...fixture.presentation,
    scenes: [
      {
        ...firstScene,
        elements: firstScene.elements.map((element) => element.id === invalidText.id
          ? { ...element, frame: { ...element.frame, x: -1, h: 4 }, fontSize: 8 }
          : element),
      },
      ...fixture.presentation.scenes.slice(1),
    ],
  };

  const result = validateRenderedScenes(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_scene_render_invalid'), true);
});
