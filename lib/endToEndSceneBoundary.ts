import {
  resolveDeckVisualScenePresentationForGeneration,
  type DeckVisualSceneBoundary,
  type DeckVisualSceneBoundaryDiagnostic,
  type DeckVisualSceneBoundaryOptions,
} from './deckVisualSceneBoundary.ts';
import {
  formatEndToEndDiagnostics,
  isEndToEndValidationV1Enabled,
  validateEndToEndScenePresentation,
  type EndToEndDiagnostic,
  type EndToEndValidationReport,
} from './endToEndValidation.ts';
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
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
    && isVisualTeachingComposerV1Enabled(
      typeof visualComposer.flagValue === 'string' ? visualComposer.flagValue : undefined,
    )
    && policy.mode === 'source-primary'
    && policy.inputOrigin === 'uploaded-file',
  );
  let resolvedDeckVisualOptions: DeckVisualSceneBoundaryOptions = deckVisualOptions;

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

    let compositionResult;
    try {
      compositionResult = await visualComposer.compose({
        manifest: sourceManifest,
        storyboard,
        dispositions: dispositionResult.decisions,
        language: visualComposer.language,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown provider failure.';
      const diagnostic = visualCompositionDiagnostic(detail);
      return visualCompositionFailure(
        `The visual teaching composition failed before semantic scene compilation. ${detail}`,
        [diagnostic],
      );
    }

    if (compositionResult.ok === false) {
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

  const gate4Result = await resolveDeckVisualScenePresentationForGeneration(
    policy,
    semanticFlagValue,
    deckVisualFlagValue,
    storyboard,
    { ...resolvedDeckVisualOptions, includeValidationArtifacts: true },
  );

  if (gate4Result.ok === false || !gate4Result.presentation) return gate4Result;

  if (!sourceManifest || !storyboard || !gate4Result.validationArtifacts) {
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

  const validationResult = validateEndToEndScenePresentation({
    sourceManifest,
    storyboard,
    semanticSpecs: gate4Result.validationArtifacts.semanticSpecs,
    visualSystems: gate4Result.validationArtifacts.visualSystems,
    assetRequests: gate4Result.validationArtifacts.assetRequests,
    resolvedAssetsBySpecId: gate4Result.validationArtifacts.resolvedAssetsBySpecId,
    presentation: gate4Result.presentation,
    visualTeachingPlan: gate4Result.validationArtifacts.visualTeachingPlan,
  });

  if (validationResult.ok === false) {
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
