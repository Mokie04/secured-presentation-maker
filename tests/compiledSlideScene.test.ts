import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileSemanticSlideSpecsToScenes,
  createPreviewSceneDescriptors,
  doesSemanticSlideSpecFitScene,
  getSceneVisibleText,
  validateCompiledSlideScene,
  type SceneShapeElement,
} from '../lib/compiledSlideScene.ts';
import { SCENE_ASSET_REQUEST_VERSION, type SceneAssetRequest } from '../lib/sceneAssetRequests.ts';
import { SCENE_ASSET_RESOLUTION_VERSION, type SceneResolvedAsset } from '../lib/sceneAssetResolver.ts';
import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
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

const specsFrom = () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('semantic specs failed');
  return result.specs;
};

const assetRequestForSpec = (spec: ReturnType<typeof specsFrom>[number]): SceneAssetRequest => ({
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
  assert.equal(connectors.length, 2);
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

test('accepts the bounded relationship maximum without overlap or off-canvas elements', () => {
  const base = relationshipDiagramSemanticFixture();
  const nodes = Array.from({ length: 6 }, (_, index) => ({
    id: `bounded-node-${index + 1}`,
    label: `Node ${index + 1}`,
    role: ['source', 'process', 'constraint', 'result'][index % 4],
  }));
  const edges = Array.from({ length: 8 }, (_, index) => ({
    from: nodes[index % 5].id,
    to: nodes[(index % 5) + 1].id,
    label: `Relation ${index + 1}`,
    direction: 'forward',
  }));
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
  assert.equal(validateCompiledSlideScene(scene).some((diagnostic) => (
    diagnostic.code === 'scene_element_off_canvas' || diagnostic.code === 'scene_text_overflow'
  )), false);
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
