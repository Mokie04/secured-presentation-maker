import type {
  CompiledScenePresentation,
  CompiledSlideScene,
  SceneElement,
} from './compiledSlideScene.ts';
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import {
  classifySourceContent,
  type SourceDispositionDecision,
} from './sourceContentDisposition.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';
import type {
  VisualGrammar,
  VisualTeachingPlan,
  VisualTeachingScene,
} from './visualTeachingPlan.ts';
import { validateVisualTeachingPlan } from './visualTeachingPlan.ts';

export const PRESENTATION_QUALITY_VERSION = 'presentation-quality-v1';

export type PresentationQualityDiagnosticCode =
  | 'quality_visual_plan_invalid'
  | 'quality_planning_label_visible'
  | 'quality_reference_dump'
  | 'quality_paragraph_dump'
  | 'quality_assessment_unparsed'
  | 'quality_generic_title_repeated'
  | 'quality_relationship_prose_only'
  | 'quality_meaningful_visual_grammar_low'
  | 'quality_explanatory_structure_low'
  | 'quality_plain_title_body_high';

export type PresentationQualityDiagnostic = {
  code: PresentationQualityDiagnosticCode;
  severity: 'blocking';
  message: string;
  sceneId?: string;
  semanticSlideSpecId?: string;
  elementId?: string;
};

export type PresentationQualityReport = {
  contractVersion: typeof PRESENTATION_QUALITY_VERSION;
  instructionalSlideCount: number;
  meaningfulVisualGrammarRatio: number;
  explanatoryStructureRatio: number;
  plainTitleBodyRatio: number;
  planningLabelViolationCount: number;
  referenceDumpCount: number;
  paragraphDumpCount: number;
  unparsedAssessmentCount: number;
  repeatedGenericTitleCount: number;
  proseOnlyRelationshipCount: number;
  diagnostics: PresentationQualityDiagnostic[];
};

export type PresentationQualityValidationInput = {
  sourceManifest: LessonSourceManifest;
  storyboard: TeachingStoryboard;
  visualTeachingPlan: VisualTeachingPlan;
  semanticSpecs: readonly SemanticSlideSpec[];
  presentation: CompiledScenePresentation;
};

export type PresentationQualityValidationResult = {
  ok: boolean;
  report: PresentationQualityReport;
  diagnostics: PresentationQualityDiagnostic[];
};

type VisibleTextUnit = {
  elementId: string;
  text: string;
  role?: string;
};

type InstructionalSlide = {
  scene: CompiledSlideScene;
  spec?: SemanticSlideSpec;
  planScene?: VisualTeachingScene;
  grammar?: VisualGrammar;
  visibleText: VisibleTextUnit[];
};

const EXPLANATORY_GRAMMARS: ReadonlySet<VisualGrammar> = new Set([
  'concept-map',
  'relationship-diagram',
  'process-flow',
  'comparison-panels',
  'classification-map',
  'timeline',
  'data-table',
  'worked-example',
  'question-choices',
  'evidence-board',
]);

const GENERIC_TITLES = new Set([
  'activity',
  'assessment',
  'check',
  'discussion',
  'exercise',
  'learning target',
  'learning task',
  'lesson',
  'practice',
  'prompt',
  'question',
  'review',
  'task',
]);

const REFERENCE_LABEL_PATTERN = /^(?:(?:learning|supporting)\s+)?(?:references?|resources?|materials?|sources?|mga\s+(?:sanggunian|kagamitan|mapagkukunan)|sanggunian|kagamitan|mapagkukunan)(?:\s*[(:\-]|$)/i;
const ADMINISTRATIVE_LABEL_PATTERN = /^(?:declaration\s+of\s+ai\s+use|teacher\s+preparation|administrative\s+notes?|learner\s+context|observations?\s+of\s+learners|ways\s+forward|intentions?|duration|time\s+allotment|remarks?|planning\s+notes?|teacher(?:'s)?\s+(?:actions?|activity|notes?|resources?|materials?)|deklarasyon\s+ng\s+paggamit\s+ng\s+ai|paghahanda\s+ng\s+guro|mga\s+tala\s+ng\s+administrasyon|talang\s+administratibo|konteksto\s+ng\s+(?:mga\s+)?mag-aaral|mga\s+obserbasyon\s+sa\s+mga\s+mag-aaral|mga\s+susunod\s+na\s+hakbang|mga\s+intensiyon)(?:\s*[(:\-]|$)/i;
const REFERENCE_SOURCE_PATTERN = /\b(?:references?|resources?|materials?|books?|websites?|toolkits?|sources?|sanggunian|kagamitan|mapagkukunan)\b/i;
const REFERENCE_ACTION_PATTERN = /\b(?:use|consult|compare|evaluate|analy[sz]e|examine|read|cite|verify|select|review|refer\s+to|gamitin|sumangguni|ihambing|suriin|sipiin)\b/i;
const CLOSE_READING_SOURCE_PATTERN = /\b(?:close\s+reading|passage|quotation|quote|excerpt|primary\s+source|source\s+text|text\s+selection)\b/i;
const RELATIONSHIP_SOURCE_PATTERN = /\b(?:relationship|cause|effect|compare|contrast|sequence|process|flow|cycle|depends?|increase|decrease|change)\b/i;

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizePlanningLabelPunctuation = (value: string): string => value
  .normalize('NFKC')
  .replace(/[\u2018\u2019\u02bc]/g, "'")
  .replace(/[\u2010-\u2015\u2212\ufe58\ufe63\uff0d]/g, '-');

const diagnostic = (
  code: PresentationQualityDiagnosticCode,
  message: string,
  detail: Pick<PresentationQualityDiagnostic, 'sceneId' | 'semanticSlideSpecId' | 'elementId'> = {},
): PresentationQualityDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  ...detail,
});

const visibleTextUnits = (element: SceneElement): VisibleTextUnit[] => {
  if (element.kind === 'text') {
    const text = normalizeText(element.runs.map((run) => run.text).join(''));
    return text ? [{ elementId: element.id, text, role: element.role }] : [];
  }
  if (element.kind !== 'table') return [];

  return [
    ...element.headers.map((text, index) => ({
      elementId: `${element.id}:header:${index}`,
      text: normalizeText(text),
      role: 'table-header',
    })),
    ...element.rows.flatMap((row, rowIndex) => row.map((text, columnIndex) => ({
      elementId: `${element.id}:cell:${rowIndex}:${columnIndex}`,
      text: normalizeText(text),
      role: 'table-cell',
    }))),
  ].filter((unit) => Boolean(unit.text));
};

const sourceIdsForScene = (scene: VisualTeachingScene): string[] => [
  ...scene.sourceStepIds,
  ...scene.sourceObjectiveIds,
  ...scene.sourceFieldIds,
];

const sourceLabelsForScene = (
  dispositions: readonly SourceDispositionDecision[],
  scene: VisualTeachingScene | undefined,
): string[] => {
  if (!scene) return [];
  const sourceIds = new Set(sourceIdsForScene(scene));
  return dispositions
    .filter((entry) => sourceIds.has(entry.sourceId) && entry.disposition === 'learner-visible')
    .map((entry) => entry.sourceLabel);
};

const buildInstructionalSlides = (input: PresentationQualityValidationInput): InstructionalSlide[] => {
  const specById = new Map(input.semanticSpecs.map((spec) => [spec.id, spec] as const));
  const planSceneById = new Map(input.visualTeachingPlan.scenes.map((scene) => [scene.id, scene] as const));

  return input.presentation.scenes.map((scene) => {
    const spec = specById.get(scene.semanticSlideSpecId);
    const planScene = spec?.visualTeachingSceneId
      ? planSceneById.get(spec.visualTeachingSceneId)
      : undefined;
    return {
      scene,
      spec,
      planScene,
      grammar: planScene?.visualGrammar,
      visibleText: scene.elements.flatMap(visibleTextUnits),
    };
  });
};

const isDecorativeShape = (element: SceneElement): boolean => (
  element.kind === 'shape'
  && (element.id.endsWith('-bg') || element.id.endsWith('-title-band'))
);

const elementCount = (
  scene: CompiledSlideScene,
  predicate: (element: SceneElement) => boolean,
): number => scene.elements.filter(predicate).length;

const idIncludes = (element: SceneElement, token: string): boolean => element.id.includes(token);

const hasBoundedImage = (scene: CompiledSlideScene): boolean => scene.elements.some((element) => (
  element.kind === 'image'
  && element.frame.x >= 0
  && element.frame.y >= 0
  && element.frame.x + element.frame.w <= scene.size.width
  && element.frame.y + element.frame.h <= scene.size.height
  && element.frame.w * element.frame.h < scene.size.width * scene.size.height
));

const hasRelationshipStructure = (scene: CompiledSlideScene): boolean => (
  elementCount(scene, (element) => element.kind === 'shape' && !isDecorativeShape(element)) >= 2
  && elementCount(scene, (element) => element.kind === 'connector') >= 1
  && elementCount(scene, (element) => element.kind === 'text' && element.role === 'label') >= 2
);

const hasProcessStructure = (scene: CompiledSlideScene): boolean => (
  elementCount(scene, (element) => element.kind === 'shape' && idIncludes(element, '-step-card-')) >= 2
  && elementCount(scene, (element) => element.kind === 'text' && idIncludes(element, '-step-text-')) >= 2
  && elementCount(scene, (element) => element.kind === 'connector') >= 1
);

const hasComparisonStructure = (scene: CompiledSlideScene): boolean => (
  scene.elements.some((element) => element.kind === 'table')
  || (
    elementCount(scene, (element) => element.kind === 'shape' && idIncludes(element, '-panel-')) >= 2
    && elementCount(scene, (element) => (
      element.kind === 'text'
      && (idIncludes(element, '-panel-title-') || idIncludes(element, '-panel-body-'))
    )) >= 2
  )
);

const hasQuestionChoiceStructure = (scene: CompiledSlideScene): boolean => (
  elementCount(scene, (element) => element.kind === 'shape' && idIncludes(element, '-choice-card-')) >= 2
  && elementCount(scene, (element) => element.kind === 'text' && idIncludes(element, '-choice-text-')) >= 2
);

const hasEvidenceStructure = (scene: CompiledSlideScene): boolean => (
  scene.elements.some((element) => element.kind === 'table')
  || (
    elementCount(scene, (element) => (
      element.kind === 'shape'
      && (idIncludes(element, '-requirement-card') || idIncludes(element, '-evidence-card'))
    )) >= 1
    && elementCount(scene, (element) => (
      element.kind === 'text'
      && (idIncludes(element, '-requirement') || idIncludes(element, '-evidence'))
    )) >= 1
  )
);

const hasWorkedExampleStructure = (scene: CompiledSlideScene): boolean => (
  elementCount(scene, (element) => element.kind === 'shape' && idIncludes(element, '-step-card-')) >= 2
  && elementCount(scene, (element) => element.kind === 'text' && idIncludes(element, '-step-text-')) >= 2
);

const hasVisualThesisStructure = (scene: CompiledSlideScene): boolean => (
  scene.elements.some((element) => element.kind === 'shape' && idIncludes(element, '-thesis-card'))
  && scene.elements.some((element) => element.kind === 'text' && idIncludes(element, '-thesis-statement'))
);

const hasActivityBoardStructure = (scene: CompiledSlideScene): boolean => (
  scene.elements.some((element) => element.kind === 'shape' && idIncludes(element, '-task-card'))
  && scene.elements.some((element) => element.kind === 'text' && idIncludes(element, '-task'))
);

const hasConcreteGrammarStructure = (slide: InstructionalSlide): boolean => {
  switch (slide.grammar) {
    case 'concept-map':
    case 'relationship-diagram':
      return hasRelationshipStructure(slide.scene);
    case 'process-flow':
    case 'timeline':
      return hasProcessStructure(slide.scene);
    case 'comparison-panels':
    case 'classification-map':
      return hasComparisonStructure(slide.scene);
    case 'data-table':
      return slide.scene.elements.some((element) => element.kind === 'table');
    case 'worked-example':
      return hasWorkedExampleStructure(slide.scene);
    case 'activity-board':
      return hasActivityBoardStructure(slide.scene);
    case 'question-choices':
      return hasQuestionChoiceStructure(slide.scene);
    case 'evidence-board':
      return hasEvidenceStructure(slide.scene);
    case 'visual-thesis':
      return hasVisualThesisStructure(slide.scene);
    case 'image-led-explanation':
      return hasBoundedImage(slide.scene) || hasVisualThesisStructure(slide.scene);
    case 'minimal-statement':
    default:
      return false;
  }
};

const normalizedGenericTitle = (title: string): string => normalizeText(title)
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[—–]/g, '-')
  .replace(/\s*[-:]\s*(?:answer|prompt|reveal)\s*$/g, '')
  .replace(/\s*\((?:continued|cont\.?|part\s+\d+)\)\s*$/g, '')
  .replace(/\s+(?:continued|cont\.?|part\s+\d+)\s*$/g, '')
  .replace(/\s+\d+\s*$/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const titleUnit = (slide: InstructionalSlide): VisibleTextUnit | undefined => (
  slide.visibleText.find((unit) => unit.role === 'title')
);

const isDeliberatePromptRevealPair = (slides: readonly InstructionalSlide[]): boolean => {
  if (slides.length !== 2) return false;
  const prompt = slides.find((slide) => slide.spec?.intent === 'question' || slide.spec?.intent === 'discussion-prompt');
  const reveal = slides.find((slide) => slide.spec?.intent === 'answer-reveal');
  if (!prompt?.spec || !reveal?.spec || prompt.spec.unitId !== reveal.spec.unitId) return false;
  const promptScreens = new Set(prompt.spec.storyboardScreenIds);
  return reveal.spec.storyboardScreenIds.some((screenId) => promptScreens.has(screenId));
};

const hasOrderedChoiceRun = (text: string): boolean => {
  const markers = [...text.matchAll(/(?:^|[\s(])([A-H])[.)](?=\s|$)/gi)]
    .map((match) => match[1].toUpperCase().charCodeAt(0));
  let longestRun = 0;
  let currentRun = 0;
  let previous = -1;
  for (const marker of markers) {
    currentRun = marker === previous + 1 ? currentRun + 1 : 1;
    previous = marker;
    longestRun = Math.max(longestRun, currentRun);
  }
  return longestRun >= 3;
};

const ratio = (count: number, total: number): number => total === 0 ? 0 : count / total;

export const validatePresentationQuality = (
  input: PresentationQualityValidationInput,
): PresentationQualityValidationResult => {
  const slides = buildInstructionalSlides(input);
  const diagnostics: PresentationQualityDiagnostic[] = [];
  const dispositionResult = classifySourceContent(input.sourceManifest, input.storyboard);
  let trustedDispositions: readonly SourceDispositionDecision[] = [];
  if (dispositionResult.ok === false) {
    diagnostics.push(diagnostic(
      'quality_visual_plan_invalid',
      `Visual teaching source classification failed: ${dispositionResult.diagnostics.map((item) => item.code).join(', ')}.`,
    ));
  } else {
    const planDiagnostics = validateVisualTeachingPlan(
      input.visualTeachingPlan,
      input.sourceManifest,
      input.storyboard,
      dispositionResult.decisions,
    ).filter((item) => item.severity === 'blocking');
    if (planDiagnostics.length > 0) {
      diagnostics.push(diagnostic(
        'quality_visual_plan_invalid',
        `Visual teaching plan revalidation failed: ${planDiagnostics.map((item) => item.code).join(', ')}.`,
      ));
    } else {
      trustedDispositions = dispositionResult.decisions;
    }
  }
  let planningLabelViolationCount = 0;
  let paragraphDumpCount = 0;
  let unparsedAssessmentCount = 0;

  const referenceDumpSceneIds = new Set<string>();
  for (const slide of slides) {
    const sourceLabels = sourceLabelsForScene(trustedDispositions, slide.planScene);
    const allVisibleText = slide.visibleText.map((unit) => unit.text).join(' ');
    const referencesAuthorized = sourceLabels.some((label) => REFERENCE_SOURCE_PATTERN.test(label))
      && REFERENCE_SOURCE_PATTERN.test(allVisibleText)
      && REFERENCE_ACTION_PATTERN.test(allVisibleText);
    const closeReadingAuthorized = sourceLabels.some((label) => CLOSE_READING_SOURCE_PATTERN.test(label));

    for (const unit of slide.visibleText) {
      const planningLabelText = normalizePlanningLabelPunctuation(unit.text);
      const referenceLabelVisible = REFERENCE_LABEL_PATTERN.test(planningLabelText);
      const administrativeLabelVisible = ADMINISTRATIVE_LABEL_PATTERN.test(planningLabelText);
      if (administrativeLabelVisible || (referenceLabelVisible && !referencesAuthorized)) {
        planningLabelViolationCount += 1;
        diagnostics.push(diagnostic(
          'quality_planning_label_visible',
          `Compiled scene ${slide.scene.id} exposes a planning-only label in learner-visible content.`,
          {
            sceneId: slide.scene.id,
            semanticSlideSpecId: slide.spec?.id,
            elementId: unit.elementId,
          },
        ));
      }
      if (referenceLabelVisible && !referencesAuthorized) {
        referenceDumpSceneIds.add(slide.scene.id);
      }

      if (unit.text.length > 360 && !closeReadingAuthorized) {
        paragraphDumpCount += 1;
        diagnostics.push(diagnostic(
          'quality_paragraph_dump',
          `Compiled scene ${slide.scene.id} contains a visible text element over the 360-character copy budget.`,
          {
            sceneId: slide.scene.id,
            semanticSlideSpecId: slide.spec?.id,
            elementId: unit.elementId,
          },
        ));
      }

      if (hasOrderedChoiceRun(unit.text)) {
        unparsedAssessmentCount += 1;
        diagnostics.push(diagnostic(
          'quality_assessment_unparsed',
          `Compiled scene ${slide.scene.id} contains unparsed ordered answer choices in one visible element.`,
          {
            sceneId: slide.scene.id,
            semanticSlideSpecId: slide.spec?.id,
            elementId: unit.elementId,
          },
        ));
      }
    }
  }

  for (const sceneId of referenceDumpSceneIds) {
    const slide = slides.find((candidate) => candidate.scene.id === sceneId);
    diagnostics.push(diagnostic(
      'quality_reference_dump',
      `Compiled scene ${sceneId} exposes references or resources without a source-authorized learner use.`,
      { sceneId, semanticSlideSpecId: slide?.spec?.id },
    ));
  }

  const genericTitleGroups = new Map<string, InstructionalSlide[]>();
  for (const slide of slides) {
    const title = titleUnit(slide);
    if (!title) continue;
    const normalized = normalizedGenericTitle(title.text);
    if (!GENERIC_TITLES.has(normalized)) continue;
    const group = genericTitleGroups.get(normalized) ?? [];
    group.push(slide);
    genericTitleGroups.set(normalized, group);
  }
  const repeatedGenericGroups = [...genericTitleGroups.entries()]
    .filter(([, group]) => group.length > 1 && !isDeliberatePromptRevealPair(group));
  for (const [title, group] of repeatedGenericGroups) {
    diagnostics.push(diagnostic(
      'quality_generic_title_repeated',
      `Generic learner title "${title}" is repeated without a deliberate prompt/reveal relationship.`,
      {
        sceneId: group[1].scene.id,
        semanticSlideSpecId: group[1].spec?.id,
        elementId: titleUnit(group[1])?.elementId,
      },
    ));
  }

  const proseOnlyRelationshipSlides = slides.filter((slide) => {
    const sourceLabels = sourceLabelsForScene(trustedDispositions, slide.planScene);
    return sourceLabels.some((label) => RELATIONSHIP_SOURCE_PATTERN.test(label))
      && (!slide.grammar
        || !EXPLANATORY_GRAMMARS.has(slide.grammar)
        || !hasConcreteGrammarStructure(slide));
  });
  for (const slide of proseOnlyRelationshipSlides) {
    diagnostics.push(diagnostic(
      'quality_relationship_prose_only',
      `Compiled scene ${slide.scene.id} leaves a source-required relationship in prose-only form.`,
      { sceneId: slide.scene.id, semanticSlideSpecId: slide.spec?.id },
    ));
  }

  const instructionalSlideCount = slides.length;
  const meaningfulVisualGrammarRatio = ratio(
    slides.filter(hasConcreteGrammarStructure).length,
    instructionalSlideCount,
  );
  const explanatoryStructureRatio = ratio(
    slides.filter((slide) => Boolean(
      slide.grammar
      && EXPLANATORY_GRAMMARS.has(slide.grammar)
      && hasConcreteGrammarStructure(slide)
    )).length,
    instructionalSlideCount,
  );
  const plainTitleBodyRatio = ratio(
    slides.filter((slide) => !hasConcreteGrammarStructure(slide)).length,
    instructionalSlideCount,
  );

  if (meaningfulVisualGrammarRatio < 0.75) {
    diagnostics.push(diagnostic(
      'quality_meaningful_visual_grammar_low',
      'Fewer than 75% of instructional slides use meaningful visual grammar.',
    ));
  }
  if (explanatoryStructureRatio < 0.40) {
    diagnostics.push(diagnostic(
      'quality_explanatory_structure_low',
      'Fewer than 40% of instructional slides use explanatory visual structure.',
    ));
  }
  if (plainTitleBodyRatio > 0.25) {
    diagnostics.push(diagnostic(
      'quality_plain_title_body_high',
      'More than 25% of instructional slides use a plain title-and-body layout.',
    ));
  }

  const report: PresentationQualityReport = {
    contractVersion: PRESENTATION_QUALITY_VERSION,
    instructionalSlideCount,
    meaningfulVisualGrammarRatio,
    explanatoryStructureRatio,
    plainTitleBodyRatio,
    planningLabelViolationCount,
    referenceDumpCount: referenceDumpSceneIds.size,
    paragraphDumpCount,
    unparsedAssessmentCount,
    repeatedGenericTitleCount: repeatedGenericGroups.length,
    proseOnlyRelationshipCount: proseOnlyRelationshipSlides.length,
    diagnostics,
  };

  return {
    ok: diagnostics.length === 0,
    report,
    diagnostics,
  };
};
