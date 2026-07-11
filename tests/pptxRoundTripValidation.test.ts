import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePptxRoundTrip } from '../lib/pptxRoundTripValidation.ts';
import { buildEvidenceOutputEndToEndFixture } from './fixtures/endToEndValidationFixtures.ts';

test('validates native PPTX text, notes, shapes, tables, and bounded image operations', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await validatePptxRoundTrip(fixture.presentation);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.summary.slideCount, fixture.presentation.scenes.length);
  assert.equal(result.summary.nativeTextOperationCount > 0, true);
  assert.equal(result.summary.speakerNotesCount, fixture.presentation.scenes.filter((scene) => scene.speakerNotes.trim()).length);
  assert.equal(result.summary.fullSlideImageCount, 0);
});

test('blocks missing PPTX text compared with preview text', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture.presentation,
    scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
      ? {
          ...scene,
          elements: scene.elements.filter((element) => element.kind !== 'text'),
          readingOrder: scene.readingOrder.filter((elementId) => !scene.elements.some((element) => element.id === elementId && element.kind === 'text')),
        }
      : scene),
  };

  const result = await validatePptxRoundTrip(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_pptx_round_trip_invalid'), true);
});

test('blocks full-slide image PPTX operations', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const firstScene = fixture.presentation.scenes[0];
  const invalid = {
    ...fixture.presentation,
    scenes: [
      {
        ...firstScene,
        elements: [
          ...firstScene.elements,
          {
            id: 'scene-001-full-slide-image',
            kind: 'image' as const,
            frame: { x: 0, y: 0, w: 1280, h: 720 },
            editable: true,
            readingOrder: 999,
            src: 'data:image/png;base64,fixture',
            altText: 'Invalid full slide image.',
            assetId: 'assetreq-invalid',
            visualRole: 'curated-educational-visual' as const,
            sourceStepIds: firstScene.sourceStepIds,
            storyboardScreenId: firstScene.storyboardScreenId,
            semanticSlideSpecId: firstScene.semanticSlideSpecId,
            noEmbeddedText: true as const,
          },
        ],
      },
      ...fixture.presentation.scenes.slice(1),
    ],
  };

  const result = await validatePptxRoundTrip(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_full_slide_raster'), true);
});
