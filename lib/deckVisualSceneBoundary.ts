import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import {
  compileSemanticSlideSpecsToScenes,
  formatSceneValidationDiagnostics,
  type CompiledScenePresentation,
  type SceneValidationDiagnostic,
} from './compiledSlideScene.ts';
import {
  buildDeckVisualSystems,
  formatVisualSystemDiagnostics,
  isDeckVisualSystemV1Enabled,
  type DeckVisualSystemBundle,
  type VisualSystemDiagnostic,
} from './deckVisualSystem.ts';
import {
  buildSceneAssetRequests,
  formatSceneAssetDiagnostics,
  type SceneAssetDiagnostic,
  type SceneAssetRequest,
} from './sceneAssetRequests.ts';
import {
  DEFAULT_SCENE_ASSET_BUDGET,
  resolveSceneAssets,
  type SceneAssetAdapters,
  type SceneAssetBudget,
  type SceneAssetResolverDiagnostic,
  type SceneResolvedAsset,
} from './sceneAssetResolver.ts';
import {
  buildSemanticSlideSpecs,
  formatSemanticSlideDiagnostics,
  isSemanticSlidesV1Enabled,
  resolveSemanticScenePresentationForGeneration,
  type SemanticSlideDiagnostic,
  type SemanticSlideSpec,
} from './semanticSlideSpec.ts';
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import type { SourceDispositionDecision } from './sourceContentDisposition.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';
import { buildSemanticSlideSpecsFromVisualTeachingPlan } from './visualTeachingSemanticBridge.ts';
import type { VisualTeachingPlan } from './visualTeachingPlan.ts';

export type DeckVisualSceneBoundaryDiagnostic =
  | VisualSystemDiagnostic
  | SceneAssetDiagnostic
  | SceneAssetResolverDiagnostic
  | SemanticSlideDiagnostic
  | SceneValidationDiagnostic;

export type DeckVisualSceneBoundaryArtifacts = {
  semanticSpecs: SemanticSlideSpec[];
  visualSystems: DeckVisualSystemBundle;
  assetRequests: SceneAssetRequest[];
  resolvedAssetsBySpecId: Record<string, SceneResolvedAsset[]>;
  visualTeachingPlan?: VisualTeachingPlan;
};

export type DeckVisualSceneBoundary =
  | {
      ok: true;
      presentation: CompiledScenePresentation | null;
      visualSystems?: DeckVisualSystemBundle;
      validationArtifacts?: DeckVisualSceneBoundaryArtifacts;
    }
  | { ok: false; message: string; diagnostics: DeckVisualSceneBoundaryDiagnostic[] };

export type DeckVisualSceneBoundaryOptions = {
  title: string;
  selectedUnitLabel?: string;
  budget?: SceneAssetBudget;
  adapters?: SceneAssetAdapters;
  includeValidationArtifacts?: boolean;
  visualTeachingPlan?: VisualTeachingPlan;
  visualTeachingSourceContext?: {
    sourceManifest: LessonSourceManifest;
    dispositions: readonly SourceDispositionDecision[];
  };
};

const groupSpecsWithRequests = (
  specs: readonly SemanticSlideSpec[],
  requests: readonly SceneAssetRequest[],
): SemanticSlideSpec[] => specs.map((spec) => ({
  ...spec,
  assetRequests: requests.filter((request) => request.semanticSlideSpecId === spec.id),
}));

export const resolveDeckVisualScenePresentationForGeneration = async (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  semanticFlagValue: unknown,
  deckVisualFlagValue: unknown,
  storyboard: TeachingStoryboard | null,
  options: DeckVisualSceneBoundaryOptions,
): Promise<DeckVisualSceneBoundary> => {
  if (!isSemanticSlidesV1Enabled(semanticFlagValue) || policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, presentation: null };
  }

  if (!isDeckVisualSystemV1Enabled(deckVisualFlagValue)) {
    return resolveSemanticScenePresentationForGeneration(policy, semanticFlagValue, storyboard, options);
  }

  if (!storyboard) {
    const diagnostics: SemanticSlideDiagnostic[] = [{
      code: 'semantic_spec_contract_invalid',
      severity: 'blocking',
      message: 'Missing source-bound teaching storyboard.',
    }];
    return {
      ok: false,
      message: 'The uploaded source was not converted into a teaching storyboard before deck visual-system compilation.',
      diagnostics,
    };
  }

  const specsResult = options.visualTeachingPlan
    ? options.visualTeachingSourceContext
      ? buildSemanticSlideSpecsFromVisualTeachingPlan({
          sourceManifest: options.visualTeachingSourceContext.sourceManifest,
          storyboard,
          dispositions: options.visualTeachingSourceContext.dispositions,
          plan: options.visualTeachingPlan,
        })
      : {
          ok: false as const,
          diagnostics: [{
            code: 'semantic_spec_contract_invalid' as const,
            severity: 'blocking' as const,
            message: 'Visual teaching semantic compilation requires validated source context.',
          }],
        }
    : buildSemanticSlideSpecs(storyboard);
  if (specsResult.ok === false) {
    return {
      ok: false,
      message: formatSemanticSlideDiagnostics(specsResult.diagnostics),
      diagnostics: specsResult.diagnostics,
    };
  }

  const visualSystemsResult = buildDeckVisualSystems(storyboard, specsResult.specs);
  if (visualSystemsResult.ok === false) {
    return {
      ok: false,
      message: formatVisualSystemDiagnostics(visualSystemsResult.diagnostics),
      diagnostics: visualSystemsResult.diagnostics,
    };
  }

  const requestsResult = buildSceneAssetRequests(storyboard, specsResult.specs, visualSystemsResult.bundle);
  if (requestsResult.ok === false) {
    return {
      ok: false,
      message: formatSceneAssetDiagnostics(requestsResult.diagnostics),
      diagnostics: requestsResult.diagnostics,
    };
  }

  const resolverResult = await resolveSceneAssets(
    requestsResult.requests,
    options.budget ?? DEFAULT_SCENE_ASSET_BUDGET,
    options.adapters ?? {},
  );
  if (resolverResult.ok === false) {
    return {
      ok: false,
      message: resolverResult.diagnostics.map((diagnostic) => diagnostic.message).join(' '),
      diagnostics: resolverResult.diagnostics,
    };
  }

  const specsWithRequests = groupSpecsWithRequests(specsResult.specs, requestsResult.requests);
  const resolvedAssetsBySpecId = Object.fromEntries(specsWithRequests.map((spec) => [
    spec.id,
    resolverResult.assets.filter((asset) => asset.semanticSlideSpecId === spec.id),
  ]));

  const sceneResult = compileSemanticSlideSpecsToScenes(specsWithRequests, {
    title: options.title,
    selectedUnitLabel: options.selectedUnitLabel,
    visualSystemsByUnitId: visualSystemsResult.bundle.systemsByUnitId,
    resolvedAssetsBySpecId,
  });
  if (sceneResult.ok === false) {
    return {
      ok: false,
      message: formatSceneValidationDiagnostics(sceneResult.diagnostics),
      diagnostics: sceneResult.diagnostics,
    };
  }

  const success: DeckVisualSceneBoundary = {
    ok: true,
    presentation: sceneResult.presentation,
    visualSystems: visualSystemsResult.bundle,
  };

  if (!options.includeValidationArtifacts) return success;

  return {
    ...success,
    validationArtifacts: {
      semanticSpecs: specsWithRequests,
      visualSystems: visualSystemsResult.bundle,
      assetRequests: requestsResult.requests,
      resolvedAssetsBySpecId,
      ...(options.visualTeachingPlan
        ? { visualTeachingPlan: options.visualTeachingPlan }
        : {}),
    },
  };
};
