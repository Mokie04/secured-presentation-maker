import {
  resolveDeckVisualScenePresentationForGeneration,
  type DeckVisualSceneBoundary,
  type DeckVisualSceneBoundaryDiagnostic,
  type DeckVisualSceneBoundaryOptions,
} from './deckVisualSceneBoundary.ts';
import { isDeckVisualSystemV1Enabled } from './deckVisualSystem.ts';
import {
  formatEndToEndDiagnostics,
  isEndToEndValidationV1Enabled,
  validateEndToEndScenePresentation,
  type EndToEndDiagnostic,
  type EndToEndValidationReport,
} from './endToEndValidation.ts';
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import { isSemanticSlidesV1Enabled } from './semanticSlideSpec.ts';
import { classifySourceContent } from './sourceContentDisposition.ts';
import {
  hasBlockingStoryboardDiagnostics,
  validateTeachingStoryboard,
  type TeachingStoryboard,
} from './teachingStoryboard.ts';
import {
  isVisualTeachingComposerV1Enabled,
  type VisualTeachingPlanDiagnostic,
} from './visualTeachingPlan.ts';
import type { composeVisualTeachingPlanWithProvider } from '../services/visualTeachingComposerService.ts';

export type EndToEndSceneBoundary =
  | {
      ok: true;
      presentation: Extract<DeckVisualSceneBoundary, { ok: true }>['presentation'];
      visualSystems?: Extract<DeckVisualSceneBoundary, { ok: true }>['visualSystems'];
      validationReport?: EndToEndValidationReport;
    }
  | {
      ok: false;
      message: string;
      diagnostics: Array<EndToEndDiagnostic | DeckVisualSceneBoundaryDiagnostic | VisualTeachingPlanDiagnostic>;
      validationReport?: EndToEndValidationReport;
    };

export type EndToEndSceneBoundaryOptions = DeckVisualSceneBoundaryOptions & {
  visualComposer?: {
    flagValue: unknown;
    language: 'EN' | 'FIL';
    compose: typeof composeVisualTeachingPlanWithProvider;
    authorizeGeneration: () => boolean;
    releaseGeneration: () => void;
    authorizationFailureMessage: string;
  };
};

const visualCompositionDiagnostic = (message: string): VisualTeachingPlanDiagnostic => ({
  code: 'visual_plan_contract_invalid',
  severity: 'blocking',
  message,
});

const visualCompositionFailure = (
  message: string,
  diagnostics: VisualTeachingPlanDiagnostic[],
): EndToEndSceneBoundary => ({
  ok: false,
  message,
  diagnostics,
});

export const shouldRunVisualTeachingComposer = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  composerFlagValue: unknown,
  semanticFlagValue: unknown,
  deckVisualFlagValue: unknown,
  endToEndValidationFlagValue: unknown,
): boolean => (
  isVisualTeachingComposerV1Enabled(
    typeof composerFlagValue === 'string' ? composerFlagValue : undefined,
  )
  && policy.mode === 'source-primary'
  && policy.inputOrigin === 'uploaded-file'
  && isSemanticSlidesV1Enabled(semanticFlagValue)
  && isDeckVisualSystemV1Enabled(deckVisualFlagValue)
  && isEndToEndValidationV1Enabled(endToEndValidationFlagValue)
);

export const resolveEndToEndValidatedScenePresentationForGeneration = async (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  semanticFlagValue: unknown,
  deckVisualFlagValue: unknown,
  endToEndValidationFlagValue: unknown,
  sourceManifest: LessonSourceManifest | null,
  storyboard: TeachingStoryboard | null,
  options: EndToEndSceneBoundaryOptions,
): Promise<EndToEndSceneBoundary> => {
  const { visualComposer, ...deckVisualOptions } = options;
  const composerEnabled = Boolean(
    visualComposer
    && shouldRunVisualTeachingComposer(
      policy,
      visualComposer.flagValue,
      semanticFlagValue,
      deckVisualFlagValue,
      endToEndValidationFlagValue,
    ),
  );
  let resolvedDeckVisualOptions: DeckVisualSceneBoundaryOptions = deckVisualOptions;
  let releaseComposerGeneration: (() => void) | undefined;

  if (composerEnabled && visualComposer) {
    if (
      !sourceManifest
      || !storyboard
      || sourceManifest.contractVersion !== 'lesson-source-manifest-v1'
      || sourceManifest.provenance.origin !== 'uploaded-file'
      || sourceManifest.diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
    ) {
      const diagnostic = visualCompositionDiagnostic(
        'A valid uploaded source manifest and teaching storyboard are required for visual teaching composition.',
      );
      return visualCompositionFailure(
        `The visual teaching composition cannot start. ${diagnostic.message}`,
        [diagnostic],
      );
    }

    const storyboardDiagnostics = validateTeachingStoryboard(storyboard, sourceManifest);
    if (hasBlockingStoryboardDiagnostics(storyboardDiagnostics)) {
      const diagnostic = visualCompositionDiagnostic(
        'The source-bound teaching storyboard is invalid for visual teaching composition.',
      );
      return visualCompositionFailure(
        `The visual teaching composition cannot start. ${diagnostic.message}`,
        [diagnostic],
      );
    }

    const dispositionResult = classifySourceContent(sourceManifest, storyboard);
    if (dispositionResult.ok === false) {
      return visualCompositionFailure(
        `The visual teaching composition could not classify the uploaded source. ${dispositionResult.diagnostics.map((diagnostic) => diagnostic.message).join(' ')}`,
        dispositionResult.diagnostics,
      );
    }

    if (!visualComposer.authorizeGeneration()) {
      return visualCompositionFailure(
        visualComposer.authorizationFailureMessage,
        [visualCompositionDiagnostic(visualComposer.authorizationFailureMessage)],
      );
    }

    let composerGenerationHeld = true;
    releaseComposerGeneration = () => {
      if (!composerGenerationHeld) return;
      composerGenerationHeld = false;
      visualComposer.releaseGeneration();
    };

    let compositionResult;
    try {
      compositionResult = await visualComposer.compose({
        manifest: sourceManifest,
        storyboard,
        dispositions: dispositionResult.decisions,
        language: visualComposer.language,
      });
    } catch (error) {
      releaseComposerGeneration();
      const detail = error instanceof Error ? error.message : 'Unknown provider failure.';
      const diagnostic = visualCompositionDiagnostic(detail);
      return visualCompositionFailure(
        `The visual teaching composition failed before semantic scene compilation. ${detail}`,
        [diagnostic],
      );
    }

    if (compositionResult.ok === false) {
      releaseComposerGeneration();
      return visualCompositionFailure(
        `The visual teaching composition failed before semantic scene compilation. ${compositionResult.message}`,
        compositionResult.diagnostics,
      );
    }

    resolvedDeckVisualOptions = {
      ...deckVisualOptions,
      visualTeachingPlan: compositionResult.plan,
      visualTeachingSourceContext: {
        sourceManifest,
        dispositions: dispositionResult.decisions,
      },
    };
  }

  if (!isEndToEndValidationV1Enabled(endToEndValidationFlagValue)) {
    return resolveDeckVisualScenePresentationForGeneration(
      policy,
      semanticFlagValue,
      deckVisualFlagValue,
      storyboard,
      resolvedDeckVisualOptions,
    );
  }

  let gate4Result: Awaited<ReturnType<typeof resolveDeckVisualScenePresentationForGeneration>>;
  try {
    gate4Result = await resolveDeckVisualScenePresentationForGeneration(
      policy,
      semanticFlagValue,
      deckVisualFlagValue,
      storyboard,
      { ...resolvedDeckVisualOptions, includeValidationArtifacts: true },
    );
  } catch (error) {
    releaseComposerGeneration?.();
    throw error;
  }

  if (gate4Result.ok === false) {
    releaseComposerGeneration?.();
    return gate4Result;
  }
  if (!gate4Result.presentation) {
    if (!releaseComposerGeneration) return gate4Result;
    releaseComposerGeneration();
    const diagnostic = visualCompositionDiagnostic(
      'Visual teaching composition did not produce a compiled scene presentation.',
    );
    return visualCompositionFailure(
      `The visual teaching composition failed before delivery. ${diagnostic.message}`,
      [diagnostic],
    );
  }

  if (!sourceManifest || !storyboard || !gate4Result.validationArtifacts) {
    releaseComposerGeneration?.();
    const diagnostics: EndToEndDiagnostic[] = [{
      code: 'e2e_source_manifest_invalid',
      severity: 'blocking',
      message: 'Missing source manifest, storyboard, or Gate 4 validation artifacts for end-to-end validation.',
    }];
    return {
      ok: false,
      message: formatEndToEndDiagnostics(diagnostics),
      diagnostics,
    };
  }

  let validationResult: ReturnType<typeof validateEndToEndScenePresentation>;
  try {
    validationResult = validateEndToEndScenePresentation({
      sourceManifest,
      storyboard,
      semanticSpecs: gate4Result.validationArtifacts.semanticSpecs,
      visualSystems: gate4Result.validationArtifacts.visualSystems,
      assetRequests: gate4Result.validationArtifacts.assetRequests,
      resolvedAssetsBySpecId: gate4Result.validationArtifacts.resolvedAssetsBySpecId,
      presentation: gate4Result.presentation,
      visualTeachingPlan: gate4Result.validationArtifacts.visualTeachingPlan,
    });
  } catch (error) {
    releaseComposerGeneration?.();
    throw error;
  }

  if (validationResult.ok === false) {
    releaseComposerGeneration?.();
    return {
      ok: false,
      message: validationResult.message,
      diagnostics: validationResult.diagnostics,
      validationReport: validationResult.report,
    };
  }

  return {
    ok: true,
    presentation: gate4Result.presentation,
    visualSystems: gate4Result.visualSystems,
    validationReport: validationResult.report,
  };
};
