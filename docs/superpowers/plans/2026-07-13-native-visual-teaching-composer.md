# Native Visual Teaching Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a source-bound, AI-assisted visual teaching composer that produces NotebookLM-quality teaching narratives as editable native PowerPoint scenes and blocks the known generic-deck failure modes.

**Architecture:** Insert a provider-independent `VisualTeachingPlan` between the validated Gate 2 storyboard and Gate 3 semantic specs. A deterministic disposition policy and reconciliation validator constrain one structured text-model call plus one optional repair call; a semantic bridge and bounded native visual primitives render the result; Gate 5 gains a presentation-quality report that can forbid delivery and cache success.

**Tech Stack:** TypeScript 5.8, React 19, Node test runner, Vite 6, existing `/api/gemini` multi-provider proxy, PptxGenJS 3.12, existing compiled-scene preview/PPTX contracts.

## Global Constraints

- Do not hard-code the private Grade 9 circuits lesson, 5E, 4A, MATATAG, DLL/DLP, or any other lesson-plan format.
- Do not commit private DOCX/PPTX files, extracted private source text, rendered private slides, screenshots, hashes, teacher names, learner data, or school-identifying content.
- Do not add dependencies or change `package-lock.json`.
- Do not change production environment variables, provider selection, deployment configuration, rollout state, or legacy availability.
- Full-slide raster output is forbidden; all learner-facing text and instructional diagrams remain editable native objects.
- The model may select teaching moves and visual grammar but may not emit coordinates, PowerPoint operations, or unvalidated source IDs.
- AI output is untrusted. Allow one initial composition call and at most one repair call; validate the repaired plan from scratch.
- When the composer flag is false-like, preserve the exact current Gates 0-6 path and current scene output.
- When the composer is enabled, never silently fall through to the current generic title-and-paragraph deck after composition or quality failure.
- Optional image failure must preserve a valid native scene. Curated/cache-first and paid-image ceilings remain unchanged.
- Every task uses sanitized fixtures, proves RED before GREEN, runs its focused tests, and ends with a focused commit.

## File Structure

**New production files**

- `lib/sourceContentDisposition.ts`: deterministic source-step/field/objective classification and accounting validation.
- `lib/visualTeachingPlan.ts`: Gate 3.5 contract, diagnostics, source reconciliation, and flag parsing.
- `lib/visualTeachingSemanticBridge.ts`: maps a validated visual teaching plan into existing semantic specs without coordinates.
- `lib/presentationQualityValidation.ts`: deterministic deck-level quality diagnostics and thresholds.
- `services/visualTeachingComposerService.ts`: structured prompt/schema, provider adapter call, and one bounded repair.

**New tests and sanitized fixtures**

- `tests/fixtures/visualTeachingComposerFixtures.ts`
- `tests/sourceContentDisposition.test.ts`
- `tests/visualTeachingPlan.test.ts`
- `tests/visualTeachingComposerService.test.ts`
- `tests/visualTeachingSemanticBridge.test.ts`
- `tests/presentationQualityValidation.test.ts`
- `tests/visualTeachingComposerBoundary.test.ts`

**Focused modifications**

- `services/geminiService.ts`: export one generic structured-text helper using the existing proxy, retries, JSON parsing, provider/model response metadata, and R2 cache path.
- `lib/semanticSlideSpec.ts`: add visual-plan-compatible provenance, visual layouts, and structured slot types while keeping the legacy builder.
- `lib/compiledSlideScene.ts`: compile bounded relationship, comparison, question-choice, thesis, and evidence scenes from native elements.
- `components/CompiledSlideSceneView.tsx`: preview added native shape types from the same scene contract.
- `lib/compiledScenePptx.ts`: emit matching native PPTX operations for the added shape types.
- `lib/deckVisualSceneBoundary.ts`: accept an optional validated visual plan and use the semantic bridge only when present.
- `lib/sourceAlignmentValidation.ts`: treat validated plan dispositions as explicit accounting rather than semantic omissions.
- `lib/sceneAssetRequests.ts`: translate explicit text-free visual-plan asset briefs through the existing Gate 4 request contract.
- `lib/endToEndValidation.ts`: include the visual-plan and presentation-quality report in delivery/cache safety.
- `lib/endToEndSceneBoundary.ts`: compose and validate Gate 3.5 before invoking Gate 4/5.
- `App.tsx`: pass the new flag and provider composer adapter at the existing source-primary single/session seams.
- `README.md`: document the safe/off feature flag and provider prerequisites.
- Existing nearby tests: extend only where the modified contract requires parity or disabled-route proof.

**Forbidden files unless the plan is explicitly amended and reviewed**

- `types.ts`
- `components/Slide.tsx`
- `lib/generationCache.ts`
- `lib/k12GenerationRoutePolicy.ts`
- `lib/lessonSourceManifest.ts`
- `lib/teachingStoryboard.ts`
- current image search/generation modules, scripts, and curated assets
- `package.json`
- `package-lock.json`
- deployment and environment files

---

### Task 1: Source Content Disposition and Gate 3.5 Contract

**Files:**
- Create: `lib/sourceContentDisposition.ts`
- Create: `lib/visualTeachingPlan.ts`
- Create: `tests/fixtures/visualTeachingComposerFixtures.ts`
- Create: `tests/sourceContentDisposition.test.ts`
- Create: `tests/visualTeachingPlan.test.ts`

**Interfaces:**
- Consumes: `LessonSourceManifest`, `TeachingStoryboard`, `SourceStep`, and `StoryboardScreen` from Gates 1-2.
- Produces: `classifySourceContent(manifest, storyboard): SourceContentDispositionResult`.
- Produces: `validateVisualTeachingPlan(plan, manifest, storyboard, dispositions): VisualTeachingPlanDiagnostic[]`.
- Produces: `isVisualTeachingComposerV1Enabled(flagValue): boolean`.

The fixture module exports `scienceFixture`, `validVisualPlanFixture`, `visualComposerFixture`, `relationshipDiagramSemanticFixture`, `questionChoicesSemanticFixture`, and `visualLayoutSceneFixture`. Each helper materializes only the sanitized documents through public builders and validates its result before returning it.

- [ ] **Step 1: Add sanitized visual-composer fixtures**

Create `tests/fixtures/visualTeachingComposerFixtures.ts` with two source documents. The first includes an objective, planning-only references, learner-context prose, a relationship explanation, a structured multiple-choice check, evidence capture, and an exit output. The second uses humanities content to prevent science hard-coding.

```ts
import type { StructuredSourceDocument } from '../../lib/lessonSourceDocument.ts';

export const VISUAL_COMPOSER_SCIENCE_DOCUMENT: StructuredSourceDocument = {
  format: 'txt', fileName: 'sanitized-visual-composer-science.txt',
  sourceHash: 'fixture-visual-composer-science-hash', byteLength: 4200, plainText: '',
  blocks: [
    { id: 'vc001', kind: 'heading', text: 'Session 1', sourceOrder: 1, sourceLocation: { blockId: 'vc001' } },
    { id: 'vc002', kind: 'paragraph', text: 'Objective: Explain a source-backed relationship using recorded observations.', sourceOrder: 2, sourceLocation: { blockId: 'vc002' } },
    { id: 'vc003', kind: 'paragraph', text: 'References (books and websites): Planning source list for the teacher.', sourceOrder: 3, sourceLocation: { blockId: 'vc003' } },
    { id: 'vc004', kind: 'paragraph', text: 'Learner Context: Planning observation about prior classroom experience.', sourceOrder: 4, sourceLocation: { blockId: 'vc004' } },
    { id: 'vc005', kind: 'paragraph', text: 'Prediction: Choose which source-backed setup changes first and state a reason.', sourceOrder: 5, sourceLocation: { blockId: 'vc005' } },
    { id: 'vc006', kind: 'paragraph', text: 'Relationship Model: Connect the measured flow, supplied push, and opposition in the provided setup.', sourceOrder: 6, sourceLocation: { blockId: 'vc006' } },
    { id: 'vc007', kind: 'paragraph', text: 'Evidence Record: Record two observations and one measurement in the provided table.', sourceOrder: 7, sourceLocation: { blockId: 'vc007' } },
    { id: 'vc008', kind: 'paragraph', text: 'Check: Which statement matches the recorded pattern? A. Pattern alpha B. Pattern beta C. Pattern gamma D. Pattern delta', sourceOrder: 8, sourceLocation: { blockId: 'vc008' } },
    { id: 'vc009', kind: 'paragraph', text: 'Exit Output: Submit one claim supported by the recorded measurement.', sourceOrder: 9, sourceLocation: { blockId: 'vc009' } },
  ], tables: [],
};

export const VISUAL_COMPOSER_HUMANITIES_DOCUMENT: StructuredSourceDocument = {
  format: 'txt', fileName: 'sanitized-visual-composer-humanities.txt',
  sourceHash: 'fixture-visual-composer-humanities-hash', byteLength: 2400, plainText: '',
  blocks: [
    { id: 'vh001', kind: 'heading', text: 'Custom Unit 1', sourceOrder: 1, sourceLocation: { blockId: 'vh001' } },
    { id: 'vh002', kind: 'paragraph', text: 'Objective: Compare two source-provided perspectives using cited evidence.', sourceOrder: 2, sourceLocation: { blockId: 'vh002' } },
    { id: 'vh003', kind: 'paragraph', text: 'Source Comparison: Identify one shared claim and one meaningful difference.', sourceOrder: 3, sourceLocation: { blockId: 'vh003' } },
    { id: 'vh004', kind: 'paragraph', text: 'Evidence Board: Place one quotation under each perspective and explain its relevance.', sourceOrder: 4, sourceLocation: { blockId: 'vh004' } },
  ], tables: [],
};
```

- [ ] **Step 2: Write RED tests for disposition accounting and the plan contract**

```ts
test('classifies planning scaffolds without hiding learner-facing requirements', () => {
  const { manifest, storyboard } = scienceFixture();
  const result = classifySourceContent(manifest, storyboard);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.decisions.find((item) => item.sourceLabel.startsWith('References'))?.disposition, 'omit-administrative');
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Learner Context')?.disposition, 'speaker-notes');
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Relationship Model')?.disposition, 'learner-visible');
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Check')?.disposition, 'learner-visible');
  assert.equal(new Set(result.decisions.map((item) => item.sourceId)).size, result.decisions.length);
});

test('rejects a visual plan that drops a learner-visible source step', () => {
  const fixture = validVisualPlanFixture();
  const mutated = { ...fixture.plan, sourceAccounting: fixture.plan.sourceAccounting.filter((item) => item.sourceId !== fixture.relationshipStepId) };
  const diagnostics = validateVisualTeachingPlan(mutated, fixture.manifest, fixture.storyboard, fixture.dispositions);
  assert.equal(diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
});

test('accepts only documented true-like composer flags', () => {
  for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) assert.equal(isVisualTeachingComposerV1Enabled(value), true);
  for (const value of [undefined, '', 'false', '0', 'off', 'enabled']) assert.equal(isVisualTeachingComposerV1Enabled(value), false);
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
node --experimental-strip-types --test tests/sourceContentDisposition.test.ts tests/visualTeachingPlan.test.ts
```

Expected: both test files fail with `ERR_MODULE_NOT_FOUND` for the new production modules.

- [ ] **Step 4: Implement deterministic contracts**

`lib/sourceContentDisposition.ts` exposes:

```ts
export type SourceContentDisposition = 'learner-visible' | 'speaker-notes' | 'deck-metadata' | 'merge-context' | 'omit-administrative';
export type SourceDispositionDecision = {
  sourceKind: 'objective' | 'step' | 'field'; sourceId: string; unitId: string;
  sourceOrder: number; sourceLabel: string; disposition: SourceContentDisposition;
  reason: 'objective-visible' | 'instructional-step-visible' | 'teacher-action-notes'
    | 'planning-context-notes' | 'administrative-omission' | 'metadata-preserved' | 'adjacent-context-merge';
};
export type SourceContentDispositionResult =
  | { ok: true; decisions: SourceDispositionDecision[] }
  | { ok: false; diagnostics: VisualTeachingPlanDiagnostic[] };
export const classifySourceContent = (manifest: LessonSourceManifest, storyboard: TeachingStoryboard): SourceContentDispositionResult;
```

Use anchored allowlists, not substring matching:

```ts
const ADMINISTRATIVE_LABEL = /^(?:references?(?:\s*\([^)]*\))?|declaration of ai use|teacher preparation|administrative notes?)\s*:?$/i;
const PLANNING_CONTEXT_LABEL = /^(?:learner context|observations? of learners|ways forward|intentions?)\s*:?$/i;
const LEARNER_REFERENCE_ACTION = /\b(?:learners?|students?)\s+(?:use|consult|compare|evaluate|cite)\b|\b(?:use|consult|compare|evaluate|cite)\s+(?:the\s+)?(?:reference|source)/i;
```

`lib/visualTeachingPlan.ts` exposes:

```ts
export const VISUAL_TEACHING_PLAN_VERSION = 'visual-teaching-plan-v1';
export type VisualGrammar = 'concept-map' | 'relationship-diagram' | 'process-flow' | 'comparison-panels'
  | 'classification-map' | 'timeline' | 'data-table' | 'worked-example' | 'activity-board'
  | 'question-choices' | 'evidence-board' | 'visual-thesis' | 'image-led-explanation' | 'minimal-statement';
export type VisualTeachingScene = {
  id: string; unitId: string; sourceStepIds: string[]; sourceObjectiveIds: string[]; storyboardScreenIds: string[];
  teachingMove: 'orient' | 'target' | 'explain' | 'model' | 'practice' | 'evidence' | 'check' | 'synthesize';
  learnerTitle: string;
  visibleContent: {
    statement?: string; points: string[]; cards: Array<{ id: string; title: string; body: string }>;
    steps: Array<{ id: string; label: string; body: string }>;
    table?: { headers: string[]; rows: string[][] };
    question?: { prompt: string; choices: Array<{ id: string; text: string }>; answerId?: string };
    diagram?: { nodes: Array<{ id: string; label: string; detail?: string; role: 'source' | 'process' | 'constraint' | 'result' }>;
      edges: Array<{ from: string; to: string; label?: string; direction: 'forward' | 'both' | 'none' }> };
  };
  visualGrammar: VisualGrammar; teacherNotes: string; requiredEvidence: string[]; requiredOutputs: string[];
  assetBrief?: { purpose: string; subject: string; style: 'photo' | 'illustration'; mustNotContainText: true };
};
export type VisualSourceAccountingEntry = SourceDispositionDecision & { sceneIds: string[] };
export type VisualTeachingPlan = {
  contractVersion: typeof VISUAL_TEACHING_PLAN_VERSION; unitId: string; sourceObjectiveIds: string[];
  scenes: VisualTeachingScene[]; sourceAccounting: VisualSourceAccountingEntry[];
  provenance: { sourceHash: string; storyboardVersion: string; selectedUnitIds: string[]; provider?: string; model?: string };
};
export type VisualTeachingPlanDiagnostic = {
  code: 'visual_plan_contract_invalid' | 'visual_plan_foreign_source' | 'visual_plan_source_unaccounted'
    | 'visual_plan_order_inversion' | 'visual_plan_objective_mismatch' | 'visual_plan_unauthorized_omission'
    | 'visual_plan_planning_text_visible' | 'visual_plan_assessment_unparsed' | 'visual_plan_grammar_unsupported';
  severity: 'blocking'; message: string; sourceId?: string; sceneId?: string;
};
export type VisualTeachingPlanResult =
  | { ok: true; plan: VisualTeachingPlan }
  | { ok: false; diagnostics: VisualTeachingPlanDiagnostic[]; message: string };
```

Add blocking codes for contract invalidity, foreign IDs, source omission, order inversion, objective mismatch, unauthorized omission, planning text visible, unparsed assessment, and unsupported grammar. Require every disposition exactly once, scene ownership for each `learner-visible` decision, no scene ownership for `omit-administrative`, and selected-objective order preservation.

- [ ] **Step 5: Run focused and existing Gate 1-3 tests**

```bash
node --experimental-strip-types --test tests/sourceContentDisposition.test.ts tests/visualTeachingPlan.test.ts tests/teachingStoryboard.test.ts tests/semanticSlideSpec.test.ts
```

Expected: PASS with no existing regression.

- [ ] **Step 6: Commit Task 1**

```bash
git add lib/sourceContentDisposition.ts lib/visualTeachingPlan.ts tests/fixtures/visualTeachingComposerFixtures.ts tests/sourceContentDisposition.test.ts tests/visualTeachingPlan.test.ts
git commit -m "feat: add visual teaching plan contract"
```

---

### Task 2: Structured AI Composer and Bounded Repair

**Files:**
- Modify: `services/geminiService.ts`
- Create: `services/visualTeachingComposerService.ts`
- Create: `tests/visualTeachingComposerService.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts plus Gate 1-2 source data.
- Produces: `generateStructuredText<T>(request): Promise<StructuredTextResult<T>>` using the existing proxy.
- Produces: `composeVisualTeachingPlanWithProvider(input, adapter?): Promise<VisualTeachingPlanResult>`.

- [ ] **Step 1: Write RED tests with an injected fake provider**

```ts
test('returns a validated provider plan with local provenance', async () => {
  const fixture = visualComposerFixture();
  const calls: StructuredComposerRequest[] = [];
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async (request) => {
    calls.push(request);
    return { value: fixture.providerPlan, provider: 'fixture', model: 'fixture-model' };
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(calls.length, 1);
  assert.equal(result.plan.provenance.sourceHash, fixture.input.manifest.provenance.sourceHash);
  assert.equal(result.plan.provenance.provider, 'fixture');
  assert.equal(result.plan.scenes.some((scene) => scene.visualGrammar === 'relationship-diagram'), true);
});

test('allows one repair call and validates the repaired plan from scratch', async () => {
  const fixture = visualComposerFixture();
  let callCount = 0;
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async () => {
    callCount += 1;
    return { value: callCount === 1 ? fixture.planWithoutRelationshipStep : fixture.providerPlan, provider: 'fixture', model: 'fixture-model' };
  });
  assert.equal(callCount, 2);
  assert.equal(result.ok, true);
});

test('does not deliver a generic fallback after two invalid responses', async () => {
  const fixture = visualComposerFixture();
  let callCount = 0;
  const result = await composeVisualTeachingPlanWithProvider(fixture.input, async () => {
    callCount += 1;
    return { value: fixture.planWithoutRelationshipStep, provider: 'fixture', model: 'fixture-model' };
  });
  assert.equal(callCount, 2);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((item) => item.code === 'visual_plan_source_unaccounted'), true);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
node --experimental-strip-types --test tests/visualTeachingComposerService.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `services/visualTeachingComposerService.ts`.

- [ ] **Step 3: Export the existing structured-text proxy helper**

Extend `GeminiTextResponse` with `provider` and `modelUsed`, then add to `services/geminiService.ts`:

```ts
export type StructuredTextRequest = {
  prompt: string;
  responseSchema: Record<string, unknown>;
  label: string;
  temperature?: number;
};
export type StructuredTextResult<T> = { value: T; provider?: string; model?: string };
export async function generateStructuredText<T>(request: StructuredTextRequest): Promise<StructuredTextResult<T>> {
  const response = await callGeminiProxy<GeminiTextResponse>({
    task: 'text', model: TEXT_MODELS, contents: request.prompt,
    config: { responseMimeType: 'application/json', responseSchema: request.responseSchema, temperature: request.temperature ?? 0.2 },
  });
  return { value: parseJsonModelResponse<T>(response.text, request.label), provider: response.provider, model: response.modelUsed };
}
```

Do not change provider selection or retry counts. xAI continues to receive JSON Schema through `buildXaiResponseFormat`; DeepSeek continues to receive `json_object`; local validation remains mandatory.

- [ ] **Step 4: Implement the visual composer service**

`services/visualTeachingComposerService.ts` exports:

```ts
export type StructuredComposerRequest = { purpose: 'compose' | 'repair'; prompt: string; responseSchema: Record<string, unknown> };
export type StructuredComposerAdapter = (request: StructuredComposerRequest) => Promise<{ value: unknown; provider?: string; model?: string }>;
export type VisualTeachingComposerInput = {
  manifest: LessonSourceManifest; storyboard: TeachingStoryboard;
  dispositions: SourceDispositionDecision[]; language: 'EN' | 'FIL';
};
export const composeVisualTeachingPlanWithProvider = async (
  input: VisualTeachingComposerInput,
  adapter: StructuredComposerAdapter = defaultStructuredComposerAdapter,
): Promise<VisualTeachingPlanResult>;
```

The binding prompt contains:

```text
Return one JSON object matching visual-teaching-plan-v1.
Use only supplied source IDs and storyboard screen IDs.
Preserve objective ownership, learner-visible requirements, evidence, outputs, assessments, and source order.
Planning-only and administrative dispositions must not appear in learner-visible titles or content.
Create a coherent teaching arc; do not create one slide for every source row by default.
Use visual grammar to explain relationships, processes, comparisons, evidence, activities, and assessments.
Parse each assessment question and each choice into separate structured fields.
Do not emit coordinates, PowerPoint operations, markdown, image text, new facts, new activities, or new requirements.
Keep teacher facilitation in teacherNotes.
Every learner-visible source ID must be owned by at least one scene.
```

Build the JSON schema from Task 1 with `additionalProperties: false` on every object. Prefix both composition and repair prompts with `visual-teaching-plan-v1` and a prompt-schema version so the existing provider/model/content/config R2 cache identity cannot collide with legacy generation. Add provenance locally. On initial failure, send the invalid object plus only blocking diagnostic codes/messages to one repair call, rebuild provenance, and rerun `validateVisualTeachingPlan` from scratch.

- [ ] **Step 5: Run focused and full tests**

```bash
node --experimental-strip-types --test tests/visualTeachingComposerService.test.ts
npm test
```

Expected: all tests PASS; no live provider call occurs in tests.

- [ ] **Step 6: Commit Task 2**

```bash
git add services/geminiService.ts services/visualTeachingComposerService.ts tests/visualTeachingComposerService.test.ts
git commit -m "feat: add structured visual teaching composer"
```

---

### Task 3: Visual Plan to Semantic Spec Bridge

**Files:**
- Create: `lib/visualTeachingSemanticBridge.ts`
- Modify: `lib/semanticSlideSpec.ts`
- Modify: `lib/sourceAlignmentValidation.ts`
- Modify: `lib/sceneAssetRequests.ts`
- Create: `tests/visualTeachingSemanticBridge.test.ts`
- Modify: `tests/semanticSlideSpec.test.ts`
- Modify: `tests/sourceAlignmentValidation.test.ts`
- Modify: `tests/sceneAssetRequests.test.ts`

**Interfaces:**
- Consumes: validated `VisualTeachingPlan` and owning `TeachingStoryboard`.
- Produces: `buildSemanticSlideSpecsFromVisualTeachingPlan(plan, storyboard): SemanticSlideSpecResult`.
- Preserves: existing `buildSemanticSlideSpecs(storyboard)` behavior when no plan is supplied.

- [ ] **Step 1: Write RED mapping and provenance tests**

```ts
test('maps visual scenes to semantic specs with merged provenance', () => {
  const fixture = validVisualPlanFixture();
  const result = buildSemanticSlideSpecsFromVisualTeachingPlan(fixture.plan, fixture.storyboard);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.specs.map((spec) => spec.id), result.specs.map((_, index) => `semslide-${String(index + 1).padStart(3, '0')}`));
  assert.equal(result.specs.some((spec) => spec.layoutId === 'relationship-diagram'), true);
  assert.equal(result.specs.some((spec) => spec.layoutId === 'question-choices'), true);
  assert.equal(result.specs.flatMap((spec) => spec.sourceStepIds).includes(fixture.relationshipStepId), true);
  assert.equal(result.specs.every((spec) => spec.storyboardScreenIds.length > 0), true);
});

test('does not treat authorized administrative dispositions as omissions', () => {
  const fixture = validVisualPlanFixture();
  const semantic = buildSemanticSlideSpecsFromVisualTeachingPlan(fixture.plan, fixture.storyboard);
  assert.equal(semantic.ok, true);
  if (!semantic.ok) return;
  const alignment = validateSourceAlignment({ ...fixture.endToEndInput, visualTeachingPlan: fixture.plan, semanticSpecs: semantic.specs });
  assert.equal(alignment.diagnostics.some((item) => item.code === 'e2e_source_step_coverage_failed'), false);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
node --experimental-strip-types --test tests/visualTeachingSemanticBridge.test.ts tests/semanticSlideSpec.test.ts tests/sourceAlignmentValidation.test.ts tests/sceneAssetRequests.test.ts
```

Expected: FAIL because the bridge and visual-plan provenance do not exist.

- [ ] **Step 3: Extend semantic contracts without removing legacy fields**

In `lib/semanticSlideSpec.ts`, use the complete unions below:

```ts
export type SemanticLayoutId = 'title-context' | 'learning-targets-stack' | 'prompt-card' | 'activity-board'
  | 'evidence-capture-board' | 'guided-example-steps' | 'comparison-matrix' | 'process-flow-horizontal'
  | 'question-reveal-pair' | 'exit-ticket-card' | 'generic-bullets'
  | 'visual-thesis' | 'relationship-diagram' | 'comparison-panels' | 'question-choices';
export type SlideSlotValue =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'cards'; cards: Array<{ id: string; title: string; body: string }> }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'steps'; steps: Array<{ id: string; label: string; body: string }> }
  | { kind: 'question'; prompt: string; choices: Array<{ id: string; text: string }>; answerId?: string }
  | { kind: 'diagram'; nodes: Array<{ id: string; label: string; detail?: string; role: string }>; edges: Array<{ from: string; to: string; label?: string; direction: string }> };
```

Add required `storyboardScreenIds: string[]`, optional `visualGrammar?: VisualGrammar`, and optional `visualAssetBrief?: VisualTeachingScene['assetBrief']` to `SemanticSlideSpec`. The legacy builder sets `storyboardScreenIds: [screen.id]`. Validators allow multiple screens only when they are contiguous and their combined source/objective IDs equal the spec provenance.

- [ ] **Step 4: Implement the bridge mapping**

```ts
const layoutForGrammar: Record<VisualGrammar, SemanticLayoutId> = {
  'concept-map': 'relationship-diagram', 'relationship-diagram': 'relationship-diagram',
  'process-flow': 'process-flow-horizontal', 'comparison-panels': 'comparison-panels',
  'classification-map': 'comparison-panels', timeline: 'process-flow-horizontal',
  'data-table': 'evidence-capture-board', 'worked-example': 'guided-example-steps',
  'activity-board': 'activity-board', 'question-choices': 'question-choices',
  'evidence-board': 'evidence-capture-board', 'visual-thesis': 'visual-thesis',
  'image-led-explanation': 'visual-thesis', 'minimal-statement': 'generic-bullets',
};
```

Map diagram/question/table/step/card/point structures into typed slots. Use the first storyboard ID as the legacy primary, store all IDs in `storyboardScreenIds`, and copy the optional source-safe `assetBrief` to `visualAssetBrief`.

In `buildSceneAssetRequests`, prefer a validated `visualAssetBrief` over keyword inference. Convert it to the existing `SceneAssetRequest` with `mustNotContainText: true`, existing source ownership, and existing privacy fields. When no brief exists, preserve current decision policy exactly. Add a test proving one brief creates one request and a spec without a brief retains the prior result.

- [ ] **Step 5: Authorize only validated dispositions in source alignment**

Extend source-alignment input with `visualTeachingPlan?: VisualTeachingPlan`. A source step absent from semantic specs is authorized only when its exact accounting entry is `speaker-notes`, `deck-metadata`, `merge-context`, or `omit-administrative` and the plan has no blocking diagnostic. `learner-visible` steps still require semantic-spec coverage.

- [ ] **Step 6: Run focused tests**

```bash
node --experimental-strip-types --test tests/visualTeachingSemanticBridge.test.ts tests/semanticSlideSpec.test.ts tests/sourceAlignmentValidation.test.ts tests/sceneAssetRequests.test.ts
```

Expected: PASS; legacy semantic tests remain green.

- [ ] **Step 7: Commit Task 3**

```bash
git add lib/visualTeachingSemanticBridge.ts lib/semanticSlideSpec.ts lib/sourceAlignmentValidation.ts lib/sceneAssetRequests.ts tests/visualTeachingSemanticBridge.test.ts tests/semanticSlideSpec.test.ts tests/sourceAlignmentValidation.test.ts tests/sceneAssetRequests.test.ts
git commit -m "feat: bridge visual plans to semantic slides"
```

---

### Task 4: Editable Native Visual Primitives and Layouts

**Files:**
- Modify: `lib/compiledSlideScene.ts`
- Modify: `components/CompiledSlideSceneView.tsx`
- Modify: `lib/compiledScenePptx.ts`
- Modify: `tests/compiledSlideScene.test.ts`
- Modify: `tests/compiledScenePptx.test.ts`

**Interfaces:**
- Consumes: semantic specs using `visual-thesis`, `relationship-diagram`, `comparison-panels`, and `question-choices`.
- Produces: bounded `CompiledSlideScene` elements and matching `PptxSceneOperation[]`.

- [ ] **Step 1: Write RED tests for visual structure, editability, and parity**

```ts
test('compiles a relationship diagram as editable native nodes and connectors', () => {
  const result = compileSemanticSlideSpecsToScenes([relationshipDiagramSemanticFixture()], { title: 'Sanitized Relationship Deck' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const scene = result.presentation.scenes[0];
  assert.equal(scene.elements.filter((item) => item.kind === 'shape').length >= 3, true);
  assert.equal(scene.elements.filter((item) => item.kind === 'connector').length >= 2, true);
  assert.equal(scene.elements.filter((item) => item.kind === 'text').every((item) => item.editable), true);
  assert.equal(scene.elements.some((item) => item.kind === 'image'), false);
  assert.deepEqual(validateCompiledSlideScene(scene), []);
});

test('compiles assessment choices as separate editable objects', () => {
  const result = compileSemanticSlideSpecsToScenes([questionChoicesSemanticFixture()], { title: 'Sanitized Check' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const visible = getSceneVisibleText(result.presentation.scenes[0]);
  for (const choice of ['Pattern alpha', 'Pattern beta', 'Pattern gamma', 'Pattern delta']) assert.equal(visible.some((item) => item.includes(choice)), true);
  assert.equal(visible.some((item) => /A\..*B\..*C\..*D\./s.test(item)), false);
});

test('preserves preview and PPTX visible-text parity for visual layouts', () => {
  const scene = visualLayoutSceneFixture();
  const previewText = createPreviewSceneDescriptors(scene).flatMap((descriptor) => descriptor.text);
  const operations = compilePptxSceneOperations(scene);
  assert.deepEqual(getPptxSceneOperationText(operations), previewText);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
node --experimental-strip-types --test tests/compiledSlideScene.test.ts tests/compiledScenePptx.test.ts
```

Expected: FAIL on unsupported layouts or missing native structures.

- [ ] **Step 3: Add only required native shape capabilities**

Extend `SceneShapeElement['shape']` with `ellipse` and `diamond`. In `CompiledSlideSceneView`, map `ellipse` to `borderRadius: '50%'`. Render a diamond as a rotated square only when it has no embedded text; labels remain separate editable text elements. `compiledScenePptx.ts` emits native `addShape` operations with the same shape tokens.

- [ ] **Step 4: Add bounded layouts**

Append these definitions to `SEMANTIC_LAYOUT_DEFINITIONS`:

```ts
{ id: 'visual-thesis', semantic: true, allowedIntents: ['title-context', 'learning-targets', 'wrap-up'], requiredSlots: ['title'], optionalSlots: ['body', 'diagram'], maxTextChars: 420, maxListItems: 4 },
{ id: 'relationship-diagram', semantic: true, allowedIntents: ['guided-example', 'comparison-matrix', 'process-flow'], requiredSlots: ['title', 'diagram'], optionalSlots: ['body', 'successCriteria'], maxTextChars: 620, maxListItems: 6 },
{ id: 'comparison-panels', semantic: true, allowedIntents: ['comparison-matrix', 'guided-example'], requiredSlots: ['title', 'body'], optionalSlots: ['successCriteria'], maxTextChars: 760, maxListItems: 6 },
{ id: 'question-choices', semantic: true, allowedIntents: ['question', 'exit-ticket'], requiredSlots: ['title', 'question'], optionalSlots: ['successCriteria'], maxTextChars: 620, maxListItems: 5 },
```

Compile deterministic frames on 1280×720:

- title band `x=72, y=54, w=1136, h=96`;
- relationship canvas `x=72, y=180, w=1136, h=430`, maximum six nodes/eight edges;
- comparison panels: two or three equal columns within that content region;
- question prompt `x=92, y=170, w=1096, h=120`, with choices in a 2×2 grid;
- thesis statement in the left 56%, diagram or optional asset in the right 40% with no overlap.

Use existing visual-system colors and typography. Every node/choice is a shape plus a separate editable text element. Every relation is a `SceneConnectorElement`.

- [ ] **Step 5: Run focused visual contract tests**

```bash
node --experimental-strip-types --test tests/compiledSlideScene.test.ts tests/compiledScenePptx.test.ts tests/renderedSceneValidation.test.ts
```

Expected: PASS with zero overflow, off-canvas, uneditable-text, full-slide-raster, or parity diagnostics.

- [ ] **Step 6: Commit Task 4**

```bash
git add lib/compiledSlideScene.ts components/CompiledSlideSceneView.tsx lib/compiledScenePptx.ts tests/compiledSlideScene.test.ts tests/compiledScenePptx.test.ts
git commit -m "feat: render native visual teaching layouts"
```

---

### Task 5: Presentation Quality Gate and Gate 5 Integration

**Files:**
- Create: `lib/presentationQualityValidation.ts`
- Modify: `lib/endToEndValidation.ts`
- Create: `tests/presentationQualityValidation.test.ts`
- Modify: `tests/endToEndValidation.test.ts`
- Modify: `tests/fixtures/endToEndValidationFixtures.ts`

**Interfaces:**
- Consumes: `VisualTeachingPlan`, `SemanticSlideSpec[]`, and `CompiledScenePresentation`.
- Produces: `validatePresentationQuality(input): PresentationQualityValidationResult`.
- Adds: optional `presentationQuality` to `EndToEndValidationReport` when a visual plan exists.

- [ ] **Step 1: Write RED tests for each known bad-deck signature**

```ts
test('blocks visible planning labels and reference dumps', () => {
  const result = validatePresentationQuality(withVisibleTitle(passingQualityFixture(), 'References (books, websites, toolkits, etc.)'));
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_planning_label_visible'), true);
});

test('blocks paragraph dumps and repeated generic titles', () => {
  const result = validatePresentationQuality(withRepeatedGenericParagraphSlides(passingQualityFixture(), 'Learning Task', 'Source-backed sentence '.repeat(35)));
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_paragraph_dump'), true);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_generic_title_repeated'), true);
});

test('blocks concatenated multiple-choice text', () => {
  const result = validatePresentationQuality(withRawAssessmentText(passingQualityFixture(), '1. Choose A. Alpha B. Beta C. Gamma D. Delta'));
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_assessment_unparsed'), true);
});

test('blocks decks dominated by plain title-and-body scenes', () => {
  const result = validatePresentationQuality(plainTextDominatedQualityFixture());
  assert.equal(result.ok, false);
  assert.equal(result.report.meaningfulVisualGrammarRatio < 0.75, true);
  assert.equal(result.report.plainTitleBodyRatio > 0.25, true);
});

test('passes a source-aligned editable visual teaching deck', () => {
  const result = validatePresentationQuality(passingQualityFixture());
  assert.equal(result.ok, true);
  assert.equal(result.report.meaningfulVisualGrammarRatio >= 0.75, true);
  assert.equal(result.report.explanatoryStructureRatio >= 0.40, true);
  assert.equal(result.report.plainTitleBodyRatio <= 0.25, true);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
node --experimental-strip-types --test tests/presentationQualityValidation.test.ts tests/endToEndValidation.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/presentationQualityValidation.ts`.

- [ ] **Step 3: Implement quality diagnostics and thresholds**

```ts
export type PresentationQualityReport = {
  contractVersion: 'presentation-quality-v1'; instructionalSlideCount: number;
  meaningfulVisualGrammarRatio: number; explanatoryStructureRatio: number; plainTitleBodyRatio: number;
  planningLabelViolationCount: number; referenceDumpCount: number; paragraphDumpCount: number;
  unparsedAssessmentCount: number; repeatedGenericTitleCount: number; proseOnlyRelationshipCount: number;
  diagnostics: PresentationQualityDiagnostic[];
};
```

Block below 0.75 meaningful grammar, below 0.40 explanatory structure, or above 0.25 plain title/body. Normalize titles before duplicate detection. Text over 360 normalized characters is blocking. Detect raw multiple choice only when at least three ordered choice markers occur inside one visible text element.

- [ ] **Step 4: Integrate quality into Gate 5 cache and delivery safety**

Extend `EndToEndValidationInput` with `visualTeachingPlan?: VisualTeachingPlan` and `EndToEndValidationReport` with `presentationQuality?: PresentationQualityReport`. When a plan exists, append `e2e_presentation_quality_failed` blocking diagnostics to `allDiagnostics`; retain detailed quality diagnostics in the report. Existing cache safety must set delivery and success-cache permission false. When no plan exists, omit the section and preserve exact existing Gate 5 behavior.

- [ ] **Step 5: Run Gate 5 tests**

```bash
node --experimental-strip-types --test tests/presentationQualityValidation.test.ts tests/endToEndValidation.test.ts tests/sourcePrimarySceneCacheSafety.test.ts
```

Expected: PASS; invalid quality blocks delivery/cache and the no-plan path remains unchanged.

- [ ] **Step 6: Commit Task 5**

```bash
git add lib/presentationQualityValidation.ts lib/endToEndValidation.ts tests/presentationQualityValidation.test.ts tests/endToEndValidation.test.ts tests/fixtures/endToEndValidationFixtures.ts
git commit -m "feat: enforce presentation quality before delivery"
```

---

### Task 6: Source-Primary Boundary, App Wiring, Flag, and Documentation

**Files:**
- Modify: `lib/deckVisualSceneBoundary.ts`
- Modify: `lib/endToEndSceneBoundary.ts`
- Modify: `App.tsx`
- Modify: `README.md`
- Modify: `tests/deckVisualSystem.test.ts`
- Modify: `tests/endToEndValidation.test.ts`
- Create: `tests/visualTeachingComposerBoundary.test.ts`

**Interfaces:**
- Consumes: `VITE_VISUAL_TEACHING_COMPOSER_V1`, source-primary route, manifest, storyboard, language, and provider composer adapter.
- Produces: a validated visual plan passed to semantic, visual, and E2E boundaries.
- Preserves: exact Gate 4/5 delegation when the flag is false-like or route is legacy/topic-only.

- [ ] **Step 1: Write RED boundary tests**

```ts
test('disabled composer delegates to exact existing behavior', async () => {
  const fixture = await buildEvidenceOutputEndToEndFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const existing = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy, 'true', 'true', 'true', fixture.sourceManifest, fixture.storyboard, { title: 'Fixture' },
  );
  const disabled = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy, 'true', 'true', 'true', fixture.sourceManifest, fixture.storyboard,
    { title: 'Fixture', visualComposer: { flagValue: 'false', language: 'EN', compose: throwingComposer } },
  );
  assert.deepEqual(disabled, existing);
});

test('enabled source-primary composer runs once before semantic compilation', async () => {
  const fixture = await visualComposerEndToEndFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  let calls = 0;
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy, 'true', 'true', 'true', fixture.sourceManifest, fixture.storyboard,
    { title: 'Fixture', visualComposer: { flagValue: 'true', language: 'EN', compose: async () => { calls += 1; return { ok: true, plan: fixture.plan }; } } },
  );
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal((result.validationReport?.presentationQuality?.meaningfulVisualGrammarRatio ?? 0) >= 0.75, true);
});

test('composition failure stops before generic scene delivery', async () => {
  const fixture = await visualComposerEndToEndFixture();
  const policy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const result = await resolveEndToEndValidatedScenePresentationForGeneration(
    policy, 'true', 'true', 'true', fixture.sourceManifest, fixture.storyboard,
    { title: 'Fixture', visualComposer: { flagValue: 'true', language: 'EN', compose: failingComposer } },
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.message.includes('visual teaching composition'), true);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
node --experimental-strip-types --test tests/visualTeachingComposerBoundary.test.ts tests/deckVisualSystem.test.ts tests/endToEndValidation.test.ts
```

Expected: FAIL because the boundary options do not accept a visual composer.

- [ ] **Step 3: Wire the visual plan through existing boundaries**

Extend `DeckVisualSceneBoundaryOptions` with `visualTeachingPlan?: VisualTeachingPlan`. Select specs with:

```ts
const specsResult = options.visualTeachingPlan
  ? buildSemanticSlideSpecsFromVisualTeachingPlan(options.visualTeachingPlan, storyboard)
  : buildSemanticSlideSpecs(storyboard);
```

Include the plan in validation artifacts. Add to end-to-end boundary options:

```ts
visualComposer?: {
  flagValue: unknown;
  language: 'EN' | 'FIL';
  compose: typeof composeVisualTeachingPlanWithProvider;
};
```

Only classify/compose when the flag is true-like, policy is `source-primary`, input origin is `uploaded-file`, and manifest/storyboard exist. Pass the plan into Gate 4 artifacts and Gate 5 input. On failure, return a blocking boundary result and do not invoke the legacy semantic builder.

- [ ] **Step 4: Add the app flag at both source-primary call sites**

In `App.tsx` add:

```ts
const VISUAL_TEACHING_COMPOSER_V1_FLAG = import.meta.env.VITE_VISUAL_TEACHING_COMPOSER_V1;
```

Import `composeVisualTeachingPlanWithProvider`. Add to the single-lesson and daily/session boundary options:

```ts
visualComposer: {
  flagValue: VISUAL_TEACHING_COMPOSER_V1_FLAG,
  language: generationLanguage,
  compose: composeVisualTeachingPlanWithProvider,
},
```

Do not move route policy, rollout eligibility, Gate 1/2 preflight, quota, cache, or success-state ordering.

- [ ] **Step 5: Document safe/off operation**

Add to `README.md`:

```text
VITE_VISUAL_TEACHING_COMPOSER_V1=true enables the source-primary Gate 3.5 visual teaching composer after Gate 2 and before semantic scene compilation. It requires a configured server-side AI_TEXT_PROVIDER and its corresponding API key. It is ignored for legacy/topic-only routes and remains subordinate to VITE_SOURCE_PRIMARY_PRODUCTION_ARMED and Gate 6 rollout eligibility. Leave it unset or false to preserve the current Gates 0-6 scene behavior. Enabling this flag does not change AI_TEXT_PROVIDER, AI_IMAGE_PROVIDER, or production rollout by itself.
```

- [ ] **Step 6: Run focused and static verification**

```bash
node --experimental-strip-types --test tests/visualTeachingComposerBoundary.test.ts tests/deckVisualSystem.test.ts tests/endToEndValidation.test.ts
npm run typecheck
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 6**

```bash
git add lib/deckVisualSceneBoundary.ts lib/endToEndSceneBoundary.ts App.tsx README.md tests/deckVisualSystem.test.ts tests/endToEndValidation.test.ts tests/visualTeachingComposerBoundary.test.ts
git commit -m "feat: wire visual teaching composer to source-primary"
```

---

### Task 7: Full Verification, Real DOCX-to-PPTX Acceptance, and Baseline

**Files:**
- Create after successful verification: `docs/superpowers/baselines/2026-07-13-native-visual-teaching-composer-baseline.md`
- Modify only after a deterministic RED reproduction: the smallest owning production/test files from Tasks 1-6.

**Interfaces:**
- Consumes: real private weekly DOCX and NotebookLM PPTX outside Git.
- Produces: test output, private rendered comparison outside Git, user review, and sanitized baseline report.

- [ ] **Step 1: Run the complete automated suite from a clean worktree**

```bash
npm test
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: tests, typecheck, build, and diff check pass.

- [ ] **Step 2: Prove changed-file and forbidden-scope boundaries**

```bash
git diff --name-only f5dd247..HEAD
git diff --exit-code f5dd247..HEAD -- types.ts components/Slide.tsx lib/generationCache.ts lib/k12GenerationRoutePolicy.ts lib/lessonSourceManifest.ts lib/teachingStoryboard.ts package.json package-lock.json
git diff --name-only --diff-filter=A f5dd247..HEAD | rg '\.(docx|pptx|pdf|png|jpe?g|webp|gif|zip)$' && exit 1 || true
```

Expected: only plan-approved files changed; forbidden diff and binary scan produce no matches.

- [ ] **Step 3: Start an authorized local source-primary server**

Use local environment values without printing secrets. Set existing source-primary flags true, `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=all`, `VITE_VISUAL_TEACHING_COMPOSER_V1=true`, `VITE_SOURCE_PRIMARY_PRODUCTION_ARMED=true`, and `APPSTORE_AUTH_ENABLED=false`. Keep `AI_TEXT_PROVIDER` and its corresponding key in the local/Vercel environment; do not put them in commands, Git, logs, or screenshots.

Run `npm run dev:vercel` and verify `/api/auth/session` reports the disabled-auth local session before opening the UI.

- [ ] **Step 4: Evaluate authorized text providers on sanitized fixtures**

Run the same sanitized science and humanities composition payloads through each locally authorized provider configuration. Compare `grok-4.3` and `deepseek-v4-pro` when both keys are available; otherwise evaluate the configured non-Gemini provider and record the unavailable candidate explicitly. Record schema validity, repair count, source coverage, assessment parsing, visual-grammar appropriateness, latency, and provider-reported model. Do not print keys or prompt/source bodies. Select the preview candidate by passing all hard validators first, then teaching-quality review, then latency/cost.

- [ ] **Step 5: Exercise the real browser upload path**

Upload:

```text
<private-local-lesson-plan.docx>
```

Choose Weekly, generate Session 1, inspect the in-app preview, and export PPTX. Record only counts and diagnostic codes outside Git:

- manifest units/objectives/steps;
- storyboard screens and visible teacher-script count;
- visual-plan scene count, dispositions, grammar ratios, provider/model metadata;
- semantic spec and compiled-scene counts;
- source-step/objective coverage;
- quality diagnostics;
- overflow, off-canvas, uneditable text, full-slide raster counts;
- asset request/resolution counts.

Expected: Gates 1-5 and quality pass; no planning label, references dump, paragraph dump, repeated generic title, or raw assessment is visible.

- [ ] **Step 6: Inspect the PPTX at the artifact layer**

Keep outputs under `/tmp`. Use `unzip -l` for slide/media counts, LibreOffice headless conversion to PDF, and Poppler rendering to PNG. Verify native text operations, native shapes/connectors, separate assessment choices, no full-slide image, readable 1280×720 rendering, and no overlaps or clipped copy. The session normally contains 8-16 slides, with an advisory diagnostic if completeness requires more.

Render this private NotebookLM reference outside Git and compare thumbnails for hierarchy, visual rhythm, relationship-specific composition, and teaching clarity:

```text
<private-local-reference-deck.pptx>
```

- [ ] **Step 7: Obtain explicit user artifact approval**

Show the Session 1 contact sheet and representative editable-element proof. Do not create a PR or enable production rollout until the user approves the actual deck. If rejected, capture the exact visual failure, add a sanitized RED regression, fix only the owning layer, and repeat Steps 1-6.

- [ ] **Step 8: Write the sanitized baseline**

Create `docs/superpowers/baselines/2026-07-13-native-visual-teaching-composer-baseline.md` containing:

```markdown
# Native Visual Teaching Composer Baseline

- Branch and commit under review
- Sanitized automated test totals and command exits
- Real private smoke pass/fail and non-identifying counts only
- Source-step and objective coverage ratios
- Visual grammar, explanatory structure, and plain-scene ratios
- Overflow, uneditable-text, and full-slide-raster counts
- Provider class and model identifier without keys or request content
- User rendered-artifact approval status
- Safe/off flag posture and confirmation that no deployment or production env changed
- Known residual risks and separately authorized rollout steps
```

- [ ] **Step 9: Commit the verified baseline**

```bash
git add docs/superpowers/baselines/2026-07-13-native-visual-teaching-composer-baseline.md
git commit -m "docs: record visual teaching composer baseline"
```

- [ ] **Step 10: Run final verification**

```bash
npm test
npm run typecheck
npm run build
git diff --check f5dd247..HEAD
git status --short --branch
```

Expected: all commands pass and the worktree is clean.

## Required Implementation Report

The executor reports:

1. worktree, branch, base, and every commit;
2. exact changed-file set against `f5dd247`;
3. RED output for each task and final GREEN outputs;
4. disposition counts and proof that planning/administrative material is not visible;
5. composer call/repair counts, provider/model metadata, and no-secret proof;
6. source-step, objective, evidence, output, assessment, and order preservation;
7. visual grammar and quality-threshold results;
8. native editability, overflow, off-canvas, full-slide raster, preview/PPTX parity, and artifact inspection results;
9. real-DOCX browser smoke counts and user rendered-artifact approval;
10. forbidden-scope and private-artifact proof;
11. production flag/deployment posture;
12. deviations, residual risks, and follow-ups requiring separate authority.
