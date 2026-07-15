# Native Visual Teaching Composer Design

**Status:** Architecture approved on 2026-07-13; written specification awaiting review.

**Scope:** Source-primary weekly and single-session presentation generation in `secured-presentation-maker`.

## Outcome

The application must turn an uploaded lesson plan into a source-aligned, learner-facing presentation with the visual hierarchy and teaching clarity of the supplied NotebookLM reference while retaining editable native PowerPoint text, shapes, tables, diagrams, connectors, and speaker notes.

The target is not a prettier version of the current title-and-paragraph deck. It is a visual teaching narrative: each slide communicates one purposeful instructional move, uses a layout that explains the relationship, and keeps teacher directions or planning scaffolds out of learner-visible content.

The implementation must remain format-agnostic. The supplied Grade 9 circuits lesson and NotebookLM deck are private external acceptance artifacts, not templates, schemas, or committed fixtures.

## Root Cause

Gates 0-6 correctly protect source authority, provenance, editability, privacy, validation, and rollout. They do not currently perform the creative transformation promised by the original architecture.

The current Gate 2-to-Gate 3 path mostly performs this mapping:

```text
one source step
  -> one storyboard screen with a source-derived title and prose
  -> one semantic slide with generic slots
  -> one editable title-and-body layout
```

As a result, a deck can pass every alignment and rendering validator while still exposing planning labels, flattening assessments, repeating generic titles, containing paragraph dumps, and using no meaningful visual explanation.

This is an architectural omission, not a sequence of parser defects. The fix is a dedicated visual teaching composition boundary between the source-bound storyboard and semantic slide compilation.

## Locked Product Decisions

1. The target is the approved **native visual teaching composer** direction.
2. Learner-facing text, diagrams, tables, labels, arrows, cards, and assessment controls are editable PowerPoint objects.
3. Full-slide raster images are forbidden on this route.
4. AI may plan and condense source-backed teaching scenes, but it may not bypass deterministic source, quality, privacy, layout, or export validation.
5. Generated images are optional text-free assets. They do not contain slide copy or replace native diagrams.
6. Teacher actions, administrative fields, references, contextual planning notes, and pedagogical scaffolds do not become visible slides unless the source explicitly makes them learner-facing.
7. Lesson formats such as 5E, 4A, MATATAG, DLL/DLP, and custom flows remain source data. No named lesson-plan format is hard-coded into the composer.
8. A provider failure or quality failure must not silently deliver the current generic deck. The route either produces a quality-valid native deck or reports a clear recoverable failure.

## Architecture

### Pipeline

```text
Uploaded source
  -> Gate 0 route authority
  -> Gate 1 LessonSourceManifest
  -> Gate 2 TeachingStoryboard
  -> Gate 3.5 Native Visual Teaching Composer
       1. source-content disposition
       2. session teaching-arc planning
       3. structured visual-scene planning
       4. source reconciliation
       5. presentation-quality validation
  -> Gate 3 SemanticSlideSpec and native scene compiler
  -> Gate 4 visual system and optional asset resolution
  -> Gate 5 delivery and round-trip validation
  -> Gate 6 controlled rollout
```

Gate 3.5 consumes validated Gate 1 and Gate 2 contracts. It never reparses the uploaded document and never calls the legacy slide prompt. Gates 3-5 remain the authority for coordinates, native editability, overflow, preview/PPTX parity, and final delivery.

### Component Boundaries

#### Source Content Disposition Policy

A deterministic policy classifies every selected source objective, step, and field as one of:

- `learner-visible`: required visible explanation, prompt, task, evidence, output, or assessment;
- `speaker-notes`: teacher action, facilitation guidance, pacing, preparation, or contextual explanation;
- `deck-metadata`: title, session label, subject, grade, or provenance;
- `merge-context`: source-backed context that may be condensed into an adjacent visible scene;
- `omit-administrative`: administrative or planning-only material omitted under an explicit reason code.

Every classification retains source IDs and a reason code. Omission is never inferred merely because content is difficult to present.

Examples of normally non-visible material include `References`, teacher preparation instructions, learner-context observations, AI-use declarations, and planning labels such as intentions or ways forward. If a source step instructs learners to consult or evaluate a reference, that learner-facing action remains visible.

#### Teaching Arc Planner

The planner groups adjacent source-backed material into a coherent session arc without reordering source requirements. It chooses only the moves supported by the source, such as:

- orient or provoke;
- establish the learning target;
- explain a concept or relationship;
- model a process or worked example;
- guide an activity;
- capture evidence or output;
- check understanding;
- synthesize or transfer.

These are communication roles, not a replacement lesson-plan format. A session does not receive a missing role merely to complete a template.

The planner may merge adjacent micro-steps or split dense steps. It must preserve objective ownership, step order, required evidence, required outputs, assessment meaning, and teacher-note provenance.

#### Structured Visual Scene Planner

The planner produces a `VisualTeachingPlan`, not slide coordinates or PowerPoint operations.

```ts
type VisualTeachingPlan = {
  contractVersion: 'visual-teaching-plan-v1';
  unitId: string;
  sourceObjectiveIds: string[];
  scenes: VisualTeachingScene[];
  sourceAccounting: VisualSourceAccountingEntry[];
};

type VisualTeachingScene = {
  id: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  storyboardScreenIds: string[];
  teachingMove: TeachingMove;
  learnerTitle: string;
  visibleContent: StructuredVisibleContent;
  visualGrammar: VisualGrammar;
  teacherNotes: string;
  requiredEvidence: string[];
  requiredOutputs: string[];
  assetBrief?: TextFreeAssetBrief;
};
```

`StructuredVisibleContent` supports purposeful structures rather than a generic string array:

- concise explanation with emphasized concepts;
- question with separately parsed choices;
- prediction and reveal;
- step sequence;
- comparison rows and columns;
- evidence table;
- claim-evidence-reasoning board;
- worked-example stages;
- activity directions, materials, roles, and output criteria;
- labeled entities and relationships.

`VisualGrammar` describes semantic structure while leaving coordinates to the existing compiler:

- `concept-map`;
- `relationship-diagram`;
- `process-flow`;
- `comparison-panels`;
- `classification-map`;
- `timeline`;
- `data-table`;
- `worked-example`;
- `activity-board`;
- `question-choices`;
- `evidence-board`;
- `visual-thesis`;
- `image-led-explanation`;
- `minimal-statement` for the small number of slides that should remain typographic.

The grammar is subject-neutral. A circuits lesson may instantiate nodes, connectors, meters, energy-flow arrows, and series/parallel branches, but the contract does not contain circuit-specific slide IDs or Grade 9-specific rules.

#### Native Visual Primitive Library

Gate 3 gains bounded reusable primitives that compile visual grammar into editable scene elements:

- cards, bands, chips, callouts, legends, and numbered steps;
- nodes, ports, connectors, arrows, branches, and containers;
- comparison and classification panels;
- tables, axes, scales, and evidence grids;
- generic scientific symbols and simple apparatus components;
- question, choice, reveal, and rubric structures;
- optional SVG icons treated as native vector assets.

The first implementation extends existing compiler patterns rather than introducing a free-coordinate AI renderer. Subject-specific symbol packs may be added incrementally behind the generic diagram contract.

## AI and Provider Strategy

The composer is quality-first and provider-replaceable.

### Text Composition

The model receives only the selected unit's sanitized manifest/storyboard content, source IDs, disposition decisions, allowed visual grammar, and a strict output contract. It returns a structured teaching plan. It does not receive rendering coordinates, private unrelated units, cache secrets, or provider credentials.

The initial implementation uses the existing server-side `AI_TEXT_PROVIDER` boundary. Gemini is not required. Provider candidates already supported by the repository include DeepSeek and xAI.

The release candidate is selected through a fixture evaluation rather than assumption:

- schema conformance;
- source-step and objective fidelity;
- teacher-script separation;
- assessment parsing;
- title and language quality;
- visual-grammar appropriateness;
- latency and estimated cost.

Current official provider capabilities support this approach: DeepSeek V4 offers JSON-object output, while xAI supports JSON-Schema structured outputs. The recommended initial quality candidate is `grok-4.3`; `deepseek-v4-pro` is the cost-conscious comparison candidate. Regardless of provider guarantees, local validators remain authoritative.

Provider capability references:

- <https://docs.x.ai/developers/model-capabilities/text/structured-outputs>
- <https://docs.x.ai/developers/models>
- <https://api-docs.deepseek.com/guides/json_mode/>
- <https://api-docs.deepseek.com/quick_start/pricing>

### Images

Native diagrams, shapes, tables, and icons are preferred because they are editable and precise. The existing curated/cache-first asset pipeline remains in front of paid generation.

An image is requested only when a real-world observation, setting, object, or complex illustration materially improves instruction and cannot be represented adequately with native primitives. The request must be text-free, source-safe, and tied to a scene's instructional purpose.

The existing image-provider adapters remain available. The first implementation does not require changing the production provider. Provider comparison may evaluate the configured Replicate FLUX path and xAI Imagine on a small approved visual set, but model selection is deployment configuration, not part of the core contract.

## Deterministic Reconciliation and Validation

AI output is untrusted until reconciled.

The reconciler verifies:

- every referenced source, storyboard, and objective ID exists and belongs to the selected unit;
- source order has no inversion;
- every learner-visible source requirement is represented exactly once or explicitly merged;
- omitted content has an allowed disposition and reason;
- objectives, required evidence, required outputs, and assessments preserve source meaning;
- no teacher-script or administrative planning language is visible;
- no invented activity, answer, assessment, fact, material, or requirement is introduced;
- blank or missing source fields are not filled with invented content.

One bounded repair call may receive validator diagnostics and the invalid plan. The repaired plan is revalidated from scratch. If it remains invalid, generation stops with a clear composition error; it does not fall through to a generic deck.

## Presentation Quality Gate

Alignment alone is insufficient. A new deterministic quality report blocks delivery when a deck exhibits the known failure modes.

### Blocking Rules

- visible administrative or planning-only labels;
- a references/resources slide unless learners must use or evaluate those references;
- concatenated or unparsed assessment questions and choices;
- raw teacher actions in learner-visible content;
- a paragraph dump exceeding the bounded copy budget unless the source explicitly requires close reading of a quotation or passage;
- generic titles such as `Learning Task` repeated across the session;
- required relationships represented only as prose when an allowed native diagram or comparison grammar is available;
- full-slide raster output;
- uneditable learner-facing text;
- source or objective coverage below 100%;
- text overflow, off-canvas content, or preview/PPTX operation mismatch.

### Deck-Level Thresholds

- At least 75% of instructional slides use a meaningful visual grammar other than `minimal-statement`.
- At least 40% use explanatory structure such as a diagram, flow, comparison, table, worked example, evidence board, or structured assessment.
- No more than 25% of instructional slides may be plain title-and-body scenes.
- Duplicate normalized titles are blocked when they indicate generic repetition rather than a deliberate prompt/reveal pair.
- Slide count is advisory, normally 8-16 slides for a 45-60 minute session. Completeness and legibility take priority over truncation; unusually dense sources may exceed the budget with a diagnostic.

Thresholds are measured on sanitized fixtures and the private real-document smoke before rollout. They may be tightened, but not silently weakened to make a failing deck pass.

## Failure and Fallback Behavior

- Invalid or ambiguous source extraction continues to fail at Gate 1.
- Invalid storyboard translation continues to fail at Gate 2.
- Missing text-provider configuration for an enabled AI composer returns a clear configuration error.
- Provider timeout receives bounded retry and, when safe, one configured alternate-provider attempt.
- Invalid structured output receives at most one repair attempt.
- Optional image failure falls back to the same native scene without the image.
- Required visual explanation falls back to native grammar, not an unrelated stock image.
- If the quality gate fails, the app does not offer the failed presentation as a successful download.
- Legacy remains available only through the existing rollout decision. There is no silent per-request downgrade after source-primary generation begins.

## Rollout and Cache Safety

Add `VITE_VISUAL_TEACHING_COMPOSER_V1` as a source-primary-only capability flag. It is subordinate to the existing production arming and Gate 6 eligibility decision.

Composer cache identity includes:

- source hash and selected unit IDs;
- manifest, storyboard, composer, disposition-policy, and quality-policy versions;
- configured text provider and model;
- prompt/schema version;
- visual grammar library version.

No success-cache write or delivery occurs until the complete Gates 1-5 report, including the new quality report, passes.

## Testing Strategy

### Sanitized Automated Fixtures

Fixtures cover:

- five-session table-based lesson plan;
- 4A/custom flow to prove format independence;
- multiple objectives in one unit;
- planning labels, references, learner context, and AI-use declarations;
- teacher-script actions embedded in prose;
- dense activity directions with materials, roles, evidence, and output criteria;
- multiple-choice, constructed-response, and claim-evidence-reasoning assessments;
- science relationship content suitable for a diagram;
- humanities comparison and language-analysis content to prevent science hard-coding;
- blank, missing, ambiguous, and unsupported source states.

### Required Automated Proof

- 100% source-step and objective coverage;
- stable source ownership and ordering;
- correct disposition accounting;
- valid strict composer contract and bounded repair behavior;
- parsed assessments rather than raw text dumps;
- no visible teacher or planning script;
- meaningful visual-grammar coverage thresholds;
- native editable element proof;
- no full-slide raster;
- no overlap, overflow, or off-canvas content;
- preview/PPTX element and visible-text parity;
- no optional-image dependency for deck validity;
- legacy and disabled-flag behavior unchanged;
- cache version isolation and no invalid-success write.

### Private Acceptance Smoke

The supplied Grade 9 weekly DOCX is exercised through the actual browser upload adapter with source-primary flags enabled in a local or preview environment. Each session is generated independently.

For Session 1, the expected presentation should communicate a coherent source-backed arc such as concept orientation, circuit relationship models, guided activity, evidence capture, structured assessment, and synthesis. This example is an acceptance description, not a hard-coded sequence.

The generated PPTX is then:

1. extracted and inspected for native operations and media usage;
2. rendered to slide images;
3. reviewed side-by-side with the NotebookLM reference for hierarchy, visual rhythm, diagram quality, and teaching clarity;
4. checked for editable text, shapes, diagrams, tables, and notes;
5. rejected if it resembles the previously observed title-and-paragraph deck.

Private DOCX/PPTX files, extracted text, rendered slides, and screenshots stay outside Git.

## Implementation Slices

1. Contract, disposition policy, sanitized fixtures, and RED quality tests.
2. Provider-independent composer adapter, strict structured output, reconciliation, and bounded repair.
3. Visual grammar mapping into existing semantic specs and native compiler primitives.
4. Assessment, activity, comparison, flow, evidence, and diagram layouts.
5. Quality report integrated into Gate 5 delivery/cache safety.
6. Local real-DOCX browser generation, rendered PPTX review, and tuning.
7. Preview/canary rollout behind the new flag; production activation remains separately authorized.

Each slice must preserve a small changed-file set, prove RED before GREEN, and pass the full unit tests, typecheck, build, diff check, privacy scan, and real-artifact review appropriate to that slice.

## Non-Goals

- cloning NotebookLM branding or producing image-only slides;
- hard-coding the Grade 9 circuits source, 5E, or any lesson-plan template;
- replacing the existing source manifest, storyboard, scene, PPTX, or rollout contracts;
- allowing the AI model to choose coordinates or emit PowerPoint operations;
- automatically correcting source pedagogy or subject-matter errors;
- making every slide use an image;
- changing production providers, environment variables, deployment settings, or rollout state in the implementation PR;
- removing legacy fallback.

## Acceptance Criteria

The feature is ready for a controlled preview only when:

- the real weekly DOCX produces independent source-aligned session decks;
- the failed Session 1 artifact is replaced by a coherent visual teaching narrative;
- visible planning labels, reference dumps, paragraph dumps, and raw assessments are absent;
- visual structure explains the lesson rather than decorating it;
- all learner-facing text and instructional diagrams remain editable;
- optional images are instructionally relevant and source-safe;
- existing source, privacy, rendering, round-trip, cache, and rollout gates still pass;
- automated quality thresholds pass without fixture-specific exceptions;
- a rendered side-by-side review confirms a material improvement toward the NotebookLM reference;
- production activation remains off until the user explicitly approves rollout.
