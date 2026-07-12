import type { EndToEndValidationReport } from './endToEndValidation.ts';
import type {
  SourcePrimarySceneRolloutDecision,
  SourcePrimarySceneRolloutReason,
  SourcePrimarySceneRolloutStage,
} from './sourcePrimarySceneRollout.ts';
import type { K12InputOrigin, K12RouteMode } from './k12GenerationRoutePolicy.ts';

export const SOURCE_PRIMARY_SCENE_TELEMETRY_VERSION = 'source-primary-scene-telemetry-v1';

export type SourcePrimarySceneTelemetryDiagnosticCode =
  | 'telemetry_forbidden_field'
  | 'telemetry_private_value';

export type SourcePrimarySceneTelemetryDiagnostic = {
  code: SourcePrimarySceneTelemetryDiagnosticCode;
  path: string;
  message: string;
};

export type SourcePrimarySceneTelemetryEvent = {
  contractVersion: typeof SOURCE_PRIMARY_SCENE_TELEMETRY_VERSION;
  route: {
    originalMode: K12RouteMode;
    effectiveMode: K12RouteMode;
    inputOrigin: K12InputOrigin;
  };
  rollout: {
    stage: SourcePrimarySceneRolloutStage;
    eligible: boolean;
    reason: SourcePrimarySceneRolloutReason;
    canaryBucket?: number;
  };
  source?: {
    sourceHashPrefix?: string;
  };
  versions?: {
    endToEndValidation?: string;
    sourceManifest?: string;
  };
  counts?: {
    selectedUnitCount?: number;
    objectiveCount?: number;
    sourceStepCount?: number;
    storyboardScreenCount?: number;
    semanticSpecCount?: number;
    renderedSceneCount?: number;
    assetRequestCount?: number;
    resolvedAssetCount?: number;
    omittedOptionalAssetCount?: number;
    fullSlideRasterCount?: number;
  };
  diagnosticCodes?: string[];
  latencyBucketsMs?: Record<string, number>;
  costClass?: 'free' | 'bounded-paid' | 'not-applicable';
};

export type BuildSourcePrimarySceneTelemetryEventInput = {
  decision: SourcePrimarySceneRolloutDecision;
  validationReport?: EndToEndValidationReport;
  sourceHash?: string;
  latencyBucketsMs?: Record<string, number>;
  costClass?: SourcePrimarySceneTelemetryEvent['costClass'];
};

const FORBIDDEN_FIELD_NAME_PATTERN = /(?:raw|sourceText|slideText|speakerNotes|notes|prompt|fileName|teacherName|learnerName|studentName|schoolName|email|phone|localPath|path)$/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d .()-]{7,}\d)/;
const LOCAL_PATH_PATTERN = /(?:\/Users\/|\/private\/|[A-Za-z]:\\|\\Users\\|\.docx\b|\.pptx\b|\.pdf\b)/i;
const PERSON_NAME_PATTERN = /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/;
const SCHOOL_PATTERN = /\b(?:school|academy|elementary|university|campus)\b/i;
const SOURCE_LIKE_PATTERN = /\b(?:teacher|learner|student|lesson|objective|assessment|activity|directions?|instructions?|classroom)\b/i;
const ALLOWED_CODE_PATTERN = /^[a-z0-9_.:-]{1,96}$/i;
const HASH_PREFIX_LENGTH = 12;
const MAX_OPERATIONAL_STRING_LENGTH = 96;

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const compactPositiveNumbers = (values: Record<string, number> | undefined): Record<string, number> | undefined => {
  if (!values) return undefined;
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (Number.isFinite(value) && value >= 0) next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

export const buildSourcePrimarySceneTelemetryEvent = ({
  decision,
  validationReport,
  sourceHash,
  latencyBucketsMs,
  costClass,
}: BuildSourcePrimarySceneTelemetryEventInput): SourcePrimarySceneTelemetryEvent => ({
  contractVersion: SOURCE_PRIMARY_SCENE_TELEMETRY_VERSION,
  route: {
    originalMode: decision.originalRoutePolicy.mode,
    effectiveMode: decision.effectiveRoutePolicy.mode,
    inputOrigin: decision.originalRoutePolicy.inputOrigin,
  },
  rollout: {
    stage: decision.stage,
    eligible: decision.eligible,
    reason: decision.reason,
    ...(typeof decision.canaryBucket === 'number' ? { canaryBucket: decision.canaryBucket } : {}),
  },
  ...(sourceHash ? { source: { sourceHashPrefix: sourceHash.slice(0, HASH_PREFIX_LENGTH) } } : {}),
  ...(validationReport ? {
    versions: {
      endToEndValidation: validationReport.contractVersion,
      sourceManifest: validationReport.sourceManifest.contractVersion,
    },
    counts: {
      selectedUnitCount: validationReport.sourceManifest.selectedUnitIds.length,
      objectiveCount: validationReport.sourceManifest.objectiveCount,
      sourceStepCount: validationReport.sourceManifest.sourceStepCount,
      storyboardScreenCount: validationReport.storyboard.checked,
      semanticSpecCount: validationReport.semanticSpecs.specCount,
      renderedSceneCount: validationReport.scenes.renderedSceneCount,
      assetRequestCount: validationReport.visualSystemAndAssets.assetRequestCount,
      resolvedAssetCount: validationReport.visualSystemAndAssets.resolvedAssetCount,
      omittedOptionalAssetCount: validationReport.visualSystemAndAssets.omittedOptionalAssetCount,
      fullSlideRasterCount: validationReport.scenes.fullSlideRasterCount,
    },
    diagnosticCodes: validationReport.diagnostics.map((diagnostic) => diagnostic.code),
  } : {}),
  ...(compactPositiveNumbers(latencyBucketsMs) ? { latencyBucketsMs: compactPositiveNumbers(latencyBucketsMs) } : {}),
  ...(costClass ? { costClass } : {}),
});

const isOperationalString = (path: string, value: string): boolean => {
  if (path.endsWith('.sourceHashPrefix')) return /^[a-f0-9-]{1,32}$/i.test(value);
  if (path.includes('diagnosticCodes') || path.includes('versions')) return ALLOWED_CODE_PATTERN.test(value);
  if (path.includes('route') || path.includes('rollout') || path.endsWith('.costClass')) {
    return ALLOWED_CODE_PATTERN.test(value);
  }
  return value.length <= MAX_OPERATIONAL_STRING_LENGTH && ALLOWED_CODE_PATTERN.test(value);
};

const hasPrivateValuePattern = (value: string): boolean => (
  EMAIL_PATTERN.test(value)
    || PHONE_PATTERN.test(value)
    || LOCAL_PATH_PATTERN.test(value)
    || PERSON_NAME_PATTERN.test(value)
    || SCHOOL_PATTERN.test(value)
    || (value.length > MAX_OPERATIONAL_STRING_LENGTH && SOURCE_LIKE_PATTERN.test(value))
    || (/\s/.test(value) && SOURCE_LIKE_PATTERN.test(value))
);

const pushUniqueDiagnostic = (
  diagnostics: SourcePrimarySceneTelemetryDiagnostic[],
  diagnostic: SourcePrimarySceneTelemetryDiagnostic,
): void => {
  if (!diagnostics.some((item) => item.code === diagnostic.code && item.path === diagnostic.path)) {
    diagnostics.push(diagnostic);
  }
};

const walkTelemetryValue = (
  value: unknown,
  path: string,
  diagnostics: SourcePrimarySceneTelemetryDiagnostic[],
): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkTelemetryValue(item, `${path}[${index}]`, diagnostics));
    return;
  }

  if (isObjectRecord(value)) {
    for (const [key, childValue] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (FORBIDDEN_FIELD_NAME_PATTERN.test(key)) {
        pushUniqueDiagnostic(diagnostics, {
          code: 'telemetry_forbidden_field',
          path: childPath,
          message: 'Telemetry contains a forbidden field name.',
        });
      }
      walkTelemetryValue(childValue, childPath, diagnostics);
    }
    return;
  }

  if (typeof value !== 'string') return;

  if (hasPrivateValuePattern(value) || !isOperationalString(path, value)) {
    pushUniqueDiagnostic(diagnostics, {
      code: 'telemetry_private_value',
      path,
      message: 'Telemetry contains private-looking or source-like text.',
    });
  }
};

export const validateSourcePrimarySceneTelemetryEvent = (
  event: unknown,
): SourcePrimarySceneTelemetryDiagnostic[] => {
  const diagnostics: SourcePrimarySceneTelemetryDiagnostic[] = [];
  walkTelemetryValue(event, '', diagnostics);
  return diagnostics;
};
