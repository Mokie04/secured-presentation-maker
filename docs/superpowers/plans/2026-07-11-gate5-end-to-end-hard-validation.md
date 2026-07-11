# Gate 5 End-to-End Hard Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add end-to-end hard validation for the source-primary compiled-scene path so invalid aligned scenes cannot be delivered or cached as successful output.

**Architecture:** Gate 5 wraps the accepted Gate 4 scene boundary and validates the already-structured source, storyboard, semantic specs, visual system, assets, compiled scenes, preview render descriptors, PPTX semantics, and cache decision. It does not reinterpret raw uploads, change prompts, switch providers, or alter legacy routes. The validation report is deterministic and blocks source-primary scene delivery on release-threshold failures.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Node 26 `node:test` with `--experimental-strip-types`, existing Gate 0-4 contracts, existing `pptxgenjs`, existing transitive `jszip` from the current lockfile only if package inspection is implemented without changing `package.json` or `package-lock.json`.

## Global Constraints

- Plan only in this commit. Do not implement production code while writing this plan.
- Uploaded lesson plans remain authoritative.
- Do not weaken Gate 0, Gate 1, Gate 2, Gate 3, or Gate 4 contracts.
- Do not modify prompts, model/provider selection, deployment environment variables, or image provider behavior.
- Do not turn on live curated, R2, or provider adapters in this gate.
- No private DOCX, PPTX, PDF, images, rendered references, extracted lesson text, teacher names, learner data, or school-identifying content.
- No push, deployment, or pull request.
- Disabled Gate 5, disabled semantic scenes, disabled Gate 4, topic-only routes, and legacy routes remain unchanged.
- Gate 5 validation runs after Gate 4 scene compilation and before source-primary scene delivery or any successful source-primary scene cache write.
- Failed Gate 5 validation must not be cached as success.
- Optional asset failure may pass only when the editable no-image fallback remains valid.

---

## Current Insertion Point

Accepted Gate 4 source-primary scene generation is centralized in:

```ts
resolveDeckVisualScenePresentationForGeneration(
  routePolicy,
  SEMANTIC_SLIDES_V1_FLAG,
  DECK_VISUAL_SYSTEM_V1_FLAG,
  teachingStoryboardBoundary.storyboard,
  {
    title,
    selectedUnitLabel,
  },
);
```

`App.tsx` calls this boundary in:

- single K-12 uploaded-source generation before legacy cache lookup, quota increment, reusable seeds, AI calls, image processing, and delivery;
- daily plan-unit generation before legacy cache lookup, quota increment, reusable seeds, AI calls, image processing, and delivery.

Gate 5 adds a wrapper boundary:

```ts
resolveEndToEndValidatedScenePresentationForGeneration(
  routePolicy,
  SEMANTIC_SLIDES_V1_FLAG,
  DECK_VISUAL_SYSTEM_V1_FLAG,
  END_TO_END_VALIDATION_V1_FLAG,
  sourceManifestBoundary.manifest,
  teachingStoryboardBoundary.storyboard,
  {
    title,
    selectedUnitLabel,
  },
);
```

Rules:

- If semantic scenes are disabled, return the exact current Gate 4/legacy result.
- If Gate 5 is false-like, delegate to exact `resolveDeckVisualScenePresentationForGeneration(...)`.
- If Gate 5 is true-like and a source-primary compiled scene presentation exists, validate it before returning it to `App.tsx`.
- If validation fails, return a blocking boundary result and no presentation.
- If no scene presentation exists because the route is topic-only or legacy, return the delegated result unchanged.

## Tiny Necessary Gate 4 Extension

Gate 5 needs access to the artifacts Gate 4 already built. To avoid rebuilding and risking divergence, add one optional field to the Gate 4 success boundary only when requested:

```ts
export type DeckVisualSceneBoundaryArtifacts = {
  semanticSpecs: SemanticSlideSpec[];
  visualSystems: DeckVisualSystemBundle;
  assetRequests: SceneAssetRequest[];
  resolvedAssetsBySpecId: Record<string, SceneResolvedAsset[]>;
};

export type DeckVisualSceneBoundaryOptions = {
  title: string;
  selectedUnitLabel?: string;
  budget?: SceneAssetBudget;
  adapters?: SceneAssetAdapters;
  includeValidationArtifacts?: boolean;
};
```

When `includeValidationArtifacts` is absent or false, the Gate 4 boundary return shape and behavior remain unchanged. Gate 5 calls it with `includeValidationArtifacts: true`.

## Rollout Flag

Add an App-local flag during implementation:

```ts
const END_TO_END_VALIDATION_V1_FLAG = import.meta.env.VITE_END_TO_END_VALIDATION_V1;
```

Create a pure helper in `lib/endToEndValidation.ts`:

```ts
export const isEndToEndValidationV1Enabled = (flagValue: unknown): boolean => {
  if (typeof flagValue !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(flagValue.trim().toLowerCase());
};
```

Flag behavior:

- Enabled only when the route is source-primary uploaded input and a compiled scene presentation exists.
- False-like values preserve exact accepted Gate 4 behavior.
- Topic-only and legacy routes remain unchanged.
- Validation failure consumes no generation quota and writes no successful cache entry because the App only increments quota after the boundary returns a presentation.

## EndToEndValidationReport Contract

Create `lib/endToEndValidation.ts`.

```ts
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';
import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import type { DeckVisualSystemBundle } from './deckVisualSystem.ts';
import type { SceneAssetRequest } from './sceneAssetRequests.ts';
import type { SceneResolvedAsset } from './sceneAssetResolver.ts';
import type { CompiledScenePresentation } from './compiledSlideScene.ts';

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
```

Release threshold mapping:

- 100 percent source-step coverage maps to `e2e_source_step_coverage_failed`.
- 100 percent objective count/order/ownership/meaning maps to `e2e_objective_preservation_failed`.
- Zero sequence inversions maps to `e2e_sequence_inversion`.
- Zero foreign-session content maps to `e2e_foreign_session_content`.
- Zero unsupported inventions maps to `e2e_unsupported_invention`.
- Zero blank-field inventions maps to `e2e_blank_field_invented`.
- Zero visible teacher-script violations maps to `e2e_teacher_script_visible`.
- 100 percent visible editable text maps to `e2e_preview_text_not_editable`.
- Zero full-slide raster images maps to `e2e_full_slide_raster`.
- Zero invalid artifact cache writes maps to `e2e_cache_write_forbidden`.

## Expected Implementation File Set

Expected files to change during Gate 5 implementation:

- Modify: `App.tsx`
- Modify: `lib/deckVisualSceneBoundary.ts`
- Create: `lib/endToEndSceneBoundary.ts`
- Create: `lib/endToEndValidation.ts`
- Create: `lib/sourceAlignmentValidation.ts`
- Create: `lib/renderedSceneValidation.ts`
- Create: `lib/pptxRoundTripValidation.ts`
- Create: `lib/sourcePrimarySceneCacheSafety.ts`
- Create: `tests/fixtures/endToEndValidationFixtures.ts`
- Create: `tests/endToEndValidation.test.ts`
- Create: `tests/sourceAlignmentValidation.test.ts`
- Create: `tests/renderedSceneValidation.test.ts`
- Create: `tests/pptxRoundTripValidation.test.ts`
- Create: `tests/sourcePrimarySceneCacheSafety.test.ts`
- Create: `docs/superpowers/baselines/2026-07-11-gate5-end-to-end-validation-baseline.md`

Allowed test helpers:

- Create: `tests/helpers/pptxPackageInspection.ts` only if PPTX ZIP package inspection can be implemented with packages already present in the current lockfile and without modifying `package.json` or `package-lock.json`.
- If ZIP inspection cannot typecheck without package changes, do not add a dependency in Gate 5. Keep operation-level PPTX round-trip validation in Gate 5 and require a separate planner amendment for dependency changes.

Forbidden files unless a reviewed amendment narrows the scope:

- `services/geminiService.ts`
- `lib/imagePrompting.ts`
- `lib/serverImageGeneration.ts`
- `api/_pexelsImageSearch.ts`
- `api/_r2ImageCache.ts`
- `scripts/upload-curated-r2-images.mjs`
- `scripts/generate-r2-images.ts`
- `public/curated-images/**`
- `types.ts`
- `lib/k12GenerationRoutePolicy.ts`
- `lib/lessonSourceManifest.ts`
- `lib/teachingStoryboard.ts`
- `lib/semanticSlideSpec.ts`
- `lib/compiledSlideScene.ts`
- `lib/compiledScenePptx.ts`
- `lib/deckVisualSystem.ts`
- `lib/sceneAssetRequests.ts`
- `lib/sceneAssetDecisionPolicy.ts`
- `lib/sceneAssetResolver.ts`
- `lib/generationCache.ts`
- `package.json`
- `package-lock.json`

## Task 1: Add End-to-End Fixtures and RED Boundary Tests

**Files:**
- Create: `tests/fixtures/endToEndValidationFixtures.ts`
- Create: `tests/endToEndValidation.test.ts`
- Create in Task 2: `lib/endToEndValidation.ts`
- Create in Task 6: `lib/endToEndSceneBoundary.ts`

**Interfaces:**
- Consumes existing sanitized fixtures from `tests/fixtures/lessonSourceManifestFixtures.ts`, `tests/fixtures/teachingStoryboardFixtures.ts`, `tests/fixtures/semanticSlideFixtures.ts`, and `tests/fixtures/deckVisualSystemFixtures.ts`.
- Produces `buildValidEndToEndFixture()` for all Gate 5 tests.

- [ ] **Step 1: Add fixture assembly helper**

```ts
import assert from 'node:assert/strict';

import { buildDeckVisualSystems } from '../../lib/deckVisualSystem.ts';
import { compileSemanticSlideSpecsToScenes } from '../../lib/compiledSlideScene.ts';
import { buildLessonSourceManifest } from '../../lib/lessonSourceManifest.ts';
import {
  buildSceneAssetRequests,
  type SceneAssetRequest,
} from '../../lib/sceneAssetRequests.ts';
import {
  resolveSceneAssets,
  type SceneResolvedAsset,
} from '../../lib/sceneAssetResolver.ts';
import { buildSemanticSlideSpecs } from '../../lib/semanticSlideSpec.ts';
import { buildTeachingStoryboard } from '../../lib/teachingStoryboard.ts';
import {
  EVIDENCE_OUTPUT_DOCUMENT,
  TEACHER_SCRIPT_DOCUMENT,
} from './teachingStoryboardFixtures.ts';
import {
  FIVE_SESSION_MATRIX_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
} from './lessonSourceManifestFixtures.ts';

const materializeFixture = async (document: Parameters<typeof buildLessonSourceManifest>[0]) => {
  const manifestResult = buildLessonSourceManifest(document);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) throw new Error('manifest fixture failed');

  const storyboardResult = buildTeachingStoryboard(manifestResult.manifest);
  assert.equal(storyboardResult.ok, true);
  if (!storyboardResult.ok) throw new Error('storyboard fixture failed');

  const semanticResult = buildSemanticSlideSpecs(storyboardResult.storyboard);
  assert.equal(semanticResult.ok, true);
  if (!semanticResult.ok) throw new Error('semantic fixture failed');

  const visualResult = buildDeckVisualSystems(storyboardResult.storyboard, semanticResult.specs);
  assert.equal(visualResult.ok, true);
  if (!visualResult.ok) throw new Error('visual fixture failed');

  const requestsResult = buildSceneAssetRequests(
    storyboardResult.storyboard,
    semanticResult.specs,
    visualResult.bundle,
  );
  assert.equal(requestsResult.ok, true);
  if (!requestsResult.ok) throw new Error('asset request fixture failed');

  const resolverResult = await resolveSceneAssets(requestsResult.requests);
  assert.equal(resolverResult.ok, true);
  if (!resolverResult.ok) throw new Error('asset resolver fixture failed');

  const resolvedAssetsBySpecId = Object.fromEntries(semanticResult.specs.map((spec) => [
    spec.id,
    resolverResult.assets.filter((asset) => asset.semanticSlideSpecId === spec.id),
  ]));
  const specsWithRequests = semanticResult.specs.map((spec) => ({
    ...spec,
    assetRequests: requestsResult.requests.filter((request) => request.semanticSlideSpecId === spec.id),
  }));

  const sceneResult = compileSemanticSlideSpecsToScenes(specsWithRequests, {
    title: 'Sanitized Fixture Deck',
    visualSystemsByUnitId: visualResult.bundle.systemsByUnitId,
    resolvedAssetsBySpecId,
  });
  assert.equal(sceneResult.ok, true);
  if (!sceneResult.ok) throw new Error('scene fixture failed');

  return {
    sourceManifest: manifestResult.manifest,
    storyboard: storyboardResult.storyboard,
    semanticSpecs: specsWithRequests,
    visualSystems: visualResult.bundle,
    assetRequests: requestsResult.requests,
    resolvedAssetsBySpecId,
    presentation: sceneResult.presentation,
  };
};

export const buildEvidenceOutputEndToEndFixture = () => materializeFixture(EVIDENCE_OUTPUT_DOCUMENT);
export const buildTeacherScriptEndToEndFixture = () => materializeFixture(TEACHER_SCRIPT_DOCUMENT);
export const buildFiveSessionEndToEndFixture = () => materializeFixture(FIVE_SESSION_MATRIX_DOCUMENT);
export const buildMultiObjectiveEndToEndFixture = () => materializeFixture(MULTI_OBJECTIVE_UNIT_DOCUMENT);

export const flattenResolvedAssets = (resolvedAssetsBySpecId: Record<string, SceneResolvedAsset[]>): SceneResolvedAsset[] => (
  Object.values(resolvedAssetsBySpecId).flat()
);

export const cloneAssetRequest = (request: SceneAssetRequest): SceneAssetRequest => ({
  ...request,
  sourceStepIds: [...request.sourceStepIds],
  sourceObjectiveIds: [...request.sourceObjectiveIds],
  conceptAnchor: { ...request.conceptAnchor },
  altTextBasis: {
    ...request.altTextBasis,
    sourceStepIds: [...request.altTextBasis.sourceStepIds],
  },
  brief: {
    ...request.brief,
    negativeConstraints: [...request.brief.negativeConstraints],
  },
  privacy: { ...request.privacy },
});
```

- [ ] **Step 2: Write RED report and flag tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import {
  END_TO_END_VALIDATION_VERSION,
  isEndToEndValidationV1Enabled,
  validateEndToEndScenePresentation,
} from '../lib/endToEndValidation.ts';
import { resolveEndToEndValidatedScenePresentationForGeneration } from '../lib/endToEndSceneBoundary.ts';
import { buildEvidenceOutputEndToEndFixture } from './fixtures/endToEndValidationFixtures.ts';

test('accepts only documented true-like Gate 5 flag values', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(isEndToEndValidationV1Enabled(value), true);
  }
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) {
    assert.equal(isEndToEndValidationV1Enabled(value), false);
  }
});

test('builds a passing end-to-end validation report for a valid source-primary scene deck', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = validateEndToEndScenePresentation(fixture);

  assert.equal(result.ok, true);
  assert.equal(result.report.contractVersion, END_TO_END_VALIDATION_VERSION);
  assert.equal(result.report.storyboard.sourceStepCoverageRatio, 1);
  assert.equal(result.report.semanticSpecs.objectiveCoverageRatio, 1);
  assert.equal(result.report.scenes.fullSlideRasterCount, 0);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, true);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, true);
});

test('returns exact Gate 4 behavior when Gate 5 flag is disabled', async () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'false',
    fixture.sourceManifest,
    fixture.storyboard,
    { title: 'Sanitized Fixture Deck' },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.presentation);
  assert.equal('validationReport' in result, false);
});

test('blocks source-primary scene delivery on a release-threshold failure', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, index) => index === 0
        ? { ...scene, sourceStepIds: [] }
        : scene),
    },
  };

  const result = validateEndToEndScenePresentation(invalid);

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_source_step_coverage_failed'), true);
  assert.equal(result.report.cacheSafety.mayDeliverPresentation, false);
  assert.equal(result.report.cacheSafety.mayWriteSuccessCache, false);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test
```

Expected:

```text
ERR_MODULE_NOT_FOUND for lib/endToEndValidation.ts
```

## Task 2: Implement Report Contract and Cache Safety

**Files:**
- Create: `lib/endToEndValidation.ts`
- Create: `lib/sourcePrimarySceneCacheSafety.ts`
- Create: `tests/sourcePrimarySceneCacheSafety.test.ts`

**Interfaces:**
- Produces `isEndToEndValidationV1Enabled(flagValue: unknown): boolean`.
- Produces `buildEndToEndValidationReport(input: EndToEndValidationInput, diagnostics: EndToEndDiagnostic[]): EndToEndValidationReport`.
- Produces `validateEndToEndScenePresentation(input: EndToEndValidationInput): EndToEndValidationResult`.
- Produces `decideSourcePrimarySceneCacheSafety(report): CacheSafetyDecision`.

- [ ] **Step 1: Write RED cache safety tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  END_TO_END_VALIDATION_VERSION,
  type EndToEndValidationReport,
} from '../lib/endToEndValidation.ts';
import { decideSourcePrimarySceneCacheSafety } from '../lib/sourcePrimarySceneCacheSafety.ts';

const report = (diagnosticCount: number): EndToEndValidationReport => ({
  contractVersion: END_TO_END_VALIDATION_VERSION,
  route: { mode: 'source-primary', inputOrigin: 'uploaded-file' },
  sourceManifest: { checked: 1, passed: 1, failed: 0, blocking: 0, contractVersion: 'lesson-source-manifest-v1', sourceHash: 'fixture-hash', selectedUnitIds: ['unit-001'], objectiveCount: 1, sourceStepCount: 2 },
  storyboard: { checked: 1, passed: 1, failed: 0, blocking: 0, sourceStepCoverageRatio: 1, objectiveCoverageRatio: 1, sequenceInversionCount: 0, foreignSessionContentCount: 0, unsupportedInventionCount: 0, blankFieldInventionCount: 0, teacherScriptViolationCount: 0 },
  semanticSpecs: { checked: 1, passed: 1, failed: 0, blocking: 0, sourceStepCoverageRatio: 1, objectiveCoverageRatio: 1, sequenceInversionCount: 0, foreignSessionContentCount: 0, unsupportedInventionCount: 0, blankFieldInventionCount: 0, teacherScriptViolationCount: 0, specCount: 2 },
  visualSystemAndAssets: { checked: 1, passed: 1, failed: 0, blocking: 0, visualSystemCount: 1, assetRequestCount: 1, resolvedAssetCount: 1, omittedOptionalAssetCount: 1 },
  scenes: { checked: 1, passed: 1, failed: 0, blocking: 0, renderedSceneCount: 2, canvasWidth: 1280, canvasHeight: 720, offCanvasCount: 0, overflowCount: 0, unreadableTextCount: 0, uneditableVisibleTextCount: 0, fullSlideRasterCount: 0 },
  renderedPreview: { checked: 1, passed: 1, failed: 0, blocking: 0, renderedSceneCount: 2, canvasWidth: 1280, canvasHeight: 720, offCanvasCount: 0, overflowCount: 0, unreadableTextCount: 0, uneditableVisibleTextCount: 0, fullSlideRasterCount: 0 },
  pptxRoundTrip: { checked: 1, passed: 1, failed: 0, blocking: 0, slideCount: 2, nativeTextOperationCount: 2, nativeTableOperationCount: 1, nativeShapeOperationCount: 2, imageOperationCount: 0, speakerNotesCount: 2, extractedTextCount: 3, extractedNotesCount: 2, fullSlideImageCount: 0 },
  cacheSafety: { cacheContractVersion: 'source-primary-scene-cache-v1', validationVersion: END_TO_END_VALIDATION_VERSION, mayWriteSuccessCache: diagnosticCount === 0, mayDeliverPresentation: diagnosticCount === 0, reason: diagnosticCount === 0 ? 'validation_passed' : 'validation_failed' },
  diagnostics: Array.from({ length: diagnosticCount }, (_, index) => ({
    code: 'e2e_source_step_coverage_failed',
    severity: 'blocking',
    message: `Diagnostic ${index + 1}`,
  })),
});

test('allows success cache writes only for passing validation reports', () => {
  assert.equal(decideSourcePrimarySceneCacheSafety(report(0)).mayWriteSuccessCache, true);
  assert.equal(decideSourcePrimarySceneCacheSafety(report(0)).mayDeliverPresentation, true);
});

test('blocks cache writes and delivery when any blocking diagnostic exists', () => {
  const decision = decideSourcePrimarySceneCacheSafety(report(1));

  assert.equal(decision.mayWriteSuccessCache, false);
  assert.equal(decision.mayDeliverPresentation, false);
  assert.equal(decision.reason, 'validation_failed');
});
```

- [ ] **Step 2: Implement contract and helper**

Implementation details:

```ts
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
```

Cache safety:

```ts
import {
  END_TO_END_VALIDATION_VERSION,
  hasBlockingEndToEndDiagnostics,
  type CacheSafetyDecision,
  type EndToEndValidationReport,
} from './endToEndValidation.ts';

export const decideSourcePrimarySceneCacheSafety = (report: Pick<EndToEndValidationReport, 'diagnostics'>): CacheSafetyDecision => {
  const blocked = hasBlockingEndToEndDiagnostics(report.diagnostics);
  return {
    cacheContractVersion: 'source-primary-scene-cache-v1',
    validationVersion: END_TO_END_VALIDATION_VERSION,
    mayWriteSuccessCache: !blocked,
    mayDeliverPresentation: !blocked,
    reason: blocked ? 'validation_failed' : 'validation_passed',
  };
};
```

- [ ] **Step 3: Verify**

Run:

```bash
npm test
```

Expected: cache safety tests pass; source/render/PPTX tests remain red until their modules are added.

## Task 3: Implement Source Alignment Validators

**Files:**
- Create: `lib/sourceAlignmentValidation.ts`
- Create: `tests/sourceAlignmentValidation.test.ts`
- Modify: `lib/endToEndValidation.ts`

**Interfaces:**
- Produces `validateSourceAlignment(input: EndToEndValidationInput): SourceAlignmentValidationResult`.
- Consumes `LessonSourceManifest`, `TeachingStoryboard`, `SemanticSlideSpec[]`, and `CompiledScenePresentation`.
- Produces diagnostics using Gate 5 codes.

- [ ] **Step 1: Write RED source alignment tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSourceAlignment } from '../lib/sourceAlignmentValidation.ts';
import {
  buildEvidenceOutputEndToEndFixture,
  buildFiveSessionEndToEndFixture,
  buildMultiObjectiveEndToEndFixture,
  buildTeacherScriptEndToEndFixture,
} from './fixtures/endToEndValidationFixtures.ts';

test('passes mandatory source-step coverage and objective preservation for valid fixtures', async () => {
  for (const fixtureBuilder of [
    buildEvidenceOutputEndToEndFixture,
    buildFiveSessionEndToEndFixture,
    buildMultiObjectiveEndToEndFixture,
    buildTeacherScriptEndToEndFixture,
  ]) {
    const result = validateSourceAlignment(await fixtureBuilder());
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.summary.sourceStepCoverageRatio, 1);
    assert.equal(result.summary.objectiveCoverageRatio, 1);
  }
});

test('blocks omitted source-step coverage', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, index) => index === 1
        ? { ...scene, sourceStepIds: [] }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_source_step_coverage_failed'), true);
});

test('blocks objective reorder, duplicate, or ownership mismatch', async () => {
  const fixture = await buildMultiObjectiveEndToEndFixture();
  const invalid = {
    ...fixture,
    semanticSpecs: fixture.semanticSpecs.map((spec, index) => index === 0
      ? { ...spec, sourceObjectiveIds: [...spec.sourceObjectiveIds].reverse() }
      : spec),
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_objective_preservation_failed'), true);
});

test('blocks sequence inversions', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: [...fixture.presentation.scenes].reverse(),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_sequence_inversion'), true);
});

test('blocks foreign-session source IDs in compiled scenes', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, index) => index === 0
        ? { ...scene, unitId: 'unit-999', sourceStepIds: ['step-999'] }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_foreign_session_content'), true);
});

test('blocks unsupported invented visible activity or assessment text', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
        ? {
            ...scene,
            elements: scene.elements.map((element, elementIndex) => element.kind === 'text' && elementIndex === 1
              ? { ...element, runs: [{ ...element.runs[0], text: 'Complete an unlisted homework assignment and quiz.' }] }
              : element),
          }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_unsupported_invention'), true);
});

test('blocks visible teacher-script and blank-field invention', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture,
    presentation: {
      ...fixture.presentation,
      scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
        ? {
            ...scene,
            elements: scene.elements.map((element, elementIndex) => element.kind === 'text' && elementIndex === 1
              ? { ...element, runs: [{ ...element.runs[0], text: 'The teacher will ask learners to answer the blank source field.' }] }
              : element),
          }
        : scene),
    },
  };

  const result = validateSourceAlignment(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_teacher_script_visible'), true);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_blank_field_invented'), true);
});
```

- [ ] **Step 2: Implement deterministic source alignment rules**

Rules:

- Selected source steps are `sourceManifest.units` steps for the selected manifest units.
- Scene source-step coverage is the union of `presentation.scenes[].sourceStepIds`.
- Semantic spec source-step coverage is the union of `semanticSpecs[].sourceStepIds`.
- Every selected source step must appear in the storyboard accounting and at least one scene or teacher-note accounting entry.
- Scene order must follow the selected source step `sourceOrder`; adjacent continuation scenes with the same first source step are allowed.
- Every `sourceObjectiveId` in storyboard, specs, and scenes must exist in the selected manifest objective list for the same unit.
- Objective order is the manifest objective source order, and the same order must appear in storyboard objectives and objective-bearing semantic specs.
- Foreign-session content is any scene/spec/source ID whose unit ownership is not in the selected source manifest units.
- Unsupported inventions are visible strings matching `homework`, `quiz`, `assignment`, `answer key`, `reflection`, `project`, `assessment`, or `experiment` when none of the owning source steps, required evidence, required outputs, or storyboard content for that screen contains the same instruction category.
- Blank-field invention is visible text containing `blank`, `missing`, `not provided`, or `answer the blank` when the owning source field accounting state is `blank` or `missing` and that field was not intentionally presented as blank-preserved metadata.
- Teacher-script uses the existing Gate 2 `detectVisibleTeacherScript`.

- [ ] **Step 3: Wire source alignment into report assembly**

`validateEndToEndScenePresentation(input)` calls `validateSourceAlignment(input)` and appends diagnostics to the report before cache safety is decided.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
```

Expected: source alignment tests pass.

## Task 4: Implement Rendered Preview Validation

**Files:**
- Create: `lib/renderedSceneValidation.ts`
- Create: `tests/renderedSceneValidation.test.ts`
- Modify: `lib/endToEndValidation.ts`

**Interfaces:**
- Produces `validateRenderedScenes(presentation: CompiledScenePresentation): RenderedSceneValidationResult`.
- Consumes `createPreviewSceneDescriptors`, `validateCompiledSlideScene`, and `getSceneVisibleText`.

- [ ] **Step 1: Write RED render validation tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateRenderedScenes } from '../lib/renderedSceneValidation.ts';
import { buildEvidenceOutputEndToEndFixture } from './fixtures/endToEndValidationFixtures.ts';

test('validates every compiled scene as a 1280 by 720 rendered preview surface', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = validateRenderedScenes(fixture.presentation);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.summary.renderedSceneCount, fixture.presentation.scenes.length);
  assert.equal(result.summary.canvasWidth, 1280);
  assert.equal(result.summary.canvasHeight, 720);
  assert.equal(result.summary.uneditableVisibleTextCount, 0);
  assert.equal(result.summary.fullSlideRasterCount, 0);
});

test('blocks uneditable visible preview text', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture.presentation,
    scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
      ? {
          ...scene,
          elements: scene.elements.map((element) => element.kind === 'text'
            ? { ...element, editable: false }
            : element),
        }
      : scene),
  };

  const result = validateRenderedScenes(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_preview_text_not_editable'), true);
});

test('blocks off-canvas, overflow, unreadable text, and full-slide raster images', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const firstScene = fixture.presentation.scenes[0];
  const invalidText = firstScene.elements.find((element) => element.kind === 'text');
  assert.ok(invalidText);
  const invalid = {
    ...fixture.presentation,
    scenes: [
      {
        ...firstScene,
        elements: firstScene.elements.map((element) => element.id === invalidText.id
          ? { ...element, frame: { ...element.frame, x: -1, h: 4 }, fontSize: 8 }
          : element),
      },
      ...fixture.presentation.scenes.slice(1),
    ],
  };

  const result = validateRenderedScenes(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_scene_render_invalid'), true);
});
```

- [ ] **Step 2: Implement render validation**

Implementation rules:

- Use scene contract dimensions, not browser screenshots, for Gate 5 repository tests.
- A scene renders at `1280 x 720` only when `scene.size.width === 1280`, `scene.size.height === 720`, and `scene.size.aspect === '16:9'`.
- Reuse `validateCompiledSlideScene(scene)` for off-canvas, overflow, reading-order, and full-slide raster checks.
- Add Gate 5-specific diagnostics:
  - `e2e_scene_render_invalid` for off-canvas, overflow, unreadable small text, contrast failure, or reading-order failure;
  - `e2e_preview_text_not_editable` for any visible text/table element with `editable !== true`;
  - `e2e_full_slide_raster` for full-slide image frames.
- Text is unreadably small when any visible text element has `fontSize < 14`.
- Preview text is native/selectable when every visible text/table element is a native scene element and `editable === true`.
- Image failure is valid only when the scene has no required unresolved image and the editable native layout still passes all text/geometry checks.

- [ ] **Step 3: Wire rendered preview validation into report assembly**

The report uses the same `RenderValidationSummary` shape for `scenes` and `renderedPreview`; `scenes` is contract validation and `renderedPreview` is preview renderability validation.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
```

Expected: render validation tests pass.

## Task 5: Implement PPTX Round-Trip Validation

**Files:**
- Create: `lib/pptxRoundTripValidation.ts`
- Create: `tests/pptxRoundTripValidation.test.ts`
- Optional create: `tests/helpers/pptxPackageInspection.ts`
- Modify: `lib/endToEndValidation.ts`

**Interfaces:**
- Produces `validatePptxRoundTrip(presentation: CompiledScenePresentation): Promise<PptxRoundTripValidationResult>`.
- Consumes `compilePptxSceneOperations(scene)` and `getPptxSceneOperationText(operations)`.
- Optionally consumes `pptxgenjs` and `jszip` in tests only to inspect generated `.pptx` XML when available without dependency changes.

- [ ] **Step 1: Write RED PPTX operation round-trip tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePptxRoundTrip } from '../lib/pptxRoundTripValidation.ts';
import { buildEvidenceOutputEndToEndFixture } from './fixtures/endToEndValidationFixtures.ts';

test('validates native PPTX text, notes, shapes, tables, and bounded image operations', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await validatePptxRoundTrip(fixture.presentation);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.summary.slideCount, fixture.presentation.scenes.length);
  assert.equal(result.summary.nativeTextOperationCount > 0, true);
  assert.equal(result.summary.speakerNotesCount, fixture.presentation.scenes.filter((scene) => scene.speakerNotes.trim()).length);
  assert.equal(result.summary.fullSlideImageCount, 0);
});

test('blocks missing PPTX text compared with preview text', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const invalid = {
    ...fixture.presentation,
    scenes: fixture.presentation.scenes.map((scene, sceneIndex) => sceneIndex === 0
      ? {
          ...scene,
          elements: scene.elements.filter((element) => element.kind !== 'text'),
          readingOrder: scene.readingOrder.filter((elementId) => !scene.elements.some((element) => element.id === elementId && element.kind === 'text')),
        }
      : scene),
  };

  const result = await validatePptxRoundTrip(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_pptx_round_trip_invalid'), true);
});

test('blocks full-slide image PPTX operations', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const firstScene = fixture.presentation.scenes[0];
  const invalid = {
    ...fixture.presentation,
    scenes: [
      {
        ...firstScene,
        elements: [
          ...firstScene.elements,
          {
            id: 'scene-001-full-slide-image',
            kind: 'image' as const,
            frame: { x: 0, y: 0, w: 1280, h: 720 },
            editable: true,
            readingOrder: 999,
            src: 'data:image/png;base64,fixture',
            altText: 'Invalid full slide image.',
            assetId: 'assetreq-invalid',
            visualRole: 'curated-educational-visual' as const,
            sourceStepIds: firstScene.sourceStepIds,
            storyboardScreenId: firstScene.storyboardScreenId,
            semanticSlideSpecId: firstScene.semanticSlideSpecId,
            noEmbeddedText: true as const,
          },
        ],
      },
      ...fixture.presentation.scenes.slice(1),
    ],
  };

  const result = await validatePptxRoundTrip(invalid);

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'e2e_full_slide_raster'), true);
});
```

- [ ] **Step 2: Implement operation-level round-trip validation**

Rules:

- Compile PPTX operations from every scene.
- Preview visible text comes from scene native text and table elements.
- PPTX visible text comes from `getPptxSceneOperationText(operations)`.
- Normalize whitespace before comparison.
- Speaker notes count must equal scenes with non-empty `speakerNotes`.
- Every visible text/table/shape/connector scene element must have a corresponding native PPTX operation.
- Every image operation must be bounded smaller than the full 10 x 5.625 inch slide.
- No operation may represent a full-slide screenshot/canvas export.

- [ ] **Step 3: Add optional package inspection helper only if dependency-free**

If direct dynamic import works without package changes:

```ts
const JSZip = (await import('jszip')).default;
```

Then `tests/helpers/pptxPackageInspection.ts` may inspect generated PPTX buffers for:

- `ppt/slides/slide*.xml` text runs;
- `ppt/notesSlides/notesSlide*.xml` notes text;
- picture extents in slide XML;
- shape/table XML presence.

If this helper cannot typecheck without changing package files, skip package XML inspection in Gate 5 and leave operation-level round-trip as the hard validator. Do not modify `package.json` or `package-lock.json`.

- [ ] **Step 4: Wire PPTX round-trip validation into report assembly**

`validateEndToEndScenePresentation(input)` awaits PPTX validation before cache safety is decided.

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm run typecheck
```

Expected: PPTX validation tests and typecheck pass.

## Task 6: Add End-to-End Boundary Integration

**Files:**
- Create: `lib/endToEndSceneBoundary.ts`
- Modify: `lib/deckVisualSceneBoundary.ts`
- Modify: `App.tsx`
- Test: `tests/endToEndValidation.test.ts`

**Interfaces:**
- Consumes `resolveDeckVisualScenePresentationForGeneration(...)`.
- Produces `resolveEndToEndValidatedScenePresentationForGeneration(...)`.

- [ ] **Step 1: Add additive Gate 4 artifact return**

Modify `lib/deckVisualSceneBoundary.ts` so success responses include artifacts only when `options.includeValidationArtifacts === true`:

```ts
return {
  ok: true,
  presentation: sceneResult.presentation,
  visualSystems: visualSystemsResult.bundle,
  validationArtifacts: options.includeValidationArtifacts ? {
    semanticSpecs: specsWithRequests,
    visualSystems: visualSystemsResult.bundle,
    assetRequests: requestsResult.requests,
    resolvedAssetsBySpecId,
  } : undefined,
};
```

Tests must prove existing Gate 4 disabled behavior remains deeply equal when `includeValidationArtifacts` is not set.

- [ ] **Step 2: Implement Gate 5 boundary**

```ts
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import type { LessonSourceManifest } from './lessonSourceManifest.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';
import {
  resolveDeckVisualScenePresentationForGeneration,
  type DeckVisualSceneBoundaryOptions,
} from './deckVisualSceneBoundary.ts';
import {
  formatEndToEndDiagnostics,
  isEndToEndValidationV1Enabled,
  validateEndToEndScenePresentation,
  type EndToEndValidationReport,
  type EndToEndDiagnostic,
} from './endToEndValidation.ts';

export type EndToEndSceneBoundary =
  | { ok: true; presentation: Awaited<ReturnType<typeof resolveDeckVisualScenePresentationForGeneration>> extends infer Result ? Result extends { ok: true; presentation: infer Presentation } ? Presentation : never : never; validationReport?: EndToEndValidationReport }
  | { ok: false; message: string; diagnostics: EndToEndDiagnostic[]; validationReport?: EndToEndValidationReport };

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
    return resolveDeckVisualScenePresentationForGeneration(policy, semanticFlagValue, deckVisualFlagValue, storyboard, options);
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

  const validationResult = await validateEndToEndScenePresentation({
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
    validationReport: validationResult.report,
  };
};
```

During implementation, simplify the return type if TypeScript inference becomes noisy; keep the runtime behavior above.

- [ ] **Step 3: Wire App flag and boundary**

In `App.tsx`:

```ts
const END_TO_END_VALIDATION_V1_FLAG = import.meta.env.VITE_END_TO_END_VALIDATION_V1;
```

Replace only the two existing source-primary scene boundary calls:

```ts
const semanticSceneBoundary = await resolveEndToEndValidatedScenePresentationForGeneration(
  routePolicy,
  SEMANTIC_SLIDES_V1_FLAG,
  DECK_VISUAL_SYSTEM_V1_FLAG,
  END_TO_END_VALIDATION_V1_FLAG,
  sourceManifestBoundary.manifest,
  teachingStoryboardBoundary.storyboard,
  {
    title,
    selectedUnitLabel,
  },
);
```

Do not change legacy cache keys, reusable-seed logic, quota logic, AI calls, image processing, renderer behavior, or export behavior.

- [ ] **Step 4: Add boundary tests**

Add to `tests/endToEndValidation.test.ts`:

```ts
test('source-primary Gate 5 blocks before delivery and before adapter-side cache success', async () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.sourceManifest,
    {
      ...fixture.storyboard,
      screens: [],
    },
    { title: 'Sanitized Fixture Deck' },
  );

  assert.equal(result.ok, false);
});

test('topic-only Gate 5 remains unchanged', async () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy,
    'true',
    'true',
    'true',
    fixture.sourceManifest,
    fixture.storyboard,
    { title: 'Sanitized Fixture Deck' },
  );

  assert.deepEqual(result, { ok: true, presentation: null });
});
```

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm run typecheck
```

Expected: all Gate 5 boundary tests pass and typecheck passes.

## Task 7: Add Baseline, Final Verification, and Implementation Report Requirements

**Files:**
- Create: `docs/superpowers/baselines/2026-07-11-gate5-end-to-end-validation-baseline.md`

- [ ] **Step 1: Add sanitized baseline**

The baseline must include:

- contract versions only;
- sanitized fixture names only;
- expected unit/objective/source-step/scene counts;
- expected passing summaries;
- expected negative diagnostic codes;
- no rendered screenshots, no PPTX files, no DOCX/PDF inputs, no extracted private text.

Baseline sections:

```md
# Gate 5 End-to-End Hard Validation Baseline

## Contract Versions

- end-to-end-validation-v1
- source-primary-scene-cache-v1
- lesson-source-manifest-v1
- teaching-storyboard-v1
- semantic-slide-spec-v1
- deck-visual-system-v1
- scene-asset-request-v1
- scene-asset-resolution-v1
- compiled-slide-scene-v1

## Sanitized Fixtures

- Evidence/output fixture: validates required evidence/output attachment through scene, preview, PPTX operations, and cache decision.
- Teacher-script fixture: validates teacher-script is absent from visible preview/PPTX text.
- Five-session fixture: validates selected-session coverage and zero foreign-session leakage.
- Multi-objective fixture: validates objective count, source order, and ownership.
- Bounded asset fallback fixture: validates optional omitted asset keeps an editable scene.

## Required Negative Diagnostics

- e2e_source_step_coverage_failed
- e2e_objective_preservation_failed
- e2e_sequence_inversion
- e2e_foreign_session_content
- e2e_unsupported_invention
- e2e_blank_field_invented
- e2e_teacher_script_visible
- e2e_scene_render_invalid
- e2e_preview_text_not_editable
- e2e_pptx_round_trip_invalid
- e2e_full_slide_raster
- e2e_cache_write_forbidden
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

- [ ] **Step 3: Verify changed-file scope**

Run:

```bash
git diff --name-only 0a80162c5ec91d9f47e15cc503ca5ac03a2a93c4..HEAD
```

Expected: only the Gate 5 implementation file set listed in this plan.

- [ ] **Step 4: Verify forbidden scope**

Run:

```bash
git diff --exit-code 0a80162c5ec91d9f47e15cc503ca5ac03a2a93c4..HEAD -- \
  services/geminiService.ts \
  lib/imagePrompting.ts \
  lib/serverImageGeneration.ts \
  api/_pexelsImageSearch.ts \
  api/_r2ImageCache.ts \
  scripts/upload-curated-r2-images.mjs \
  scripts/generate-r2-images.ts \
  public/curated-images \
  types.ts \
  lib/k12GenerationRoutePolicy.ts \
  lib/lessonSourceManifest.ts \
  lib/teachingStoryboard.ts \
  lib/semanticSlideSpec.ts \
  lib/compiledSlideScene.ts \
  lib/compiledScenePptx.ts \
  lib/deckVisualSystem.ts \
  lib/sceneAssetRequests.ts \
  lib/sceneAssetDecisionPolicy.ts \
  lib/sceneAssetResolver.ts \
  lib/generationCache.ts \
  package.json \
  package-lock.json
```

Expected: no output, exit 0. If `lib/deckVisualSceneBoundary.ts` is changed, verify the diff is only the additive `includeValidationArtifacts` option and return metadata.

- [ ] **Step 5: Verify privacy**

Run:

```bash
git diff --name-only --diff-filter=A 0a80162c5ec91d9f47e15cc503ca5ac03a2a93c4..HEAD | \
  rg -i '\.(docx|pptx|pdf|png|jpe?g)$|rendered|extracted'
```

Expected: no output and `rg` exit 1.

Run:

```bash
rg -n -i 'NotebookLM|teacher name|learner name|school id|private source|The teacher will ask' \
  docs/superpowers/baselines/2026-07-11-gate5-end-to-end-validation-baseline.md \
  tests lib
```

Expected: no private lesson text or school-identifying content. Synthetic negative-test strings are allowed only when clearly fixture-owned and not copied from private uploads.

## Required RED/GREEN Sequence

1. Add `tests/endToEndValidation.test.ts` and `tests/fixtures/endToEndValidationFixtures.ts`.
2. Run `npm test`.
3. Observe RED: `ERR_MODULE_NOT_FOUND for lib/endToEndValidation.ts`.
4. Implement `lib/endToEndValidation.ts` and `lib/sourcePrimarySceneCacheSafety.ts`.
5. Run `npm test`.
6. Add source alignment tests and implementation.
7. Run `npm test`.
8. Add rendered scene tests and implementation.
9. Run `npm test`.
10. Add PPTX round-trip tests and implementation.
11. Run `npm test` and `npm run typecheck`.
12. Add boundary integration tests and App boundary wiring.
13. Run final:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

## Explicit Non-Goals

- No rollout.
- No production deployment.
- No prompt changes.
- No model/provider swap.
- No live image-provider enablement.
- No curated/R2/provider adapter activation.
- No NotebookLM visual clone.
- No private artifact commits.
- No full-slide screenshot or canvas export.
- No teacher beta or canary rollout; that belongs to Gate 6.
- No package dependency changes without a reviewed plan amendment.

## Required Gate 5 Implementation Report

The implementer must return:

1. Worktree path, branch, base commit, and final commit hash.
2. Files changed.
3. `EndToEndValidationReport` contract implemented.
4. Source alignment proof:
   - source-step coverage;
   - objective count/order/ownership/meaning;
   - sequence inversion count;
   - foreign-session content count;
   - unsupported invention count;
   - blank-field invention count;
   - teacher-script violation count.
5. Render validation proof:
   - rendered scene count;
   - 1280 x 720 contract;
   - off-canvas/overflow/unreadable text counts;
   - editable visible text count;
   - full-slide raster count.
6. PPTX round-trip proof:
   - slide count;
   - native text/table/shape/image operation counts;
   - speaker notes count;
   - visible text and notes order/count;
   - full-slide image count;
   - package inspection status if implemented.
7. Cache safety proof:
   - validation failure blocks delivery;
   - validation failure blocks successful cache write;
   - passing validation allows delivery.
8. Sanitized fixtures and what each proves.
9. Exact RED test output before implementation.
10. Exact final test count and command output summary.
11. Typecheck and build outcomes.
12. Changed-file proof against `0a80162c5ec91d9f47e15cc503ca5ac03a2a93c4`.
13. Forbidden-scope proof for prompts, model/provider/image modules, legacy contracts, and package files.
14. Proof no private artifacts, rendered references, extracted private text, teacher names, learner data, or school-identifying content were committed.
15. Deviations, unresolved risks, and assumptions.
16. This exact limitation: `Gate 5 adds hard validation for source-primary compiled scenes before delivery/cache success; it does not yet perform Gate 6 teacher beta rollout, canary deployment, production telemetry dashboards, or NotebookLM-like visual polish.`

## Risks and Open Questions

- PPTX XML package inspection depends on whether `jszip` can be used from the current lockfile without package changes. If not, Gate 5 still validates operation-level PPTX semantics and must request a planner amendment before adding dependencies.
- Operation-level preview validation proves native editability, geometry, reading order, and raster bounds from the compiled scene contract. It does not commit rendered screenshots or private reference images.
- Deterministic unsupported-invention detection should be conservative. It should block high-risk invented assignments, assessments, answers, reflections, and experiments without requiring semantic AI judgment.
- Adding optional Gate 4 validation artifacts is an internal additive extension. It must not change the default Gate 4 return shape or disabled-route behavior.
