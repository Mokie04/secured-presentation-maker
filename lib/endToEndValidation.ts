import {
  validateDeckVisualSystem,
  type DeckVisualSystemBundle,
} from './deckVisualSystem.ts';
import type { CompiledScenePresentation } from './compiledSlideScene.ts';
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import { validatePptxRoundTrip } from './pptxRoundTripValidation.ts';
import { validateRenderedScenes } from './renderedSceneValidation.ts';
import type { SceneAssetRequest } from './sceneAssetRequests.ts';
import { validateSceneAssetRequests } from './sceneAssetRequests.ts';
import type { SceneResolvedAsset } from './sceneAssetResolver.ts';
import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import { validateSourceAlignment } from './sourceAlignmentValidation.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';

export const END_TO_END_VALIDATION_VERSION = 'end-to-end-validation-v1';

export type EndToEndDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type EndToEndDiagnosticCode =
  | 'e2e_source_manifest_invalid'
  | 'e2e_source_step_coverage_failed'
  | 'e2e_objective_preservation_failed'
  | 'e2e_sequence_inversion'
  | 'e2e_foreign_session_content'
  | 'e2e_unsupported_invention'
  | 'e2e_blank_field_invented'
  | 'e2e_teacher_script_visible'
  | 'e2e_visual_system_invalid'
  | 'e2e_asset_invalid'
  | 'e2e_scene_render_invalid'
  | 'e2e_preview_text_not_editable'
  | 'e2e_pptx_round_trip_invalid'
  | 'e2e_full_slide_raster'
  | 'e2e_cache_write_forbidden';

export type EndToEndDiagnostic = {
  code: EndToEndDiagnosticCode;
  severity: EndToEndDiagnosticSeverity;
  message: string;
  unitId?: string;
  sourceStepId?: string;
  sourceObjectiveId?: string;
  storyboardScreenId?: string;
  semanticSlideSpecId?: string;
  sceneId?: string;
  elementId?: string;
};

export type ValidationSummary = {
  checked: number;
  passed: number;
  failed: number;
  blocking: number;
};

export type SourceAlignmentSummary = ValidationSummary & {
  sourceStepCoverageRatio: number;
  objectiveCoverageRatio: number;
  sequenceInversionCount: number;
  foreignSessionContentCount: number;
  unsupportedInventionCount: number;
  blankFieldInventionCount: number;
  teacherScriptViolationCount: number;
};

export type RenderValidationSummary = ValidationSummary & {
  renderedSceneCount: number;
  canvasWidth: 1280;
  canvasHeight: 720;
  offCanvasCount: number;
  overflowCount: number;
  unreadableTextCount: number;
  uneditableVisibleTextCount: number;
  fullSlideRasterCount: number;
};

export type PptxRoundTripSummary = ValidationSummary & {
  slideCount: number;
  nativeTextOperationCount: number;
  nativeTableOperationCount: number;
  nativeShapeOperationCount: number;
  imageOperationCount: number;
  speakerNotesCount: number;
  extractedTextCount: number;
  extractedNotesCount: number;
  fullSlideImageCount: number;
};

export type CacheSafetyDecision = {
  cacheContractVersion: 'source-primary-scene-cache-v1';
  validationVersion: typeof END_TO_END_VALIDATION_VERSION;
  mayWriteSuccessCache: boolean;
  mayDeliverPresentation: boolean;
  reason: 'validation_passed' | 'validation_failed' | 'route_not_cacheable';
};

export type EndToEndValidationReport = {
  contractVersion: typeof END_TO_END_VALIDATION_VERSION;
  route: {
    mode: 'source-primary';
    inputOrigin: 'uploaded-file';
  };
  sourceManifest: ValidationSummary & {
    contractVersion: string;
    sourceHash: string;
    selectedUnitIds: string[];
    objectiveCount: number;
    sourceStepCount: number;
  };
  storyboard: SourceAlignmentSummary;
  semanticSpecs: SourceAlignmentSummary & {
    specCount: number;
  };
  visualSystemAndAssets: ValidationSummary & {
    visualSystemCount: number;
    assetRequestCount: number;
    resolvedAssetCount: number;
    omittedOptionalAssetCount: number;
  };
  scenes: RenderValidationSummary;
  renderedPreview: RenderValidationSummary;
  pptxRoundTrip: PptxRoundTripSummary;
  cacheSafety: CacheSafetyDecision;
  diagnostics: EndToEndDiagnostic[];
};

export type EndToEndValidationInput = {
  sourceManifest: LessonSourceManifest;
  storyboard: TeachingStoryboard;
  semanticSpecs: SemanticSlideSpec[];
  visualSystems: DeckVisualSystemBundle;
  assetRequests: SceneAssetRequest[];
  resolvedAssetsBySpecId: Record<string, SceneResolvedAsset[]>;
  presentation: CompiledScenePresentation;
};

export type EndToEndValidationResult =
  | { ok: true; report: EndToEndValidationReport }
  | { ok: false; report: EndToEndValidationReport; message: string; diagnostics: EndToEndDiagnostic[] };

export const isEndToEndValidationV1Enabled = (flagValue: unknown): boolean => {
  if (typeof flagValue !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(flagValue.trim().toLowerCase());
};

export const hasBlockingEndToEndDiagnostics = (diagnostics: readonly EndToEndDiagnostic[]): boolean => (
  diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
);

export const formatEndToEndDiagnostics = (diagnostics: readonly EndToEndDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};

const summaryFromDiagnostics = (
  checked: number,
  diagnostics: readonly EndToEndDiagnostic[],
): ValidationSummary => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking').length;
  const failed = diagnostics.length;
  return {
    checked,
    passed: failed === 0 ? checked : Math.max(0, checked - failed),
    failed,
    blocking,
  };
};

const cacheSafetyFromDiagnostics = (diagnostics: readonly EndToEndDiagnostic[]): CacheSafetyDecision => {
  const blocked = hasBlockingEndToEndDiagnostics(diagnostics);
  return {
    cacheContractVersion: 'source-primary-scene-cache-v1',
    validationVersion: END_TO_END_VALIDATION_VERSION,
    mayWriteSuccessCache: !blocked,
    mayDeliverPresentation: !blocked,
    reason: blocked ? 'validation_failed' : 'validation_passed',
  };
};

const sourceManifestDiagnostics = (input: EndToEndValidationInput): EndToEndDiagnostic[] => {
  const diagnostics: EndToEndDiagnostic[] = [];
  if (
    input.sourceManifest.provenance.origin !== 'uploaded-file'
    || input.sourceManifest.units.length === 0
    || input.sourceManifest.contractVersion !== 'lesson-source-manifest-v1'
  ) {
    diagnostics.push({
      code: 'e2e_source_manifest_invalid',
      severity: 'blocking',
      message: 'The source-primary scene deck is missing a valid uploaded lesson source manifest.',
    });
  }

  diagnostics.push(...input.sourceManifest.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'blocking')
    .map((diagnostic): EndToEndDiagnostic => ({
      code: 'e2e_source_manifest_invalid',
      severity: 'blocking',
      message: diagnostic.message,
    })));

  return diagnostics;
};

const visualSystemAndAssetDiagnostics = (input: EndToEndValidationInput): EndToEndDiagnostic[] => {
  const visualDiagnostics = Object.values(input.visualSystems.systemsByUnitId)
    .flatMap((system) => validateDeckVisualSystem(system))
    .map((diagnostic): EndToEndDiagnostic => ({
      code: 'e2e_visual_system_invalid',
      severity: diagnostic.severity,
      message: diagnostic.message,
      unitId: diagnostic.unitId,
    }));

  const assetDiagnostics = validateSceneAssetRequests(
    input.assetRequests,
    input.storyboard,
    input.semanticSpecs,
    input.visualSystems,
  ).map((diagnostic): EndToEndDiagnostic => ({
    code: 'e2e_asset_invalid',
    severity: diagnostic.severity,
    message: diagnostic.message,
    semanticSlideSpecId: diagnostic.semanticSlideSpecId,
  }));

  return [...visualDiagnostics, ...assetDiagnostics];
};

export const buildEndToEndValidationReport = (
  input: EndToEndValidationInput,
  diagnostics: readonly EndToEndDiagnostic[],
  summaries: {
    sourceAlignment: SourceAlignmentSummary;
    semanticSpecs: EndToEndValidationReport['semanticSpecs'];
    scenes: RenderValidationSummary;
    renderedPreview: RenderValidationSummary;
    pptxRoundTrip: PptxRoundTripSummary;
    visualSystemAndAssets: EndToEndValidationReport['visualSystemAndAssets'];
  },
): EndToEndValidationReport => {
  const selectedUnitIds = input.storyboard.provenance.selectedUnitIds.length > 0
    ? input.storyboard.provenance.selectedUnitIds
    : input.sourceManifest.units.map((unit) => unit.id);
  const selectedUnitIdSet = new Set(selectedUnitIds);
  const selectedSteps = input.sourceManifest.units
    .filter((unit) => selectedUnitIdSet.has(unit.id))
    .flatMap((unit) => unit.steps);
  const selectedObjectives = input.sourceManifest.objectives
    .filter((objective) => selectedUnitIdSet.has(objective.unitId));
  const sourceManifestSummary = summaryFromDiagnostics(
    Math.max(1, selectedUnitIds.length + selectedSteps.length + selectedObjectives.length),
    diagnostics.filter((diagnostic) => diagnostic.code === 'e2e_source_manifest_invalid'),
  );
  const cacheSafety = cacheSafetyFromDiagnostics(diagnostics);

  return {
    contractVersion: END_TO_END_VALIDATION_VERSION,
    route: { mode: 'source-primary', inputOrigin: 'uploaded-file' },
    sourceManifest: {
      ...sourceManifestSummary,
      contractVersion: input.sourceManifest.contractVersion,
      sourceHash: input.sourceManifest.provenance.sourceHash,
      selectedUnitIds,
      objectiveCount: selectedObjectives.length,
      sourceStepCount: selectedSteps.length,
    },
    storyboard: summaries.sourceAlignment,
    semanticSpecs: summaries.semanticSpecs,
    visualSystemAndAssets: summaries.visualSystemAndAssets,
    scenes: summaries.scenes,
    renderedPreview: summaries.renderedPreview,
    pptxRoundTrip: summaries.pptxRoundTrip,
    cacheSafety,
    diagnostics: [...diagnostics],
  };
};

export const validateEndToEndScenePresentation = (
  input: EndToEndValidationInput,
): EndToEndValidationResult => {
  const sourceAlignment = validateSourceAlignment(input);
  const renderedScenes = validateRenderedScenes(input.presentation);
  const pptxRoundTrip = validatePptxRoundTrip(input.presentation);
  const visualDiagnostics = visualSystemAndAssetDiagnostics(input);
  const manifestDiagnostics = sourceManifestDiagnostics(input);
  const allDiagnostics = [
    ...manifestDiagnostics,
    ...sourceAlignment.diagnostics,
    ...visualDiagnostics,
    ...renderedScenes.diagnostics,
    ...pptxRoundTrip.diagnostics,
  ];
  const resolvedAssets = Object.values(input.resolvedAssetsBySpecId).flat();
  const requestById = new Map(input.assetRequests.map((request) => [request.id, request] as const));
  const visualSystemAndAssetsDiagnostics = visualDiagnostics;
  const visualSystemAndAssets = {
    ...summaryFromDiagnostics(
      Object.keys(input.visualSystems.systemsByUnitId).length + input.assetRequests.length + resolvedAssets.length,
      visualSystemAndAssetsDiagnostics,
    ),
    visualSystemCount: Object.keys(input.visualSystems.systemsByUnitId).length,
    assetRequestCount: input.assetRequests.length,
    resolvedAssetCount: resolvedAssets.length,
    omittedOptionalAssetCount: resolvedAssets.filter((asset) => {
      const request = requestById.get(asset.requestId);
      return asset.kind === 'omitted' && request?.necessity !== 'required';
    }).length,
  };
  const report = buildEndToEndValidationReport(input, allDiagnostics, {
    sourceAlignment: sourceAlignment.summary,
    semanticSpecs: {
      ...sourceAlignment.summary,
      specCount: input.semanticSpecs.length,
    },
    scenes: renderedScenes.summary,
    renderedPreview: renderedScenes.summary,
    pptxRoundTrip: pptxRoundTrip.summary,
    visualSystemAndAssets,
  });

  if (hasBlockingEndToEndDiagnostics(allDiagnostics)) {
    return {
      ok: false,
      report,
      message: formatEndToEndDiagnostics(allDiagnostics),
      diagnostics: allDiagnostics,
    };
  }

  return { ok: true, report };
};
