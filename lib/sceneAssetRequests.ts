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
const EXPLICIT_WRITING_PATTERN =
  /\b(?:text|words?|phrases?|labels?|captions?|signage|screen[- ]writing|board[- ]writing|lettering|typography)\b|\b(?:show|display|write|include|feature|contain|place)\b.{0,48}\b(?:board|screen)\b/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const PHONE_PATTERN = /(?:^|\D)\+?\d[\d\s().-]{7,}\d(?:\D|$)/;
const IDENTIFIER_PATTERN =
  /\b(?:student|learner|teacher|school|employee|user)\s*(?:id|number)\b|\b(?:id|identifier)\s*[:#=-]\s*[a-z0-9-]+/i;
const NAME_MARKER_PATTERN = /\b(?:student|learner|teacher|person)\s+name\b|\bname\s*[:=]/i;
const MAX_EXPLICIT_BRIEF_PURPOSE_LENGTH = 240;
const MAX_EXPLICIT_BRIEF_SUBJECT_LENGTH = 120;

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

type SafeExplicitAssetBrief = {
  purpose: string;
  subject: string;
  style: 'photo' | 'illustration';
  mustNotContainText: true;
};

const validateExplicitAssetBrief = (
  spec: SemanticSlideSpec,
): { ok: true; brief: SafeExplicitAssetBrief } | { ok: false; diagnostics: SceneAssetDiagnostic[] } | null => {
  if (spec.visualAssetBrief === undefined) return null;
  const candidate = spec.visualAssetBrief as Partial<SafeExplicitAssetBrief> | null;
  const rawPurpose = typeof candidate?.purpose === 'string' ? candidate.purpose : '';
  const rawSubject = typeof candidate?.subject === 'string' ? candidate.subject : '';
  const purpose = normalize(rawPurpose);
  const subject = normalize(rawSubject);
  const detail = { semanticSlideSpecId: spec.id };
  const diagnostics: SceneAssetDiagnostic[] = [];

  if (
    candidate?.mustNotContainText !== true
    || EXPLICIT_WRITING_PATTERN.test(purpose)
    || EXPLICIT_WRITING_PATTERN.test(subject)
  ) {
    diagnostics.push(assetDiagnostic(
      'scene_asset_request_text_in_image',
      `Semantic slide ${spec.id} has an explicit asset brief that may request visible writing.`,
      detail,
    ));
  }

  const suspicious = (
    !purpose
    || !subject
    || purpose.length > MAX_EXPLICIT_BRIEF_PURPOSE_LENGTH
    || subject.length > MAX_EXPLICIT_BRIEF_SUBJECT_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(rawPurpose)
    || CONTROL_CHARACTER_PATTERN.test(rawSubject)
    || [purpose, subject].some((value) => (
      PRIVATE_TEXT_PATTERN.test(value)
      || EMAIL_PATTERN.test(value)
      || PHONE_PATTERN.test(value)
      || IDENTIFIER_PATTERN.test(value)
      || NAME_MARKER_PATTERN.test(value)
    ))
  );
  if (suspicious) {
    diagnostics.push(assetDiagnostic(
      'scene_asset_request_private_text_leak',
      `Semantic slide ${spec.id} has an unbounded or suspicious explicit asset brief.`,
      detail,
    ));
  }

  if (candidate?.style !== 'photo' && candidate?.style !== 'illustration') {
    diagnostics.push(assetDiagnostic(
      'scene_asset_request_contract_invalid',
      `Semantic slide ${spec.id} has an invalid explicit asset style.`,
      detail,
    ));
  }

  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : {
        ok: true,
        brief: {
          purpose,
          subject,
          style: candidate.style!,
          mustNotContainText: true,
        },
      };
};

const explicitAssetDecision = (
  brief: SafeExplicitAssetBrief | undefined,
): {
  visualRole: SceneAssetVisualRole;
  necessity: SceneAssetNecessity;
  reason: SceneAssetDecisionReason;
} | null => {
  if (!brief) return null;
  return {
    visualRole: brief.style === 'photo' ? 'licensed-photo' : 'generated-illustration',
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
  const explicitBriefsBySpecId = new Map<string, SafeExplicitAssetBrief>();
  const explicitBriefDiagnostics: SceneAssetDiagnostic[] = [];
  for (const spec of specs) {
    const result = validateExplicitAssetBrief(spec);
    if (!result) continue;
    if (result.ok === false) explicitBriefDiagnostics.push(...result.diagnostics);
    else explicitBriefsBySpecId.set(spec.id, result.brief);
  }
  if (explicitBriefDiagnostics.length > 0) {
    return { ok: false, diagnostics: explicitBriefDiagnostics };
  }

  specs.forEach((firstSpecForScreen, index) => {
    if (requestedScreenIds.has(firstSpecForScreen.storyboardScreenId)) return;
    requestedScreenIds.add(firstSpecForScreen.storyboardScreenId);
    const spec = specs.find((candidate) => (
      candidate.storyboardScreenId === firstSpecForScreen.storyboardScreenId
      && explicitBriefsBySpecId.has(candidate.id)
    )) ?? firstSpecForScreen;
    const visualSystem = visualSystems.systemsByUnitId[spec.unitId];
    if (!visualSystem) return;
    const explicitBrief = explicitBriefsBySpecId.get(spec.id);
    const decision = explicitAssetDecision(explicitBrief) ?? decideSceneAssetForSpec(spec);
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
      instructionalPurpose: explicitBrief?.purpose
        ?? 'Support the source-backed learning task while preserving editable native text.',
      visualSystemVersion: visualSystem.contractVersion,
      altTextBasis: {
        sourceStepIds: [...spec.sourceStepIds],
        storyboardScreenId: spec.storyboardScreenId,
        sanitizedSummary,
      },
      brief: {
        subject: explicitBrief?.subject ?? 'K-12',
        gradeBand: 'secondary',
        conceptId,
        sceneDescription: explicitBrief?.purpose
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
