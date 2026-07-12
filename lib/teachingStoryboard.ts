import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import type {
  LessonSourceManifest,
  SourceDiagnosticSeverity,
  SourceField,
  SourceFieldState,
  SourceObjective,
  SourceStep,
  SourceUnit,
} from './lessonSourceManifest.ts';

export const TEACHING_STORYBOARD_VERSION = 'teaching-storyboard-v1';

export type StoryboardDiagnosticSeverity = SourceDiagnosticSeverity;

export type StoryboardDiagnosticCode =
  | 'storyboard_source_step_unaccounted'
  | 'storyboard_foreign_source_step'
  | 'storyboard_order_inversion'
  | 'storyboard_teacher_script_visible'
  | 'storyboard_objective_mismatch'
  | 'storyboard_required_evidence_missing'
  | 'storyboard_required_output_missing'
  | 'storyboard_blank_field_invented'
  | 'storyboard_contract_invalid';

export type StoryboardAccountingStatus =
  | 'screened'
  | 'teacher-notes'
  | 'metadata'
  | 'blank-preserved'
  | 'intentionally-omitted';

export type StoryboardCommunicationIntent =
  | 'learning-target'
  | 'prior-knowledge'
  | 'discussion-prompt'
  | 'activity-task'
  | 'evidence-capture'
  | 'guided-example'
  | 'question'
  | 'answer-reveal'
  | 'exit-ticket'
  | 'teacher-note';

export type StructuredLearnerContent = {
  prompt?: string;
  task?: string;
  questions: string[];
  directions: string[];
  successCriteria: string[];
  expectedOutput?: string;
};

export type StoryboardObjective = {
  id: string;
  sourceObjectiveId: string;
  unitId: string;
  sourceOrder: number;
  learnerText: string;
};

export type StoryboardScreen = {
  id: string;
  unitId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  sourceFieldIds: string[];
  instructionalPurpose: string;
  learnerTitle: string;
  learnerContent: StructuredLearnerContent;
  teacherNotes: string;
  requiredEvidence: string[];
  requiredOutputs: string[];
  communicationIntent: StoryboardCommunicationIntent;
  pairId?: string;
  pairRole?: 'prompt' | 'reveal';
};

export type SourceStepAccountingEntry = {
  sourceStepId: string;
  unitId: string;
  screenIds: string[];
  status: StoryboardAccountingStatus;
};

export type SourceFieldAccountingEntry = {
  sourceFieldId: string;
  unitId: string;
  screenIds: string[];
  state: SourceFieldState;
  status: StoryboardAccountingStatus;
};

export type StoryboardDiagnostic = {
  code: StoryboardDiagnosticCode;
  severity: StoryboardDiagnosticSeverity;
  message: string;
  sourceStepId?: string;
  sourceObjectiveId?: string;
  screenId?: string;
};

export type TeachingStoryboard = {
  contractVersion: typeof TEACHING_STORYBOARD_VERSION;
  provenance: {
    sourceManifestVersion: LessonSourceManifest['contractVersion'];
    sourceHash: string;
    selectedUnitIds: string[];
  };
  objectives: StoryboardObjective[];
  screens: StoryboardScreen[];
  sourceStepAccounting: SourceStepAccountingEntry[];
  sourceFieldAccounting: SourceFieldAccountingEntry[];
  diagnostics: StoryboardDiagnostic[];
};

export type TeachingStoryboardResult =
  | { ok: true; storyboard: TeachingStoryboard }
  | { ok: false; diagnostics: StoryboardDiagnostic[] };

export type TeachingStoryboardGenerationBoundary =
  | { ok: true; storyboard: TeachingStoryboard | null }
  | { ok: false; message: string; diagnostics: StoryboardDiagnostic[] };

export type ExtractedSourceRequirements = {
  requiredEvidence: string[];
  requiredOutputs: string[];
};

type SourceFieldSelection = {
  sourceFieldId: string;
  unitId: string;
  field: SourceField;
};

export const VISIBLE_TEACHER_SCRIPT_PATTERN =
  /\b(?:the\s+teacher|teacher\s+will|teacher\s+asks?|teacher\s+shall|will\s+ask\s+(?:learners|students)|ask\s+(?:learners|students)\s+to|learners\s+will|students\s+will)\b/i;

const REQUIRED_EVIDENCE_PATTERN =
  /\b(?:evidence|record|reading|readings|measurement|measurements|data|claim|observation|observations|defend|support)\b/i;

const REQUIRED_OUTPUT_PATTERN =
  /\b(?:submit|output|exit\s+ticket|ticket|worksheet|response|answer|conclusion|reflection|assignment)\b/i;

const padId = (prefix: string, value: number): string => `${prefix}-${String(value).padStart(3, '0')}`;

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const PRESENT_TENSE_TEACHER_ACTIONS: Record<string, string> = {
  asks: 'Ask',
  checks: 'Check',
  clarifies: 'Clarify',
  demonstrates: 'Inspect',
  discusses: 'Discuss',
  explains: 'Explain',
  facilitates: 'Work through',
  guides: 'Complete',
  introduces: 'Explore',
  models: 'Explain',
  presents: 'Inspect',
  prompts: 'Respond to',
  restates: 'Restate',
  reviews: 'Review',
  shows: 'Inspect',
  supports: 'Use',
};

const PRESENT_TENSE_TEACHER_ACTION_PATTERN =
  /\b(?:the\s+)?teacher\s+(asks|checks|clarifies|demonstrates|discusses|explains|facilitates|guides|introduces|models|presents|prompts|restates|reviews|shows|supports)\s+([^.!?]+)([.!?]?)/gi;

const stripPresentTenseTeacherAction = (value: string): string => {
  let replaced = false;
  const rewritten = value.replace(
    PRESENT_TENSE_TEACHER_ACTION_PATTERN,
    (_match, verb: string, rest: string, punctuation: string) => {
      replaced = true;
      const learnerVerb = PRESENT_TENSE_TEACHER_ACTIONS[verb.toLowerCase()] ?? 'Complete';
      return `${learnerVerb} ${rest}${punctuation}`;
    },
  );

  return replaced ? normalizeText(rewritten) : value;
};

const stripTeacherScriptForVisibleText = (value: string): string => {
  const stripped = normalizeText(value)
    .replace(/^the\s+teacher\s+will\s+ask\s+(?:learners|students)\s+to\s+/i, '')
    .replace(/^the\s+teacher\s+asks?\s+(?:learners|students)\s+to\s+/i, '')
    .replace(/^(?:the\s+)?teacher\s+(?:will|shall)\s+(?:ask|guide|instruct|direct|prompt|invite|have|let|tell|support|encourage)\s+(?:the\s+)?(?:learners|students|class)\s+to\s+/i, '')
    .replace(/^(?:the\s+)?teacher\s+(?:will|shall)\s+(?:model|show|demonstrate)\s+how\s+(?:the\s+)?(?:learners|students)\s+/i, '')
    .replace(/^(?:the\s+)?teacher\s+(?:will|shall)\s+/i, '')
    .replace(/^ask\s+(?:the\s+)?(?:learners|students)\s+to\s+/i, '')
    .replace(/^(?:the\s+)?learners\s+will\s+/i, '')
    .replace(/^(?:the\s+)?students\s+will\s+/i, '')
    .replace(/\b(?:the\s+)?(?:learners|students)\s+will\s+/gi, 'you will ');

  return stripPresentTenseTeacherAction(stripped);
};

const normalizeVisibleText = (value: string): string => {
  const stripped = stripTeacherScriptForVisibleText(value);
  if (!stripped) return stripped;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
};

const getSelectedUnits = (manifest: LessonSourceManifest, selectedUnitIds?: readonly string[]): SourceUnit[] => {
  if (!selectedUnitIds || selectedUnitIds.length === 0) return manifest.units;
  const selected = new Set(selectedUnitIds);
  return manifest.units.filter((unit) => selected.has(unit.id));
};

const getSelectedSteps = (units: readonly SourceUnit[]): SourceStep[] => (
  units.flatMap((unit) => unit.steps).sort((a, b) => a.sourceOrder - b.sourceOrder)
);

const getSelectedObjectives = (manifest: LessonSourceManifest, units: readonly SourceUnit[]): SourceObjective[] => {
  const unitIds = new Set(units.map((unit) => unit.id));
  return manifest.objectives
    .filter((objective) => unitIds.has(objective.unitId))
    .sort((a, b) => a.sourceOrder - b.sourceOrder);
};

const getSelectedFields = (units: readonly SourceUnit[]): SourceFieldSelection[] => (
  units.flatMap((unit) => Object.values(unit.fields)
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((field) => ({
      sourceFieldId: `${unit.id}:${field.id}`,
      unitId: unit.id,
      field,
    })))
    .sort((a, b) => a.field.sourceOrder - b.field.sourceOrder)
);

const getVisibleStrings = (screen: StoryboardScreen): string[] => [
  screen.learnerTitle,
  screen.learnerContent.prompt ?? '',
  screen.learnerContent.task ?? '',
  ...screen.learnerContent.questions,
  ...screen.learnerContent.directions,
  ...screen.learnerContent.successCriteria,
  screen.learnerContent.expectedOutput ?? '',
].filter((value) => value.trim());

const getVisibleText = (screen: StoryboardScreen): string => getVisibleStrings(screen).join(' ');

const diagnostic = (
  code: StoryboardDiagnosticCode,
  message: string,
  detail: Pick<StoryboardDiagnostic, 'sourceStepId' | 'sourceObjectiveId' | 'screenId'> = {},
): StoryboardDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  ...detail,
});

export const hasBlockingStoryboardDiagnostics = (diagnostics: StoryboardDiagnostic[]): boolean => (
  diagnostics.some((item) => item.severity === 'blocking')
);

export const formatStoryboardDiagnostics = (diagnostics: StoryboardDiagnostic[]): string => {
  const blocking = diagnostics.filter((item) => item.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((item) => item.message).join(' ');
};

export const detectVisibleTeacherScript = (value: string): boolean => (
  VISIBLE_TEACHER_SCRIPT_PATTERN.test(value)
);

export const extractSourceRequirements = (step: SourceStep): ExtractedSourceRequirements => {
  const text = normalizeText(step.rawBlocks.join(' '));
  const learnerFacingText = normalizeVisibleText(text);
  return {
    requiredEvidence: REQUIRED_EVIDENCE_PATTERN.test(text) ? [learnerFacingText] : [],
    requiredOutputs: REQUIRED_OUTPUT_PATTERN.test(text) ? [learnerFacingText] : [],
  };
};

const inferCommunicationIntent = (step: SourceStep): StoryboardCommunicationIntent => {
  const label = step.sourceLabel.toLowerCase();
  const text = step.rawBlocks.join(' ').toLowerCase();
  const searchable = `${label} ${text}`;
  if (/\b(?:exit|evaluate|assessment|submit|ticket)\b/.test(searchable)) return 'exit-ticket';
  if (/\b(?:evidence|record|data|measurement|reading|observation)\b/.test(searchable)) return 'evidence-capture';
  if (/\b(?:question|ask|choose|predict)\b/.test(searchable)) return 'discussion-prompt';
  if (/\b(?:example|model|demonstrate)\b/.test(searchable)) return 'guided-example';
  return 'activity-task';
};

const buildLearnerTitle = (step: SourceStep): string => {
  const label = normalizeText(step.sourceLabel.replace(/\s*-\s*\d+\s*(?:min|mins|minutes)\b/i, ''));
  if (label) return normalizeVisibleText(label);
  return 'Learning Task';
};

const validateObjectiveMapping = (
  storyboard: TeachingStoryboard,
  selectedObjectives: readonly SourceObjective[],
  diagnostics: StoryboardDiagnostic[],
): void => {
  if (storyboard.objectives.length !== selectedObjectives.length) {
    diagnostics.push(diagnostic(
      'storyboard_objective_mismatch',
      'The storyboard objective count does not match the uploaded source objectives.',
    ));
    return;
  }

  for (let index = 0; index < selectedObjectives.length; index += 1) {
    const expected = selectedObjectives[index];
    const actual = storyboard.objectives[index];
    if (
      !actual
      || actual.sourceObjectiveId !== expected.id
      || actual.unitId !== expected.unitId
      || actual.sourceOrder !== expected.sourceOrder
    ) {
      diagnostics.push(diagnostic(
        'storyboard_objective_mismatch',
        'The storyboard objective order, identity, or owning unit does not match the uploaded source.',
        { sourceObjectiveId: expected.id },
      ));
      return;
    }
  }
};

const validateForeignReferences = (
  storyboard: TeachingStoryboard,
  selectedStepIds: ReadonlySet<string>,
  selectedObjectiveIds: ReadonlySet<string>,
  diagnostics: StoryboardDiagnostic[],
): void => {
  for (const screen of storyboard.screens) {
    for (const sourceStepId of screen.sourceStepIds) {
      if (!selectedStepIds.has(sourceStepId)) {
        diagnostics.push(diagnostic(
          'storyboard_foreign_source_step',
          `The storyboard references source step ${sourceStepId}, which is not part of the selected uploaded source units.`,
          { sourceStepId, screenId: screen.id },
        ));
      }
    }

    for (const sourceObjectiveId of screen.sourceObjectiveIds) {
      if (!selectedObjectiveIds.has(sourceObjectiveId)) {
        diagnostics.push(diagnostic(
          'storyboard_objective_mismatch',
          `The storyboard references source objective ${sourceObjectiveId}, which is not part of the selected uploaded source units.`,
          { sourceObjectiveId, screenId: screen.id },
        ));
      }
    }

    if (screen.sourceStepIds.length === 0 && screen.sourceObjectiveIds.length === 0 && screen.sourceFieldIds.length === 0) {
      diagnostics.push(diagnostic(
        'storyboard_contract_invalid',
        `Storyboard screen ${screen.id} has no source reference.`,
        { screenId: screen.id },
      ));
    }
  }
};

const validateSourceStepAccounting = (
  storyboard: TeachingStoryboard,
  selectedSteps: readonly SourceStep[],
  diagnostics: StoryboardDiagnostic[],
): void => {
  const screensById = new Map(storyboard.screens.map((screen) => [screen.id, screen] as const));

  for (const step of selectedSteps) {
    const accountingEntries = storyboard.sourceStepAccounting.filter((entry) => entry.sourceStepId === step.id);
    if (accountingEntries.length !== 1) {
      diagnostics.push(diagnostic(
        'storyboard_source_step_unaccounted',
        `Source step ${step.id} is not accounted for exactly once in the teaching storyboard.`,
        { sourceStepId: step.id },
      ));
      continue;
    }

    const [entry] = accountingEntries;
    const screensReferencingStep = storyboard.screens.filter((screen) => screen.sourceStepIds.includes(step.id));
    if (step.fieldState === 'blank') {
      if (entry.status !== 'blank-preserved' || entry.screenIds.length > 0 || screensReferencingStep.length > 0) {
        diagnostics.push(diagnostic(
          'storyboard_blank_field_invented',
          `Blank source step ${step.id} was turned into visible storyboard content.`,
          { sourceStepId: step.id },
        ));
      }
      continue;
    }

    const referencedScreens = entry.screenIds
      .map((screenId) => screensById.get(screenId))
      .filter((screen): screen is StoryboardScreen => Boolean(screen));
    const hasScreenReference = referencedScreens.some((screen) => screen.sourceStepIds.includes(step.id));
    if (entry.status !== 'screened' || entry.screenIds.length === 0 || !hasScreenReference) {
      diagnostics.push(diagnostic(
        'storyboard_source_step_unaccounted',
        `Source step ${step.id} is not attached to a source-backed storyboard screen.`,
        { sourceStepId: step.id },
      ));
    }
  }
};

const validateScreenOrder = (
  storyboard: TeachingStoryboard,
  sourceOrderByStepId: ReadonlyMap<string, number>,
  diagnostics: StoryboardDiagnostic[],
): void => {
  let previousSourceOrder = Number.NEGATIVE_INFINITY;

  for (const screen of storyboard.screens) {
    const sourceOrders = screen.sourceStepIds
      .map((sourceStepId) => sourceOrderByStepId.get(sourceStepId))
      .filter((value): value is number => typeof value === 'number');
    if (sourceOrders.length === 0) continue;

    const screenSourceOrder = Math.min(...sourceOrders);
    if (screenSourceOrder < previousSourceOrder) {
      diagnostics.push(diagnostic(
        'storyboard_order_inversion',
        `Storyboard screen ${screen.id} appears before an earlier source step in the uploaded sequence.`,
        { screenId: screen.id },
      ));
      return;
    }
    previousSourceOrder = screenSourceOrder;
  }
};

const validateVisibleTeacherScript = (
  storyboard: TeachingStoryboard,
  diagnostics: StoryboardDiagnostic[],
): void => {
  for (const screen of storyboard.screens) {
    if (getVisibleStrings(screen).some(detectVisibleTeacherScript)) {
      diagnostics.push(diagnostic(
        'storyboard_teacher_script_visible',
        `Storyboard screen ${screen.id} contains teacher-script language in visible learner content.`,
        { screenId: screen.id },
      ));
    }
  }
};

const containsAllRequirements = (actual: readonly string[], expected: readonly string[]): boolean => (
  expected.every((expectedItem) => actual.some((actualItem) => normalizeText(actualItem) === normalizeText(expectedItem)))
);

const validateRequiredEvidenceAndOutputs = (
  storyboard: TeachingStoryboard,
  selectedSteps: readonly SourceStep[],
  diagnostics: StoryboardDiagnostic[],
): void => {
  for (const step of selectedSteps) {
    if (step.fieldState === 'blank') continue;

    const requirements = extractSourceRequirements(step);
    if (requirements.requiredEvidence.length === 0 && requirements.requiredOutputs.length === 0) continue;

    const screens = storyboard.screens.filter((screen) => screen.sourceStepIds.includes(step.id));
    const requiredEvidence = screens.flatMap((screen) => screen.requiredEvidence);
    const requiredOutputs = screens.flatMap((screen) => screen.requiredOutputs);

    if (!containsAllRequirements(requiredEvidence, requirements.requiredEvidence)) {
      diagnostics.push(diagnostic(
        'storyboard_required_evidence_missing',
        `Source step ${step.id} requires evidence that is missing from its storyboard screen.`,
        { sourceStepId: step.id },
      ));
    }

    if (!containsAllRequirements(requiredOutputs, requirements.requiredOutputs)) {
      diagnostics.push(diagnostic(
        'storyboard_required_output_missing',
        `Source step ${step.id} requires an output that is missing from its storyboard screen.`,
        { sourceStepId: step.id },
      ));
    }
  }
};

const validateBlankFieldAccounting = (
  storyboard: TeachingStoryboard,
  selectedUnits: readonly SourceUnit[],
  diagnostics: StoryboardDiagnostic[],
): void => {
  const blankFieldIds = new Set(
    getSelectedFields(selectedUnits)
      .filter((selection) => selection.field.state === 'blank')
      .map((selection) => selection.sourceFieldId),
  );
  if (blankFieldIds.size === 0) return;

  for (const entry of storyboard.sourceFieldAccounting) {
    if (!blankFieldIds.has(entry.sourceFieldId)) continue;
    if (entry.status !== 'blank-preserved' || entry.screenIds.length > 0) {
      diagnostics.push(diagnostic(
        'storyboard_blank_field_invented',
        `Blank source field ${entry.sourceFieldId} was marked as screened in the teaching storyboard.`,
      ));
    }
  }

  for (const screen of storyboard.screens) {
    const attachedBlankField = screen.sourceFieldIds.find((sourceFieldId) => blankFieldIds.has(sourceFieldId));
    if (attachedBlankField && getVisibleText(screen).trim()) {
      diagnostics.push(diagnostic(
        'storyboard_blank_field_invented',
        `Blank source field ${attachedBlankField} was attached to visible learner content.`,
        { screenId: screen.id },
      ));
    }
  }
};

export const validateTeachingStoryboard = (
  storyboard: TeachingStoryboard,
  manifest: LessonSourceManifest,
): StoryboardDiagnostic[] => {
  const diagnostics: StoryboardDiagnostic[] = [...storyboard.diagnostics];
  const selectedUnits = getSelectedUnits(manifest, storyboard.provenance.selectedUnitIds);
  const selectedSteps = getSelectedSteps(selectedUnits);
  const selectedObjectives = getSelectedObjectives(manifest, selectedUnits);
  const selectedStepIds = new Set(selectedSteps.map((step) => step.id));
  const selectedObjectiveIds = new Set(selectedObjectives.map((objective) => objective.id));
  const sourceOrderByStepId = new Map(selectedSteps.map((step) => [step.id, step.sourceOrder] as const));

  validateObjectiveMapping(storyboard, selectedObjectives, diagnostics);
  validateForeignReferences(storyboard, selectedStepIds, selectedObjectiveIds, diagnostics);
  validateSourceStepAccounting(storyboard, selectedSteps, diagnostics);
  validateScreenOrder(storyboard, sourceOrderByStepId, diagnostics);
  validateVisibleTeacherScript(storyboard, diagnostics);
  validateRequiredEvidenceAndOutputs(storyboard, selectedSteps, diagnostics);
  validateBlankFieldAccounting(storyboard, selectedUnits, diagnostics);

  return diagnostics;
};

const addObjectiveScreens = (
  storyboard: TeachingStoryboard,
  selectedUnits: readonly SourceUnit[],
  objectivesByUnitId: ReadonlyMap<string, readonly StoryboardObjective[]>,
  nextScreenId: () => string,
): void => {
  for (const unit of selectedUnits) {
    const unitObjectives = objectivesByUnitId.get(unit.id) ?? [];
    if (unitObjectives.length === 0) continue;

    storyboard.screens.push({
      id: nextScreenId(),
      unitId: unit.id,
      sourceStepIds: [],
      sourceObjectiveIds: unitObjectives.map((objective) => objective.sourceObjectiveId),
      sourceFieldIds: [],
      instructionalPurpose: 'Present source-aligned learning targets.',
      learnerTitle: 'Learning Targets',
      learnerContent: {
        questions: [],
        directions: unitObjectives.map((objective) => objective.learnerText),
        successCriteria: unitObjectives.map((objective) => objective.learnerText),
      },
      teacherNotes: `Source objectives for ${unit.sourceLabel}: ${unitObjectives
        .map((objective) => objective.sourceObjectiveId)
        .join(', ')}`,
      requiredEvidence: [],
      requiredOutputs: [],
      communicationIntent: 'learning-target',
    });
  }
};

const addSourceStepScreens = (
  storyboard: TeachingStoryboard,
  selectedSteps: readonly SourceStep[],
  nextScreenId: () => string,
): void => {
  for (const step of selectedSteps) {
    if (step.fieldState === 'blank') {
      storyboard.sourceStepAccounting.push({
        sourceStepId: step.id,
        unitId: step.unitId,
        screenIds: [],
        status: 'blank-preserved',
      });
      continue;
    }

    const screenId = nextScreenId();
    const sourceText = normalizeText(step.rawBlocks.join(' '));
    const visibleText = normalizeVisibleText(sourceText || step.sourceLabel);
    const requirements = extractSourceRequirements(step);
    const expectedOutput = requirements.requiredOutputs[0]
      ? normalizeVisibleText(requirements.requiredOutputs[0])
      : undefined;
    const intent = inferCommunicationIntent(step);
    storyboard.screens.push({
      id: screenId,
      unitId: step.unitId,
      sourceStepIds: [step.id],
      sourceObjectiveIds: [],
      sourceFieldIds: [],
      instructionalPurpose: `Translate source step ${step.id} into learner-facing classroom action.`,
      learnerTitle: buildLearnerTitle(step),
      learnerContent: {
        prompt: intent === 'discussion-prompt' ? visibleText : undefined,
        task: intent !== 'discussion-prompt' ? visibleText : undefined,
        questions: [],
        directions: [visibleText],
        successCriteria: [],
        expectedOutput,
      },
      teacherNotes: `Source action (${step.sourceLabel}): ${sourceText}`,
      requiredEvidence: requirements.requiredEvidence,
      requiredOutputs: requirements.requiredOutputs,
      communicationIntent: intent,
    });
    storyboard.sourceStepAccounting.push({
      sourceStepId: step.id,
      unitId: step.unitId,
      screenIds: [screenId],
      status: 'screened',
    });
  }
};

const addFieldAccounting = (
  storyboard: TeachingStoryboard,
  selectedUnits: readonly SourceUnit[],
): void => {
  for (const selection of getSelectedFields(selectedUnits)) {
    storyboard.sourceFieldAccounting.push({
      sourceFieldId: selection.sourceFieldId,
      unitId: selection.unitId,
      screenIds: [],
      state: selection.field.state,
      status: selection.field.state === 'blank'
        ? 'blank-preserved'
        : selection.field.state === 'missing'
          ? 'intentionally-omitted'
          : 'metadata',
    });
  }
};

export const buildTeachingStoryboard = (
  manifest: LessonSourceManifest,
  options: { selectedUnitIds?: readonly string[] } = {},
): TeachingStoryboardResult => {
  const selectedUnits = getSelectedUnits(manifest, options.selectedUnitIds);
  const selectedUnitIds = selectedUnits.map((unit) => unit.id);
  const selectedObjectives = getSelectedObjectives(manifest, selectedUnits);
  const selectedSteps = getSelectedSteps(selectedUnits);
  let screenNumber = 1;
  const nextScreenId = (): string => padId('screen', screenNumber++);

  const storyboardObjectives: StoryboardObjective[] = selectedObjectives.map((objective, index) => ({
    id: padId('stobj', index + 1),
    sourceObjectiveId: objective.id,
    unitId: objective.unitId,
    sourceOrder: objective.sourceOrder,
    learnerText: normalizeVisibleText(objective.rawText),
  }));
  const objectivesByUnitId = new Map<string, StoryboardObjective[]>();
  for (const objective of storyboardObjectives) {
    const objectives = objectivesByUnitId.get(objective.unitId) ?? [];
    objectives.push(objective);
    objectivesByUnitId.set(objective.unitId, objectives);
  }

  const storyboard: TeachingStoryboard = {
    contractVersion: TEACHING_STORYBOARD_VERSION,
    provenance: {
      sourceManifestVersion: manifest.contractVersion,
      sourceHash: manifest.provenance.sourceHash,
      selectedUnitIds,
    },
    objectives: storyboardObjectives,
    screens: [],
    sourceStepAccounting: [],
    sourceFieldAccounting: [],
    diagnostics: [],
  };

  addObjectiveScreens(storyboard, selectedUnits, objectivesByUnitId, nextScreenId);
  addSourceStepScreens(storyboard, selectedSteps, nextScreenId);
  addFieldAccounting(storyboard, selectedUnits);

  const diagnostics = validateTeachingStoryboard(storyboard, manifest);
  if (hasBlockingStoryboardDiagnostics(diagnostics)) return { ok: false, diagnostics };
  storyboard.diagnostics = diagnostics;
  return { ok: true, storyboard };
};

export const resolveTeachingStoryboardForGeneration = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  manifest: LessonSourceManifest | null,
  storyboardResult: TeachingStoryboardResult | null,
): TeachingStoryboardGenerationBoundary => {
  if (policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, storyboard: null };
  }

  if (!manifest) {
    const diagnostics: StoryboardDiagnostic[] = [{
      code: 'storyboard_contract_invalid',
      severity: 'blocking',
      message: 'The uploaded source was not converted into a source manifest before storyboarding.',
    }];
    return { ok: false, message: formatStoryboardDiagnostics(diagnostics), diagnostics };
  }

  if (!storyboardResult) {
    const diagnostics: StoryboardDiagnostic[] = [{
      code: 'storyboard_contract_invalid',
      severity: 'blocking',
      message: 'The uploaded source was not converted into a teaching storyboard.',
    }];
    return { ok: false, message: formatStoryboardDiagnostics(diagnostics), diagnostics };
  }

  if (storyboardResult.ok === false) {
    return {
      ok: false,
      message: formatStoryboardDiagnostics(storyboardResult.diagnostics),
      diagnostics: storyboardResult.diagnostics,
    };
  }

  const diagnostics = validateTeachingStoryboard(storyboardResult.storyboard, manifest);
  const blocking = diagnostics.filter((item) => item.severity === 'blocking');
  if (blocking.length > 0) {
    return { ok: false, message: formatStoryboardDiagnostics(blocking), diagnostics: blocking };
  }

  return { ok: true, storyboard: storyboardResult.storyboard };
};
