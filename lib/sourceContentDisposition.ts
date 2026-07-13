import type {
  LessonSourceManifest,
  SourceField,
  SourceStep,
} from './lessonSourceManifest.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';
import type { VisualTeachingPlanDiagnostic } from './visualTeachingPlan.ts';

export type SourceContentDisposition =
  | 'learner-visible'
  | 'speaker-notes'
  | 'deck-metadata'
  | 'merge-context'
  | 'omit-administrative';

export type SourceDispositionDecision = {
  sourceKind: 'objective' | 'step' | 'field';
  sourceId: string;
  unitId: string;
  sourceOrder: number;
  sourceLabel: string;
  disposition: SourceContentDisposition;
  reason:
    | 'objective-visible'
    | 'instructional-step-visible'
    | 'teacher-action-notes'
    | 'planning-context-notes'
    | 'administrative-omission'
    | 'metadata-preserved'
    | 'adjacent-context-merge';
};

export type SourceContentDispositionResult =
  | { ok: true; decisions: SourceDispositionDecision[] }
  | { ok: false; diagnostics: VisualTeachingPlanDiagnostic[] };

const ADMINISTRATIVE_LABEL =
  /^(?:references?(?:\s*\([^)]*\))?|declaration of ai use|teacher preparation|administrative notes?)\s*:?$/i;
const PLANNING_CONTEXT_LABEL =
  /^(?:learner context|observations? of learners|ways forward|intentions?)\s*:?$/i;
const LEARNER_REFERENCE_ACTION =
  /\b(?:learners?|students?)\s+(?:use|consult|compare|evaluate|cite)\b|\b(?:use|consult|compare|evaluate|cite)\s+(?:the\s+)?(?:reference|source)/i;

const compareCodePoints = (left: string, right: string): number => {
  const leftPoints = [...left];
  const rightPoints = [...right];
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftPoints[index].codePointAt(0)! - rightPoints[index].codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
};

const dispositionForStep = (step: SourceStep): Pick<SourceDispositionDecision, 'disposition' | 'reason'> => {
  const sourceText = step.rawBlocks.join(' ');
  if (ADMINISTRATIVE_LABEL.test(step.sourceLabel) && !LEARNER_REFERENCE_ACTION.test(sourceText)) {
    return { disposition: 'omit-administrative', reason: 'administrative-omission' };
  }
  if (PLANNING_CONTEXT_LABEL.test(step.sourceLabel)) {
    return { disposition: 'speaker-notes', reason: 'planning-context-notes' };
  }
  return { disposition: 'learner-visible', reason: 'instructional-step-visible' };
};

const dispositionForField = (field: SourceField): Pick<SourceDispositionDecision, 'disposition' | 'reason'> => {
  if (ADMINISTRATIVE_LABEL.test(field.label)) {
    if (LEARNER_REFERENCE_ACTION.test(field.value)) {
      return { disposition: 'learner-visible', reason: 'instructional-step-visible' };
    }
    return { disposition: 'omit-administrative', reason: 'administrative-omission' };
  }
  if (PLANNING_CONTEXT_LABEL.test(field.label)) {
    return { disposition: 'speaker-notes', reason: 'planning-context-notes' };
  }
  if (field.state === 'ambiguous') {
    return { disposition: 'merge-context', reason: 'adjacent-context-merge' };
  }
  if (field.state === 'blank' || field.state === 'missing') {
    return { disposition: 'omit-administrative', reason: 'administrative-omission' };
  }
  return { disposition: 'deck-metadata', reason: 'metadata-preserved' };
};

export const classifySourceContent = (
  manifest: LessonSourceManifest,
  storyboard: TeachingStoryboard,
): SourceContentDispositionResult => {
  if (
    storyboard.provenance.sourceHash !== manifest.provenance.sourceHash
    || storyboard.provenance.sourceManifestVersion !== manifest.contractVersion
  ) {
    return {
      ok: false,
      diagnostics: [{
        code: 'visual_plan_contract_invalid',
        severity: 'blocking',
        message: 'The teaching storyboard does not belong to the supplied source manifest.',
      }],
    };
  }

  const selectedUnitIds = new Set(storyboard.provenance.selectedUnitIds);
  const selectedUnits = manifest.units.filter((unit) => selectedUnitIds.has(unit.id));
  if (selectedUnits.length !== selectedUnitIds.size) {
    return {
      ok: false,
      diagnostics: [{
        code: 'visual_plan_contract_invalid',
        severity: 'blocking',
        message: 'The teaching storyboard selects a source unit that is not present in the manifest.',
      }],
    };
  }

  const decisions: SourceDispositionDecision[] = [];
  const selectedObjectiveIds = new Set(selectedUnits.flatMap((unit) => unit.objectiveIds));
  for (const objective of manifest.objectives) {
    if (!selectedObjectiveIds.has(objective.id)) continue;
    decisions.push({
      sourceKind: 'objective',
      sourceId: objective.id,
      unitId: objective.unitId,
      sourceOrder: objective.sourceOrder,
      sourceLabel: 'Objective',
      disposition: 'learner-visible',
      reason: 'objective-visible',
    });
  }

  for (const unit of selectedUnits) {
    for (const step of unit.steps) {
      decisions.push({
        sourceKind: 'step',
        sourceId: step.id,
        unitId: unit.id,
        sourceOrder: step.sourceOrder,
        sourceLabel: step.sourceLabel,
        ...dispositionForStep(step),
      });
    }
    for (const field of Object.values(unit.fields)) {
      decisions.push({
        sourceKind: 'field',
        sourceId: field.id,
        unitId: unit.id,
        sourceOrder: field.sourceOrder,
        sourceLabel: field.label,
        ...dispositionForField(field),
      });
    }
  }

  decisions.sort((left, right) => left.sourceOrder - right.sourceOrder || compareCodePoints(left.sourceId, right.sourceId));
  const sourceIds = new Set(decisions.map((decision) => decision.sourceId));
  if (sourceIds.size !== decisions.length) {
    return {
      ok: false,
      diagnostics: [{
        code: 'visual_plan_contract_invalid',
        severity: 'blocking',
        message: 'Source content disposition requires unique source identifiers.',
      }],
    };
  }

  return { ok: true, decisions };
};
