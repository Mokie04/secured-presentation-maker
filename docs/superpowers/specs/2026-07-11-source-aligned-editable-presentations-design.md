# Source-Aligned Editable Presentation System Design

**Status:** Architecture approved on 2026-07-11; implementation is pending final specification review.

**Scope:** K-12 lesson-plan uploads in `secured-presentation-maker`.

## Problem

The current system can extract much of an uploaded lesson plan, but it does not carry a durable source contract through generation. It flattens document structure, asks a text model to reconstruct and summarize the lesson, and renders nearly every result as a title, bullets, and one image. This causes two separate failures:

1. Instructional drift: objectives, source steps, session boundaries, required outputs, and assessments can be merged, omitted, rewritten, or reordered.
2. Weak presentation design: the renderer cannot express comparisons, process diagrams, sorting boards, worked examples, question/reveal pairs, or other visual teaching structures.

The supplied Grade 9 Science DOCX is a five-session matrix. It proves that the source parser must support ordered session-specific content, explicit blanks, shared fields, and nested paragraphs. Its use of a 5E flow is fixture-specific and must not become a global schema.

The supplied NotebookLM PowerPoint is a useful storytelling reference but not a suitable technical output format. It contains 21 slides, each made from one flattened 1376 x 768 PNG. It has no editable text, shapes, tables, diagrams, speaker notes, alt text, or semantic reading order. Its strengths are its teaching arc, semantic color system, and relationship-specific layouts.

Reference artifacts, retained outside Git:

- `/Users/johnnavarro/Downloads/Word Docs/2026July/Week 4 Grade 9 Science - Infer relationships among current, voltage, and resistance in series and parallel circuits (8).docx`
  - SHA-256: `d31f05a8f503f670a234580d560ffcb3131f11887d8065c9c50068f27fdcc1c8`
- `/Users/johnnavarro/Downloads/PPT/2026July/The_Three_Domains_of_Life.pptx`
  - SHA-256: `d633b55501f5e0ed09919160c550f6eb17dbace2904d390be15012e1815e0f71`

The original artifacts must not be committed. Tests must use sanitized fixtures with equivalent structural properties and distinctive sentinels.

## Product Definition

The product converts an authoritative lesson plan into a visually coherent, learner-facing, editable presentation for one selected lesson session or unit.

Alignment is semantic rather than verbatim. The system must preserve the source's instructional purpose, sequence, objective mapping, required task, evidence, output, assessment, constraints, and blank fields. It may translate teacher-oriented prose into direct learner prompts and concise explanations.

Example transformation:

```text
Source:
The teacher presents a faulty circuit and asks which reading learners would take first.

Learner-facing slide:
Title: Where Would You Test First?
Prompt: Choose the first meter reading you would take. Defend your choice.

Speaker notes:
Present the faulty circuit. Ask learners to cite the relevant safety rule and
explain why their proposed reading should reveal the fault.
```

The source sentence remains attached through provenance metadata. It is not copied awkwardly onto the visible slide.

## Locked Architecture Decisions

### 1. Uploaded lesson plans are source-primary

- Uploaded content never enters a reusable topic-seed route.
- Source-primary and topic-only generations have different cache identities.
- Ambiguous or unsupported extraction fails visibly instead of falling back to a generic topic deck.

### 2. Lesson-plan formats are not hard-coded

- 5E, 4A, MATATAG, traditional DLL/DLP, and teacher-defined formats are inputs, not internal schemas.
- Instructional flow is represented as ordered source-defined steps.
- Raw labels are retained as provenance but are not forced into visible slide titles.
- A missing phase is never inserted merely because a pedagogical template names it.

### 3. Fidelity is not literal scripting

- Teacher actions become learner-facing prompts, tasks, questions, visuals, or speaker notes.
- Named activities may remain visible when useful.
- Official objective count, order, and source meaning remain one-to-one. A learner-facing objective may be clearer than the source wording, but it cannot consolidate or expand multiple objectives.
- Source defects and contradictions are preserved and surfaced for teacher review; they are not silently corrected.

### 4. Native editable slides are the default

- Visible titles, prompts, labels, tables, arrows, cards, diagrams, and answers are native PowerPoint objects.
- Photos and complex illustrations may remain raster assets.
- Full-slide rasterization is not used unless the user explicitly chooses an image-only export.
- Exported PPTX editability is required in the first release. Full in-app editing of every slide element is deferred.

### 5. AI-generated images are assets, not slide canvases

- Image models generate text-free photos, illustrations, textures, or complex cutouts.
- Text, labels, diagrams, and layout are composed deterministically.
- An image failure falls back to an editable layout and must not normally fail the deck.

### 6. Models remain replaceable

- Text and image providers sit behind existing or focused adapter boundaries.
- The source contract, storyboard schema, validators, and renderers do not depend on one provider.
- Model selection follows fixture-based evaluation after the deterministic contracts exist.

## Goals

- Preserve uploaded source authority and selected-session isolation.
- Produce natural learner-facing screens without visible teacher-script language.
- Support arbitrary source flow labels and formats.
- Create a coherent teaching story rather than a sequence of summaries.
- Use semantic layouts whose visual form explains the relationship being taught.
- Maintain a deck-level visual system across all slides in a session.
- Export editable, searchable, accessible PowerPoint content.
- Fail closed on source and alignment errors while degrading gracefully on optional assets.
- Make rollout measurable and reversible.

## Non-Goals for the Initial Release

- Recreating NotebookLM branding, watermark, or proprietary implementation.
- Generating an entire slide as one AI image.
- Correcting lesson-plan pedagogy, science, grammar, or resource conflicts without teacher approval.
- OCR support for fully scanned documents. Unsupported scanned input must be reported clearly.
- Full freeform design editing inside the web application.
- Replacing every current model or image provider before the new contracts are validated.
- Supporting every possible semantic layout in the first release.

## Core Data Contracts

The names below are conceptual contracts. Exact TypeScript placement is determined in the implementation plan.

### LessonSourceManifest

```ts
type SourceFieldState = 'present' | 'blank' | 'missing' | 'ambiguous';

interface LessonSourceManifest {
  contractVersion: string;
  provenance: {
    origin: 'uploaded-file';
    format: 'docx' | 'pdf' | 'txt' | 'md';
    fileName: string;
    sourceHash: string;
  };
  metadata: Record<string, SourceField>;
  objectives: SourceObjective[];
  units: SourceUnit[];
  diagnostics: SourceDiagnostic[];
}

interface SourceUnit {
  id: string;
  sourceOrdinal: number;
  sourceLabel: string;
  objectiveIds: string[];
  steps: SourceStep[];
  fields: Record<string, SourceField>;
}

interface SourceStep {
  id: string;
  sourceOrder: number;
  sourceLabel: string;
  rawBlocks: string[];
  durationMinutes?: number;
  fieldState: SourceFieldState;
  sourceLocation: SourceLocation;
}
```

The manifest preserves paragraph and list boundaries. Shared table cells are attached explicitly to every applicable unit rather than accidentally belonging only to the first physical column.

### TeachingStoryboard

```ts
interface StoryboardScreen {
  id: string;
  sourceStepIds: string[];
  sourceObjectiveIds: string[];
  instructionalPurpose: string;
  learnerTitle: string;
  learnerContent: StructuredLearnerContent;
  teacherNotes: string;
  requiredEvidence: string[];
  communicationIntent: SlideIntent;
  pairId?: string;
  pairRole?: 'prompt' | 'reveal';
}
```

The storyboard is the audience-translation boundary. It may simplify language and split a dense source step into adjacent screens. It may merge only adjacent micro-steps when every source requirement remains mapped. It cannot reorder, replace, or invent source-backed work.

Every source field must be accounted for as one of:

- visible learner content;
- teacher notes;
- deck metadata;
- intentionally omitted administrative or scaffold text under an explicit policy.

### DeckVisualSystem

One visual system is created for the complete selected session:

```ts
interface DeckVisualSystem {
  visualSystemVersion: string;
  palette: VisualPalette;
  semanticColors: Record<string, string>;
  typography: TypographyTokens;
  backgroundTreatment: string;
  iconStyle: string;
  diagramStyle: string;
  illustrationStyle: string;
  shapeLanguage: ShapeTokens;
}
```

Semantic concepts retain the same color and visual identity throughout teaching, practice, feedback, and closure. The visual system is generated once, validated, then reused; it is not reinvented by each image prompt.

### SemanticSlideSpec

The model selects communication intent and fills structured slots. It does not choose coordinates.

Initial intent library:

- visual thesis or advance organizer;
- prior-knowledge retrieval;
- learning targets;
- concept model;
- parallel profiles;
- comparison matrix;
- containment or classification map;
- process or reasoning flow;
- activity board;
- guided example;
- discussion prompt;
- question;
- answer reveal;
- exit ticket;
- wrap-up and forward hook.

Not every lesson uses every intent. Intent selection must remain source-backed.

```ts
interface SemanticSlideSpec {
  id: string;
  storyboardScreenId: string;
  sourceStepIds: string[];
  layoutId: string;
  slots: Record<string, SlideSlotValue>;
  assetRequests: AssetRequest[];
  accessibility: AccessibilitySpec;
}
```

### CompiledSlideScene

A deterministic compiler maps `layoutId`, slots, and visual-system tokens into a normalized scene. The same compiled scene feeds the web preview and PPTX exporter.

The scene may contain editable:

- text;
- shapes and cards;
- tables;
- arrows and connectors;
- groups;
- SVG icons;
- images with crop and alt-text metadata;
- speaker notes.

The current `Slide` model remains available to the legacy route during rollout. New scene metadata must not be shoehorned into the existing `content: string[]` abstraction.

## System Components

### Input and route policy

Responsibilities:

- determine `uploaded-file` versus `topic-only` from actual input state;
- select source-primary or legacy route before cache lookup;
- assign contract and cache versions;
- prevent reusable seed calls for uploaded sources.

### Format adapters

Responsibilities:

- convert DOCX, PDF, TXT, and Markdown into block- and table-aware intermediate structures;
- preserve internal paragraphs, lists, table spans, explicit blanks, and source locations;
- report unsupported and ambiguous structures.

Format adapters do not generate presentation language.

### Source normalizer and validator

Responsibilities:

- construct `LessonSourceManifest`;
- identify units, objectives, ordered source steps, and shared fields without imposing a pedagogy taxonomy;
- validate isolation, exact counts, explicit blanks, and tail preservation.

### Storyboard service

Responsibilities:

- translate teacher-oriented source content into learner-facing screens and speaker notes;
- preserve source references on every screen;
- plan prompt/reveal and worked-example pairs only when answers are source-backed or deterministically verifiable;
- avoid generic summaries and fixed slide-count targets.

### Visual-system service

Responsibilities:

- select deck-level tokens and semantic colors from subject matter and source concepts;
- keep visual identity consistent across slides;
- produce provider-independent, text-free asset briefs.

### Layout compiler

Responsibilities:

- choose a compatible layout variant from the semantic intent and content density;
- place elements using deterministic constraints;
- reject overflow or incompatible slot data;
- compile the same scene for preview and export.

### Asset resolver

Resolution order:

1. deterministic native shape or table;
2. bundled or curated SVG icon;
3. approved cached educational visual;
4. external licensed photo when appropriate;
5. generated text-free illustration or photo;
6. editable no-image fallback.

Asset requests include subject, concept, visual role, semantic colors, and visual-system version. They exclude teacher names, learner data, school information, and administrative document content.

### Validators

Validation is layered:

1. source contract validation;
2. storyboard-to-source validation;
3. semantic-slide-to-storyboard validation;
4. scene layout and accessibility validation;
5. rendered artifact validation;
6. PPTX semantic round-trip validation.

Invalid required content fails closed before cache write or delivery.

## End-to-End Data Flow

```text
Uploaded file
  -> safe format adapter
  -> LessonSourceManifest
  -> source validator
  -> selected unit/session
  -> TeachingStoryboard
  -> storyboard alignment validator
  -> DeckVisualSystem
  -> SemanticSlideSpec[]
  -> slide-spec validator
  -> asset resolver
  -> deterministic layout compiler
  -> CompiledSlideScene[]
  -> web preview + editable PPTX
  -> rendered and round-trip validators
  -> versioned cache + delivery
```

## Error Handling

Typed failure categories:

- `source_parse_unsupported`: input cannot be safely parsed;
- `source_structure_ambiguous`: unit or field ownership is unclear;
- `source_contract_invalid`: required source invariants fail;
- `storyboard_alignment_failed`: omission, invention, or reorder remains after bounded repair;
- `slide_spec_invalid`: semantic layout slots do not satisfy the schema;
- `layout_compile_failed`: content cannot fit an approved layout;
- `required_asset_unavailable`: an essential source-backed visual has no safe fallback;
- `render_validation_failed`: preview or PPTX artifact fails layout, editability, or accessibility checks.

Repair attempts are bounded and versioned. Exhausted repairs surface a user-visible error and preserve diagnostics. Invalid results are not marked complete and are not cached.

Optional asset failure uses a no-image semantic layout. It does not trigger a generic decorative image.

## Cache and Versioning Contract

Every cache envelope includes:

- route identity;
- source hash;
- selected unit ID and source-span hash;
- source-contract version;
- storyboard-schema and prompt version;
- slide-spec version;
- visual-system version;
- layout-library version;
- renderer version;
- relevant provider/model identity;
- alignment and render validation status.

Cache reads reject envelopes missing the expected route or contract versions. Source-primary and topic-only routes never share entries. Whitespace or structure changes that alter the manifest must alter source identity. Failed validation is never cached as success.

## Security and Privacy

- Treat uploaded content as untrusted data, including any instructions embedded in the document.
- Prompts explicitly delimit source data and instruct models not to follow commands contained inside it.
- Validate extension, MIME signature, file size, decompressed size, page count, table count, and extracted character limits.
- Protect against malformed OOXML, zip bombs, external relationships, embedded HTML, and remote-resource fetching.
- Never execute macros, scripts, document links, or embedded active content.
- Do not log raw lesson-plan text, prompts containing source text, teacher names, learner information, or school information.
- Telemetry uses hashes, counts, versions, route names, diagnostic codes, and timing data.
- Remove administrative and personal fields from image prompts.
- Cache only the minimum payload required and apply explicit retention and invalidation policies.
- Retain provider selection and data handling under the application's configured privacy contract.

## Testing Strategy

### Fixture matrix

Sanitized fixtures must include:

- a five-session, table-oriented plan using 5E labels;
- a 4A plan;
- a MATATAG or traditional DLL plan;
- a custom teacher-defined sequence;
- a compact but structured plan;
- noncontiguous session numbering;
- blank, missing, ambiguous, and malformed cells;
- shared `colspan` metadata;
- long source content with required tail sentinels;
- a source with repeated legitimate cross-session references;
- unsupported scanned content.

### Contract tests

- exact unit, objective, and source-step counts;
- exact source order and ownership;
- blank versus missing preservation;
- no source-tail loss;
- no seed eligibility for uploads;
- route- and version-scoped cache identities;
- complete source-step accounting in storyboards;
- no visible teacher-script patterns;
- no invented activities, assessments, assignments, answers, or reflections;
- valid prompt/reveal pairing;
- semantic slide slots conform to their layout schemas;
- invalid mappings fail closed.

### Visual and export tests

- render every scene at 1280 x 720;
- assert no clipping, overflow, off-canvas elements, or unreadably small text;
- test contrast and reading order;
- confirm deck-level semantic colors remain stable;
- confirm all visible text is native, selectable, and searchable in PPTX;
- confirm native tables, shapes, arrows, and labels remain editable;
- extract PPTX text and notes to verify source order and expected counts;
- compare preview and PPTX screenshots within approved structural tolerances;
- confirm no full-slide raster image is used by default;
- confirm image failure produces a valid editable fallback.

### Artifact bundle

Every golden end-to-end fixture produces:

```text
lesson-source-manifest.json
teaching-storyboard.json
deck-visual-system.json
semantic-slide-specs.json
alignment-report.json
render-report.json
rendered-slides/
editable-output.pptx
```

## Release Gates

### Gate 0: Baseline, source authority, and reversibility

Deliverables:

- explicit source-primary versus topic-only route policy;
- upload seed exclusion in weekly and per-unit generation;
- route/version-scoped browser cache keys;
- feature flag and kill switch;
- sanitized source fixtures and baseline artifact capture;
- no prompt, response-schema, model, image, layout, or export behavior changes.

Exit criteria:

- seed-matching uploaded fixtures call no reusable-seed functions;
- identical topic-only text retains current seed eligibility;
- old unscoped uploaded cache entries are rejected;
- legacy route remains unchanged with the flag off;
- focused tests, typecheck, build, and diff checks pass.

Gate 0 is containment and characterization. It must not be represented as the complete alignment fix.

### Gate 1: Format-agnostic source manifest

Exit criteria:

- exact expected units and one-to-one objective mapping;
- stable, monotonic source-step IDs;
- zero cross-unit ownership leakage;
- exact blank/missing states;
- no silent truncation;
- unsupported or ambiguous input fails visibly.

### Gate 2: Source-bound teaching storyboard

Exit criteria:

- mandatory source-step accounting: 100%;
- foreign or invented steps: 0;
- order inversions: 0;
- visible teacher-script violations: 0;
- source objectives remain one-to-one in count, order, and meaning;
- required evidence and outputs remain attached;
- sample storyboard passes teacher review before layout work begins.

### Gate 3: Semantic slide schema and native renderer

Initial release uses a bounded layout library rather than unlimited generative layout.

Exit criteria:

- at least 80% of non-title instructional slides use a semantic layout rather than generic bullets;
- no overflow at 16:9;
- preview and PPTX share the same compiled scene contract;
- visible text and instructional structures are editable;
- legacy `Slide` rendering remains available behind the feature flag.

### Gate 4: Deck visual system and asset pipeline

Exit criteria:

- one validated visual system per selected unit;
- consistent semantic colors and entity appearance;
- no text generated inside images;
- every asset is instructional, source-backed, or safely omitted;
- optional asset failure preserves a usable editable slide;
- cost and concurrency obey configured ceilings.

### Gate 5: End-to-end hard validation

Release thresholds:

- mandatory source-step coverage: 100%;
- objective count/order/meaning: 100%;
- sequence inversions: 0;
- foreign-session content: 0;
- unsupported inventions: 0;
- blank-field inventions: 0;
- visible teacher-script violations: 0;
- visible editable text: 100%;
- full-slide raster images: 0 by default;
- invalid artifact cache writes: 0.

### Gate 6: Controlled rollout

- internal fixtures and artifact review;
- teacher side-by-side review against the legacy output;
- opt-in beta;
- canary rollout at 5%, then 25%, then 100%;
- progression requires stable alignment, render, latency, cost, and teacher-review metrics;
- immediate rollback remains available through the feature flag and versioned caches.

## Observability

Per generation, record only non-sensitive operational metadata:

- source origin, format, byte/page/character counts, and source hash prefix;
- parser and contract versions;
- unit, objective, source-step, storyboard-screen, and slide counts;
- route and cache-hit status;
- missing, duplicate, foreign, inverted, ambiguous, and blank-field counts;
- visible teacher-script violation count;
- layout IDs and fallback counts;
- asset source, cache status, failure code, latency, and cost class;
- model/provider identifiers and finish reasons when available;
- render and round-trip validation status;
- total latency and bounded repair attempts.

Do not record source text, generated learner content, teacher notes, or image prompts containing source details in routine telemetry.

## Delivery and Review Process

- One release gate per implementation plan and primary pull request.
- Each gate begins with failing characterization or contract tests.
- Each gate ends with its own artifact and verification report.
- No downstream gate may weaken an upstream invariant.
- Prompt tuning cannot substitute for a missing deterministic contract.
- Model changes cannot be combined with parser, schema, or renderer changes unless a gate specifically requires them.
- The master-planner review happens between gates before the next developer prompt is issued.

Required handoff after every gate:

1. files changed;
2. contract implemented;
3. tests added;
4. exact verification output;
5. artifacts produced;
6. remaining known gaps;
7. Git diff summary;
8. confirmation that later-gate areas were untouched.

## Risks and Mitigations

### Overfitting to the supplied fixtures

Mitigation: include several lesson formats and a custom unknown sequence. Treat source labels as data, not enums.

### Replacing awkward scripting with unsupported invention

Mitigation: require source-step IDs, evidence mapping, one-to-one objectives, and explicit accounting for every generated screen.

### Semantic layouts becoming another rigid template system

Mitigation: layouts represent communication relationships, not pedagogical phases. Support variants selected by slot shape and density.

### Preview and PPTX diverging

Mitigation: compile one normalized slide scene and implement renderer conformance tests against it.

### Image cost and latency dominating generation

Mitigation: prefer native structures, SVG icons, curated assets, and cache reuse. Generate only essential text-free assets under configured ceilings.

### Fail-closed validation increasing visible errors

Mitigation: ship behind a feature flag, provide actionable diagnostics, preserve quota rollback, and maintain the legacy fallback while the beta is opt-in.

### Large changes accumulating in `App.tsx` and `geminiService.ts`

Mitigation: add focused policy, source-contract, storyboard, compiler, renderer, and validator modules. Integrate through narrow orchestration seams without broad unrelated refactoring.

## Definition of Done

The initiative is complete only when a structured uploaded lesson plan can generate a selected-session deck that:

- demonstrably maps every required screen to the source;
- preserves the instructional sequence and required evidence;
- uses direct learner-facing language while retaining teacher actions in notes;
- does not expose or enforce the source pedagogy labels as slide titles;
- uses a coherent deck-level visual system and relationship-specific layouts;
- uses images only where they materially help instruction;
- exports editable, searchable, accessible PowerPoint content;
- passes deterministic alignment, visual, security, and round-trip gates;
- can be safely rolled back without serving stale incompatible cache entries.

Implementation does not begin until this specification is reviewed and accepted.
