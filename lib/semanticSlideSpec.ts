import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import type { SceneAssetRequest } from './sceneAssetRequests.ts';
import {
  compileSemanticSlideSpecsToScenes,
  doesSemanticSlideSpecFitScene,
  formatSceneValidationDiagnostics,
  type CompiledScenePresentation,
  type SceneValidationDiagnostic,
} from './compiledSlideScene.ts';
import type {
  StoryboardScreen,
  TeachingStoryboard,
} from './teachingStoryboard.ts';

export const SEMANTIC_SLIDE_SPEC_VERSION = 'semantic-slide-spec-v1';

export type SemanticSlideDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type SemanticSlideDiagnosticCode =
  | 'semantic_spec_contract_invalid'
  | 'semantic_spec_storyboard_mapping_invalid'
  | 'semantic_spec_source_step_mismatch'
  | 'semantic_spec_objective_mismatch'
  | 'semantic_spec_layout_unsupported'
  | 'semantic_spec_generic_layout_coverage_low'
  | 'semantic_spec_asset_request_forbidden';

export type SemanticSlideIntent =
  | 'title-context'
  | 'learning-targets'
  | 'prior-knowledge'
  | 'discussion-prompt'
  | 'activity-board'
  | 'evidence-capture'
  | 'guided-example'
  | 'comparison-matrix'
  | 'process-flow'
  | 'question'
  | 'answer-reveal'
  | 'exit-ticket'
  | 'wrap-up';

export type SemanticLayoutId =
  | 'title-context'
  | 'learning-targets-stack'
  | 'prompt-card'
  | 'activity-board'
  | 'evidence-capture-board'
  | 'guided-example-steps'
  | 'comparison-matrix'
  | 'process-flow-horizontal'
  | 'question-reveal-pair'
  | 'exit-ticket-card'
  | 'generic-bullets';

export type SlideSlotValue =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'cards'; cards: Array<{ id: string; title: string; body: string }> }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'steps'; steps: Array<{ id: string; label: string; body: string }> };

export type SemanticSlideSpec = {
  contractVersion: typeof SEMANTIC_SLIDE_SPEC_VERSION;
  id: string;
  unitId: string;
  storyboardScreenId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  intent: SemanticSlideIntent;
  layoutId: SemanticLayoutId;
  slots: Record<string, SlideSlotValue>;
  assetRequests: SceneAssetRequest[];
  speakerNotes: string;
  accessibility: {
    readingOrder: string[];
    slidePurpose: string;
  };
};

export type SemanticSlideDiagnostic = {
  code: SemanticSlideDiagnosticCode;
  severity: SemanticSlideDiagnosticSeverity;
  message: string;
  specId?: string;
  storyboardScreenId?: string;
};

export type SemanticSlideSpecResult =
  | { ok: true; specs: SemanticSlideSpec[] }
  | { ok: false; diagnostics: SemanticSlideDiagnostic[] };

export type SemanticScenePresentationBoundary =
  | { ok: true; presentation: CompiledScenePresentation | null }
  | { ok: false; message: string; diagnostics: Array<SemanticSlideDiagnostic | SceneValidationDiagnostic> };

const SEMANTIC_LAYOUT_IDS: ReadonlySet<SemanticLayoutId> = new Set([
  'title-context',
  'learning-targets-stack',
  'prompt-card',
  'activity-board',
  'evidence-capture-board',
  'guided-example-steps',
  'comparison-matrix',
  'process-flow-horizontal',
  'question-reveal-pair',
  'exit-ticket-card',
  'generic-bullets',
]);

const semanticDiagnostic = (
  code: SemanticSlideDiagnosticCode,
  message: string,
  detail: Pick<SemanticSlideDiagnostic, 'specId' | 'storyboardScreenId'> = {},
): SemanticSlideDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  ...detail,
});

const arraysEqual = (a: readonly string[], b: readonly string[]): boolean => (
  a.length === b.length && a.every((value, index) => value === b[index])
);

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const uniqueNormalized = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};

const normalizeLearnerFacingRequirement = (value: string): string => (
  normalizeText(value)
    .replace(/\bthe\s+teacher\s+will\s+ask\s+(?:learners|students)\s+to\s+/i, '')
    .replace(/\bthe\s+teacher\s+asks?\s+(?:learners|students)\s+to\s+/i, '')
    .replace(/\bthe\s+teacher\s+will\s+/i, '')
    .replace(/\bteacher\s+will\s+/i, '')
    .replace(/\bask\s+(?:learners|students)\s+to\s+/i, '')
);

export const isSemanticSlidesV1Enabled = (flagValue: unknown): boolean => {
  if (typeof flagValue !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(flagValue.trim().toLowerCase());
};

export const hasBlockingSemanticSlideDiagnostics = (diagnostics: SemanticSlideDiagnostic[]): boolean => (
  diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
);

export const formatSemanticSlideDiagnostics = (diagnostics: SemanticSlideDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};

const inferSemanticIntent = (screen: StoryboardScreen): SemanticSlideIntent => {
  if (screen.sourceObjectiveIds.length > 0 && screen.sourceStepIds.length === 0) return 'learning-targets';
  if (screen.communicationIntent === 'exit-ticket' || screen.requiredOutputs.length > 0) return 'exit-ticket';
  if (screen.communicationIntent === 'evidence-capture' || screen.requiredEvidence.length > 0) return 'evidence-capture';
  if (screen.communicationIntent === 'discussion-prompt') return 'discussion-prompt';
  if (screen.communicationIntent === 'guided-example') return 'guided-example';
  if (screen.communicationIntent === 'question') return 'question';
  if (screen.communicationIntent === 'answer-reveal') return 'answer-reveal';
  return 'activity-board';
};

const selectLayoutId = (intent: SemanticSlideIntent, screen: StoryboardScreen): SemanticLayoutId => {
  if (intent === 'learning-targets') return 'learning-targets-stack';
  if (intent === 'evidence-capture') return 'evidence-capture-board';
  if (intent === 'exit-ticket') return 'exit-ticket-card';
  if (intent === 'discussion-prompt' || intent === 'question') return 'prompt-card';
  if (intent === 'answer-reveal') return 'question-reveal-pair';
  if (intent === 'guided-example') return 'guided-example-steps';
  if (screen.learnerContent.questions.length > 1) return 'prompt-card';
  return 'activity-board';
};

const DEFAULT_TITLE_BY_INTENT: Record<SemanticSlideIntent, string> = {
  'title-context': 'Lesson Context',
  'learning-targets': 'Learning Targets',
  'prior-knowledge': 'Prior Knowledge',
  'discussion-prompt': 'Discussion Prompt',
  'activity-board': 'Learning Task',
  'evidence-capture': 'Evidence Record',
  'guided-example': 'Guided Example',
  'comparison-matrix': 'Compare Ideas',
  'process-flow': 'Learning Sequence',
  question: 'Question',
  'answer-reveal': 'Review the Answer',
  'exit-ticket': 'Exit Response',
  'wrap-up': 'Wrap-Up',
};

const buildLearnerFacingTitle = (
  sourceTitle: string,
  intent: SemanticSlideIntent,
  continuation: boolean,
): string => {
  const normalized = normalizeText(sourceTitle);
  const base = normalized.length <= 52 ? normalized : DEFAULT_TITLE_BY_INTENT[intent];
  if (!continuation) return base || DEFAULT_TITLE_BY_INTENT[intent];
  const continuationBase = base.length <= 38 ? base : DEFAULT_TITLE_BY_INTENT[intent];
  return `${continuationBase || DEFAULT_TITLE_BY_INTENT[intent]} (continued)`;
};

const buildSlotsForScreen = (screen: StoryboardScreen): Record<string, SlideSlotValue> => {
  const prompt = normalizeText(screen.learnerContent.prompt ?? '');
  const task = normalizeText(screen.learnerContent.task ?? '');
  const questions = screen.learnerContent.questions.map(normalizeText).filter(Boolean);
  const directions = screen.learnerContent.directions.map(normalizeText).filter(Boolean);
  const body = uniqueNormalized([prompt, task, ...questions, ...directions]);
  const successCriteria = uniqueNormalized(screen.learnerContent.successCriteria);
  const successCriteriaSet = new Set(successCriteria);
  const requirementKindsByContent = new Map<string, Set<'Evidence' | 'Output'>>();
  for (const [kind, items] of [
    ['Evidence', screen.requiredEvidence],
    ['Output', screen.requiredOutputs],
  ] as const) {
    for (const item of items) {
      const content = normalizeLearnerFacingRequirement(item);
      if (!content) continue;
      const kinds = requirementKindsByContent.get(content) ?? new Set<'Evidence' | 'Output'>();
      kinds.add(kind);
      requirementKindsByContent.set(content, kinds);
    }
  }
  const requirementContent = [...requirementKindsByContent.keys()];
  const requirements = requirementContent.map((content) => {
    const kinds = requirementKindsByContent.get(content);
    const labels = [
      kinds?.has('Evidence') ? 'Evidence' : '',
      kinds?.has('Output') ? 'output' : '',
      successCriteriaSet.has(content) ? 'success criterion' : '',
    ].filter(Boolean);
    const label = labels.join('/');
    return `${label}: ${content}`;
  });
  const requirementContentSet = new Set(requirementContent);
  const compactBody = body.filter((item) => (
    !requirementContentSet.has(item) && !successCriteriaSet.has(item)
  ));
  const compactSuccessCriteria = successCriteria.filter((item) => !requirementContentSet.has(item));

  return {
    title: { kind: 'text', text: normalizeText(screen.learnerTitle) },
    body: { kind: 'list', items: compactBody },
    requirements: { kind: 'list', items: requirements },
    successCriteria: { kind: 'list', items: compactSuccessCriteria },
  };
};

type ContinuationSlotName = 'body' | 'requirements' | 'successCriteria';

type ContinuationItem = {
  slotName: ContinuationSlotName;
  text: string;
};

const getListSlotItems = (
  slots: Record<string, SlideSlotValue>,
  slotName: ContinuationSlotName,
): string[] => {
  const slot = slots[slotName];
  return slot?.kind === 'list' ? [...slot.items] : [];
};

const hasContinuationContent = (spec: SemanticSlideSpec): boolean => (
  (['body', 'requirements', 'successCriteria'] as const)
    .some((slotName) => getListSlotItems(spec.slots, slotName).length > 0)
);

const appendContinuationItem = (
  spec: SemanticSlideSpec,
  item: ContinuationItem,
): SemanticSlideSpec => ({
  ...spec,
  slots: {
    ...spec.slots,
    [item.slotName]: {
      kind: 'list',
      items: [...getListSlotItems(spec.slots, item.slotName), item.text],
    },
  },
});

const emptyContinuationSpec = (
  spec: SemanticSlideSpec,
  sourceTitle: string,
  continuation: boolean,
): SemanticSlideSpec => ({
  ...spec,
  slots: {
    ...spec.slots,
    title: { kind: 'text', text: buildLearnerFacingTitle(sourceTitle, spec.intent, continuation) },
    body: { kind: 'list', items: [] },
    requirements: { kind: 'list', items: [] },
    successCriteria: { kind: 'list', items: [] },
  },
});

const largestFittingPrefix = (
  spec: SemanticSlideSpec,
  item: ContinuationItem,
): { fitted: string; remainder: string } => {
  const words = item.text.split(/\s+/).filter(Boolean);
  let low = 1;
  let high = words.length;
  let fittedWordCount = 0;

  while (low <= high) {
    const midpoint = Math.floor((low + high) / 2);
    const candidate = appendContinuationItem(spec, { ...item, text: words.slice(0, midpoint).join(' ') });
    if (doesSemanticSlideSpecFitScene(candidate)) {
      fittedWordCount = midpoint;
      low = midpoint + 1;
    } else {
      high = midpoint - 1;
    }
  }

  return {
    fitted: words.slice(0, fittedWordCount).join(' '),
    remainder: words.slice(fittedWordCount).join(' '),
  };
};

const splitDenseSemanticSpec = (
  baseSpec: SemanticSlideSpec,
  sourceTitle: string,
): SemanticSlideSpec[] => {
  const contentItems = (['body', 'requirements', 'successCriteria'] as const)
    .flatMap((slotName): ContinuationItem[] => getListSlotItems(baseSpec.slots, slotName)
      .map((text) => ({ slotName, text })));
  let current = emptyContinuationSpec(baseSpec, sourceTitle, false);
  const pages: SemanticSlideSpec[] = [];

  const startNextPage = (): void => {
    if (hasContinuationContent(current)) pages.push(current);
    current = emptyContinuationSpec(baseSpec, sourceTitle, pages.length > 0);
  };

  for (const contentItem of contentItems) {
    let remaining = contentItem.text;
    while (remaining) {
      const candidate = appendContinuationItem(current, { ...contentItem, text: remaining });
      if (doesSemanticSlideSpecFitScene(candidate)) {
        current = candidate;
        remaining = '';
        continue;
      }

      if (hasContinuationContent(current)) {
        startNextPage();
        continue;
      }

      const split = largestFittingPrefix(current, { ...contentItem, text: remaining });
      if (!split.fitted) {
        current = candidate;
        remaining = '';
        continue;
      }
      current = appendContinuationItem(current, { ...contentItem, text: split.fitted });
      remaining = split.remainder;
      if (remaining) startNextPage();
    }
  }

  if (hasContinuationContent(current) || pages.length === 0) pages.push(current);
  return pages;
};

export const validateSemanticSlideSpecs = (
  specs: readonly SemanticSlideSpec[],
  storyboard: TeachingStoryboard,
): SemanticSlideDiagnostic[] => {
  const diagnostics: SemanticSlideDiagnostic[] = [];
  const screensById = new Map(storyboard.screens.map((screen) => [screen.id, screen] as const));
  const screenOrder = new Map(storyboard.screens.map((screen, index) => [screen.id, index] as const));
  const coveredScreenIds = new Set<string>();
  let previousScreenIndex = -1;
  let previousScreenId: string | null = null;

  for (const spec of specs) {
    const screen = screensById.get(spec.storyboardScreenId);
    const currentScreenIndex = screenOrder.get(spec.storyboardScreenId);
    if (!screen || typeof currentScreenIndex !== 'number') {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_storyboard_mapping_invalid',
        `Semantic slide ${spec.id} references a storyboard screen that does not exist.`,
        { specId: spec.id, storyboardScreenId: spec.storyboardScreenId },
      ));
      continue;
    }

    if (currentScreenIndex < previousScreenIndex) {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_storyboard_mapping_invalid',
        `Semantic slide ${spec.id} appears out of storyboard screen order.`,
        { specId: spec.id, storyboardScreenId: spec.storyboardScreenId },
      ));
    }

    if (currentScreenIndex === previousScreenIndex && previousScreenId !== spec.storyboardScreenId) {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_storyboard_mapping_invalid',
        `Semantic slide ${spec.id} duplicates a non-adjacent storyboard screen mapping.`,
        { specId: spec.id, storyboardScreenId: spec.storyboardScreenId },
      ));
    }

    previousScreenIndex = Math.max(previousScreenIndex, currentScreenIndex);
    previousScreenId = spec.storyboardScreenId;
    coveredScreenIds.add(spec.storyboardScreenId);

    if (!arraysEqual(spec.sourceStepIds, screen.sourceStepIds)) {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_source_step_mismatch',
        `Semantic slide ${spec.id} does not preserve source-step ownership from storyboard screen ${screen.id}.`,
        { specId: spec.id, storyboardScreenId: screen.id },
      ));
    }

    if (!arraysEqual(spec.sourceObjectiveIds, screen.sourceObjectiveIds)) {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_objective_mismatch',
        `Semantic slide ${spec.id} does not preserve source-objective ownership from storyboard screen ${screen.id}.`,
        { specId: spec.id, storyboardScreenId: screen.id },
      ));
    }

    if (!SEMANTIC_LAYOUT_IDS.has(spec.layoutId)) {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_layout_unsupported',
        `Semantic slide ${spec.id} uses unsupported layout ${spec.layoutId}.`,
        { specId: spec.id, storyboardScreenId: screen.id },
      ));
    }

  }

  for (const screen of storyboard.screens) {
    if (!coveredScreenIds.has(screen.id)) {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_storyboard_mapping_invalid',
        `Storyboard screen ${screen.id} is not represented by a semantic slide spec.`,
        { storyboardScreenId: screen.id },
      ));
    }
  }

  const instructional = specs.filter((spec) => spec.intent !== 'title-context');
  if (instructional.length > 0) {
    const semanticCount = instructional.filter((spec) => spec.layoutId !== 'generic-bullets').length;
    if (semanticCount / instructional.length < 0.8) {
      diagnostics.push(semanticDiagnostic(
        'semantic_spec_generic_layout_coverage_low',
        'Fewer than 80 percent of non-title instructional semantic slides use bounded semantic layouts.',
      ));
    }
  }

  return diagnostics;
};

export const buildSemanticSlideSpecs = (storyboard: TeachingStoryboard): SemanticSlideSpecResult => {
  let specNumber = 1;
  const specs = storyboard.screens.flatMap((screen): SemanticSlideSpec[] => {
    const intent = inferSemanticIntent(screen);
    const baseSpec: SemanticSlideSpec = {
      contractVersion: SEMANTIC_SLIDE_SPEC_VERSION,
      id: 'semslide-pending',
      unitId: screen.unitId,
      storyboardScreenId: screen.id,
      sourceStepIds: [...screen.sourceStepIds],
      sourceObjectiveIds: [...screen.sourceObjectiveIds],
      intent,
      layoutId: selectLayoutId(intent, screen),
      slots: buildSlotsForScreen(screen),
      assetRequests: [],
      speakerNotes: screen.teacherNotes,
      accessibility: {
        readingOrder: ['title', 'body', 'requirements', 'successCriteria'],
        slidePurpose: screen.instructionalPurpose,
      },
    };
    return splitDenseSemanticSpec(baseSpec, screen.learnerTitle).map((spec) => ({
      ...spec,
      id: `semslide-${String(specNumber++).padStart(3, '0')}`,
    }));
  });

  const diagnostics = validateSemanticSlideSpecs(specs, storyboard);
  if (hasBlockingSemanticSlideDiagnostics(diagnostics)) return { ok: false, diagnostics };
  return { ok: true, specs };
};

export const resolveSemanticScenePresentationForGeneration = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  flagValue: unknown,
  storyboard: TeachingStoryboard | null,
  options: {
    title: string;
    selectedUnitLabel?: string;
  },
): SemanticScenePresentationBoundary => {
  if (!isSemanticSlidesV1Enabled(flagValue) || policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, presentation: null };
  }

  if (!storyboard) {
    const diagnostics: SemanticSlideDiagnostic[] = [{
      code: 'semantic_spec_contract_invalid',
      severity: 'blocking',
      message: 'Missing source-bound teaching storyboard.',
    }];
    return {
      ok: false,
      message: 'The uploaded source was not converted into a teaching storyboard before semantic slide compilation.',
      diagnostics,
    };
  }

  const specsResult = buildSemanticSlideSpecs(storyboard);
  if (specsResult.ok === false) {
    return {
      ok: false,
      message: formatSemanticSlideDiagnostics(specsResult.diagnostics),
      diagnostics: specsResult.diagnostics,
    };
  }

  const sceneResult = compileSemanticSlideSpecsToScenes(specsResult.specs, options);
  if (sceneResult.ok === false) {
    return {
      ok: false,
      message: formatSceneValidationDiagnostics(sceneResult.diagnostics),
      diagnostics: sceneResult.diagnostics,
    };
  }

  return { ok: true, presentation: sceneResult.presentation };
};
