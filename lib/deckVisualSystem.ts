import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';

export const DECK_VISUAL_SYSTEM_VERSION = 'deck-visual-system-v1';

export type VisualSystemDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type VisualSystemDiagnosticCode =
  | 'visual_system_contract_invalid'
  | 'visual_system_missing_unit'
  | 'visual_system_color_conflict'
  | 'visual_system_contrast_failed'
  | 'visual_system_private_text_leak';

export type VisualPalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  mutedInk: string;
  accentCool: string;
  accentWarm: string;
  success: string;
  warning: string;
  danger: string;
};

export type SemanticColorAssignment = {
  conceptId: string;
  color: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  storyboardScreenIds: string[];
  semanticSlideSpecIds: string[];
};

export type TypographyTokens = {
  headingFont: 'Poppins';
  bodyFont: 'Poppins';
  labelFont: 'Poppins';
  titleSize: number;
  bodySize: number;
  labelSize: number;
  minReadableSize: number;
};

export type ShapeLanguageTokens = {
  cornerRadius: number;
  cardStrokeWidth: number;
  connectorStrokeWidth: number;
  iconStrokeWidth: number;
  density: 'compact' | 'balanced' | 'spacious';
};

export type DeckVisualSystem = {
  contractVersion: typeof DECK_VISUAL_SYSTEM_VERSION;
  id: string;
  unitId: string;
  provenance: {
    sourceUnitIds: string[];
    storyboardScreenIds: string[];
    semanticSlideSpecIds: string[];
    sourceStepIds: string[];
    sourceObjectiveIds: string[];
  };
  palette: VisualPalette;
  semanticColors: Record<string, SemanticColorAssignment>;
  typography: TypographyTokens;
  shapeLanguage: ShapeLanguageTokens;
  iconStyle: 'outline-rounded';
  diagramStyle: 'editable-line-diagram';
  illustrationStyle: 'text-free-instructional';
  accessibility: {
    minContrastRatio: 4.5;
    contrastPairs: Array<{ foreground: string; background: string; ratio: number; pass: boolean }>;
  };
  diagnostics: VisualSystemDiagnostic[];
};

export type DeckVisualSystemBundle = {
  contractVersion: typeof DECK_VISUAL_SYSTEM_VERSION;
  systemsByUnitId: Record<string, DeckVisualSystem>;
};

export type VisualSystemDiagnostic = {
  code: VisualSystemDiagnosticCode;
  severity: VisualSystemDiagnosticSeverity;
  message: string;
  unitId?: string;
  conceptId?: string;
};

export type DeckVisualSystemResult =
  | { ok: true; bundle: DeckVisualSystemBundle }
  | { ok: false; diagnostics: VisualSystemDiagnostic[] };

const DEFAULT_PALETTE: VisualPalette = {
  background: 'FFFFFF',
  surface: 'F8FAFC',
  surfaceMuted: 'E2E8F0',
  ink: '111827',
  mutedInk: '475569',
  accentCool: '0F766E',
  accentWarm: 'C2410C',
  success: '15803D',
  warning: 'A16207',
  danger: 'B91C1C',
};

export type DeckTheme = {
  id: string;
  palette: VisualPalette;
};

// Deterministic, accessible per-deck themes. Every palette keeps near-black ink
// on light surfaces and dark accents that carry white text at >= 4.5:1, so the
// contrast contract holds for any selected theme. Themes vary the accent hues
// and surface tints to give each deck its own identity without any model call.
export const DECK_THEMES: readonly DeckTheme[] = [
  {
    id: 'theme-teal-rust',
    palette: DEFAULT_PALETTE,
  },
  {
    id: 'theme-indigo-amber',
    palette: {
      background: 'FFFFFF',
      surface: 'F5F5FF',
      surfaceMuted: 'E0E2F5',
      ink: '111827',
      mutedInk: '475569',
      accentCool: '4338CA',
      accentWarm: 'B45309',
      success: '15803D',
      warning: 'A16207',
      danger: 'B91C1C',
    },
  },
  {
    id: 'theme-blue-magenta',
    palette: {
      background: 'FFFFFF',
      surface: 'F3F8FF',
      surfaceMuted: 'DCE7F5',
      ink: '111827',
      mutedInk: '44556B',
      accentCool: '1D4ED8',
      accentWarm: 'BE185D',
      success: '047857',
      warning: 'A16207',
      danger: 'B91C1C',
    },
  },
  {
    id: 'theme-emerald-purple',
    palette: {
      background: 'FFFFFF',
      surface: 'F2FBF6',
      surfaceMuted: 'D9EEE2',
      ink: '111827',
      mutedInk: '3F5560',
      accentCool: '047857',
      accentWarm: '7E22CE',
      success: '15803D',
      warning: 'A16207',
      danger: 'B91C1C',
    },
  },
  {
    id: 'theme-cyan-crimson',
    palette: {
      background: 'FFFFFF',
      surface: 'F2FAFC',
      surfaceMuted: 'D6E9EF',
      ink: '111827',
      mutedInk: '405663',
      accentCool: '0E7490',
      accentWarm: 'B91C1C',
      success: '15803D',
      warning: 'A16207',
      danger: 'B91C1C',
    },
  },
];

export const paletteMeetsContrast = (palette: VisualPalette): boolean => (
  contrastPairsForPalette(palette).every((pair) => pair.pass)
);

export const deckThemeKeyForSpecs = (specs: readonly SemanticSlideSpec[]): string => {
  const provenance = unique([
    ...specs.map((spec) => spec.unitId),
    ...specs.flatMap((spec) => spec.sourceObjectiveIds),
    ...specs.flatMap((spec) => spec.sourceStepIds),
    ...specs.map((spec) => spec.storyboardScreenId),
  ]).sort();
  return provenance.join('|');
};

// Canonical deck theme key. Generated structural ids (unit-001, obj-001,
// screen-001) collide across unrelated lessons, so the theme is anchored to the
// storyboard's source provenance (sourceHash + selected source units) first, with
// the structural spec key as a secondary discriminator. Two structurally
// identical decks built from different source documents therefore theme apart.
export const deckThemeKeyForStoryboard = (
  storyboard: TeachingStoryboard,
  specs: readonly SemanticSlideSpec[],
): string => {
  const selectedUnitIds = unique(storyboard.provenance.selectedUnitIds).sort();
  return [
    `source:${storyboard.provenance.sourceHash}`,
    `units:${selectedUnitIds.join(',')}`,
    `structure:${deckThemeKeyForSpecs(specs)}`,
  ].join('||');
};

export const selectDeckTheme = (deckKey: string): DeckTheme => (
  DECK_THEMES[stableHash(deckKey) % DECK_THEMES.length]
);

const SEMANTIC_COLOR_SLOTS: readonly (keyof VisualPalette)[] = [
  'accentCool',
  'accentWarm',
  'success',
  'warning',
  'danger',
  'mutedInk',
];

const PRIVATE_TEXT_PATTERN =
  /\b(?:teacher\s+[a-z]+|sample\s+school|school\s+id|student\s+name|learner\s+name|private\s+sentence|maria)\b/i;

const visualDiagnostic = (
  code: VisualSystemDiagnosticCode,
  message: string,
  detail: Pick<VisualSystemDiagnostic, 'unitId' | 'conceptId'> = {},
): VisualSystemDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  ...detail,
});

const unique = (values: readonly string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const normalizeHex = (value: string): string => value.replace(/^#/, '').trim().toUpperCase();

const hexToRgb = (value: string): [number, number, number] | null => {
  const hex = normalizeHex(value);
  if (!/^[0-9A-F]{6}$/.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
};

const channelToLinear = (value: number): number => {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const contrastRatio = (foreground: string, background: string): number => {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return 0;
  const luminance = ([r, g, b]: [number, number, number]) => (
    0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
  );
  const fgLum = luminance(fg);
  const bgLum = luminance(bg);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
};

const contrastPair = (foreground: string, background: string) => {
  const ratio = contrastRatio(foreground, background);
  return {
    foreground: normalizeHex(foreground),
    background: normalizeHex(background),
    ratio,
    pass: ratio >= 4.5,
  };
};

const contrastPairsForPalette = (palette: VisualPalette): DeckVisualSystem['accessibility']['contrastPairs'] => [
  contrastPair(palette.ink, palette.background),
  contrastPair(palette.ink, palette.surface),
  contrastPair(palette.mutedInk, palette.background),
  contrastPair(palette.ink, palette.surfaceMuted),
  contrastPair('FFFFFF', palette.accentCool),
  contrastPair('FFFFFF', palette.accentWarm),
];

const conceptIdsForSpec = (spec: SemanticSlideSpec): string[] => {
  const concepts = [
    ...spec.sourceObjectiveIds.map((id) => `objective:${id}`),
    ...spec.sourceStepIds.map((id) => `step:${id}`),
  ];
  return concepts.length > 0 ? concepts : [`screen:${spec.storyboardScreenId}`];
};

const colorForConcept = (conceptId: string, palette: VisualPalette): string => {
  const slot = SEMANTIC_COLOR_SLOTS[stableHash(conceptId) % SEMANTIC_COLOR_SLOTS.length];
  return palette[slot];
};

const appendUnique = (target: string[], values: readonly string[]): void => {
  for (const value of values) {
    if (value && !target.includes(value)) target.push(value);
  }
};

const containsPrivateText = (value: string): boolean => {
  const trimmed = value.trim();
  return PRIVATE_TEXT_PATTERN.test(trimmed) || (trimmed.length > 90 && /\s/.test(trimmed));
};

const buildDeckVisualSystemForUnit = (
  unitSpecs: readonly SemanticSlideSpec[],
  unitId: string,
  palette: VisualPalette = DEFAULT_PALETTE,
): DeckVisualSystem => {
  const semanticColors: Record<string, SemanticColorAssignment> = {};

  for (const spec of unitSpecs) {
    for (const conceptId of conceptIdsForSpec(spec)) {
      const existing = semanticColors[conceptId] ?? {
        conceptId,
        color: colorForConcept(conceptId, palette),
        sourceStepIds: [],
        sourceObjectiveIds: [],
        storyboardScreenIds: [],
        semanticSlideSpecIds: [],
      };
      appendUnique(existing.sourceStepIds, spec.sourceStepIds);
      appendUnique(existing.sourceObjectiveIds, spec.sourceObjectiveIds);
      appendUnique(existing.storyboardScreenIds, [spec.storyboardScreenId]);
      appendUnique(existing.semanticSlideSpecIds, [spec.id]);
      semanticColors[conceptId] = existing;
    }
  }

  const system: DeckVisualSystem = {
    contractVersion: DECK_VISUAL_SYSTEM_VERSION,
    id: `visual-system-${unitId}`,
    unitId,
    provenance: {
      sourceUnitIds: [unitId],
      storyboardScreenIds: unique(unitSpecs.map((spec) => spec.storyboardScreenId)),
      semanticSlideSpecIds: unique(unitSpecs.map((spec) => spec.id)),
      sourceStepIds: unique(unitSpecs.flatMap((spec) => spec.sourceStepIds)),
      sourceObjectiveIds: unique(unitSpecs.flatMap((spec) => spec.sourceObjectiveIds)),
    },
    palette: { ...palette },
    semanticColors,
    typography: {
      headingFont: 'Poppins',
      bodyFont: 'Poppins',
      labelFont: 'Poppins',
      titleSize: 40,
      bodySize: 24,
      labelSize: 16,
      minReadableSize: 16,
    },
    shapeLanguage: {
      cornerRadius: 24,
      cardStrokeWidth: 1,
      connectorStrokeWidth: 1.5,
      iconStrokeWidth: 2,
      density: 'balanced',
    },
    iconStyle: 'outline-rounded',
    diagramStyle: 'editable-line-diagram',
    illustrationStyle: 'text-free-instructional',
    accessibility: {
      minContrastRatio: 4.5,
      contrastPairs: contrastPairsForPalette(palette),
    },
    diagnostics: [],
  };

  system.diagnostics = validateDeckVisualSystem(system);
  return system;
};

export const isDeckVisualSystemV1Enabled = (flagValue: unknown): boolean => {
  if (typeof flagValue !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(flagValue.trim().toLowerCase());
};

export const validateDeckVisualSystem = (system: DeckVisualSystem): VisualSystemDiagnostic[] => {
  const diagnostics: VisualSystemDiagnostic[] = [];

  if (
    system.contractVersion !== DECK_VISUAL_SYSTEM_VERSION
    || !system.id
    || !system.unitId
    || system.id !== `visual-system-${system.unitId}`
  ) {
    diagnostics.push(visualDiagnostic(
      'visual_system_contract_invalid',
      'Deck visual system does not match the Gate 4 contract.',
      { unitId: system.unitId },
    ));
  }

  if (
    !system.provenance.sourceUnitIds.includes(system.unitId)
    || system.provenance.storyboardScreenIds.length === 0
    || system.provenance.semanticSlideSpecIds.length === 0
  ) {
    diagnostics.push(visualDiagnostic(
      'visual_system_missing_unit',
      `Deck visual system ${system.id} is missing source-unit provenance.`,
      { unitId: system.unitId },
    ));
  }

  const recomputedPairs = contrastPairsForPalette(system.palette);
  if (recomputedPairs.some((pair) => !pair.pass)) {
    diagnostics.push(visualDiagnostic(
      'visual_system_contrast_failed',
      `Deck visual system ${system.id} has a palette contrast pair below 4.5:1.`,
      { unitId: system.unitId },
    ));
  }

  for (const [conceptId, assignment] of Object.entries(system.semanticColors)) {
    if (assignment.conceptId !== conceptId || containsPrivateText(conceptId)) {
      diagnostics.push(visualDiagnostic(
        'visual_system_private_text_leak',
        `Deck visual system ${system.id} contains unsafe concept metadata.`,
        { unitId: system.unitId, conceptId },
      ));
    }

    if (!normalizeHex(assignment.color).match(/^[0-9A-F]{6}$/)) {
      diagnostics.push(visualDiagnostic(
        'visual_system_color_conflict',
        `Deck visual system ${system.id} assigns an invalid semantic color.`,
        { unitId: system.unitId, conceptId },
      ));
    }
  }

  return diagnostics;
};

export const buildDeckVisualSystems = (
  storyboard: TeachingStoryboard,
  specs: readonly SemanticSlideSpec[],
): DeckVisualSystemResult => {
  const unitIds = unique(specs.map((spec) => spec.unitId));
  if (unitIds.length === 0) {
    return {
      ok: false,
      diagnostics: [visualDiagnostic('visual_system_missing_unit', 'No selected source units are available for a deck visual system.')],
    };
  }

  const theme = selectDeckTheme(deckThemeKeyForStoryboard(storyboard, specs));
  const systemsByUnitId = Object.fromEntries(unitIds.map((unitId) => {
    const unitSpecs = specs.filter((spec) => spec.unitId === unitId);
    return [unitId, buildDeckVisualSystemForUnit(unitSpecs, unitId, theme.palette)];
  }));
  const diagnostics = Object.values(systemsByUnitId).flatMap((system) => validateDeckVisualSystem(system));

  return diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
    ? { ok: false, diagnostics }
    : { ok: true, bundle: { contractVersion: DECK_VISUAL_SYSTEM_VERSION, systemsByUnitId } };
};

export const formatVisualSystemDiagnostics = (diagnostics: readonly VisualSystemDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};
