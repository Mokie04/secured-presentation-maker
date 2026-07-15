import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import type { SourceDispositionDecision } from './sourceContentDisposition.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';

export const VISUAL_TEACHING_PLAN_VERSION = 'visual-teaching-plan-v1';

export type VisualGrammar =
  | 'concept-map'
  | 'relationship-diagram'
  | 'process-flow'
  | 'comparison-panels'
  | 'classification-map'
  | 'timeline'
  | 'data-table'
  | 'worked-example'
  | 'activity-board'
  | 'question-choices'
  | 'evidence-board'
  | 'visual-thesis'
  | 'image-led-explanation'
  | 'minimal-statement';

export type VisualTeachingScene = {
  id: string;
  unitId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  sourceFieldIds: string[];
  storyboardScreenIds: string[];
  teachingMove: 'orient' | 'target' | 'explain' | 'model' | 'practice' | 'evidence' | 'check' | 'synthesize';
  learnerTitle: string;
  visibleContent: {
    statement?: string;
    points: string[];
    cards: Array<{ id: string; title: string; body: string }>;
    steps: Array<{ id: string; label: string; body: string }>;
    table?: { headers: string[]; rows: string[][] };
    question?: { prompt: string; choices: Array<{ id: string; text: string }>; answerId?: string };
    diagram?: {
      nodes: Array<{
        id: string;
        label: string;
        detail?: string;
        role: 'source' | 'process' | 'constraint' | 'result';
      }>;
      edges: Array<{ from: string; to: string; label?: string; direction: 'forward' | 'both' | 'none' }>;
    };
  };
  visualGrammar: VisualGrammar;
  teacherNotes: string;
  requiredEvidence: string[];
  requiredOutputs: string[];
  assetBrief?: {
    purpose: string;
    subject: string;
    style: 'photo' | 'illustration';
    mustNotContainText: true;
  };
};

export type VisualSourceAccountingEntry = SourceDispositionDecision & { sceneIds: string[] };

export type VisualTeachingPlan = {
  contractVersion: typeof VISUAL_TEACHING_PLAN_VERSION;
  unitId: string;
  sourceObjectiveIds: string[];
  scenes: VisualTeachingScene[];
  sourceAccounting: VisualSourceAccountingEntry[];
  provenance: {
    sourceHash: string;
    storyboardVersion: string;
    selectedUnitIds: string[];
    provider?: string;
    model?: string;
  };
};

export type VisualTeachingPlanDiagnostic = {
  code:
    | 'visual_plan_contract_invalid'
    | 'visual_plan_foreign_source'
    | 'visual_plan_source_unaccounted'
    | 'visual_plan_order_inversion'
    | 'visual_plan_objective_mismatch'
    | 'visual_plan_unauthorized_omission'
    | 'visual_plan_planning_text_visible'
    | 'visual_plan_assessment_unparsed'
    | 'visual_plan_minimal_statement_overuse'
    | 'visual_plan_grammar_unsupported';
  severity: 'blocking';
  message: string;
  sourceId?: string;
  sceneId?: string;
};

export type VisualTeachingPlanResult =
  | { ok: true; plan: VisualTeachingPlan }
  | { ok: false; diagnostics: VisualTeachingPlanDiagnostic[]; message: string };

const SUPPORTED_VISUAL_GRAMMARS = new Set<VisualGrammar>([
  'concept-map',
  'relationship-diagram',
  'process-flow',
  'comparison-panels',
  'classification-map',
  'timeline',
  'data-table',
  'worked-example',
  'activity-board',
  'question-choices',
  'evidence-board',
  'visual-thesis',
  'image-led-explanation',
  'minimal-statement',
]);

const STRUCTURED_MULTIPLE_CHOICE = /(?:^|\s)A\.\s+.+?(?:\s)B\.\s+.+?(?:\s)C\.\s+.+?(?:\s)D\.\s+/i;
const TRUE_LIKE_COMPOSER_FLAGS = new Set(['1', 'true', 'yes', 'on']);

const diagnostic = (
  code: VisualTeachingPlanDiagnostic['code'],
  message: string,
  context: Pick<VisualTeachingPlanDiagnostic, 'sourceId' | 'sceneId'> = {},
): VisualTeachingPlanDiagnostic => ({ code, severity: 'blocking', message, ...context });

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const uniqueInOrder = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const requirementsPreserveSource = (
  actual: readonly string[],
  expected: readonly string[],
): boolean => actual.length === expected.length && actual.every((item, index) => {
  const normalizedItem = normalizeText(item);
  const normalizedSource = normalizeText(expected[index] ?? '');
  return normalizedItem === normalizedSource
    || (normalizedItem.length >= 12 && normalizedSource.includes(normalizedItem));
});

const getVisibleSceneText = (scene: VisualTeachingScene): string => normalizeText([
  scene.learnerTitle,
  scene.visibleContent.statement,
  ...scene.visibleContent.points,
  ...scene.visibleContent.cards.flatMap((card) => [card.title, card.body]),
  ...scene.visibleContent.steps.flatMap((step) => [step.label, step.body]),
  ...(scene.visibleContent.table?.headers ?? []),
  ...(scene.visibleContent.table?.rows.flat() ?? []),
  scene.visibleContent.question?.prompt,
  ...(scene.visibleContent.question?.choices.map((choice) => choice.text) ?? []),
  ...(scene.visibleContent.diagram?.nodes.flatMap((node) => [node.label, node.detail]) ?? []),
  ...(scene.visibleContent.diagram?.edges.map((edge) => edge.label) ?? []),
].filter((value): value is string => typeof value === 'string').join(' '));

const sceneReferencesSource = (
  scene: VisualTeachingScene,
  decision: SourceDispositionDecision,
): boolean => {
  if (decision.sourceKind === 'objective') return scene.sourceObjectiveIds.includes(decision.sourceId);
  if (decision.sourceKind === 'field') return scene.sourceFieldIds.includes(decision.sourceId);
  return scene.sourceStepIds.includes(decision.sourceId);
};

const sceneIdsMatchOwnership = (declaredSceneIds: readonly string[], actualSceneIds: readonly string[]): boolean => {
  const declared = new Set(declaredSceneIds);
  const actual = new Set(actualSceneIds);
  return declared.size === declaredSceneIds.length
    && actual.size === actualSceneIds.length
    && declared.size === actual.size
    && [...declared].every((sceneId) => actual.has(sceneId));
};

export const isVisualTeachingComposerV1Enabled = (flagValue: string | undefined): boolean => (
  TRUE_LIKE_COMPOSER_FLAGS.has(flagValue?.trim().toLowerCase() ?? '')
);

export const validateVisualTeachingPlan = (
  plan: VisualTeachingPlan,
  manifest: LessonSourceManifest,
  storyboard: TeachingStoryboard,
  dispositions: readonly SourceDispositionDecision[],
): VisualTeachingPlanDiagnostic[] => {
  const diagnostics: VisualTeachingPlanDiagnostic[] = [];
  const selectedUnitIds = storyboard.provenance.selectedUnitIds;

  if (
    plan.contractVersion !== VISUAL_TEACHING_PLAN_VERSION
    || plan.provenance.sourceHash !== manifest.provenance.sourceHash
    || plan.provenance.sourceHash !== storyboard.provenance.sourceHash
    || plan.provenance.storyboardVersion !== storyboard.contractVersion
    || !arraysEqual(plan.provenance.selectedUnitIds, selectedUnitIds)
    || !selectedUnitIds.includes(plan.unitId)
  ) {
    diagnostics.push(diagnostic(
      'visual_plan_contract_invalid',
      'The visual teaching plan contract or provenance does not match its source inputs.',
    ));
  }

  const selectedUnits = manifest.units.filter((unit) => selectedUnitIds.includes(unit.id));
  const selectedSteps = selectedUnits.flatMap((unit) => unit.steps);
  const selectedFields = selectedUnits.flatMap((unit) => Object.values(unit.fields));
  const selectedStepIds = new Set(selectedSteps.map((step) => step.id));
  const selectedObjectiveIds = new Set(selectedUnits.flatMap((unit) => unit.objectiveIds));
  const selectedFieldIds = new Set(selectedFields.map((field) => field.id));
  const unitIdByStepId = new Map(selectedSteps.map((step) => [step.id, step.unitId]));
  const unitIdByObjectiveId = new Map(manifest.objectives
    .filter((objective) => selectedObjectiveIds.has(objective.id))
    .map((objective) => [objective.id, objective.unitId]));
  const unitIdByFieldId = new Map(selectedUnits.flatMap((unit) => (
    Object.values(unit.fields).map((field) => [field.id, unit.id] as const)
  )));
  const stepById = new Map(selectedSteps.map((step) => [step.id, step]));
  const fieldById = new Map(selectedFields.map((field) => [field.id, field]));
  const screenById = new Map(storyboard.screens.map((screen) => [screen.id, screen]));
  const screenOrderById = new Map(storyboard.screens.map((screen, index) => [screen.id, index]));
  const sceneById = new Map(plan.scenes.map((scene) => [scene.id, scene]));
  const dispositionById = new Map(dispositions.map((item) => [item.sourceId, item]));

  if (sceneById.size !== plan.scenes.length) {
    diagnostics.push(diagnostic('visual_plan_contract_invalid', 'Visual teaching scene identifiers must be unique.'));
  }

  for (const scene of plan.scenes) {
    if (!SUPPORTED_VISUAL_GRAMMARS.has(scene.visualGrammar)) {
      diagnostics.push(diagnostic(
        'visual_plan_grammar_unsupported',
        `Scene ${scene.id} uses unsupported visual grammar ${scene.visualGrammar}.`,
        { sceneId: scene.id },
      ));
    }

    if (scene.storyboardScreenIds.length === 0 || new Set(scene.storyboardScreenIds).size !== scene.storyboardScreenIds.length) {
      diagnostics.push(diagnostic(
        'visual_plan_contract_invalid',
        `Scene ${scene.id} must reference at least one unique storyboard screen.`,
        { sceneId: scene.id },
      ));
    }

    const foreignSourceId = [
      ...scene.sourceStepIds.filter((sourceId) => !selectedStepIds.has(sourceId)),
      ...scene.sourceObjectiveIds.filter((sourceId) => !selectedObjectiveIds.has(sourceId)),
      ...scene.sourceFieldIds.filter((sourceId) => !selectedFieldIds.has(sourceId)),
    ][0];
    const foreignScreenId = scene.storyboardScreenIds.find((screenId) => !screenById.has(screenId));
    const ownershipMismatchSourceId = [
      ...scene.sourceStepIds.filter((sourceId) => unitIdByStepId.get(sourceId) !== scene.unitId),
      ...scene.sourceObjectiveIds.filter((sourceId) => unitIdByObjectiveId.get(sourceId) !== scene.unitId),
      ...scene.sourceFieldIds.filter((sourceId) => unitIdByFieldId.get(sourceId) !== scene.unitId),
    ][0];
    const ownershipMismatchScreenId = scene.storyboardScreenIds.find((screenId) => {
      const screen = screenById.get(screenId);
      return Boolean(screen && screen.unitId !== scene.unitId);
    });
    const unauthorizedFieldId = scene.sourceFieldIds.find((sourceFieldId) => {
      const disposition = dispositionById.get(sourceFieldId);
      return disposition?.sourceKind !== 'field'
        || (disposition.disposition !== 'learner-visible' && disposition.disposition !== 'speaker-notes');
    });
    if (
      foreignSourceId
      || foreignScreenId
      || ownershipMismatchSourceId
      || ownershipMismatchScreenId
      || !selectedUnitIds.includes(scene.unitId)
    ) {
      diagnostics.push(diagnostic(
        'visual_plan_foreign_source',
        `Scene ${scene.id} contains a source or storyboard reference outside the selected lesson units.`,
        { sourceId: foreignSourceId ?? ownershipMismatchSourceId, sceneId: scene.id },
      ));
    }
    if (unauthorizedFieldId) {
      const disposition = dispositionById.get(unauthorizedFieldId);
      diagnostics.push(diagnostic(
        disposition ? 'visual_plan_unauthorized_omission' : 'visual_plan_foreign_source',
        `Scene ${scene.id} attaches field ${unauthorizedFieldId} without an authorized visible or speaker-note disposition.`,
        { sourceId: unauthorizedFieldId, sceneId: scene.id },
      ));
    }

    const referencedScreens = scene.storyboardScreenIds
      .map((screenId) => screenById.get(screenId))
      .filter((screen): screen is TeachingStoryboard['screens'][number] => Boolean(screen));
    if (referencedScreens.length === scene.storyboardScreenIds.length && referencedScreens.length > 0) {
      const expectedStepIds = uniqueInOrder(referencedScreens.flatMap((screen) => screen.sourceStepIds));
      const expectedObjectiveIds = uniqueInOrder(referencedScreens.flatMap((screen) => screen.sourceObjectiveIds));
      const learnerVisibleScreens = referencedScreens.filter((screen) => (
        [...screen.sourceObjectiveIds, ...screen.sourceStepIds, ...screen.sourceFieldIds]
          .some((sourceId) => dispositionById.get(sourceId)?.disposition === 'learner-visible')
      ));
      const expectedEvidence = uniqueInOrder(learnerVisibleScreens.flatMap((screen) => screen.requiredEvidence));
      const expectedOutputs = uniqueInOrder(learnerVisibleScreens.flatMap((screen) => screen.requiredOutputs));
      const speakerNoteFields = scene.sourceFieldIds
        .filter((sourceFieldId) => dispositionById.get(sourceFieldId)?.disposition === 'speaker-notes')
        .flatMap((sourceFieldId) => {
          const field = fieldById.get(sourceFieldId);
          return field ? [field] : [];
        });
      const expectedTeacherNotes = normalizeText([
        ...referencedScreens.map((screen) => screen.teacherNotes),
        ...speakerNoteFields.map((field) => `Source field (${field.label}): ${field.value}`),
      ].filter(Boolean).join(' '));
      if (
        !arraysEqual(scene.sourceStepIds, expectedStepIds)
        || !arraysEqual(scene.sourceObjectiveIds, expectedObjectiveIds)
      ) {
        diagnostics.push(diagnostic(
          'visual_plan_foreign_source',
          `Scene ${scene.id} step or objective references do not match its storyboard screen provenance.`,
          { sceneId: scene.id },
        ));
      }
      if (
        !requirementsPreserveSource(scene.requiredEvidence, expectedEvidence)
        || !requirementsPreserveSource(scene.requiredOutputs, expectedOutputs)
        || normalizeText(scene.teacherNotes) !== expectedTeacherNotes
      ) {
        diagnostics.push(diagnostic(
          'visual_plan_source_unaccounted',
          `Scene ${scene.id} changes source-owned evidence, outputs, or teacher notes from its storyboard screens.`,
          { sceneId: scene.id },
        ));
      }

      const storyboardOrders = scene.storyboardScreenIds.map((screenId) => screenOrderById.get(screenId)!);
      if (storyboardOrders.some((order, index) => index > 0 && order < storyboardOrders[index - 1])) {
        diagnostics.push(diagnostic(
          'visual_plan_order_inversion',
          `Scene ${scene.id} inverts its storyboard screen order.`,
          { sceneId: scene.id },
        ));
      }
    }
  }

  const minimalStatementCount = plan.scenes.filter((scene) => (
    scene.visualGrammar === 'minimal-statement'
  )).length;
  if (minimalStatementCount * 5 > plan.scenes.length) {
    diagnostics.push(diagnostic(
      'visual_plan_minimal_statement_overuse',
      'No more than 20% of visual teaching scenes may use minimal-statement grammar.',
    ));
  }

  const expectedObjectiveIds = storyboard.objectives.map((objective) => objective.sourceObjectiveId);
  if (!arraysEqual(plan.sourceObjectiveIds, expectedObjectiveIds)) {
    diagnostics.push(diagnostic(
      'visual_plan_objective_mismatch',
      'The visual teaching plan must preserve selected objective identity and order.',
    ));
  }

  const accountingCounts = new Map<string, number>();
  for (const entry of plan.sourceAccounting) {
    accountingCounts.set(entry.sourceId, (accountingCounts.get(entry.sourceId) ?? 0) + 1);
    const expected = dispositionById.get(entry.sourceId);
    if (!expected) {
      diagnostics.push(diagnostic(
        'visual_plan_foreign_source',
        `Source accounting contains foreign source ${entry.sourceId}.`,
        { sourceId: entry.sourceId },
      ));
      continue;
    }

    if (
      entry.sourceKind !== expected.sourceKind
      || entry.unitId !== expected.unitId
      || entry.sourceOrder !== expected.sourceOrder
      || entry.sourceLabel !== expected.sourceLabel
      || entry.disposition !== expected.disposition
      || entry.reason !== expected.reason
    ) {
      diagnostics.push(diagnostic(
        'visual_plan_unauthorized_omission',
        `Source ${entry.sourceId} changed its authorized content disposition.`,
        { sourceId: entry.sourceId },
      ));
    }

    const actualSceneIds = plan.scenes
      .filter((scene) => sceneReferencesSource(scene, expected))
      .map((scene) => scene.id);
    const ownershipMatches = sceneIdsMatchOwnership(entry.sceneIds, actualSceneIds);
    if (
      !ownershipMatches
      || (
        expected.disposition === 'learner-visible'
        && actualSceneIds.length === 0
      )
      || (
        expected.disposition === 'speaker-notes'
        && actualSceneIds.length !== 1
      )
    ) {
      diagnostics.push(diagnostic(
        'visual_plan_source_unaccounted',
        `Source ${entry.sourceId} scene accounting does not exactly match direct scene ownership.`,
        { sourceId: entry.sourceId },
      ));
    }
    if (expected.disposition === 'omit-administrative' && actualSceneIds.length > 0) {
      diagnostics.push(diagnostic(
        'visual_plan_unauthorized_omission',
        `Administrative source ${entry.sourceId} must not own a learner-visible scene.`,
        { sourceId: entry.sourceId },
      ));
    }
  }

  for (const expected of dispositions) {
    if (accountingCounts.get(expected.sourceId) !== 1) {
      diagnostics.push(diagnostic(
        'visual_plan_source_unaccounted',
        `Source ${expected.sourceId} must appear exactly once in visual source accounting.`,
        { sourceId: expected.sourceId },
      ));
    }
  }

  const learnerVisibleScreens = storyboard.screens.filter((screen) => (
    [...screen.sourceObjectiveIds, ...screen.sourceStepIds, ...screen.sourceFieldIds]
      .some((sourceId) => dispositionById.get(sourceId)?.disposition === 'learner-visible')
  ));
  const expectedEvidence = uniqueInOrder(learnerVisibleScreens.flatMap((screen) => screen.requiredEvidence));
  const expectedOutputs = uniqueInOrder(learnerVisibleScreens.flatMap((screen) => screen.requiredOutputs));
  const actualEvidence = uniqueInOrder(plan.scenes.flatMap((scene) => scene.requiredEvidence));
  const actualOutputs = uniqueInOrder(plan.scenes.flatMap((scene) => scene.requiredOutputs));
  if (
    !requirementsPreserveSource(actualEvidence, expectedEvidence)
    || !requirementsPreserveSource(actualOutputs, expectedOutputs)
  ) {
    diagnostics.push(diagnostic(
      'visual_plan_source_unaccounted',
      'The visual teaching plan does not preserve required evidence and outputs in storyboard source order.',
    ));
  }

  const sourceOrderById = new Map(dispositions.map((item) => [item.sourceId, item.sourceOrder]));
  let lastSourceOrder = Number.NEGATIVE_INFINITY;
  for (const scene of plan.scenes) {
    const sourceOrders = [...scene.sourceObjectiveIds, ...scene.sourceStepIds, ...scene.sourceFieldIds]
      .map((sourceId) => sourceOrderById.get(sourceId))
      .filter((sourceOrder): sourceOrder is number => sourceOrder !== undefined);
    if (sourceOrders.length === 0) continue;
    const sceneSourceOrder = Math.min(...sourceOrders);
    if (sceneSourceOrder < lastSourceOrder) {
      diagnostics.push(diagnostic(
        'visual_plan_order_inversion',
        `Scene ${scene.id} inverts the selected source order.`,
        { sceneId: scene.id },
      ));
      break;
    }
    lastSourceOrder = Math.max(...sourceOrders);
  }

  const hiddenDecisions = dispositions.filter((item) => (
    (item.disposition === 'speaker-notes' || item.disposition === 'omit-administrative')
    && (item.sourceKind === 'step' || item.sourceKind === 'field')
  ));
  for (const scene of plan.scenes) {
    const visibleText = getVisibleSceneText(scene);
    const exposedPlanningSource = hiddenDecisions.find((decision) => {
      const sourceText = normalizeText(decision.sourceKind === 'field'
        ? fieldById.get(decision.sourceId)?.value ?? ''
        : stepById.get(decision.sourceId)?.rawBlocks.join(' ') ?? '');
      const sourceLabel = normalizeText(decision.sourceLabel);
      return (sourceLabel && visibleText.includes(sourceLabel)) || (sourceText && visibleText.includes(sourceText));
    });
    if (exposedPlanningSource) {
      diagnostics.push(diagnostic(
        'visual_plan_planning_text_visible',
        `Scene ${scene.id} exposes planning-only source ${exposedPlanningSource.sourceId}.`,
        { sourceId: exposedPlanningSource.sourceId, sceneId: scene.id },
      ));
    }
  }

  for (const step of selectedSteps) {
    if (!STRUCTURED_MULTIPLE_CHOICE.test(step.rawBlocks.join(' '))) continue;
    const accounting = plan.sourceAccounting.find((entry) => entry.sourceId === step.id);
    if (!accounting || accounting.disposition !== 'learner-visible') continue;
    const parsed = accounting.sceneIds.some((sceneId) => {
      const scene = sceneById.get(sceneId);
      return Boolean(
        scene
        && scene.visualGrammar === 'question-choices'
        && scene.visibleContent.question?.prompt.trim()
        && scene.visibleContent.question.choices.length >= 2,
      );
    });
    if (!parsed) {
      diagnostics.push(diagnostic(
        'visual_plan_assessment_unparsed',
        `Structured assessment source ${step.id} must be parsed into question choices.`,
        { sourceId: step.id },
      ));
    }
  }

  return diagnostics;
};
