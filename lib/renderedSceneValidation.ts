import {
  createPreviewSceneDescriptors,
  validateCompiledSlideScene,
  type CompiledScenePresentation,
  type SceneElement,
  type SceneTableElement,
  type SceneTextElement,
  type SceneValidationDiagnostic,
} from './compiledSlideScene.ts';
import type {
  EndToEndDiagnostic,
  RenderValidationSummary,
} from './endToEndValidation.ts';

export type RenderedSceneValidationResult = {
  summary: RenderValidationSummary;
  diagnostics: EndToEndDiagnostic[];
};

const visibleTextElement = (element: SceneElement): element is SceneTextElement | SceneTableElement => (
  element.kind === 'text' || element.kind === 'table'
);

const isFullSlideRasterFrame = (element: SceneElement): boolean => (
  element.kind === 'image'
  && element.frame.x <= 0
  && element.frame.y <= 0
  && element.frame.w >= 1280
  && element.frame.h >= 720
);

const mapSceneDiagnostic = (
  diagnostic: SceneValidationDiagnostic,
): EndToEndDiagnostic => ({
  code: diagnostic.code === 'scene_full_slide_raster_forbidden'
    ? 'e2e_full_slide_raster'
    : diagnostic.code === 'scene_uneditable_visible_text'
      ? 'e2e_preview_text_not_editable'
      : 'e2e_scene_render_invalid',
  severity: diagnostic.severity,
  message: diagnostic.message,
  sceneId: diagnostic.sceneId,
  elementId: diagnostic.elementId,
});

const endToEndDiagnostic = (
  code: EndToEndDiagnostic['code'],
  message: string,
  sceneId: string,
  elementId?: string,
): EndToEndDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  sceneId,
  elementId,
});

export const validateRenderedScenes = (
  presentation: CompiledScenePresentation,
): RenderedSceneValidationResult => {
  const diagnostics: EndToEndDiagnostic[] = [];
  let offCanvasCount = 0;
  let overflowCount = 0;
  let unreadableTextCount = 0;
  let uneditableVisibleTextCount = 0;
  let fullSlideRasterCount = 0;

  for (const scene of presentation.scenes) {
    if (scene.size.width !== 1280 || scene.size.height !== 720 || scene.size.aspect !== '16:9') {
      diagnostics.push(endToEndDiagnostic(
        'e2e_scene_render_invalid',
        `Scene ${scene.id} does not render on the required 1280 by 720 16:9 surface.`,
        scene.id,
      ));
    }

    const previewDescriptors = createPreviewSceneDescriptors(scene);
    if (previewDescriptors.length !== scene.elements.length) {
      diagnostics.push(endToEndDiagnostic(
        'e2e_scene_render_invalid',
        `Scene ${scene.id} preview descriptor count does not match the compiled scene elements.`,
        scene.id,
      ));
    }

    const sceneDiagnostics = validateCompiledSlideScene(scene);
    for (const diagnostic of sceneDiagnostics) {
      if (diagnostic.code === 'scene_element_off_canvas') offCanvasCount += 1;
      if (diagnostic.code === 'scene_text_overflow') overflowCount += 1;
      if (diagnostic.code === 'scene_uneditable_visible_text') uneditableVisibleTextCount += 1;
      if (diagnostic.code === 'scene_full_slide_raster_forbidden') fullSlideRasterCount += 1;
      diagnostics.push(mapSceneDiagnostic(diagnostic));
    }

    for (const element of scene.elements) {
      if (!visibleTextElement(element)) {
        if (isFullSlideRasterFrame(element)) fullSlideRasterCount += 1;
        continue;
      }

      if (element.editable !== true) {
        uneditableVisibleTextCount += 1;
        diagnostics.push(endToEndDiagnostic(
          'e2e_preview_text_not_editable',
          `Visible preview text element ${element.id} is not editable.`,
          scene.id,
          element.id,
        ));
      }

      if (element.fontSize < 14) {
        unreadableTextCount += 1;
        diagnostics.push(endToEndDiagnostic(
          'e2e_scene_render_invalid',
          `Visible preview text element ${element.id} is below the minimum readable size.`,
          scene.id,
          element.id,
        ));
      }
    }
  }

  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking').length;
  const checked = Math.max(1, presentation.scenes.length);
  return {
    summary: {
      checked,
      passed: diagnostics.length === 0 ? checked : Math.max(0, checked - diagnostics.length),
      failed: diagnostics.length,
      blocking,
      renderedSceneCount: presentation.scenes.length,
      canvasWidth: 1280,
      canvasHeight: 720,
      offCanvasCount,
      overflowCount,
      unreadableTextCount,
      uneditableVisibleTextCount,
      fullSlideRasterCount,
    },
    diagnostics,
  };
};
