import assert from 'node:assert/strict';

import { buildDeckVisualSystems } from '../../lib/deckVisualSystem.ts';
import {
  COMPILED_SLIDE_SCENE_VERSION,
  compileSemanticSlideSpecsToScenes,
  validateCompiledSlideScene,
  type CompiledSlideScene,
} from '../../lib/compiledSlideScene.ts';
import { buildLessonSourceManifest } from '../../lib/lessonSourceManifest.ts';
import type { StructuredSourceDocument } from '../../lib/lessonSourceDocument.ts';
import { buildSceneAssetRequests } from '../../lib/sceneAssetRequests.ts';
import {
  buildSemanticSlideSpecs,
  SEMANTIC_SLIDE_SPEC_VERSION,
  type SemanticSlideSpec,
} from '../../lib/semanticSlideSpec.ts';
import {
  classifySourceContent,
  type SourceDispositionDecision,
} from '../../lib/sourceContentDisposition.ts';
import { buildTeachingStoryboard } from '../../lib/teachingStoryboard.ts';
import {
  validateVisualTeachingPlan,
  VISUAL_TEACHING_PLAN_VERSION,
  type VisualTeachingPlan,
  type VisualTeachingScene,
} from '../../lib/visualTeachingPlan.ts';

export const VISUAL_COMPOSER_SCIENCE_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-visual-composer-science.txt',
  sourceHash: 'fixture-visual-composer-science-hash',
  byteLength: 4200,
  plainText: '',
  blocks: [
    { id: 'vc001', kind: 'heading', text: 'Session 1', sourceOrder: 1, sourceLocation: { blockId: 'vc001' } },
    { id: 'vc002', kind: 'paragraph', text: 'Objective: Explain a source-backed relationship using recorded observations.', sourceOrder: 2, sourceLocation: { blockId: 'vc002' } },
    { id: 'vc003', kind: 'paragraph', text: 'References (books and websites): Planning-only source list.', sourceOrder: 3, sourceLocation: { blockId: 'vc003' } },
    { id: 'vc004', kind: 'paragraph', text: 'Learner Context: Planning observation about prior classroom experience.', sourceOrder: 4, sourceLocation: { blockId: 'vc004' } },
    { id: 'vc005', kind: 'paragraph', text: 'Prediction: Choose which source-backed setup changes first and state a reason.', sourceOrder: 5, sourceLocation: { blockId: 'vc005' } },
    { id: 'vc006', kind: 'paragraph', text: 'Relationship Model: Connect the measured flow, supplied push, and opposition in the provided setup.', sourceOrder: 6, sourceLocation: { blockId: 'vc006' } },
    { id: 'vc007', kind: 'paragraph', text: 'Evidence Record: Record two observations and one measurement in the provided table.', sourceOrder: 7, sourceLocation: { blockId: 'vc007' } },
    { id: 'vc008', kind: 'paragraph', text: 'Check: Which statement matches the recorded pattern? A. Pattern alpha B. Pattern beta C. Pattern gamma D. Pattern delta', sourceOrder: 8, sourceLocation: { blockId: 'vc008' } },
    { id: 'vc009', kind: 'paragraph', text: 'Exit Output: Submit one claim supported by the recorded measurement.', sourceOrder: 9, sourceLocation: { blockId: 'vc009' } },
  ],
  tables: [],
};

export const VISUAL_COMPOSER_HUMANITIES_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-visual-composer-humanities.txt',
  sourceHash: 'fixture-visual-composer-humanities-hash',
  byteLength: 2400,
  plainText: '',
  blocks: [
    { id: 'vh001', kind: 'heading', text: 'Custom Unit 1', sourceOrder: 1, sourceLocation: { blockId: 'vh001' } },
    { id: 'vh002', kind: 'paragraph', text: 'Objective: Compare two source-provided perspectives using cited evidence.', sourceOrder: 2, sourceLocation: { blockId: 'vh002' } },
    { id: 'vh003', kind: 'paragraph', text: 'Source Comparison: Identify one shared claim and one meaningful difference.', sourceOrder: 3, sourceLocation: { blockId: 'vh003' } },
    { id: 'vh004', kind: 'paragraph', text: 'Evidence Board: Place one quotation under each perspective and explain its relevance.', sourceOrder: 4, sourceLocation: { blockId: 'vh004' } },
  ],
  tables: [],
};

const materializeSource = (document: StructuredSourceDocument) => {
  const manifestResult = buildLessonSourceManifest(document);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) throw new Error('visual-composer fixture manifest failed');

  const storyboardResult = buildTeachingStoryboard(manifestResult.manifest);
  assert.equal(storyboardResult.ok, true);
  if (!storyboardResult.ok) throw new Error('visual-composer fixture storyboard failed');

  return {
    manifest: manifestResult.manifest,
    storyboard: storyboardResult.storyboard,
  };
};

export const scienceFixture = () => materializeSource(VISUAL_COMPOSER_SCIENCE_DOCUMENT);

const visibleContentForStep = (sourceLabel: string, rawText: string): VisualTeachingScene['visibleContent'] => ({
  statement: rawText,
  points: [],
  cards: [],
  steps: [],
  ...(sourceLabel === 'Relationship Model'
    ? {
        diagram: {
          nodes: [
            { id: 'node-push', label: 'Supplied push', role: 'source' as const },
            { id: 'node-opposition', label: 'Opposition', role: 'constraint' as const },
            { id: 'node-flow', label: 'Measured flow', role: 'result' as const },
          ],
          edges: [
            { from: 'node-push', to: 'node-flow', label: 'changes', direction: 'forward' as const },
            { from: 'node-opposition', to: 'node-flow', label: 'constrains', direction: 'forward' as const },
          ],
        },
      }
    : {}),
  ...(sourceLabel === 'Check'
    ? {
        statement: undefined,
        question: {
          prompt: 'Which statement matches the recorded pattern?',
          choices: [
            { id: 'A', text: 'Pattern alpha' },
            { id: 'B', text: 'Pattern beta' },
            { id: 'C', text: 'Pattern gamma' },
            { id: 'D', text: 'Pattern delta' },
          ],
        },
      }
    : {}),
});

const sceneForDecision = (
  decision: SourceDispositionDecision,
  fixture: ReturnType<typeof scienceFixture>,
  sceneNumber: number,
): VisualTeachingScene => {
  const sourceStep = fixture.manifest.units
    .flatMap((unit) => unit.steps)
    .find((step) => step.id === decision.sourceId);
  const sourceObjective = fixture.manifest.objectives.find((objective) => objective.id === decision.sourceId);
  const screen = fixture.storyboard.screens.find((candidate) => (
    candidate.sourceStepIds.includes(decision.sourceId)
    || candidate.sourceObjectiveIds.includes(decision.sourceId)
  ));
  assert.ok(screen);

  const rawText = sourceStep?.rawBlocks.join(' ') ?? sourceObjective?.rawText ?? decision.sourceLabel;
  const sceneId = `visual-scene-${String(sceneNumber).padStart(3, '0')}`;
  const visualGrammar = decision.sourceKind === 'objective'
    ? 'visual-thesis'
    : decision.sourceLabel === 'Relationship Model'
      ? 'relationship-diagram'
      : decision.sourceLabel === 'Check'
        ? 'question-choices'
        : decision.sourceLabel === 'Evidence Record'
          ? 'evidence-board'
          : 'activity-board';
  const teachingMove = decision.sourceKind === 'objective'
    ? 'target'
    : decision.sourceLabel === 'Relationship Model'
      ? 'explain'
      : decision.sourceLabel === 'Check'
        ? 'check'
        : decision.sourceLabel === 'Evidence Record'
          ? 'evidence'
          : decision.sourceLabel === 'Exit Output'
            ? 'synthesize'
            : 'practice';

  return {
    id: sceneId,
    unitId: decision.unitId,
    sourceStepIds: sourceStep ? [sourceStep.id] : [],
    sourceObjectiveIds: sourceObjective ? [sourceObjective.id] : [],
    storyboardScreenIds: [screen.id],
    teachingMove,
    learnerTitle: decision.sourceKind === 'objective' ? 'Learning Target' : decision.sourceLabel,
    visibleContent: visibleContentForStep(decision.sourceLabel, rawText),
    visualGrammar,
    teacherNotes: screen.teacherNotes,
    requiredEvidence: sourceStep ? screen.requiredEvidence : [],
    requiredOutputs: sourceStep ? screen.requiredOutputs : [],
  };
};

export const validVisualPlanFixture = () => {
  const fixture = scienceFixture();
  const dispositionResult = classifySourceContent(fixture.manifest, fixture.storyboard);
  assert.equal(dispositionResult.ok, true);
  if (!dispositionResult.ok) throw new Error('visual-composer fixture disposition failed');

  const visibleDecisions = dispositionResult.decisions.filter((decision) => decision.disposition === 'learner-visible');
  const scenes = visibleDecisions.map((decision, index) => sceneForDecision(decision, fixture, index + 1));
  const sceneIdsBySourceId = new Map(scenes.flatMap((scene) => [
    ...scene.sourceStepIds.map((sourceId) => [sourceId, scene.id] as const),
    ...scene.sourceObjectiveIds.map((sourceId) => [sourceId, scene.id] as const),
  ]));
  const plan: VisualTeachingPlan = {
    contractVersion: VISUAL_TEACHING_PLAN_VERSION,
    unitId: fixture.manifest.units[0].id,
    sourceObjectiveIds: fixture.storyboard.objectives.map((objective) => objective.sourceObjectiveId),
    scenes,
    sourceAccounting: dispositionResult.decisions.map((decision) => ({
      ...decision,
      sceneIds: sceneIdsBySourceId.has(decision.sourceId) ? [sceneIdsBySourceId.get(decision.sourceId)!] : [],
    })),
    provenance: {
      sourceHash: fixture.manifest.provenance.sourceHash,
      storyboardVersion: fixture.storyboard.contractVersion,
      selectedUnitIds: [...fixture.storyboard.provenance.selectedUnitIds],
    },
  };
  const diagnostics = validateVisualTeachingPlan(
    plan,
    fixture.manifest,
    fixture.storyboard,
    dispositionResult.decisions,
  );
  assert.deepEqual(diagnostics, []);

  const relationshipDecision = dispositionResult.decisions.find((decision) => decision.sourceLabel === 'Relationship Model');
  assert.ok(relationshipDecision);

  const semanticResult = buildSemanticSlideSpecs(fixture.storyboard);
  assert.equal(semanticResult.ok, true);
  if (!semanticResult.ok) throw new Error('visual-composer fixture semantic specs failed');
  const visualSystemResult = buildDeckVisualSystems(fixture.storyboard, semanticResult.specs);
  assert.equal(visualSystemResult.ok, true);
  if (!visualSystemResult.ok) throw new Error('visual-composer fixture visual system failed');
  const assetRequestResult = buildSceneAssetRequests(
    fixture.storyboard,
    semanticResult.specs,
    visualSystemResult.bundle,
  );
  assert.equal(assetRequestResult.ok, true);
  if (!assetRequestResult.ok) throw new Error('visual-composer fixture asset requests failed');
  const semanticSpecs = semanticResult.specs.map((spec) => ({
    ...spec,
    assetRequests: assetRequestResult.requests.filter((request) => request.semanticSlideSpecId === spec.id),
  }));
  const presentationResult = compileSemanticSlideSpecsToScenes(semanticSpecs, {
    title: 'Sanitized Visual Composer Fixture',
    visualSystemsByUnitId: visualSystemResult.bundle.systemsByUnitId,
  });
  assert.equal(presentationResult.ok, true);
  if (!presentationResult.ok) throw new Error('visual-composer fixture presentation failed');

  return {
    ...fixture,
    plan,
    dispositions: dispositionResult.decisions,
    relationshipStepId: relationshipDecision.sourceId,
    endToEndInput: {
      sourceManifest: fixture.manifest,
      storyboard: fixture.storyboard,
      semanticSpecs,
      visualSystems: visualSystemResult.bundle,
      assetRequests: assetRequestResult.requests,
      resolvedAssetsBySpecId: {},
      presentation: presentationResult.presentation,
    },
  };
};

export const visualComposerFixture = () => {
  const fixture = validVisualPlanFixture();
  return {
    input: {
      manifest: fixture.manifest,
      storyboard: fixture.storyboard,
      dispositions: fixture.dispositions,
      language: 'EN' as const,
    },
    providerPlan: fixture.plan,
    planWithoutRelationshipStep: {
      ...fixture.plan,
      sourceAccounting: fixture.plan.sourceAccounting.filter((entry) => entry.sourceId !== fixture.relationshipStepId),
    },
  };
};

type FutureSemanticSlideSpec = Omit<SemanticSlideSpec, 'layoutId' | 'slots'> & {
  layoutId: SemanticSlideSpec['layoutId'] | 'relationship-diagram' | 'question-choices';
  slots: Record<string, SemanticSlideSpec['slots'][string] | {
    kind: 'question';
    prompt: string;
    choices: Array<{ id: string; text: string }>;
  } | {
    kind: 'diagram';
    nodes: Array<{ id: string; label: string; role: string }>;
    edges: Array<{ from: string; to: string; label?: string; direction: string }>;
  }>;
};

export const relationshipDiagramSemanticFixture = (): FutureSemanticSlideSpec => {
  const fixture = validVisualPlanFixture();
  const scene = fixture.plan.scenes.find((candidate) => candidate.visualGrammar === 'relationship-diagram');
  assert.ok(scene?.visibleContent.diagram);
  return {
    contractVersion: SEMANTIC_SLIDE_SPEC_VERSION,
    id: 'semslide-relationship-fixture',
    unitId: scene.unitId,
    storyboardScreenId: scene.storyboardScreenIds[0],
    sourceStepIds: [...scene.sourceStepIds],
    sourceObjectiveIds: [...scene.sourceObjectiveIds],
    intent: 'process-flow',
    layoutId: 'relationship-diagram',
    slots: {
      title: { kind: 'text', text: scene.learnerTitle },
      diagram: { kind: 'diagram', ...scene.visibleContent.diagram },
    },
    assetRequests: [],
    speakerNotes: scene.teacherNotes,
    accessibility: { readingOrder: ['title', 'diagram'], slidePurpose: 'Explain a source-backed relationship.' },
  };
};

export const questionChoicesSemanticFixture = (): FutureSemanticSlideSpec => {
  const fixture = validVisualPlanFixture();
  const scene = fixture.plan.scenes.find((candidate) => candidate.visualGrammar === 'question-choices');
  assert.ok(scene?.visibleContent.question);
  return {
    contractVersion: SEMANTIC_SLIDE_SPEC_VERSION,
    id: 'semslide-question-fixture',
    unitId: scene.unitId,
    storyboardScreenId: scene.storyboardScreenIds[0],
    sourceStepIds: [...scene.sourceStepIds],
    sourceObjectiveIds: [...scene.sourceObjectiveIds],
    intent: 'question',
    layoutId: 'question-choices',
    slots: {
      title: { kind: 'text', text: scene.learnerTitle },
      question: { kind: 'question', ...scene.visibleContent.question },
    },
    assetRequests: [],
    speakerNotes: scene.teacherNotes,
    accessibility: { readingOrder: ['title', 'question'], slidePurpose: 'Check understanding with parsed choices.' },
  };
};

export const visualLayoutSceneFixture = (): CompiledSlideScene => {
  const fixture = validVisualPlanFixture();
  const scene: CompiledSlideScene = {
    contractVersion: COMPILED_SLIDE_SCENE_VERSION,
    id: 'scene-visual-layout-fixture',
    semanticSlideSpecId: 'semslide-relationship-fixture',
    storyboardScreenId: fixture.plan.scenes[0].storyboardScreenIds[0],
    unitId: fixture.plan.unitId,
    sourceStepIds: [fixture.relationshipStepId],
    sourceObjectiveIds: [],
    size: { width: 1280, height: 720, aspect: '16:9' },
    background: '#F8FAFC',
    elements: [
      { id: 'title', kind: 'text', frame: { x: 72, y: 54, w: 1136, h: 72 }, editable: true, readingOrder: 1, role: 'title', runs: [{ text: 'Relationship Model' }], fontSize: 36, lineHeight: 42, align: 'left', valign: 'middle' },
      { id: 'node-a', kind: 'shape', frame: { x: 100, y: 250, w: 240, h: 150 }, editable: true, readingOrder: 2, shape: 'roundRect', fill: '#E0F2FE', stroke: '#0369A1' },
      { id: 'label-a', kind: 'text', frame: { x: 120, y: 285, w: 200, h: 80 }, editable: true, readingOrder: 3, role: 'label', runs: [{ text: 'Supplied push' }], fontSize: 24, lineHeight: 30, align: 'center', valign: 'middle' },
      { id: 'node-b', kind: 'shape', frame: { x: 520, y: 250, w: 240, h: 150 }, editable: true, readingOrder: 4, shape: 'roundRect', fill: '#FEF3C7', stroke: '#B45309' },
      { id: 'label-b', kind: 'text', frame: { x: 540, y: 285, w: 200, h: 80 }, editable: true, readingOrder: 5, role: 'label', runs: [{ text: 'Opposition' }], fontSize: 24, lineHeight: 30, align: 'center', valign: 'middle' },
      { id: 'node-c', kind: 'shape', frame: { x: 940, y: 250, w: 240, h: 150 }, editable: true, readingOrder: 6, shape: 'roundRect', fill: '#DCFCE7', stroke: '#15803D' },
      { id: 'label-c', kind: 'text', frame: { x: 960, y: 285, w: 200, h: 80 }, editable: true, readingOrder: 7, role: 'label', runs: [{ text: 'Measured flow' }], fontSize: 24, lineHeight: 30, align: 'center', valign: 'middle' },
      { id: 'edge-a', kind: 'connector', frame: { x: 340, y: 310, w: 180, h: 20 }, editable: true, readingOrder: 8, from: 'node-a', to: 'node-b', stroke: '#334155', arrowEnd: true },
      { id: 'edge-b', kind: 'connector', frame: { x: 760, y: 310, w: 180, h: 20 }, editable: true, readingOrder: 9, from: 'node-b', to: 'node-c', stroke: '#334155', arrowEnd: true },
    ],
    speakerNotes: 'Source-safe relationship explanation.',
    readingOrder: ['title', 'node-a', 'label-a', 'node-b', 'label-b', 'node-c', 'label-c', 'edge-a', 'edge-b'],
  };
  assert.deepEqual(validateCompiledSlideScene(scene), []);
  return scene;
};
