import {
  getSceneVisibleText,
  type CompiledSlideScene,
} from './compiledSlideScene.ts';
import type {
  EndToEndDiagnostic,
  EndToEndValidationInput,
  SourceAlignmentSummary,
} from './endToEndValidation.ts';
import type {
  SourceObjective,
  SourceStep,
  SourceUnit,
} from './lessonSourceManifest.ts';
import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import {
  detectVisibleTeacherScript,
  type StoryboardScreen,
} from './teachingStoryboard.ts';

export type SourceAlignmentValidationResult = {
  summary: SourceAlignmentSummary;
  diagnostics: EndToEndDiagnostic[];
};

type InstructionCategory = {
  name: string;
  pattern: RegExp;
};

const INVENTION_CATEGORIES: readonly InstructionCategory[] = [
  { name: 'homework', pattern: /\bhomework\b/i },
  { name: 'quiz', pattern: /\bquiz(?:zes)?\b/i },
  { name: 'assignment', pattern: /\bassignment\b/i },
  { name: 'answer key', pattern: /\banswer\s+key\b/i },
  { name: 'reflection', pattern: /\breflection\b/i },
  { name: 'project', pattern: /\bproject\b/i },
  { name: 'assessment', pattern: /\bassessment\b/i },
  { name: 'experiment', pattern: /\bexperiment\b/i },
];

const BLANK_FIELD_VISIBLE_PATTERN = /\b(?:blank|missing|not\s+provided|answer\s+the\s+blank)\b/i;

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const uniqueInOrder = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
};

const diagnostic = (
  code: EndToEndDiagnostic['code'],
  message: string,
  detail: Partial<Pick<EndToEndDiagnostic,
    'unitId'
    | 'sourceStepId'
    | 'sourceObjectiveId'
    | 'storyboardScreenId'
    | 'semanticSlideSpecId'
    | 'sceneId'
    | 'elementId'
  >> = {},
): EndToEndDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  ...detail,
});

const getSelectedUnits = (input: EndToEndValidationInput): SourceUnit[] => {
  const selectedIds = input.storyboard.provenance.selectedUnitIds.length > 0
    ? new Set(input.storyboard.provenance.selectedUnitIds)
    : new Set(input.sourceManifest.units.map((unit) => unit.id));
  return input.sourceManifest.units.filter((unit) => selectedIds.has(unit.id));
};

const getSelectedSteps = (units: readonly SourceUnit[]): SourceStep[] => (
  units.flatMap((unit) => unit.steps).sort((a, b) => a.sourceOrder - b.sourceOrder)
);

const getSelectedObjectives = (
  input: EndToEndValidationInput,
  units: readonly SourceUnit[],
): SourceObjective[] => {
  const selectedUnitIds = new Set(units.map((unit) => unit.id));
  return input.sourceManifest.objectives
    .filter((objective) => selectedUnitIds.has(objective.unitId))
    .sort((a, b) => a.sourceOrder - b.sourceOrder);
};

const screenVisibleText = (screen: StoryboardScreen | undefined): string => {
  if (!screen) return '';
  return normalizeText([
    screen.learnerTitle,
    screen.learnerContent.prompt,
    screen.learnerContent.task,
    ...(screen.learnerContent.questions ?? []),
    ...(screen.learnerContent.directions ?? []),
    ...(screen.learnerContent.successCriteria ?? []),
    screen.learnerContent.expectedOutput,
    ...screen.requiredEvidence,
    ...screen.requiredOutputs,
  ].filter(Boolean).join(' '));
};

const supportTextForScene = (
  scene: CompiledSlideScene,
  screenById: ReadonlyMap<string, StoryboardScreen>,
  stepById: ReadonlyMap<string, SourceStep>,
  objectiveById: ReadonlyMap<string, SourceObjective>,
): string => {
  const screen = screenById.get(scene.storyboardScreenId);
  const stepText = scene.sourceStepIds
    .map((sourceStepId) => stepById.get(sourceStepId)?.rawBlocks.join(' ') ?? '')
    .join(' ');
  const objectiveText = scene.sourceObjectiveIds
    .map((sourceObjectiveId) => objectiveById.get(sourceObjectiveId)?.rawText ?? '')
    .join(' ');
  return normalizeText([screenVisibleText(screen), stepText, objectiveText].filter(Boolean).join(' '));
};

const unsupportedCategories = (visibleText: string, supportText: string): string[] => (
  INVENTION_CATEGORIES
    .filter((category) => category.pattern.test(visibleText) && !category.pattern.test(supportText))
    .map((category) => category.name)
);

const pushOnce = (
  diagnostics: EndToEndDiagnostic[],
  seenCodes: Set<string>,
  item: EndToEndDiagnostic,
): void => {
  const key = [
    item.code,
    item.sourceStepId,
    item.sourceObjectiveId,
    item.storyboardScreenId,
    item.semanticSlideSpecId,
    item.sceneId,
  ].join(':');
  if (seenCodes.has(key)) return;
  seenCodes.add(key);
  diagnostics.push(item);
};

const countDiagnostics = (
  diagnostics: readonly EndToEndDiagnostic[],
  code: EndToEndDiagnostic['code'],
): number => diagnostics.filter((diagnosticItem) => diagnosticItem.code === code).length;

const validateSourceStepCoverage = (
  input: EndToEndValidationInput,
  selectedSteps: readonly SourceStep[],
  selectedStepIds: ReadonlySet<string>,
  diagnostics: EndToEndDiagnostic[],
  seenDiagnostics: Set<string>,
): number => {
  const sceneStepIds = new Set(input.presentation.scenes.flatMap((scene) => scene.sourceStepIds));
  const specStepIds = new Set(input.semanticSpecs.flatMap((spec) => spec.sourceStepIds));
  const accountedSteps = new Set(input.storyboard.sourceStepAccounting.map((entry) => entry.sourceStepId));
  let coveredCount = 0;

  for (const step of selectedSteps) {
    if (step.fieldState === 'blank') {
      coveredCount += 1;
      continue;
    }

    const accounting = input.storyboard.sourceStepAccounting.find((entry) => entry.sourceStepId === step.id);
    const stepCovered = Boolean(
      accounting
      && accountedSteps.has(step.id)
      && (accounting.status === 'teacher-notes' || sceneStepIds.has(step.id))
      && specStepIds.has(step.id),
    );

    if (stepCovered) {
      coveredCount += 1;
      continue;
    }

    pushOnce(diagnostics, seenDiagnostics, diagnostic(
      'e2e_source_step_coverage_failed',
      `Source step ${step.id} is not fully accounted for across storyboard, semantic specs, and compiled scenes.`,
      { sourceStepId: step.id, unitId: step.unitId },
    ));
  }

  for (const sourceStepId of [...sceneStepIds, ...specStepIds]) {
    if (!selectedStepIds.has(sourceStepId)) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_foreign_session_content',
        `Source step ${sourceStepId} is not part of the selected uploaded source units.`,
        { sourceStepId },
      ));
    }
  }

  return selectedSteps.length === 0 ? 1 : coveredCount / selectedSteps.length;
};

const validateObjectivePreservation = (
  input: EndToEndValidationInput,
  selectedObjectives: readonly SourceObjective[],
  selectedObjectiveIds: ReadonlySet<string>,
  objectiveById: ReadonlyMap<string, SourceObjective>,
  screenById: ReadonlyMap<string, StoryboardScreen>,
  diagnostics: EndToEndDiagnostic[],
  seenDiagnostics: Set<string>,
): number => {
  const expectedIds = selectedObjectives.map((objective) => objective.id);
  const storyboardIds = input.storyboard.objectives.map((objective) => objective.sourceObjectiveId);
  const specIds = uniqueInOrder(input.semanticSpecs.flatMap((spec) => spec.sourceObjectiveIds));
  const sceneIds = uniqueInOrder(input.presentation.scenes.flatMap((scene) => scene.sourceObjectiveIds));
  const mismatch = !arraysEqual(storyboardIds, expectedIds)
    || !arraysEqual(specIds, expectedIds)
    || !arraysEqual(sceneIds, expectedIds);

  if (mismatch) {
    pushOnce(diagnostics, seenDiagnostics, diagnostic(
      'e2e_objective_preservation_failed',
      'Source objectives are not preserved in count, source order, identity, and owning unit.',
    ));
  }

  for (const objective of input.storyboard.objectives) {
    const sourceObjective = objectiveById.get(objective.sourceObjectiveId);
    if (
      !sourceObjective
      || !selectedObjectiveIds.has(objective.sourceObjectiveId)
      || objective.unitId !== sourceObjective.unitId
      || objective.sourceOrder !== sourceObjective.sourceOrder
    ) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_objective_preservation_failed',
        `Storyboard objective ${objective.sourceObjectiveId} does not preserve source ownership.`,
        { sourceObjectiveId: objective.sourceObjectiveId, unitId: objective.unitId },
      ));
    }
  }

  for (const spec of input.semanticSpecs) {
    const screen = screenById.get(spec.storyboardScreenId);
    if (screen && !arraysEqual(spec.sourceObjectiveIds, screen.sourceObjectiveIds)) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_objective_preservation_failed',
        `Semantic slide ${spec.id} does not preserve objective ownership from storyboard screen ${screen.id}.`,
        { semanticSlideSpecId: spec.id, storyboardScreenId: screen.id },
      ));
    }

    for (const sourceObjectiveId of spec.sourceObjectiveIds) {
      const objective = objectiveById.get(sourceObjectiveId);
      if (!objective || objective.unitId !== spec.unitId) {
        pushOnce(diagnostics, seenDiagnostics, diagnostic(
          'e2e_objective_preservation_failed',
          `Semantic slide ${spec.id} references objective ${sourceObjectiveId} outside its owning unit.`,
          { semanticSlideSpecId: spec.id, sourceObjectiveId, unitId: spec.unitId },
        ));
      }
    }
  }

  for (const scene of input.presentation.scenes) {
    for (const sourceObjectiveId of scene.sourceObjectiveIds) {
      const objective = objectiveById.get(sourceObjectiveId);
      if (!objective || objective.unitId !== scene.unitId) {
        pushOnce(diagnostics, seenDiagnostics, diagnostic(
          'e2e_objective_preservation_failed',
          `Compiled scene ${scene.id} references objective ${sourceObjectiveId} outside its owning unit.`,
          { sceneId: scene.id, sourceObjectiveId, unitId: scene.unitId },
        ));
      }
    }
  }

  const preservedCount = expectedIds.filter((objectiveId, index) => (
    storyboardIds[index] === objectiveId && specIds[index] === objectiveId && sceneIds[index] === objectiveId
  )).length;
  return expectedIds.length === 0 ? 1 : preservedCount / expectedIds.length;
};

const validateOrderAndForeignOwnership = (
  input: EndToEndValidationInput,
  selectedUnitIds: ReadonlySet<string>,
  stepById: ReadonlyMap<string, SourceStep>,
  objectiveById: ReadonlyMap<string, SourceObjective>,
  diagnostics: EndToEndDiagnostic[],
  seenDiagnostics: Set<string>,
): void => {
  let previousStepOrder = Number.NEGATIVE_INFINITY;
  for (const scene of input.presentation.scenes) {
    if (!selectedUnitIds.has(scene.unitId)) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_foreign_session_content',
        `Compiled scene ${scene.id} belongs to unit ${scene.unitId}, which is not selected.`,
        { sceneId: scene.id, unitId: scene.unitId },
      ));
    }

    const sourceOrders = scene.sourceStepIds
      .map((sourceStepId) => stepById.get(sourceStepId)?.sourceOrder)
      .filter((value): value is number => typeof value === 'number');
    if (sourceOrders.length > 0) {
      const sceneSourceOrder = Math.min(...sourceOrders);
      if (sceneSourceOrder < previousStepOrder) {
        pushOnce(diagnostics, seenDiagnostics, diagnostic(
          'e2e_sequence_inversion',
          `Compiled scene ${scene.id} appears before an earlier selected source step.`,
          { sceneId: scene.id },
        ));
      }
      previousStepOrder = sceneSourceOrder;
    }

    for (const sourceStepId of scene.sourceStepIds) {
      const step = stepById.get(sourceStepId);
      if (!step || step.unitId !== scene.unitId) {
        pushOnce(diagnostics, seenDiagnostics, diagnostic(
          'e2e_foreign_session_content',
          `Compiled scene ${scene.id} references source step ${sourceStepId} outside its owning unit.`,
          { sceneId: scene.id, sourceStepId, unitId: scene.unitId },
        ));
      }
    }

    for (const sourceObjectiveId of scene.sourceObjectiveIds) {
      const objective = objectiveById.get(sourceObjectiveId);
      if (!objective || objective.unitId !== scene.unitId) {
        pushOnce(diagnostics, seenDiagnostics, diagnostic(
          'e2e_foreign_session_content',
          `Compiled scene ${scene.id} references source objective ${sourceObjectiveId} outside its owning unit.`,
          { sceneId: scene.id, sourceObjectiveId, unitId: scene.unitId },
        ));
      }
    }
  }

  for (const spec of input.semanticSpecs) {
    if (!selectedUnitIds.has(spec.unitId)) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_foreign_session_content',
        `Semantic slide ${spec.id} belongs to unit ${spec.unitId}, which is not selected.`,
        { semanticSlideSpecId: spec.id, unitId: spec.unitId },
      ));
    }
  }
};

const validateVisibleContent = (
  input: EndToEndValidationInput,
  screenById: ReadonlyMap<string, StoryboardScreen>,
  stepById: ReadonlyMap<string, SourceStep>,
  objectiveById: ReadonlyMap<string, SourceObjective>,
  diagnostics: EndToEndDiagnostic[],
  seenDiagnostics: Set<string>,
): void => {
  for (const scene of input.presentation.scenes) {
    const visibleText = normalizeText(getSceneVisibleText(scene).join(' '));
    if (!visibleText) continue;

    if (detectVisibleTeacherScript(visibleText)) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_teacher_script_visible',
        `Compiled scene ${scene.id} contains teacher-script language in visible learner text.`,
        { sceneId: scene.id, storyboardScreenId: scene.storyboardScreenId },
      ));
    }

    if (BLANK_FIELD_VISIBLE_PATTERN.test(visibleText)) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_blank_field_invented',
        `Compiled scene ${scene.id} exposes blank or missing source-field language as visible learner content.`,
        { sceneId: scene.id, storyboardScreenId: scene.storyboardScreenId },
      ));
    }

    const supportText = supportTextForScene(scene, screenById, stepById, objectiveById);
    const invented = unsupportedCategories(visibleText, supportText);
    if (invented.length > 0) {
      pushOnce(diagnostics, seenDiagnostics, diagnostic(
        'e2e_unsupported_invention',
        `Compiled scene ${scene.id} includes unsupported invented ${invented.join(', ')} content.`,
        { sceneId: scene.id, storyboardScreenId: scene.storyboardScreenId },
      ));
    }
  }
};

export const validateSourceAlignment = (
  input: EndToEndValidationInput,
): SourceAlignmentValidationResult => {
  const diagnostics: EndToEndDiagnostic[] = [];
  const seenDiagnostics = new Set<string>();
  const selectedUnits = getSelectedUnits(input);
  const selectedUnitIds = new Set(selectedUnits.map((unit) => unit.id));
  const selectedSteps = getSelectedSteps(selectedUnits);
  const selectedObjectives = getSelectedObjectives(input, selectedUnits);
  const selectedStepIds = new Set(selectedSteps.map((step) => step.id));
  const selectedObjectiveIds = new Set(selectedObjectives.map((objective) => objective.id));
  const stepById = new Map(selectedSteps.map((step) => [step.id, step] as const));
  const objectiveById = new Map(selectedObjectives.map((objective) => [objective.id, objective] as const));
  const screenById = new Map(input.storyboard.screens.map((screen) => [screen.id, screen] as const));

  const sourceStepCoverageRatio = validateSourceStepCoverage(
    input,
    selectedSteps,
    selectedStepIds,
    diagnostics,
    seenDiagnostics,
  );
  const objectiveCoverageRatio = validateObjectivePreservation(
    input,
    selectedObjectives,
    selectedObjectiveIds,
    objectiveById,
    screenById,
    diagnostics,
    seenDiagnostics,
  );
  validateOrderAndForeignOwnership(input, selectedUnitIds, stepById, objectiveById, diagnostics, seenDiagnostics);
  validateVisibleContent(input, screenById, stepById, objectiveById, diagnostics, seenDiagnostics);

  const checked = Math.max(1, selectedSteps.length + selectedObjectives.length + input.presentation.scenes.length);
  const blocking = diagnostics.filter((diagnosticItem) => diagnosticItem.severity === 'blocking').length;
  return {
    summary: {
      checked,
      passed: diagnostics.length === 0 ? checked : Math.max(0, checked - diagnostics.length),
      failed: diagnostics.length,
      blocking,
      sourceStepCoverageRatio,
      objectiveCoverageRatio,
      sequenceInversionCount: countDiagnostics(diagnostics, 'e2e_sequence_inversion'),
      foreignSessionContentCount: countDiagnostics(diagnostics, 'e2e_foreign_session_content'),
      unsupportedInventionCount: countDiagnostics(diagnostics, 'e2e_unsupported_invention'),
      blankFieldInventionCount: countDiagnostics(diagnostics, 'e2e_blank_field_invented'),
      teacherScriptViolationCount: countDiagnostics(diagnostics, 'e2e_teacher_script_visible'),
    },
    diagnostics,
  };
};
