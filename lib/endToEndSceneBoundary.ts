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
import type { TeachingStoryboard } from './teachingStoryboard.ts';

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
      diagnostics: Array<EndToEndDiagnostic | DeckVisualSceneBoundaryDiagnostic>;
      validationReport?: EndToEndValidationReport;
    };

export const resolveEndToEndValidatedScenePresentationForGeneration = async (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  semanticFlagValue: unknown,
  deckVisualFlagValue: unknown,
  endToEndValidationFlagValue: unknown,
  sourceManifest: LessonSourceManifest | null,
  storyboard: TeachingStoryboard | null,
  options: DeckVisualSceneBoundaryOptions,
): Promise<EndToEndSceneBoundary> => {
  if (!isEndToEndValidationV1Enabled(endToEndValidationFlagValue)) {
    return resolveDeckVisualScenePresentationForGeneration(
      policy,
      semanticFlagValue,
      deckVisualFlagValue,
      storyboard,
      options,
    );
  }

  const gate4Result = await resolveDeckVisualScenePresentationForGeneration(
    policy,
    semanticFlagValue,
    deckVisualFlagValue,
    storyboard,
    { ...options, includeValidationArtifacts: true },
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
