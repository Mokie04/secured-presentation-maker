import type {
  SemanticLayoutId,
  SemanticSlideIntent,
  SemanticSlideSpec,
  SlideSlotValue,
} from './semanticSlideSpec.ts';

export const COMPILED_SLIDE_SCENE_VERSION = 'compiled-slide-scene-v1';

export type SceneElementKind =
  | 'text'
  | 'shape'
  | 'table'
  | 'connector'
  | 'group'
  | 'image';

export type SceneFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SceneTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
};

export type SceneElementBase = {
  id: string;
  kind: SceneElementKind;
  frame: SceneFrame;
  editable: boolean;
  readingOrder: number;
};

export type SceneTextElement = SceneElementBase & {
  kind: 'text';
  role: 'title' | 'subtitle' | 'prompt' | 'body' | 'label' | 'note';
  runs: SceneTextRun[];
  fontSize: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle';
};

export type SceneShapeElement = SceneElementBase & {
  kind: 'shape';
  shape: 'rect' | 'roundRect' | 'line' | 'pill';
  fill: string;
  stroke?: string;
  radius?: number;
};

export type SceneTableElement = SceneElementBase & {
  kind: 'table';
  headers: string[];
  rows: string[][];
  fontSize: number;
  headerFill: string;
  cellFill: string;
  textColor: string;
};

export type SceneConnectorElement = SceneElementBase & {
  kind: 'connector';
  from: string;
  to: string;
  stroke: string;
  arrowEnd: boolean;
};

export type SceneGroupElement = SceneElementBase & {
  kind: 'group';
  children: string[];
};

export type SceneImageElement = SceneElementBase & {
  kind: 'image';
  src: string;
  altText: string;
};

export type SceneElement =
  | SceneTextElement
  | SceneShapeElement
  | SceneTableElement
  | SceneConnectorElement
  | SceneGroupElement
  | SceneImageElement;

export type CompiledSlideScene = {
  contractVersion: typeof COMPILED_SLIDE_SCENE_VERSION;
  id: string;
  semanticSlideSpecId: string;
  storyboardScreenId: string;
  unitId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  size: {
    width: 1280;
    height: 720;
    aspect: '16:9';
  };
  background: string;
  elements: SceneElement[];
  speakerNotes: string;
  readingOrder: string[];
};

export type CompiledScenePresentation = {
  kind: 'compiled-scene-presentation';
  contractVersion: typeof COMPILED_SLIDE_SCENE_VERSION;
  title: string;
  scenes: CompiledSlideScene[];
};

export type SceneValidationDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type SceneValidationDiagnosticCode =
  | 'scene_contract_invalid'
  | 'scene_element_off_canvas'
  | 'scene_text_overflow'
  | 'scene_uneditable_visible_text'
  | 'scene_reading_order_invalid'
  | 'scene_full_slide_raster_forbidden'
  | 'scene_preview_pptx_parity_mismatch';

export type SceneValidationDiagnostic = {
  code: SceneValidationDiagnosticCode;
  severity: SceneValidationDiagnosticSeverity;
  message: string;
  sceneId?: string;
  elementId?: string;
};

export type CompiledScenePresentationResult =
  | { ok: true; presentation: CompiledScenePresentation }
  | { ok: false; diagnostics: SceneValidationDiagnostic[] };

export type SemanticLayoutDefinition = {
  id: SemanticLayoutId;
  semantic: boolean;
  allowedIntents: SemanticSlideIntent[];
  requiredSlots: string[];
  optionalSlots: string[];
  maxTextChars: number;
  maxListItems: number;
};

export type PreviewSceneDescriptor = {
  elementId: string;
  kind: SceneElementKind;
  frame: SceneFrame;
  readingOrder: number;
  text: string[];
};

const SCENE_WIDTH = 1280;
const SCENE_HEIGHT = 720;

export const SEMANTIC_LAYOUT_DEFINITIONS: readonly SemanticLayoutDefinition[] = [
  {
    id: 'title-context',
    semantic: true,
    allowedIntents: ['title-context'],
    requiredSlots: ['title'],
    optionalSlots: ['body'],
    maxTextChars: 220,
    maxListItems: 3,
  },
  {
    id: 'learning-targets-stack',
    semantic: true,
    allowedIntents: ['learning-targets'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 900,
    maxListItems: 8,
  },
  {
    id: 'prompt-card',
    semantic: true,
    allowedIntents: ['discussion-prompt', 'question'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 700,
    maxListItems: 5,
  },
  {
    id: 'activity-board',
    semantic: true,
    allowedIntents: ['activity-board', 'prior-knowledge', 'wrap-up'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 900,
    maxListItems: 8,
  },
  {
    id: 'evidence-capture-board',
    semantic: true,
    allowedIntents: ['evidence-capture'],
    requiredSlots: ['title', 'requirements'],
    optionalSlots: ['body', 'successCriteria'],
    maxTextChars: 900,
    maxListItems: 8,
  },
  {
    id: 'guided-example-steps',
    semantic: true,
    allowedIntents: ['guided-example', 'process-flow'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 900,
    maxListItems: 6,
  },
  {
    id: 'comparison-matrix',
    semantic: true,
    allowedIntents: ['comparison-matrix'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 900,
    maxListItems: 8,
  },
  {
    id: 'process-flow-horizontal',
    semantic: true,
    allowedIntents: ['process-flow'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 850,
    maxListItems: 5,
  },
  {
    id: 'question-reveal-pair',
    semantic: true,
    allowedIntents: ['answer-reveal'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 700,
    maxListItems: 4,
  },
  {
    id: 'exit-ticket-card',
    semantic: true,
    allowedIntents: ['exit-ticket'],
    requiredSlots: ['title', 'requirements'],
    optionalSlots: ['body', 'successCriteria'],
    maxTextChars: 850,
    maxListItems: 6,
  },
  {
    id: 'generic-bullets',
    semantic: false,
    allowedIntents: [
      'title-context',
      'learning-targets',
      'prior-knowledge',
      'discussion-prompt',
      'activity-board',
      'evidence-capture',
      'guided-example',
      'comparison-matrix',
      'process-flow',
      'question',
      'answer-reveal',
      'exit-ticket',
      'wrap-up',
    ],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['requirements', 'successCriteria'],
    maxTextChars: 800,
    maxListItems: 8,
  },
];

const sceneDiagnostic = (
  code: SceneValidationDiagnosticCode,
  message: string,
  detail: Pick<SceneValidationDiagnostic, 'sceneId' | 'elementId'> = {},
): SceneValidationDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  ...detail,
});

const clampText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const slotText = (slot: SlideSlotValue | undefined): string => {
  if (!slot) return '';
  if (slot.kind === 'text') return clampText(slot.text);
  if (slot.kind === 'list') return slot.items.map(clampText).filter(Boolean).join('\n');
  if (slot.kind === 'cards') return slot.cards.map((card) => [card.title, card.body].map(clampText).filter(Boolean).join(': ')).join('\n');
  if (slot.kind === 'table') return [slot.headers.join(' | '), ...slot.rows.map((row) => row.join(' | '))].map(clampText).filter(Boolean).join('\n');
  return slot.steps.map((step) => [step.label, step.body].map(clampText).filter(Boolean).join(': ')).join('\n');
};

const listItems = (slot: SlideSlotValue | undefined): string[] => {
  if (!slot) return [];
  if (slot.kind === 'text') return clampText(slot.text) ? [clampText(slot.text)] : [];
  if (slot.kind === 'list') return slot.items.map(clampText).filter(Boolean);
  if (slot.kind === 'cards') return slot.cards.map((card) => [card.title, card.body].map(clampText).filter(Boolean).join(': ')).filter(Boolean);
  if (slot.kind === 'table') return slot.rows.map((row) => row.map(clampText).filter(Boolean).join(' | ')).filter(Boolean);
  return slot.steps.map((step) => [step.label, step.body].map(clampText).filter(Boolean).join(': ')).filter(Boolean);
};

const requirementRows = (spec: SemanticSlideSpec): string[][] => {
  const requirements = listItems(spec.slots.requirements);
  const body = listItems(spec.slots.body);
  const sourceRows = requirements.length > 0 ? requirements : body;
  return sourceRows.length > 0
    ? sourceRows.map((item, index) => [`${index + 1}`, item])
    : [['1', 'Source-backed learner response']];
};

const makeShape = (
  id: string,
  readingOrder: number,
  frame: SceneFrame,
  fill: string,
  stroke = 'D4DDE8',
): SceneShapeElement => ({
  id,
  kind: 'shape',
  frame,
  editable: true,
  readingOrder,
  shape: 'roundRect',
  fill,
  stroke,
  radius: 24,
});

const makeText = (
  id: string,
  readingOrder: number,
  frame: SceneFrame,
  text: string,
  role: SceneTextElement['role'],
  fontSize: number,
  options: Partial<Pick<SceneTextElement, 'align' | 'valign'>> & { bold?: boolean; color?: string } = {},
): SceneTextElement => ({
  id,
  kind: 'text',
  frame,
  editable: true,
  readingOrder,
  role,
  runs: [{
    text,
    bold: options.bold,
    color: options.color ?? '111827',
  }],
  fontSize,
  lineHeight: Math.round(fontSize * 1.25),
  align: options.align ?? 'left',
  valign: options.valign ?? 'top',
});

const makeTable = (
  id: string,
  readingOrder: number,
  frame: SceneFrame,
  headers: string[],
  rows: string[][],
): SceneTableElement => ({
  id,
  kind: 'table',
  frame,
  editable: true,
  readingOrder,
  headers,
  rows,
  fontSize: 21,
  headerFill: '0F766E',
  cellFill: 'ECFDF5',
  textColor: '111827',
});

const makeConnector = (
  id: string,
  readingOrder: number,
  frame: SceneFrame,
  from: string,
  to: string,
): SceneConnectorElement => ({
  id,
  kind: 'connector',
  frame,
  editable: true,
  readingOrder,
  from,
  to,
  stroke: '64748B',
  arrowEnd: true,
});

const asBulletText = (items: string[]): string => items.map((item) => `- ${item}`).join('\n');

const buildSceneElements = (spec: SemanticSlideSpec, sceneId: string): SceneElement[] => {
  const title = slotText(spec.slots.title) || spec.accessibility.slidePurpose;
  const bodyItems = listItems(spec.slots.body);
  const successItems = listItems(spec.slots.successCriteria);
  const requirements = listItems(spec.slots.requirements);
  const bodyText = asBulletText(bodyItems.length > 0 ? bodyItems : [spec.accessibility.slidePurpose]);
  const successText = successItems.length > 0 ? asBulletText(successItems) : '';
  const baseId = `${sceneId}-el`;

  if (spec.layoutId === 'evidence-capture-board' || spec.layoutId === 'exit-ticket-card') {
    return [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 82, y: 72, w: 1116, h: 70 }, title, 'title', 34, { bold: true }),
      makeText(`${baseId}-prompt`, 2, { x: 88, y: 160, w: 520, h: 130 }, bodyText, 'prompt', 24),
      makeTable(`${baseId}-table`, 3, { x: 648, y: 158, w: 506, h: 340 }, ['#', 'Required evidence or output'], requirementRows(spec)),
      makeText(
        `${baseId}-criteria`,
        4,
        { x: 88, y: 530, w: 1066, h: 104 },
        successText || asBulletText(requirements),
        'body',
        22,
      ),
    ];
  }

  if (spec.layoutId === 'learning-targets-stack') {
    const targets = bodyItems.length > 0 ? bodyItems : [title];
    const cardHeight = Math.min(132, Math.max(86, Math.floor(396 / Math.max(targets.length, 1))));
    const elements: SceneElement[] = [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 82, y: 74, w: 1116, h: 66 }, title, 'title', 34, { bold: true }),
    ];
    targets.slice(0, 4).forEach((target, index) => {
      const y = 168 + index * (cardHeight + 18);
      elements.push(makeShape(`${baseId}-target-card-${index + 1}`, 2 + index * 2, { x: 96, y, w: 1088, h: cardHeight }, 'EEF2FF', 'C7D2FE'));
      elements.push(makeText(`${baseId}-target-text-${index + 1}`, 3 + index * 2, { x: 128, y: y + 22, w: 1024, h: cardHeight - 36 }, target, 'body', 24));
    });
    if (successText) {
      elements.push(makeText(`${baseId}-criteria`, 12, { x: 104, y: 604, w: 1072, h: 62 }, successText, 'note', 18));
    }
    return elements;
  }

  if (spec.layoutId === 'guided-example-steps' || spec.layoutId === 'process-flow-horizontal') {
    const steps = bodyItems.length > 0 ? bodyItems : [spec.accessibility.slidePurpose];
    const visibleSteps = steps.slice(0, 4);
    const cardWidth = Math.floor((1080 - Math.max(0, visibleSteps.length - 1) * 24) / Math.max(visibleSteps.length, 1));
    const elements: SceneElement[] = [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 82, y: 74, w: 1116, h: 70 }, title, 'title', 34, { bold: true }),
    ];
    visibleSteps.forEach((step, index) => {
      const x = 96 + index * (cardWidth + 24);
      const cardId = `${baseId}-step-card-${index + 1}`;
      elements.push(makeShape(cardId, 2 + index * 3, { x, y: 192, w: cardWidth, h: 300 }, 'FFF7ED', 'FDBA74'));
      elements.push(makeText(`${baseId}-step-label-${index + 1}`, 3 + index * 3, { x: x + 22, y: 218, w: cardWidth - 44, h: 44 }, `Step ${index + 1}`, 'label', 20, { bold: true, color: '9A3412' }));
      elements.push(makeText(`${baseId}-step-text-${index + 1}`, 4 + index * 3, { x: x + 22, y: 280, w: cardWidth - 44, h: 172 }, step, 'body', 21));
      if (index > 0) {
        elements.push(makeConnector(`${baseId}-connector-${index}`, 20 + index, { x: x - 24, y: 328, w: 24, h: 4 }, `${baseId}-step-card-${index}`, cardId));
      }
    });
    if (successText) {
      elements.push(makeText(`${baseId}-criteria`, 30, { x: 96, y: 538, w: 1088, h: 94 }, successText, 'note', 20));
    }
    return elements;
  }

  if (spec.layoutId === 'prompt-card' || spec.layoutId === 'question-reveal-pair') {
    return [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 84, y: 74, w: 1112, h: 70 }, title, 'title', 34, { bold: true }),
      makeShape(`${baseId}-prompt-card`, 2, { x: 116, y: 174, w: 1048, h: 292 }, 'F0FDFA', '99F6E4'),
      makeText(`${baseId}-prompt`, 3, { x: 158, y: 222, w: 964, h: 194 }, bodyText, 'prompt', 27),
      makeText(`${baseId}-criteria`, 4, { x: 134, y: 516, w: 1012, h: 100 }, successText || asBulletText(requirements), 'body', 21),
    ];
  }

  return [
    makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
    makeText(`${baseId}-title`, 1, { x: 82, y: 74, w: 1116, h: 70 }, title, 'title', 34, { bold: true }),
    makeShape(`${baseId}-task-card`, 2, { x: 86, y: 170, w: 528, h: 376 }, 'EEF2FF', 'C7D2FE'),
    makeText(`${baseId}-task`, 3, { x: 126, y: 220, w: 448, h: 256 }, bodyText, 'body', 24),
    makeShape(`${baseId}-criteria-card`, 4, { x: 666, y: 170, w: 528, h: 376 }, 'F0FDF4', 'BBF7D0'),
    makeText(`${baseId}-criteria`, 5, { x: 706, y: 220, w: 448, h: 256 }, successText || asBulletText(requirements), 'body', 23),
  ];
};

const isVisibleTextElement = (element: SceneElement): element is SceneTextElement | SceneTableElement => (
  element.kind === 'text' || element.kind === 'table'
);

const estimateWrappedLineCount = (text: string, frameWidth: number, fontSize: number): number => {
  const averageCharWidth = fontSize * 0.54;
  const charsPerLine = Math.max(1, Math.floor(frameWidth / averageCharWidth));
  return text
    .split(/\n+/)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
};

const elementText = (element: SceneElement): string[] => {
  if (element.kind === 'text') return [element.runs.map((run) => run.text).join('')].filter(Boolean);
  if (element.kind === 'table') return [element.headers.join(' '), ...element.rows.map((row) => row.join(' '))].filter(Boolean);
  return [];
};

const validateTextFit = (scene: CompiledSlideScene, element: SceneTextElement | SceneTableElement): SceneValidationDiagnostic[] => {
  const text = elementText(element).join('\n');
  if (!text.trim()) return [];
  if (element.kind === 'table') {
    const rowCount = element.rows.length + 1;
    const estimatedHeight = rowCount * element.fontSize * 1.65;
    return estimatedHeight > element.frame.h
      ? [sceneDiagnostic('scene_text_overflow', `Table ${element.id} does not fit in its scene frame.`, { sceneId: scene.id, elementId: element.id })]
      : [];
  }
  const lines = estimateWrappedLineCount(text, element.frame.w, element.fontSize);
  const estimatedHeight = lines * element.lineHeight;
  return estimatedHeight > element.frame.h
    ? [sceneDiagnostic('scene_text_overflow', `Text element ${element.id} does not fit in its scene frame.`, { sceneId: scene.id, elementId: element.id })]
    : [];
};

const isFrameOffCanvas = (frame: SceneFrame): boolean => (
  frame.x < 0
  || frame.y < 0
  || frame.w <= 0
  || frame.h <= 0
  || frame.x + frame.w > SCENE_WIDTH
  || frame.y + frame.h > SCENE_HEIGHT
);

export const getSceneVisibleText = (scene: CompiledSlideScene): string[] => (
  scene.elements.flatMap(elementText).map(clampText).filter(Boolean)
);

export const validateCompiledSlideScene = (scene: CompiledSlideScene): SceneValidationDiagnostic[] => {
  const diagnostics: SceneValidationDiagnostic[] = [];
  if (
    scene.contractVersion !== COMPILED_SLIDE_SCENE_VERSION
    || scene.size.width !== SCENE_WIDTH
    || scene.size.height !== SCENE_HEIGHT
    || scene.size.aspect !== '16:9'
  ) {
    diagnostics.push(sceneDiagnostic('scene_contract_invalid', `Scene ${scene.id} does not use the Gate 3 16:9 scene contract.`, { sceneId: scene.id }));
  }

  const elementIds = new Set(scene.elements.map((element) => element.id));
  const visibleElementIds = new Set<string>();

  for (const element of scene.elements) {
    if (isFrameOffCanvas(element.frame)) {
      diagnostics.push(sceneDiagnostic('scene_element_off_canvas', `Scene element ${element.id} is outside the 16:9 canvas.`, { sceneId: scene.id, elementId: element.id }));
    }

    if (isVisibleTextElement(element)) {
      visibleElementIds.add(element.id);
      if (!element.editable) {
        diagnostics.push(sceneDiagnostic('scene_uneditable_visible_text', `Visible text element ${element.id} is not editable.`, { sceneId: scene.id, elementId: element.id }));
      }
      diagnostics.push(...validateTextFit(scene, element));
    }

    if (element.kind === 'image') {
      diagnostics.push(sceneDiagnostic('scene_full_slide_raster_forbidden', `Image element ${element.id} is not allowed in Gate 3 scenes.`, { sceneId: scene.id, elementId: element.id }));
    }
  }

  for (const id of scene.readingOrder) {
    if (!elementIds.has(id)) {
      diagnostics.push(sceneDiagnostic('scene_reading_order_invalid', `Scene ${scene.id} reading order references missing element ${id}.`, { sceneId: scene.id, elementId: id }));
    }
  }
  for (const id of visibleElementIds) {
    if (!scene.readingOrder.includes(id)) {
      diagnostics.push(sceneDiagnostic('scene_reading_order_invalid', `Scene ${scene.id} reading order omits visible element ${id}.`, { sceneId: scene.id, elementId: id }));
    }
  }

  return diagnostics;
};

export const formatSceneValidationDiagnostics = (diagnostics: SceneValidationDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};

export const createPreviewSceneDescriptors = (scene: CompiledSlideScene): PreviewSceneDescriptor[] => (
  scene.elements.map((element) => ({
    elementId: element.id,
    kind: element.kind,
    frame: { ...element.frame },
    readingOrder: element.readingOrder,
    text: elementText(element),
  }))
);

const compileSpecToScene = (spec: SemanticSlideSpec, index: number): CompiledSlideScene => {
  const sceneId = `scene-${String(index + 1).padStart(3, '0')}`;
  const elements = buildSceneElements(spec, sceneId);
  return {
    contractVersion: COMPILED_SLIDE_SCENE_VERSION,
    id: sceneId,
    semanticSlideSpecId: spec.id,
    storyboardScreenId: spec.storyboardScreenId,
    unitId: spec.unitId,
    sourceStepIds: [...spec.sourceStepIds],
    sourceObjectiveIds: [...spec.sourceObjectiveIds],
    size: {
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      aspect: '16:9',
    },
    background: 'FFFFFF',
    elements,
    speakerNotes: spec.speakerNotes,
    readingOrder: elements.filter(isVisibleTextElement).sort((a, b) => a.readingOrder - b.readingOrder).map((element) => element.id),
  };
};

export const compileSemanticSlideSpecsToScenes = (
  specs: readonly SemanticSlideSpec[],
  options: { title: string; selectedUnitLabel?: string },
): CompiledScenePresentationResult => {
  const scenes = specs.map((spec, index) => compileSpecToScene(spec, index));
  const diagnostics = scenes.flatMap(validateCompiledSlideScene);
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')) return { ok: false, diagnostics };
  return {
    ok: true,
    presentation: {
      kind: 'compiled-scene-presentation',
      contractVersion: COMPILED_SLIDE_SCENE_VERSION,
      title: options.selectedUnitLabel ? `${options.title} - ${options.selectedUnitLabel}` : options.title,
      scenes,
    },
  };
};
