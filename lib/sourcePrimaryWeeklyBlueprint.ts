import type { LessonBlueprint } from '../types.ts';
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import type {
  LessonSourceManifest,
  SourceField,
  SourceObjective,
  SourceUnit,
} from './lessonSourceManifest.ts';

export const SOURCE_PRIMARY_WEEKLY_BLUEPRINT_VERSION = 'source-primary-weekly-blueprint-v1';

export type SourcePrimaryWeeklyBlueprintBoundary =
  | { ok: true; blueprint: LessonBlueprint | null }
  | { ok: false; message: string };

type AppLanguage = 'EN' | 'FIL';

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const titleCase = (value: string): string => normalizeText(value)
  .split(' ')
  .map((word) => {
    if (/^(?:K|Q)\d+$/i.test(word)) return word.toUpperCase();
    if (/^\d+$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  })
  .join(' ');

const stripFileExtension = (fileName: string): string => fileName.replace(/\.[^.]+$/, '');

const cleanFileStemForTitle = (fileName: string): string => {
  const stem = stripFileExtension(fileName)
    .replace(/\(\d+\)\s*$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stem ? titleCase(stem) : 'Source Aligned Lesson Plan';
};

const allFieldValues = (manifest: LessonSourceManifest): SourceField[] => [
  ...Object.values(manifest.metadata),
  ...manifest.units.flatMap((unit) => Object.values(unit.fields)),
]
  .filter((field) => field.state === 'present' && normalizeText(field.value))
  .sort((a, b) => a.sourceOrder - b.sourceOrder);

const findFieldValue = (
  manifest: LessonSourceManifest,
  labelPattern: RegExp,
): string | null => {
  const field = allFieldValues(manifest).find((candidate) => labelPattern.test(candidate.label));
  return field ? normalizeText(field.value) : null;
};

const objectiveById = (manifest: LessonSourceManifest): Map<string, SourceObjective> => (
  new Map(manifest.objectives.map((objective) => [objective.id, objective]))
);

const getUnitObjectives = (
  unit: SourceUnit,
  objectiveMap: Map<string, SourceObjective>,
): SourceObjective[] => unit.objectiveIds
  .map((objectiveId) => objectiveMap.get(objectiveId))
  .filter((objective): objective is SourceObjective => Boolean(objective))
  .sort((a, b) => a.sourceOrder - b.sourceOrder);

const inferPlanUnitLabel = (units: readonly SourceUnit[]): string => {
  const joinedLabels = units.map((unit) => unit.sourceLabel).join(' ');
  if (/\b(?:learning\s+)?(?:session|sesyon|sesion)\b/i.test(joinedLabels)) return 'Session';
  if (/\b(?:day|araw)\b/i.test(joinedLabels)) return 'Day';
  if (/\blesson\b/i.test(joinedLabels)) return 'Lesson';
  return 'Unit';
};

const inferGradeLevel = (manifest: LessonSourceManifest, title: string): string => {
  const fieldValue = findFieldValue(manifest, /\b(?:grade|baitang|level)\b/i);
  const source = `${fieldValue || ''} ${title}`;
  const match = source.match(/\b(?:grade|baitang)\s*(\d{1,2})\b/i);
  return match ? `Grade ${match[1]}` : 'K-12';
};

const inferSubject = (manifest: LessonSourceManifest, title: string): string => {
  const fieldValue = findFieldValue(manifest, /\b(?:subject|asignatura)\b/i);
  if (fieldValue) return fieldValue;

  const source = title;
  const candidates = [
    'Araling Panlipunan',
    'Edukasyon sa Pagpapakatao',
    'Mathematics',
    'Filipino',
    'Science',
    'English',
    'MAPEH',
    'TLE',
    'ESP',
    'Math',
  ];
  const candidate = candidates.find((value) => new RegExp(`\\b${value}\\b`, 'i').test(source));
  return candidate || 'K-12';
};

const inferQuarter = (manifest: LessonSourceManifest, title: string): string => {
  const fieldValue = findFieldValue(manifest, /\b(?:quarter|markahan|week|linggo)\b/i);
  if (fieldValue) return fieldValue;

  const quarterMatch = title.match(/\b(?:quarter|q)\s*([1-4])\b/i);
  if (quarterMatch) return `Quarter ${quarterMatch[1]}`;

  const weekMatch = title.match(/\bweek\s*(\d{1,2})\b/i);
  if (weekMatch) return `Week ${weekMatch[1]}`;

  return 'Source-aligned';
};

const uniqueInSourceOrder = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(normalizeText).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
};

const buildUnitFocus = (
  unit: SourceUnit,
  objectiveMap: Map<string, SourceObjective>,
): string => {
  const objectiveText = getUnitObjectives(unit, objectiveMap)
    .map((objective) => objective.rawText);
  if (objectiveText.length > 0) return objectiveText.map(normalizeText).join(' / ');

  const firstStep = [...unit.steps].sort((a, b) => a.sourceOrder - b.sourceOrder)[0];
  const fallback = firstStep?.rawBlocks.find((block) => normalizeText(block)) || firstStep?.sourceLabel || unit.sourceLabel;
  return normalizeText(fallback);
};

export const buildSourcePrimaryWeeklyBlueprint = (
  manifest: LessonSourceManifest,
  language: AppLanguage,
): LessonBlueprint => {
  const title = cleanFileStemForTitle(manifest.provenance.fileName);
  const objectives = [...manifest.objectives]
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((objective) => normalizeText(objective.rawText))
    .filter(Boolean);
  const sourceObjectives = uniqueInSourceOrder(objectives);
  const objectiveMap = objectiveById(manifest);

  return {
    mainTitle: title,
    planUnitLabel: inferPlanUnitLabel(manifest.units),
    subject: inferSubject(manifest, title),
    gradeLevel: inferGradeLevel(manifest, title),
    quarter: inferQuarter(manifest, title),
    learningCompetency: findFieldValue(manifest, /\bcompetenc/i) || sourceObjectives[0] || title,
    smartObjectives: sourceObjectives,
    studentFacingObjectives: sourceObjectives,
    days: manifest.units.map((unit) => ({
      dayNumber: unit.sourceOrdinal,
      title: normalizeText(unit.sourceLabel) || `${language === 'FIL' ? 'Yunit' : 'Unit'} ${unit.sourceOrdinal}`,
      focus: buildUnitFocus(unit, objectiveMap),
      generationStatus: 'pending' as const,
    })),
  };
};

export const resolveSourcePrimaryWeeklyBlueprintForGeneration = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  manifest: LessonSourceManifest | null,
  language: AppLanguage,
): SourcePrimaryWeeklyBlueprintBoundary => {
  if (policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, blueprint: null };
  }

  if (!manifest) {
    return {
      ok: false,
      message: 'The uploaded source manifest is required before building the weekly source-primary plan.',
    };
  }

  return {
    ok: true,
    blueprint: buildSourcePrimaryWeeklyBlueprint(manifest, language),
  };
};
