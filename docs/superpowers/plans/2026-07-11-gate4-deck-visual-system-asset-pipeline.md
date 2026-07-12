# Gate 4 Deck Visual System Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deck-level visual system and instructional asset pipeline on top of Gate 3 compiled scenes without weakening source authority, editability, or legacy-route reversibility.

**Architecture:** Gate 4 starts after Gate 2 `TeachingStoryboard` validation and Gate 3 `SemanticSlideSpec` validation, then creates one validated `DeckVisualSystem` per selected source unit/session before compiling scenes. Asset requests are provider-independent and privacy-sanitized; resolver output may add bounded native icons/images to `CompiledSlideScene`, but text, labels, tables, arrows, and layout remain deterministic native scene elements.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, existing Gate 0 source-primary route policy, existing Gate 1 `LessonSourceManifest`, existing Gate 2 `TeachingStoryboard`, existing Gate 3 `SemanticSlideSpec` and `CompiledSlideScene`, existing `pptxgenjs`, existing image cache/provider adapters as read-only dependencies, and Node 26 `node:test` with `--experimental-strip-types`.

## Global Constraints

- Gate 4 planning only in this commit. Do not implement production code while writing this plan.
- Uploaded lesson plans remain authoritative.
- Gate 4 consumes `TeachingStoryboard`, `SemanticSlideSpec`, and `CompiledSlideScene`; it must not re-interpret raw source text directly.
- Keep Gate 0, Gate 1, Gate 2, and Gate 3 contracts stable unless this plan explicitly identifies a tiny necessary extension.
- No text prompt changes in `services/geminiService.ts`.
- No model/provider changes.
- No deployment environment changes.
- No production image behavior changes in the planning commit.
- No private DOCX, PPTX, PDF, images, rendered references, extracted lesson text, teacher names, learner data, or school-identifying content.
- No push, deployment, or pull request.
- Source-primary and `VITE_SEMANTIC_SLIDES_V1` must remain intact.
- Disabled `VITE_DECK_VISUAL_SYSTEM_V1`, topic-only, and legacy routes must remain unchanged.
- Scene route must still work without images.
- No full-slide raster images by default.
- No text, labels, letters, numbers, captions, watermarks, or UI chrome inside generated images.
- Optional asset failure must preserve a usable editable slide.
- Cost and concurrency must obey configured ceilings.

---

## Current Gate 3 Insertion Point

Gate 3 currently builds and validates semantic specs inside `resolveSemanticScenePresentationForGeneration(...)`:

```ts
const specsResult = buildSemanticSlideSpecs(storyboard);
if (specsResult.ok === false) {
  return {
    ok: false,
    message: formatSemanticSlideDiagnostics(specsResult.diagnostics),
    diagnostics: specsResult.diagnostics,
  };
}

const sceneResult = compileSemanticSlideSpecsToScenes(specsResult.specs, options);
if (sceneResult.ok === false) {
  return {
    ok: false,
    message: formatSceneValidationDiagnostics(sceneResult.diagnostics),
    diagnostics: sceneResult.diagnostics,
  };
}
```

Gate 4 inserts between those two blocks when `VITE_DECK_VISUAL_SYSTEM_V1` is true-like:

```ts
const visualSceneBoundary = resolveDeckVisualScenePresentationForGeneration(
  routePolicy,
  SEMANTIC_SLIDES_V1_FLAG,
  DECK_VISUAL_SYSTEM_V1_FLAG,
  teachingStoryboardBoundary.storyboard,
  {
    title: sourceManifestBoundary.manifest?.units.map((unit) => unit.sourceLabel).join(' / ') || 'Source-Aligned Lesson',
    selectedUnitLabel: sourceManifestBoundary.manifest?.units[0]?.sourceLabel,
  },
);
```

This boundary must remain after Gate 2 storyboard validation and before:

- legacy cache lookup;
- reusable seed loaders;
- generation quota increment;
- AI text calls;
- legacy image processing;
- scene delivery.

If `VITE_DECK_VISUAL_SYSTEM_V1` is unset or false-like, the exact Gate 3 scene path remains active when `VITE_SEMANTIC_SLIDES_V1` is true-like.

## Tiny Necessary Contract Extensions

Gate 4 needs three small extensions to Gate 3 contracts:

1. `SemanticSlideSpec.assetRequests` changes from `[]` to `SceneAssetRequest[]`.
   - Gate 3 behavior remains equivalent because the Gate 3 builder still emits an empty array when Gate 4 is disabled.
   - Gate 3 tests must continue to prove disabled/legacy routes emit no assets.

2. `compileSemanticSlideSpecsToScenes(...)` accepts an optional visual context:

```ts
type CompileSemanticSlideSpecsOptions = {
  title: string;
  selectedUnitLabel?: string;
  visualSystemsByUnitId?: Record<string, DeckVisualSystem>;
  resolvedAssetsBySpecId?: Record<string, SceneResolvedAsset[]>;
};
```

3. `SceneImageElement` becomes valid only for bounded, non-full-slide instructional assets:

```ts
type SceneImageElement = SceneElementBase & {
  kind: 'image';
  src: string;
  altText: string;
  assetId: string;
  visualRole: SceneAssetVisualRole;
  sourceStepIds: string[];
  storyboardScreenId: string;
  semanticSlideSpecId: string;
  noEmbeddedText: true;
};
```

`validateCompiledSlideScene(...)` must continue to reject full-slide raster use and must reject image elements without source-backed asset provenance.

## Rollout Flag

Add an App-local rollout constant during implementation:

```ts
const DECK_VISUAL_SYSTEM_V1_FLAG = import.meta.env.VITE_DECK_VISUAL_SYSTEM_V1;
```

Create a pure helper in `lib/deckVisualSystem.ts`:

```ts
export const isDeckVisualSystemV1Enabled = (flagValue: unknown): boolean => {
  if (typeof flagValue !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(flagValue.trim().toLowerCase());
};
```

Rules:

- Gate 4 is enabled only when `VITE_SEMANTIC_SLIDES_V1` and `VITE_DECK_VISUAL_SYSTEM_V1` are both true-like.
- Enabled only for `routePolicy.mode === 'source-primary'` and `routePolicy.inputOrigin === 'uploaded-file'`.
- Flag unset, false-like, topic-only, and legacy routes return the current Gate 3 or legacy path unchanged.
- Scene route must still succeed with zero resolved image assets.

## DeckVisualSystem Contract

Create `lib/deckVisualSystem.ts`.

```ts
import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import type { TeachingStoryboard } from './teachingStoryboard.ts';

export const DECK_VISUAL_SYSTEM_VERSION = 'deck-visual-system-v1';

export type VisualSystemDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type VisualSystemDiagnosticCode =
  | 'visual_system_contract_invalid'
  | 'visual_system_missing_unit'
  | 'visual_system_color_conflict'
  | 'visual_system_contrast_failed'
  | 'visual_system_private_text_leak';

export type VisualPalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  mutedInk: string;
  accentCool: string;
  accentWarm: string;
  success: string;
  warning: string;
  danger: string;
};

export type SemanticColorAssignment = {
  conceptId: string;
  color: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  storyboardScreenIds: string[];
  semanticSlideSpecIds: string[];
};

export type TypographyTokens = {
  headingFont: 'Poppins';
  bodyFont: 'Poppins';
  labelFont: 'Poppins';
  titleSize: number;
  bodySize: number;
  labelSize: number;
  minReadableSize: number;
};

export type ShapeLanguageTokens = {
  cornerRadius: number;
  cardStrokeWidth: number;
  connectorStrokeWidth: number;
  iconStrokeWidth: number;
  density: 'compact' | 'balanced' | 'spacious';
};

export type DeckVisualSystem = {
  contractVersion: typeof DECK_VISUAL_SYSTEM_VERSION;
  id: string;
  unitId: string;
  provenance: {
    sourceUnitIds: string[];
    storyboardScreenIds: string[];
    semanticSlideSpecIds: string[];
    sourceStepIds: string[];
    sourceObjectiveIds: string[];
  };
  palette: VisualPalette;
  semanticColors: Record<string, SemanticColorAssignment>;
  typography: TypographyTokens;
  shapeLanguage: ShapeLanguageTokens;
  iconStyle: 'outline-rounded';
  diagramStyle: 'editable-line-diagram';
  illustrationStyle: 'text-free-instructional';
  accessibility: {
    minContrastRatio: 4.5;
    contrastPairs: Array<{ foreground: string; background: string; ratio: number; pass: boolean }>;
  };
  diagnostics: VisualSystemDiagnostic[];
};

export type DeckVisualSystemBundle = {
  contractVersion: typeof DECK_VISUAL_SYSTEM_VERSION;
  systemsByUnitId: Record<string, DeckVisualSystem>;
};

export type VisualSystemDiagnostic = {
  code: VisualSystemDiagnosticCode;
  severity: VisualSystemDiagnosticSeverity;
  message: string;
  unitId?: string;
  conceptId?: string;
};

export type DeckVisualSystemResult =
  | { ok: true; bundle: DeckVisualSystemBundle }
  | { ok: false; diagnostics: VisualSystemDiagnostic[] };
```

Contract rules:

- Build exactly one `DeckVisualSystem` per selected source unit/session represented by the storyboard.
- Use stable IDs: `visual-system-${unitId}`.
- `semanticColors` are keyed by stable concept IDs derived from source IDs, not raw source text.
- Routine telemetry may include counts, contract versions, hash prefixes, diagnostic codes, and style IDs; it must not include raw source text, learner names, teacher names, or school names.
- Do not use NotebookLM product names, branding copy, watermarks, or proprietary visual references.

## Visual-System Builder

The first version is deterministic:

```ts
export const buildDeckVisualSystems = (
  storyboard: TeachingStoryboard,
  specs: readonly SemanticSlideSpec[],
): DeckVisualSystemResult => {
  const unitIds = Array.from(new Set(specs.map((spec) => spec.unitId)));
  const systemsByUnitId = Object.fromEntries(unitIds.map((unitId) => {
    const unitSpecs = specs.filter((spec) => spec.unitId === unitId);
    return [unitId, buildDeckVisualSystemForUnit(storyboard, unitSpecs, unitId)];
  }));
  const diagnostics = Object.values(systemsByUnitId).flatMap((system) => validateDeckVisualSystem(system));
  return diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
    ? { ok: false, diagnostics }
    : { ok: true, bundle: { contractVersion: DECK_VISUAL_SYSTEM_VERSION, systemsByUnitId } };
};
```

Builder rules:

- Subject/topic/grade awareness comes from sanitized storyboard/spec metadata and stable IDs only.
- Concept extraction uses:
  - `objective:${sourceObjectiveId}` for objective-backed concepts;
  - `step:${sourceStepId}` for source-step-backed concepts;
  - `screen:${storyboardScreenId}` only when no source step/objective exists.
- Repeated concept IDs receive the same color within a unit/session.
- Color assignment is stable by hashing the concept ID into the palette slots.
- Contrast validation must prove text/background and label/card pairs meet at least 4.5:1.
- A source-safe concept label may be generated for internal use only after redaction and length limits; the label must not be logged in routine telemetry.

## SceneAssetRequest Contract

Create `lib/sceneAssetRequests.ts`.

```ts
import type { DeckVisualSystem } from './deckVisualSystem.ts';

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
```

Request rules:

- `id` format: `assetreq-${semanticSlideSpecId}-${ordinal}`.
- Every request must carry source-step IDs when a source step exists.
- `storyboardScreenId`, `semanticSlideSpecId`, and `unitId` must match the owning spec.
- Briefs must be provider-independent. They are not Gemini, XAI, Replicate, or Pexels prompts.
- `mustNotContainText` is always true for image briefs.
- `sanitizedSummary` is a short learner-safe summary derived from storyboard/spec visible content after redaction, not raw source text.

## Asset Decision Policy

Create `lib/sceneAssetDecisionPolicy.ts`.

Decision rules:

- Use native shapes/tables/connectors/icons when:
  - the visual needs text, labels, numbers, formulas, captions, or tables;
  - the relationship is a process, comparison, evidence board, flow, or sort;
  - the scene can be explained by existing native layout elements.
- An image is `required` only when the source-backed task requires observing a concrete specimen, material, apparatus, historical place/object, or photo-like evidence and no native substitute preserves the instructional purpose.
- An image is `useful` when it improves concept grounding but the slide remains instructionally complete without it.
- An image is `optional` for enrichment that can be safely omitted.
- An asset is `forbidden` when it is decorative, random, generic classroom filler, privacy-risky, text-dependent, not source-backed, or likely to misrepresent the concept.
- Generated images must never contain text. Any visual requiring labels uses native scene text layered outside the image.
- Optional and useful asset failures return `no-image-fallback` and preserve the editable scene.
- Required asset failures return `required_asset_unavailable` only when no native or curated fallback can preserve the source-backed instructional purpose.

## Resolver Order

Create `lib/sceneAssetResolver.ts`.

Resolution order:

1. Deterministic native scene element.
2. Bundled/curated SVG or icon if available.
3. Approved cached educational visual.
4. Teacher-uploaded override if available.
5. Licensed external photo only when appropriate.
6. Generated text-free image only within cost/concurrency ceilings.
7. Editable no-image fallback.

Result shape:

```ts
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
```

Resolver invariants:

- No asset resolution before source/storyboard/spec/visual-system validation succeeds.
- No generated-image request when paid asset ceiling is reached.
- No unbounded parallel generation.
- No raw source text, teacher names, learner data, or school names in request briefs, cache keys, or telemetry.
- `omitted` is valid for optional/useful assets and must keep the scene usable.

## Cost and Concurrency Controls

Reuse existing guards where possible:

- `adminImageLimitBypassed`
- `canGenerateImage`
- `incrementCount('images')`
- existing queued paid image generation helper in `App.tsx`
- existing `PAID_IMAGE_ATTEMPTS_PER_DECK_LIMIT`
- existing `IMAGE_PROCESSING_CONCURRENCY`

Gate 4 implementation adds a pure budget helper in `lib/sceneAssetResolver.ts`:

```ts
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
```

Budget rules:

- Paid generated assets per selected unit/session are capped by the smaller of `DEFAULT_SCENE_ASSET_BUDGET.maxPaidGeneratedAssetsPerDeck` and existing app-level limits.
- Asset resolution may process cached/native assets freely but generated image calls are queued.
- Validation failures must consume no generation or image quota.
- Optional asset failures must not consume generation quota and must consume image quota only if a paid uncached provider call actually succeeded.

## Gate 4 Integration Boundary

Create `resolveDeckVisualScenePresentationForGeneration(...)` in `lib/deckVisualSystem.ts` or a focused `lib/deckVisualSceneBoundary.ts`:

```ts
export type DeckVisualSceneBoundary =
  | { ok: true; presentation: CompiledScenePresentation | null; visualSystems?: DeckVisualSystemBundle }
  | { ok: false; message: string; diagnostics: Array<VisualSystemDiagnostic | SceneAssetDiagnostic | SemanticSlideDiagnostic | SceneValidationDiagnostic> };
```

Integration rules:

- If `VITE_SEMANTIC_SLIDES_V1` is false-like, return `{ ok: true, presentation: null }` so legacy remains unchanged.
- If `VITE_DECK_VISUAL_SYSTEM_V1` is false-like, delegate to the exact Gate 3 `resolveSemanticScenePresentationForGeneration(...)` behavior.
- If both flags are enabled, run:
  1. `buildSemanticSlideSpecs(storyboard)`;
  2. `validateSemanticSlideSpecs(specs, storyboard)`;
  3. `buildDeckVisualSystems(storyboard, specs)`;
  4. `buildSceneAssetRequests(storyboard, specs, visualSystems)`;
  5. `validateSceneAssetRequests(requests, storyboard, specs, visualSystems)`;
  6. `resolveSceneAssets(requests, budget, adapters)`;
  7. `compileSemanticSlideSpecsToScenes(specs, { ...options, visualSystemsByUnitId, resolvedAssetsBySpecId })`;
  8. `validateCompiledSlideScene(scene)` for every scene.
- Do not pass the visual system or assets into existing text prompts.
- Do not call legacy `processSlidesForImages(...)` for compiled scene decks.
- App state continues to use `compiledScenePresentation` and `generatedPlanUnitSceneSlidesByDay` from Gate 3.

## Expected Implementation File Set

Expected files to change during Gate 4 implementation:

- Modify: `App.tsx`
- Modify: `components/CompiledSlideSceneView.tsx`
- Modify: `lib/semanticSlideSpec.ts`
- Modify: `lib/compiledSlideScene.ts`
- Modify: `lib/compiledScenePptx.ts`
- Create: `lib/deckVisualSystem.ts`
- Create: `lib/deckVisualSceneBoundary.ts`
- Create: `lib/sceneAssetRequests.ts`
- Create: `lib/sceneAssetDecisionPolicy.ts`
- Create: `lib/sceneAssetResolver.ts`
- Create: `tests/fixtures/deckVisualSystemFixtures.ts`
- Create: `tests/deckVisualSystem.test.ts`
- Create: `tests/sceneAssetRequests.test.ts`
- Create: `tests/sceneAssetDecisionPolicy.test.ts`
- Create: `tests/sceneAssetResolver.test.ts`
- Modify: `tests/semanticSlideSpec.test.ts`
- Modify: `tests/compiledSlideScene.test.ts`
- Modify: `tests/compiledScenePptx.test.ts`
- Create: `docs/superpowers/baselines/2026-07-11-gate4-deck-visual-system-asset-pipeline-baseline.md`

Existing image modules during Gate 4 planning:

- Read-only.

Existing image modules during Gate 4 implementation:

- Read/import allowed:
  - `lib/imageSemantic.ts`
  - `lib/imagePrompting.ts`
  - existing exported image generation/cache helpers from `services/geminiService.ts`
- Modify only if a follow-up planner review explicitly approves a narrower change.
- Do not modify provider selection, prompt text, model names, deployment env, or legacy image behavior in Gate 4.

Forbidden files unless a later reviewed amendment changes scope:

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
- `lib/generationCache.ts`
- `package.json`
- `package-lock.json`

## Required Tests for Implementation

Gate 4 implementation must add dependency-free `node:test` coverage for:

- visual-system determinism;
- exactly one validated visual system per selected source unit/session;
- stable semantic color consistency across repeated concepts;
- visual-system contrast/accessibility validation;
- asset request privacy sanitization;
- no text-in-image briefs;
- decorative/random asset rejection;
- native-shape/table/icon preference over image when labels are required;
- optional asset failure returns editable fallback;
- required asset failure blocks only when no safe editable fallback exists;
- cost ceilings for paid generated assets;
- concurrency ceiling for generated image resolution;
- no asset generation before source/storyboard/spec/visual-system validation;
- preview/PPTX scene contract remains native/editable;
- no full-slide raster image by default;
- disabled flag, topic-only, and legacy routes remain unchanged;
- no prompt/model/provider changes unless explicitly planned for a later gate.

## Task 1: Add Visual-System Fixtures and RED Tests

**Files:**
- Create: `tests/fixtures/deckVisualSystemFixtures.ts`
- Create: `tests/deckVisualSystem.test.ts`
- Create later: `lib/deckVisualSystem.ts`

**Interfaces:**
- Consumes: `TeachingStoryboard` fixtures from `tests/fixtures/semanticSlideFixtures.ts`.
- Consumes: `buildSemanticSlideSpecs(storyboard)` from `lib/semanticSlideSpec.ts`.
- Produces failing tests for `buildDeckVisualSystems`, `validateDeckVisualSystem`, and `isDeckVisualSystemV1Enabled`.

- [ ] **Step 1: Create sanitized fixture helper**

```ts
import { buildSemanticSlideSpecs } from '../../lib/semanticSlideSpec.ts';
import {
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
  MULTI_OBJECTIVE_STORYBOARD,
} from './semanticSlideFixtures.ts';

const specsFor = (storyboard: typeof EVIDENCE_OUTPUT_STORYBOARD) => {
  const result = buildSemanticSlideSpecs(storyboard);
  if (!result.ok) throw new Error('semantic specs fixture failed');
  return result.specs;
};

export const FIVE_SESSION_VISUAL_FIXTURE = {
  storyboard: FIVE_SESSION_STORYBOARD,
  specs: specsFor(FIVE_SESSION_STORYBOARD),
};

export const MULTI_OBJECTIVE_VISUAL_FIXTURE = {
  storyboard: MULTI_OBJECTIVE_STORYBOARD,
  specs: specsFor(MULTI_OBJECTIVE_STORYBOARD),
};

export const EVIDENCE_OUTPUT_VISUAL_FIXTURE = {
  storyboard: EVIDENCE_OUTPUT_STORYBOARD,
  specs: specsFor(EVIDENCE_OUTPUT_STORYBOARD),
};
```

- [ ] **Step 2: Write RED visual-system tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDeckVisualSystems,
  isDeckVisualSystemV1Enabled,
  validateDeckVisualSystem,
} from '../lib/deckVisualSystem.ts';
import {
  EVIDENCE_OUTPUT_VISUAL_FIXTURE,
  FIVE_SESSION_VISUAL_FIXTURE,
  MULTI_OBJECTIVE_VISUAL_FIXTURE,
} from './fixtures/deckVisualSystemFixtures.ts';

test('accepts only documented true-like Gate 4 flag values', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(isDeckVisualSystemV1Enabled(value), true);
  }
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) {
    assert.equal(isDeckVisualSystemV1Enabled(value), false);
  }
});

test('builds one validated visual system per selected source unit', () => {
  const result = buildDeckVisualSystems(
    FIVE_SESSION_VISUAL_FIXTURE.storyboard,
    FIVE_SESSION_VISUAL_FIXTURE.specs,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.bundle.systemsByUnitId), ['unit-001', 'unit-002', 'unit-003', 'unit-004', 'unit-005']);
  for (const system of Object.values(result.bundle.systemsByUnitId)) {
    assert.deepEqual(validateDeckVisualSystem(system), []);
  }
});

test('is deterministic for the same storyboard and specs', () => {
  const first = buildDeckVisualSystems(EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard, EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs);
  const second = buildDeckVisualSystems(EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard, EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs);

  assert.deepEqual(first, second);
});

test('assigns the same semantic color to repeated concepts', () => {
  const result = buildDeckVisualSystems(
    MULTI_OBJECTIVE_VISUAL_FIXTURE.storyboard,
    MULTI_OBJECTIVE_VISUAL_FIXTURE.specs,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const system = result.bundle.systemsByUnitId['unit-001'];
  const concept = system.semanticColors['objective:obj-001'];
  assert.ok(concept);
  assert.equal(system.semanticColors['objective:obj-001'].color, concept.color);
});

test('rejects visual systems with insufficient contrast', () => {
  const result = buildDeckVisualSystems(EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard, EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const system = Object.values(result.bundle.systemsByUnitId)[0];
  const invalid = {
    ...system,
    palette: { ...system.palette, ink: 'FFFFFF', background: 'FFFFFF' },
  };

  const diagnostics = validateDeckVisualSystem(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'visual_system_contrast_failed'), true);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test
```

Expected:

```text
ERR_MODULE_NOT_FOUND for lib/deckVisualSystem.ts
```

## Task 2: Implement DeckVisualSystem Builder and Validator

**Files:**
- Create: `lib/deckVisualSystem.ts`
- Test: `tests/deckVisualSystem.test.ts`

**Interfaces:**
- Consumes: `TeachingStoryboard`.
- Consumes: `SemanticSlideSpec[]`.
- Produces: `buildDeckVisualSystems(storyboard, specs): DeckVisualSystemResult`.
- Produces: `validateDeckVisualSystem(system): VisualSystemDiagnostic[]`.

- [ ] **Step 1: Add contract and flag helper**

Implement the `DeckVisualSystem` contract exactly from this plan.

- [ ] **Step 2: Add deterministic palette and contrast helpers**

Use fixed palette tokens and WCAG contrast math. Do not import a new dependency.

```ts
const DEFAULT_PALETTE: VisualPalette = {
  background: 'FFFFFF',
  surface: 'F8FAFC',
  surfaceMuted: 'E2E8F0',
  ink: '111827',
  mutedInk: '475569',
  accentCool: '0F766E',
  accentWarm: 'C2410C',
  success: '15803D',
  warning: 'A16207',
  danger: 'B91C1C',
};
```

- [ ] **Step 3: Implement concept extraction**

Create concept IDs from source IDs only:

```ts
const conceptIdsForSpec = (spec: SemanticSlideSpec): string[] => [
  ...spec.sourceObjectiveIds.map((id) => `objective:${id}`),
  ...spec.sourceStepIds.map((id) => `step:${id}`),
  ...(spec.sourceObjectiveIds.length === 0 && spec.sourceStepIds.length === 0 ? [`screen:${spec.storyboardScreenId}`] : []),
];
```

- [ ] **Step 4: Implement builder**

Group specs by `unitId`, assign semantic colors by stable concept ID hash, and populate provenance arrays from the specs.

- [ ] **Step 5: Implement validator**

Validator blocks when:

- a system has no `unitId`;
- provenance arrays are empty;
- two different concept IDs claim the same provenance with conflicting color assignment;
- contrast pairs fail 4.5:1;
- any stored concept ID or telemetry-facing field contains private-source red flags such as `teacher`, `school`, `learner`, `student name`, or a long raw sentence.

- [ ] **Step 6: Verify**

Run:

```bash
npm test
```

Expected: visual-system tests pass; asset request tests are still absent.

## Task 3: Add SceneAssetRequest Policy and Validator

**Files:**
- Create: `lib/sceneAssetRequests.ts`
- Create: `lib/sceneAssetDecisionPolicy.ts`
- Create: `tests/sceneAssetRequests.test.ts`
- Create: `tests/sceneAssetDecisionPolicy.test.ts`
- Modify later: `lib/semanticSlideSpec.ts`

**Interfaces:**
- Consumes: `DeckVisualSystemBundle`.
- Consumes: `SemanticSlideSpec[]`.
- Consumes: `TeachingStoryboard`.
- Produces: `buildSceneAssetRequests(storyboard, specs, visualSystems): SceneAssetRequestResult`.
- Produces: `validateSceneAssetRequests(requests, storyboard, specs, visualSystems): SceneAssetDiagnostic[]`.

- [ ] **Step 1: Write RED request privacy tests**

Tests must assert:

- no request contains raw source text;
- no request brief asks for text inside an image;
- request IDs and ownership IDs match spec/screen/source ownership;
- decorative-only visuals are rejected.

- [ ] **Step 2: Implement request contract**

Implement `SceneAssetRequest`, `ProviderIndependentAssetBrief`, diagnostic types, and validator from this plan.

- [ ] **Step 3: Implement decision policy**

Policy must prefer native shapes/tables/icons over image requests when labels or structured relationships are required.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
```

Expected: asset request and decision policy tests pass.

## Task 4: Add Resolver and Cost/Concurrency Tests

**Files:**
- Create: `lib/sceneAssetResolver.ts`
- Create: `tests/sceneAssetResolver.test.ts`

**Interfaces:**
- Consumes: `SceneAssetRequest[]`.
- Produces: `resolveSceneAssets(requests, budget, adapters): Promise<SceneAssetResolverResult>`.
- Produces: `SceneResolvedAsset[]`.

- [ ] **Step 1: Write RED resolver tests**

Tests must cover:

- deterministic native element resolution first;
- curated/cache hit before generated image;
- optional failure returns `kind: 'omitted'`;
- required failure blocks only when no editable fallback exists;
- paid generated assets stop at ceiling;
- concurrent generated calls never exceed configured ceiling;
- invalid requests block before any adapter call.

- [ ] **Step 2: Implement resolver with injected adapters**

Use injected adapters in tests:

```ts
type SceneAssetAdapters = {
  resolveBundledIcon: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  resolveCuratedVisual: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  resolveTeacherUpload: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  resolveLicensedPhoto: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
  generateTextFreeImage: (request: SceneAssetRequest) => Promise<SceneResolvedAsset | null>;
};
```

The production adapter implementation can call existing image helpers, but those helpers remain unmodified unless a later reviewed amendment permits it.

- [ ] **Step 3: Verify**

Run:

```bash
npm test
```

Expected: resolver tests pass and no paid calls happen in tests.

## Task 5: Compile Visual Systems and Assets Into Scenes

**Files:**
- Modify: `lib/semanticSlideSpec.ts`
- Modify: `lib/compiledSlideScene.ts`
- Modify: `lib/compiledScenePptx.ts`
- Modify: `components/CompiledSlideSceneView.tsx`
- Modify: `tests/semanticSlideSpec.test.ts`
- Modify: `tests/compiledSlideScene.test.ts`
- Modify: `tests/compiledScenePptx.test.ts`

**Interfaces:**
- Consumes: `DeckVisualSystemBundle`.
- Consumes: `SceneResolvedAsset[]`.
- Produces: `CompiledSlideScene` values with visual-system tokens and bounded image/icon elements when available.

- [ ] **Step 1: Write RED scene asset tests**

Tests must prove:

- text/table/shape/connector elements remain editable native scene elements;
- bounded image assets are represented as image objects, not full-slide raster backgrounds;
- image elements carry `noEmbeddedText: true`, `assetId`, source IDs, storyboard screen ID, and semantic spec ID;
- missing optional image assets still compile a valid scene;
- full-slide image frames are rejected by `scene_full_slide_raster_forbidden`.

- [ ] **Step 2: Extend SemanticSlideSpec asset request type**

Change only `assetRequests: []` to `assetRequests: SceneAssetRequest[]`. Gate 3 builder still emits `[]` unless Gate 4 request builder is used.

- [ ] **Step 3: Extend compiled scene compiler options**

Add `visualSystemsByUnitId` and `resolvedAssetsBySpecId` options and use visual-system palette/shape tokens for deterministic native element colors.

- [ ] **Step 4: Extend PPTX operations**

Add bounded `addImage` operations only for scene image elements:

```ts
| { kind: 'addImage'; elementId: string; data: string; options: Record<string, unknown> }
```

Tests must assert no `addImage` operation covers the full 10 x 5.625 inch slide.

- [ ] **Step 5: Extend preview component**

Render image/icon elements from `scene.elements` only. Do not fetch or generate assets from the component.

- [ ] **Step 6: Verify**

Run:

```bash
npm test
npm run typecheck
```

Expected: tests and typecheck pass.

## Task 6: Wire Gate 4 App Boundary Behind Flag

**Files:**
- Modify: `App.tsx`
- Create: `lib/deckVisualSceneBoundary.ts`
- Test: existing node tests plus new boundary tests if pure boundary is exported.

**Interfaces:**
- Consumes: `resolveK12GenerationRoutePolicy`.
- Consumes: `resolveTeachingStoryboardForGeneration`.
- Consumes: `resolveDeckVisualScenePresentationForGeneration`.

- [ ] **Step 1: Add pure boundary tests**

Tests must prove:

- flag disabled delegates to Gate 3 scene route;
- topic-only returns `presentation: null`;
- source-primary with both flags true builds visual systems before scenes;
- validation failures block before asset adapter calls;
- validation failures consume no quota.

- [ ] **Step 2: Add App flag**

Add:

```ts
const DECK_VISUAL_SYSTEM_V1_FLAG = import.meta.env.VITE_DECK_VISUAL_SYSTEM_V1;
```

- [ ] **Step 3: Replace semantic boundary call only in source-primary scene branches**

The call site remains after Gate 2 storyboard validation and before legacy cache lookup, seeds, quota, AI calls, image processing, or delivery.

- [ ] **Step 4: Keep daily scene behavior**

Retain `generatedPlanUnitSceneSlidesByDay`, `handleViewGeneratedPlanUnit`, active slide count, speaker notes, keyboard navigation, and scene PPTX export behavior from Gate 3.

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all commands exit 0.

## Task 7: Add Baseline and Final Verification

**Files:**
- Create: `docs/superpowers/baselines/2026-07-11-gate4-deck-visual-system-asset-pipeline-baseline.md`

- [ ] **Step 1: Add sanitized baseline**

The baseline must include only fixture names, contract versions, counts, and expected diagnostics. It must not include private source text or rendered images.

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
git diff --name-only b45a82e639f7023cd1aad5b40dc904de44f43ee0..HEAD
```

Expected implementation set is the Gate 4 implementation files listed above.

- [ ] **Step 4: Verify forbidden scopes**

Run:

```bash
git diff --exit-code b45a82e639f7023cd1aad5b40dc904de44f43ee0..HEAD -- \
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
  lib/generationCache.ts \
  package.json \
  package-lock.json
```

Expected: no output, exit 0.

- [ ] **Step 5: Verify privacy**

Run:

```bash
git diff --name-only --diff-filter=A b45a82e639f7023cd1aad5b40dc904de44f43ee0..HEAD | \
  rg -i '\.(docx|pptx|pdf|png|jpe?g)$|rendered|extracted'
```

Expected: no output and `rg` exit 1.

Run:

```bash
rg -n "$KNOWN_PRIVATE_ARTIFACT_SCAN_PATTERN" \
  App.tsx components lib tests docs/superpowers/baselines/2026-07-11-gate4-deck-visual-system-asset-pipeline-baseline.md
```

Expected: no output and `rg` exit 1.

## Explicit Non-Goals

- No NotebookLM visual clone.
- No NotebookLM branding, watermark, or proprietary implementation copying.
- No full-slide image generation.
- No text inside generated images.
- No model/provider swap.
- No AI text prompt changes.
- No production image provider behavior changes unless a later reviewed amendment explicitly scopes it.
- No private artifact commits.
- No private extracted lesson text in fixtures, telemetry, prompts, or docs.
- No rendered screenshot validation yet; reserve screenshot and PPTX visual artifact validation for Gate 5 unless planner review explicitly moves a small subset into Gate 4.
- No push, deployment, or pull request.

## Required Gate 4 Implementation Report

The implementer must return:

1. Worktree path, branch, base commit, and final commit hashes.
2. Files changed.
3. `DeckVisualSystem` contract implemented.
4. Visual-system builder and validator behavior.
5. `SceneAssetRequest` contract implemented.
6. Asset decision policy proof.
7. Resolver order proof.
8. Cost and concurrency proof.
9. Visual-system per selected source unit/session proof.
10. Semantic color consistency proof.
11. Contrast/accessibility proof.
12. No text-in-image proof.
13. Optional asset failure editable fallback proof.
14. Preview/PPTX native scene contract proof.
15. Exact test count and command output summary.
16. Typecheck and build outcomes.
17. Changed-file proof against `b45a82e639f7023cd1aad5b40dc904de44f43ee0`.
18. Forbidden-scope proof, including prompt/model/provider/image-module checks.
19. Proof no private artifacts, extracted private text, teacher names, learner data, or school-identifying content were committed.
20. Deviations, unresolved risks, and assumptions.
21. This exact limitation: `Gate 4 introduces a validated deck visual system and source-backed asset pipeline; it does not yet perform Gate 5 rendered screenshot validation, PPTX round-trip artifact validation, NotebookLM-like polish, or model-assisted visual design.`

## Risks and Open Questions

- Deterministic visual-system tokens will improve coherence but will not yet create highly polished visual design.
- Existing curated image assets may include text in some legacy files; Gate 4 resolver must inspect metadata and reject any asset that violates `noEmbeddedText` rather than assuming curated means safe.
- Bounded generated images can still fail provider-side or include unwanted text; Gate 4 must preserve editable fallbacks and treat text-in-image detection as a required later hard-validation topic if not fully solved deterministically.
- Allowing bounded image elements in `CompiledSlideScene` requires careful PPTX export checks so no image becomes a full-slide raster.
- Cost/concurrency tests should use injected fake adapters only; no paid AI calls are required for Gate 4 implementation verification.
