import type { SceneAssetRequest } from './sceneAssetRequests.ts';

export const SCENE_ASSET_RESOLUTION_VERSION = 'scene-asset-resolution-v1';

export type SceneResolvedAssetKind =
  | 'native'
  | 'bundled-icon'
  | 'curated-cache'
  | 'teacher-upload'
  | 'licensed-photo'
  | 'generated-image'
  | 'omitted';

export type SceneResolvedAsset = {
  contractVersion: typeof SCENE_ASSET_RESOLUTION_VERSION;
  requestId: string;
  semanticSlideSpecId: string;
  storyboardScreenId: string;
  sourceStepIds: string[];
  kind: SceneResolvedAssetKind;
  src?: string;
  altText: string;
  noEmbeddedText: true;
  editableFallbackAvailable: true;
  cacheKey?: string;
  costClass: 'free' | 'cached' | 'paid' | 'omitted';
};

export type SceneAssetBudget = {
  maxPaidGeneratedAssetsPerDeck: number;
  maxConcurrentAssetResolutions: number;
  allowPaidGeneration: boolean;
};

export const DEFAULT_SCENE_ASSET_BUDGET: SceneAssetBudget = {
  maxPaidGeneratedAssetsPerDeck: 4,
  maxConcurrentAssetResolutions: 3,
  allowPaidGeneration: false,
};

export type SceneAssetAdapters = Partial<{
  resolveBundledIcon: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  resolveCuratedVisual: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  resolveTeacherUpload: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  resolveLicensedPhoto: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  generateTextFreeImage: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
}>;

export type SceneAssetResolverDiagnosticCode =
  | 'scene_asset_forbidden_request'
  | 'scene_asset_required_unavailable'
  | 'scene_asset_invalid_resolution';

export type SceneAssetResolverDiagnostic = {
  code: SceneAssetResolverDiagnosticCode;
  severity: 'blocking';
  message: string;
  requestId?: string;
};

export type SceneAssetResolverResult =
  | { ok: true; assets: SceneResolvedAsset[] }
  | { ok: false; diagnostics: SceneAssetResolverDiagnostic[] };

const resolverDiagnostic = (
  code: SceneAssetResolverDiagnosticCode,
  message: string,
  requestId?: string,
): SceneAssetResolverDiagnostic => ({
  code,
  severity: 'blocking',
  message,
  requestId,
});

const fallbackAsset = (request: SceneAssetRequest): SceneResolvedAsset => ({
  contractVersion: SCENE_ASSET_RESOLUTION_VERSION,
  requestId: request.id,
  semanticSlideSpecId: request.semanticSlideSpecId,
  storyboardScreenId: request.storyboardScreenId,
  sourceStepIds: [...request.sourceStepIds],
  kind: 'omitted',
  altText: request.altTextBasis.sanitizedSummary,
  noEmbeddedText: true,
  editableFallbackAvailable: true,
  costClass: 'omitted',
});

const nativeAsset = (request: SceneAssetRequest): SceneResolvedAsset => ({
  contractVersion: SCENE_ASSET_RESOLUTION_VERSION,
  requestId: request.id,
  semanticSlideSpecId: request.semanticSlideSpecId,
  storyboardScreenId: request.storyboardScreenId,
  sourceStepIds: [...request.sourceStepIds],
  kind: 'native',
  altText: request.altTextBasis.sanitizedSummary,
  noEmbeddedText: true,
  editableFallbackAvailable: true,
  costClass: 'free',
});

const isExternallyResolved = (asset: SceneResolvedAsset): boolean => (
  asset.kind !== 'native' && asset.kind !== 'omitted'
);

const validateResolvedAsset = (request: SceneAssetRequest, asset: SceneResolvedAsset): SceneAssetResolverDiagnostic[] => {
  const diagnostics: SceneAssetResolverDiagnostic[] = [];
  if (
    asset.contractVersion !== SCENE_ASSET_RESOLUTION_VERSION
    || asset.requestId !== request.id
    || asset.semanticSlideSpecId !== request.semanticSlideSpecId
    || asset.storyboardScreenId !== request.storyboardScreenId
    || asset.noEmbeddedText !== true
    || asset.editableFallbackAvailable !== true
  ) {
    diagnostics.push(resolverDiagnostic(
      'scene_asset_invalid_resolution',
      `Scene asset resolution for ${request.id} does not preserve request ownership.`,
      request.id,
    ));
  }
  if (isExternallyResolved(asset) && !asset.src) {
    diagnostics.push(resolverDiagnostic(
      'scene_asset_invalid_resolution',
      `Scene asset resolution for ${request.id} is missing a bounded asset source.`,
      request.id,
    ));
  }
  return diagnostics;
};

const resolveExternalAsset = async (
  request: SceneAssetRequest,
  adapters: SceneAssetAdapters,
  canAttemptGenerated: boolean,
): Promise<SceneResolvedAsset | null> => {
  const orderedAdapters = [
    adapters.resolveBundledIcon,
    adapters.resolveCuratedVisual,
    adapters.resolveTeacherUpload,
    adapters.resolveLicensedPhoto,
    canAttemptGenerated ? adapters.generateTextFreeImage : undefined,
  ];

  for (const adapter of orderedAdapters) {
    if (!adapter) continue;
    const asset = await adapter(request);
    if (asset) return asset;
  }

  return null;
};

export const resolveSceneAssets = async (
  requests: readonly SceneAssetRequest[],
  budget: SceneAssetBudget = DEFAULT_SCENE_ASSET_BUDGET,
  adapters: SceneAssetAdapters = {},
): Promise<SceneAssetResolverResult> => {
  const preflightDiagnostics = requests
    .filter((request) => request.necessity === 'forbidden' || request.decisionReason === 'decorative_only_rejected')
    .map((request) => resolverDiagnostic(
      'scene_asset_forbidden_request',
      `Scene asset request ${request.id} is forbidden before resolver adapters run.`,
      request.id,
    ));
  if (preflightDiagnostics.length > 0) return { ok: false, diagnostics: preflightDiagnostics };

  const assets: SceneResolvedAsset[] = [];
  const diagnostics: SceneAssetResolverDiagnostic[] = [];
  let generatedCount = 0;

  for (const request of requests) {
    if (request.visualRole === 'native-diagram' || request.visualRole === 'native-icon') {
      assets.push(nativeAsset(request));
      continue;
    }

    if (request.visualRole === 'no-image-fallback') {
      assets.push(fallbackAsset(request));
      continue;
    }

    const canAttemptGenerated = Boolean(
      budget.allowPaidGeneration
      && generatedCount < budget.maxPaidGeneratedAssetsPerDeck
      && request.visualRole === 'generated-illustration',
    );
    const asset = await resolveExternalAsset(request, adapters, canAttemptGenerated);
    if (asset) {
      const assetDiagnostics = validateResolvedAsset(request, asset);
      diagnostics.push(...assetDiagnostics);
      if (assetDiagnostics.length === 0) {
        if (asset.kind === 'generated-image') generatedCount += 1;
        assets.push(asset);
      }
      continue;
    }

    if (request.necessity === 'required') {
      diagnostics.push(resolverDiagnostic(
        'scene_asset_required_unavailable',
        `Required source-backed asset ${request.id} could not be resolved with a safe editable fallback.`,
        request.id,
      ));
      continue;
    }

    assets.push(fallbackAsset(request));
  }

  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, assets };
};
