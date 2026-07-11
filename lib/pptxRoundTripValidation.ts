import {
  compilePptxSceneOperations,
  getPptxSceneOperationText,
} from './compiledScenePptx.ts';
import type {
  CompiledScenePresentation,
  SceneElement,
} from './compiledSlideScene.ts';
import type {
  EndToEndDiagnostic,
  PptxRoundTripSummary,
} from './endToEndValidation.ts';

export type PptxRoundTripValidationResult = {
  summary: PptxRoundTripSummary;
  diagnostics: EndToEndDiagnostic[];
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const visibleElementText = (element: SceneElement): string[] => {
  if (element.kind === 'text') return [element.runs.map((run) => run.text).join('')].map(normalizeText).filter(Boolean);
  if (element.kind === 'table') return [element.headers.join(' '), ...element.rows.map((row) => row.join(' '))].map(normalizeText).filter(Boolean);
  return [];
};

const hasFullSlideImageFrame = (element: SceneElement): boolean => (
  element.kind === 'image'
  && element.frame.x <= 0
  && element.frame.y <= 0
  && element.frame.w >= 1280
  && element.frame.h >= 720
);

const operationFrameIsFullSlide = (options: Record<string, unknown>): boolean => (
  Number(options.x) <= 0
  && Number(options.y) <= 0
  && Number(options.w) >= 10
  && Number(options.h) >= 5.625
);

const diagnostic = (
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

export const validatePptxRoundTrip = (
  presentation: CompiledScenePresentation,
): PptxRoundTripValidationResult => {
  const diagnostics: EndToEndDiagnostic[] = [];
  let nativeTextOperationCount = 0;
  let nativeTableOperationCount = 0;
  let nativeShapeOperationCount = 0;
  let imageOperationCount = 0;
  let speakerNotesCount = 0;
  let extractedTextCount = 0;
  let extractedNotesCount = 0;
  let fullSlideImageCount = 0;

  for (const scene of presentation.scenes) {
    const operations = compilePptxSceneOperations(scene);
    const operationsByElementId = new Map(operations
      .filter((operation) => 'elementId' in operation)
      .map((operation) => [operation.elementId, operation] as const));
    const pptxText = getPptxSceneOperationText(operations).map(normalizeText).filter(Boolean);
    const previewText = scene.elements.flatMap(visibleElementText);
    const sceneTextOperations = operations.filter((operation) => operation.kind === 'addText');

    nativeTextOperationCount += sceneTextOperations.length;
    nativeTableOperationCount += operations.filter((operation) => operation.kind === 'addTable').length;
    nativeShapeOperationCount += operations.filter((operation) => operation.kind === 'addShape').length;
    imageOperationCount += operations.filter((operation) => operation.kind === 'addImage').length;
    speakerNotesCount += operations.filter((operation) => operation.kind === 'addNotes').length;
    extractedTextCount += pptxText.length;
    extractedNotesCount += operations.filter((operation) => operation.kind === 'addNotes').length;

    if (scene.speakerNotes.trim() && !operations.some((operation) => operation.kind === 'addNotes')) {
      diagnostics.push(diagnostic(
        'e2e_pptx_round_trip_invalid',
        `Scene ${scene.id} speaker notes are missing from PPTX operations.`,
        scene.id,
      ));
    }

    if (sceneTextOperations.length === 0) {
      diagnostics.push(diagnostic(
        'e2e_pptx_round_trip_invalid',
        `Scene ${scene.id} has no native PPTX text operation.`,
        scene.id,
      ));
    }

    for (const text of previewText) {
      if (!pptxText.includes(text)) {
        diagnostics.push(diagnostic(
          'e2e_pptx_round_trip_invalid',
          `Scene ${scene.id} visible preview text is missing from PPTX operations.`,
          scene.id,
        ));
        break;
      }
    }

    for (const element of scene.elements) {
      if (element.kind === 'group') continue;
      const operation = operationsByElementId.get(element.id);
      if (!operation) {
        diagnostics.push(diagnostic(
          'e2e_pptx_round_trip_invalid',
          `Scene ${scene.id} element ${element.id} is missing a PPTX operation.`,
          scene.id,
          element.id,
        ));
        continue;
      }

      if (element.kind === 'image' && (hasFullSlideImageFrame(element) || operationFrameIsFullSlide(operation.options))) {
        fullSlideImageCount += 1;
        diagnostics.push(diagnostic(
          'e2e_full_slide_raster',
          `Scene ${scene.id} contains a full-slide image PPTX operation.`,
          scene.id,
          element.id,
        ));
      }
    }
  }

  const checked = Math.max(1, presentation.scenes.length);
  const blocking = diagnostics.filter((item) => item.severity === 'blocking').length;
  return {
    summary: {
      checked,
      passed: diagnostics.length === 0 ? checked : Math.max(0, checked - diagnostics.length),
      failed: diagnostics.length,
      blocking,
      slideCount: presentation.scenes.length,
      nativeTextOperationCount,
      nativeTableOperationCount,
      nativeShapeOperationCount,
      imageOperationCount,
      speakerNotesCount,
      extractedTextCount,
      extractedNotesCount,
      fullSlideImageCount,
    },
    diagnostics,
  };
};
