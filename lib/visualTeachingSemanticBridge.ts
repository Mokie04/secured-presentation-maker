import {
  SEMANTIC_SLIDE_SPEC_VERSION,
  hasBlockingSemanticSlideDiagnostics,
  revalidateVisualTeachingSemanticContext,
  validateSemanticSlideSpecs,
  type SemanticLayoutId,
  type SemanticSlideIntent,
  type SemanticSlideSpec,
  type SemanticSlideSpecResult,
  type SlideSlotValue,
  type VisualTeachingSemanticValidationContext,
} from './semanticSlideSpec.ts';
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import type { SourceDispositionDecision } from './sourceContentDisposition.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';
import type {
  VisualGrammar,
  VisualTeachingPlan,
  VisualTeachingScene,
} from './visualTeachingPlan.ts';

export type VisualTeachingSemanticBridgeInput = {
  sourceManifest: LessonSourceManifest;
  storyboard: TeachingStoryboard;
  dispositions: readonly SourceDispositionDecision[];
  plan: VisualTeachingPlan;
};

const layoutForGrammar: Record<VisualGrammar, SemanticLayoutId> = {
  'concept-map': 'relationship-diagram',
  'relationship-diagram': 'relationship-diagram',
  'process-flow': 'process-flow-horizontal',
  'comparison-panels': 'comparison-panels',
  'classification-map': 'comparison-panels',
  timeline: 'process-flow-horizontal',
  'data-table': 'evidence-capture-board',
  'worked-example': 'guided-example-steps',
  'activity-board': 'activity-board',
  'question-choices': 'question-choices',
  'evidence-board': 'evidence-capture-board',
  'visual-thesis': 'visual-thesis',
  'image-led-explanation': 'visual-thesis',
  'minimal-statement': 'generic-bullets',
};

const intentForScene = (scene: VisualTeachingScene): SemanticSlideIntent => {
  if (scene.teachingMove === 'target') return 'learning-targets';
  if (scene.teachingMove === 'orient') return 'prior-knowledge';
  if (scene.teachingMove === 'model') return 'guided-example';
  if (scene.teachingMove === 'evidence') return 'evidence-capture';
  if (scene.teachingMove === 'check') return 'question';
  if (scene.teachingMove === 'synthesize') {
    return scene.requiredOutputs.length > 0 ? 'exit-ticket' : 'wrap-up';
  }
  if (scene.teachingMove === 'explain') {
    if (scene.visualGrammar === 'comparison-panels' || scene.visualGrammar === 'classification-map') {
      return 'comparison-matrix';
    }
    return 'process-flow';
  }
  return 'activity-board';
};

const structuredSlotsForScene = (scene: VisualTeachingScene): Record<string, SlideSlotValue> => {
  const slots: Record<string, SlideSlotValue> = {
    title: { kind: 'text', text: scene.learnerTitle },
  };
  if (scene.visibleContent.statement) {
    slots.statement = { kind: 'text', text: scene.visibleContent.statement };
  }
  if (scene.visibleContent.points.length > 0) {
    slots.points = { kind: 'list', items: [...scene.visibleContent.points] };
  }
  if (scene.visibleContent.cards.length > 0) {
    slots.cards = {
      kind: 'cards',
      cards: scene.visibleContent.cards.map((card) => ({ ...card })),
    };
  }
  if (scene.visibleContent.steps.length > 0) {
    slots.steps = {
      kind: 'steps',
      steps: scene.visibleContent.steps.map((step) => ({ ...step })),
    };
  }
  if (
    (scene.visualGrammar === 'process-flow' || scene.visualGrammar === 'timeline' || scene.visualGrammar === 'worked-example')
    && (scene.visibleContent.cards.length > 0 || scene.visibleContent.steps.length > 0)
  ) {
    slots.body = {
      kind: 'list',
      items: scene.visibleContent.steps.length > 0
        ? scene.visibleContent.steps.map((step) => `${step.label}: ${step.body}`)
        : scene.visibleContent.cards.map((card) => `${card.title}: ${card.body}`),
    };
  }
  if (scene.visibleContent.table) {
    slots.table = {
      kind: 'table',
      headers: [...scene.visibleContent.table.headers],
      rows: scene.visibleContent.table.rows.map((row) => [...row]),
    };
  }
  if (scene.visibleContent.question) {
    slots.question = {
      kind: 'question',
      prompt: scene.visibleContent.question.prompt,
      choices: scene.visibleContent.question.choices.map((choice) => ({ ...choice })),
      ...(scene.visibleContent.question.answerId
        ? { answerId: scene.visibleContent.question.answerId }
        : {}),
    };
  }
  if (scene.visibleContent.diagram) {
    slots.diagram = {
      kind: 'diagram',
      nodes: scene.visibleContent.diagram.nodes.map((node) => ({ ...node })),
      edges: scene.visibleContent.diagram.edges.map((edge) => ({ ...edge })),
    };
  }
  if (scene.requiredEvidence.length > 0) {
    slots.evidence = { kind: 'list', items: [...scene.requiredEvidence] };
  }
  if (scene.requiredOutputs.length > 0) {
    slots.outputs = { kind: 'list', items: [...scene.requiredOutputs] };
  }
  const evidence = scene.requiredEvidence.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const outputs = scene.requiredOutputs.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const duplicateRequirements = new Set(evidence.filter((item) => outputs.includes(item)));
  const requirements = [
    ...evidence.map((item) => duplicateRequirements.has(item) ? `Evidence / output: ${item}` : `Evidence: ${item}`),
    ...outputs.filter((item) => !duplicateRequirements.has(item)).map((item) => `Output: ${item}`),
  ];
  if (requirements.length > 0) {
    slots.requirements = { kind: 'list', items: requirements };
  }
  return slots;
};

export const buildSemanticSlideSpecsFromVisualTeachingPlan = (
  input: VisualTeachingSemanticBridgeInput,
): SemanticSlideSpecResult => {
  const { sourceManifest, storyboard, dispositions, plan } = input;
  const validationContext: VisualTeachingSemanticValidationContext = {
    sourceManifest,
    dispositions,
    visualTeachingPlan: plan,
  };
  const contextResult = revalidateVisualTeachingSemanticContext(validationContext, storyboard);
  if (contextResult.ok === false) return { ok: false, diagnostics: contextResult.diagnostics };

  if (plan.scenes.some((scene) => scene.storyboardScreenIds.length === 0)) {
    return {
      ok: false,
      diagnostics: [{
        code: 'semantic_spec_storyboard_mapping_invalid',
        severity: 'blocking',
        message: 'Every visual teaching scene must retain at least one storyboard screen.',
      }],
    };
  }

  const specs: SemanticSlideSpec[] = plan.scenes.map((scene, index) => {
    const slots = structuredSlotsForScene(scene);
    return {
      contractVersion: SEMANTIC_SLIDE_SPEC_VERSION,
      id: `semslide-${String(index + 1).padStart(3, '0')}`,
      unitId: scene.unitId,
      storyboardScreenId: scene.storyboardScreenIds[0],
      storyboardScreenIds: [...scene.storyboardScreenIds],
      sourceStepIds: [...scene.sourceStepIds],
      sourceObjectiveIds: [...scene.sourceObjectiveIds],
      sourceFieldIds: [...scene.sourceFieldIds],
      visualTeachingSceneId: scene.id,
      intent: intentForScene(scene),
      layoutId: layoutForGrammar[scene.visualGrammar],
      visualGrammar: scene.visualGrammar,
      visualAssetBrief: scene.assetBrief ? { ...scene.assetBrief } : undefined,
      slots,
      assetRequests: [],
      speakerNotes: scene.teacherNotes,
      accessibility: {
        readingOrder: Object.keys(slots),
        slidePurpose: `${scene.teachingMove}: ${scene.learnerTitle}`,
      },
    };
  });

  const diagnostics = validateSemanticSlideSpecs(specs, storyboard, validationContext);
  return hasBlockingSemanticSlideDiagnostics(diagnostics)
    ? { ok: false, diagnostics }
    : { ok: true, specs };
};
