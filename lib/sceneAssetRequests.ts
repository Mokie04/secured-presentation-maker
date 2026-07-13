import type { DeckVisualSystem, DeckVisualSystemBundle } from './deckVisualSystem.ts';
import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import { decideSceneAssetForSpec } from './sceneAssetDecisionPolicy.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';

export const SCENE_ASSET_REQUEST_VERSION = 'scene-asset-request-v1';

export type SceneAssetVisualRole =
  | 'native-icon'
  | 'native-diagram'
  | 'curated-educational-visual'
  | 'teacher-uploaded-override'
  | 'licensed-photo'
  | 'generated-illustration'
  | 'no-image-fallback';

export type SceneAssetNecessity = 'required' | 'useful' | 'optional' | 'forbidden';

export type SceneAssetDecisionReason =
  | 'text_or_labels_required_use_native'
  | 'relationship_explained_by_shapes'
  | 'source_requires_observable_photo'
  | 'source_requires_concept_model'
  | 'decorative_only_rejected'
  | 'privacy_risk_rejected'
  | 'cost_ceiling_reached'
  | 'no_safe_asset_available';

export type ProviderIndependentAssetBrief = {
  subject: string;
  gradeBand: string;
  conceptId: string;
  sceneDescription: string;
  composition: 'single-subject' | 'process-closeup' | 'material-photo' | 'concept-illustration';
  style: 'photo' | 'illustration' | 'diagram';
  mustNotContainText: true;
  negativeConstraints: string[];
};

export type SceneAssetRequest = {
  contractVersion: typeof SCENE_ASSET_REQUEST_VERSION;
  id: string;
  unitId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  storyboardScreenId: string;
  semanticSlideSpecId: string;
  visualRole: SceneAssetVisualRole;
  necessity: SceneAssetNecessity;
  decisionReason: SceneAssetDecisionReason;
  conceptAnchor: {
    conceptId: string;
    entityId?: string;
  };
  instructionalPurpose: string;
  visualSystemVersion: DeckVisualSystem['contractVersion'];
  altTextBasis: {
    sourceStepIds: string[];
    storyboardScreenId: string;
    sanitizedSummary: string;
  };
  brief: ProviderIndependentAssetBrief;
  privacy: {
    sanitized: true;
    containsRawSourceText: false;
    containsPersonalData: false;
  };
};

export type SceneAssetDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type SceneAssetDiagnosticCode =
  | 'scene_asset_request_contract_invalid'
  | 'scene_asset_request_ownership_mismatch'
  | 'scene_asset_request_private_text_leak'
  | 'scene_asset_request_text_in_image'
  | 'scene_asset_decorative_forbidden'
  | 'scene_asset_visual_system_missing';

export type SceneAssetDiagnostic = {
  code: SceneAssetDiagnosticCode;
  severity: SceneAssetDiagnosticSeverity;
  message: string;
  requestId?: string;
  semanticSlideSpecId?: string;
};

export type SceneAssetRequestResult =
  | { ok: true; requests: SceneAssetRequest[] }
  | { ok: false; diagnostics: SceneAssetDiagnostic[] };

const PRIVATE_TEXT_PATTERN =
  /\b(?:teacher\s+[a-z]+|sample\s+school|school\s+id|student\s+name|learner\s+name|private\s+sentence|maria)\b/i;

const TEXT_IN_IMAGE_PATTERN =
  /\b(?:with|include|show|inside|visible)\s+(?:text|labels?|captions?|letters?|numbers?)\b|\bcaption\s+text\b/i;

const assetDiagnostic = (
  code: SceneAssetDiagnosticCode,
  message: string,
  detail: Pick<SceneAssetDiagnostic, 'requestId' | 'semanticSlideSpecId'> = {},
): SceneAssetDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  ...detail,
});

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

const firstConceptIdForSpec = (spec: SemanticSlideSpec): string => {
  if (spec.sourceObjectiveIds[0]) return `objective:${spec.sourceObjectiveIds[0]}`;
  if (spec.sourceStepIds[0]) return `step:${spec.sourceStepIds[0]}`;
  return `screen:${spec.storyboardScreenId}`;
};

const sanitizedSummaryForSpec = (spec: SemanticSlideSpec): string => {
  const purpose = normalize(spec.accessibility.slidePurpose);
  if (!purpose) return 'Source-backed learning visual.';
  const redacted = purpose
    .replace(PRIVATE_TEXT_PATTERN, 'source-safe learning context')
    .replace(/\b(?:teacher|learner|student)\s+[A-Z][a-z]+\b/g, 'participant');
  return redacted.slice(0, 90);
};

const compositionForRole = (role: SceneAssetVisualRole): ProviderIndependentAssetBrief['composition'] => {
  if (role === 'licensed-photo' || role === 'teacher-uploaded-override') return 'material-photo';
  if (role === 'native-diagram') return 'process-closeup';
  return 'concept-illustration';
};

const styleForRole = (role: SceneAssetVisualRole): ProviderIndependentAssetBrief['style'] => {
  if (role === 'licensed-photo' || role === 'teacher-uploaded-override') return 'photo';
  if (role === 'native-diagram') return 'diagram';
  return 'illustration';
};

const explicitAssetDecision = (
  spec: SemanticSlideSpec,
): {
  visualRole: SceneAssetVisualRole;
  necessity: SceneAssetNecessity;
  reason: SceneAssetDecisionReason;
} | null => {
  if (!spec.visualAssetBrief) return null;
  return {
    visualRole: spec.visualAssetBrief.style === 'photo' ? 'licensed-photo' : 'generated-illustration',
    necessity: 'useful',
    reason: 'source_requires_concept_model',
  };
};

export const buildSceneAssetRequests = (
  _storyboard: TeachingStoryboard,
  specs: readonly SemanticSlideSpec[],
  visualSystems: DeckVisualSystemBundle,
): SceneAssetRequestResult => {
  const requests: SceneAssetRequest[] = [];
  const requestedScreenIds = new Set<string>();

  specs.forEach((firstSpecForScreen, index) => {
    if (requestedScreenIds.has(firstSpecForScreen.storyboardScreenId)) return;
    requestedScreenIds.add(firstSpecForScreen.storyboardScreenId);
    const spec = specs.find((candidate) => (
      candidate.storyboardScreenId === firstSpecForScreen.storyboardScreenId
      && candidate.visualAssetBrief
    )) ?? firstSpecForScreen;
    const visualSystem = visualSystems.systemsByUnitId[spec.unitId];
    if (!visualSystem) return;
    const decision = explicitAssetDecision(spec) ?? decideSceneAssetForSpec(spec);
    if (decision.necessity === 'forbidden') return;
    const conceptId = firstConceptIdForSpec(spec);
    const sanitizedSummary = sanitizedSummaryForSpec(spec);
    requests.push({
      contractVersion: SCENE_ASSET_REQUEST_VERSION,
      id: `assetreq-${spec.id}-${String(index + 1).padStart(3, '0')}`,
      unitId: spec.unitId,
      sourceStepIds: [...spec.sourceStepIds],
      sourceObjectiveIds: [...spec.sourceObjectiveIds],
      storyboardScreenId: spec.storyboardScreenId,
      semanticSlideSpecId: spec.id,
      visualRole: decision.visualRole,
      necessity: decision.necessity,
      decisionReason: decision.reason,
      conceptAnchor: {
        conceptId,
      },
      instructionalPurpose: spec.visualAssetBrief?.purpose
        ?? 'Support the source-backed learning task while preserving editable native text.',
      visualSystemVersion: visualSystem.contractVersion,
      altTextBasis: {
        sourceStepIds: [...spec.sourceStepIds],
        storyboardScreenId: spec.storyboardScreenId,
        sanitizedSummary,
      },
      brief: {
        subject: spec.visualAssetBrief?.subject ?? 'K-12',
        gradeBand: 'secondary',
        conceptId,
        sceneDescription: spec.visualAssetBrief?.purpose
          ?? `Text-free ${decision.visualRole.replaceAll('-', ' ')} for ${sanitizedSummary.toLowerCase() || 'a source-backed learning task'}.`,
        composition: compositionForRole(decision.visualRole),
        style: styleForRole(decision.visualRole),
        mustNotContainText: true,
        negativeConstraints: ['No text, labels, captions, letters, numbers, watermarks, or UI chrome inside the image.'],
      },
      privacy: {
        sanitized: true,
        containsRawSourceText: false,
        containsPersonalData: false,
      },
    });
  });

  const diagnostics = validateSceneAssetRequests(requests, _storyboard, specs, visualSystems);
  return diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
    ? { ok: false, diagnostics }
    : { ok: true, requests };
};

const hasPrivateText = (value: string): boolean => PRIVATE_TEXT_PATTERN.test(value);

const asksForTextInsideImage = (request: SceneAssetRequest): boolean => (
  TEXT_IN_IMAGE_PATTERN.test(request.brief.sceneDescription)
  || request.brief.mustNotContainText !== true
  || !request.brief.negativeConstraints.some((constraint) => /no text/i.test(constraint))
);

const arraysEqual = (a: readonly string[], b: readonly string[]): boolean => (
  a.length === b.length && a.every((value, index) => value === b[index])
);

export const validateSceneAssetRequests = (
  requests: readonly SceneAssetRequest[],
  storyboard: TeachingStoryboard,
  specs: readonly SemanticSlideSpec[],
  visualSystems: DeckVisualSystemBundle,
): SceneAssetDiagnostic[] => {
  const diagnostics: SceneAssetDiagnostic[] = [];
  const specsById = new Map(specs.map((spec) => [spec.id, spec] as const));
  const screenIds = new Set(storyboard.screens.map((screen) => screen.id));

  for (const request of requests) {
    const spec = specsById.get(request.semanticSlideSpecId);
    if (
      request.contractVersion !== SCENE_ASSET_REQUEST_VERSION
      || !request.id.startsWith(`assetreq-${request.semanticSlideSpecId}-`)
      || request.visualSystemVersion !== 'deck-visual-system-v1'
    ) {
      diagnostics.push(assetDiagnostic(
        'scene_asset_request_contract_invalid',
        `Scene asset request ${request.id} does not match the Gate 4 request contract.`,
        { requestId: request.id, semanticSlideSpecId: request.semanticSlideSpecId },
      ));
    }

    if (!spec || !screenIds.has(request.storyboardScreenId)) {
      diagnostics.push(assetDiagnostic(
        'scene_asset_request_ownership_mismatch',
        `Scene asset request ${request.id} is not owned by a known storyboard screen and semantic spec.`,
        { requestId: request.id, semanticSlideSpecId: request.semanticSlideSpecId },
      ));
      continue;
    }

    if (!visualSystems.systemsByUnitId[request.unitId]) {
      diagnostics.push(assetDiagnostic(
        'scene_asset_visual_system_missing',
        `Scene asset request ${request.id} does not have a matching deck visual system.`,
        { requestId: request.id, semanticSlideSpecId: request.semanticSlideSpecId },
      ));
    }

    if (
      request.unitId !== spec.unitId
      || request.storyboardScreenId !== spec.storyboardScreenId
      || !arraysEqual(request.sourceStepIds, spec.sourceStepIds)
      || !arraysEqual(request.sourceObjectiveIds, spec.sourceObjectiveIds)
      || !arraysEqual(request.altTextBasis.sourceStepIds, request.sourceStepIds)
      || request.altTextBasis.storyboardScreenId !== request.storyboardScreenId
    ) {
      diagnostics.push(assetDiagnostic(
        'scene_asset_request_ownership_mismatch',
        `Scene asset request ${request.id} does not preserve semantic spec ownership.`,
        { requestId: request.id, semanticSlideSpecId: request.semanticSlideSpecId },
      ));
    }

    if (
      request.necessity === 'forbidden'
      || request.decisionReason === 'decorative_only_rejected'
      || /decorative|random|filler/i.test(request.instructionalPurpose)
    ) {
      diagnostics.push(assetDiagnostic(
        'scene_asset_decorative_forbidden',
        `Scene asset request ${request.id} is decorative or random instead of instructional.`,
        { requestId: request.id, semanticSlideSpecId: request.semanticSlideSpecId },
      ));
    }

    const privateFields = [
      request.conceptAnchor.conceptId,
      request.instructionalPurpose,
      request.altTextBasis.sanitizedSummary,
      request.brief.subject,
      request.brief.conceptId,
      request.brief.sceneDescription,
    ];
    if (
      request.privacy.sanitized !== true
      || request.privacy.containsRawSourceText !== false
      || request.privacy.containsPersonalData !== false
      || privateFields.some(hasPrivateText)
    ) {
      diagnostics.push(assetDiagnostic(
        'scene_asset_request_private_text_leak',
        `Scene asset request ${request.id} contains private or raw source text.`,
        { requestId: request.id, semanticSlideSpecId: request.semanticSlideSpecId },
      ));
    }

    if (asksForTextInsideImage(request)) {
      diagnostics.push(assetDiagnostic(
        'scene_asset_request_text_in_image',
        `Scene asset request ${request.id} asks for visible text inside an image.`,
        { requestId: request.id, semanticSlideSpecId: request.semanticSlideSpecId },
      ));
    }
  }

  return diagnostics;
};

export const formatSceneAssetDiagnostics = (diagnostics: readonly SceneAssetDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};
