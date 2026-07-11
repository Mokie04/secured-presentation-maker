# Gate 1 Format-Agnostic Source Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, format-agnostic `LessonSourceManifest` for uploaded K-12 lesson plans before any AI blueprint, storyboard, slide, image, layout, or export work happens.

**Architecture:** Gate 1 adds a source-contract layer between upload extraction and K-12 generation. The upload path keeps the existing legacy `dllContent` text channel, but source-primary uploads also produce a structured manifest with unit, objective, step, field-state, and diagnostic data. The manifest builder is pure and test-first; App integration only stores and validates the manifest before existing generation calls.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Mammoth DOCX-to-HTML, PDF.js text extraction, IndexedDB browser cache, and Node 26 `node:test` with `--experimental-strip-types`.

## Global Constraints

- Gate 1 only: format-agnostic source manifest before AI/storyboard work.
- Do not expand or refactor Gate 0.
- Uploaded lesson plans are authoritative.
- Lesson-plan formats are not hard-coded; 5E, 4A, MATATAG, traditional DLL/DLP, and teacher-defined formats are inputs, not internal schemas.
- Instructional flow is represented as ordered source-defined steps.
- Raw labels are retained as provenance but are not forced into visible slide titles.
- A missing phase is never inserted merely because a pedagogical template names it.
- Source defects and contradictions are preserved and surfaced for teacher review; they are not silently corrected.
- Ambiguous or unsupported extraction fails visibly instead of falling back to a generic topic deck.
- Invalid required content fails closed before cache write or delivery.
- Do not change AI prompts, text models, image providers, response schemas, slide rendering, layout, PPTX export, deployment environment, or paid AI behavior.
- Do not commit private DOCX, PPTX, PDF, extracted lesson text, rendered reference images, teacher names, learner data, or school-identifying content.
- Tests must use sanitized fixtures with equivalent structural properties and distinctive sentinels.
- Reuse the Gate 0 `resolveK12GenerationRoutePolicy` boundary: Gate 1 manifest blocking applies only to enabled `source-primary` uploaded routes; legacy and topic-only routes remain unchanged.

---

## Preconditions and Branch Safety

Run from the repository root before editing:

```bash
git status --short --branch
git rev-parse HEAD
test "$(git rev-parse HEAD)" = "f81dd66d7825503d9ab8c8a742c8c6b37d5f0251"
test -f docs/superpowers/specs/2026-07-11-source-aligned-editable-presentations-design.md
test -f docs/superpowers/plans/2026-07-11-gate1-format-agnostic-source-manifest.md
```

Expected:

```text
## codex/gate1-format-agnostic-source-manifest
f81dd66d7825503d9ab8c8a742c8c6b37d5f0251
```

If the worktree is dirty, the base commit differs, or the approved architecture document is missing, stop and report the exact state. Do not reset, stash, overwrite, or discard user work.

Use an isolated implementation branch named `codex/gate1-format-agnostic-source-manifest` from `f81dd66d7825503d9ab8c8a742c8c6b37d5f0251`. Do not implement on `codex/gate0-source-authority`. Do not push, deploy, or open a pull request without explicit authorization.

## Current Extraction Path

The current upload seam is `App.tsx`:

- `readFile()` accepts `.txt`, `.md`, `.pdf`, and `.docx`.
- DOCX uses `mammoth.convertToHtml()`, then `htmlToStructuredText()`.
- `htmlToStructuredText()` flattens tables into pipe rows and adds heuristic session-column blocks.
- PDF uses PDF.js `getTextContent()` and `extractStructuredPdfPageText()`.
- TXT and Markdown use `file.text()`.
- All formats eventually call `setDllContent(text)`.

The current K-12 generation seam is also `App.tsx`:

- `handleCreatePlan()` computes `content = dllContent.trim() || topicContext.trim()`.
- Gate 0 resolves `routePolicy` from `dllContent`.
- Weekly mode calls `createK12LessonBlueprint(content, DEFAULT_LESSON_FORMAT, generationLanguage)`.
- Single mode calls `generateK12SingleLessonSlides(content, DEFAULT_LESSON_FORMAT, generationLanguage, onProgressCallback)`.
- Per-unit generation calls `generateK12SlidesForDay(dayToGenerate, lessonBlueprint, content, DEFAULT_LESSON_FORMAT, generationLanguage)`.

The current service seam is `services/geminiService.ts`:

- `createK12LessonBlueprint()` asks the model to infer units and objectives from flattened text.
- `generateK12SlidesForDay()` calls `extractPlanUnitSourceBlock()` on flattened text after the model has already produced a blueprint.
- `extractPlanUnitSourceBlock()` uses marker and focus heuristics, and can fall back to truncated full-plan context.

**Smallest Gate 1 insertion point:** keep `dllContent` untouched for legacy compatibility, but create `LessonSourceManifest` at upload time from a structured source document and store it beside `dllContent`. Before source-primary K-12 generation, require a valid manifest and fail visibly if manifest construction failed or produced blocking diagnostics. Do not pass the manifest into AI prompts in Gate 1.

## Expected Implementation File Set

Expected files to change during Gate 1 implementation:

- Modify: `App.tsx`
- Create: `lib/lessonSourceManifest.ts`
- Create: `lib/lessonSourceDocument.ts`
- Create: `tests/fixtures/lessonSourceManifestFixtures.ts`
- Create: `tests/lessonSourceManifest.test.ts`

Files that must not change in Gate 1:

- `services/geminiService.ts`
- `types.ts`
- `components/Slide.tsx`
- `lib/generationCache.ts`
- image modules under `lib/`, `api/`, `scripts/`, and `public/curated-images/`
- PPTX/export/layout code in `App.tsx` outside the upload and K-12 pre-generation seams
- `package.json` and `package-lock.json`

## Contract Shape

Implement these types in `lib/lessonSourceManifest.ts`. Keep this module pure and dependency-free.

```ts
export const LESSON_SOURCE_MANIFEST_VERSION = 'lesson-source-manifest-v1';

export type SourceFieldState = 'present' | 'blank' | 'missing' | 'ambiguous';
export type SourceDocumentFormat = 'docx' | 'pdf' | 'txt' | 'md';
export type SourceDiagnosticSeverity = 'info' | 'warning' | 'blocking';

export type SourceDiagnosticCode =
  | 'source_parse_unsupported'
  | 'source_structure_ambiguous'
  | 'source_contract_invalid'
  | 'source_text_too_large'
  | 'source_tail_missing'
  | 'source_unit_missing_objective'
  | 'source_unit_duplicate_objective'
  | 'source_cross_unit_ownership';

export type SourceLocation = {
  blockId?: string;
  tableId?: string;
  rowIndex?: number;
  columnIndex?: number;
  pageNumber?: number;
};

export type SourceField = {
  id: string;
  label: string;
  value: string;
  state: SourceFieldState;
  sourceOrder: number;
  sourceLocation: SourceLocation;
};

export type SourceObjective = {
  id: string;
  unitId: string;
  sourceOrder: number;
  rawText: string;
  sourceLocation: SourceLocation;
};

export type SourceStep = {
  id: string;
  unitId: string;
  sourceOrder: number;
  sourceLabel: string;
  rawBlocks: string[];
  durationMinutes?: number;
  fieldState: SourceFieldState;
  sourceLocation: SourceLocation;
};

export type SourceUnit = {
  id: string;
  sourceOrdinal: number;
  sourceLabel: string;
  objectiveIds: string[];
  steps: SourceStep[];
  fields: Record<string, SourceField>;
};

export type SourceDiagnostic = {
  code: SourceDiagnosticCode;
  severity: SourceDiagnosticSeverity;
  message: string;
  sourceLocation?: SourceLocation;
};

export type LessonSourceManifest = {
  contractVersion: typeof LESSON_SOURCE_MANIFEST_VERSION;
  provenance: {
    origin: 'uploaded-file';
    format: SourceDocumentFormat;
    fileName: string;
    sourceHash: string;
    byteLength: number;
  };
  metadata: Record<string, SourceField>;
  objectives: SourceObjective[];
  units: SourceUnit[];
  diagnostics: SourceDiagnostic[];
};

export type LessonSourceManifestResult =
  | { ok: true; manifest: LessonSourceManifest }
  | { ok: false; diagnostics: SourceDiagnostic[] };
```

Implement these source-document types in `lib/lessonSourceDocument.ts`. This is the adapter boundary between browser extraction and pure manifest normalization.

```ts
import type { SourceDocumentFormat, SourceFieldState, SourceLocation } from './lessonSourceManifest';

export type SourceDocumentBlock = {
  id: string;
  kind: 'heading' | 'paragraph' | 'list-item' | 'page-marker';
  text: string;
  sourceOrder: number;
  sourceLocation: SourceLocation;
};

export type SourceTableCell = {
  text: string;
  state: Exclude<SourceFieldState, 'ambiguous'>;
  rowSpan: number;
  columnSpan: number;
  sourceLocation: SourceLocation;
};

export type SourceTableRow = {
  index: number;
  cells: SourceTableCell[];
};

export type SourceDocumentTable = {
  id: string;
  sourceOrder: number;
  rows: SourceTableRow[];
};

export type StructuredSourceDocument = {
  format: SourceDocumentFormat;
  fileName: string;
  sourceHash: string;
  byteLength: number;
  plainText: string;
  blocks: SourceDocumentBlock[];
  tables: SourceDocumentTable[];
  isScanned?: boolean;
};
```

## Parser Rules

### Unit Detection

- Prefer explicit table headers or block headings that name source units.
- Accept labels as data: `Session 1`, `Learning Session 1`, `Day 1`, `Araw 1`, `Lesson 1`, or custom labels with a monotonic ordinal.
- Do not require or inject 5E, 4A, MATATAG, DLL, or DLP phases.
- Unit IDs are assigned from source order, not text content: `unit-001`, `unit-002`, `unit-003`.
- Noncontiguous displayed numbers are allowed when source order is unambiguous: `Session 1`, `Session 3`, `Session 5` become `unit-001`, `unit-002`, `unit-003` while retaining labels.

### Objective Mapping

- Create one `SourceObjective` for each unit-specific objective cell or block.
- Objective IDs are assigned in source order: `obj-001`, `obj-002`, `obj-003`.
- Each unit must have exactly one unit-owned objective for Gate 1 pass.
- Shared competency, content standard, or performance standard rows are metadata or fields, not substitutes for unit-owned objectives.
- If an objective cell spans multiple units and cannot be deterministically split, return `source_structure_ambiguous` with severity `blocking`.
- If a unit has no objective, return `source_unit_missing_objective` with severity `blocking`.
- If a unit has two independent objective fields, return `source_unit_duplicate_objective` with severity `blocking`.

### Source-Step Rules

- Source steps are ordered source-defined instructional fields, not pedagogy-template phases.
- Use the visible row/heading label as `sourceLabel`.
- Use the cell or block text as `rawBlocks`.
- Preserve paragraph and list boundaries inside `rawBlocks`; do not join nested paragraphs into one sentence.
- Step IDs are stable and monotonic for one manifest build: `step-001`, `step-002`, `step-003`.
- `sourceOrder` is global and monotonic across the manifest.
- For table-oriented sources, source order is top-to-bottom by row, then left-to-right by unit column.
- For block-oriented sources, source order follows heading order and content order under each heading.
- Do not silently truncate a step. If a configured manifest limit would be exceeded, fail with `source_text_too_large`.

### Blank, Missing, and Ambiguous Field Handling

- `present`: a source cell/block exists and normalized text is non-empty.
- `blank`: a source cell exists but normalized text is empty; blank cells remain explicit fields and are not permission to invent content.
- `missing`: a row/field is absent for a unit after table span expansion or block parsing.
- `ambiguous`: ownership cannot be assigned to exactly one unit or an explicitly shared row.
- Shared cells with explicit `columnSpan` are attached to every covered unit with the same source location and `present` or `blank` state.
- Rows labeled as reflections, notes, assessment, assignment, resources, or output must preserve `blank` when cells are empty.
- `missing` is only used when the expected row/field is absent for that unit, not when a blank cell exists.

### Failure Behavior

- `source_parse_unsupported`: scanned PDF or uploaded file with no usable text or structure.
- `source_structure_ambiguous`: duplicate unit headers, unclear column ownership, unsplittable objective span, or overlapping table spans.
- `source_contract_invalid`: units exist but objective/step/field invariants fail.
- `source_text_too_large`: source exceeds configured manifest-preservation limits.
- Source-primary K-12 generation must stop before cache lookup, quota increment, reusable seeds, or AI calls when a blocking manifest diagnostic exists.
- Topic-only and legacy routes remain unchanged.
- Existing `dllContent` text remains available for legacy and current prompts; Gate 1 does not alter prompt contents.

---

### Task 1: Add Sanitized Manifest Fixtures and RED Tests

**Files:**
- Create: `tests/fixtures/lessonSourceManifestFixtures.ts`
- Create: `tests/lessonSourceManifest.test.ts`
- Create later in Task 2: `lib/lessonSourceManifest.ts`
- Create later in Task 2: `lib/lessonSourceDocument.ts`

**Interfaces:**
- Produces sanitized `StructuredSourceDocument` fixtures.
- Produces failing tests for `buildLessonSourceManifest()`, `formatSourceManifestDiagnostics()`, and `hasBlockingSourceDiagnostics()`.

- [ ] **Step 1: Create sanitized fixtures**

Create `tests/fixtures/lessonSourceManifestFixtures.ts`:

```ts
import type { StructuredSourceDocument } from '../../lib/lessonSourceDocument.ts';

const location = (tableId: string, rowIndex: number, columnIndex: number) => ({
  tableId,
  rowIndex,
  columnIndex,
});

const cell = (
  tableId: string,
  rowIndex: number,
  columnIndex: number,
  text: string,
  columnSpan = 1,
) => ({
  text,
  state: text.trim() ? 'present' as const : 'blank' as const,
  rowSpan: 1,
  columnSpan,
  sourceLocation: location(tableId, rowIndex, columnIndex),
});

export const FIVE_SESSION_MATRIX_DOCUMENT: StructuredSourceDocument = {
  format: 'docx',
  fileName: 'sanitized-five-session-matrix.docx',
  sourceHash: 'fixture-five-session-source-hash',
  byteLength: 12000,
  plainText: [
    'Grade 9 Science sanitized source',
    'Session 1 objective sentinel S1-OBJ-CIRCUIT-A',
    'Session 5 tail sentinel S5-EVALUATE-TAIL-OMEGA',
  ].join('\n'),
  blocks: [],
  tables: [
    {
      id: 'table-001',
      sourceOrder: 1,
      rows: [
        {
          index: 0,
          cells: [
            cell('table-001', 0, 0, 'Field'),
            cell('table-001', 0, 1, 'Learning Session 1'),
            cell('table-001', 0, 2, 'Learning Session 2'),
            cell('table-001', 0, 3, 'Learning Session 3'),
            cell('table-001', 0, 4, 'Learning Session 4'),
            cell('table-001', 0, 5, 'Learning Session 5'),
          ],
        },
        {
          index: 1,
          cells: [
            cell('table-001', 1, 0, 'Objective'),
            cell('table-001', 1, 1, 'S1-OBJ-CIRCUIT-A Compare current observations in one path.'),
            cell('table-001', 1, 2, 'S2-OBJ-CIRCUIT-B Explain voltage evidence across components.'),
            cell('table-001', 1, 3, 'S3-OBJ-CIRCUIT-C Model resistance changes with evidence.'),
            cell('table-001', 1, 4, 'S4-OBJ-CIRCUIT-D Predict behavior in a changed setup.'),
            cell('table-001', 1, 5, 'S5-OBJ-CIRCUIT-E Defend a conclusion using measurements.'),
          ],
        },
        {
          index: 2,
          cells: [
            cell('table-001', 2, 0, 'Shared materials'),
            cell('table-001', 2, 1, 'Shared safe battery pack and meter kit.', 5),
          ],
        },
        {
          index: 3,
          cells: [
            cell('table-001', 3, 0, 'Engage - 5 min'),
            cell('table-001', 3, 1, 'S1-ENGAGE-WARMUP Ask which bulb changes first.'),
            cell('table-001', 3, 2, 'S2-ENGAGE-WARMUP Compare two meter readings.'),
            cell('table-001', 3, 3, 'S3-ENGAGE-WARMUP Sort resistance claim cards.'),
            cell('table-001', 3, 4, 'S4-ENGAGE-WARMUP Predict the changed setup.'),
            cell('table-001', 3, 5, 'S5-ENGAGE-WARMUP Choose strongest evidence.'),
          ],
        },
        {
          index: 4,
          cells: [
            cell('table-001', 4, 0, 'Explore - 12 min'),
            cell('table-001', 4, 1, 'S1-EXPLORE-MEASURE Build one path and record two readings.'),
            cell('table-001', 4, 2, 'S2-EXPLORE-MEASURE Test component positions with a data table.'),
            cell('table-001', 4, 3, 'S3-EXPLORE-MEASURE Change one resistor and keep a claim log.'),
            cell('table-001', 4, 4, 'S4-EXPLORE-MEASURE Revise prediction after a new card.'),
            cell('table-001', 4, 5, 'S5-EXPLORE-MEASURE Audit a peer evidence trail.'),
          ],
        },
        {
          index: 5,
          cells: [
            cell('table-001', 5, 0, 'Explain - 10 min'),
            cell('table-001', 5, 1, 'S1-EXPLAIN-RELATE Connect the reading to one-path flow.'),
            cell('table-001', 5, 2, 'S2-EXPLAIN-RELATE Use the evidence sentence frame.'),
            cell('table-001', 5, 3, 'S3-EXPLAIN-RELATE Explain resistance as a changed condition.'),
            cell('table-001', 5, 4, 'S4-EXPLAIN-RELATE Explain the changed setup result.'),
            cell('table-001', 5, 5, 'S5-EXPLAIN-RELATE Present the defended conclusion.'),
          ],
        },
        {
          index: 6,
          cells: [
            cell('table-001', 6, 0, 'Elaborate - 10 min'),
            cell('table-001', 6, 1, 'S1-ELABORATE-TRANSFER Apply the rule to a new path.'),
            cell('table-001', 6, 2, 'S2-ELABORATE-TRANSFER Compare the alternate arrangement.'),
            cell('table-001', 6, 3, 'S3-ELABORATE-TRANSFER Design one fair-change test.'),
            cell('table-001', 6, 4, 'S4-ELABORATE-TRANSFER Explain a troubleshooting case.'),
            cell('table-001', 6, 5, 'S5-ELABORATE-TRANSFER Revise the evidence board.'),
          ],
        },
        {
          index: 7,
          cells: [
            cell('table-001', 7, 0, 'Evaluate - 8 min'),
            cell('table-001', 7, 1, 'S1-EVALUATE-EXIT Submit one claim and one reading.'),
            cell('table-001', 7, 2, 'S2-EVALUATE-EXIT Submit the comparison ticket.'),
            cell('table-001', 7, 3, 'S3-EVALUATE-EXIT Submit the resistance explanation.'),
            cell('table-001', 7, 4, 'S4-EVALUATE-EXIT Submit the prediction revision.'),
            cell('table-001', 7, 5, 'S5-EVALUATE-TAIL-OMEGA Submit the defended conclusion and tail sentinel.'),
          ],
        },
        {
          index: 8,
          cells: [
            cell('table-001', 8, 0, 'Reflection'),
            cell('table-001', 8, 1, ''),
            cell('table-001', 8, 2, ''),
            cell('table-001', 8, 3, ''),
            cell('table-001', 8, 4, ''),
            cell('table-001', 8, 5, ''),
          ],
        },
      ],
    },
  ],
};

export const FOUR_A_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-4a.txt',
  sourceHash: 'fixture-four-a-source-hash',
  byteLength: 4000,
  plainText: '',
  blocks: [
    { id: 'b001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'b001' } },
    { id: 'b002', kind: 'paragraph', text: 'Objective: D1-OBJ-A Identify the claim in a short scenario.', sourceOrder: 2, sourceLocation: { blockId: 'b002' } },
    { id: 'b003', kind: 'paragraph', text: 'Activity: D1-ACTIVITY-A Match claim cards to evidence cards.', sourceOrder: 3, sourceLocation: { blockId: 'b003' } },
    { id: 'b004', kind: 'paragraph', text: 'Analysis: D1-ANALYSIS-A Explain why one evidence card fits.', sourceOrder: 4, sourceLocation: { blockId: 'b004' } },
    { id: 'b005', kind: 'paragraph', text: 'Abstraction: D1-ABSTRACTION-A State the rule for evidence fit.', sourceOrder: 5, sourceLocation: { blockId: 'b005' } },
    { id: 'b006', kind: 'paragraph', text: 'Application: D1-APPLICATION-A Apply the rule to a new scenario.', sourceOrder: 6, sourceLocation: { blockId: 'b006' } },
    { id: 'b007', kind: 'heading', text: 'Day 2', sourceOrder: 7, sourceLocation: { blockId: 'b007' } },
    { id: 'b008', kind: 'paragraph', text: 'Objective: D2-OBJ-B Build a claim with matching evidence.', sourceOrder: 8, sourceLocation: { blockId: 'b008' } },
    { id: 'b009', kind: 'paragraph', text: 'Launch: D2-LAUNCH-B Compare two draft answers.', sourceOrder: 9, sourceLocation: { blockId: 'b009' } },
    { id: 'b010', kind: 'paragraph', text: 'Practice: D2-PRACTICE-B Revise the claim with a partner.', sourceOrder: 10, sourceLocation: { blockId: 'b010' } },
  ],
  tables: [],
};

export const MISSING_AND_BLANK_DOCUMENT: StructuredSourceDocument = {
  ...FIVE_SESSION_MATRIX_DOCUMENT,
  sourceHash: 'fixture-missing-blank-source-hash',
  tables: [
    {
      ...FIVE_SESSION_MATRIX_DOCUMENT.tables[0],
      rows: FIVE_SESSION_MATRIX_DOCUMENT.tables[0].rows.map((row) => {
        if (row.index !== 8) return row;
        return {
          ...row,
          cells: [
            cell('table-001', 8, 0, 'Reflection'),
            cell('table-001', 8, 1, ''),
            cell('table-001', 8, 2, 'S2-REFLECTION-PRESENT Teacher records reteach note.'),
            cell('table-001', 8, 3, ''),
            cell('table-001', 8, 4, ''),
          ],
        };
      }),
    },
  ],
};

export const AMBIGUOUS_OBJECTIVE_DOCUMENT: StructuredSourceDocument = {
  ...FIVE_SESSION_MATRIX_DOCUMENT,
  sourceHash: 'fixture-ambiguous-objective-source-hash',
  tables: [
    {
      ...FIVE_SESSION_MATRIX_DOCUMENT.tables[0],
      rows: FIVE_SESSION_MATRIX_DOCUMENT.tables[0].rows.map((row) => {
        if (row.index !== 1) return row;
        return {
          ...row,
          cells: [
            cell('table-001', 1, 0, 'Objective'),
            cell('table-001', 1, 1, 'One broad objective spans several sessions without split.', 5),
          ],
        };
      }),
    },
  ],
};

export const UNSUPPORTED_SCANNED_DOCUMENT: StructuredSourceDocument = {
  format: 'pdf',
  fileName: 'sanitized-scanned.pdf',
  sourceHash: 'fixture-scanned-source-hash',
  byteLength: 8000,
  plainText: '',
  blocks: [],
  tables: [],
  isScanned: true,
};
```

- [ ] **Step 2: Write the failing manifest tests**

Create `tests/lessonSourceManifest.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLessonSourceManifest,
  formatSourceManifestDiagnostics,
  hasBlockingSourceDiagnostics,
} from '../lib/lessonSourceManifest.ts';
import {
  AMBIGUOUS_OBJECTIVE_DOCUMENT,
  FIVE_SESSION_MATRIX_DOCUMENT,
  FOUR_A_DOCUMENT,
  MISSING_AND_BLANK_DOCUMENT,
  UNSUPPORTED_SCANNED_DOCUMENT,
} from './fixtures/lessonSourceManifestFixtures.ts';

test('builds a five-session manifest with one objective per source unit', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.contractVersion, 'lesson-source-manifest-v1');
  assert.equal(result.manifest.provenance.origin, 'uploaded-file');
  assert.equal(result.manifest.provenance.format, 'docx');
  assert.deepEqual(
    result.manifest.units.map((unit) => unit.sourceLabel),
    ['Learning Session 1', 'Learning Session 2', 'Learning Session 3', 'Learning Session 4', 'Learning Session 5'],
  );
  assert.equal(result.manifest.objectives.length, 5);
  assert.deepEqual(
    result.manifest.units.map((unit) => unit.objectiveIds.length),
    [1, 1, 1, 1, 1],
  );
  assert.match(result.manifest.objectives[0].rawText, /S1-OBJ-CIRCUIT-A/);
  assert.match(result.manifest.objectives[4].rawText, /S5-OBJ-CIRCUIT-E/);
});

test('keeps 5E labels as source data while assigning monotonic step ids', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const allSteps = result.manifest.units.flatMap((unit) => unit.steps);
  assert.equal(allSteps[0].id, 'step-001');
  assert.equal(allSteps[allSteps.length - 1].id, `step-${String(allSteps.length).padStart(3, '0')}`);
  assert.deepEqual(
    allSteps.slice(0, 5).map((step) => step.sourceLabel),
    ['Engage - 5 min', 'Engage - 5 min', 'Engage - 5 min', 'Engage - 5 min', 'Engage - 5 min'],
  );
  assert.match(allSteps[0].rawBlocks.join('\n'), /S1-ENGAGE-WARMUP/);
  assert.match(allSteps[allSteps.length - 1].rawBlocks.join('\n'), /S5-EVALUATE-TAIL-OMEGA/);
});

test('does not require a 5E schema for block-oriented 4A or custom labels', () => {
  const result = buildLessonSourceManifest(FOUR_A_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.manifest.units.map((unit) => unit.sourceLabel), ['Day 1', 'Day 2']);
  assert.deepEqual(result.manifest.units.map((unit) => unit.objectiveIds.length), [1, 1]);
  assert.deepEqual(
    result.manifest.units[0].steps.map((step) => step.sourceLabel),
    ['Activity', 'Analysis', 'Abstraction', 'Application'],
  );
  assert.deepEqual(
    result.manifest.units[1].steps.map((step) => step.sourceLabel),
    ['Launch', 'Practice'],
  );
});

test('attaches explicit shared colspan fields to every covered unit', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  for (const unit of result.manifest.units) {
    assert.equal(unit.fields.sharedMaterials.state, 'present');
    assert.match(unit.fields.sharedMaterials.value, /Shared safe battery pack/);
    assert.equal(unit.fields.sharedMaterials.sourceLocation.rowIndex, 2);
  }
});

test('distinguishes blank cells from missing cells', () => {
  const result = buildLessonSourceManifest(MISSING_AND_BLANK_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.manifest.units[0].fields.reflection.state, 'blank');
  assert.equal(result.manifest.units[1].fields.reflection.state, 'present');
  assert.equal(result.manifest.units[4].fields.reflection.state, 'missing');
});

test('rejects ambiguous objective ownership visibly', () => {
  const result = buildLessonSourceManifest(AMBIGUOUS_OBJECTIVE_DOCUMENT);

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(hasBlockingSourceDiagnostics(result.diagnostics), true);
  assert.equal(result.diagnostics[0].code, 'source_structure_ambiguous');
  assert.match(formatSourceManifestDiagnostics(result.diagnostics), /objective/i);
});

test('rejects unsupported scanned input visibly', () => {
  const result = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.diagnostics[0].code, 'source_parse_unsupported');
  assert.equal(result.diagnostics[0].severity, 'blocking');
});

test('preserves the source tail sentinel instead of silently truncating', () => {
  const result = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const allText = result.manifest.units
    .flatMap((unit) => unit.steps)
    .flatMap((step) => step.rawBlocks)
    .join('\n');
  assert.match(allText, /S5-EVALUATE-TAIL-OMEGA/);
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
npm test
```

Expected result:

```text
ERR_MODULE_NOT_FOUND for lib/lessonSourceManifest.ts
```

If the failure is a syntax error in the fixture or an unrelated existing test failure, fix the test file before implementing production code.

- [ ] **Step 4: Commit RED test slice**

Do not commit this slice by itself. Keep it as the TDD red state, then proceed directly to Task 2 and commit tests with implementation.

---

### Task 2: Implement Pure Manifest Builder and Validator

**Files:**
- Create: `lib/lessonSourceManifest.ts`
- Create: `lib/lessonSourceDocument.ts`
- Modify: `tests/lessonSourceManifest.test.ts`
- Modify: `tests/fixtures/lessonSourceManifestFixtures.ts`

**Interfaces:**
- Consumes: `StructuredSourceDocument` from `lib/lessonSourceDocument.ts`.
- Produces: `buildLessonSourceManifest(document: StructuredSourceDocument): LessonSourceManifestResult`.
- Produces: `hasBlockingSourceDiagnostics(diagnostics: SourceDiagnostic[]): boolean`.
- Produces: `formatSourceManifestDiagnostics(diagnostics: SourceDiagnostic[]): string`.

- [ ] **Step 1: Add source document types**

Create `lib/lessonSourceDocument.ts` with the exact `StructuredSourceDocument`, `SourceDocumentBlock`, `SourceDocumentTable`, `SourceTableRow`, and `SourceTableCell` types from the Contract Shape section.

- [ ] **Step 2: Add manifest builder skeleton**

Create `lib/lessonSourceManifest.ts` with:

```ts
import type {
  SourceDocumentBlock,
  SourceDocumentTable,
  SourceTableCell,
  StructuredSourceDocument,
} from './lessonSourceDocument';

export const LESSON_SOURCE_MANIFEST_VERSION = 'lesson-source-manifest-v1';

export type SourceFieldState = 'present' | 'blank' | 'missing' | 'ambiguous';
export type SourceDocumentFormat = 'docx' | 'pdf' | 'txt' | 'md';
export type SourceDiagnosticSeverity = 'info' | 'warning' | 'blocking';
export type SourceDiagnosticCode =
  | 'source_parse_unsupported'
  | 'source_structure_ambiguous'
  | 'source_contract_invalid'
  | 'source_text_too_large'
  | 'source_tail_missing'
  | 'source_unit_missing_objective'
  | 'source_unit_duplicate_objective'
  | 'source_cross_unit_ownership';

export type SourceLocation = {
  blockId?: string;
  tableId?: string;
  rowIndex?: number;
  columnIndex?: number;
  pageNumber?: number;
};

export type SourceField = {
  id: string;
  label: string;
  value: string;
  state: SourceFieldState;
  sourceOrder: number;
  sourceLocation: SourceLocation;
};

export type SourceObjective = {
  id: string;
  unitId: string;
  sourceOrder: number;
  rawText: string;
  sourceLocation: SourceLocation;
};

export type SourceStep = {
  id: string;
  unitId: string;
  sourceOrder: number;
  sourceLabel: string;
  rawBlocks: string[];
  durationMinutes?: number;
  fieldState: SourceFieldState;
  sourceLocation: SourceLocation;
};

export type SourceUnit = {
  id: string;
  sourceOrdinal: number;
  sourceLabel: string;
  objectiveIds: string[];
  steps: SourceStep[];
  fields: Record<string, SourceField>;
};

export type SourceDiagnostic = {
  code: SourceDiagnosticCode;
  severity: SourceDiagnosticSeverity;
  message: string;
  sourceLocation?: SourceLocation;
};

export type LessonSourceManifest = {
  contractVersion: typeof LESSON_SOURCE_MANIFEST_VERSION;
  provenance: {
    origin: 'uploaded-file';
    format: SourceDocumentFormat;
    fileName: string;
    sourceHash: string;
    byteLength: number;
  };
  metadata: Record<string, SourceField>;
  objectives: SourceObjective[];
  units: SourceUnit[];
  diagnostics: SourceDiagnostic[];
};

export type LessonSourceManifestResult =
  | { ok: true; manifest: LessonSourceManifest }
  | { ok: false; diagnostics: SourceDiagnostic[] };

export const hasBlockingSourceDiagnostics = (diagnostics: SourceDiagnostic[]): boolean => (
  diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
);

export const formatSourceManifestDiagnostics = (diagnostics: SourceDiagnostic[]): string => {
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  const selected = blocking.length > 0 ? blocking : diagnostics;
  return selected.map((diagnostic) => diagnostic.message).join(' ');
};

export const buildLessonSourceManifest = (
  document: StructuredSourceDocument,
): LessonSourceManifestResult => {
  if (document.isScanned || !document.plainText.trim() && document.blocks.length === 0 && document.tables.length === 0) {
    return {
      ok: false,
      diagnostics: [{
        code: 'source_parse_unsupported',
        severity: 'blocking',
        message: 'The uploaded source does not contain extractable lesson text.',
      }],
    };
  }

  const tableManifest = buildManifestFromTables(document);
  if (tableManifest) return tableManifest;
  return buildManifestFromBlocks(document);
};
```

Use helper functions below this skeleton. Keep all helpers in this module until a real second consumer exists.

- [ ] **Step 3: Implement table normalization**

Implementation requirements:

- Expand `columnSpan` and `rowSpan` into an ownership grid.
- Detect unit columns from the first row that has at least two unit-like labels.
- Treat column 0 as field-label column in table fixtures.
- Convert labels to field keys with a local `toFieldKey()` helper, for example `Shared materials` -> `sharedMaterials`.
- For every data row after unit header:
  - objective rows create `SourceObjective`.
  - instructional rows create `SourceStep`.
  - non-step field rows create `SourceField` in each unit.
- Rows named `shared materials`, `resources`, `learning resources`, `content standard`, `performance standard`, and `competency` are fields, not steps.
- Rows named `reflection`, `assignment`, `assessment`, `evaluate`, `output`, and custom labels can be steps or fields based on cell content and position; do not inject phases.
- Blank cells produce `SourceField` or `SourceStep` with `fieldState: 'blank'` when the cell exists.
- Absent cells after expansion produce `SourceField` with `state: 'missing'` for expected field rows.

- [ ] **Step 4: Implement block normalization**

Implementation requirements:

- A heading matching a unit marker starts a new unit.
- A paragraph beginning with `Objective:` creates a unit objective.
- Other `Label: value` paragraphs create source steps under the current unit.
- Preserve labels as source data.
- Do not require 4A labels; labels are accepted because they are source-defined.
- If content appears before the first unit heading, record it as `metadata` unless it contains objective or step-like content with no owner, which is `source_structure_ambiguous`.

- [ ] **Step 5: Implement invariant validation**

Validation requirements:

- At least one unit.
- Every unit has exactly one objective.
- Every unit has at least one non-objective source step.
- Objective IDs referenced by units exist in `manifest.objectives`.
- `sourceOrder` values in objectives and steps are strictly increasing.
- Step IDs are monotonic and gapless.
- If document `plainText` contains `TAIL` or `OMEGA`, the same sentinel must appear in objective or step text; otherwise return `source_tail_missing`.
- No source step may contain another unit's sentinel when the sentinel follows the pattern `S<number>-`.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run:

```bash
npm test
```

Expected result:

```text
tests 16
pass 16
fail 0
```

The exact count is 8 existing Gate 0 tests plus 8 new Gate 1 tests.

- [ ] **Step 7: Run typecheck and diff check**

Run:

```bash
npm run typecheck
git diff --check
```

Expected:

```text
tsc --noEmit
```

`git diff --check` prints nothing and exits 0.

- [ ] **Step 8: Commit pure manifest slice**

```bash
git add lib/lessonSourceDocument.ts lib/lessonSourceManifest.ts tests/fixtures/lessonSourceManifestFixtures.ts tests/lessonSourceManifest.test.ts
git commit -m "feat: add lesson source manifest contract"
```

---

### Task 3: Add Upload Adapters Without Changing Generation Prompts

**Files:**
- Modify: `App.tsx`
- Modify: `lib/lessonSourceDocument.ts`
- Test: `tests/lessonSourceManifest.test.ts`

**Interfaces:**
- Consumes: browser-extracted DOCX HTML, PDF page text rows, and plain text.
- Produces: `StructuredSourceDocument`.
- Produces: `buildUploadedSourceDocument(input): Promise<StructuredSourceDocument>` or small format-specific helpers used by `App.tsx`.

- [ ] **Step 1: Add adapter tests for plain text and table cell states**

Append tests to `tests/lessonSourceManifest.test.ts`:

```ts
import {
  buildPlainTextSourceDocument,
  buildTableSourceDocument,
} from '../lib/lessonSourceDocument.ts';

test('builds a block source document from plain text without inventing units', () => {
  const document = buildPlainTextSourceDocument({
    format: 'md',
    fileName: 'custom-sequence.md',
    sourceHash: 'plain-hash',
    byteLength: 900,
    text: [
      '# Lesson Sequence',
      'Custom Unit 1',
      'Objective: CU1-OBJ Explain one pattern.',
      'Launch: CU1-LAUNCH Inspect the first card.',
      'Build: CU1-BUILD Arrange the evidence cards.',
      'Custom Unit 2',
      'Objective: CU2-OBJ Defend one pattern.',
      'Critique: CU2-CRITIQUE Improve the evidence claim.',
    ].join('\n'),
  });

  assert.equal(document.blocks.length, 8);
  assert.equal(document.tables.length, 0);
  assert.equal(document.blocks[1].kind, 'heading');
  assert.equal(document.blocks[2].kind, 'paragraph');
});

test('builds a table source document preserving blank and missing cells', () => {
  const document = buildTableSourceDocument({
    format: 'docx',
    fileName: 'table.docx',
    sourceHash: 'table-hash',
    byteLength: 1000,
    rows: [
      ['Field', 'Session 1', 'Session 2'],
      ['Objective', 'OBJ-1', 'OBJ-2'],
      ['Reflection', '', undefined],
    ],
  });

  assert.equal(document.tables[0].rows[2].cells[1].state, 'blank');
  assert.equal(document.tables[0].rows[2].cells.length, 2);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test
```

Expected result:

```text
ReferenceError: buildPlainTextSourceDocument is not defined
```

or an import failure for the new adapter functions.

- [ ] **Step 3: Implement plain text and table adapter helpers**

Add these exports in `lib/lessonSourceDocument.ts`:

```ts
export type BuildPlainTextSourceDocumentInput = {
  format: SourceDocumentFormat;
  fileName: string;
  sourceHash: string;
  byteLength: number;
  text: string;
};

export type BuildTableSourceDocumentInput = {
  format: SourceDocumentFormat;
  fileName: string;
  sourceHash: string;
  byteLength: number;
  rows: Array<Array<string | undefined>>;
};

export const buildPlainTextSourceDocument = (
  input: BuildPlainTextSourceDocumentInput,
): StructuredSourceDocument => {
  const lines = input.text.split(/\r?\n/);
  const blocks = lines
    .map((line, index): SourceDocumentBlock | null => {
      const text = line.trim();
      if (!text) return null;
      const id = `block-${String(index + 1).padStart(3, '0')}`;
      const isHeading = /^#{1,6}\s+/.test(text)
        || /^(?:learning\s+session|session|day|araw|custom\s+unit|lesson)\s+\d+\b/i.test(text);
      return {
        id,
        kind: isHeading ? 'heading' : 'paragraph',
        text: text.replace(/^#{1,6}\s+/, ''),
        sourceOrder: index + 1,
        sourceLocation: { blockId: id },
      };
    })
    .filter((block): block is SourceDocumentBlock => Boolean(block));

  return {
    format: input.format,
    fileName: input.fileName,
    sourceHash: input.sourceHash,
    byteLength: input.byteLength,
    plainText: input.text,
    blocks,
    tables: [],
  };
};

export const buildTableSourceDocument = (
  input: BuildTableSourceDocumentInput,
): StructuredSourceDocument => {
  const tableId = 'table-001';
  const rows = input.rows.map((row, rowIndex): SourceTableRow => ({
    index: rowIndex,
    cells: row.flatMap((value, columnIndex): SourceTableCell[] => {
      if (value === undefined) return [];
      return [{
        text: value,
        state: value.trim() ? 'present' : 'blank',
        rowSpan: 1,
        columnSpan: 1,
        sourceLocation: { tableId, rowIndex, columnIndex },
      }];
    }),
  }));

  return {
    format: input.format,
    fileName: input.fileName,
    sourceHash: input.sourceHash,
    byteLength: input.byteLength,
    plainText: input.rows.map((row) => row.filter((value): value is string => value !== undefined).join(' ')).join('\n'),
    blocks: [],
    tables: [{ id: tableId, sourceOrder: 1, rows }],
  };
};
```

- [ ] **Step 4: Add browser HTML/PDF adapter notes in code comments only where needed**

When integrating with `App.tsx`, use the existing browser DOM extraction result to build `StructuredSourceDocument`:

- DOCX: convert Mammoth HTML tables to `SourceDocumentTable` while preserving cell text, `colSpan`, `rowSpan`, and blank cells.
- PDF: create a plain-text document with page-marker blocks and visible text rows. If PDF text is empty, return `isScanned: true`.
- TXT/MD: create a plain-text document with heading/paragraph blocks.

Do not add a dependency such as `jsdom`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test
npm run typecheck
git diff --check
```

Expected:

```text
tests 18
pass 18
fail 0
```

- [ ] **Step 6: Commit adapter slice**

```bash
git add lib/lessonSourceDocument.ts tests/lessonSourceManifest.test.ts
git commit -m "feat: add source document adapters"
```

---

### Task 4: Wire Manifest Validation Into the Upload Boundary

**Files:**
- Modify: `App.tsx`
- Modify: `lib/lessonSourceManifest.ts`
- Test: `tests/lessonSourceManifest.test.ts`

**Interfaces:**
- Consumes: `resolveK12GenerationRoutePolicy(dllContent, SOURCE_PRIMARY_ROUTING_V1_FLAG)`.
- Consumes: `LessonSourceManifestResult`.
- Produces: source-primary preflight behavior that blocks generation before cache lookup and quota increment when the manifest is invalid.

- [ ] **Step 1: Add pure route-boundary tests**

Append to `tests/lessonSourceManifest.test.ts`:

```ts
import {
  resolveSourceManifestForGeneration,
} from '../lib/lessonSourceManifest.ts';
import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';

test('requires a valid manifest for enabled source-primary routes', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const manifestResult = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  const boundary = resolveSourceManifestForGeneration(policy, manifestResult);

  assert.equal(boundary.ok, false);
  if (boundary.ok) return;
  assert.match(boundary.message, /extractable lesson text/i);
});

test('does not require a manifest for topic-only legacy routes', () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  const manifestResult = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  const boundary = resolveSourceManifestForGeneration(policy, manifestResult);

  assert.deepEqual(boundary, { ok: true, manifest: null });
});

test('does not require a manifest when source-primary routing is disabled', () => {
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'false');
  const manifestResult = buildLessonSourceManifest(UNSUPPORTED_SCANNED_DOCUMENT);

  const boundary = resolveSourceManifestForGeneration(policy, manifestResult);

  assert.deepEqual(boundary, { ok: true, manifest: null });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test
```

Expected result:

```text
SyntaxError: The requested module '../lib/lessonSourceManifest.ts' does not provide an export named 'resolveSourceManifestForGeneration'
```

- [ ] **Step 3: Implement route-boundary helper**

Add to `lib/lessonSourceManifest.ts`:

```ts
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy';

export type SourceManifestGenerationBoundary =
  | { ok: true; manifest: LessonSourceManifest | null }
  | { ok: false; message: string; diagnostics: SourceDiagnostic[] };

export const resolveSourceManifestForGeneration = (
  policy: Pick<K12GenerationRoutePolicy, 'mode' | 'inputOrigin'>,
  manifestResult: LessonSourceManifestResult | null,
): SourceManifestGenerationBoundary => {
  if (policy.mode !== 'source-primary' || policy.inputOrigin !== 'uploaded-file') {
    return { ok: true, manifest: null };
  }

  if (!manifestResult) {
    const diagnostics: SourceDiagnostic[] = [{
      code: 'source_contract_invalid',
      severity: 'blocking',
      message: 'The uploaded source was not converted into a lesson source manifest.',
    }];
    return { ok: false, message: formatSourceManifestDiagnostics(diagnostics), diagnostics };
  }

  if (!manifestResult.ok) {
    return {
      ok: false,
      message: formatSourceManifestDiagnostics(manifestResult.diagnostics),
      diagnostics: manifestResult.diagnostics,
    };
  }

  const blockingDiagnostics = manifestResult.manifest.diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking');
  if (blockingDiagnostics.length > 0) {
    return {
      ok: false,
      message: formatSourceManifestDiagnostics(blockingDiagnostics),
      diagnostics: blockingDiagnostics,
    };
  }

  return { ok: true, manifest: manifestResult.manifest };
};
```

- [ ] **Step 4: Integrate in `App.tsx` with minimal state**

Implementation requirements:

- Add state:

```ts
const [lessonSourceManifestResult, setLessonSourceManifestResult] = useState<LessonSourceManifestResult | null>(null);
```

- Clear manifest state in reset paths:

```ts
setLessonSourceManifestResult(null);
```

- In `readFile()`, after format extraction produces text and structured document data:

```ts
const manifestResult = buildLessonSourceManifest(sourceDocument);
setLessonSourceManifestResult(manifestResult);
```

- If source extraction produces no text:
  - For source-primary enabled routes, do not use `getKnownScannedPdfFallbackText()`.
  - Return a visible `source_parse_unsupported` message.
  - Legacy routes may continue current behavior.

- In the `teachingLevel === 'K-12'` branch of `handleCreatePlan()`, immediately after `routePolicy` is resolved and before cache-key construction:

```ts
const sourceManifestBoundary = resolveSourceManifestForGeneration(
  routePolicy,
  lessonSourceManifestResult,
);
if (!sourceManifestBoundary.ok) {
  setError(sourceManifestBoundary.message);
  setIsLoading(false);
  return;
}
```

- In `handleGenerateDailySlides()`, repeat the same preflight immediately after resolving `routePolicy` and before cache-key construction.
- Do not pass `sourceManifestBoundary.manifest` to `createK12LessonBlueprint()`, `generateK12SingleLessonSlides()`, or `generateK12SlidesForDay()` in Gate 1.
- Do not modify prompt text.
- Do not modify cache-key arrays in this task.

- [ ] **Step 5: Run verification**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
git diff -- services/geminiService.ts types.ts components/Slide.tsx lib/generationCache.ts
```

Expected:

```text
tests 21
pass 21
fail 0
```

The final forbidden-file `git diff -- services/geminiService.ts types.ts components/Slide.tsx lib/generationCache.ts` command prints nothing.

- [ ] **Step 6: Commit upload-boundary slice**

```bash
git add App.tsx lib/lessonSourceManifest.ts tests/lessonSourceManifest.test.ts
git commit -m "fix: require source manifests for uploaded K-12 sources"
```

---

### Task 5: Gate 1 Privacy and Release-Gate Verification

**Files:** No new changes expected.

- [ ] **Step 1: Verify final test suite**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected:

```text
npm test exits 0 with 21 tests, 21 pass, 0 fail.
npm run typecheck exits 0.
npm run build exits 0.
git diff --check prints nothing.
```

- [ ] **Step 2: Verify changed-file scope**

Run:

```bash
git diff --name-only f81dd66d7825503d9ab8c8a742c8c6b37d5f0251..HEAD
```

Expected:

```text
App.tsx
lib/lessonSourceDocument.ts
lib/lessonSourceManifest.ts
tests/fixtures/lessonSourceManifestFixtures.ts
tests/lessonSourceManifest.test.ts
```

- [ ] **Step 3: Verify forbidden scopes are untouched**

Run:

```bash
git diff --exit-code f81dd66d7825503d9ab8c8a742c8c6b37d5f0251..HEAD -- \
  services/geminiService.ts \
  types.ts \
  components/Slide.tsx \
  lib/generationCache.ts \
  package.json \
  package-lock.json
```

Expected: no output, exit 0.

Run:

```bash
git diff --name-only f81dd66d7825503d9ab8c8a742c8c6b37d5f0251..HEAD -- \
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
git diff --name-only --diff-filter=A f81dd66d7825503d9ab8c8a742c8c6b37d5f0251..HEAD | \
  rg -i '\\.(docx|pptx|pdf|png|jpe?g)$|Downloads|Word Docs|PPT|rendered|extracted'
```

Expected: no output and `rg` exit 1.

Run:

```bash
rg -n "Downloads|Word Docs|PPT/2026July|\\.docx|\\.pptx|rendered reference|private source|teacher name|school name" \
  lib tests App.tsx
```

Expected: no output and `rg` exit 1.

- [ ] **Step 5: Verify clean worktree**

Run:

```bash
git status --short --branch
git status --porcelain
```

Expected:

```text
## codex/gate1-format-agnostic-source-manifest
```

and `git status --porcelain` prints nothing.

## Implementation Notes

### Privacy

The sanitized fixtures intentionally use synthetic subject matter and sentinel strings. They preserve the structural requirements of the private Grade 9 sample without copying private lesson text, file names, rendered slides, or source artifacts.

### No Silent Truncation

Gate 1 must not copy the existing prompt-layer truncation behavior into the manifest. The manifest is either complete within configured limits or invalid with a visible diagnostic.

### No Prompt or Schema Changes

Gate 1 does not change `services/geminiService.ts`. The manifest is stored and validated before existing AI calls, but it is not passed into model prompts until Gate 2.

### Non-Goals

- No AI prompt changes.
- No model or provider changes.
- No image behavior changes.
- No layout, renderer, or PPTX export changes.
- No NotebookLM visual work.
- No storyboard schema.
- No semantic slide schema.
- No generated presentation content changes beyond fail-closed source validation on enabled source-primary uploads.
- No deployment environment changes.
- No paid AI calls.
- No private DOCX/PPTX/PDF or extracted private lesson text committed.

## Required Gate 1 Implementation Report

The implementer must return:

1. Worktree path, branch, base commit, and final commit hashes.
2. Files changed.
3. Manifest contract implemented.
4. Sanitized fixtures added and what structural property each fixture proves.
5. Exact `npm test` count and command output summary.
6. Typecheck and build outcomes.
7. Proof that prompt/model/image/layout/export files are unchanged.
8. Proof that no private artifacts or extracted private text were committed.
9. Deviations, unresolved risks, and assumptions.
10. This exact limitation: `Gate 1 preserves uploaded source structure before AI generation; it does not yet create source-bound storyboards, semantic slide layouts, NotebookLM-like visuals, or editable scene rendering.`
