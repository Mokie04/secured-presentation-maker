# Gate 2 Source-Bound Teaching Storyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, source-bound `TeachingStoryboard` that translates a valid `LessonSourceManifest` into learner-facing teaching screens while preserving source ownership, sequence, objective meaning, required evidence, and required outputs.

**Architecture:** Gate 2 sits immediately after Gate 1 manifest validation and before current K-12 cache lookup, reusable seeds, quota increment, or AI generation. The storyboard is an audience-translation contract and validator, not a semantic slide schema, visual system, layout renderer, or prompt rewrite. Gate 2 may rewrite teacher-facing prose into learner-facing prompts/tasks and teacher notes, but deterministic source-step accounting remains the authority.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, existing Gate 0 route policy, existing Gate 1 `LessonSourceManifest`, dependency-free pure TypeScript modules, and Node 26 `node:test` with `--experimental-strip-types`.

## Global Constraints

- Gate 2 only: source-bound teaching storyboard before semantic slide, visual, image, layout, renderer, or export work.
- Do not expand or refactor Gate 0 or Gate 1.
- Uploaded lesson plans are authoritative.
- Lesson-plan formats are not hard-coded; 5E, 4A, MATATAG, traditional DLL/DLP, and teacher-defined formats are inputs, not internal schemas.
- Teacher-facing source prose may become learner-facing prompts, tasks, questions, or teacher notes.
- Do not show awkward teacher-script language such as `The teacher will ask...` as visible learner text.
- Do not invent steps, reorder source requirements, merge non-adjacent source steps, or use a generic lesson summary as an alignment substitute.
- Source objectives remain one-to-one in count, source order, owning unit, and meaning.
- Mandatory source-step accounting is 100%.
- Foreign or invented source steps are 0.
- Order inversions are 0.
- Visible teacher-script violations are 0.
- Required evidence and required outputs remain attached to the source-backed screen.
- Invalid source-primary storyboards fail closed before cache lookup, quota increment, reusable seeds, or AI calls.
- Legacy and topic-only routes remain unchanged.
- Do not change AI prompts, text models, image providers, response schemas, semantic slide schemas, visual systems, slide rendering, layout, PPTX export, deployment environment, or paid AI behavior.
- Do not commit private DOCX, PPTX, PDF, extracted lesson text, rendered reference images, teacher names, learner data, or school-identifying content.
- Tests must use sanitized fixtures with equivalent structural properties and distinctive sentinels.

---

## Current Gate 1 Insertion Point

Gate 1 added:

- `LessonSourceManifest` and `LessonSourceManifestResult` in `lib/lessonSourceManifest.ts`.
- `StructuredSourceDocument` adapter boundary in `lib/lessonSourceDocument.ts`.
- `lessonSourceManifestResult` state in `App.tsx`.
- Source-primary preflight via `resolveSourceManifestForGeneration(routePolicy, lessonSourceManifestResult)`.

The smallest Gate 2 insertion point is in `App.tsx`, immediately after this Gate 1 preflight succeeds:

```ts
const sourceManifestBoundary = resolveSourceManifestForGeneration(
  routePolicy,
  lessonSourceManifestResult,
);
if (sourceManifestBoundary.ok === false) {
  setError(sourceManifestBoundary.message);
  setIsLoading(false);
  return;
}
```

Gate 2 adds:

```ts
const storyboardBoundary = resolveTeachingStoryboardForGeneration(
  routePolicy,
  sourceManifestBoundary.manifest,
);
if (storyboardBoundary.ok === false) {
  setError(storyboardBoundary.message);
  setIsLoading(false);
  return;
}
```

This must run before:

- `buildGenerationCacheKey(...)`;
- `loadReusableSeedWhenAllowed(...)`;
- `getCachedGeneration(...)`;
- `tryIncrementCount('generations')`;
- `createK12LessonBlueprint(...)`;
- `generateK12SingleLessonSlides(...)`;
- `generateK12SlidesForDay(...)`.

The returned storyboard is not passed into the current prompts in Gate 2. It is validated and stored only as a source-bound contract for later gates.

## Expected Implementation File Set

Expected files to change during Gate 2 implementation:

- Modify: `App.tsx`
- Create: `lib/teachingStoryboard.ts`
- Create: `tests/fixtures/teachingStoryboardFixtures.ts`
- Create: `tests/teachingStoryboard.test.ts`
- Create: `docs/superpowers/baselines/2026-07-11-gate2-teaching-storyboard-sample-review.md`

Files that must not change in Gate 2:

- `services/geminiService.ts`
- `types.ts`
- `components/Slide.tsx`
- `lib/generationCache.ts`
- `lib/k12GenerationRoutePolicy.ts`
- `lib/imageSemantic.ts`
- image modules under `lib/`, `api/`, `scripts/`, and `public/curated-images/`
- layout, renderer, and PPTX export code in `App.tsx`
- `package.json`
- `package-lock.json`

## Storyboard Contract Shape

Create `lib/teachingStoryboard.ts` with these exported types. Keep the module pure and dependency-free.

```ts
import type {
  LessonSourceManifest,
  SourceDiagnosticSeverity,
  SourceFieldState,
  SourceObjective,
  SourceStep,
  SourceUnit,
} from './lessonSourceManifest.ts';
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';

export const TEACHING_STORYBOARD_VERSION = 'teaching-storyboard-v1';

export type StoryboardDiagnosticSeverity = SourceDiagnosticSeverity;

export type StoryboardDiagnosticCode =
  | 'storyboard_source_step_unaccounted'
  | 'storyboard_foreign_source_step'
  | 'storyboard_order_inversion'
  | 'storyboard_teacher_script_visible'
  | 'storyboard_objective_mismatch'
  | 'storyboard_required_evidence_missing'
  | 'storyboard_required_output_missing'
  | 'storyboard_blank_field_invented'
  | 'storyboard_contract_invalid';

export type StoryboardAccountingStatus =
  | 'screened'
  | 'teacher-notes'
  | 'metadata'
  | 'blank-preserved'
  | 'intentionally-omitted';

export type StoryboardCommunicationIntent =
  | 'learning-target'
  | 'prior-knowledge'
  | 'discussion-prompt'
  | 'activity-task'
  | 'evidence-capture'
  | 'guided-example'
  | 'question'
  | 'answer-reveal'
  | 'exit-ticket'
  | 'teacher-note';

export type StructuredLearnerContent = {
  prompt?: string;
  task?: string;
  questions: string[];
  directions: string[];
  successCriteria: string[];
  expectedOutput?: string;
};

export type StoryboardObjective = {
  id: string;
  sourceObjectiveId: string;
  unitId: string;
  sourceOrder: number;
  learnerText: string;
};

export type StoryboardScreen = {
  id: string;
  unitId: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  sourceFieldIds: string[];
  instructionalPurpose: string;
  learnerTitle: string;
  learnerContent: StructuredLearnerContent;
  teacherNotes: string;
  requiredEvidence: string[];
  requiredOutputs: string[];
  communicationIntent: StoryboardCommunicationIntent;
  pairId?: string;
  pairRole?: 'prompt' | 'reveal';
};

export type SourceStepAccountingEntry = {
  sourceStepId: string;
  unitId: string;
  screenIds: string[];
  status: StoryboardAccountingStatus;
};

export type SourceFieldAccountingEntry = {
  sourceFieldId: string;
  unitId: string;
  screenIds: string[];
  state: SourceFieldState;
  status: StoryboardAccountingStatus;
};

export type StoryboardDiagnostic = {
  code: StoryboardDiagnosticCode;
  severity: StoryboardDiagnosticSeverity;
  message: string;
  sourceStepId?: string;
  sourceObjectiveId?: string;
  screenId?: string;
};

export type TeachingStoryboard = {
  contractVersion: typeof TEACHING_STORYBOARD_VERSION;
  provenance: {
    sourceManifestVersion: LessonSourceManifest['contractVersion'];
    sourceHash: string;
    selectedUnitIds: string[];
  };
  objectives: StoryboardObjective[];
  screens: StoryboardScreen[];
  sourceStepAccounting: SourceStepAccountingEntry[];
  sourceFieldAccounting: SourceFieldAccountingEntry[];
  diagnostics: StoryboardDiagnostic[];
};

export type TeachingStoryboardResult =
  | { ok: true; storyboard: TeachingStoryboard }
  | { ok: false; diagnostics: StoryboardDiagnostic[] };

export type TeachingStoryboardGenerationBoundary =
  | { ok: true; storyboard: TeachingStoryboard | null }
  | { ok: false; message: string; diagnostics: StoryboardDiagnostic[] };
```

Do not add `layoutId`, slot schemas, asset requests, visual-system tokens, renderer scene fields, or PPTX metadata in Gate 2.

## Source-Step Accounting Rules

- For source-primary uploaded routes, every selected non-admin `SourceStep.id` must appear in `sourceStepAccounting`.
- A present instructional source step must appear in at least one `StoryboardScreen.sourceStepIds`.
- A blank source step with `fieldState: 'blank'` must be accounted as `blank-preserved` and must not produce invented learner content.
- Field rows preserved by Gate 1 must appear in `sourceFieldAccounting` as `screened`, `teacher-notes`, `metadata`, `blank-preserved`, or `intentionally-omitted`.
- A screen may split one source step into adjacent screens. Both screens reference the same `sourceStepId`.
- A screen may merge adjacent source steps only when those source steps are contiguous by `sourceOrder`.
- No screen may reference a step ID outside the selected manifest units.
- No screen may omit all source references unless it is an objective-only learning-target screen with `sourceObjectiveIds`.
- Source order is validated by the minimum `sourceOrder` of each screen's source steps. That sequence must be non-decreasing, with no backwards movement.

## Objective Mapping Rules

- Create one `StoryboardObjective` per `SourceObjective`.
- IDs are stable and monotonic: `stobj-001`, `stobj-002`, `stobj-003`.
- `StoryboardObjective.sourceObjectiveId` preserves the source objective ID.
- Objective count equals `manifest.objectives.length` for selected units.
- Objective order equals source objective order.
- Unit ownership equals source ownership.
- Learner objective text may simplify wording, but cannot combine two objectives into one or split one objective into multiple storyboard objectives.
- Visible learning-target screens may reference objectives without referencing a source step.

## Teacher-Script Violation Detector

The visible-text detector checks `learnerTitle` and every string inside `learnerContent`. It does not check `teacherNotes`.

Use this exact initial detector in `lib/teachingStoryboard.ts`:

```ts
export const VISIBLE_TEACHER_SCRIPT_PATTERN =
  /\b(?:the\s+teacher|teacher\s+will|teacher\s+asks?|teacher\s+shall|will\s+ask\s+(?:learners|students)|ask\s+(?:learners|students)\s+to|learners\s+will|students\s+will)\b/i;
```

Visible text must be direct learner-facing language:

- Source: `The teacher will ask learners to choose the first reading.`
- Visible: `Choose the first reading you would take.`
- Teacher notes: `Source action: The teacher will ask learners to choose the first reading.`

## Required Evidence and Output Extraction Strategy

Gate 2 uses deterministic extraction from source text. This is intentionally conservative and source-backed.

```ts
export type ExtractedSourceRequirements = {
  requiredEvidence: string[];
  requiredOutputs: string[];
};

const REQUIRED_EVIDENCE_PATTERN =
  /\b(?:evidence|record|reading|readings|measurement|measurements|data|claim|observation|observations|defend|support)\b/i;

const REQUIRED_OUTPUT_PATTERN =
  /\b(?:submit|output|exit\s+ticket|ticket|worksheet|response|answer|conclusion|reflection|assignment)\b/i;
```

Rules:

- If a present source step matches `REQUIRED_EVIDENCE_PATTERN`, attach a source-backed evidence phrase to the screen's `requiredEvidence`.
- If a present source step matches `REQUIRED_OUTPUT_PATTERN`, attach a source-backed output phrase to the screen's `requiredOutputs`.
- Prefer a concise phrase containing the matched keyword and nearby object, but never invent an object not present in `rawBlocks`.
- If phrase extraction is uncertain, attach the normalized source block text itself rather than inventing a paraphrase.
- Validator fails with `storyboard_required_evidence_missing` or `storyboard_required_output_missing` when a source requirement is detected but not attached to any screen that references the source step.

## Repair and Fail Behavior

Gate 2 implementation is deterministic and does not call a model.

Allowed deterministic repairs:

- strip visible teacher-script prefixes from visible text and retain the original source action in `teacherNotes`;
- sort `sourceStepIds` within a screen by source order;
- attach missing required evidence/output arrays from the referenced source step when the builder produced the screen and the text is source-backed;
- convert blank source step screens to `blank-preserved` accounting with no visible invented content.

Disallowed repairs:

- adding a new source step that is not in the manifest;
- adding source-backed work for a missing source step after a candidate storyboard omitted it;
- reordering screens to hide an inversion in a candidate storyboard;
- changing objective count, order, or unit ownership;
- summarizing multiple non-adjacent source steps into one screen;
- using a text model to "fix" a failed validator in Gate 2.

If validation still has any blocking diagnostic after one bounded repair pass, return:

```ts
{ ok: false, diagnostics }
```

`resolveTeachingStoryboardForGeneration(...)` formats blocking diagnostics into a user-visible error and blocks source-primary generation before cache lookup, quota increment, reusable seeds, or AI calls.

---

### Task 1: Add Storyboard Fixtures and RED Tests

**Files:**
- Create: `tests/fixtures/teachingStoryboardFixtures.ts`
- Create: `tests/teachingStoryboard.test.ts`
- Uses existing: `tests/fixtures/lessonSourceManifestFixtures.ts`
- Create later in Task 2: `lib/teachingStoryboard.ts`

**Interfaces:**
- Consumes: `buildLessonSourceManifest(document)` from `lib/lessonSourceManifest.ts`.
- Produces failing tests for `buildTeachingStoryboard()`, `validateTeachingStoryboard()`, `hasBlockingStoryboardDiagnostics()`, `formatStoryboardDiagnostics()`, `detectVisibleTeacherScript()`, and `resolveTeachingStoryboardForGeneration()`.

- [ ] **Step 1: Create sanitized storyboard fixtures**

Create `tests/fixtures/teachingStoryboardFixtures.ts`:

```ts
import type { StructuredSourceDocument } from '../../lib/lessonSourceDocument.ts';

export const TEACHER_SCRIPT_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-teacher-script.txt',
  sourceHash: 'fixture-teacher-script-source-hash',
  byteLength: 2600,
  plainText: '',
  blocks: [
    { id: 'ts001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'ts001' } },
    { id: 'ts002', kind: 'paragraph', text: 'Objective: TS-OBJ-A Choose a first test based on evidence.', sourceOrder: 2, sourceLocation: { blockId: 'ts002' } },
    { id: 'ts003', kind: 'paragraph', text: 'Launch: The teacher will ask learners to choose the first meter reading and explain why.', sourceOrder: 3, sourceLocation: { blockId: 'ts003' } },
    { id: 'ts004', kind: 'paragraph', text: 'Output: Submit one claim and one reading as the exit ticket.', sourceOrder: 4, sourceLocation: { blockId: 'ts004' } },
  ],
  tables: [],
};

export const EVIDENCE_OUTPUT_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-evidence-output.txt',
  sourceHash: 'fixture-evidence-output-source-hash',
  byteLength: 3200,
  plainText: '',
  blocks: [
    { id: 'eo001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'eo001' } },
    { id: 'eo002', kind: 'paragraph', text: 'Objective: EO-OBJ-A Use observations to support a claim.', sourceOrder: 2, sourceLocation: { blockId: 'eo002' } },
    { id: 'eo003', kind: 'paragraph', text: 'Investigation: EO-EVIDENCE-A Record two observations and one measurement in the data table.', sourceOrder: 3, sourceLocation: { blockId: 'eo003' } },
    { id: 'eo004', kind: 'paragraph', text: 'Closure: EO-OUTPUT-A Submit a conclusion that uses the recorded evidence.', sourceOrder: 4, sourceLocation: { blockId: 'eo004' } },
  ],
  tables: [],
};
```

- [ ] **Step 2: Write RED tests**

Create `tests/teachingStoryboard.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import { buildLessonSourceManifest } from '../lib/lessonSourceManifest.ts';
import {
  buildTeachingStoryboard,
  detectVisibleTeacherScript,
  formatStoryboardDiagnostics,
  hasBlockingStoryboardDiagnostics,
  validateTeachingStoryboard,
  resolveTeachingStoryboardForGeneration,
} from '../lib/teachingStoryboard.ts';
import {
  FIVE_SESSION_MATRIX_DOCUMENT,
  MISSING_AND_BLANK_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
} from './fixtures/lessonSourceManifestFixtures.ts';
import {
  EVIDENCE_OUTPUT_DOCUMENT,
  TEACHER_SCRIPT_DOCUMENT,
} from './fixtures/teachingStoryboardFixtures.ts';

const manifestFrom = (document: Parameters<typeof buildLessonSourceManifest>[0]) => {
  const result = buildLessonSourceManifest(document);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('fixture manifest failed');
  return result.manifest;
};

test('accounts for 100 percent of selected source steps', () => {
  const manifest = manifestFrom(FIVE_SESSION_MATRIX_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const sourceStepIds = manifest.units.flatMap((unit) => unit.steps.map((step) => step.id));
  assert.equal(result.storyboard.sourceStepAccounting.length, sourceStepIds.length);
  assert.deepEqual(
    result.storyboard.sourceStepAccounting.map((entry) => entry.sourceStepId).sort(),
    sourceStepIds.sort(),
  );
  assert.equal(result.storyboard.sourceStepAccounting.every((entry) => entry.status === 'screened'), true);
});

test('preserves objective count, source order, and unit ownership', () => {
  const manifest = manifestFrom(MULTI_OBJECTIVE_UNIT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(
    result.storyboard.objectives.map((objective) => objective.sourceObjectiveId),
    manifest.objectives.map((objective) => objective.id),
  );
  assert.deepEqual(
    result.storyboard.objectives.map((objective) => objective.unitId),
    manifest.objectives.map((objective) => objective.unitId),
  );
  assert.equal(result.storyboard.objectives.length, 3);
});

test('preserves source-step order without inversions', () => {
  const manifest = manifestFrom(FIVE_SESSION_MATRIX_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const sourceOrderByStepId = new Map(
    manifest.units.flatMap((unit) => unit.steps.map((step) => [step.id, step.sourceOrder] as const)),
  );
  const screenOrders = result.storyboard.screens
    .filter((screen) => screen.sourceStepIds.length > 0)
    .map((screen) => Math.min(...screen.sourceStepIds.map((id) => sourceOrderByStepId.get(id) ?? Number.POSITIVE_INFINITY)));
  assert.deepEqual(screenOrders, [...screenOrders].sort((a, b) => a - b));
});

test('removes visible teacher-script while retaining source action in notes', () => {
  const manifest = manifestFrom(TEACHER_SCRIPT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const visibleText = result.storyboard.screens
    .map((screen) => [screen.learnerTitle, screen.learnerContent.prompt, screen.learnerContent.task, ...screen.learnerContent.directions].join(' '))
    .join('\n');
  assert.equal(detectVisibleTeacherScript(visibleText), false);
  assert.match(result.storyboard.screens.map((screen) => screen.teacherNotes).join('\n'), /teacher will ask learners/i);
});

test('attaches required evidence and outputs to source-backed screens', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const evidenceScreen = result.storyboard.screens.find((screen) => screen.requiredEvidence.join(' ').includes('EO-EVIDENCE-A'));
  const outputScreen = result.storyboard.screens.find((screen) => screen.requiredOutputs.join(' ').includes('EO-OUTPUT-A'));
  assert.ok(evidenceScreen);
  assert.ok(outputScreen);
});

test('preserves blank and missing source fields without inventing content', () => {
  const manifest = manifestFrom(MISSING_AND_BLANK_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const blankEntries = result.storyboard.sourceFieldAccounting.filter((entry) => entry.state === 'blank');
  const missingEntries = result.storyboard.sourceFieldAccounting.filter((entry) => entry.state === 'missing');
  assert.equal(blankEntries.length > 0, true);
  assert.equal(missingEntries.length > 0, true);
  assert.equal(blankEntries.every((entry) => entry.status === 'blank-preserved'), true);
  assert.equal(missingEntries.every((entry) => entry.status === 'intentionally-omitted'), true);
});

test('rejects foreign or invented source-step references', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const invalidStoryboard = {
    ...result.storyboard,
    screens: [
      {
        ...result.storyboard.screens[0],
        sourceStepIds: ['step-999'],
      },
    ],
  };
  const diagnostics = validateTeachingStoryboard(invalidStoryboard, manifest);

  assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
  assert.equal(diagnostics[0].code, 'storyboard_foreign_source_step');
  assert.match(formatStoryboardDiagnostics(diagnostics), /source step/i);
});

test('rejects source-step order inversions', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const invalidStoryboard = {
    ...result.storyboard,
    screens: [...result.storyboard.screens].reverse(),
  };
  const diagnostics = validateTeachingStoryboard(invalidStoryboard, manifest);

  assert.equal(hasBlockingStoryboardDiagnostics(diagnostics), true);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'storyboard_order_inversion'), true);
});

test('requires storyboard validation for enabled source-primary routes', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  const boundary = resolveTeachingStoryboardForGeneration(policy, manifest, result);

  assert.equal(boundary.ok, true);
  if (!boundary.ok) return;
  assert.ok(boundary.storyboard);
});

test('does not require a storyboard for legacy or topic-only routes', () => {
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const result = buildTeachingStoryboard(manifest);

  assert.deepEqual(
    resolveTeachingStoryboardForGeneration(resolveK12GenerationRoutePolicy('', 'true'), manifest, result),
    { ok: true, storyboard: null },
  );
  assert.deepEqual(
    resolveTeachingStoryboardForGeneration(resolveK12GenerationRoutePolicy('uploaded source text', 'false'), manifest, result),
    { ok: true, storyboard: null },
  );
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
npm test
```

Expected result:

```text
ERR_MODULE_NOT_FOUND for lib/teachingStoryboard.ts
```

If the failure is a fixture syntax error or an unrelated existing test failure, fix the test files before creating `lib/teachingStoryboard.ts`.

---

### Task 2: Implement TeachingStoryboard Contract and Validator

**Files:**
- Create: `lib/teachingStoryboard.ts`
- Test: `tests/teachingStoryboard.test.ts`

**Interfaces:**
- Consumes: `LessonSourceManifest`, `SourceUnit`, `SourceStep`, `SourceObjective` from `lib/lessonSourceManifest.ts`.
- Produces: `validateTeachingStoryboard(storyboard, manifest): StoryboardDiagnostic[]`.
- Produces: `detectVisibleTeacherScript(value: string): boolean`.
- Produces: `hasBlockingStoryboardDiagnostics(diagnostics): boolean`.
- Produces: `formatStoryboardDiagnostics(diagnostics): string`.
- Produces later in Task 3: `buildTeachingStoryboard(manifest, options?): TeachingStoryboardResult`.

- [ ] **Step 1: Add contract and diagnostic helpers**

Create `lib/teachingStoryboard.ts` with the contract from the Storyboard Contract Shape section and these helpers:

```ts
export const hasBlockingStoryboardDiagnostics = (diagnostics: StoryboardDiagnostic[]): boolean => (
  diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
);

export const formatStoryboardDiagnostics = (diagnostics: StoryboardDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};

export const detectVisibleTeacherScript = (value: string): boolean => (
  VISIBLE_TEACHER_SCRIPT_PATTERN.test(value)
);
```

- [ ] **Step 2: Implement validator source lookup helpers**

Add local helpers:

```ts
const getSelectedUnits = (manifest: LessonSourceManifest, selectedUnitIds?: readonly string[]): SourceUnit[] => {
  if (!selectedUnitIds || selectedUnitIds.length === 0) return manifest.units;
  const selected = new Set(selectedUnitIds);
  return manifest.units.filter((unit) => selected.has(unit.id));
};

const getSelectedSteps = (units: readonly SourceUnit[]): SourceStep[] => (
  units.flatMap((unit) => unit.steps).sort((a, b) => a.sourceOrder - b.sourceOrder)
);

const getSelectedObjectives = (manifest: LessonSourceManifest, units: readonly SourceUnit[]): SourceObjective[] => {
  const unitIds = new Set(units.map((unit) => unit.id));
  return manifest.objectives
    .filter((objective) => unitIds.has(objective.unitId))
    .sort((a, b) => a.sourceOrder - b.sourceOrder);
};
```

- [ ] **Step 3: Implement visible-text traversal**

Add:

```ts
const getVisibleStrings = (screen: StoryboardScreen): string[] => [
  screen.learnerTitle,
  screen.learnerContent.prompt ?? '',
  screen.learnerContent.task ?? '',
  ...screen.learnerContent.questions,
  ...screen.learnerContent.directions,
  ...screen.learnerContent.successCriteria,
  screen.learnerContent.expectedOutput ?? '',
].filter((value) => value.trim());
```

- [ ] **Step 4: Implement validator**

Implement:

```ts
export const validateTeachingStoryboard = (
  storyboard: TeachingStoryboard,
  manifest: LessonSourceManifest,
): StoryboardDiagnostic[] => {
  const diagnostics: StoryboardDiagnostic[] = [...storyboard.diagnostics];
  const selectedUnits = getSelectedUnits(manifest, storyboard.provenance.selectedUnitIds);
  const selectedSteps = getSelectedSteps(selectedUnits);
  const selectedObjectives = getSelectedObjectives(manifest, selectedUnits);
  const selectedStepIds = new Set(selectedSteps.map((step) => step.id));
  const selectedObjectiveIds = new Set(selectedObjectives.map((objective) => objective.id));
  const sourceOrderByStepId = new Map(selectedSteps.map((step) => [step.id, step.sourceOrder] as const));

  validateObjectiveMapping(storyboard, selectedObjectives, diagnostics);
  validateForeignReferences(storyboard, selectedStepIds, selectedObjectiveIds, diagnostics);
  validateSourceStepAccounting(storyboard, selectedSteps, diagnostics);
  validateScreenOrder(storyboard, sourceOrderByStepId, diagnostics);
  validateVisibleTeacherScript(storyboard, diagnostics);
  validateRequiredEvidenceAndOutputs(storyboard, selectedSteps, diagnostics);
  validateBlankFieldAccounting(storyboard, selectedUnits, diagnostics);

  return diagnostics;
};
```

The helper implementations must follow the rules sections above. Do not add model calls or prompt strings.

- [ ] **Step 5: Run tests to verify expected next failure**

Run:

```bash
npm test
```

Expected result:

```text
The requested module '../lib/teachingStoryboard.ts' does not provide an export named 'buildTeachingStoryboard'
```

The validator-only exports should now load.

---

### Task 3: Implement Deterministic Storyboard Builder

**Files:**
- Modify: `lib/teachingStoryboard.ts`
- Test: `tests/teachingStoryboard.test.ts`

**Interfaces:**
- Consumes: `LessonSourceManifest`.
- Produces: `buildTeachingStoryboard(manifest: LessonSourceManifest, options?: { selectedUnitIds?: readonly string[] }): TeachingStoryboardResult`.

- [ ] **Step 1: Add normalizers**

Add local helpers:

```ts
const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const stripTeacherScriptForVisibleText = (value: string): string => (
  normalizeText(value)
    .replace(/^the\s+teacher\s+will\s+ask\s+(?:learners|students)\s+to\s+/i, '')
    .replace(/^the\s+teacher\s+asks?\s+(?:learners|students)\s+to\s+/i, '')
    .replace(/^ask\s+(?:learners|students)\s+to\s+/i, '')
    .replace(/^learners\s+will\s+/i, '')
    .replace(/^students\s+will\s+/i, '')
);
```

- [ ] **Step 2: Add source requirement extraction**

Add:

```ts
export type ExtractedSourceRequirements = {
  requiredEvidence: string[];
  requiredOutputs: string[];
};

export const extractSourceRequirements = (step: SourceStep): ExtractedSourceRequirements => {
  const text = normalizeText(step.rawBlocks.join(' '));
  return {
    requiredEvidence: REQUIRED_EVIDENCE_PATTERN.test(text) ? [text] : [],
    requiredOutputs: REQUIRED_OUTPUT_PATTERN.test(text) ? [text] : [],
  };
};
```

- [ ] **Step 3: Add communication-intent inference**

Add:

```ts
const inferCommunicationIntent = (step: SourceStep): StoryboardCommunicationIntent => {
  const label = step.sourceLabel.toLowerCase();
  const text = step.rawBlocks.join(' ').toLowerCase();
  if (/\b(?:exit|evaluate|assessment|submit|ticket)\b/.test(`${label} ${text}`)) return 'exit-ticket';
  if (/\b(?:evidence|record|data|measurement|reading|observation)\b/.test(`${label} ${text}`)) return 'evidence-capture';
  if (/\b(?:question|ask|choose|predict)\b/.test(`${label} ${text}`)) return 'discussion-prompt';
  if (/\b(?:example|model|demonstrate)\b/.test(`${label} ${text}`)) return 'guided-example';
  return 'activity-task';
};
```

- [ ] **Step 4: Add builder**

Implement:

```ts
export const buildTeachingStoryboard = (
  manifest: LessonSourceManifest,
  options: { selectedUnitIds?: readonly string[] } = {},
): TeachingStoryboardResult => {
  const selectedUnits = getSelectedUnits(manifest, options.selectedUnitIds);
  const selectedUnitIds = selectedUnits.map((unit) => unit.id);
  const selectedObjectives = getSelectedObjectives(manifest, selectedUnits);
  const selectedSteps = getSelectedSteps(selectedUnits);

  const storyboard: TeachingStoryboard = {
    contractVersion: TEACHING_STORYBOARD_VERSION,
    provenance: {
      sourceManifestVersion: manifest.contractVersion,
      sourceHash: manifest.provenance.sourceHash,
      selectedUnitIds,
    },
    objectives: selectedObjectives.map((objective, index) => ({
      id: `stobj-${String(index + 1).padStart(3, '0')}`,
      sourceObjectiveId: objective.id,
      unitId: objective.unitId,
      sourceOrder: objective.sourceOrder,
      learnerText: stripTeacherScriptForVisibleText(objective.rawText),
    })),
    screens: [],
    sourceStepAccounting: [],
    sourceFieldAccounting: [],
    diagnostics: [],
  };

  addObjectiveScreens(storyboard, selectedUnits);
  addSourceStepScreens(storyboard, selectedSteps);
  addFieldAccounting(storyboard, selectedUnits);

  const diagnostics = validateTeachingStoryboard(storyboard, manifest);
  if (hasBlockingStoryboardDiagnostics(diagnostics)) return { ok: false, diagnostics };
  storyboard.diagnostics = diagnostics;
  return { ok: true, storyboard };
};
```

Implementation details:

- `addObjectiveScreens(...)` creates one learning-target screen per selected unit with `sourceObjectiveIds` for that unit and no `sourceStepIds`.
- `addSourceStepScreens(...)` creates one screen per present source step in global `sourceOrder`.
- Blank steps are accounted as `blank-preserved` and do not produce a learner-visible screen.
- Visible learner text is derived from source text after teacher-script stripping.
- `teacherNotes` contains the original source label and raw block text.
- `requiredEvidence` and `requiredOutputs` come from `extractSourceRequirements(step)`.
- Screen IDs are stable and monotonic: `screen-001`, `screen-002`, `screen-003`.

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```bash
npm test
```

Expected:

```text
tests 32
pass 32
fail 0
```

The count is 22 existing Gate 0/Gate 1 tests plus 10 Gate 2 tests.

---

### Task 4: Wire Storyboard Preflight Into Source-Primary Generation

**Files:**
- Modify: `App.tsx`
- Modify: `lib/teachingStoryboard.ts`
- Test: `tests/teachingStoryboard.test.ts`

**Interfaces:**
- Consumes: `resolveK12GenerationRoutePolicy(...)`.
- Consumes: successful `SourceManifestGenerationBoundary`.
- Produces: `resolveTeachingStoryboardForGeneration(policy, manifest, storyboardResult)`.

- [ ] **Step 1: Add route-boundary helper tests**

The tests from Task 1 already cover:

- enabled source-primary requires a valid storyboard;
- topic-only legacy does not require a storyboard;
- disabled source-primary routing does not require a storyboard.

Add one more test to `tests/teachingStoryboard.test.ts`:

```ts
test('blocks enabled source-primary routes when storyboard validation fails', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const manifest = manifestFrom(EVIDENCE_OUTPUT_DOCUMENT);
  const failedResult = {
    ok: false as const,
    diagnostics: [{
      code: 'storyboard_source_step_unaccounted' as const,
      severity: 'blocking' as const,
      message: 'Missing source-step accounting.',
      sourceStepId: 'step-001',
    }],
  };

  const boundary = resolveTeachingStoryboardForGeneration(policy, manifest, failedResult);

  assert.equal(boundary.ok, false);
  if (boundary.ok) return;
  assert.match(boundary.message, /Missing source-step accounting/);
});
```

- [ ] **Step 2: Implement route-boundary helper**

Add to `lib/teachingStoryboard.ts`:

```ts
export const resolveTeachingStoryboardForGeneration = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  manifest: LessonSourceManifest | null,
  storyboardResult: TeachingStoryboardResult | null,
): TeachingStoryboardGenerationBoundary => {
  if (policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, storyboard: null };
  }

  if (!manifest) {
    const diagnostics: StoryboardDiagnostic[] = [{
      code: 'storyboard_contract_invalid',
      severity: 'blocking',
      message: 'The uploaded source was not converted into a source manifest before storyboarding.',
    }];
    return { ok: false, message: formatStoryboardDiagnostics(diagnostics), diagnostics };
  }

  if (!storyboardResult) {
    const diagnostics: StoryboardDiagnostic[] = [{
      code: 'storyboard_contract_invalid',
      severity: 'blocking',
      message: 'The uploaded source was not converted into a teaching storyboard.',
    }];
    return { ok: false, message: formatStoryboardDiagnostics(diagnostics), diagnostics };
  }

  if (storyboardResult.ok === false) {
    return {
      ok: false,
      message: formatStoryboardDiagnostics(storyboardResult.diagnostics),
      diagnostics: storyboardResult.diagnostics,
    };
  }

  const diagnostics = validateTeachingStoryboard(storyboardResult.storyboard, manifest);
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  if (blocking.length > 0) {
    return { ok: false, message: formatStoryboardDiagnostics(blocking), diagnostics: blocking };
  }

  return { ok: true, storyboard: storyboardResult.storyboard };
};
```

- [ ] **Step 3: Integrate in `App.tsx` without changing prompts**

Add imports:

```ts
import {
  buildTeachingStoryboard,
  resolveTeachingStoryboardForGeneration,
} from './lib/teachingStoryboard';
```

In the K-12 branch of `handleCreatePlan()`, immediately after Gate 1 source-manifest boundary:

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

In `handleGenerateDailySlides()`, immediately after Gate 1 source-manifest boundary:

```ts
const selectedUnitId = sourceManifestBoundary.manifest?.units[dayIndex]?.id;
const teachingStoryboardResult = sourceManifestBoundary.manifest
  ? buildTeachingStoryboard(
      sourceManifestBoundary.manifest,
      selectedUnitId ? { selectedUnitIds: [selectedUnitId] } : undefined,
    )
  : null;
const teachingStoryboardBoundary = resolveTeachingStoryboardForGeneration(
  routePolicy,
  sourceManifestBoundary.manifest,
  teachingStoryboardResult,
);
if (teachingStoryboardBoundary.ok === false) {
  setError(teachingStoryboardBoundary.message);
  setLessonBlueprint(prev => {
      if (!prev) return null;
      const newDays = [...prev.days];
      newDays[dayIndex].generationStatus = 'pending';
      return {...prev, days: newDays};
  });
  setIsLoading(false);
  return;
}
```

Requirements:

- Do not pass `teachingStoryboardBoundary.storyboard` into `createK12LessonBlueprint()`, `generateK12SingleLessonSlides()`, or `generateK12SlidesForDay()` in Gate 2.
- Do not modify prompt text in `services/geminiService.ts`.
- Do not modify models, providers, image behavior, layout, renderer, or PPTX export.
- Do not change topic-only or disabled-route behavior.
- Do not increment quota or read cache before storyboard validation on enabled uploaded source-primary routes.

- [ ] **Step 4: Run verification**

Run:

```bash
npm test
npm run typecheck
git diff --check
git diff -- services/geminiService.ts types.ts components/Slide.tsx lib/generationCache.ts lib/k12GenerationRoutePolicy.ts
```

Expected:

```text
tests 33
pass 33
fail 0
```

The forbidden-file diff command prints nothing.

---

### Task 5: Add Sanitized Sample Storyboard Review Baseline

**Files:**
- Create: `docs/superpowers/baselines/2026-07-11-gate2-teaching-storyboard-sample-review.md`

**Interfaces:**
- Consumes: sanitized Gate 2 fixture results.
- Produces: human-readable review checklist for planner/teacher review.

- [ ] **Step 1: Create the baseline document**

Create the baseline with this structure:

```markdown
# Gate 2 Teaching Storyboard Sample Review

Date: 2026-07-11
Scope: Sanitized source-bound teaching storyboard fixture only.

## Fixture

- Source: `EVIDENCE_OUTPUT_DOCUMENT`
- Privacy: synthetic text only; no sensitive classroom identifiers or external source artifacts.

## Required Review Outcomes

- Source-step accounting: 100%
- Foreign or invented steps: 0
- Order inversions: 0
- Visible teacher-script violations: 0
- Objective count/order/ownership: preserved
- Required evidence attached: yes
- Required outputs attached: yes
- Blank or missing fields invented into learner content: no

## Teacher-Review Checklist

- Learner-facing language is direct and classroom-usable.
- Teacher actions are retained in speaker/teacher notes, not visible titles.
- The storyboard follows the source sequence.
- Required evidence and output remain explicit.
- No visual/layout claims are made in this gate.
```

- [ ] **Step 2: Do not include generated private content**

The baseline may name sanitized fixture IDs and diagnostic counts. It must not include sensitive classroom identifiers, external artifact paths, screenshots, generated deck images, or copied lesson-plan prose.

---

### Task 6: Gate 2 Release-Gate Verification

**Files:** No new changes expected.

- [ ] **Step 1: Run final tests and builds**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected:

```text
npm test exits 0 with 33 tests, 33 pass, 0 fail.
npm run typecheck exits 0.
npm run build exits 0.
git diff --check prints nothing.
```

- [ ] **Step 2: Verify changed-file scope**

Run:

```bash
git diff --name-only b7a3f1f9bf9f24d91dc61bec79f1ae0672b10fab..HEAD
```

Expected:

```text
App.tsx
docs/superpowers/baselines/2026-07-11-gate2-teaching-storyboard-sample-review.md
lib/teachingStoryboard.ts
tests/fixtures/teachingStoryboardFixtures.ts
tests/teachingStoryboard.test.ts
```

- [ ] **Step 3: Verify forbidden scopes are untouched**

Run:

```bash
git diff --exit-code b7a3f1f9bf9f24d91dc61bec79f1ae0672b10fab..HEAD -- \
  services/geminiService.ts \
  types.ts \
  components/Slide.tsx \
  lib/generationCache.ts \
  lib/k12GenerationRoutePolicy.ts \
  package.json \
  package-lock.json
```

Expected: no output, exit 0.

Run:

```bash
git diff --name-only b7a3f1f9bf9f24d91dc61bec79f1ae0672b10fab..HEAD -- \
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

- [ ] **Step 4: Verify no private artifacts or extracted private text were committed**

Run:

```bash
git diff --name-only --diff-filter=A b7a3f1f9bf9f24d91dc61bec79f1ae0672b10fab..HEAD | \
  rg -i '\\.(docx|pptx|pdf|png|jpe?g)$|Downloads|Word Docs|PPT|rendered|extracted'
```

Expected: no output and `rg` exit 1.

Run:

```bash
rg -n "Downloads|Word Docs|PPT/2026July|rendered reference|private source|teacher name|school name|private artifact title|private lesson title" \
  App.tsx lib tests docs/superpowers/baselines/2026-07-11-gate2-teaching-storyboard-sample-review.md
```

Expected: no output and `rg` exit 1.

- [ ] **Step 5: Verify clean worktree after commit**

Run:

```bash
git status --short --branch
git status --porcelain
```

Expected:

```text
## codex/gate2-source-bound-teaching-storyboard
```

and `git status --porcelain` prints nothing.

## Explicit Non-Goals

- No semantic slide schema.
- No visual system.
- No image behavior changes.
- No layout, renderer, or PPTX export changes.
- No model or provider swaps.
- No AI prompt changes.
- No generic lesson summary passed into the existing slide generator.
- No NotebookLM visual work.
- No storyboard-to-slide compiler.
- No generated presentation content changes beyond fail-closed source-primary storyboard validation.
- No deployment environment changes.
- No paid AI calls.
- No private DOCX/PPTX/PDF/images or extracted private lesson text committed.
- No push, deployment, or pull request without explicit authorization.

## Required Gate 2 Implementation Report

The implementer must return:

1. Worktree path, branch, base commit, and final commit hashes.
2. Files changed.
3. TeachingStoryboard contract implemented.
4. Sanitized fixtures added and what each proves.
5. Source-step accounting proof: total selected source steps, accounted steps, foreign step count, invented step count, and order inversion count.
6. Objective preservation proof: count, source order, `sourceObjectiveId`, and `unitId` ownership.
7. Teacher-script proof: visible violation count and note-retention proof.
8. Required evidence/output proof.
9. Exact `npm test` count and command output summary.
10. Typecheck and build outcomes.
11. Proof that prompt/model/image/layout/export files are unchanged.
12. Proof that no private artifacts or extracted private text were committed.
13. Deviations, unresolved risks, and assumptions.
14. This exact limitation: `Gate 2 creates and validates source-bound learner-facing storyboards; it does not yet create semantic slide schemas, visual systems, layouts, images, renderers, PPTX output, or NotebookLM-like visuals.`

## Risks and Open Questions for Review

- Gate 2 can produce a sanitized review baseline, but real teacher sign-off is a human review step outside automated tests unless a reviewer explicitly approves the sample report.
- The initial audience translation is deterministic and conservative. It prevents visible teacher-script wording and preserves source accounting, but it will not yet have the fluency of a model-assisted rewrite.
- `handleGenerateDailySlides()` maps `dayIndex` to `manifest.units[dayIndex]` for selected-unit storyboard validation. If later gates discover blueprint day ordering can diverge from manifest unit ordering, a deterministic blueprint-to-manifest unit mapping must be added before using storyboard content downstream.
- Required evidence/output extraction is keyword-based in Gate 2. It intentionally attaches source text rather than inventing concise artifacts when extraction is uncertain.
