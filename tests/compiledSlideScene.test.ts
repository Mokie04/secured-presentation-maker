import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileSemanticSlideSpecsToScenes,
  createPreviewSceneDescriptors,
  doesSemanticSlideSpecFitScene,
  getSceneVisibleText,
  validateCompiledSlideScene,
  type SceneConnectorElement,
  type SceneShapeElement,
} from '../lib/compiledSlideScene.ts';
import { compilePptxSceneOperations } from '../lib/compiledScenePptx.ts';
import { SCENE_ASSET_REQUEST_VERSION, type SceneAssetRequest } from '../lib/sceneAssetRequests.ts';
import { SCENE_ASSET_RESOLUTION_VERSION, type SceneResolvedAsset } from '../lib/sceneAssetResolver.ts';
import { buildSemanticSlideSpecs, type SemanticSlideSpec } from '../lib/semanticSlideSpec.ts';
import {
  DENSE_STORYBOARD,
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
} from './fixtures/semanticSlideFixtures.ts';
import {
  questionChoicesSemanticFixture,
  relationshipDiagramSemanticFixture,
  validVisualPlanFixture,
} from './fixtures/visualTeachingComposerFixtures.ts';

const framesOverlap = (
  left: { x: number; y: number; w: number; h: number },
  right: { x: number; y: number; w: number; h: number },
): boolean => (
  left.x < right.x + right.w
  && left.x + left.w > right.x
  && left.y < right.y + right.h
  && left.y + left.h > right.y
);

const assertPeerFramesDoNotOverlap = (frames: Array<{ x: number; y: number; w: number; h: number }>): void => {
  frames.forEach((frame, index) => {
    for (const other of frames.slice(index + 1)) assert.equal(framesOverlap(frame, other), false);
  });
};

const paddedFrame = (
  frame: { x: number; y: number; w: number; h: number },
  padding = 4,
) => ({
  x: frame.x - padding,
  y: frame.y - padding,
  w: frame.w + padding * 2,
  h: frame.h + padding * 2,
});

const assertNoUnrelatedRouteCollisions = (scene: Parameters<typeof getSceneVisibleText>[0]): void => {
  const segments = scene.elements.flatMap((element) => {
    if (element.kind !== 'connector') return [];
    const edgeIndex = Number(element.id.match(/-edge-(\d+)(?:-|$)/)?.[1] ?? 0);
    return edgeIndex > 0 ? [{ edgeIndex, frame: element.frame }] : [];
  });
  const labels = scene.elements.flatMap((element) => {
    if (element.kind !== 'text') return [];
    const edgeIndex = Number(element.id.match(/-edge-label-(\d+)$/)?.[1] ?? 0);
    return edgeIndex > 0 ? [{ edgeIndex, frame: paddedFrame(element.frame) }] : [];
  });

  labels.forEach((label, index) => {
    for (const other of labels.slice(index + 1)) {
      if (label.edgeIndex !== other.edgeIndex) assert.equal(framesOverlap(label.frame, other.frame), false);
    }
    for (const segment of segments) {
      if (label.edgeIndex !== segment.edgeIndex) assert.equal(framesOverlap(label.frame, segment.frame), false);
    }
  });
  segments.forEach((segment, index) => {
    for (const other of segments.slice(index + 1)) {
      if (segment.edgeIndex !== other.edgeIndex) assert.equal(framesOverlap(segment.frame, other.frame), false);
    }
  });
};

const specsFrom = () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('semantic specs failed');
  return result.specs;
};

const assetRequestForSpec = (spec: Pick<SemanticSlideSpec,
  'id' | 'unitId' | 'sourceStepIds' | 'sourceObjectiveIds' | 'storyboardScreenId'>): SceneAssetRequest => ({
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
});

const resolvedAssetForRequest = (request: SceneAssetRequest): SceneResolvedAsset => ({
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
});

const visualThesisAssetFixture = (withNativePoints = false) => {
  const base = relationshipDiagramSemanticFixture();
  const specWithoutRequest: SemanticSlideSpec = {
    ...base,
    intent: 'learning-targets',
    layoutId: 'visual-thesis',
    slots: {
      title: { kind: 'text', text: 'Asset-Supported Thesis' },
      statement: { kind: 'text', text: 'Use the supplied visual to inspect the source-backed relationship.' },
      ...(withNativePoints
        ? { points: { kind: 'list' as const, items: ['Native point alpha', 'Native point beta'] } }
        : {}),
    },
    assetRequests: [],
  };
  const request = assetRequestForSpec(specWithoutRequest);
  return {
    request,
    asset: resolvedAssetForRequest(request),
    spec: { ...specWithoutRequest, assetRequests: [request] },
  };
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

test('renders compacted learning targets once while retaining the objective text', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visibleText = getSceneVisibleText(result.presentation.scenes[0]);
  assert.equal(visibleText.filter((text) => text === 'Learning Targets').length, 1);
  assert.equal(visibleText.filter((text) => text.includes('EO-OBJ-A Use observations')).length, 1);
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

test('compiles dense storyboard continuations without overflow or rasterized text', () => {
  const specsResult = buildSemanticSlideSpecs(DENSE_STORYBOARD);
  assert.equal(specsResult.ok, true);
  if (!specsResult.ok) return;

  const result = compileSemanticSlideSpecsToScenes(specsResult.specs, { title: 'Dense Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes.length >= DENSE_STORYBOARD.screens.length, true);
  assert.equal(result.presentation.scenes.length <= DENSE_STORYBOARD.screens.length * 2 + 2, true);
  for (const screen of DENSE_STORYBOARD.screens) {
    assert.equal(result.presentation.scenes.filter((scene) => scene.storyboardScreenId === screen.id).length <= 3, true);
  }
  assert.equal(result.presentation.scenes.flatMap((scene) => validateCompiledSlideScene(scene))
    .some((diagnostic) => diagnostic.code === 'scene_text_overflow'), false);
  assert.equal(result.presentation.scenes.flatMap((scene) => scene.elements)
    .every((element) => (element.kind !== 'text' && element.kind !== 'table') || element.editable), true);
  assert.equal(result.presentation.scenes.flatMap((scene) => scene.elements)
    .some((element) => element.kind === 'image'), false);
});

test('moves every guided list item to a continuation instead of truncating after four', () => {
  const storyboard = structuredClone(EVIDENCE_OUTPUT_STORYBOARD);
  const guidedScreen = storyboard.screens[1];
  guidedScreen.communicationIntent = 'guided-example';
  guidedScreen.requiredEvidence = [];
  guidedScreen.requiredOutputs = [];
  guidedScreen.learnerContent = {
    questions: [],
    directions: [
      'GI-STEP-ONE Inspect the first source-backed item and record the feature that matters for the stated comparison.',
      'GI-STEP-TWO Compare the second source-backed item with the first and preserve the stated evidence order.',
      'GI-STEP-THREE Record the third source-backed item and connect it to the criterion supplied by the source.',
      'GI-STEP-FOUR Explain the fourth source-backed item using the same comparison frame and no added requirement.',
      'GI-STEP-FIVE Check the fifth source-backed item against the earlier evidence and note the supported difference.',
      'GI-STEP-SIX Review the sixth source-backed item and prepare the final source-aligned sequence for discussion.',
    ],
    successCriteria: [],
  };
  const specsResult = buildSemanticSlideSpecs(storyboard);
  assert.equal(specsResult.ok, true);
  if (!specsResult.ok) return;

  const guidedSpecs = specsResult.specs.filter((spec) => spec.storyboardScreenId === guidedScreen.id);
  assert.equal(guidedSpecs.length > 1, true);
  const result = compileSemanticSlideSpecsToScenes(specsResult.specs, { title: 'Guided Continuation Fixture' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visible = result.presentation.scenes.flatMap(getSceneVisibleText).join(' ');
  for (const sentinel of ['GI-STEP-ONE', 'GI-STEP-TWO', 'GI-STEP-THREE', 'GI-STEP-FOUR', 'GI-STEP-FIVE', 'GI-STEP-SIX']) {
    assert.match(visible, new RegExp(sentinel));
  }
});

test('rejects semantic candidates beyond the layout item ceiling', () => {
  const specs = specsFrom();
  const sourceSpec = specs.find((spec) => spec.sourceStepIds.length > 0);
  assert.ok(sourceSpec);
  const overCapacity = {
    ...sourceSpec,
    intent: 'guided-example' as const,
    layoutId: 'guided-example-steps' as const,
    slots: {
      ...sourceSpec.slots,
      body: {
        kind: 'list' as const,
        items: Array.from({ length: 7 }, (_, index) => `Item ${index + 1}`),
      },
      requirements: { kind: 'list' as const, items: [] },
      successCriteria: { kind: 'list' as const, items: [] },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(overCapacity), false);
  const result = compileSemanticSlideSpecsToScenes([overCapacity], { title: 'Over Capacity Fixture' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'scene_text_overflow'), true);
});

test('preserves legacy generic diagram capacity as one structured item', () => {
  const base = relationshipDiagramSemanticFixture();
  const genericDiagram: SemanticSlideSpec = {
    ...base,
    id: 'semslide-legacy-generic-diagram',
    layoutId: 'generic-bullets',
    slots: {
      title: { kind: 'text', text: 'Legacy Generic Diagram' },
      body: { kind: 'list', items: ['Keep the existing generic learner summary.'] },
      diagram: {
        kind: 'diagram',
        nodes: Array.from({ length: 9 }, (_, index) => ({
          id: `legacy-node-${index + 1}`,
          label: `Legacy node ${index + 1}`,
          role: 'process',
        })),
        edges: [],
      },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(genericDiagram), true);
  assert.equal(compileSemanticSlideSpecsToScenes([genericDiagram], { title: 'Legacy Generic Diagram Deck' }).ok, true);
});

test('preserves legacy generic question capacity as one structured item', () => {
  const base = questionChoicesSemanticFixture();
  const question = base.slots.question;
  assert.equal(question.kind, 'question');
  if (question.kind !== 'question') return;
  const genericQuestion: SemanticSlideSpec = {
    ...base,
    id: 'semslide-legacy-generic-question',
    layoutId: 'generic-bullets',
    slots: {
      title: { kind: 'text', text: 'Legacy Generic Question' },
      body: { kind: 'list', items: ['Keep the existing generic learner prompt.'] },
      question: {
        ...question,
        choices: Array.from({ length: 9 }, (_, index) => ({
          id: `legacy-choice-${index + 1}`,
          text: `Legacy choice ${index + 1}`,
        })),
      },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(genericQuestion), true);
  assert.equal(compileSemanticSlideSpecsToScenes([genericQuestion], { title: 'Legacy Generic Question Deck' }).ok, true);
});

test('accounts for preview cell padding when estimating table text fit', () => {
  const specs = specsFrom();
  const exitSpec = specs.find((spec) => spec.layoutId === 'exit-ticket-card');
  assert.ok(exitSpec);
  const paddedWrap = {
    ...exitSpec,
    slots: {
      ...exitSpec.slots,
      body: { kind: 'list' as const, items: ['Keep this source-backed prompt visible.'] },
      requirements: {
        kind: 'list' as const,
        items: [
          'Required response one',
          'Required response two',
          'Required response three',
          'Required response four',
          'Required response five',
        ],
      },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(paddedWrap), false);
});

test('rejects table cells that exceed their PPTX row frame even when total table height fits', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const table = {
    id: 'dense-single-row-table',
    kind: 'table' as const,
    frame: { x: 648, y: 158, w: 506, h: 340 },
    editable: true,
    readingOrder: 99,
    headers: ['#', 'Required evidence or output'],
    rows: [[
      '1',
      'This source-backed row needs several wrapped lines in one table cell while the table still has frame height.',
    ]],
    fontSize: 21,
    headerFill: '0F766E',
    cellFill: 'ECFDF5',
    textColor: '111827',
  };
  const denseSingleRow = {
    ...scene,
    elements: [...scene.elements, table],
    readingOrder: [...scene.readingOrder, table.id],
  };

  const diagnostics = validateCompiledSlideScene(denseSingleRow);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_text_overflow'), true);
});

test('renders dense evidence requirements without a narrow overflowing table', () => {
  const spec = {
    ...specsFrom()[0],
    id: 'dense-evidence-spec',
    intent: 'evidence-capture' as const,
    layoutId: 'evidence-capture-board' as const,
    slots: {
      title: { kind: 'text' as const, text: 'Use Readings as Evidence' },
      body: {
        kind: 'list' as const,
        items: ['Compare the recorded circuit readings before writing the claim.'],
      },
      requirements: {
        kind: 'list' as const,
        items: [
          'Record the ammeter and voltmeter readings that support the relationship claim.',
          'Submit a labeled circuit diagram with the measured reading used as evidence.',
        ],
      },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([spec], { title: 'Dense Evidence Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  assert.deepEqual(validateCompiledSlideScene(scene), []);
  const visibleText = getSceneVisibleText(scene).join(' ');
  assert.match(visibleText, /ammeter and voltmeter readings/i);
  assert.match(visibleText, /labeled circuit diagram/i);
  assert.equal(scene.elements.some((element) => element.kind === 'table'), false);
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

test('adds only bounded source-backed image elements when resolved assets are supplied', () => {
  const specs = specsFrom();
  const request = assetRequestForSpec(specs[1]);
  const specWithRequest = { ...specs[1], assetRequests: [request] };
  const result = compileSemanticSlideSpecsToScenes(
    [specs[0], specWithRequest, specs[2]],
    {
      title: 'Fixture Deck',
      resolvedAssetsBySpecId: {
        [specWithRequest.id]: [resolvedAssetForRequest(request)],
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const image = result.presentation.scenes[1].elements.find((element) => element.kind === 'image');
  assert.ok(image);
  assert.equal(image.noEmbeddedText, true);
  assert.equal(image.assetId, request.id);
  assert.deepEqual(image.sourceStepIds, request.sourceStepIds);
  assert.equal(image.storyboardScreenId, request.storyboardScreenId);
  assert.equal(image.semanticSlideSpecId, request.semanticSlideSpecId);
  assert.equal(image.frame.w < 1280 && image.frame.h < 720, true);
  assert.deepEqual(validateCompiledSlideScene(result.presentation.scenes[1]), []);
});

test('keeps bounded assets disjoint from editable text and table content', () => {
  const specs = specsFrom();
  const request = assetRequestForSpec(specs[1]);
  const specWithRequest = { ...specs[1], assetRequests: [request] };
  const result = compileSemanticSlideSpecsToScenes(
    [specWithRequest],
    {
      title: 'Fixture Deck',
      resolvedAssetsBySpecId: {
        [specWithRequest.id]: [resolvedAssetForRequest(request)],
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const image = scene.elements.find((element) => element.kind === 'image');
  assert.ok(image);
  const editableContent = scene.elements.filter((element) => element.kind === 'text' || element.kind === 'table');
  const overlaps = editableContent.some((element) => (
    image.frame.x < element.frame.x + element.frame.w
    && image.frame.x + image.frame.w > element.frame.x
    && image.frame.y < element.frame.y + element.frame.h
    && image.frame.y + image.frame.h > element.frame.y
  ));
  assert.equal(overlaps, false);
});

test('places a visual-thesis asset only in its empty right visual region without overlapping native content', () => {
  const { asset, spec } = visualThesisAssetFixture();
  const result = compileSemanticSlideSpecsToScenes([spec], {
    title: 'Asset Thesis Deck',
    resolvedAssetsBySpecId: { [spec.id]: [asset] },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const image = scene.elements.find((element) => element.kind === 'image');
  assert.ok(image);
  assert.equal(image.frame.x >= 754, true);
  assert.equal(image.frame.y >= 180, true);
  assert.equal(image.frame.x + image.frame.w <= 1208, true);
  assert.equal(image.frame.y + image.frame.h <= 610, true);
  const nonDecorativeElements = scene.elements.filter((element) => (
    element.id !== image.id
    && !(element.kind === 'shape' && (element.id.endsWith('-bg') || element.id.endsWith('-title-band')))
  ));
  assert.equal(nonDecorativeElements.some((element) => framesOverlap(image.frame, element.frame)), false);
});

test('omits a visual-thesis asset instead of overlapping native point or diagram occupants', () => {
  const { asset, spec } = visualThesisAssetFixture(true);
  const result = compileSemanticSlideSpecsToScenes([spec], {
    title: 'Native Thesis Deck',
    resolvedAssetsBySpecId: { [spec.id]: [asset] },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes[0].elements.some((element) => element.kind === 'image'), false);
  assert.deepEqual(validateCompiledSlideScene(result.presentation.scenes[0]), []);
});

test('omits an optional resolved asset when a full-width table leaves no collision-free frame', () => {
  const specs = specsFrom();
  const baseSpec = specs[1];
  const request = assetRequestForSpec(baseSpec);
  const specWithRequest = {
    ...baseSpec,
    assetRequests: [request],
    slots: {
      ...baseSpec.slots,
      requirements: {
        kind: 'list' as const,
        items: ['Evidence: first source-backed record.', 'Evidence: second source-backed record.'],
      },
    },
  };
  const result = compileSemanticSlideSpecsToScenes(
    [specWithRequest],
    {
      title: 'Fixture Deck',
      resolvedAssetsBySpecId: {
        [specWithRequest.id]: [resolvedAssetForRequest(request)],
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes[0].elements.some((element) => element.kind === 'image'), false);
  assert.deepEqual(validateCompiledSlideScene(result.presentation.scenes[0]), []);
});

test('compiles a valid editable scene when optional assets are omitted', () => {
  const specs = specsFrom();
  const request = assetRequestForSpec(specs[1]);
  const specWithRequest = { ...specs[1], assetRequests: [request] };
  const result = compileSemanticSlideSpecsToScenes([specs[0], specWithRequest, specs[2]], { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes[1].elements.some((element) => element.kind === 'image'), false);
  assert.deepEqual(validateCompiledSlideScene(result.presentation.scenes[1]), []);
});

test('rejects full-slide raster image frames', () => {
  const specs = specsFrom();
  const request = assetRequestForSpec(specs[1]);
  const specWithRequest = { ...specs[1], assetRequests: [request] };
  const result = compileSemanticSlideSpecsToScenes(
    [specs[0], specWithRequest, specs[2]],
    {
      title: 'Fixture Deck',
      resolvedAssetsBySpecId: {
        [specWithRequest.id]: [resolvedAssetForRequest(request)],
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = {
    ...result.presentation.scenes[1],
    elements: result.presentation.scenes[1].elements.map((element) => element.kind === 'image'
      ? { ...element, frame: { x: 0, y: 0, w: 1280, h: 720 } }
      : element),
  };
  const diagnostics = validateCompiledSlideScene(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_full_slide_raster_forbidden'), true);
});

test('preview descriptors are derived from the compiled scene contract', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const descriptors = createPreviewSceneDescriptors(scene);
  assert.deepEqual(descriptors.map((descriptor) => descriptor.elementId), scene.elements.map((element) => element.id));
});

test('compiles a relationship diagram as editable native nodes and connectors', () => {
  const result = compileSemanticSlideSpecsToScenes(
    [relationshipDiagramSemanticFixture()],
    { title: 'Sanitized Relationship Deck' },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const nodes = scene.elements.filter((element): element is SceneShapeElement => (
    element.kind === 'shape' && element.id.includes('-node-')
  ));
  const connectors = scene.elements.filter((element) => element.kind === 'connector');
  assert.equal(nodes.length, 3);
  assert.equal(new Set(connectors.map((element) => `${element.from}->${element.to}`)).size, 2);
  assert.equal(nodes.some((element) => element.shape === 'ellipse'), true);
  assert.equal(nodes.some((element) => element.shape === 'diamond'), true);
  const diamond = nodes.find((element) => element.shape === 'diamond');
  assert.ok(diamond);
  assert.equal(diamond.frame.w, diamond.frame.h);
  assert.equal(scene.elements.filter((element) => element.kind === 'text').every((element) => element.editable), true);
  assert.equal(scene.elements.some((element) => element.kind === 'image'), false);
  assertPeerFramesDoNotOverlap(nodes.map((element) => element.frame));
  assert.deepEqual(validateCompiledSlideScene(scene), []);

  const visible = getSceneVisibleText(scene);
  for (const sourceText of ['Supplied push', 'Opposition', 'Measured flow', 'changes', 'constrains']) {
    assert.equal(visible.some((item) => item.includes(sourceText)), true);
  }
});

test('routes a unique non-adjacent relationship edge outside intermediate nodes with its own nearby label', () => {
  const base = relationshipDiagramSemanticFixture();
  const diagram = base.slots.diagram;
  assert.equal(diagram.kind, 'diagram');
  if (diagram.kind !== 'diagram') return;
  const routed = {
    ...base,
    slots: {
      ...base.slots,
      diagram: {
        ...diagram,
        edges: [{
          from: diagram.nodes[0].id,
          to: diagram.nodes[2].id,
          label: 'Non-adjacent relationship sentinel',
          direction: 'forward' as const,
        }],
      },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([routed], { title: 'Routed Relationship Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const routeSegments = scene.elements.filter((element): element is SceneConnectorElement => (
    element.kind === 'connector' && element.id.includes('-edge-1-segment-')
  ));
  assert.equal(routeSegments.length, 3);
  const intermediateNode = scene.elements.find((element) => (
    element.kind === 'shape' && element.id.endsWith('-node-2')
  ));
  assert.ok(intermediateNode);
  assert.equal(routeSegments.some((segment) => framesOverlap(segment.frame, intermediateNode.frame)), false);

  const horizontalLane = routeSegments.find((segment) => segment.frame.w > segment.frame.h);
  const edgeLabel = scene.elements.find((element) => (
    element.kind === 'text' && element.id.endsWith('-edge-label-1')
  ));
  assert.ok(horizontalLane);
  assert.ok(edgeLabel);
  const laneCenter = {
    x: horizontalLane.frame.x + horizontalLane.frame.w / 2,
    y: horizontalLane.frame.y + horizontalLane.frame.h / 2,
  };
  const labelCenter = {
    x: edgeLabel.frame.x + edgeLabel.frame.w / 2,
    y: edgeLabel.frame.y + edgeLabel.frame.h / 2,
  };
  assert.equal(Math.abs(labelCenter.x - laneCenter.x) <= 4, true);
  assert.equal(Math.abs(labelCenter.y - laneCenter.y) <= 28, true);
  assert.equal(routeSegments.slice(0, -1).every((segment) => !segment.arrowStart && !segment.arrowEnd), true);
  assert.equal(routeSegments.at(-1)?.arrowEnd, true);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('applies the owning deck visual system to native visual teaching elements', () => {
  const spec = relationshipDiagramSemanticFixture();
  const fixture = validVisualPlanFixture();
  const visualSystem = fixture.endToEndInput.visualSystems.systemsByUnitId[spec.unitId];
  assert.ok(visualSystem);
  const result = compileSemanticSlideSpecsToScenes([spec], {
    title: 'Visual System Relationship Deck',
    visualSystemsByUnitId: { [spec.unitId]: visualSystem },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const sourceNode = scene.elements.find((element) => (
    element.kind === 'shape' && element.id.endsWith('-node-1')
  ));
  const title = scene.elements.find((element) => element.kind === 'text' && element.role === 'title');
  assert.ok(sourceNode?.kind === 'shape');
  assert.ok(title?.kind === 'text');
  assert.equal(sourceNode.stroke, visualSystem.palette.accentCool);
  assert.equal(title.fontSize, visualSystem.typography.titleSize);
  assert.equal(title.runs[0]?.color, visualSystem.palette.ink);
});

test('adds deterministic accent deck chrome to native visual layouts with a visual system', () => {
  const fixture = validVisualPlanFixture();
  const specs = [relationshipDiagramSemanticFixture(), questionChoicesSemanticFixture()];
  for (const spec of specs) {
    const visualSystem = fixture.endToEndInput.visualSystems.systemsByUnitId[spec.unitId];
    assert.ok(visualSystem, `missing visual system for ${spec.layoutId}`);
    const result = compileSemanticSlideSpecsToScenes([spec], {
      title: 'Deck Chrome Deck',
      visualSystemsByUnitId: { [spec.unitId]: visualSystem },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const scene = result.presentation.scenes[0];
    const rail = scene.elements.find((element) => element.kind === 'shape' && element.id.endsWith('-rail-chrome'));
    const eyebrow = scene.elements.find((element) => element.kind === 'shape' && element.id.endsWith('-eyebrow-chrome'));
    assert.ok(rail?.kind === 'shape', `${spec.layoutId} is missing the accent side rail`);
    assert.ok(eyebrow?.kind === 'shape', `${spec.layoutId} is missing the teaching-move eyebrow`);
    assert.equal(rail.fill, visualSystem.palette.accentCool);
    assert.equal(eyebrow.fill, visualSystem.palette.accentWarm);
    // Chrome stays in the left/top margins so it never covers content that starts at x>=72 / y>=54.
    assert.equal(rail.frame.x + rail.frame.w <= 72, true);
    assert.equal(eyebrow.frame.y + eyebrow.frame.h <= 54, true);
    // Decorative shapes only: no new visible text, no new validation diagnostics.
    assert.deepEqual(validateCompiledSlideScene(scene), []);
  }
});

test('elevates native visual card surfaces with a soft shadow while keeping background chrome flat', () => {
  const spec = questionChoicesSemanticFixture();
  const fixture = validVisualPlanFixture();
  const visualSystem = fixture.endToEndInput.visualSystems.systemsByUnitId[spec.unitId];
  assert.ok(visualSystem);
  const result = compileSemanticSlideSpecsToScenes([spec], {
    title: 'Elevation Deck',
    visualSystemsByUnitId: { [spec.unitId]: visualSystem },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const choiceCard = scene.elements.find((element) => element.kind === 'shape' && element.id.includes('-choice-card-'));
  const bg = scene.elements.find((element) => element.kind === 'shape' && element.id.endsWith('-bg'));
  const rail = scene.elements.find((element) => element.kind === 'shape' && element.id.endsWith('-rail-chrome'));
  assert.ok(choiceCard?.kind === 'shape', 'expected a native choice card surface');
  assert.equal(choiceCard.elevated, true);
  assert.notEqual(bg?.kind === 'shape' && bg.elevated === true, true);
  assert.notEqual(rail?.kind === 'shape' && rail.elevated === true, true);
  // Elevation exports as a native PPTX shape shadow (no raster, still editable).
  const cardOperation = compilePptxSceneOperations(scene).find(
    (operation) => operation.kind === 'addShape' && operation.elementId === choiceCard.id,
  );
  assert.ok(cardOperation && cardOperation.kind === 'addShape');
  assert.equal(Boolean((cardOperation.options as { shadow?: unknown }).shadow), true);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('sizes the focal statement in visual layouts above supporting body text', () => {
  const { spec } = visualThesisAssetFixture();
  const fixture = validVisualPlanFixture();
  const visualSystem = fixture.endToEndInput.visualSystems.systemsByUnitId[spec.unitId];
  assert.ok(visualSystem);
  const result = compileSemanticSlideSpecsToScenes([{ ...spec, assetRequests: [] }], {
    title: 'Focal Deck',
    visualSystemsByUnitId: { [spec.unitId]: visualSystem },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const statement = scene.elements.find((element) => element.kind === 'text' && element.id.endsWith('-thesis-statement'));
  assert.ok(statement?.kind === 'text', 'expected a focal thesis statement');
  assert.equal(statement.role, 'prompt');
  // The focal prompt must clearly outrank supporting body text in the hierarchy.
  assert.equal(statement.fontSize > visualSystem.typography.bodySize, true);
  assert.equal(statement.fontSize >= Math.round(visualSystem.typography.bodySize * 1.2), true);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('themes and elevates process step cards under a visual system while preserving the legacy fallback', () => {
  const base = relationshipDiagramSemanticFixture();
  const processSpec: SemanticSlideSpec = {
    ...base,
    id: 'semslide-process-theme',
    intent: 'guided-example',
    layoutId: 'guided-example-steps',
    slots: {
      title: { kind: 'text', text: 'Process' },
      body: { kind: 'list', items: ['First move', 'Second move', 'Third move'] },
    },
  };
  const fixture = validVisualPlanFixture();
  const visualSystem = fixture.endToEndInput.visualSystems.systemsByUnitId[processSpec.unitId];
  assert.ok(visualSystem);

  const themed = compileSemanticSlideSpecsToScenes([processSpec], {
    title: 'Process Deck',
    visualSystemsByUnitId: { [processSpec.unitId]: visualSystem },
  });
  assert.equal(themed.ok, true);
  if (!themed.ok) return;
  const themedScene = themed.presentation.scenes[0];
  const themedCard = themedScene.elements.find((element) => element.kind === 'shape' && element.id.includes('-step-card-'));
  assert.ok(themedCard?.kind === 'shape', 'expected a themed process step card');
  assert.equal(themedCard.fill, visualSystem.palette.surface);
  assert.equal(themedCard.stroke, visualSystem.palette.accentCool);
  assert.equal(themedCard.elevated, true);
  assert.deepEqual(validateCompiledSlideScene(themedScene), []);

  const legacy = compileSemanticSlideSpecsToScenes([processSpec], { title: 'Process Deck' });
  assert.equal(legacy.ok, true);
  if (!legacy.ok) return;
  const legacyCard = legacy.presentation.scenes[0].elements.find((element) => element.kind === 'shape' && element.id.includes('-step-card-'));
  assert.ok(legacyCard?.kind === 'shape');
  assert.equal(legacyCard.fill, 'FFF7ED');
  assert.notEqual(legacyCard.elevated === true, true);
});

const chromeIdSuffixes = ['-rail-chrome', '-eyebrow-chrome'] as const;
const sceneHasChrome = (scene: { elements: readonly { id: string }[] }): boolean => (
  chromeIdSuffixes.every((suffix) => scene.elements.some((element) => element.id.endsWith(suffix)))
);

test('applies deck chrome consistently across composer scene layouts with a visual system', () => {
  const base = relationshipDiagramSemanticFixture();
  const fixture = validVisualPlanFixture();
  const visualSystem = fixture.endToEndInput.visualSystems.systemsByUnitId[base.unitId];
  assert.ok(visualSystem);

  const layoutSpecs: SemanticSlideSpec[] = [
    {
      ...base,
      id: 'semslide-chrome-guided',
      intent: 'guided-example',
      layoutId: 'guided-example-steps',
      slots: {
        title: { kind: 'text', text: 'Guided Process' },
        body: { kind: 'list', items: ['First move', 'Second move', 'Third move'] },
      },
    },
    {
      ...base,
      id: 'semslide-chrome-process',
      intent: 'guided-example',
      layoutId: 'process-flow-horizontal',
      slots: {
        title: { kind: 'text', text: 'Process Flow' },
        body: { kind: 'list', items: ['Stage one', 'Stage two', 'Stage three'] },
      },
    },
    {
      ...base,
      id: 'semslide-chrome-prompt',
      intent: 'discussion-prompt',
      layoutId: 'prompt-card',
      slots: {
        title: { kind: 'text', text: 'Prompt' },
        body: { kind: 'text', text: 'Explain the source-backed relationship.' },
      },
    },
  ];

  for (const spec of layoutSpecs) {
    const withSystem = compileSemanticSlideSpecsToScenes([spec], {
      title: 'Chrome Coverage Deck',
      visualSystemsByUnitId: { [spec.unitId]: visualSystem },
    });
    assert.equal(withSystem.ok, true);
    if (!withSystem.ok) return;
    const scene = withSystem.presentation.scenes[0];
    assert.equal(sceneHasChrome(scene), true, `${spec.layoutId} should receive deck chrome with a visual system`);
    assert.deepEqual(validateCompiledSlideScene(scene), []);

    const withoutSystem = compileSemanticSlideSpecsToScenes([spec], { title: 'Legacy Deck' });
    assert.equal(withoutSystem.ok, true);
    if (!withoutSystem.ok) return;
    assert.equal(
      sceneHasChrome(withoutSystem.presentation.scenes[0]),
      false,
      `${spec.layoutId} must stay chrome-free without a visual system`,
    );
  }
});

test('omits deck chrome entirely when no visual system is supplied', () => {
  const noSystem = compileSemanticSlideSpecsToScenes([relationshipDiagramSemanticFixture()], {
    title: 'No System Deck',
  });
  assert.equal(noSystem.ok, true);
  if (!noSystem.ok) return;
  assert.equal(
    noSystem.presentation.scenes[0].elements.some((element) => element.id.endsWith('-chrome')),
    false,
  );
});

test('preserves pre-Task-4 prompt styling for legacy layouts with a visual system', () => {
  const base = specsFrom()[0];
  const fixture = validVisualPlanFixture();
  const visualSystem = fixture.endToEndInput.visualSystems.systemsByUnitId[base.unitId];
  assert.ok(visualSystem);
  const spec: SemanticSlideSpec = {
    ...base,
    id: 'semslide-legacy-prompt-style',
    intent: 'discussion-prompt',
    layoutId: 'prompt-card',
    slots: {
      title: { kind: 'text', text: 'Legacy Prompt' },
      body: { kind: 'text', text: 'Explain the source-backed relationship.' },
    },
  };
  const result = compileSemanticSlideSpecsToScenes([spec], {
    title: 'Legacy Prompt Deck',
    visualSystemsByUnitId: { [spec.unitId]: visualSystem },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const promptCard = scene.elements.find((element) => (
    element.kind === 'shape' && element.id.endsWith('-prompt-card')
  ));
  const promptText = scene.elements.find((element) => (
    element.kind === 'text' && element.id.endsWith('-prompt')
  ));
  assert.ok(promptCard?.kind === 'shape');
  assert.ok(promptText?.kind === 'text');
  assert.deepEqual([promptCard.fill, promptCard.stroke], ['F0FDFA', '99F6E4']);
  assert.equal(promptText.fontSize, 25);
});

test('maps visual-system title body and label typography roles deterministically', () => {
  const base = relationshipDiagramSemanticFixture();
  const fixture = validVisualPlanFixture();
  const original = fixture.endToEndInput.visualSystems.systemsByUnitId[base.unitId];
  assert.ok(original);
  const visualSystem = {
    ...original,
    typography: {
      ...original.typography,
      titleSize: 38,
      bodySize: 23,
      labelSize: 16,
      minReadableSize: 19,
    },
  };
  const spec = {
    ...base,
    slots: {
      ...base.slots,
      statement: { kind: 'text' as const, text: 'Custom typography body sentinel.' },
    },
  };
  const result = compileSemanticSlideSpecsToScenes([spec], {
    title: 'Typography Role Deck',
    visualSystemsByUnitId: { [spec.unitId]: visualSystem },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const textElements = result.presentation.scenes[0].elements.filter((element) => element.kind === 'text');
  assert.equal(textElements.find((element) => element.role === 'title')?.fontSize, 38);
  assert.equal(textElements.find((element) => element.id.endsWith('-relationship-context'))?.fontSize, 23);
  assert.equal(textElements.find((element) => element.id.endsWith('-node-label-1'))?.fontSize, 19);
  assert.equal(textElements.find((element) => element.id.endsWith('-edge-label-1'))?.fontSize, 19);
});

test('applies the custom visual palette to prompt choices nodes panels and thesis surfaces', () => {
  const relationship = relationshipDiagramSemanticFixture();
  const question = questionChoicesSemanticFixture();
  const fixture = validVisualPlanFixture();
  const original = fixture.endToEndInput.visualSystems.systemsByUnitId[relationship.unitId];
  assert.ok(original);
  const visualSystem = {
    ...original,
    palette: {
      ...original.palette,
      surface: 'FEFCE8',
      surfaceMuted: 'E7E5E4',
      ink: '1C1917',
      mutedInk: '44403C',
      accentCool: '1D4ED8',
      accentWarm: 'B91C1C',
      success: '15803D',
      warning: 'A16207',
    },
  };
  const comparison: SemanticSlideSpec = {
    ...relationship,
    id: 'semslide-custom-comparison',
    intent: 'comparison-matrix',
    layoutId: 'comparison-panels',
    slots: {
      title: { kind: 'text', text: 'Custom Comparison' },
      body: {
        kind: 'cards',
        cards: [
          { id: 'custom-panel-a', title: 'Panel A', body: 'Source-backed pattern A.' },
          { id: 'custom-panel-b', title: 'Panel B', body: 'Source-backed pattern B.' },
        ],
      },
    },
  };
  const thesis: SemanticSlideSpec = {
    ...relationship,
    id: 'semslide-custom-thesis',
    intent: 'learning-targets',
    layoutId: 'visual-thesis',
    slots: {
      title: { kind: 'text', text: 'Custom Thesis' },
      statement: { kind: 'text', text: 'Use the source-backed relationship.' },
      points: { kind: 'list', items: ['Native point A', 'Native point B'] },
    },
  };
  const result = compileSemanticSlideSpecsToScenes([relationship, question, comparison, thesis], {
    title: 'Custom Palette Deck',
    visualSystemsByUnitId: { [relationship.unitId]: visualSystem },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const allShapes = result.presentation.scenes.flatMap((scene) => scene.elements)
    .filter((element): element is SceneShapeElement => element.kind === 'shape');
  const sourceNode = allShapes.find((element) => element.id.endsWith('-node-1'));
  const titleBand = allShapes.find((element) => element.id.endsWith('-title-band'));
  const promptCard = allShapes.find((element) => element.id.endsWith('-prompt-card'));
  const choiceCard = allShapes.find((element) => element.id.endsWith('-choice-card-1'));
  const panel = allShapes.find((element) => element.id.endsWith('-panel-1'));
  const thesisCard = allShapes.find((element) => element.id.endsWith('-thesis-card'));
  const thesisItem = allShapes.find((element) => element.id.endsWith('-thesis-item-1'));
  assert.deepEqual([sourceNode?.fill, sourceNode?.stroke], [visualSystem.palette.surface, visualSystem.palette.accentCool]);
  assert.deepEqual([titleBand?.fill, titleBand?.stroke], [visualSystem.palette.surface, visualSystem.palette.surfaceMuted]);
  assert.deepEqual([promptCard?.fill, promptCard?.stroke], [visualSystem.palette.surfaceMuted, visualSystem.palette.accentCool]);
  assert.deepEqual([choiceCard?.fill, choiceCard?.stroke], [visualSystem.palette.surface, visualSystem.palette.accentCool]);
  assert.deepEqual([panel?.fill, panel?.stroke], [visualSystem.palette.surface, visualSystem.palette.accentCool]);
  assert.deepEqual([thesisCard?.fill, thesisCard?.stroke], [visualSystem.palette.surface, visualSystem.palette.accentCool]);
  assert.deepEqual([thesisItem?.fill, thesisItem?.stroke], [visualSystem.palette.surface, visualSystem.palette.accentWarm]);
});

test('retains relationship context points and success criteria as editable text', () => {
  const base = relationshipDiagramSemanticFixture();
  const spec = {
    ...base,
    slots: {
      ...base.slots,
      statement: { kind: 'text' as const, text: 'Use the recorded setup as the shared context.' },
      points: {
        kind: 'list' as const,
        items: ['Trace the supplied change.', 'Relate the change to the measured result.'],
      },
      successCriteria: { kind: 'list' as const, items: ['Support the relationship with one recorded observation.'] },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([spec], { title: 'Relationship Context Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visible = getSceneVisibleText(result.presentation.scenes[0]).join(' ');
  for (const text of [
    'Use the recorded setup as the shared context.',
    'Trace the supplied change.',
    'Relate the change to the measured result.',
    'Support the relationship with one recorded observation.',
  ]) {
    assert.match(visible, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.deepEqual(validateCompiledSlideScene(result.presentation.scenes[0]), []);
});

test('retains distinct relationship requirements and success criteria exactly once', () => {
  const base = relationshipDiagramSemanticFixture();
  const requirement = 'RELATIONSHIP-REQUIREMENT-SENTINEL Record the requested evidence.';
  const criterion = 'RELATIONSHIP-CRITERION-SENTINEL Explain the supported pattern.';
  const spec = {
    ...base,
    slots: {
      ...base.slots,
      requirements: { kind: 'list' as const, items: [requirement] },
      successCriteria: { kind: 'list' as const, items: [criterion] },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([spec], { title: 'Relationship Requirement Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const visible = getSceneVisibleText(scene).join('\n');
  assert.equal(visible.split(requirement).length - 1, 1);
  assert.equal(visible.split(criterion).length - 1, 1);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('accepts the bounded relationship maximum without overlap or off-canvas elements', () => {
  const base = relationshipDiagramSemanticFixture();
  const nodes = Array.from({ length: 6 }, (_, index) => ({
    id: `bounded-node-${index + 1}`,
    label: `Node ${index + 1}`,
    role: ['source', 'process', 'constraint', 'result'][index % 4],
  }));
  const edgeIndexes = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [0, 2],
    [2, 4],
    [3, 5],
  ] as const;
  const edges = edgeIndexes.map(([fromIndex, toIndex], index) => ({
    from: nodes[fromIndex].id,
    to: nodes[toIndex].id,
    label: toIndex - fromIndex === 1 ? '' : `Unique relation ${index + 1}`,
    direction: 'forward',
  }));
  assert.equal(new Set(edges.map((edge) => `${edge.from}->${edge.to}`)).size, edges.length);
  assert.equal(new Set(edges.map((edge) => [edge.from, edge.to].sort().join('<->'))).size, edges.length);
  const bounded = {
    ...base,
    slots: {
      ...base.slots,
      diagram: { kind: 'diagram' as const, nodes, edges },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(bounded), true);
  const result = compileSemanticSlideSpecsToScenes([bounded], { title: 'Bounded Relationship Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const nodeFrames = scene.elements
    .filter((element) => element.kind === 'shape' && element.id.includes('-node-'))
    .map((element) => element.frame);
  assert.equal(nodeFrames.length, 6);
  assertPeerFramesDoNotOverlap(nodeFrames);
  edges.forEach((edge, edgeIndex) => {
    const fromIndex = nodes.findIndex((node) => node.id === edge.from);
    const toIndex = nodes.findIndex((node) => node.id === edge.to);
    const nonEndFrames = scene.elements.filter((element) => (
      element.kind === 'shape'
      && element.id.includes('-node-')
      && !element.id.endsWith(`-node-${fromIndex + 1}`)
      && !element.id.endsWith(`-node-${toIndex + 1}`)
    )).map((element) => element.frame);
    const segments = scene.elements.filter((element) => (
      element.kind === 'connector'
      && (element.id.endsWith(`-edge-${edgeIndex + 1}`) || element.id.includes(`-edge-${edgeIndex + 1}-segment-`))
    ));
    assert.equal(segments.length > 0, true);
    assert.equal(segments.some((segment) => nonEndFrames.some((frame) => framesOverlap(segment.frame, frame))), false);
  });
  assertNoUnrelatedRouteCollisions(scene);
  assert.equal(validateCompiledSlideScene(scene).some((diagnostic) => (
    diagnostic.code === 'scene_element_off_canvas' || diagnostic.code === 'scene_text_overflow'
  )), false);
});

test('fails closed when a bounded unique relationship graph has no collision-free route assignment', () => {
  const base = relationshipDiagramSemanticFixture();
  const nodes = Array.from({ length: 6 }, (_, index) => ({
    id: `blocked-node-${index + 1}`,
    label: `Blocked ${index + 1}`,
    role: 'process',
  }));
  const edgeIndexes = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [1, 3],
    [2, 4],
    [3, 5],
  ] as const;
  const edges = edgeIndexes.map(([fromIndex, toIndex], index) => ({
    from: nodes[fromIndex].id,
    to: nodes[toIndex].id,
    label: `Blocked relation ${index + 1}`,
    direction: 'forward',
  }));
  assert.equal(new Set(edges.map((edge) => `${edge.from}->${edge.to}`)).size, edges.length);
  assert.equal(new Set(edges.map((edge) => [edge.from, edge.to].sort().join('<->'))).size, edges.length);
  const unroutable = {
    ...base,
    slots: {
      ...base.slots,
      diagram: { kind: 'diagram' as const, nodes, edges },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(unroutable), false);
  const result = compileSemanticSlideSpecsToScenes([unroutable], { title: 'Unroutable Relationship Deck' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((diagnostic) => (
    diagnostic.code === 'scene_text_overflow' && diagnostic.message.includes('route lanes')
  )), true);
});

test('fails safely when relationship nodes or edges exceed their bounded capacity', () => {
  const base = relationshipDiagramSemanticFixture();
  const diagram = base.slots.diagram;
  assert.equal(diagram.kind, 'diagram');
  if (diagram.kind !== 'diagram') return;
  const tooManyNodes = {
    ...base,
    slots: {
      ...base.slots,
      diagram: {
        ...diagram,
        nodes: [...diagram.nodes, ...Array.from({ length: 4 }, (_, index) => ({
          id: `extra-node-${index + 1}`,
          label: `Extra ${index + 1}`,
          role: 'process',
        }))],
      },
    },
  };
  const tooManyEdges = {
    ...base,
    slots: {
      ...base.slots,
      diagram: {
        ...diagram,
        edges: Array.from({ length: 9 }, (_, index) => ({
          from: diagram.nodes[index % diagram.nodes.length].id,
          to: diagram.nodes[(index + 1) % diagram.nodes.length].id,
          label: `Edge ${index + 1}`,
          direction: 'forward',
        })),
      },
    },
  };

  for (const invalid of [tooManyNodes, tooManyEdges]) {
    assert.equal(doesSemanticSlideSpecFitScene(invalid), false);
    const result = compileSemanticSlideSpecsToScenes([invalid], { title: 'Over Capacity Relationship Deck' });
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'scene_text_overflow'), true);
  }
});

test('compiles assessment choices as separate editable objects', () => {
  const result = compileSemanticSlideSpecsToScenes(
    [questionChoicesSemanticFixture()],
    { title: 'Sanitized Check' },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const choiceShapes = scene.elements.filter((element) => element.kind === 'shape' && element.id.includes('-choice-'));
  const choiceTexts = scene.elements.filter((element) => element.kind === 'text' && element.id.includes('-choice-'));
  assert.equal(choiceShapes.length, 4);
  assert.equal(choiceTexts.length, 4);
  assert.equal(choiceTexts.every((element) => element.editable), true);
  assertPeerFramesDoNotOverlap(choiceShapes.map((element) => element.frame));
  const visible = getSceneVisibleText(scene);
  for (const choice of ['Pattern alpha', 'Pattern beta', 'Pattern gamma', 'Pattern delta']) {
    assert.equal(visible.some((item) => item.includes(choice)), true);
  }
  assert.equal(visible.some((item) => /A\..*B\..*C\..*D\./s.test(item)), false);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('fails safely when an assessment exceeds the four-choice grid', () => {
  const base = questionChoicesSemanticFixture();
  const question = base.slots.question;
  assert.equal(question.kind, 'question');
  if (question.kind !== 'question') return;
  const invalid = {
    ...base,
    slots: {
      ...base.slots,
      question: {
        ...question,
        choices: [...question.choices, { id: 'E', text: 'Pattern epsilon' }],
      },
    },
  };

  assert.equal(doesSemanticSlideSpecFitScene(invalid), false);
  const result = compileSemanticSlideSpecsToScenes([invalid], { title: 'Over Capacity Check' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'scene_text_overflow'), true);
});

test('compiles comparison cards into bounded equal native panels', () => {
  const base = relationshipDiagramSemanticFixture();
  const comparison = {
    ...base,
    intent: 'comparison-matrix' as const,
    layoutId: 'comparison-panels' as const,
    slots: {
      title: { kind: 'text' as const, text: 'Compare Source-Backed Patterns' },
      body: {
        kind: 'cards' as const,
        cards: [
          { id: 'panel-alpha', title: 'Pattern alpha', body: 'First recorded relationship.' },
          { id: 'panel-beta', title: 'Pattern beta', body: 'Second recorded relationship.' },
          { id: 'panel-gamma', title: 'Pattern gamma', body: 'Third recorded relationship.' },
        ],
      },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([comparison], { title: 'Sanitized Comparison' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const panels = scene.elements.filter((element) => element.kind === 'shape' && element.id.includes('-panel-'));
  assert.equal(panels.length, 3);
  assert.equal(new Set(panels.map((panel) => panel.frame.w)).size, 1);
  assertPeerFramesDoNotOverlap(panels.map((panel) => panel.frame));
  const visible = getSceneVisibleText(scene).join(' ');
  for (const sentinel of ['Pattern alpha', 'First recorded relationship.', 'Pattern beta', 'Second recorded relationship.', 'Pattern gamma', 'Third recorded relationship.']) {
    assert.match(visible, new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('compiles a visual thesis with separate editable statement and points', () => {
  const base = relationshipDiagramSemanticFixture();
  const thesis = {
    ...base,
    intent: 'learning-targets' as const,
    layoutId: 'visual-thesis' as const,
    slots: {
      title: { kind: 'text' as const, text: 'Source-Backed Thesis' },
      statement: { kind: 'text' as const, text: 'A supplied change is interpreted through recorded evidence.' },
      points: {
        kind: 'list' as const,
        items: ['Observe the supplied change.', 'Connect it to the recorded pattern.', 'State the supported relationship.'],
      },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([thesis], { title: 'Sanitized Thesis' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const visible = getSceneVisibleText(scene);
  assert.equal(visible.some((item) => item === 'A supplied change is interpreted through recorded evidence.'), true);
  for (const point of ['Observe the supplied change.', 'Connect it to the recorded pattern.', 'State the supported relationship.']) {
    assert.equal(visible.some((item) => item === point), true);
  }
  assert.equal(scene.elements.filter((element) => element.kind === 'text').every((element) => element.editable), true);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('retains distinct visual-thesis requirements and success criteria exactly once', () => {
  const base = relationshipDiagramSemanticFixture();
  const requirement = 'THESIS-REQUIREMENT-SENTINEL Submit the source-backed claim.';
  const criterion = 'THESIS-CRITERION-SENTINEL Connect the claim to the supplied evidence.';
  const thesis = {
    ...base,
    intent: 'learning-targets' as const,
    layoutId: 'visual-thesis' as const,
    slots: {
      title: { kind: 'text' as const, text: 'Requirement Thesis' },
      statement: { kind: 'text' as const, text: 'Use the supplied model to state the relationship.' },
      points: { kind: 'list' as const, items: ['Inspect the supplied pattern.', 'State the supported relationship.'] },
      requirements: { kind: 'list' as const, items: [requirement] },
      successCriteria: { kind: 'list' as const, items: [criterion] },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([thesis], { title: 'Thesis Requirement Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const visible = getSceneVisibleText(scene).join('\n');
  assert.equal(visible.split(requirement).length - 1, 1);
  assert.equal(visible.split(criterion).length - 1, 1);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('routes a non-adjacent visual-thesis edge outside the intermediate native item', () => {
  const base = relationshipDiagramSemanticFixture();
  const diagram = base.slots.diagram;
  assert.equal(diagram.kind, 'diagram');
  if (diagram.kind !== 'diagram') return;
  const thesis = {
    ...base,
    intent: 'learning-targets' as const,
    layoutId: 'visual-thesis' as const,
    slots: {
      title: { kind: 'text' as const, text: 'Routed Thesis' },
      statement: { kind: 'text' as const, text: 'Use the source-backed model.' },
      diagram: {
        ...diagram,
        edges: [{
          from: diagram.nodes[0].id,
          to: diagram.nodes[2].id,
          label: 'Thesis route sentinel',
          direction: 'forward' as const,
        }],
      },
    },
  };

  const result = compileSemanticSlideSpecsToScenes([thesis], { title: 'Routed Thesis Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const routeSegments = scene.elements.filter((element): element is SceneConnectorElement => (
    element.kind === 'connector' && element.id.includes('-thesis-edge-1-segment-')
  ));
  const intermediateItem = scene.elements.find((element) => (
    element.kind === 'shape' && element.id.endsWith('-thesis-item-2')
  ));
  const edgeLabel = scene.elements.find((element) => (
    element.kind === 'text' && element.id.endsWith('-thesis-edge-label-1')
  ));
  assert.equal(routeSegments.length, 3);
  assert.ok(intermediateItem);
  assert.ok(edgeLabel);
  assert.equal(routeSegments.some((segment) => framesOverlap(segment.frame, intermediateItem.frame)), false);
  const verticalLane = routeSegments.find((segment) => segment.frame.h > segment.frame.w);
  assert.ok(verticalLane);
  const labelCenterY = edgeLabel.frame.y + edgeLabel.frame.h / 2;
  assert.equal(edgeLabel.frame.x >= verticalLane.frame.x + verticalLane.frame.w, true);
  assert.equal(labelCenterY >= verticalLane.frame.y && labelCenterY <= verticalLane.frame.y + verticalLane.frame.h, true);
  assert.equal(Boolean(routeSegments.at(-1)?.arrowStart || routeSegments.at(-1)?.arrowEnd), true);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});
