# Gate 3 Semantic Slide Schema and Native Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a source-bound `SemanticSlideSpec` layer, bounded semantic layout compiler, and editable `CompiledSlideScene` contract shared by web preview and PPTX export.

**Architecture:** Gate 3 starts immediately after Gate 2 `TeachingStoryboard` validation succeeds and before legacy K-12 slide generation. It is deterministic in this gate: it translates validated storyboard screens into semantic slide specs, compiles them into bounded native scenes, validates editability and overflow, and routes source-primary generation to the scene path only when the new rollout flag is true-like. Legacy `Slide` rendering/export remains the default and remains available when the Gate 3 flag is unset or false.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, existing Gate 0 source-primary route policy, existing Gate 1 `LessonSourceManifest`, existing Gate 2 `TeachingStoryboard`, dependency-free pure TypeScript modules, existing `pptxgenjs` export dependency, and Node 26 `node:test` with `--experimental-strip-types`.

## Global Constraints

- Gate 3 only: semantic slide specs, bounded semantic layouts, compiled native scenes, preview/PPTX scene parity.
- Do not expand or refactor Gate 0, Gate 1, or Gate 2.
- Uploaded lesson plans remain authoritative.
- Lesson-plan formats remain source-defined; do not encode 5E, 4A, MATATAG, DLL, or DLP as universal schemas.
- The storyboard remains the audience-translation boundary; Gate 3 must not re-interpret raw source text directly when storyboard content exists.
- No image asset pipeline work. `assetRequests` may be part of the contract but Gate 3 emits no image requests and no image scene elements.
- No visual-system generation beyond deterministic minimal tokens needed for layout tests.
- No model/provider swaps.
- No AI prompt changes and no response-schema changes in `services/geminiService.ts`.
- No full-slide raster output.
- No private DOCX, PPTX, PDF, rendered reference images, or extracted private lesson text.
- No deployment, push, or pull request.
- `package.json` and `package-lock.json` remain unchanged.
- Invalid source-primary semantic specs or scenes fail closed before legacy slide generation, quota increment, cache write, or delivery.
- Topic-only and disabled-flag behavior remain legacy.

---

## Current Gate 2 Insertion Point

Gate 2 currently validates a storyboard in `App.tsx` before K-12 cache lookup, reusable seeds, quota increment, or AI calls:

```ts
const teachingStoryboardResult = sourceManifestBoundary.manifest
  ? buildTeachingStoryboard(sourceManifestBoundary.manifest)
  : null;
const teachingStoryboardBoundary = resolveTeachingStoryboardForGeneration(
  routePolicy,
  sourceManifestBoundary.manifest,
  teachingStoryboardResult,
);
if (teachingStoryboardBoundary.ok === false) {
  setError(teachingStoryboardBoundary.message);
  setIsLoading(false);
  return;
}
```

Gate 3 inserts a semantic-scene boundary immediately after this block:

```ts
const semanticSceneBoundary = resolveSemanticScenePresentationForGeneration(
  routePolicy,
  SEMANTIC_SLIDES_V1_FLAG,
  teachingStoryboardBoundary.storyboard,
  {
    title: sourceManifestBoundary.manifest?.units.map((unit) => unit.sourceLabel).join(' / ') || 'Source-Aligned Lesson',
    selectedUnitLabel: sourceManifestBoundary.manifest?.units[0]?.sourceLabel,
  },
);
if (semanticSceneBoundary.ok === false) {
  setError(semanticSceneBoundary.message);
  setIsLoading(false);
  return;
}
if (semanticSceneBoundary.presentation) {
  setCompiledScenePresentation(semanticSceneBoundary.presentation);
  setPresentation(null);
  setCurrentSlide(0);
  setAppStep('presenting');
  shouldRollbackGeneration = false;
  return;
}
```

This branch must run before:

- `buildGenerationCacheKey(...)` for legacy slide generation;
- `loadReusableSeedWhenAllowed(...)`;
- `getCachedGeneration(...)` for legacy `Slide` payloads;
- `tryIncrementCount('generations')`;
- `generateK12SingleLessonSlides(...)`;
- `generateK12SlidesForDay(...)`;
- `processSlidesForImages(...)`.

Gate 3 does not pass semantic specs or scenes into the existing prompts.

## Expected Implementation File Set

Expected files to change during Gate 3 implementation:

- Modify: `App.tsx`
- Create: `components/CompiledSlideSceneView.tsx`
- Create: `lib/semanticSlideSpec.ts`
- Create: `lib/compiledSlideScene.ts`
- Create: `lib/compiledScenePptx.ts`
- Create: `tests/fixtures/semanticSlideFixtures.ts`
- Create: `tests/semanticSlideSpec.test.ts`
- Create: `tests/compiledSlideScene.test.ts`
- Create: `tests/compiledScenePptx.test.ts`
- Create: `docs/superpowers/baselines/2026-07-11-gate3-semantic-slide-scene-baseline.md`

Files that must not change in Gate 3:

- `services/geminiService.ts`
- `lib/imagePrompting.ts`
- `lib/imageSemantic.ts`
- `lib/serverImageGeneration.ts`
- image APIs, scripts, and `public/curated-images/`
- `lib/k12GenerationRoutePolicy.ts`
- `lib/lessonSourceManifest.ts`
- `lib/teachingStoryboard.ts`
- `components/Slide.tsx`
- `types.ts`
- `package.json`
- `package-lock.json`

`App.tsx` may change only to add the Gate 3 flag, scene state, source-primary semantic-scene branch, scene preview selection, and scene PPTX export branch.

## Rollout Flag

Add an App-local rollout constant:

```ts
const SEMANTIC_SLIDES_V1_FLAG = import.meta.env.VITE_SEMANTIC_SLIDES_V1;
```

Create a pure helper in `lib/semanticSlideSpec.ts`:

```ts
export const isSemanticSlidesV1Enabled = (flagValue: unknown): boolean => {
  if (typeof flagValue !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(flagValue.trim().toLowerCase());
};
```

Rules:

- Enabled only when `isSemanticSlidesV1Enabled(flag)` is true.
- Enabled only for `routePolicy.mode === 'source-primary'` and `routePolicy.inputOrigin === 'uploaded-file'`.
- Flag unset, false-like, topic-only, and legacy routes return `{ ok: true, presentation: null }`.
- Legacy `Slide` rendering and export are untouched when this boundary returns `presentation: null`.

## SemanticSlideSpec Contract

Create `lib/semanticSlideSpec.ts`.

```ts
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';
import type {
  StoryboardCommunicationIntent,
  StoryboardScreen,
  TeachingStoryboard,
} from './teachingStoryboard.ts';
import type {
  CompiledScenePresentation,
  CompiledSlideScene,
  SceneValidationDiagnostic,
} from './compiledSlideScene.ts';

export const SEMANTIC_SLIDE_SPEC_VERSION = 'semantic-slide-spec-v1';

export type SemanticSlideDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type SemanticSlideDiagnosticCode =
  | 'semantic_spec_contract_invalid'
  | 'semantic_spec_storyboard_mapping_invalid'
  | 'semantic_spec_source_step_mismatch'
  | 'semantic_spec_objective_mismatch'
  | 'semantic_spec_layout_unsupported'
  | 'semantic_spec_generic_layout_coverage_low'
  | 'semantic_spec_asset_request_forbidden';

export type SemanticSlideIntent =
  | 'title-context'
  | 'learning-targets'
  | 'prior-knowledge'
  | 'discussion-prompt'
  | 'activity-board'
  | 'evidence-capture'
  | 'guided-example'
  | 'comparison-matrix'
  | 'process-flow'
  | 'question'
  | 'answer-reveal'
  | 'exit-ticket'
  | 'wrap-up';

export type SemanticLayoutId =
  | 'title-context'
  | 'learning-targets-stack'
  | 'prompt-card'
  | 'activity-board'
  | 'evidence-capture-board'
  | 'guided-example-steps'
  | 'comparison-matrix'
  | 'process-flow-horizontal'
  | 'question-reveal-pair'
  | 'exit-ticket-card'
  | 'generic-bullets';

export type SlideSlotValue =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'cards'; cards: Array<{ id: string; title: string; body: string }> }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'steps'; steps: Array<{ id: string; label: string; body: string }> };

export type SemanticSlideSpec = {
  contractVersion: typeof SEMANTIC_SLIDE_SPEC_VERSION;
  id: string;
  unitId: string;
  storyboardScreenId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  intent: SemanticSlideIntent;
  layoutId: SemanticLayoutId;
  slots: Record<string, SlideSlotValue>;
  assetRequests: [];
  speakerNotes: string;
  accessibility: {
    readingOrder: string[];
    slidePurpose: string;
  };
};

export type SemanticSlideDiagnostic = {
  code: SemanticSlideDiagnosticCode;
  severity: SemanticSlideDiagnosticSeverity;
  message: string;
  specId?: string;
  storyboardScreenId?: string;
};

export type SemanticSlideSpecResult =
  | { ok: true; specs: SemanticSlideSpec[] }
  | { ok: false; diagnostics: SemanticSlideDiagnostic[] };

export type SemanticScenePresentationBoundary =
  | { ok: true; presentation: CompiledScenePresentation | null }
  | { ok: false; message: string; diagnostics: Array<SemanticSlideDiagnostic | SceneValidationDiagnostic> };
```

Do not add image URLs, model prompts, provider names, renderer screenshots, or PPTX-specific fields to `SemanticSlideSpec`.

## Bounded Layout Intent Library

Create layout definitions in `lib/compiledSlideScene.ts` and import their IDs into `semanticSlideSpec.ts`.

Initial layout library:

```ts
export type SemanticLayoutDefinition = {
  id: SemanticLayoutId;
  semantic: boolean;
  allowedIntents: SemanticSlideIntent[];
  requiredSlots: string[];
  optionalSlots: string[];
  maxTextChars: number;
  maxListItems: number;
};
```

Definitions:

- `title-context`: title and compact context only; excluded from semantic coverage denominator.
- `learning-targets-stack`: objective list as native target cards.
- `prompt-card`: one large prompt plus optional learner directions.
- `activity-board`: task plus direction/checklist cards.
- `evidence-capture-board`: required evidence and output zones.
- `guided-example-steps`: ordered worked-example or procedure steps.
- `comparison-matrix`: native table for compare/contrast content.
- `process-flow-horizontal`: native step flow with connectors.
- `question-reveal-pair`: source-backed prompt/reveal pair using editable cards.
- `exit-ticket-card`: prompt plus expected output criteria.
- `generic-bullets`: fallback only; counted as non-semantic.

Layout selection rules:

- Use `StoryboardScreen.communicationIntent` as the primary signal.
- Use required evidence/output arrays to prefer `evidence-capture-board` or `exit-ticket-card`.
- Use multiple objective IDs to prefer `learning-targets-stack`.
- Use `questions` to prefer `prompt-card` or `question-reveal-pair`.
- Use `directions` plus `task` to prefer `activity-board`.
- Use `generic-bullets` only when no bounded semantic layout accepts the slot shape and density.
- If a storyboard screen is too dense for every layout, split into adjacent continuation specs with the same source IDs and monotonic spec IDs. Do not truncate.

## CompiledSlideScene Contract

Create `lib/compiledSlideScene.ts`.

```ts
export const COMPILED_SLIDE_SCENE_VERSION = 'compiled-slide-scene-v1';

export type SceneElementKind =
  | 'text'
  | 'shape'
  | 'table'
  | 'connector'
  | 'group';

export type SceneFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SceneTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
};

export type SceneElementBase = {
  id: string;
  kind: SceneElementKind;
  frame: SceneFrame;
  editable: boolean;
  readingOrder: number;
};

export type SceneTextElement = SceneElementBase & {
  kind: 'text';
  role: 'title' | 'subtitle' | 'prompt' | 'body' | 'label' | 'note';
  runs: SceneTextRun[];
  fontSize: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle';
};

export type SceneShapeElement = SceneElementBase & {
  kind: 'shape';
  shape: 'rect' | 'roundRect' | 'line' | 'pill';
  fill: string;
  stroke?: string;
  radius?: number;
};

export type SceneTableElement = SceneElementBase & {
  kind: 'table';
  headers: string[];
  rows: string[][];
  fontSize: number;
  headerFill: string;
  cellFill: string;
  textColor: string;
};

export type SceneConnectorElement = SceneElementBase & {
  kind: 'connector';
  from: string;
  to: string;
  stroke: string;
  arrowEnd: boolean;
};

export type SceneGroupElement = SceneElementBase & {
  kind: 'group';
  children: string[];
};

export type SceneElement =
  | SceneTextElement
  | SceneShapeElement
  | SceneTableElement
  | SceneConnectorElement
  | SceneGroupElement;

export type CompiledSlideScene = {
  contractVersion: typeof COMPILED_SLIDE_SCENE_VERSION;
  id: string;
  semanticSlideSpecId: string;
  storyboardScreenId: string;
  unitId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  size: {
    width: 1280;
    height: 720;
    aspect: '16:9';
  };
  background: string;
  elements: SceneElement[];
  speakerNotes: string;
  readingOrder: string[];
};

export type CompiledScenePresentation = {
  kind: 'compiled-scene-presentation';
  contractVersion: typeof COMPILED_SLIDE_SCENE_VERSION;
  title: string;
  scenes: CompiledSlideScene[];
};
```

Scene contract rules:

- Coordinates are 1280 x 720 pixels.
- Every visible text string is in an editable `text` or `table` element.
- Every instructional structure is native scene data: text, shape, table, connector, or group.
- No element kind represents a full-slide raster.
- Image elements are not emitted in Gate 3.
- `readingOrder` lists visible/editable element IDs in intended order.
- PPTX export converts scene pixels to 10 x 5.625 inch coordinates with a single scale function.

## Scene Validation Rules

Create validation helpers in `lib/compiledSlideScene.ts`:

```ts
export type SceneValidationDiagnosticCode =
  | 'scene_contract_invalid'
  | 'scene_element_off_canvas'
  | 'scene_text_overflow'
  | 'scene_uneditable_visible_text'
  | 'scene_reading_order_invalid'
  | 'scene_full_slide_raster_forbidden'
  | 'scene_preview_pptx_parity_mismatch';
```

Validation must block when:

- scene size is not exactly 1280 x 720, 16:9;
- any element frame is off-canvas;
- estimated text height exceeds its frame at the chosen font size and line height;
- any visible text is represented by a non-editable element;
- reading order references a missing element or omits a visible text/table element;
- any image/raster-like operation covers the slide;
- preview descriptors and PPTX operation descriptors disagree on visible text, element IDs, or reading order.

Text fitting is deterministic and approximate:

```ts
const estimateWrappedLineCount = (text: string, frameWidth: number, fontSize: number): number => {
  const averageCharWidth = fontSize * 0.54;
  const charsPerLine = Math.max(1, Math.floor(frameWidth / averageCharWidth));
  return text
    .split(/\n+/)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
};
```

If a slot cannot fit at or above the minimum supported font size, return `scene_text_overflow`. Do not silently drop text.

## PPTX Scene Operations

Create `lib/compiledScenePptx.ts`.

This module must not import React or render DOM. It produces deterministic operations that `App.tsx` can apply to a `pptxgenjs` slide:

```ts
import type { CompiledSlideScene, SceneElement } from './compiledSlideScene.ts';

export type PptxSceneOperation =
  | { kind: 'addText'; elementId: string; text: string; options: Record<string, unknown> }
  | { kind: 'addShape'; elementId: string; shape: string; options: Record<string, unknown> }
  | { kind: 'addTable'; elementId: string; rows: string[][]; options: Record<string, unknown> }
  | { kind: 'addNotes'; text: string };

const frameToPptxOptions = (frame: SceneElement['frame']): Record<string, number> => ({
  x: frame.x / 128,
  y: frame.y / 128,
  w: frame.w / 128,
  h: frame.h / 128,
});

const compileSceneElementToPptxOperation = (element: SceneElement): PptxSceneOperation[] => {
  if (element.kind === 'text') {
    return [{
      kind: 'addText',
      elementId: element.id,
      text: element.runs.map((run) => run.text).join(''),
      options: {
        ...frameToPptxOptions(element.frame),
        fontFace: 'Poppins',
        fontSize: element.fontSize,
        color: element.runs[0]?.color || '111827',
        bold: element.runs.some((run) => run.bold),
        align: element.align,
        valign: element.valign,
        fit: 'shrink',
      },
    }];
  }

  if (element.kind === 'table') {
    return [{
      kind: 'addTable',
      elementId: element.id,
      rows: [element.headers, ...element.rows],
      options: frameToPptxOptions(element.frame),
    }];
  }

  if (element.kind === 'shape' || element.kind === 'connector') {
    return [{
      kind: 'addShape',
      elementId: element.id,
      shape: element.kind === 'connector' ? 'line' : element.shape,
      options: frameToPptxOptions(element.frame),
    }];
  }

  return [];
};

export const compilePptxSceneOperations = (scene: CompiledSlideScene): PptxSceneOperation[] => {
  return scene.elements.flatMap((element) => compileSceneElementToPptxOperation(element)).concat(
    scene.speakerNotes.trim() ? [{ kind: 'addNotes' as const, text: scene.speakerNotes }] : [],
  );
};
```

`App.tsx` applies the operations using `pptxgenjs` in the existing dynamic import path. Gate 3 must not create image files, screenshots, or rasterized slide canvases.

## Web Preview Scene Component

Create `components/CompiledSlideSceneView.tsx`.

Props:

```ts
import type { CompiledSlideScene } from '../lib/compiledSlideScene';

type CompiledSlideSceneViewProps = {
  scene: CompiledSlideScene;
  direction: 'next' | 'prev' | null;
};
```

Rules:

- Render the scene inside a stable 16:9 container.
- Render each element from `scene.elements`; do not reconstruct layout from `SemanticSlideSpec`.
- Use absolute positioning from scene coordinates converted to percentages.
- Render text and tables as selectable HTML text.
- Do not render canvas.
- Do not render image placeholders as fetched/generated assets.
- Do not modify `components/Slide.tsx`.

## App Integration Plan

Add state:

```ts
const [compiledScenePresentation, setCompiledScenePresentation] = useState<CompiledScenePresentation | null>(null);
const [generatedPlanUnitSceneSlidesByDay, setGeneratedPlanUnitSceneSlidesByDay] = useState<Record<number, CompiledSlideScene[]>>({});
```

Reset rules:

- `handleReset()` clears both new state values.
- When legacy `presentation` is set, clear `compiledScenePresentation`.
- When `compiledScenePresentation` is set, clear legacy `presentation`.

Render rules:

- `renderPresentationView()` accepts either legacy `presentation` or `compiledScenePresentation`.
- If `compiledScenePresentation` exists, use `CompiledSlideSceneView`.
- Speaker notes textarea reads/writes `scene.speakerNotes` for scene slides.
- Existing `SlideComponent` path remains unchanged for legacy slides.

Export rules:

- `handleExportAsPPTX()` branches:
  - if `compiledScenePresentation` exists, export scenes using `compilePptxSceneOperations(scene)`;
  - otherwise run the existing legacy `Slide` export unchanged.
- PPTX scene export uses native `addText`, `addShape`, table operations, connectors, and `addNotes`.
- Do not call `html2canvas` or create full-slide images for scene export.

Generation rules:

- In K-12 single source-primary mode with `VITE_SEMANTIC_SLIDES_V1` true, build the scene presentation from the full validated storyboard and return before legacy cache lookup or `generateK12SingleLessonSlides`.
- In K-12 daily source-primary mode with `VITE_SEMANTIC_SLIDES_V1` true, build the scene presentation from the selected source unit storyboard and return before legacy daily cache lookup or `generateK12SlidesForDay`.
- Weekly blueprint generation can remain legacy in Gate 3. The semantic branch applies to the source-primary selected unit/session deck after Gate 2 validation.
- Topic-only and disabled-flag routes remain legacy.

## Semantic Scene Boundary

Create this public function in `lib/semanticSlideSpec.ts`:

```ts
export const resolveSemanticScenePresentationForGeneration = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  flagValue: unknown,
  storyboard: TeachingStoryboard | null,
  options: {
    title: string;
    selectedUnitLabel?: string;
  },
): SemanticScenePresentationBoundary => {
  if (!isSemanticSlidesV1Enabled(flagValue) || policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, presentation: null };
  }

  if (!storyboard) {
    return {
      ok: false,
      message: 'The uploaded source was not converted into a teaching storyboard before semantic slide compilation.',
      diagnostics: [{
        code: 'semantic_spec_contract_invalid',
        severity: 'blocking',
        message: 'Missing source-bound teaching storyboard.',
      }],
    };
  }

  const specsResult = buildSemanticSlideSpecs(storyboard);
  if (!specsResult.ok) {
    return { ok: false, message: formatSemanticSlideDiagnostics(specsResult.diagnostics), diagnostics: specsResult.diagnostics };
  }

  const sceneResult = compileSemanticSlideSpecsToScenes(specsResult.specs, options);
  if (!sceneResult.ok) {
    return { ok: false, message: formatSceneValidationDiagnostics(sceneResult.diagnostics), diagnostics: sceneResult.diagnostics };
  }

  return { ok: true, presentation: sceneResult.presentation };
};
```

## Task 1: Add Semantic Fixtures and RED Tests

**Files:**
- Create: `tests/fixtures/semanticSlideFixtures.ts`
- Create: `tests/semanticSlideSpec.test.ts`
- Create in Task 2: `lib/semanticSlideSpec.ts`

**Interfaces:**
- Consumes: `buildLessonSourceManifest(document)` from `lib/lessonSourceManifest.ts`.
- Consumes: `buildTeachingStoryboard(manifest)` from `lib/teachingStoryboard.ts`.
- Produces failing tests for `buildSemanticSlideSpecs`, `validateSemanticSlideSpecs`, `resolveSemanticScenePresentationForGeneration`, and `isSemanticSlidesV1Enabled`.

- [ ] **Step 1: Create sanitized semantic fixture helper**

Create `tests/fixtures/semanticSlideFixtures.ts`:

```ts
import { buildLessonSourceManifest } from '../../lib/lessonSourceManifest.ts';
import { buildTeachingStoryboard, type TeachingStoryboard } from '../../lib/teachingStoryboard.ts';
import {
  EVIDENCE_OUTPUT_DOCUMENT,
  TEACHER_SCRIPT_DOCUMENT,
} from './teachingStoryboardFixtures.ts';
import {
  FIVE_SESSION_MATRIX_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
} from './lessonSourceManifestFixtures.ts';

const storyboardFrom = (document: Parameters<typeof buildLessonSourceManifest>[0]): TeachingStoryboard => {
  const manifestResult = buildLessonSourceManifest(document);
  if (!manifestResult.ok) throw new Error('semantic fixture manifest failed');
  const storyboardResult = buildTeachingStoryboard(manifestResult.manifest);
  if (!storyboardResult.ok) throw new Error('semantic fixture storyboard failed');
  return storyboardResult.storyboard;
};

export const FIVE_SESSION_STORYBOARD = storyboardFrom(FIVE_SESSION_MATRIX_DOCUMENT);
export const MULTI_OBJECTIVE_STORYBOARD = storyboardFrom(MULTI_OBJECTIVE_UNIT_DOCUMENT);
export const TEACHER_SCRIPT_STORYBOARD = storyboardFrom(TEACHER_SCRIPT_DOCUMENT);
export const EVIDENCE_OUTPUT_STORYBOARD = storyboardFrom(EVIDENCE_OUTPUT_DOCUMENT);
```

- [ ] **Step 2: Write RED semantic spec tests**

Create `tests/semanticSlideSpec.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import {
  buildSemanticSlideSpecs,
  formatSemanticSlideDiagnostics,
  isSemanticSlidesV1Enabled,
  resolveSemanticScenePresentationForGeneration,
  validateSemanticSlideSpecs,
} from '../lib/semanticSlideSpec.ts';
import {
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
  MULTI_OBJECTIVE_STORYBOARD,
  TEACHER_SCRIPT_STORYBOARD,
} from './fixtures/semanticSlideFixtures.ts';

test('accepts only documented true-like Gate 3 flag values', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(isSemanticSlidesV1Enabled(value), true);
  }
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) {
    assert.equal(isSemanticSlidesV1Enabled(value), false);
  }
});

test('builds stable semantic slide specs from storyboard screens', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.specs.map((spec) => spec.id), ['semslide-001', 'semslide-002', 'semslide-003']);
  assert.deepEqual(
    result.specs.map((spec) => spec.storyboardScreenId),
    EVIDENCE_OUTPUT_STORYBOARD.screens.map((screen) => screen.id),
  );
});

test('preserves source-step and source-objective mapping from storyboard screens', () => {
  const result = buildSemanticSlideSpecs(MULTI_OBJECTIVE_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const spec of result.specs) {
    const screen = MULTI_OBJECTIVE_STORYBOARD.screens.find((item) => item.id === spec.storyboardScreenId);
    assert.ok(screen);
    assert.deepEqual(spec.sourceStepIds, screen.sourceStepIds);
    assert.deepEqual(spec.sourceObjectiveIds, screen.sourceObjectiveIds);
  }
});

test('selects semantic layouts for at least 80 percent of non-title instructional specs', () => {
  const result = buildSemanticSlideSpecs(FIVE_SESSION_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const instructional = result.specs.filter((spec) => spec.intent !== 'title-context');
  const semanticCount = instructional.filter((spec) => spec.layoutId !== 'generic-bullets').length;
  assert.equal(semanticCount / instructional.length >= 0.8, true);
});

test('maps evidence and output storyboard screens to evidence or exit layouts', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.specs.some((spec) => spec.layoutId === 'evidence-capture-board'));
  assert.ok(result.specs.some((spec) => spec.layoutId === 'exit-ticket-card'));
});

test('keeps teacher-script out of visible semantic slots', () => {
  const result = buildSemanticSlideSpecs(TEACHER_SCRIPT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visible = JSON.stringify(result.specs.map((spec) => spec.slots));
  assert.doesNotMatch(visible, /the teacher will ask learners/i);
});

test('rejects semantic specs with missing storyboard mappings', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = [{ ...result.specs[0], storyboardScreenId: 'screen-999' }, ...result.specs.slice(1)];
  const diagnostics = validateSemanticSlideSpecs(invalid, EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_storyboard_mapping_invalid'), true);
  assert.match(formatSemanticSlideDiagnostics(diagnostics), /storyboard/i);
});

test('rejects semantic specs with changed source-step ownership', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = [{ ...result.specs[1], sourceStepIds: ['step-999'] }, ...result.specs.slice(1)];
  const diagnostics = validateSemanticSlideSpecs(invalid, EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_source_step_mismatch'), true);
});

test('rejects low semantic-layout coverage', () => {
  const result = buildSemanticSlideSpecs(FIVE_SESSION_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = result.specs.map((spec) => spec.intent === 'title-context' ? spec : { ...spec, layoutId: 'generic-bullets' as const });
  const diagnostics = validateSemanticSlideSpecs(invalid, FIVE_SESSION_STORYBOARD);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_generic_layout_coverage_low'), true);
});

test('rejects image asset requests in Gate 3', () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const invalid = [{ ...result.specs[0], assetRequests: [{ kind: 'image' }] as never }, ...result.specs.slice(1)];
  const diagnostics = validateSemanticSlideSpecs(invalid, EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'semantic_spec_asset_request_forbidden'), true);
});

test('semantic scene route is source-primary and flag gated', () => {
  const sourcePolicy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const topicPolicy = resolveK12GenerationRoutePolicy('', 'true');

  assert.equal(
    resolveSemanticScenePresentationForGeneration(topicPolicy, 'true', EVIDENCE_OUTPUT_STORYBOARD, { title: 'Fixture' }).presentation,
    null,
  );
  assert.equal(
    resolveSemanticScenePresentationForGeneration(sourcePolicy, 'false', EVIDENCE_OUTPUT_STORYBOARD, { title: 'Fixture' }).presentation,
    null,
  );
  const enabled = resolveSemanticScenePresentationForGeneration(sourcePolicy, 'true', EVIDENCE_OUTPUT_STORYBOARD, { title: 'Fixture' });
  assert.equal(enabled.ok, true);
  if (!enabled.ok) return;
  assert.ok(enabled.presentation);
});

test('semantic scene route blocks enabled source-primary routes without a storyboard', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const boundary = resolveSemanticScenePresentationForGeneration(policy, 'true', null, { title: 'Fixture' });

  assert.equal(boundary.ok, false);
  if (boundary.ok) return;
  assert.match(boundary.message, /storyboard/i);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test
```

Expected:

```text
ERR_MODULE_NOT_FOUND for lib/semanticSlideSpec.ts
```

Do not create `lib/semanticSlideSpec.ts` before this RED failure is observed.

## Task 2: Implement SemanticSlideSpec Builder and Validator

**Files:**
- Create: `lib/semanticSlideSpec.ts`
- Test: `tests/semanticSlideSpec.test.ts`

**Interfaces:**
- Consumes: `TeachingStoryboard` from `lib/teachingStoryboard.ts`.
- Produces: `buildSemanticSlideSpecs(storyboard): SemanticSlideSpecResult`.
- Produces: `validateSemanticSlideSpecs(specs, storyboard): SemanticSlideDiagnostic[]`.
- Produces in Task 5: `resolveSemanticScenePresentationForGeneration(...)`.

- [ ] **Step 1: Add contract and helper exports**

Implement the contract from the SemanticSlideSpec Contract section and these helpers:

```ts
export const hasBlockingSemanticSlideDiagnostics = (diagnostics: SemanticSlideDiagnostic[]): boolean => (
  diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
);

export const formatSemanticSlideDiagnostics = (diagnostics: SemanticSlideDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};
```

- [ ] **Step 2: Implement layout intent selection**

Add pure mapping helpers:

```ts
const inferSemanticIntent = (screen: StoryboardScreen): SemanticSlideIntent => {
  if (screen.sourceObjectiveIds.length > 0 && screen.sourceStepIds.length === 0) return 'learning-targets';
  if (screen.communicationIntent === 'evidence-capture' || screen.requiredEvidence.length > 0) return 'evidence-capture';
  if (screen.communicationIntent === 'exit-ticket' || screen.requiredOutputs.length > 0) return 'exit-ticket';
  if (screen.communicationIntent === 'discussion-prompt') return 'discussion-prompt';
  if (screen.communicationIntent === 'guided-example') return 'guided-example';
  if (screen.communicationIntent === 'question') return 'question';
  if (screen.communicationIntent === 'answer-reveal') return 'answer-reveal';
  return 'activity-board';
};

const selectLayoutId = (intent: SemanticSlideIntent, screen: StoryboardScreen): SemanticLayoutId => {
  if (intent === 'learning-targets') return 'learning-targets-stack';
  if (intent === 'evidence-capture') return 'evidence-capture-board';
  if (intent === 'exit-ticket') return 'exit-ticket-card';
  if (intent === 'discussion-prompt' || intent === 'question') return 'prompt-card';
  if (intent === 'answer-reveal') return 'question-reveal-pair';
  if (intent === 'guided-example') return 'guided-example-steps';
  if (screen.learnerContent.questions.length > 1) return 'prompt-card';
  return 'activity-board';
};
```

- [ ] **Step 3: Implement slot builder**

Add:

```ts
const buildSlotsForScreen = (screen: StoryboardScreen): Record<string, SlideSlotValue> => {
  const title = screen.learnerTitle.trim();
  const prompt = screen.learnerContent.prompt?.trim();
  const task = screen.learnerContent.task?.trim();
  const directions = screen.learnerContent.directions.filter((item) => item.trim());
  const successCriteria = screen.learnerContent.successCriteria.filter((item) => item.trim());
  const requirements = [
    ...screen.requiredEvidence.map((item) => `Evidence: ${item}`),
    ...screen.requiredOutputs.map((item) => `Output: ${item}`),
  ];

  return {
    title: { kind: 'text', text: title },
    body: { kind: 'list', items: [prompt, task, ...directions].filter((item): item is string => Boolean(item)) },
    requirements: { kind: 'list', items: requirements },
    successCriteria: { kind: 'list', items: successCriteria },
  };
};
```

- [ ] **Step 4: Implement builder**

Implement:

```ts
export const buildSemanticSlideSpecs = (storyboard: TeachingStoryboard): SemanticSlideSpecResult => {
  const specs = storyboard.screens.map((screen, index): SemanticSlideSpec => {
    const intent = inferSemanticIntent(screen);
    return {
      contractVersion: SEMANTIC_SLIDE_SPEC_VERSION,
      id: `semslide-${String(index + 1).padStart(3, '0')}`,
      unitId: screen.unitId,
      storyboardScreenId: screen.id,
      sourceStepIds: [...screen.sourceStepIds],
      sourceObjectiveIds: [...screen.sourceObjectiveIds],
      intent,
      layoutId: selectLayoutId(intent, screen),
      slots: buildSlotsForScreen(screen),
      assetRequests: [],
      speakerNotes: screen.teacherNotes,
      accessibility: {
        readingOrder: ['title', 'body', 'requirements', 'successCriteria'],
        slidePurpose: screen.instructionalPurpose,
      },
    };
  });

  const diagnostics = validateSemanticSlideSpecs(specs, storyboard);
  if (hasBlockingSemanticSlideDiagnostics(diagnostics)) return { ok: false, diagnostics };
  return { ok: true, specs };
};
```

- [ ] **Step 5: Implement validator**

Validator rules:

- Every spec maps to exactly one storyboard screen by `storyboardScreenId`.
- `sourceStepIds` equals the source screen's `sourceStepIds` in count, order, and identity.
- `sourceObjectiveIds` equals the source screen's `sourceObjectiveIds` in count, order, and identity.
- `assetRequests` must be an empty array in Gate 3.
- `layoutId` must be one of the bounded layout IDs.
- For non-title instructional specs, at least 80% use a semantic layout, where only `generic-bullets` is non-semantic.

Run:

```bash
npm test
```

Expected: semantic spec tests pass; scene-related imports still fail until Task 3 if `resolveSemanticScenePresentationForGeneration` imports `compiledSlideScene.ts`.

## Task 3: Add CompiledSlideScene Contract, Compiler, and Validator

**Files:**
- Create: `lib/compiledSlideScene.ts`
- Create: `tests/compiledSlideScene.test.ts`
- Modify: `lib/semanticSlideSpec.ts`

**Interfaces:**
- Consumes: `SemanticSlideSpec[]`.
- Produces: `compileSemanticSlideSpecsToScenes(specs, options): CompiledScenePresentationResult`.
- Produces: `validateCompiledSlideScene(scene): SceneValidationDiagnostic[]`.
- Produces: `getSceneVisibleText(scene): string[]`.
- Produces: `createPreviewSceneDescriptors(scene)`.

- [ ] **Step 1: Write RED compiled scene tests**

Create `tests/compiledSlideScene.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import {
  compileSemanticSlideSpecsToScenes,
  createPreviewSceneDescriptors,
  getSceneVisibleText,
  validateCompiledSlideScene,
} from '../lib/compiledSlideScene.ts';
import {
  EVIDENCE_OUTPUT_STORYBOARD,
  FIVE_SESSION_STORYBOARD,
} from './fixtures/semanticSlideFixtures.ts';

const specsFrom = () => {
  const result = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('semantic specs failed');
  return result.specs;
};

test('compiles semantic specs into 16:9 scenes with stable ids', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.kind, 'compiled-scene-presentation');
  assert.deepEqual(result.presentation.scenes.map((scene) => scene.id), ['scene-001', 'scene-002', 'scene-003']);
  assert.equal(result.presentation.scenes.every((scene) => scene.size.width === 1280 && scene.size.height === 720), true);
});

test('validates every compiled element is inside the 16:9 canvas', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const scene of result.presentation.scenes) {
    assert.deepEqual(validateCompiledSlideScene(scene), []);
  }
});

test('represents visible text as editable text or table elements', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const textValues = result.presentation.scenes.flatMap(getSceneVisibleText);
  assert.equal(textValues.length > 0, true);
  for (const scene of result.presentation.scenes) {
    const invalid = scene.elements.filter((element) => {
      const hasText = element.kind === 'text' || element.kind === 'table';
      return hasText && !element.editable;
    });
    assert.deepEqual(invalid, []);
  }
});

test('rejects off-canvas elements', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const invalid = {
    ...scene,
    elements: [{ ...scene.elements[0], frame: { ...scene.elements[0].frame, x: -10 } }, ...scene.elements.slice(1)],
  };
  const diagnostics = validateCompiledSlideScene(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_element_off_canvas'), true);
});

test('rejects text overflow without truncating content', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const firstText = scene.elements.find((element) => element.kind === 'text');
  assert.ok(firstText);
  const invalid = {
    ...scene,
    elements: scene.elements.map((element) => element.id === firstText.id
      ? {
          ...element,
          frame: { ...element.frame, h: 8 },
        }
      : element),
  };
  const diagnostics = validateCompiledSlideScene(invalid);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'scene_text_overflow'), true);
});

test('does not emit image or full-slide raster elements in Gate 3', () => {
  const specsResult = buildSemanticSlideSpecs(FIVE_SESSION_STORYBOARD);
  assert.equal(specsResult.ok, true);
  if (!specsResult.ok) return;
  const result = compileSemanticSlideSpecsToScenes(specsResult.specs, { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.presentation.scenes.flatMap((scene) => scene.elements).some((element) => element.kind === 'image'), false);
});

test('preview descriptors are derived from the compiled scene contract', () => {
  const result = compileSemanticSlideSpecsToScenes(specsFrom(), { title: 'Fixture Deck' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  const descriptors = createPreviewSceneDescriptors(scene);
  assert.deepEqual(descriptors.map((descriptor) => descriptor.elementId), scene.elements.map((element) => element.id));
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test
```

Expected:

```text
ERR_MODULE_NOT_FOUND for lib/compiledSlideScene.ts
```

- [ ] **Step 3: Implement scene types and minimal theme tokens**

Add the CompiledSlideScene contract, diagnostics, and deterministic tokens:

```ts
export const DEFAULT_SCENE_THEME_TOKENS = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  primaryText: '#111827',
  mutedText: '#475569',
  accent: '#2563EB',
  accentSoft: '#DBEAFE',
  evidence: '#047857',
  output: '#B45309',
  border: '#CBD5E1',
} as const;
```

- [ ] **Step 4: Implement layout compiler**

Compiler requirements:

- Each scene uses fixed 1280 x 720 dimensions.
- Each layout has hard-coded frames and stable element IDs derived from `scene-###`.
- `title-context` creates title/subtitle text.
- `learning-targets-stack` creates objective cards.
- `prompt-card` creates a prompt panel and direction list.
- `activity-board` creates task and checklist cards.
- `evidence-capture-board` creates evidence/output zones.
- `guided-example-steps` and `process-flow-horizontal` create native step cards with connectors.
- `exit-ticket-card` creates a visible output task and success criteria.
- `generic-bullets` creates editable title and bullet text only when unavoidable.
- The compiler returns `{ ok: false, diagnostics }` if validation fails.

- [ ] **Step 5: Implement overflow and editability validator**

Add:

```ts
export const validateCompiledSlideScene = (scene: CompiledSlideScene): SceneValidationDiagnostic[] => {
  // Check canvas, off-canvas frames, text fit, editability, reading order, and raster prohibition.
};
```

Run:

```bash
npm test
```

Expected: semantic spec and compiled scene tests pass.

## Task 4: Add PPTX Scene Operation Parity

**Files:**
- Create: `lib/compiledScenePptx.ts`
- Create: `tests/compiledScenePptx.test.ts`

**Interfaces:**
- Consumes: `CompiledSlideScene`.
- Produces: `compilePptxSceneOperations(scene): PptxSceneOperation[]`.
- Produces: `getPptxSceneOperationText(operations): string[]`.

- [ ] **Step 1: Write RED PPTX operation tests**

Create `tests/compiledScenePptx.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { compileSemanticSlideSpecsToScenes, createPreviewSceneDescriptors } from '../lib/compiledSlideScene.ts';
import { compilePptxSceneOperations, getPptxSceneOperationText } from '../lib/compiledScenePptx.ts';
import { buildSemanticSlideSpecs } from '../lib/semanticSlideSpec.ts';
import { EVIDENCE_OUTPUT_STORYBOARD } from './fixtures/semanticSlideFixtures.ts';

const sceneFromFixture = () => {
  const specs = buildSemanticSlideSpecs(EVIDENCE_OUTPUT_STORYBOARD);
  assert.equal(specs.ok, true);
  if (!specs.ok) throw new Error('semantic specs failed');
  const scenes = compileSemanticSlideSpecsToScenes(specs.specs, { title: 'Fixture Deck' });
  assert.equal(scenes.ok, true);
  if (!scenes.ok) throw new Error('scene compile failed');
  return scenes.presentation.scenes[0];
};

test('compiles PPTX operations from the same scene used by preview', () => {
  const scene = sceneFromFixture();
  const previewDescriptors = createPreviewSceneDescriptors(scene);
  const pptxOperations = compilePptxSceneOperations(scene);

  assert.deepEqual(
    pptxOperations.filter((operation) => 'elementId' in operation).map((operation) => operation.elementId),
    previewDescriptors.map((descriptor) => descriptor.elementId),
  );
});

test('preserves visible text between preview descriptors and PPTX operations', () => {
  const scene = sceneFromFixture();
  const previewText = createPreviewSceneDescriptors(scene).flatMap((descriptor) => descriptor.text ?? []);
  const pptxText = getPptxSceneOperationText(compilePptxSceneOperations(scene));

  assert.deepEqual(pptxText.filter(Boolean), previewText.filter(Boolean));
});

test('adds speaker notes as native notes operation', () => {
  const scene = sceneFromFixture();
  const operations = compilePptxSceneOperations(scene);

  assert.equal(operations.some((operation) => operation.kind === 'addNotes' && operation.text === scene.speakerNotes), true);
});

test('uses native text, shape, table, and connector operations only', () => {
  const scene = sceneFromFixture();
  const operations = compilePptxSceneOperations(scene);

  assert.equal(operations.some((operation) => operation.kind === 'addImage'), false);
  assert.equal(operations.every((operation) => ['addText', 'addShape', 'addTable', 'addNotes'].includes(operation.kind)), true);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test
```

Expected:

```text
ERR_MODULE_NOT_FOUND for lib/compiledScenePptx.ts
```

- [ ] **Step 3: Implement PPTX operation compiler**

Implementation rules:

- Convert pixel frames to PPTX inches using `x / 128`, `y / 128`, `w / 128`, `h / 128`.
- Text elements produce `addText`.
- Shape and connector elements produce `addShape`.
- Table elements produce `addTable`.
- Speaker notes produce one `addNotes` operation.
- Operation order follows `scene.elements` and then notes.
- No `addImage` operation exists in Gate 3.

Run:

```bash
npm test
```

Expected: PPTX operation tests pass.

## Task 5: Wire Source-Primary Semantic Scene Route in App

**Files:**
- Modify: `App.tsx`
- Create: `components/CompiledSlideSceneView.tsx`

**Interfaces:**
- Consumes: `CompiledScenePresentation`, `CompiledSlideScene`.
- Consumes: `resolveSemanticScenePresentationForGeneration(...)`.
- Consumes: `compilePptxSceneOperations(scene)`.
- Produces: source-primary semantic preview/export branch behind `VITE_SEMANTIC_SLIDES_V1`.

- [ ] **Step 1: Add imports and flag**

Add:

```ts
import CompiledSlideSceneView from './components/CompiledSlideSceneView';
import type { CompiledScenePresentation, CompiledSlideScene } from './lib/compiledSlideScene';
import { compilePptxSceneOperations } from './lib/compiledScenePptx';
import { resolveSemanticScenePresentationForGeneration } from './lib/semanticSlideSpec';
```

Add:

```ts
const SEMANTIC_SLIDES_V1_FLAG = import.meta.env.VITE_SEMANTIC_SLIDES_V1;
```

- [ ] **Step 2: Add scene state and reset behavior**

Add the state variables from the App Integration Plan. In `handleReset`, clear both new state values. Whenever legacy `setPresentation(...)` stores generated legacy slides, also set `compiledScenePresentation` to `null`.

- [ ] **Step 3: Add semantic branch after Gate 2 preflight**

In K-12 single source-primary flow, immediately after `teachingStoryboardBoundary` succeeds:

```ts
const semanticSceneBoundary = resolveSemanticScenePresentationForGeneration(
  routePolicy,
  SEMANTIC_SLIDES_V1_FLAG,
  teachingStoryboardBoundary.storyboard,
  { title: sourceManifestBoundary.manifest?.units[0]?.sourceLabel || 'Source-Aligned Lesson' },
);
if (semanticSceneBoundary.ok === false) {
  setError(semanticSceneBoundary.message);
  setIsLoading(false);
  return;
}
if (semanticSceneBoundary.presentation) {
  const hasQuota = adminGenerationLimitBypassed || tryIncrementCount('generations');
  if (!hasQuota) {
    setIsLoading(false);
    setError(t.presentation.errorGenerationLimit);
    return;
  }
  setCompiledScenePresentation(semanticSceneBoundary.presentation);
  setPresentation(null);
  setCurrentSlide(0);
  await finishLoadingProgress(setLoadingProgress);
  setAppStep('presenting');
  shouldRollbackGeneration = false;
  return;
}
```

In K-12 daily source-primary flow, use the selected-unit storyboard already built for `dayIndex`, then apply the same semantic boundary before `buildGenerationCacheKey('k12-plan-unit-slides', ...)`.

- [ ] **Step 4: Render scene presentations**

Update `renderPresentationView()`:

- If neither `presentation` nor `compiledScenePresentation` exists, show the existing empty presentation error.
- Use `const activeSlideCount = compiledScenePresentation?.scenes.length ?? presentation?.slides.length ?? 0`.
- If `compiledScenePresentation` exists, render:

```tsx
<CompiledSlideSceneView
  scene={compiledScenePresentation.scenes[currentSlide]}
  direction={transitionDirection}
/>
```

- Keep `SlideComponent` unchanged for legacy slides.
- Speaker notes textarea edits `compiledScenePresentation.scenes[currentSlide].speakerNotes` in scene mode.

- [ ] **Step 5: Export scene presentations**

In `handleExportAsPPTX()`:

- If `compiledScenePresentation` exists, create a PPTX and apply `compilePptxSceneOperations(scene)` for each scene.
- Use native PPTX operations only.
- Keep the existing legacy export block unchanged for `presentation`.

- [ ] **Step 6: Implement `CompiledSlideSceneView`**

Render each scene element with absolute positioning. Use native text/table DOM nodes. Do not import or call image generation helpers.

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected:

```text
npm test exits 0.
npm run typecheck exits 0.
npm run build exits 0.
git diff --check prints nothing.
```

## Task 6: Add Gate 3 Baseline and Final Verification

**Files:**
- Create: `docs/superpowers/baselines/2026-07-11-gate3-semantic-slide-scene-baseline.md`

- [ ] **Step 1: Create sanitized baseline**

Create:

```markdown
# Gate 3 Semantic Slide Scene Baseline

Date: 2026-07-11
Scope: Sanitized semantic slide specs and compiled native scenes only.

## Fixtures

- `FIVE_SESSION_STORYBOARD`
- `EVIDENCE_OUTPUT_STORYBOARD`
- `MULTI_OBJECTIVE_STORYBOARD`
- `TEACHER_SCRIPT_STORYBOARD`

## Required Outcomes

- Semantic layout coverage for non-title instructional slides: at least 80%.
- Scene size: 1280 x 720, 16:9.
- Overflow diagnostics: 0 on sanitized fixtures.
- Off-canvas diagnostics: 0 on sanitized fixtures.
- Full-slide raster elements: 0.
- Image asset requests emitted: 0.
- Preview/PPTX visible text parity: exact.
- Editable visible text and instructional structures: yes.
- Legacy `Slide` route remains available when `VITE_SEMANTIC_SLIDES_V1` is false-like.

## Non-Claims

- No image asset pipeline is implemented in Gate 3.
- No generated visual system is implemented in Gate 3.
- No NotebookLM-like visual polish is implemented in Gate 3.
- No model or prompt change is implemented in Gate 3.
```

- [ ] **Step 2: Run final commands**

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
git diff --name-only 003e2583c8e0e6e84412a83c09071a00a9d40e93..HEAD
```

Expected set:

```text
App.tsx
components/CompiledSlideSceneView.tsx
docs/superpowers/baselines/2026-07-11-gate3-semantic-slide-scene-baseline.md
lib/compiledScenePptx.ts
lib/compiledSlideScene.ts
lib/semanticSlideSpec.ts
tests/compiledScenePptx.test.ts
tests/compiledSlideScene.test.ts
tests/fixtures/semanticSlideFixtures.ts
tests/semanticSlideSpec.test.ts
```

- [ ] **Step 4: Verify forbidden scopes**

Run:

```bash
git diff --exit-code 003e2583c8e0e6e84412a83c09071a00a9d40e93..HEAD -- \
  services/geminiService.ts \
  components/Slide.tsx \
  types.ts \
  lib/k12GenerationRoutePolicy.ts \
  lib/lessonSourceManifest.ts \
  lib/teachingStoryboard.ts \
  lib/generationCache.ts \
  package.json \
  package-lock.json
```

Expected: no output, exit 0.

Run:

```bash
git diff --name-only 003e2583c8e0e6e84412a83c09071a00a9d40e93..HEAD -- \
  api/_r2ImageCache.ts \
  api/_pexelsImageSearch.ts \
  lib/serverImageGeneration.ts \
  lib/imagePrompting.ts \
  lib/imageSemantic.ts \
  scripts/upload-curated-r2-images.mjs \
  scripts/generate-r2-images.ts \
  public/curated-images
```

Expected: no output.

- [ ] **Step 5: Verify privacy**

Run:

```bash
git diff --name-only --diff-filter=A 003e2583c8e0e6e84412a83c09071a00a9d40e93..HEAD | \
  rg -i '\.(docx|pptx|pdf|png|jpe?g)$|Downloads|Word Docs|PPT|rendered|extracted'
```

Expected: no output and `rg` exit 1.

Run:

```bash
rg -n "Downloads|Word Docs|PPT/2026July|rendered reference|private source|teacher name|school name|private artifact title|private lesson title" \
  App.tsx components lib tests docs/superpowers/baselines/2026-07-11-gate3-semantic-slide-scene-baseline.md
```

Expected: no output and `rg` exit 1.

- [ ] **Step 6: Commit**

Commit only after all final verification passes:

```bash
git add App.tsx components/CompiledSlideSceneView.tsx lib/semanticSlideSpec.ts lib/compiledSlideScene.ts lib/compiledScenePptx.ts tests/fixtures/semanticSlideFixtures.ts tests/semanticSlideSpec.test.ts tests/compiledSlideScene.test.ts tests/compiledScenePptx.test.ts docs/superpowers/baselines/2026-07-11-gate3-semantic-slide-scene-baseline.md
git commit -m "Implement semantic slide scene gate"
```

## Explicit Non-Goals

- No image asset pipeline.
- No image provider changes.
- No image prompt changes.
- No visual-system generation beyond deterministic test tokens.
- No model/provider swaps.
- No AI prompt expansion.
- No full-slide raster output.
- No NotebookLM visual work.
- No semantic content generation from raw source outside the validated storyboard.
- No private DOCX/PPTX/PDF/images or extracted private lesson text.
- No deployment, push, or pull request.

## Required Gate 3 Implementation Report

The implementer must return:

1. Worktree path, branch, base commit, and final commit hashes.
2. Files changed.
3. `SemanticSlideSpec` contract implemented.
4. Bounded layout library implemented.
5. `CompiledSlideScene` contract implemented.
6. Source/storyboard mapping proof.
7. Semantic layout coverage proof, including percentage for non-title instructional slides.
8. Overflow and 16:9 bounds proof.
9. Editable text/structure proof.
10. Preview/PPTX scene parity proof.
11. Exact test count and command output summary.
12. Typecheck and build outcomes.
13. Proof prompt/model/image/layout legacy/export forbidden scopes are unchanged except the planned scene export branch.
14. Proof no private artifacts or extracted private text were committed.
15. Deviations, unresolved risks, and assumptions.
16. This exact limitation: `Gate 3 introduces semantic slide specs and native compiled scenes; it does not yet implement image asset pipelines, generated visual systems, NotebookLM-like polish, or model-assisted visual design.`

## Risks and Open Questions

- Weekly blueprint creation remains legacy in Gate 3. The semantic path applies to source-primary selected lesson/session decks after Gate 2 storyboard validation.
- The initial layout library is intentionally small; semantic coverage is enforced on sanitized fixtures but may fail closed on unusually dense real lessons until more bounded layouts are added.
- Text overflow detection is deterministic and approximate. It prevents known clipping but is not a substitute for rendered artifact validation in Gate 5.
- Scene preview and PPTX parity is proven by shared scene descriptors and operation descriptors in Gate 3; screenshot-based visual parity belongs to later hard-validation work.
- The new scene route consumes generation quota after semantic validation succeeds to preserve generation-limit behavior, even though it performs no paid AI calls.
