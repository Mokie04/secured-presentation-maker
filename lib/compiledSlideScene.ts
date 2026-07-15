import type {
  SemanticLayoutId,
  SemanticSlideIntent,
  SemanticSlideSpec,
  SlideSlotValue,
} from './semanticSlideSpec.ts';
import type { DeckVisualSystem } from './deckVisualSystem.ts';
import type { SceneAssetVisualRole } from './sceneAssetRequests.ts';
import type { SceneResolvedAsset } from './sceneAssetResolver.ts';

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
  shape: 'rect' | 'roundRect' | 'line' | 'pill' | 'ellipse' | 'diamond';
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
  arrowStart?: boolean;
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
  assetId: string;
  visualRole: SceneAssetVisualRole;
  sourceStepIds: string[];
  storyboardScreenId: string;
  semanticSlideSpecId: string;
  noEmbeddedText: true;
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

export type CompileSemanticSlideSpecsOptions = {
  title: string;
  selectedUnitLabel?: string;
  visualSystemsByUnitId?: Record<string, DeckVisualSystem>;
  resolvedAssetsBySpecId?: Record<string, SceneResolvedAsset[]>;
};

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
  {
    id: 'visual-thesis',
    semantic: true,
    allowedIntents: ['title-context', 'learning-targets', 'wrap-up'],
    requiredSlots: ['title'],
    optionalSlots: ['body', 'diagram', 'requirements', 'successCriteria'],
    maxTextChars: 420,
    maxListItems: 4,
  },
  {
    id: 'relationship-diagram',
    semantic: true,
    allowedIntents: ['guided-example', 'comparison-matrix', 'process-flow'],
    requiredSlots: ['title', 'diagram'],
    optionalSlots: ['body', 'requirements', 'successCriteria'],
    maxTextChars: 620,
    maxListItems: 6,
  },
  {
    id: 'comparison-panels',
    semantic: true,
    allowedIntents: ['comparison-matrix', 'guided-example'],
    requiredSlots: ['title', 'body'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 760,
    maxListItems: 6,
  },
  {
    id: 'question-choices',
    semantic: true,
    allowedIntents: ['question', 'exit-ticket'],
    requiredSlots: ['title', 'question'],
    optionalSlots: ['successCriteria'],
    maxTextChars: 620,
    maxListItems: 5,
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
  if (slot.kind === 'steps') return slot.steps.map((step) => [step.label, step.body].map(clampText).filter(Boolean).join(': ')).join('\n');
  if (slot.kind === 'question') return [slot.prompt, ...slot.choices.map((choice) => choice.text)].map(clampText).filter(Boolean).join('\n');
  return [
    ...slot.nodes.flatMap((node) => [node.label, node.detail]),
    ...slot.edges.map((edge) => edge.label),
  ].filter((value): value is string => Boolean(value)).map(clampText).join('\n');
};

const listItems = (slot: SlideSlotValue | undefined): string[] => {
  if (!slot) return [];
  if (slot.kind === 'text') return clampText(slot.text) ? [clampText(slot.text)] : [];
  if (slot.kind === 'list') return slot.items.map(clampText).filter(Boolean);
  if (slot.kind === 'cards') return slot.cards.map((card) => [card.title, card.body].map(clampText).filter(Boolean).join(': ')).filter(Boolean);
  if (slot.kind === 'table') return slot.rows.map((row) => row.map(clampText).filter(Boolean).join(' | ')).filter(Boolean);
  if (slot.kind === 'steps') return slot.steps.map((step) => [step.label, step.body].map(clampText).filter(Boolean).join(': ')).filter(Boolean);
  if (slot.kind === 'question') return [slot.prompt, ...slot.choices.map((choice) => choice.text)].map(clampText).filter(Boolean);
  return [
    ...slot.nodes.flatMap((node) => [node.label, node.detail]),
    ...slot.edges.map((edge) => edge.label),
  ].filter((value): value is string => Boolean(value)).map(clampText);
};

const requirementRows = (spec: SemanticSlideSpec): string[][] => {
  const requirements = listItems(spec.slots.requirements);
  return requirements.map((item, index) => [`${index + 1}`, item]);
};

const makeShape = (
  id: string,
  readingOrder: number,
  frame: SceneFrame,
  fill: string,
  stroke = 'D4DDE8',
  shape: SceneShapeElement['shape'] = 'roundRect',
  radius = 24,
): SceneShapeElement => ({
  id,
  kind: 'shape',
  frame,
  editable: true,
  readingOrder,
  shape,
  fill,
  stroke,
  radius,
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
  direction: 'forward' | 'both' | 'none' = 'forward',
  reverse = false,
): SceneConnectorElement => ({
  id,
  kind: 'connector',
  frame,
  editable: true,
  readingOrder,
  from,
  to,
  stroke: '64748B',
  arrowStart: direction === 'both' || (direction === 'forward' && reverse),
  arrowEnd: direction === 'both' || (direction === 'forward' && !reverse),
});

type ScenePoint = { x: number; y: number };

const connectorFrameBetweenPoints = (start: ScenePoint, end: ScenePoint): SceneFrame => {
  const horizontal = start.y === end.y;
  return horizontal
    ? { x: Math.min(start.x, end.x), y: start.y - 2, w: Math.max(4, Math.abs(end.x - start.x)), h: 4 }
    : { x: start.x - 2, y: Math.min(start.y, end.y), w: 4, h: Math.max(4, Math.abs(end.y - start.y)) };
};

const makeConnectorSegment = (
  id: string,
  readingOrder: number,
  start: ScenePoint,
  end: ScenePoint,
  from: string,
  to: string,
  arrowAtPathStart = false,
  arrowAtPathEnd = false,
): SceneConnectorElement => {
  const horizontal = start.y === end.y;
  const frameStartIsPathStart = horizontal ? start.x <= end.x : start.y <= end.y;
  return {
    id,
    kind: 'connector',
    frame: connectorFrameBetweenPoints(start, end),
    editable: true,
    readingOrder,
    from,
    to,
    stroke: '64748B',
    arrowStart: frameStartIsPathStart ? arrowAtPathStart : arrowAtPathEnd,
    arrowEnd: frameStartIsPathStart ? arrowAtPathEnd : arrowAtPathStart,
  };
};

const asBulletText = (items: string[]): string => items.map((item) => `- ${item}`).join('\n');

const uniqueTextItems = (items: readonly string[]): string[] => Array.from(new Set(items.map(clampText).filter(Boolean)));

const makeTitleBand = (
  baseId: string,
  title: string,
): SceneElement[] => [
  makeShape(`${baseId}-title-band`, 0, { x: 72, y: 54, w: 1136, h: 96 }, 'F8FAFC', 'E2E8F0'),
  makeText(`${baseId}-title`, 1, { x: 104, y: 68, w: 1072, h: 68 }, title, 'title', 34, {
    bold: true,
    valign: 'middle',
  }),
];

type DiagramSlot = Extract<SlideSlotValue, { kind: 'diagram' }>;
type QuestionSlot = Extract<SlideSlotValue, { kind: 'question' }>;

type OrthogonalEdgeRoute = {
  edgeIndex: number;
  points: ScenePoint[];
  labelFrame?: SceneFrame;
};

const RELATIONSHIP_NODE_Y = 360;
const RELATIONSHIP_NODE_SIZE = 120;
const RELATIONSHIP_ROUTE_LANES = [282, 488, 306, 514, 330, 540, 354, 566] as const;

const buildRelationshipNodeFrames = (diagram: DiagramSlot): Map<string, SceneFrame> => {
  const nodeGap = 28;
  const nodeSlotWidth = Math.floor((1136 - nodeGap * Math.max(0, diagram.nodes.length - 1)) / Math.max(1, diagram.nodes.length));
  const visualNodeSize = Math.min(RELATIONSHIP_NODE_SIZE, nodeSlotWidth);
  return new Map(diagram.nodes.map((node, index) => {
    const slotX = 72 + index * (nodeSlotWidth + nodeGap);
    return [node.id, {
      x: slotX + Math.floor((nodeSlotWidth - visualNodeSize) / 2),
      y: RELATIONSHIP_NODE_Y,
      w: visualNodeSize,
      h: visualNodeSize,
    }];
  }));
};

const paddedSceneFrame = (frame: SceneFrame, padding = 4): SceneFrame => ({
  x: frame.x - padding,
  y: frame.y - padding,
  w: frame.w + padding * 2,
  h: frame.h + padding * 2,
});

const routeSegmentFrames = (route: OrthogonalEdgeRoute): SceneFrame[] => (
  route.points.slice(0, -1).map((point, index) => connectorFrameBetweenPoints(point, route.points[index + 1]))
);

const routesCollide = (left: OrthogonalEdgeRoute, right: OrthogonalEdgeRoute): boolean => {
  const leftSegments = routeSegmentFrames(left);
  const rightSegments = routeSegmentFrames(right);
  if (leftSegments.some((segment) => rightSegments.some((other) => framesOverlap(segment, other)))) return true;
  const leftLabel = left.labelFrame ? paddedSceneFrame(left.labelFrame) : undefined;
  const rightLabel = right.labelFrame ? paddedSceneFrame(right.labelFrame) : undefined;
  if (leftLabel && rightLabel && framesOverlap(leftLabel, rightLabel)) return true;
  if (leftLabel && rightSegments.some((segment) => framesOverlap(leftLabel, segment))) return true;
  if (rightLabel && leftSegments.some((segment) => framesOverlap(rightLabel, segment))) return true;
  return false;
};

const frameIsOnCanvas = (frame: SceneFrame): boolean => (
  frame.x >= 0 && frame.y >= 0 && frame.x + frame.w <= SCENE_WIDTH && frame.y + frame.h <= SCENE_HEIGHT
);

const buildRelationshipEndpointPorts = (
  diagram: DiagramSlot,
  nodeFrames: ReadonlyMap<string, SceneFrame>,
): Map<string, number> => {
  const ports = new Map<string, number>();
  diagram.nodes.forEach((node) => {
    const incidentEdgeIndexes = diagram.edges.flatMap((edge, edgeIndex) => (
      edge.from === node.id || edge.to === node.id ? [edgeIndex] : []
    ));
    const frame = nodeFrames.get(node.id);
    if (!frame) return;
    incidentEdgeIndexes.forEach((edgeIndex, rank) => {
      const offset = incidentEdgeIndexes.length <= 1
        ? 0
        : -frame.w / 3 + (rank * (frame.w * 2 / 3)) / (incidentEdgeIndexes.length - 1);
      ports.set(`${edgeIndex}:${node.id}`, frame.x + frame.w / 2 + offset);
    });
  });
  return ports;
};

const relationshipRouteCandidates = (
  diagram: DiagramSlot,
  edgeIndex: number,
  nodeFrames: ReadonlyMap<string, SceneFrame>,
  endpointPorts: ReadonlyMap<string, number>,
): OrthogonalEdgeRoute[] => {
  const edge = diagram.edges[edgeIndex];
  const fromIndex = diagram.nodes.findIndex((node) => node.id === edge.from);
  const toIndex = diagram.nodes.findIndex((node) => node.id === edge.to);
  const fromFrame = nodeFrames.get(edge.from);
  const toFrame = nodeFrames.get(edge.to);
  if (!fromFrame || !toFrame) return [];
  const label = clampText(edge.label ?? '');
  if (Math.abs(fromIndex - toIndex) <= 1 && !label) {
    const forwardOnCanvas = fromFrame.x <= toFrame.x;
    return [{
      edgeIndex,
      points: [
        { x: forwardOnCanvas ? fromFrame.x + fromFrame.w : fromFrame.x, y: fromFrame.y + fromFrame.h / 2 },
        { x: forwardOnCanvas ? toFrame.x : toFrame.x + toFrame.w, y: toFrame.y + toFrame.h / 2 },
      ],
    }];
  }

  const fromPortX = endpointPorts.get(`${edgeIndex}:${edge.from}`) ?? fromFrame.x + fromFrame.w / 2;
  const toPortX = endpointPorts.get(`${edgeIndex}:${edge.to}`) ?? toFrame.x + toFrame.w / 2;
  const horizontalWidth = Math.abs(toPortX - fromPortX);
  const labelWidth = Math.min(272, Math.max(96, horizontalWidth - 24));
  const candidates: OrthogonalEdgeRoute[] = [];
  RELATIONSHIP_ROUTE_LANES.forEach((laneY) => {
    const routeAboveNodes = laneY < fromFrame.y;
    const fromBoundaryY = routeAboveNodes ? fromFrame.y : fromFrame.y + fromFrame.h;
    const toBoundaryY = routeAboveNodes ? toFrame.y : toFrame.y + toFrame.h;
    const labelYs = label
      ? routeAboveNodes
        ? [laneY - 26, laneY + 4]
        : [laneY + 4, laneY - 26]
      : [undefined];
    labelYs.forEach((labelY) => {
      const route: OrthogonalEdgeRoute = {
        edgeIndex,
        points: [
          { x: fromPortX, y: fromBoundaryY },
          { x: fromPortX, y: laneY },
          { x: toPortX, y: laneY },
          { x: toPortX, y: toBoundaryY },
        ],
        labelFrame: labelY === undefined
          ? undefined
          : {
              x: Math.round((fromPortX + toPortX - labelWidth) / 2),
              y: labelY,
              w: labelWidth,
              h: 24,
            },
      };
      const fromNodeId = diagram.edges[edgeIndex].from;
      const toNodeId = diagram.edges[edgeIndex].to;
      const nonEndNodeFrames = diagram.nodes.flatMap((node) => (
        node.id === fromNodeId || node.id === toNodeId ? [] : [nodeFrames.get(node.id)]
      )).filter((frame): frame is SceneFrame => Boolean(frame));
      const segments = routeSegmentFrames(route);
      const routeFits = segments.every(frameIsOnCanvas)
        && !segments.some((segment) => nonEndNodeFrames.some((frame) => framesOverlap(segment, frame)))
        && (!route.labelFrame || (
          frameIsOnCanvas(route.labelFrame)
          && !Array.from(nodeFrames.values()).some((frame) => framesOverlap(route.labelFrame!, frame))
        ));
      if (routeFits) candidates.push(route);
    });
  });
  return candidates;
};

const buildRelationshipOrthogonalRoutes = (
  diagram: DiagramSlot,
  nodeFrames: ReadonlyMap<string, SceneFrame>,
): Map<number, OrthogonalEdgeRoute> | null => {
  const endpointPorts = buildRelationshipEndpointPorts(diagram, nodeFrames);
  const candidatesByEdge = diagram.edges.map((_, edgeIndex) => (
    relationshipRouteCandidates(diagram, edgeIndex, nodeFrames, endpointPorts)
  ));
  if (candidatesByEdge.some((candidates) => candidates.length === 0)) return null;
  const edgeOrder = diagram.edges.map((_, edgeIndex) => edgeIndex).sort((left, right) => {
    const leftEdge = diagram.edges[left];
    const rightEdge = diagram.edges[right];
    const leftSpan = Math.abs(diagram.nodes.findIndex((node) => node.id === leftEdge.from) - diagram.nodes.findIndex((node) => node.id === leftEdge.to));
    const rightSpan = Math.abs(diagram.nodes.findIndex((node) => node.id === rightEdge.from) - diagram.nodes.findIndex((node) => node.id === rightEdge.to));
    return rightSpan - leftSpan || left - right;
  });
  let searchStates = 0;
  const search = (orderIndex: number, accepted: OrthogonalEdgeRoute[]): OrthogonalEdgeRoute[] | null => {
    searchStates += 1;
    if (searchStates > 50_000) return null;
    if (orderIndex >= edgeOrder.length) return accepted;
    const edgeIndex = edgeOrder[orderIndex];
    for (const candidate of candidatesByEdge[edgeIndex]) {
      if (accepted.some((route) => routesCollide(candidate, route))) continue;
      const result = search(orderIndex + 1, [...accepted, candidate]);
      if (result) return result;
    }
    return null;
  };
  const routes = search(0, []);
  return routes ? new Map(routes.map((route) => [route.edgeIndex, route])) : null;
};

const relationshipNodeStyle = (
  role: string,
): Pick<SceneShapeElement, 'shape' | 'fill' | 'stroke' | 'radius'> => {
  if (role === 'source') return { shape: 'ellipse', fill: 'E0F2FE', stroke: '0369A1', radius: 0 };
  if (role === 'constraint') return { shape: 'diamond', fill: 'FEF3C7', stroke: 'B45309', radius: 0 };
  if (role === 'result') return { shape: 'roundRect', fill: 'DCFCE7', stroke: '15803D', radius: 24 };
  return { shape: 'roundRect', fill: 'FFF7ED', stroke: 'C2410C', radius: 24 };
};

const buildRelationshipDiagramElements = (
  spec: SemanticSlideSpec,
  sceneId: string,
  title: string,
  diagram: DiagramSlot,
): SceneElement[] => {
  const baseId = `${sceneId}-el`;
  const contextItems = [
    slotText(spec.slots.statement ?? spec.slots.body),
    ...listItems(spec.slots.points),
  ].map(clampText).filter(Boolean);
  const contextText = contextItems.join('\n');
  const criteriaText = asBulletText(uniqueTextItems([
    ...listItems(spec.slots.successCriteria),
    ...listItems(spec.slots.requirements),
  ]));
  const nodeFrames = buildRelationshipNodeFrames(diagram);
  const orthogonalRoutes = buildRelationshipOrthogonalRoutes(diagram, nodeFrames);
  const elements: SceneElement[] = [...makeTitleBand(baseId, title)];

  if (contextText) {
    elements.push(makeText(
      `${baseId}-relationship-context`,
      2,
      { x: 92, y: 176, w: 1096, h: 76 },
      contextText,
      'body',
      18,
      { align: 'center', valign: 'middle' },
    ));
  }

  diagram.edges.forEach((edge, index) => {
    const fromFrame = nodeFrames.get(edge.from);
    const toFrame = nodeFrames.get(edge.to);
    if (!fromFrame || !toFrame) return;
    const fromId = `${baseId}-node-${diagram.nodes.findIndex((node) => node.id === edge.from) + 1}`;
    const toId = `${baseId}-node-${diagram.nodes.findIndex((node) => node.id === edge.to) + 1}`;
    const route = orthogonalRoutes?.get(index);
    if (route) {
      route.points.slice(0, -1).forEach((point, segmentIndex) => {
        const isFirst = segmentIndex === 0;
        const isLast = segmentIndex === route.points.length - 2;
        elements.push(makeConnectorSegment(
          `${baseId}-edge-${index + 1}-segment-${segmentIndex + 1}`,
          40 + index * 4 + segmentIndex,
          point,
          route.points[segmentIndex + 1],
          fromId,
          toId,
          isFirst && edge.direction === 'both',
          isLast && (edge.direction === 'forward' || edge.direction === 'both'),
        ));
      });
      return;
    }
    const fromCenter = fromFrame.x + fromFrame.w / 2;
    const toCenter = toFrame.x + toFrame.w / 2;
    const leftFrame = fromCenter <= toCenter ? fromFrame : toFrame;
    const rightFrame = fromCenter <= toCenter ? toFrame : fromFrame;
    const startX = leftFrame.x + leftFrame.w;
    const endX = rightFrame.x;
    elements.push(makeConnector(
      `${baseId}-edge-${index + 1}`,
      40 + index,
      {
        x: startX,
        y: Math.round(leftFrame.y + leftFrame.h / 2),
        w: Math.max(4, endX - startX),
        h: 4,
      },
      fromId,
      toId,
      edge.direction === 'both' || edge.direction === 'none' ? edge.direction : 'forward',
      fromCenter > toCenter,
    ));
  });

  diagram.nodes.forEach((node, index) => {
    const frame = nodeFrames.get(node.id);
    if (!frame) return;
    const style = relationshipNodeStyle(node.role);
    elements.push(makeShape(
      `${baseId}-node-${index + 1}`,
      10 + index * 2,
      frame,
      style.fill,
      style.stroke,
      style.shape,
      style.radius,
    ));
    const text = [node.label, node.detail].map((value) => clampText(value ?? '')).filter(Boolean).join('\n');
    elements.push(makeText(
      `${baseId}-node-label-${index + 1}`,
      11 + index * 2,
      { x: frame.x + 14, y: frame.y + 24, w: frame.w - 28, h: frame.h - 48 },
      text,
      'label',
      diagram.nodes.length > 4 ? 18 : 21,
      { align: 'center', valign: 'middle', bold: !node.detail },
    ));
  });

  diagram.edges.forEach((edge, index) => {
    const label = clampText(edge.label ?? '');
    if (!label) return;
    const labelFrame = orthogonalRoutes?.get(index)?.labelFrame;
    if (!labelFrame) return;
    elements.push(makeText(
      `${baseId}-edge-label-${index + 1}`,
      30 + index,
      labelFrame,
      label,
      'label',
      14,
      { align: 'center', valign: 'middle', color: '475569' },
    ));
  });

  if (criteriaText) {
    elements.push(makeText(
      `${baseId}-relationship-criteria`,
      50,
      { x: 92, y: 610, w: 1096, h: 56 },
      criteriaText,
      'note',
      16,
      { align: 'center', valign: 'middle' },
    ));
  }

  return elements;
};

type ComparisonPanel = { title: string; body: string };

const comparisonPanelsFromSpec = (spec: SemanticSlideSpec): ComparisonPanel[] => {
  const cardsSlot = spec.slots.cards?.kind === 'cards'
    ? spec.slots.cards
    : spec.slots.body?.kind === 'cards'
      ? spec.slots.body
      : undefined;
  if (cardsSlot) {
    return cardsSlot.cards.map((card) => ({
      title: clampText(card.title),
      body: clampText(card.body),
    }));
  }

  const tableSlot = spec.slots.table?.kind === 'table'
    ? spec.slots.table
    : spec.slots.body?.kind === 'table'
      ? spec.slots.body
      : undefined;
  if (tableSlot) {
    return tableSlot.headers.map((header, columnIndex) => ({
      title: clampText(header),
      body: tableSlot.rows.map((row) => clampText(row[columnIndex] ?? '')).filter(Boolean).join('\n'),
    }));
  }

  const diagramSlot = spec.slots.diagram?.kind === 'diagram' ? spec.slots.diagram : undefined;
  if (diagramSlot) {
    return diagramSlot.nodes.map((node) => ({
      title: clampText(node.label),
      body: [
        clampText(node.detail ?? ''),
        ...diagramSlot.edges
          .filter((edge) => edge.from === node.id)
          .map((edge) => clampText(edge.label ?? '')),
      ].filter(Boolean).join('\n'),
    }));
  }

  const items = listItems(spec.slots.body ?? spec.slots.points);
  if (items.length === 0) return [];
  const panelCount = Math.min(3, Math.max(1, Math.ceil(items.length / 2)));
  const itemsPerPanel = Math.ceil(items.length / panelCount);
  return Array.from({ length: panelCount }, (_, index) => ({
    title: '',
    body: items.slice(index * itemsPerPanel, (index + 1) * itemsPerPanel).join('\n'),
  })).filter((panel) => panel.body);
};

const buildComparisonPanelElements = (
  spec: SemanticSlideSpec,
  sceneId: string,
  title: string,
): SceneElement[] => {
  const baseId = `${sceneId}-el`;
  const panels = comparisonPanelsFromSpec(spec);
  const gap = 24;
  const panelWidth = Math.floor((1136 - gap * Math.max(0, panels.length - 1)) / Math.max(1, panels.length));
  const successText = asBulletText([
    ...listItems(spec.slots.successCriteria),
    ...listItems(spec.slots.requirements),
  ]);
  const panelHeight = successText ? 356 : 430;
  const elements: SceneElement[] = [...makeTitleBand(baseId, title)];
  const fills = ['EFF6FF', 'FFF7ED', 'F0FDF4'];
  const strokes = ['93C5FD', 'FDBA74', '86EFAC'];

  panels.forEach((panel, index) => {
    const x = 72 + index * (panelWidth + gap);
    elements.push(makeShape(
      `${baseId}-panel-${index + 1}`,
      10 + index * 3,
      { x, y: 180, w: panelWidth, h: panelHeight },
      fills[index % fills.length],
      strokes[index % strokes.length],
    ));
    if (panel.title) {
      elements.push(makeText(
        `${baseId}-panel-title-${index + 1}`,
        11 + index * 3,
        { x: x + 28, y: 214, w: panelWidth - 56, h: 62 },
        panel.title,
        'subtitle',
        23,
        { bold: true },
      ));
    }
    elements.push(makeText(
      `${baseId}-panel-body-${index + 1}`,
      12 + index * 3,
      { x: x + 28, y: panel.title ? 294 : 226, w: panelWidth - 56, h: panel.title ? panelHeight - 138 : panelHeight - 84 },
      panel.body,
      'body',
      21,
    ));
  });

  if (successText) {
    elements.push(makeText(
      `${baseId}-criteria`,
      30,
      { x: 88, y: 566, w: 1104, h: 68 },
      successText,
      'note',
      18,
    ));
  }
  return elements;
};

const buildQuestionChoiceElements = (
  spec: SemanticSlideSpec,
  sceneId: string,
  title: string,
  question: QuestionSlot,
): SceneElement[] => {
  const baseId = `${sceneId}-el`;
  const elements: SceneElement[] = [
    ...makeTitleBand(baseId, title),
    makeShape(`${baseId}-prompt-card`, 2, { x: 92, y: 170, w: 1096, h: 120 }, 'F8FAFC', 'CBD5E1'),
    makeText(`${baseId}-prompt`, 3, { x: 124, y: 194, w: 1032, h: 72 }, question.prompt, 'prompt', 25, {
      bold: true,
      valign: 'middle',
    }),
  ];

  question.choices.forEach((choice, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 92 + column * 560;
    const y = 320 + row * 150;
    const label = `${String.fromCharCode(65 + index)}. ${clampText(choice.text)}`;
    elements.push(makeShape(
      `${baseId}-choice-card-${index + 1}`,
      10 + index * 2,
      { x, y, w: 536, h: 124 },
      index % 2 === 0 ? 'EFF6FF' : 'F0FDFA',
      index % 2 === 0 ? '93C5FD' : '5EEAD4',
    ));
    elements.push(makeText(
      `${baseId}-choice-text-${index + 1}`,
      11 + index * 2,
      { x: x + 30, y: y + 22, w: 476, h: 80 },
      label,
      'label',
      18,
      { valign: 'middle' },
    ));
  });

  const successText = asBulletText([
    ...listItems(spec.slots.successCriteria),
    ...listItems(spec.slots.requirements),
  ]);
  if (successText) {
    elements.push(makeText(`${baseId}-criteria`, 30, { x: 92, y: 614, w: 1096, h: 52 }, successText, 'note', 18));
  }
  return elements;
};

const THESIS_DIAGRAM_ITEM_X = 754;
const THESIS_DIAGRAM_ITEM_WIDTH = 300;
const THESIS_ROUTE_LANES = [1068, 1084, 1100, 1116] as const;

const buildThesisDiagramItemFrames = (diagram: DiagramSlot): Map<string, SceneFrame> => {
  const itemGap = 18;
  const itemRegionY = 180;
  const itemRegionHeight = 430;
  const itemHeight = Math.min(100, Math.floor((itemRegionHeight - itemGap * Math.max(0, diagram.nodes.length - 1)) / Math.max(1, diagram.nodes.length)));
  const rightStartY = itemRegionY + Math.floor((itemRegionHeight - (itemHeight * diagram.nodes.length + itemGap * Math.max(0, diagram.nodes.length - 1))) / 2);
  return new Map(diagram.nodes.map((node, index) => [
    node.id,
    { x: THESIS_DIAGRAM_ITEM_X, y: rightStartY + index * (itemHeight + itemGap), w: THESIS_DIAGRAM_ITEM_WIDTH, h: itemHeight },
  ]));
};

const buildThesisOrthogonalRoutes = (
  diagram: DiagramSlot,
  itemFrames: ReadonlyMap<string, SceneFrame>,
): Map<number, OrthogonalEdgeRoute> | null => {
  const endpointPorts = new Map<string, number>();
  diagram.nodes.forEach((node) => {
    const frame = itemFrames.get(node.id);
    if (!frame) return;
    const incidentEdgeIndexes = diagram.edges.flatMap((edge, edgeIndex) => (
      edge.from === node.id || edge.to === node.id ? [edgeIndex] : []
    ));
    incidentEdgeIndexes.forEach((edgeIndex, rank) => {
      const offset = incidentEdgeIndexes.length <= 1
        ? 0
        : -frame.h / 3 + (rank * (frame.h * 2 / 3)) / (incidentEdgeIndexes.length - 1);
      endpointPorts.set(`${edgeIndex}:${node.id}`, frame.y + frame.h / 2 + offset);
    });
  });

  const candidatesByEdge = diagram.edges.map((edge, edgeIndex): OrthogonalEdgeRoute[] => {
    const fromIndex = diagram.nodes.findIndex((node) => node.id === edge.from);
    const toIndex = diagram.nodes.findIndex((node) => node.id === edge.to);
    const fromFrame = itemFrames.get(edge.from);
    const toFrame = itemFrames.get(edge.to);
    if (!fromFrame || !toFrame) return [];
    const label = clampText(edge.label ?? '');
    if (Math.abs(fromIndex - toIndex) <= 1 && !label) {
      const forwardOnCanvas = fromFrame.y <= toFrame.y;
      return [{
        edgeIndex,
        points: [
          { x: fromFrame.x + fromFrame.w / 2, y: forwardOnCanvas ? fromFrame.y + fromFrame.h : fromFrame.y },
          { x: toFrame.x + toFrame.w / 2, y: forwardOnCanvas ? toFrame.y : toFrame.y + toFrame.h },
        ],
      }];
    }
    const fromPortY = endpointPorts.get(`${edgeIndex}:${edge.from}`) ?? fromFrame.y + fromFrame.h / 2;
    const toPortY = endpointPorts.get(`${edgeIndex}:${edge.to}`) ?? toFrame.y + toFrame.h / 2;
    const interval: [number, number] = [Math.min(fromPortY, toPortY), Math.max(fromPortY, toPortY)];
    const candidates: OrthogonalEdgeRoute[] = [];
    THESIS_ROUTE_LANES.forEach((laneX) => {
      const labelYs = label
        ? [0.5, 0.25, 0.75].map((factor) => Math.round(interval[0] + (interval[1] - interval[0] - 24) * factor))
        : [undefined];
      labelYs.forEach((labelY) => {
        const route: OrthogonalEdgeRoute = {
          edgeIndex,
          points: [
            { x: fromFrame.x + fromFrame.w, y: fromPortY },
            { x: laneX, y: fromPortY },
            { x: laneX, y: toPortY },
            { x: toFrame.x + toFrame.w, y: toPortY },
          ],
          labelFrame: labelY === undefined
            ? undefined
            : { x: laneX + 8, y: labelY, w: 1208 - laneX - 8, h: 24 },
        };
        const nonEndFrames = diagram.nodes.flatMap((node) => (
          node.id === edge.from || node.id === edge.to ? [] : [itemFrames.get(node.id)]
        )).filter((frame): frame is SceneFrame => Boolean(frame));
        const segments = routeSegmentFrames(route);
        const routeFits = segments.every(frameIsOnCanvas)
          && !segments.some((segment) => nonEndFrames.some((frame) => framesOverlap(segment, frame)))
          && (!route.labelFrame || (
            frameIsOnCanvas(route.labelFrame)
            && !Array.from(itemFrames.values()).some((frame) => framesOverlap(route.labelFrame!, frame))
          ));
        if (routeFits) candidates.push(route);
      });
    });
    return candidates;
  });
  if (candidatesByEdge.some((candidates) => candidates.length === 0)) return null;
  const edgeOrder = diagram.edges.map((_, edgeIndex) => edgeIndex).sort((left, right) => {
    const leftEdge = diagram.edges[left];
    const rightEdge = diagram.edges[right];
    const leftSpan = Math.abs(diagram.nodes.findIndex((node) => node.id === leftEdge.from) - diagram.nodes.findIndex((node) => node.id === leftEdge.to));
    const rightSpan = Math.abs(diagram.nodes.findIndex((node) => node.id === rightEdge.from) - diagram.nodes.findIndex((node) => node.id === rightEdge.to));
    return rightSpan - leftSpan || left - right;
  });
  let searchStates = 0;
  const search = (orderIndex: number, accepted: OrthogonalEdgeRoute[]): OrthogonalEdgeRoute[] | null => {
    searchStates += 1;
    if (searchStates > 20_000) return null;
    if (orderIndex >= edgeOrder.length) return accepted;
    const edgeIndex = edgeOrder[orderIndex];
    for (const candidate of candidatesByEdge[edgeIndex]) {
      if (accepted.some((route) => routesCollide(candidate, route))) continue;
      const result = search(orderIndex + 1, [...accepted, candidate]);
      if (result) return result;
    }
    return null;
  };
  const routes = search(0, []);
  return routes ? new Map(routes.map((route) => [route.edgeIndex, route])) : null;
};

const buildVisualThesisElements = (
  spec: SemanticSlideSpec,
  sceneId: string,
  title: string,
): SceneElement[] => {
  const baseId = `${sceneId}-el`;
  const statement = slotText(spec.slots.statement ?? spec.slots.body);
  const points = listItems(spec.slots.points);
  const diagram = spec.slots.diagram?.kind === 'diagram' ? spec.slots.diagram : undefined;
  const supportText = asBulletText(uniqueTextItems([
    ...listItems(spec.slots.successCriteria),
    ...listItems(spec.slots.requirements),
  ]));
  const elements: SceneElement[] = [
    ...makeTitleBand(baseId, title),
    makeShape(`${baseId}-thesis-card`, 2, { x: 72, y: 180, w: 636, h: 430 }, 'EEF2FF', 'A5B4FC'),
    makeText(`${baseId}-thesis-statement`, 3, { x: 112, y: 220, w: 556, h: diagram && points.length > 0 ? 126 : 338 }, statement, 'prompt', 28, {
      bold: true,
      valign: 'middle',
    }),
  ];

  const rightItems = diagram?.nodes.map((node) => ({
    id: node.id,
    text: [node.label, node.detail].map((value) => clampText(value ?? '')).filter(Boolean).join('\n'),
    role: node.role,
  })) ?? points.map((point, index) => ({ id: `point-${index + 1}`, text: point, role: 'process' }));
  const itemGap = 18;
  const itemRegionY = 180;
  const itemRegionHeight = 430;
  const itemHeight = Math.min(100, Math.floor((itemRegionHeight - itemGap * Math.max(0, rightItems.length - 1)) / Math.max(1, rightItems.length)));
  const rightStartY = itemRegionY + Math.floor((itemRegionHeight - (itemHeight * rightItems.length + itemGap * Math.max(0, rightItems.length - 1))) / 2);
  const rightItemWidth = diagram ? THESIS_DIAGRAM_ITEM_WIDTH : 454;

  if (diagram && points.length > 0) {
    const pointHeight = Math.floor(220 / points.length);
    points.forEach((point, index) => {
      elements.push(makeText(
        `${baseId}-thesis-point-${index + 1}`,
        5 + index,
        { x: 120, y: 364 + index * pointHeight, w: 540, h: pointHeight - 8 },
        point,
        'body',
        18,
        { valign: 'middle' },
      ));
    });
  }

  rightItems.forEach((item, index) => {
    const y = rightStartY + index * (itemHeight + itemGap);
    const style = relationshipNodeStyle(item.role);
    elements.push(makeShape(
      `${baseId}-thesis-item-${index + 1}`,
      10 + index * 2,
      { x: THESIS_DIAGRAM_ITEM_X, y, w: rightItemWidth, h: itemHeight },
      style.fill,
      style.stroke,
      style.shape === 'ellipse' ? 'ellipse' : 'roundRect',
      style.radius,
    ));
    elements.push(makeText(
      `${baseId}-thesis-item-text-${index + 1}`,
      11 + index * 2,
      { x: THESIS_DIAGRAM_ITEM_X + 24, y: y + 12, w: rightItemWidth - 48, h: itemHeight - 24 },
      item.text,
      'body',
      19,
      { align: 'center', valign: 'middle' },
    ));
  });

  if (diagram) {
    const frameByNodeId = buildThesisDiagramItemFrames(diagram);
    const orthogonalRoutes = buildThesisOrthogonalRoutes(diagram, frameByNodeId);
    diagram.edges.forEach((edge, index) => {
      const from = frameByNodeId.get(edge.from);
      const to = frameByNodeId.get(edge.to);
      if (!from || !to) return;
      const fromId = `${baseId}-thesis-item-${diagram.nodes.findIndex((node) => node.id === edge.from) + 1}`;
      const toId = `${baseId}-thesis-item-${diagram.nodes.findIndex((node) => node.id === edge.to) + 1}`;
      const route = orthogonalRoutes?.get(index);
      if (route) {
        route.points.slice(0, -1).forEach((point, segmentIndex) => {
          const isFirst = segmentIndex === 0;
          const isLast = segmentIndex === route.points.length - 2;
          elements.push(makeConnectorSegment(
            `${baseId}-thesis-edge-${index + 1}-segment-${segmentIndex + 1}`,
            30 + index * 4 + segmentIndex,
            point,
            route.points[segmentIndex + 1],
            fromId,
            toId,
            isFirst && edge.direction === 'both',
            isLast && (edge.direction === 'forward' || edge.direction === 'both'),
          ));
        });
        if (route.labelFrame && edge.label) {
          elements.push(makeText(
            `${baseId}-thesis-edge-label-${index + 1}`,
            50 + index,
            route.labelFrame,
            clampText(edge.label),
            'label',
            11,
            { align: 'center', valign: 'middle', color: '475569' },
          ));
        }
        return;
      }
      const upper = from.y <= to.y ? from : to;
      const lower = from.y <= to.y ? to : from;
      elements.unshift(makeConnector(
        `${baseId}-thesis-edge-${index + 1}`,
        30 + index,
        { x: upper.x + upper.w / 2 - 2, y: upper.y + upper.h, w: 4, h: Math.max(4, lower.y - upper.y - upper.h) },
        fromId,
        toId,
        edge.direction === 'both' || edge.direction === 'none' ? edge.direction : 'forward',
        from.y > to.y,
      ));
    });
  }

  if (supportText) {
    elements.push(makeText(
      `${baseId}-thesis-support`,
      60,
      { x: 92, y: 620, w: 1096, h: 50 },
      supportText,
      'note',
      16,
      { align: 'center', valign: 'middle' },
    ));
  }

  return elements;
};

const buildBaseSceneElements = (spec: SemanticSlideSpec, sceneId: string): SceneElement[] => {
  const title = slotText(spec.slots.title) || spec.accessibility.slidePurpose;
  const structuredFallbackSlots = ['statement', 'points', 'cards', 'steps', 'table', 'question', 'diagram']
    .map((slotName) => spec.slots[slotName])
    .filter((slot): slot is SlideSlotValue => Boolean(slot));
  const bodyItems = spec.slots.body
    ? listItems(spec.slots.body)
    : structuredFallbackSlots.map(slotText).filter(Boolean);
  const successItems = listItems(spec.slots.successCriteria);
  const requirements = listItems(spec.slots.requirements);
  const bodyText = asBulletText(bodyItems);
  const successText = successItems.length > 0 ? asBulletText(successItems) : '';
  const baseId = `${sceneId}-el`;

  if (spec.layoutId === 'relationship-diagram' && spec.slots.diagram?.kind === 'diagram') {
    return buildRelationshipDiagramElements(spec, sceneId, title, spec.slots.diagram);
  }

  if (spec.layoutId === 'question-choices' && spec.slots.question?.kind === 'question') {
    return buildQuestionChoiceElements(spec, sceneId, title, spec.slots.question);
  }

  if (spec.layoutId === 'comparison-panels') {
    return buildComparisonPanelElements(spec, sceneId, title);
  }

  if (spec.layoutId === 'visual-thesis') {
    return buildVisualThesisElements(spec, sceneId, title);
  }

  if (spec.layoutId === 'evidence-capture-board' || spec.layoutId === 'exit-ticket-card') {
    if (bodyItems.length === 0 && successItems.length === 0) {
      const elements: SceneElement[] = [
        makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
        makeText(`${baseId}-title`, 1, { x: 82, y: 72, w: 1116, h: 70 }, title, 'title', 34, { bold: true }),
      ];
      if (requirements.length === 1) {
        elements.push(makeShape(`${baseId}-requirement-card`, 2, { x: 86, y: 164, w: 1108, h: 450 }, 'F0FDFA', '99F6E4'));
        elements.push(makeText(`${baseId}-requirement`, 3, { x: 126, y: 204, w: 1028, h: 360 }, asBulletText(requirements), 'body', 22));
      } else {
        elements.push(makeTable(`${baseId}-table`, 2, { x: 86, y: 158, w: 1108, h: 474 }, ['#', 'Required evidence or output'], requirementRows(spec)));
      }
      return elements;
    }
    return [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 82, y: 72, w: 1116, h: 70 }, title, 'title', 34, { bold: true }),
      makeText(`${baseId}-prompt`, 2, { x: 88, y: 160, w: 520, h: 130 }, bodyText, 'prompt', 24),
      makeTable(`${baseId}-table`, 3, { x: 648, y: 158, w: 506, h: 340 }, ['#', 'Required evidence or output'], requirementRows(spec)),
      makeText(
        `${baseId}-criteria`,
        4,
        { x: 88, y: 530, w: 1066, h: 104 },
        successText,
        'body',
        22,
      ),
    ];
  }

  if (spec.layoutId === 'learning-targets-stack') {
    const targets = bodyItems.length > 0 ? bodyItems : successItems.length > 0 ? successItems : [title];
    const separateSuccessText = bodyItems.length > 0 ? successText : '';
    const cardHeight = Math.min(132, Math.max(86, Math.floor(396 / Math.max(targets.length, 1))));
    const elements: SceneElement[] = [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 82, y: 74, w: 1116, h: 66 }, title, 'title', 34, { bold: true }),
    ];
    targets.forEach((target, index) => {
      const y = 168 + index * (cardHeight + 18);
      elements.push(makeShape(`${baseId}-target-card-${index + 1}`, 2 + index * 2, { x: 96, y, w: 1088, h: cardHeight }, 'EEF2FF', 'C7D2FE'));
      elements.push(makeText(`${baseId}-target-text-${index + 1}`, 3 + index * 2, { x: 128, y: y + 22, w: 1024, h: cardHeight - 36 }, target, 'body', 24));
    });
    if (separateSuccessText) {
      elements.push(makeText(`${baseId}-criteria`, 12, { x: 104, y: 604, w: 1072, h: 62 }, separateSuccessText, 'note', 18));
    }
    return elements;
  }

  if (spec.layoutId === 'guided-example-steps' || spec.layoutId === 'process-flow-horizontal') {
    const steps = bodyItems.length > 0 ? bodyItems : [spec.accessibility.slidePurpose];
    const visibleSteps = steps;
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
      elements.push(makeText(`${baseId}-step-text-${index + 1}`, 4 + index * 3, { x: x + 22, y: 280, w: cardWidth - 44, h: 172 }, step, 'label', 18));
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
    const criteriaText = successText || asBulletText(requirements);
    if (!criteriaText) {
      return [
        makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
        makeText(`${baseId}-title`, 1, { x: 84, y: 74, w: 1112, h: 70 }, title, 'title', 34, { bold: true }),
        makeShape(`${baseId}-prompt-card`, 2, { x: 96, y: 168, w: 1088, h: 446 }, 'F0FDFA', '99F6E4'),
        makeText(`${baseId}-prompt`, 3, { x: 138, y: 210, w: 1004, h: 352 }, bodyText, 'prompt', 25),
      ];
    }
    return [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 84, y: 74, w: 1112, h: 70 }, title, 'title', 34, { bold: true }),
      makeShape(`${baseId}-prompt-card`, 2, { x: 116, y: 174, w: 1048, h: 292 }, 'F0FDFA', '99F6E4'),
      makeText(`${baseId}-prompt`, 3, { x: 158, y: 222, w: 964, h: 194 }, bodyText, 'prompt', 27),
      makeText(`${baseId}-criteria`, 4, { x: 134, y: 516, w: 1012, h: 100 }, criteriaText, 'body', 21),
    ];
  }

  const criteriaText = successText || asBulletText(requirements);
  if (!criteriaText) {
    return [
      makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
      makeText(`${baseId}-title`, 1, { x: 82, y: 74, w: 1116, h: 70 }, title, 'title', 34, { bold: true }),
      makeShape(`${baseId}-task-card`, 2, { x: 86, y: 164, w: 1108, h: 450 }, 'EEF2FF', 'C7D2FE'),
      makeText(`${baseId}-task`, 3, { x: 126, y: 206, w: 1028, h: 350 }, bodyText, 'body', 23),
    ];
  }

  return [
    makeShape(`${baseId}-bg`, 0, { x: 36, y: 34, w: 1208, h: 652 }, 'F8FAFC'),
    makeText(`${baseId}-title`, 1, { x: 82, y: 74, w: 1116, h: 70 }, title, 'title', 34, { bold: true }),
    makeShape(`${baseId}-task-card`, 2, { x: 86, y: 170, w: 528, h: 376 }, 'EEF2FF', 'C7D2FE'),
    makeText(`${baseId}-task`, 3, { x: 126, y: 220, w: 448, h: 256 }, bodyText, 'body', 24),
    makeShape(`${baseId}-criteria-card`, 4, { x: 666, y: 170, w: 528, h: 376 }, 'F0FDF4', 'BBF7D0'),
    makeText(`${baseId}-criteria`, 5, { x: 706, y: 220, w: 448, h: 256 }, criteriaText, 'body', 23),
  ];
};

const applyVisualSystemToElements = (
  elements: readonly SceneElement[],
  visualSystem?: DeckVisualSystem,
  visualLayout = false,
): SceneElement[] => {
  if (!visualSystem) return [...elements];
  return elements.map((element) => {
    if (
      visualLayout
      && element.kind === 'shape'
      && (element.id.includes('-node-') || element.id.includes('-thesis-item-'))
    ) {
      const stroke = element.stroke === '0369A1'
        ? visualSystem.palette.accentCool
        : element.stroke === 'B45309'
          ? visualSystem.palette.warning
          : element.stroke === '15803D'
            ? visualSystem.palette.success
            : visualSystem.palette.accentWarm;
      return { ...element, fill: visualSystem.palette.surface, stroke };
    }
    if (visualLayout && element.kind === 'shape' && element.id.endsWith('-prompt-card')) {
      return {
        ...element,
        fill: visualSystem.palette.surfaceMuted,
        stroke: visualSystem.palette.accentCool,
      };
    }
    if (visualLayout && element.kind === 'shape' && element.id.includes('-choice-')) {
      return {
        ...element,
        fill: visualSystem.palette.surface,
        stroke: element.id.endsWith('-1') || element.id.endsWith('-3')
          ? visualSystem.palette.accentCool
          : visualSystem.palette.accentWarm,
      };
    }
    if (visualLayout && element.kind === 'shape' && element.id.includes('-panel-')) {
      const index = Number(element.id.match(/-panel-(\d+)$/)?.[1] ?? 1);
      const colors = [
        visualSystem.palette.accentCool,
        visualSystem.palette.accentWarm,
        visualSystem.palette.success,
      ];
      return {
        ...element,
        fill: visualSystem.palette.surface,
        stroke: colors[(index - 1) % colors.length],
      };
    }
    if (
      visualLayout
      && element.kind === 'shape'
      && (element.id.endsWith('-thesis-card') || element.id.endsWith('-title-band'))
    ) {
      return {
        ...element,
        fill: visualSystem.palette.surface,
        stroke: element.id.endsWith('-title-band')
          ? visualSystem.palette.surfaceMuted
          : visualSystem.palette.accentCool,
      };
    }
    if (element.kind === 'shape' && element.id.endsWith('-bg')) {
      return {
        ...element,
        fill: visualSystem.palette.surface,
        stroke: visualSystem.palette.surfaceMuted,
        radius: visualSystem.shapeLanguage.cornerRadius,
      };
    }
    if (element.kind === 'table') {
      return {
        ...element,
        headerFill: visualSystem.palette.accentCool,
        cellFill: visualSystem.palette.surface,
        textColor: visualSystem.palette.ink,
      };
    }
    if (element.kind === 'text') {
      if (!visualLayout) {
        return {
          ...element,
          runs: element.runs.map((run) => ({
            ...run,
            color: run.color ?? visualSystem.palette.ink,
          })),
        };
      }
      const roleSize = element.role === 'title'
        ? visualSystem.typography.titleSize
        : element.role === 'label' || element.role === 'note'
          ? visualSystem.typography.labelSize
          : visualSystem.typography.bodySize;
      const fontSize = Math.max(roleSize, visualSystem.typography.minReadableSize);
      return {
        ...element,
        fontSize,
        lineHeight: Math.round(fontSize * 1.25),
        runs: element.runs.map((run) => ({
          ...run,
          color: !run.color || run.color === '111827'
            ? visualSystem.palette.ink
            : run.color === '475569'
              ? visualSystem.palette.mutedInk
              : run.color,
        })),
      };
    }
    if (element.kind === 'connector') {
      return {
        ...element,
        stroke: visualSystem.palette.mutedInk,
      };
    }
    return element;
  });
};

const isRenderedImageAsset = (asset: SceneResolvedAsset): boolean => (
  asset.kind !== 'native' && asset.kind !== 'omitted' && Boolean(asset.src)
);

const imageElementForAsset = (
  spec: SemanticSlideSpec,
  sceneId: string,
  asset: SceneResolvedAsset,
  index: number,
  readingOrder: number,
  frame: SceneFrame,
): SceneImageElement | null => {
  const request = spec.assetRequests.find((item) => item.id === asset.requestId);
  if (!request || !asset.src) return null;
  return {
    id: `${sceneId}-asset-${index + 1}`,
    kind: 'image',
    frame,
    editable: true,
    readingOrder,
    src: asset.src,
    altText: asset.altText,
    assetId: asset.requestId,
    visualRole: request.visualRole,
    sourceStepIds: [...asset.sourceStepIds],
    storyboardScreenId: asset.storyboardScreenId,
    semanticSlideSpecId: asset.semanticSlideSpecId,
    noEmbeddedText: true,
  };
};

const framesOverlap = (a: SceneFrame, b: SceneFrame): boolean => (
  a.x < b.x + b.w
  && a.x + a.w > b.x
  && a.y < b.y + b.h
  && a.y + a.h > b.y
);

const ASSET_FRAME_CANDIDATES: readonly SceneFrame[] = [
  { x: 968, y: 574, w: 214, h: 80 },
  { x: 968, y: 154, w: 214, h: 96 },
  { x: 80, y: 574, w: 214, h: 80 },
  { x: 968, y: 270, w: 214, h: 96 },
];

const THESIS_ASSET_FRAME: SceneFrame = { x: 754, y: 180, w: 454, h: 430 };

const assetFrameCandidatesForSpec = (spec: SemanticSlideSpec): readonly SceneFrame[] => {
  if (spec.layoutId !== 'visual-thesis') return ASSET_FRAME_CANDIDATES;
  const hasNativeDiagram = spec.slots.diagram?.kind === 'diagram' && spec.slots.diagram.nodes.length > 0;
  const hasNativePoints = listItems(spec.slots.points).length > 0;
  return hasNativeDiagram || hasNativePoints ? [] : [THESIS_ASSET_FRAME];
};

const occupiesAssetFrame = (element: SceneElement, visualLayout: boolean): boolean => {
  if (!visualLayout) return element.kind === 'text' || element.kind === 'table';
  if (element.kind === 'shape') {
    return !element.id.endsWith('-bg') && !element.id.endsWith('-title-band');
  }
  return element.kind !== 'group';
};

const addResolvedAssetElements = (
  elements: readonly SceneElement[],
  spec: SemanticSlideSpec,
  sceneId: string,
  assets: readonly SceneResolvedAsset[] = [],
): SceneElement[] => {
  const renderedAssets = assets.filter(isRenderedImageAsset);
  if (renderedAssets.length === 0) return [...elements];
  const maxReadingOrder = elements.reduce((max, element) => Math.max(max, element.readingOrder), 0);
  const visualLayout = VISUAL_LAYOUT_IDS.has(spec.layoutId);
  const occupiedFrames = elements
    .filter((element) => occupiesAssetFrame(element, visualLayout))
    .map((element) => element.frame);
  const frameCandidates = assetFrameCandidatesForSpec(spec);
  const imageElements: SceneImageElement[] = [];
  for (const [index, asset] of renderedAssets.slice(0, 2).entries()) {
    const frame = frameCandidates.find((candidate) => (
      [...occupiedFrames, ...imageElements.map((element) => element.frame)]
        .every((occupied) => !framesOverlap(candidate, occupied))
    ));
    if (!frame) continue;
    const element = imageElementForAsset(spec, sceneId, asset, index, maxReadingOrder + index + 1, frame);
    if (element) imageElements.push(element);
  }
  return [...elements, ...imageElements];
};

const buildSceneElements = (
  spec: SemanticSlideSpec,
  sceneId: string,
  visualSystem?: DeckVisualSystem,
  assets: readonly SceneResolvedAsset[] = [],
): SceneElement[] => (
  addResolvedAssetElements(
    applyVisualSystemToElements(
      buildBaseSceneElements(spec, sceneId),
      visualSystem,
      VISUAL_LAYOUT_IDS.has(spec.layoutId),
    ),
    spec,
    sceneId,
    assets,
  )
);

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
    const columnCount = Math.max(1, element.headers.length, ...element.rows.map((row) => row.length));
    const columnWidth = Math.max(1, element.frame.w / columnCount - 24);
    const rowLineCounts = [element.headers, ...element.rows].map((row) => Math.max(
      1,
      ...row.map((cell) => estimateWrappedLineCount(cell, columnWidth, element.fontSize)),
    ));
    const rowCount = rowLineCounts.length;
    const availableRowHeight = element.frame.h / rowCount;
    const estimatedRowHeights = rowLineCounts.map((lineCount) => (
      lineCount * element.fontSize * 1.35 + 16
    ));
    const estimatedHeight = rowLineCounts.reduce(
      (height, lineCount) => height + lineCount * element.fontSize * 1.35 + 16,
      0,
    );
    return estimatedHeight > element.frame.h
      || estimatedRowHeights.some((rowHeight) => rowHeight > availableRowHeight)
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

const isFullSlideRasterFrame = (frame: SceneFrame): boolean => (
  frame.x <= 0
  && frame.y <= 0
  && frame.w >= SCENE_WIDTH
  && frame.h >= SCENE_HEIGHT
);

const hasValidImageProvenance = (element: SceneImageElement, scene: CompiledSlideScene): boolean => (
  Boolean(element.assetId)
  && element.noEmbeddedText === true
  && element.storyboardScreenId === scene.storyboardScreenId
  && element.semanticSlideSpecId === scene.semanticSlideSpecId
  && element.sourceStepIds.length > 0
  && element.sourceStepIds.every((sourceStepId) => scene.sourceStepIds.includes(sourceStepId))
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
      if (isFullSlideRasterFrame(element.frame)) {
        diagnostics.push(sceneDiagnostic('scene_full_slide_raster_forbidden', `Image element ${element.id} uses a full-slide raster frame.`, { sceneId: scene.id, elementId: element.id }));
      }
      if (!hasValidImageProvenance(element, scene)) {
        diagnostics.push(sceneDiagnostic('scene_contract_invalid', `Image element ${element.id} is missing source-backed asset provenance.`, { sceneId: scene.id, elementId: element.id }));
      }
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

const compileSpecToScene = (
  spec: SemanticSlideSpec,
  index: number,
  options: Pick<CompileSemanticSlideSpecsOptions, 'visualSystemsByUnitId' | 'resolvedAssetsBySpecId'> = {},
): CompiledSlideScene => {
  const sceneId = `scene-${String(index + 1).padStart(3, '0')}`;
  const visualSystem = options.visualSystemsByUnitId?.[spec.unitId];
  const resolvedAssets = options.resolvedAssetsBySpecId?.[spec.id] ?? [];
  const elements = buildSceneElements(spec, sceneId, visualSystem, resolvedAssets);
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
    background: visualSystem?.palette.background ?? 'FFFFFF',
    elements,
    speakerNotes: spec.speakerNotes,
    readingOrder: elements.filter(isVisibleTextElement).sort((a, b) => a.readingOrder - b.readingOrder).map((element) => element.id),
  };
};

const slotItemCount = (slot: SlideSlotValue, expandStructuredVisuals: boolean): number => {
  if (slot.kind === 'list') return slot.items.length;
  if (slot.kind === 'cards') return slot.cards.length;
  if (slot.kind === 'table') return slot.rows.length;
  if (slot.kind === 'steps') return slot.steps.length;
  if (slot.kind === 'question') return expandStructuredVisuals ? 1 + slot.choices.length : 1;
  if (slot.kind === 'diagram') return expandStructuredVisuals ? slot.nodes.length : 1;
  return 1;
};

const VISUAL_LAYOUT_IDS: ReadonlySet<SemanticLayoutId> = new Set([
  'visual-thesis',
  'relationship-diagram',
  'comparison-panels',
  'question-choices',
]);

const validateSemanticSpecLayoutCapacity = (
  spec: SemanticSlideSpec,
  index: number,
): SceneValidationDiagnostic[] => {
  const layout = SEMANTIC_LAYOUT_DEFINITIONS.find((definition) => definition.id === spec.layoutId);
  const sceneId = `scene-${String(index + 1).padStart(3, '0')}`;
  if (!layout) return [];
  const diagnostics: SceneValidationDiagnostic[] = [];
  const visualLayout = VISUAL_LAYOUT_IDS.has(spec.layoutId);
  const exceedsItemCapacity = Object.values(spec.slots)
    .some((slot) => slotItemCount(slot, visualLayout) > layout.maxListItems);
  if (exceedsItemCapacity) {
    diagnostics.push(sceneDiagnostic(
      'scene_text_overflow',
      `Semantic slide ${spec.id} exceeds the item capacity for layout ${spec.layoutId}.`,
      { sceneId },
    ));
  }

  if (VISUAL_LAYOUT_IDS.has(spec.layoutId)) {
    const textLength = Object.values(spec.slots).map(slotText).join(' ').length;
    if (textLength > layout.maxTextChars) {
      diagnostics.push(sceneDiagnostic(
        'scene_text_overflow',
        `Semantic slide ${spec.id} exceeds the text capacity for layout ${spec.layoutId}.`,
        { sceneId },
      ));
    }
  }

  if (spec.layoutId === 'relationship-diagram') {
    const diagram = spec.slots.diagram;
    if (diagram?.kind !== 'diagram') {
      diagnostics.push(sceneDiagnostic('scene_contract_invalid', `Semantic slide ${spec.id} requires a native relationship diagram.`, { sceneId }));
    } else {
      const nodeIds = new Set(diagram.nodes.map((node) => node.id));
      if (diagram.nodes.length === 0 || diagram.nodes.length > 6 || diagram.edges.length > 8) {
        diagnostics.push(sceneDiagnostic(
          'scene_text_overflow',
          `Semantic slide ${spec.id} exceeds the six-node, eight-edge relationship capacity.`,
          { sceneId },
        ));
      }
      if (
        nodeIds.size !== diagram.nodes.length
        || diagram.edges.some((edge) => edge.from === edge.to || !nodeIds.has(edge.from) || !nodeIds.has(edge.to))
      ) {
        diagnostics.push(sceneDiagnostic('scene_contract_invalid', `Semantic slide ${spec.id} has invalid relationship node references.`, { sceneId }));
      } else if (!buildRelationshipOrthogonalRoutes(diagram, buildRelationshipNodeFrames(diagram))) {
        diagnostics.push(sceneDiagnostic(
          'scene_text_overflow',
          `Semantic slide ${spec.id} has no collision-free bounded relationship route lanes.`,
          { sceneId },
        ));
      }
    }
  }

  if (spec.layoutId === 'question-choices') {
    const question = spec.slots.question;
    if (question?.kind !== 'question') {
      diagnostics.push(sceneDiagnostic('scene_contract_invalid', `Semantic slide ${spec.id} requires a structured question.`, { sceneId }));
    } else if (question.choices.length < 2 || question.choices.length > 4) {
      diagnostics.push(sceneDiagnostic(
        'scene_text_overflow',
        `Semantic slide ${spec.id} exceeds the bounded two-by-two choice grid.`,
        { sceneId },
      ));
    }
  }

  if (spec.layoutId === 'comparison-panels') {
    const panelCount = comparisonPanelsFromSpec(spec).length;
    if (panelCount < 2 || panelCount > 3) {
      diagnostics.push(sceneDiagnostic(
        'scene_text_overflow',
        `Semantic slide ${spec.id} requires two or three bounded comparison panels.`,
        { sceneId },
      ));
    }
  }

  if (spec.layoutId === 'visual-thesis' && spec.slots.diagram?.kind === 'diagram') {
    const diagram = spec.slots.diagram;
    const nodeIds = new Set(diagram.nodes.map((node) => node.id));
    if (diagram.nodes.length > 4 || diagram.edges.length > 4) {
      diagnostics.push(sceneDiagnostic(
        'scene_text_overflow',
        `Semantic slide ${spec.id} exceeds the bounded visual-thesis diagram capacity.`,
        { sceneId },
      ));
    }
    if (
      nodeIds.size !== diagram.nodes.length
      || diagram.edges.some((edge) => edge.from === edge.to || !nodeIds.has(edge.from) || !nodeIds.has(edge.to))
    ) {
      diagnostics.push(sceneDiagnostic('scene_contract_invalid', `Semantic slide ${spec.id} has invalid visual-thesis node references.`, { sceneId }));
    } else if (!buildThesisOrthogonalRoutes(diagram, buildThesisDiagramItemFrames(diagram))) {
      diagnostics.push(sceneDiagnostic(
        'scene_text_overflow',
        `Semantic slide ${spec.id} has no collision-free bounded visual-thesis route lanes.`,
        { sceneId },
      ));
    }
  }

  return diagnostics;
};

export const doesSemanticSlideSpecFitScene = (spec: SemanticSlideSpec): boolean => {
  if (validateSemanticSpecLayoutCapacity(spec, 0).length > 0) return false;
  return validateCompiledSlideScene(compileSpecToScene(spec, 0))
    .every((diagnostic) => diagnostic.severity !== 'blocking');
};

export const compileSemanticSlideSpecsToScenes = (
  specs: readonly SemanticSlideSpec[],
  options: CompileSemanticSlideSpecsOptions,
): CompiledScenePresentationResult => {
  const scenes = specs.map((spec, index) => compileSpecToScene(spec, index, options));
  const diagnostics = [
    ...specs.flatMap(validateSemanticSpecLayoutCapacity),
    ...scenes.flatMap(validateCompiledSlideScene),
  ];
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
