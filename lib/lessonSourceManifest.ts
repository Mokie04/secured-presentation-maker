import type {
  SourceDocumentBlock,
  SourceDocumentTable,
  SourceTableCell,
  StructuredSourceDocument,
} from './lessonSourceDocument.ts';
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';

export const LESSON_SOURCE_MANIFEST_VERSION = 'lesson-source-manifest-v1';

export type SourceFieldState = 'present' | 'blank' | 'missing' | 'ambiguous';
export type SourceDocumentFormat = 'docx' | 'pdf' | 'txt' | 'md';
export type SourceDiagnosticSeverity = 'info' | 'warning' | 'blocking';
export type SourceDiagnosticCode =
  | 'source_parse_unsupported'
  | 'source_structure_ambiguous'
  | 'source_contract_invalid'
  | 'source_text_too_large'
  | 'source_tail_missing'
  | 'source_unit_missing_objective'
  | 'source_unit_duplicate_objective'
  | 'source_cross_unit_ownership';

export type SourceLocation = {
  blockId?: string;
  tableId?: string;
  rowIndex?: number;
  columnIndex?: number;
  pageNumber?: number;
};

export type SourceField = {
  id: string;
  label: string;
  value: string;
  state: SourceFieldState;
  sourceOrder: number;
  sourceLocation: SourceLocation;
};

export type SourceObjective = {
  id: string;
  unitId: string;
  sourceOrder: number;
  rawText: string;
  sourceLocation: SourceLocation;
};

export type SourceStep = {
  id: string;
  unitId: string;
  sourceOrder: number;
  sourceLabel: string;
  rawBlocks: string[];
  durationMinutes?: number;
  fieldState: SourceFieldState;
  sourceLocation: SourceLocation;
};

export type SourceUnit = {
  id: string;
  sourceOrdinal: number;
  sourceLabel: string;
  objectiveIds: string[];
  steps: SourceStep[];
  fields: Record<string, SourceField>;
};

export type SourceDiagnostic = {
  code: SourceDiagnosticCode;
  severity: SourceDiagnosticSeverity;
  message: string;
  sourceLocation?: SourceLocation;
};

export type LessonSourceManifest = {
  contractVersion: typeof LESSON_SOURCE_MANIFEST_VERSION;
  provenance: {
    origin: 'uploaded-file';
    format: SourceDocumentFormat;
    fileName: string;
    sourceHash: string;
    byteLength: number;
  };
  metadata: Record<string, SourceField>;
  objectives: SourceObjective[];
  units: SourceUnit[];
  diagnostics: SourceDiagnostic[];
};

export type LessonSourceManifestResult =
  | { ok: true; manifest: LessonSourceManifest }
  | { ok: false; diagnostics: SourceDiagnostic[] };

export type SourceManifestGenerationBoundary =
  | { ok: true; manifest: LessonSourceManifest | null }
  | { ok: false; message: string; diagnostics: SourceDiagnostic[] };

type MutableManifest = LessonSourceManifest & {
  _nextSourceOrder: number;
  _nextObjectiveNumber: number;
  _nextStepNumber: number;
};

type ExpandedCell = {
  cell: SourceTableCell;
  originRowIndex: number;
  originColumnIndex: number;
};

type ExpandedTable = {
  rows: Map<number, Map<number, ExpandedCell>>;
  diagnostics: SourceDiagnostic[];
};

type UnitColumn = {
  unit: SourceUnit;
  columnIndex: number;
};

type UnitRegistry = {
  byLabel: Map<string, SourceUnit>;
  byOrdinal: Map<number, SourceUnit>;
};

const MAX_SOURCE_TEXT_LENGTH = 1_000_000;
const OBJECTIVE_LABEL_REGEX = /^(?:learning\s+objectives?|objectives?|layunin(?:\s+sa\s+pagkatuto)?)\b/i;
const UNIT_HEADING_REGEX = /^(?:learning\s+session|session|day|araw|custom\s+unit|lesson)\s+\d+\b/i;
const BARE_UNIT_ORDINAL_REGEX = /^\d{1,2}$/;
const UNIT_HEADER_CONTEXT_REGEX = /\b(?:no\.\s*of\s*)?(?:learning\s+)?(?:sessions?|days?|lessons?)\b/i;
const FIELD_ROW_LABELS = new Set([
  'shared materials',
  'materials',
  'resources',
  'learning resources',
  'content standard',
  'performance standard',
  'competency',
  'competencies',
  'reflection',
  'reflections',
  'assignment',
  'assessment',
  'output',
]);

export const hasBlockingSourceDiagnostics = (diagnostics: SourceDiagnostic[]): boolean => (
  diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
);

export const formatSourceManifestDiagnostics = (diagnostics: SourceDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return Array.from(new Set(selected.map((diagnostic) => diagnostic.message))).join(' ');
};

export const resolveSourceManifestForGeneration = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  manifestResult: LessonSourceManifestResult | null,
): SourceManifestGenerationBoundary => {
  if (policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, manifest: null };
  }

  if (!manifestResult) {
    const diagnostics: SourceDiagnostic[] = [{
      code: 'source_contract_invalid',
      severity: 'blocking',
      message: 'The uploaded source was not converted into a lesson source manifest.',
    }];
    return { ok: false, message: formatSourceManifestDiagnostics(diagnostics), diagnostics };
  }

  if (manifestResult.ok === false) {
    return {
      ok: false,
      message: formatSourceManifestDiagnostics(manifestResult.diagnostics),
      diagnostics: manifestResult.diagnostics,
    };
  }

  const blockingDiagnostics = manifestResult.manifest.diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  if (blockingDiagnostics.length > 0) {
    return {
      ok: false,
      message: formatSourceManifestDiagnostics(blockingDiagnostics),
      diagnostics: blockingDiagnostics,
    };
  }

  return { ok: true, manifest: manifestResult.manifest };
};

export const buildLessonSourceManifest = (
  document: StructuredSourceDocument,
): LessonSourceManifestResult => {
  if (document.isScanned || (!document.plainText.trim() && document.blocks.length === 0 && document.tables.length === 0)) {
    return {
      ok: false,
      diagnostics: [{
        code: 'source_parse_unsupported',
        severity: 'blocking',
        message: 'The uploaded source does not contain extractable lesson text.',
      }],
    };
  }

  if (document.plainText.length > MAX_SOURCE_TEXT_LENGTH) {
    return {
      ok: false,
      diagnostics: [{
        code: 'source_text_too_large',
        severity: 'blocking',
        message: 'The uploaded source is too large to preserve without truncation.',
      }],
    };
  }

  const tableManifest = buildManifestFromTables(document);
  const result = tableManifest ?? buildManifestFromBlocks(document);
  if (!result.ok) return result;

  const diagnostics = validateManifest(result.manifest, document);
  if (hasBlockingSourceDiagnostics(diagnostics)) {
    return { ok: false, diagnostics };
  }

  result.manifest.diagnostics = diagnostics;
  return result;
};

const createManifest = (document: StructuredSourceDocument): MutableManifest => ({
  contractVersion: LESSON_SOURCE_MANIFEST_VERSION,
  provenance: {
    origin: 'uploaded-file',
    format: document.format,
    fileName: document.fileName,
    sourceHash: document.sourceHash,
    byteLength: document.byteLength,
  },
  metadata: {},
  objectives: [],
  units: [],
  diagnostics: [],
  _nextSourceOrder: 1,
  _nextObjectiveNumber: 1,
  _nextStepNumber: 1,
});

const finalizeManifest = (manifest: MutableManifest): LessonSourceManifest => {
  const { _nextSourceOrder, _nextObjectiveNumber, _nextStepNumber, ...finalManifest } = manifest;
  void _nextSourceOrder;
  void _nextObjectiveNumber;
  void _nextStepNumber;
  return finalManifest;
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const labelKey = (label: string): string => {
  const words = normalizeText(label)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'field';
  const [first, ...rest] = words;
  return [
    first.toLowerCase(),
    ...rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()),
  ].join('');
};

const padId = (prefix: string, value: number): string => `${prefix}-${String(value).padStart(3, '0')}`;

const nextFreeColumn = (row: Map<number, ExpandedCell>, startColumn: number): number => {
  let columnIndex = startColumn;
  while (row.has(columnIndex)) columnIndex += 1;
  return columnIndex;
};

const expandTable = (table: SourceDocumentTable): ExpandedTable => {
  const rows = new Map<number, Map<number, ExpandedCell>>();
  const diagnostics: SourceDiagnostic[] = [];

  for (const row of table.rows) {
    const rowGrid = rows.get(row.index) ?? new Map<number, ExpandedCell>();
    rows.set(row.index, rowGrid);
    let fallbackColumnIndex = 0;

    for (const cell of row.cells) {
      const originColumnIndex = typeof cell.sourceLocation.columnIndex === 'number'
        ? cell.sourceLocation.columnIndex
        : nextFreeColumn(rowGrid, fallbackColumnIndex);
      const originRowIndex = typeof cell.sourceLocation.rowIndex === 'number'
        ? cell.sourceLocation.rowIndex
        : row.index;
      fallbackColumnIndex = originColumnIndex + Math.max(1, cell.columnSpan);

      for (let rowOffset = 0; rowOffset < Math.max(1, cell.rowSpan); rowOffset += 1) {
        const targetRowIndex = row.index + rowOffset;
        const targetRow = rows.get(targetRowIndex) ?? new Map<number, ExpandedCell>();
        rows.set(targetRowIndex, targetRow);

        for (let columnOffset = 0; columnOffset < Math.max(1, cell.columnSpan); columnOffset += 1) {
          const targetColumnIndex = originColumnIndex + columnOffset;
          if (targetRow.has(targetColumnIndex)) {
            diagnostics.push({
              code: 'source_structure_ambiguous',
              severity: 'blocking',
              message: 'The uploaded source has overlapping table spans that cannot be assigned safely.',
              sourceLocation: cell.sourceLocation,
            });
            continue;
          }

          targetRow.set(targetColumnIndex, { cell, originRowIndex, originColumnIndex });
        }
      }
    }
  }

  return { rows, diagnostics };
};

const getUnitOrdinal = (value: string): number | null => {
  const label = normalizeText(value);
  const explicitMatch = label.match(/^(?:learning\s+session|session|day|araw|custom\s+unit|lesson)\s+(\d{1,2})\b/i);
  const bareMatch = label.match(BARE_UNIT_ORDINAL_REGEX);
  const ordinal = explicitMatch?.[1] ?? bareMatch?.[0];
  return ordinal ? Number.parseInt(ordinal, 10) : null;
};

const normalizeUnitIdentityLabel = (label: string): string => normalizeText(label).toLowerCase();

const isUnitLabel = (value: string, rowLabel = ''): boolean => {
  const label = normalizeText(value);
  if (UNIT_HEADING_REGEX.test(label)) return true;
  return BARE_UNIT_ORDINAL_REGEX.test(label) && UNIT_HEADER_CONTEXT_REGEX.test(rowLabel);
};

const getSortedRowIndexes = (table: ExpandedTable): number[] => (
  Array.from(table.rows.keys()).sort((a, b) => a - b)
);

const findUnitHeaderRow = (table: ExpandedTable): { rowIndex: number; columns: Array<{ columnIndex: number; label: string }> } | null => {
  for (const rowIndex of getSortedRowIndexes(table)) {
    const row = table.rows.get(rowIndex);
    if (!row) continue;
    const rowLabel = normalizeText(row.get(0)?.cell.text || '');
    const columns = Array.from(row.entries())
      .filter(([columnIndex]) => columnIndex > 0)
      .filter(([columnIndex, expanded]) => expanded.cell.columnSpan === 1 && expanded.originColumnIndex === columnIndex)
      .sort(([a], [b]) => a - b)
      .map(([columnIndex, expanded]) => ({
        columnIndex,
        label: normalizeText(expanded.cell.text),
      }))
      .filter((column) => column.label && isUnitLabel(column.label, rowLabel));

    if (columns.length >= 2) return { rowIndex, columns };
  }

  return null;
};

const cloneLocation = (location: SourceLocation): SourceLocation => ({ ...location });

const addObjective = (
  manifest: MutableManifest,
  unit: SourceUnit,
  rawText: string,
  sourceLocation: SourceLocation,
): void => {
  const objective: SourceObjective = {
    id: padId('obj', manifest._nextObjectiveNumber),
    unitId: unit.id,
    sourceOrder: manifest._nextSourceOrder,
    rawText,
    sourceLocation: cloneLocation(sourceLocation),
  };
  manifest._nextObjectiveNumber += 1;
  manifest._nextSourceOrder += 1;
  manifest.objectives.push(objective);
  unit.objectiveIds.push(objective.id);
};

const parseDurationMinutes = (label: string): number | undefined => {
  const match = label.match(/\b(\d{1,3})\s*(?:min|mins|minutes)\b/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
};

const addStep = (
  manifest: MutableManifest,
  unit: SourceUnit,
  sourceLabel: string,
  rawBlocks: string[],
  fieldState: SourceFieldState,
  sourceLocation: SourceLocation,
): void => {
  const step: SourceStep = {
    id: padId('step', manifest._nextStepNumber),
    unitId: unit.id,
    sourceOrder: manifest._nextSourceOrder,
    sourceLabel,
    rawBlocks,
    durationMinutes: parseDurationMinutes(sourceLabel),
    fieldState,
    sourceLocation: cloneLocation(sourceLocation),
  };
  manifest._nextStepNumber += 1;
  manifest._nextSourceOrder += 1;
  unit.steps.push(step);
};

const addField = (
  manifest: MutableManifest,
  fields: Record<string, SourceField>,
  label: string,
  value: string,
  state: SourceFieldState,
  sourceLocation: SourceLocation,
): void => {
  fields[labelKey(label)] = {
    id: `field-${String(Object.keys(fields).length + 1).padStart(3, '0')}`,
    label,
    value,
    state,
    sourceOrder: manifest._nextSourceOrder,
    sourceLocation: cloneLocation(sourceLocation),
  };
  manifest._nextSourceOrder += 1;
};

const isObjectiveLabel = (label: string): boolean => OBJECTIVE_LABEL_REGEX.test(label);

const isFieldRowLabel = (label: string): boolean => {
  const normalized = normalizeText(label).toLowerCase();
  if (FIELD_ROW_LABELS.has(normalized)) return true;
  return /\b(?:standard|competenc|resources?|materials?|reflection)\b/i.test(normalized);
};

const buildManifestFromTables = (document: StructuredSourceDocument): LessonSourceManifestResult | null => {
  if (document.tables.length === 0) return null;

  const manifest = createManifest(document);
  const diagnostics: SourceDiagnostic[] = [];
  const unitRegistry: UnitRegistry = {
    byLabel: new Map(),
    byOrdinal: new Map(),
  };

  for (const table of document.tables) {
    const expandedTable = expandTable(table);
    diagnostics.push(...expandedTable.diagnostics);
    if (hasBlockingSourceDiagnostics(diagnostics)) return { ok: false, diagnostics };

    const header = findUnitHeaderRow(expandedTable);
    if (!header) continue;

    const unitColumns: UnitColumn[] = header.columns.map((column) => {
      const unit = getOrCreateUnitForColumn(manifest, unitRegistry, column.label);
      return { unit, columnIndex: column.columnIndex };
    });

    for (const rowIndex of getSortedRowIndexes(expandedTable)) {
      if (rowIndex <= header.rowIndex) continue;
      const row = expandedTable.rows.get(rowIndex);
      if (!row) continue;
      const labelCell = row.get(0);
      const rowLabel = normalizeText(labelCell?.cell.text || '');
      if (!rowLabel || rowLabel.toLowerCase() === 'field') continue;

      if (isObjectiveLabel(rowLabel)) {
        const objectiveDiagnostics = collectObjectiveRowDiagnostics(row, unitColumns);
        if (objectiveDiagnostics.length > 0) {
          diagnostics.push(...objectiveDiagnostics);
          continue;
        }

        for (const { unit, columnIndex } of unitColumns) {
          const expanded = row.get(columnIndex);
          const text = normalizeText(expanded?.cell.text || '');
          if (!expanded || !text) continue;
          addObjective(manifest, unit, text, expanded.cell.sourceLocation);
        }
        continue;
      }

      if (isFieldRowLabel(rowLabel)) {
        for (const { unit, columnIndex } of unitColumns) {
          const expanded = row.get(columnIndex);
          if (!expanded) {
            addField(manifest, unit.fields, rowLabel, '', 'missing', {
              tableId: table.id,
              rowIndex,
              columnIndex,
            });
            continue;
          }

          const text = normalizeText(expanded.cell.text);
          addField(manifest, unit.fields, rowLabel, text, expanded.cell.state, expanded.cell.sourceLocation);
        }
        continue;
      }

      for (const { unit, columnIndex } of unitColumns) {
        const expanded = row.get(columnIndex);
        if (!expanded) continue;
        const text = normalizeText(expanded.cell.text);
        addStep(manifest, unit, rowLabel, text ? [text] : [], expanded.cell.state, expanded.cell.sourceLocation);
      }
    }
  }

  if (diagnostics.length > 0 && hasBlockingSourceDiagnostics(diagnostics)) {
    return { ok: false, diagnostics };
  }

  return { ok: true, manifest: finalizeManifest(manifest) };
};

const getOrCreateUnitForColumn = (
  manifest: MutableManifest,
  registry: UnitRegistry,
  label: string,
): SourceUnit => {
  const labelIdentity = normalizeUnitIdentityLabel(label);
  const ordinal = getUnitOrdinal(label);
  const existingUnit = registry.byLabel.get(labelIdentity) ?? (ordinal ? registry.byOrdinal.get(ordinal) : undefined);
  if (existingUnit) {
    registry.byLabel.set(labelIdentity, existingUnit);
    if (ordinal) registry.byOrdinal.set(ordinal, existingUnit);
    return existingUnit;
  }

  const unit: SourceUnit = {
    id: padId('unit', manifest.units.length + 1),
    sourceOrdinal: manifest.units.length + 1,
    sourceLabel: label,
    objectiveIds: [],
    steps: [],
    fields: {},
  };
  manifest.units.push(unit);
  registry.byLabel.set(labelIdentity, unit);
  if (ordinal) registry.byOrdinal.set(ordinal, unit);
  return unit;
};

const collectObjectiveRowDiagnostics = (
  row: Map<number, ExpandedCell>,
  unitColumns: UnitColumn[],
): SourceDiagnostic[] => {
  const diagnostics: SourceDiagnostic[] = [];
  const coverageByOrigin = new Map<string, { expanded: ExpandedCell; coveredUnits: SourceUnit[] }>();

  for (const { unit, columnIndex } of unitColumns) {
    const expanded = row.get(columnIndex);
    if (!expanded || !normalizeText(expanded.cell.text)) continue;
    const originKey = `${expanded.originRowIndex}:${expanded.originColumnIndex}`;
    const existing = coverageByOrigin.get(originKey);
    if (existing) {
      existing.coveredUnits.push(unit);
    } else {
      coverageByOrigin.set(originKey, { expanded, coveredUnits: [unit] });
    }
  }

  for (const { expanded, coveredUnits } of coverageByOrigin.values()) {
    if (coveredUnits.length > 1 || expanded.cell.columnSpan > 1) {
      diagnostics.push({
        code: 'source_structure_ambiguous',
        severity: 'blocking',
        message: 'The uploaded source has an objective whose unit ownership is ambiguous.',
        sourceLocation: expanded.cell.sourceLocation,
      });
    }
  }

  return diagnostics;
};

const buildManifestFromBlocks = (document: StructuredSourceDocument): LessonSourceManifestResult => {
  const manifest = createManifest(document);
  const diagnostics: SourceDiagnostic[] = [];
  let currentUnit: SourceUnit | null = null;

  const sortedBlocks = [...document.blocks].sort((a, b) => a.sourceOrder - b.sourceOrder);
  for (const block of sortedBlocks) {
    const text = normalizeText(block.text);
    if (!text) continue;

    if (block.kind === 'heading' && UNIT_HEADING_REGEX.test(text)) {
      currentUnit = {
        id: padId('unit', manifest.units.length + 1),
        sourceOrdinal: manifest.units.length + 1,
        sourceLabel: text,
        objectiveIds: [],
        steps: [],
        fields: {},
      };
      manifest.units.push(currentUnit);
      continue;
    }

    const labeled = splitLabelValue(text);
    if (!currentUnit) {
      if (labeled && (isObjectiveLabel(labeled.label) || looksLikeInstructionalStep(labeled.label))) {
        diagnostics.push({
          code: 'source_structure_ambiguous',
          severity: 'blocking',
          message: 'The uploaded source has instructional content before a unit owner is identified.',
          sourceLocation: block.sourceLocation,
        });
      } else {
        addField(manifest, manifest.metadata, text, text, 'present', block.sourceLocation);
      }
      continue;
    }

    if (!labeled) {
      addStep(manifest, currentUnit, 'Source block', [text], 'present', block.sourceLocation);
      continue;
    }

    if (isObjectiveLabel(labeled.label)) {
      addObjective(manifest, currentUnit, labeled.value, block.sourceLocation);
      continue;
    }

    addStep(manifest, currentUnit, labeled.label, [labeled.value], 'present', block.sourceLocation);
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, manifest: finalizeManifest(manifest) };
};

const splitLabelValue = (text: string): { label: string; value: string } | null => {
  const match = text.match(/^([^:]{1,80}):\s*(.*)$/);
  if (!match) return null;
  return {
    label: normalizeText(match[1]),
    value: normalizeText(match[2]),
  };
};

const looksLikeInstructionalStep = (label: string): boolean => (
  /\b(?:activity|analysis|abstraction|application|launch|practice|investigation|synthesis|engage|explore|explain|elaborate|evaluate)\b/i.test(label)
);

const validateManifest = (
  manifest: LessonSourceManifest,
  document: StructuredSourceDocument,
): SourceDiagnostic[] => {
  const diagnostics: SourceDiagnostic[] = [...manifest.diagnostics];

  if (manifest.units.length === 0) {
    diagnostics.push({
      code: 'source_contract_invalid',
      severity: 'blocking',
      message: 'The uploaded source did not expose any lesson units.',
    });
  }

  const unitIds = new Set(manifest.units.map((unit) => unit.id));
  const objectiveById = new Map(manifest.objectives.map((objective) => [objective.id, objective]));
  for (const objective of manifest.objectives) {
    if (!objective.unitId || !unitIds.has(objective.unitId)) {
      diagnostics.push({
        code: 'source_cross_unit_ownership',
        severity: 'blocking',
        message: 'The uploaded source has an objective without exactly one owning unit.',
        sourceLocation: objective.sourceLocation,
      });
    }
  }

  const anyUnitHasObjectives = manifest.units.some((unit) => unit.objectiveIds.length > 0);
  const unitsMissingObjectives = manifest.units.filter((unit) => unit.objectiveIds.length === 0 && anyUnitHasObjectives);
  if (unitsMissingObjectives.length > 0) {
    diagnostics.push({
      code: 'source_unit_missing_objective',
      severity: 'blocking',
      message: formatMissingObjectiveDiagnostic(unitsMissingObjectives),
    });
  }

  for (const unit of manifest.units) {
    if (unit.steps.length === 0) {
      diagnostics.push({
        code: 'source_contract_invalid',
        severity: 'blocking',
        message: `The uploaded source is missing source-defined instructional steps for ${unit.sourceLabel}.`,
      });
    }

    for (const objectiveId of unit.objectiveIds) {
      const objective = objectiveById.get(objectiveId);
      if (!objective || objective.unitId !== unit.id) {
        diagnostics.push({
          code: 'source_cross_unit_ownership',
          severity: 'blocking',
          message: `The uploaded source has conflicting objective ownership for ${unit.sourceLabel}.`,
        });
      }
    }
  }

  validateMonotonicSourceOrder(manifest, diagnostics);
  validateStepIds(manifest, diagnostics);
  validateTailSentinel(manifest, document, diagnostics);
  validateStepOwnershipSentinels(manifest, diagnostics);

  return diagnostics;
};

const formatMissingObjectiveDiagnostic = (units: SourceUnit[]): string => {
  if (units.length === 1) {
    return `The uploaded source is missing a unit-owned objective for ${units[0].sourceLabel}.`;
  }

  return `The uploaded source is missing a unit-owned objective for ${units.length} source units: ${units
    .map((unit) => unit.sourceLabel)
    .join(', ')}.`;
};

const validateMonotonicSourceOrder = (
  manifest: LessonSourceManifest,
  diagnostics: SourceDiagnostic[],
): void => {
  const ordered = [
    ...manifest.objectives.map((objective) => ({ sourceOrder: objective.sourceOrder, location: objective.sourceLocation })),
    ...manifest.units.flatMap((unit) => unit.steps.map((step) => ({ sourceOrder: step.sourceOrder, location: step.sourceLocation }))),
  ].sort((a, b) => a.sourceOrder - b.sourceOrder);

  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].sourceOrder <= ordered[index - 1].sourceOrder) {
      diagnostics.push({
        code: 'source_contract_invalid',
        severity: 'blocking',
        message: 'The uploaded source produced non-monotonic source ordering.',
        sourceLocation: ordered[index].location,
      });
      return;
    }
  }
};

const validateStepIds = (
  manifest: LessonSourceManifest,
  diagnostics: SourceDiagnostic[],
): void => {
  const steps = manifest.units
    .flatMap((unit) => unit.steps)
    .sort((a, b) => a.sourceOrder - b.sourceOrder);
  for (let index = 0; index < steps.length; index += 1) {
    if (steps[index].id !== padId('step', index + 1)) {
      diagnostics.push({
        code: 'source_contract_invalid',
        severity: 'blocking',
        message: 'The uploaded source produced non-monotonic source-step IDs.',
        sourceLocation: steps[index].sourceLocation,
      });
      return;
    }
  }
};

const validateTailSentinel = (
  manifest: LessonSourceManifest,
  document: StructuredSourceDocument,
  diagnostics: SourceDiagnostic[],
): void => {
  if (!/\b(?:TAIL|OMEGA)\b/.test(document.plainText)) return;

  const preservedText = [
    ...manifest.objectives.map((objective) => objective.rawText),
    ...manifest.units.flatMap((unit) => unit.steps.flatMap((step) => step.rawBlocks)),
  ].join('\n');
  if (/\b(?:TAIL|OMEGA)\b/.test(preservedText)) return;

  diagnostics.push({
    code: 'source_tail_missing',
    severity: 'blocking',
    message: 'The uploaded source tail sentinel was not preserved in the manifest.',
  });
};

const validateStepOwnershipSentinels = (
  manifest: LessonSourceManifest,
  diagnostics: SourceDiagnostic[],
): void => {
  for (const unit of manifest.units) {
    for (const step of unit.steps) {
      const text = step.rawBlocks.join('\n');
      for (const match of text.matchAll(/\bS(\d+)-/g)) {
        const sentinelUnit = Number.parseInt(match[1], 10);
        if (sentinelUnit !== unit.sourceOrdinal) {
          diagnostics.push({
            code: 'source_cross_unit_ownership',
            severity: 'blocking',
            message: `The uploaded source step for ${unit.sourceLabel} contains another unit's sentinel.`,
            sourceLocation: step.sourceLocation,
          });
          return;
        }
      }
    }
  }
};
