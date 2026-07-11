import type { CompiledSlideScene, SceneElement, SceneTextElement } from './compiledSlideScene.ts';

export type PptxSceneOperation =
  | { kind: 'addText'; elementId: string; text: string; options: Record<string, unknown> }
  | { kind: 'addShape'; elementId: string; shape: string; options: Record<string, unknown> }
  | { kind: 'addTable'; elementId: string; rows: string[][]; options: Record<string, unknown> }
  | { kind: 'addImage'; elementId: string; data: string; options: Record<string, unknown> }
  | { kind: 'addNotes'; text: string };

const frameToPptxOptions = (frame: SceneElement['frame']): Record<string, number> => ({
  x: frame.x / 128,
  y: frame.y / 128,
  w: frame.w / 128,
  h: frame.h / 128,
});

const textRunsToText = (element: SceneTextElement): string => (
  element.runs.map((run) => run.text).join('')
);

const compileSceneElementToPptxOperation = (element: SceneElement): PptxSceneOperation[] => {
  if (element.kind === 'text') {
    return [{
      kind: 'addText',
      elementId: element.id,
      text: textRunsToText(element),
      options: {
        ...frameToPptxOptions(element.frame),
        fontFace: 'Poppins',
        fontSize: element.fontSize,
        color: element.runs[0]?.color || '111827',
        bold: element.runs.some((run) => run.bold),
        italic: element.runs.some((run) => run.italic),
        align: element.align,
        valign: element.valign,
        fit: 'shrink',
        margin: 0.06,
        breakLine: false,
      },
    }];
  }

  if (element.kind === 'table') {
    return [{
      kind: 'addTable',
      elementId: element.id,
      rows: [element.headers, ...element.rows],
      options: {
        ...frameToPptxOptions(element.frame),
        fontFace: 'Poppins',
        fontSize: element.fontSize,
        color: element.textColor,
        border: { color: 'CBD5E1', pt: 1 },
        fill: { color: element.cellFill },
        margin: 0.06,
      },
    }];
  }

  if (element.kind === 'shape') {
    return [{
      kind: 'addShape',
      elementId: element.id,
      shape: element.shape,
      options: {
        ...frameToPptxOptions(element.frame),
        fill: { color: element.fill },
        line: { color: element.stroke || element.fill, width: 1 },
        radius: element.radius,
      },
    }];
  }

  if (element.kind === 'connector') {
    return [{
      kind: 'addShape',
      elementId: element.id,
      shape: 'line',
      options: {
        ...frameToPptxOptions(element.frame),
        line: { color: element.stroke, width: 1.5, beginArrowType: 'none', endArrowType: element.arrowEnd ? 'triangle' : 'none' },
      },
    }];
  }

  if (element.kind === 'image') {
    return [{
      kind: 'addImage',
      elementId: element.id,
      data: element.src,
      options: {
        ...frameToPptxOptions(element.frame),
        altText: element.altText,
      },
    }];
  }

  return [];
};

export const compilePptxSceneOperations = (scene: CompiledSlideScene): PptxSceneOperation[] => (
  scene.elements.flatMap((element) => compileSceneElementToPptxOperation(element)).concat(
    scene.speakerNotes.trim() ? [{ kind: 'addNotes' as const, text: scene.speakerNotes }] : [],
  )
);

export const getPptxSceneOperationText = (operations: readonly PptxSceneOperation[]): string[] => (
  operations.flatMap((operation) => {
    if (operation.kind === 'addText') return [operation.text];
    if (operation.kind === 'addTable') return operation.rows.map((row) => row.join(' '));
    return [];
  })
);
