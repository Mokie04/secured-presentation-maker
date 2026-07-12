# Gate 6 Controlled Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled, observable, reversible rollout layer for the source-primary compiled-scene path after Gates 0-5.

**Architecture:** Gate 6 sits outside the deterministic source, storyboard, semantic scene, visual-system, asset, and end-to-end validation contracts. It decides who may receive the source-primary compiled-scene route, records privacy-safe operational metrics, supports internal and teacher review, and preserves immediate rollback through feature flags and versioned route/cache controls. It must not reinterpret raw source text, change prompts, change models/providers, activate live image adapters, weaken validation, or force existing legacy users onto the new route.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Node 26 `node:test` with `--experimental-strip-types`, existing Gate 0-5 TypeScript contracts, existing browser cache utilities only if the implementation explicitly adds a source-primary scene cache envelope without package changes.

## Global Constraints

- Plan only in this commit. Do not implement production code while writing this plan.
- Uploaded lesson plans remain authoritative.
- Do not weaken Gate 0, Gate 1, Gate 2, Gate 3, Gate 4, or Gate 5 invariants.
- Do not modify prompts, model/provider selection, deployment environment variables, image provider behavior, or live image adapters.
- Do not turn on live curated, R2, licensed-photo, generated-image, or provider adapters.
- No rollout, deployment, push, pull request, production flag enablement, or production environment change in this gate-planning commit.
- No private DOCX, PPTX, PDF, images, rendered references, extracted lesson text, teacher names, learner data, or school-identifying content.
- Teacher-review artifacts must be privacy-safe and sanitized unless the user explicitly authorizes private local artifact review after this plan.
- Disabled Gate 6, disabled Gate 5, disabled Gate 4, disabled Gate 3, disabled source-primary routing, topic-only routes, and legacy routes must remain safe and unchanged according to their accepted gate contracts.
- Failed Gate 5 validation must still return no presentation, block delivery, and block successful cache write.
- Source-primary scene validation must continue to run before delivery/cache success whenever source-primary compiled scenes are delivered.

---

## Current Accepted Stack

Accepted Gate 5 source-primary scene delivery is currently reached after Gate 1 and Gate 2 preflight. In `App.tsx`, both K-12 paths resolve the source route, then immediately call source-manifest and teaching-storyboard boundaries before the Gate 5 scene boundary:

- single lesson flow: `resolveK12GenerationRoutePolicy(...)` around `App.tsx:3896`, then `resolveSourceManifestForGeneration(...)`, then `resolveTeachingStoryboardForGeneration(...)`, then `resolveEndToEndValidatedScenePresentationForGeneration(...)`;
- daily unit flow: `resolveK12GenerationRoutePolicy(...)` around `App.tsx:4118`, then `resolveSourceManifestForGeneration(...)`, then `resolveTeachingStoryboardForGeneration(...)`, then `resolveEndToEndValidatedScenePresentationForGeneration(...)`.

Gate 6 therefore cannot be inserted only immediately before the Gate 5 scene boundary. If an uploaded-file user is not eligible for source-primary compiled scenes, downstream code must see an effective legacy route before Gate 1/2 preflight.

The accepted Gate 5 scene boundary still receives an effective source-primary route only for rollout-eligible users:

```ts
resolveEndToEndValidatedScenePresentationForGeneration(
  effectiveRoutePolicy,
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

Gate 6 must compute the rollout/effective-route decision immediately after `resolveK12GenerationRoutePolicy(...)` and before `resolveSourceManifestForGeneration(...)` in both K-12 flows:

```ts
const originalRoutePolicy = resolveK12GenerationRoutePolicy(
  dllContent,
  SOURCE_PRIMARY_ROUTING_V1_FLAG,
);
const rolloutDecision = resolveSourcePrimarySceneRolloutEligibility(
  originalRoutePolicy,
  parseSourcePrimarySceneRolloutStage(SOURCE_PRIMARY_SCENE_ROLLOUT_V1_FLAG),
  {
    isAdmin: isAuthorizedAdmin,
    optedInToSourcePrimaryScenes,
    stableBucketSeed: safeSourceHashPrefix,
  },
);
const effectiveRoutePolicy = rolloutDecision.effectiveRoutePolicy;

const sourceManifestBoundary = resolveSourceManifestForGeneration(
  effectiveRoutePolicy,
  lessonSourceManifestResult,
);
```

Gate 6 must preserve the original route policy for rollout telemetry and diagnostics. All downstream generation, including Gate 1/2 preflight, legacy cache keys, reusable-seed eligibility, quota ordering, AI-call ordering, image processing, and delivery, must use `effectiveRoutePolicy`.

`safeSourceHashPrefix` may be derived only from an already-valid manifest/provenance object, for example `lessonSourceManifestResult.ok === true ? lessonSourceManifestResult.manifest.provenance.sourceHash.slice(0, 12) : undefined`. If that value is unavailable, canary stages must be ineligible and use the effective legacy route. Gate 6 must not derive canary seeds from raw uploaded lesson text, extracted source text, prompts, teacher notes, file paths, teacher names, learner data, or school information.

Gate 6 must consume only privacy-safe metadata already available from:

- `K12GenerationRoutePolicy`;
- `LessonSourceManifest`;
- `TeachingStoryboard`;
- `EndToEndValidationReport`;
- `CompiledScenePresentation`;
- Gate 4 asset request/resolution metadata when validation artifacts are included.

Gate 6 must not read raw source text directly for rollout eligibility or telemetry.

## Rollout Flags and Gates

Existing flags remain authoritative:

- `VITE_SOURCE_PRIMARY_ROUTING_V1`: Gate 0 source-primary routing boundary.
- `VITE_SEMANTIC_SLIDES_V1`: Gate 3 semantic compiled-scene route.
- `VITE_DECK_VISUAL_SYSTEM_V1`: Gate 4 visual-system and asset pipeline.
- `VITE_END_TO_END_VALIDATION_V1`: Gate 5 hard validation before scene delivery/cache success.

Add one Gate 6 rollout flag:

```ts
const SOURCE_PRIMARY_SCENE_ROLLOUT_V1_FLAG = import.meta.env.VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1;
```

Accepted flag values:

```ts
type SourcePrimarySceneRolloutStage =
  | 'off'
  | 'internal'
  | 'beta'
  | 'canary-5'
  | 'canary-25'
  | 'all';
```

Parsing rules:

- unset, empty, `0`, `false`, `off`: `off`;
- `internal`: admin-only internal fixture/review access;
- `beta`: explicit teacher/user opt-in only;
- `5`, `5%`, `canary-5`: deterministic 5 percent canary among eligible source-primary uploaded-file users;
- `25`, `25%`, `canary-25`: deterministic 25 percent canary among eligible source-primary uploaded-file users;
- `100`, `100%`, `all`: eligible source-primary uploaded-file users;
- all other values parse to `off` and emit a non-blocking rollout diagnostic.

Eligibility rules:

- Gate 6 applies only when `routePolicy.mode === 'source-primary'` and `routePolicy.inputOrigin === 'uploaded-file'`.
- Topic-only and legacy routes bypass Gate 6 unchanged.
- `internal` requires admin/internal preview context.
- `beta` requires explicit per-user or per-session opt-in. Opt-in state must not contain raw lesson text.
- Canary selection uses a stable, privacy-safe hash seed built from route name, source hash prefix, and a stable non-PII user/install bucket when available. If a source hash prefix is unavailable without relying on a valid manifest/provenance result, canary eligibility is false. Gate 6 must not read raw source text directly to make a canary decision.
- A user who is not eligible for the active rollout stage must continue on the accepted legacy path by using an effective legacy route policy before Gate 1 source-manifest preflight.
- The original route policy remains available only for rollout telemetry/diagnostics.
- The effective route policy is the only policy passed to `resolveSourceManifestForGeneration(...)`, `resolveTeachingStoryboardForGeneration(...)`, the Gate 5 scene boundary, cache-key construction, reusable-seed loading, quota-gated generation, image processing, and delivery.
- For `off`, malformed flag values, `internal` non-admin, `beta` not opted in, canary out-of-bucket, or missing safe canary seed:
  - `effectiveRoutePolicy.mode` is `legacy`;
  - `effectiveRoutePolicy.inputOrigin` preserves the original input origin, including `uploaded-file`;
  - `effectiveRoutePolicy.allowReusableSeeds` is `true`;
  - `effectiveRoutePolicy.cacheKeyParts` is `[]`;
  - source manifest validation is not required;
  - teaching storyboard build/validation is not run;
  - the Gate 5 scene boundary is not called;
  - legacy cache key, reusable-seed eligibility, quota ordering, AI-call ordering, image processing, and delivery behavior are preserved.
- For eligible source-primary users, `effectiveRoutePolicy` remains the original source-primary route. Those users proceed through Gate 1 manifest validation, Gate 2 storyboard validation, Gate 3 semantic scenes, Gate 4 visual-system/assets, and Gate 5 hard validation before delivery or successful cache write.
- Eligible stages may visibly block on Gate 1, Gate 2, or Gate 5 validation because those users are explicitly receiving the source-primary route.
- Gate 6 must never bypass Gate 5 validation for an eligible source-primary scene deck.

Disable and rollback order:

1. Set `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=off` to stop new source-primary compiled-scene delivery while leaving Gates 0-5 available for internal diagnosis.
2. If the issue is isolated to Gate 4 assets or visual-system behavior, set `VITE_DECK_VISUAL_SYSTEM_V1=false` and keep Gate 5 validation on any remaining scene route.
3. If the issue is any compiled-scene preview/PPTX behavior, set `VITE_SEMANTIC_SLIDES_V1=false` to return uploaded-file generation to the accepted legacy `Slide` route.
4. If source-primary preflight itself causes unacceptable blocking, set `VITE_SOURCE_PRIMARY_ROUTING_V1=false` to restore exact legacy uploaded-file routing and legacy cache identities.
5. Do not disable `VITE_END_TO_END_VALIDATION_V1` while any source-primary compiled-scene route is delivering presentations. Roll back the route instead of delivering unvalidated scenes.

## Internal Review Process

Inputs:

- Sanitized fixture documents only.
- Existing fixture families: five-session matrix, evidence/output, teacher-script, multi-objective, blank/missing, unsupported/ambiguous.
- No private DOCX/PPTX/PDF/images or extracted private source text committed.

Generated review artifacts:

- `EndToEndValidationReport` JSON exported locally for review only;
- web preview screenshots only from sanitized fixtures if an implementation task explicitly adds generated local artifacts outside Git;
- PPTX export from sanitized fixtures only, stored outside Git unless a later reviewed plan explicitly allows committed golden artifacts;
- fixture review checklist recorded as sanitized markdown, counts, and diagnostic codes only.

Internal checklist:

- Route: source-primary uploaded-file route selected only for uploaded fixtures.
- Manifest: expected unit, objective, source-step, blank/missing, and tail counts.
- Storyboard: 100 percent source-step accounting, no foreign steps, no visible teacher-script.
- Semantic specs: every storyboard screen mapped, objective count/order/ownership preserved, at least 80 percent semantic layout coverage for non-title instructional slides.
- Visual system/assets: one visual system per selected unit, stable semantic colors, no text-in-image briefs, optional asset failure keeps editable fallback.
- Render: 1280 by 720, no off-canvas elements, no overflow, no unreadable text, visible text editable.
- PPTX: native text/table/shape/image operations as applicable, notes present, no full-slide raster, source order preserved.
- Cache safety: failed validation blocks delivery and success cache write.

Internal exit criteria:

- `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check` pass on the rollout implementation branch.
- Every sanitized fixture has zero blocking Gate 5 diagnostics.
- Any intentional negative fixture emits only expected diagnostic codes.
- No privacy scan hit is unexplained.
- No production flags are enabled and no deployment is performed.

## Teacher Side-by-Side Review

Review shape:

- For each authorized teacher-review session, produce two local outputs from the same uploaded lesson plan:
  - legacy output from the accepted legacy `Slide` route;
  - source-primary compiled-scene output from Gates 0-5 plus Gate 6 eligibility.
- The teacher sees both decks side by side with labels `Legacy` and `Source-primary editable scene`.
- Review must not store raw lesson text, teacher notes, teacher names, learner data, school information, or private file names in telemetry.
- If private local artifact review is authorized, artifacts remain local or in an explicitly approved private review location and are never committed.

Rubric scored 1-5:

- Source alignment: objectives, activities, assessment, ownership, and timing match the uploaded lesson.
- Instructional flow: the presentation follows the lesson sequence and feels teachable.
- Editability: visible text, tables, shapes, arrows, diagrams, and speaker notes are editable/searchable in PPTX.
- Visual usefulness: visual system and assets clarify instruction rather than decorate it.
- Image safety: no random images, no text inside generated images, no full-slide raster output by default.
- PPTX usability: exported deck opens cleanly and remains useful in PowerPoint or compatible tools.
- Teacher trust: teacher would use or adapt the source-primary output for class.

Feedback collection:

- Store only numeric rubric scores, sanitized free-text summaries written by the reviewer, issue category codes, route/stage, contract versions, validation diagnostic codes, counts, latency, and cost class.
- Reviewer free text must be redacted before storage using a small banned-pattern scanner for names, school IDs, learner names, file paths, email addresses, phone numbers, and long copied source-like paragraphs.
- Any unredactable reviewer comment is kept out of telemetry and summarized manually as an issue category.

Teacher-review exit criteria for beta advancement:

- Minimum 10 authorized side-by-side reviews or a smaller explicitly approved pilot cohort.
- Average teacher-trust score at least 4.0 of 5.
- No P0 privacy, data-loss, uneditable-PPTX, wrong-session, or invented-assessment issue.
- Fewer than 10 percent P1 issues across reviewed decks.
- Every reported alignment issue has a linked validation or reviewed-gap category before canary begins.

## Beta and Canary Rollout Stages

### Stage 0: Internal Only

Entry:

- Gate 5 accepted.
- Gate 6 implementation tests pass.
- `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=internal`.
- All lower gates enabled only in non-production or admin-only preview context.

Exit:

- Sanitized fixture review passes.
- Internal preview and PPTX export checklist passes.
- No privacy/artifact violations.

Rollback:

- Set `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=off`.

### Stage 1: Opt-In Beta

Entry:

- Stage 0 exit criteria met.
- Explicit teacher/user opt-in UI or admin enrollment exists.
- Teacher review instructions and privacy disclosure are ready.
- No forced migration of existing legacy users.

Exit:

- Teacher-review exit criteria met.
- Gate 5 pass rate for delivered source-primary scene decks is at least 99 percent.
- Delivered scene decks have full-slide raster count 0 by default.
- p95 scene-route latency is no more than 2x comparable legacy generation or no more than 90 seconds, whichever is larger.
- Paid/generated image cost remains within configured ceilings and live provider adapters remain disabled unless a later approved gate enables them.

Rollback:

- Remove beta opt-in entitlement or set `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=off`.

### Stage 2: Canary 5 Percent

Entry:

- Stage 1 exit criteria met.
- Canary hash bucketing test proves deterministic 5 percent allocation with no raw source text in the seed.
- Observability dashboards or local reports show validation, render, PPTX, latency, cost, and teacher-review metrics.

Exit after at least one full review window:

- Gate 5 blocking failure delivery rate is 0 because failures are blocked before delivery.
- User-visible generation failure rate is no worse than legacy by more than 1 percentage point.
- p95 latency remains within beta threshold.
- Cost remains within configured ceiling.
- No P0/P1 privacy, wrong-session, cache-leakage, or unvalidated-scene incident.
- Teacher trust from canary follow-up remains at least 4.0 of 5 when feedback is available.

Rollback:

- Set rollout flag to `beta`, `internal`, or `off` depending on incident severity.

### Stage 3: Canary 25 Percent

Entry:

- Stage 2 exit criteria met.
- No unresolved P0/P1 issues.
- Cache/version isolation report confirms no legacy/source-primary cache sharing.

Exit:

- Same metrics as Stage 2 over the larger population.
- No sustained latency regression above threshold.
- No repeated optional asset failure pattern that materially reduces teacher trust.

Rollback:

- Set rollout flag to `canary-5`, `beta`, `internal`, or `off`.

### Stage 4: 100 Percent Eligible Source-Primary Users

Entry:

- Stage 3 exit criteria met.
- Rollback runbook tested.
- Teacher-review summary accepted by planner/user.
- Legacy route remains available through flags and unchanged topic-only behavior.

Exit:

- Source-primary compiled-scene route is default for eligible uploaded-file K-12 generation while lower-gate flags remain enabled.
- Legacy route is retained behind rollback controls.

Rollback:

- Use the disable order in this plan. Do not delete legacy cache or remove legacy route code during Gate 6.

## Observability Contract

Create a privacy-safe event builder in the later implementation. It may emit:

- route mode and input origin;
- rollout stage and eligibility reason;
- source format, byte count, page count when available, character count when available, and source hash prefix only;
- contract versions for source manifest, teaching storyboard, semantic slide spec, deck visual system, scene asset request/resolution, compiled slide scene, and end-to-end validation;
- unit, objective, source-step, storyboard-screen, semantic-spec, scene, asset-request, and resolved-asset counts;
- validation pass/fail booleans and diagnostic codes only;
- render validation status, PPTX operation validation status, and full-slide raster count;
- asset source kind, cost class, optional/required status, and failure code;
- cache route identity, cache envelope version, cache hit/miss, and cache rejection reason;
- latency buckets for extraction, manifest, storyboard, semantic/spec, visual/assets, scene compile, Gate 5 validation, export, and total generation;
- configured cost class and bounded paid-asset counters.

It must not emit:

- raw source text;
- generated learner-visible slide text;
- teacher notes;
- prompts containing source details;
- private file names;
- teacher names;
- learner names or data;
- school names, school IDs, email addresses, phone numbers, addresses, or local file paths;
- image prompts containing source-specific private details.

Telemetry redaction checks:

- Reject or redact any field over a short operational limit unless explicitly typed as a count, version, code, or hash.
- Reject strings matching common PII/school/file-path patterns.
- Allow only enumerated diagnostic codes and contract version strings.

## Cache and Version Policy

Accepted cache rules:

- Legacy `Slide` route and source-primary scene route never share cache entries.
- Topic-only generation remains legacy regardless of rollout flag.
- Gate 0 source-primary browser text-generation cache isolation remains intact.
- Gate 5 failed validation is never cached as success.

If Gate 6 adds successful source-primary scene caching later, the cache envelope must include:

```ts
type SourcePrimarySceneCacheEnvelope = {
  cacheContractVersion: 'source-primary-scene-cache-v1';
  routeIdentity: 'source-primary-compiled-scene';
  sourcePrimaryRouteVersion: 'source-primary-route-v1';
  rolloutVersion: 'source-primary-scene-rollout-v1';
  rolloutStageAtWrite: SourcePrimarySceneRolloutStage;
  sourceHashPrefix: string;
  selectedUnitIds: string[];
  sourceManifestVersion: string;
  teachingStoryboardVersion: string;
  semanticSlideSpecVersion: string;
  deckVisualSystemVersion: string;
  sceneAssetRequestVersion: string;
  sceneAssetResolutionVersion: string;
  compiledSceneVersion: string;
  endToEndValidationVersion: 'end-to-end-validation-v1';
  validationPassed: true;
  diagnostics: [];
  presentation: CompiledScenePresentation;
};
```

Read rules:

- Reject envelopes missing any expected contract/version field.
- Reject envelopes whose route identity is not `source-primary-compiled-scene`.
- Reject envelopes whose validation version differs from current Gate 5 validation.
- Reject envelopes with diagnostics or `validationPassed !== true`.
- Reject source-primary scene entries when rollout is disabled or the current user/session is not eligible.
- Rollback must ignore incompatible source-primary scene entries rather than migrating or deleting them.

## Operational Controls

Required controls:

- Global kill switch through `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=off`.
- Stage-specific values: `internal`, `beta`, `canary-5`, `canary-25`, `all`.
- Existing lower-gate kill switches remain available.
- Admin-only preview path for internal fixture review.
- Explicit opt-in state for beta.
- Deterministic canary bucketing.
- Safe default: no rollout when configuration is absent or malformed.
- No forced migration of existing legacy users.
- User-visible fallback messaging must avoid exposing internal validation details or raw source text.
- Admin diagnostics may show codes, counts, and contract versions only.

## Expected Implementation File Set

Expected files for the later Gate 6 implementation:

- Modify: `App.tsx` only to insert the Gate 6 rollout/effective-route decision immediately after `resolveK12GenerationRoutePolicy(...)` and before `resolveSourceManifestForGeneration(...)` in both K-12 single lesson and daily unit flows, then pass redacted telemetry events.
- Create: `lib/sourcePrimarySceneRollout.ts` for rollout-stage parsing, eligibility, canary hashing, and rollback-safe disabled behavior.
- Create: `lib/sourcePrimarySceneTelemetry.ts` for redacted event construction and privacy validation.
- Create: `lib/sourcePrimarySceneCacheEnvelope.ts` only if source-primary scene caching is implemented in Gate 6; otherwise do not touch cache write behavior.
- Create: `tests/sourcePrimarySceneRollout.test.ts`.
- Create: `tests/sourcePrimarySceneTelemetry.test.ts`.
- Create: `tests/sourcePrimarySceneCacheEnvelope.test.ts` only if the cache envelope module is implemented.
- Create: `docs/superpowers/baselines/2026-07-11-gate6-controlled-rollout-baseline.md`.
- Modify: `README.md` only if rollout operator instructions are included in the accepted implementation prompt.

Planning commit file set:

- Create only: `docs/superpowers/plans/2026-07-11-gate6-controlled-rollout.md`.

Forbidden files unless a reviewed amendment narrows scope:

- `services/geminiService.ts`
- `lib/imagePrompting.ts`
- `lib/serverImageGeneration.ts`
- `api/_pexelsImageSearch.ts`
- `api/_r2ImageCache.ts`
- `scripts/upload-curated-r2-images.mjs`
- `scripts/generate-r2-images.ts`
- `public/curated-images/**`
- `types.ts`
- Gate 0/1/2/3/4/5 core contract modules, except additive imports/types required by the Gate 6 wrapper
- `lib/generationCache.ts`, unless the implementation explicitly adds the reviewed source-primary scene cache envelope
- `package.json`
- `package-lock.json`
- deployment configuration files
- production environment files or secrets

## Required Tests and Checks for Later Implementation

### Rollout flag matrix

- `undefined`, empty string, `0`, `false`, `off`, malformed values parse to `off`.
- `internal`, `beta`, `5`, `5%`, `canary-5`, `25`, `25%`, `canary-25`, `100`, `100%`, and `all` parse to the expected stage.
- Topic-only and legacy routes remain unchanged for every stage.
- Source-primary uploaded-file route is eligible only when the active stage permits it.
- Every rollout decision returns both `originalRoutePolicy` and `effectiveRoutePolicy`.
- Ineligible uploaded-file source-primary decisions return an effective legacy route policy with `allowReusableSeeds: true` and empty `cacheKeyParts`.

### Rollback path

- Disabled Gate 6 with uploaded content and source-primary routing enabled falls back to the effective legacy route before source manifest/storyboard preflight.
- `internal` blocks non-admin users.
- `beta` without opt-in falls back to the effective legacy route before source manifest/storyboard preflight.
- Canary stages exclude users outside deterministic buckets and fall back to the effective legacy route before source manifest/storyboard preflight.
- Canary stages with no safe stable seed fall back to the effective legacy route before source manifest/storyboard preflight.
- Lower-gate disabled behavior remains unchanged.
- Eligible source-primary decisions keep the original source-primary route and still require Gate 1, Gate 2, and Gate 5 validation before delivery/cache success.

### Telemetry redaction

- Event builder includes only hash prefixes, counts, versions, route/stage, diagnostic codes, latency, and cost class.
- Raw source text, generated slide text, speaker notes, prompts, private file names, teacher names, learner data, school data, email addresses, phone numbers, and local file paths are rejected.
- Validation report logging includes diagnostic codes and summaries without source text.

### Cache version isolation

- Source-primary scene cache identity/envelope includes route identity, rollout version, selected unit IDs, source hash prefix, lower-gate contract versions, and Gate 5 validation version.
- Failed validation cannot produce a success cache envelope.
- Rollback ignores incompatible source-primary scene entries.
- Legacy cache reads never consume source-primary scene cache entries.

### Disabled-route unchanged behavior

- `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=off` preserves exact legacy uploaded-file behavior before Gate 1/2 preflight.
- `VITE_SEMANTIC_SLIDES_V1=false` preserves legacy route.
- `VITE_SOURCE_PRIMARY_ROUTING_V1=false` preserves exact legacy seed/cache eligibility.
- Single lesson and daily unit flows use the same effective-route decision helper.
- Ineligible Gate 6 decisions do not call `resolveSourceManifestForGeneration(...)`, `buildTeachingStoryboard(...)`, `resolveTeachingStoryboardForGeneration(...)`, or `resolveEndToEndValidatedScenePresentationForGeneration(...)` with a source-primary policy.
- Cache lookup, quota increment, reusable-seed loading, AI calls, image processing, and delivery remain in the accepted legacy order for ineligible decisions.

### Provider, prompt, and model invariants

- No tests require live image calls.
- No provider/model/prompt files change.
- Existing image modules remain untouched.
- No deployment or production flag enablement occurs.

## Implementation Task Plan

### Task 1: Rollout Stage Contract and Eligibility

**Files:**
- Create: `lib/sourcePrimarySceneRollout.ts`
- Test: `tests/sourcePrimarySceneRollout.test.ts`

**Interfaces:**
- Consumes: `K12GenerationRoutePolicy`
- Produces:
  - `parseSourcePrimarySceneRolloutStage(flagValue: unknown): SourcePrimarySceneRolloutStage`
  - `resolveSourcePrimarySceneRolloutEligibility(policy, stage, context): SourcePrimarySceneRolloutDecision`
  - `toLegacyEffectiveRoutePolicy(policy: K12GenerationRoutePolicy): K12GenerationRoutePolicy`

- [ ] **Step 1: Write failing flag matrix tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSourcePrimarySceneRolloutStage,
  resolveSourcePrimarySceneRolloutEligibility,
} from '../lib/sourcePrimarySceneRollout.ts';
import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';

test('parses Gate 6 rollout stages with safe off defaults', () => {
  for (const value of [undefined, '', '0', 'false', 'off', 'unexpected']) {
    assert.equal(parseSourcePrimarySceneRolloutStage(value), 'off');
  }
  assert.equal(parseSourcePrimarySceneRolloutStage('internal'), 'internal');
  assert.equal(parseSourcePrimarySceneRolloutStage('beta'), 'beta');
  assert.equal(parseSourcePrimarySceneRolloutStage('5%'), 'canary-5');
  assert.equal(parseSourcePrimarySceneRolloutStage('25'), 'canary-25');
  assert.equal(parseSourcePrimarySceneRolloutStage('all'), 'all');
});

test('keeps topic-only and legacy routes ineligible for Gate 6 scene rollout', () => {
  const topicPolicy = resolveK12GenerationRoutePolicy('', 'true');
  const legacyPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'false');

  assert.equal(resolveSourcePrimarySceneRolloutEligibility(topicPolicy, 'all', {}).eligible, false);
  assert.equal(resolveSourcePrimarySceneRolloutEligibility(legacyPolicy, 'all', {}).eligible, false);
});

test('falls back to effective legacy route for ineligible uploaded source-primary users', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');

  for (const decision of [
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'off', {}),
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'beta', { optedInToSourcePrimaryScenes: false }),
    resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'canary-5', {}),
  ]) {
    assert.equal(decision.eligible, false);
    assert.deepEqual(decision.originalRoutePolicy, originalPolicy);
    assert.deepEqual(decision.effectiveRoutePolicy, {
      inputOrigin: 'uploaded-file',
      mode: 'legacy',
      allowReusableSeeds: true,
      cacheKeyParts: [],
    });
  }
});

test('keeps source-primary effective route only for eligible rollout users', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded text', 'true');
  const decision = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'all', {});

  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.originalRoutePolicy, originalPolicy);
  assert.deepEqual(decision.effectiveRoutePolicy, originalPolicy);
});
```

- [ ] **Step 2: Run the focused test and observe missing module failure**

Run:

```bash
node --experimental-strip-types --test tests/sourcePrimarySceneRollout.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` for `lib/sourcePrimarySceneRollout.ts`.

- [ ] **Step 3: Implement the rollout stage parser and decision type**

```ts
import type { K12GenerationRoutePolicy } from './k12GenerationRoutePolicy.ts';

export type SourcePrimarySceneRolloutStage = 'off' | 'internal' | 'beta' | 'canary-5' | 'canary-25' | 'all';

export type SourcePrimarySceneRolloutContext = {
  isAdmin?: boolean;
  optedInToSourcePrimaryScenes?: boolean;
  stableBucketSeed?: string;
};

export type SourcePrimarySceneRolloutDecision = {
  eligible: boolean;
  stage: SourcePrimarySceneRolloutStage;
  originalRoutePolicy: K12GenerationRoutePolicy;
  effectiveRoutePolicy: K12GenerationRoutePolicy;
  reason:
    | 'rollout_off'
    | 'route_not_source_primary_uploaded'
    | 'internal_admin'
    | 'internal_non_admin'
    | 'beta_opted_in'
    | 'beta_not_opted_in'
    | 'canary_in_bucket'
    | 'canary_out_of_bucket'
    | 'all_eligible'
    | 'missing_stable_bucket_seed';
};

export const toLegacyEffectiveRoutePolicy = (
  policy: K12GenerationRoutePolicy,
): K12GenerationRoutePolicy => ({
  inputOrigin: policy.inputOrigin,
  mode: 'legacy',
  allowReusableSeeds: true,
  cacheKeyParts: [],
});
```

- [ ] **Step 4: Implement deterministic canary hashing without dependencies**

Use a stable 32-bit FNV-1a hash over a privacy-safe seed string. Return canary eligibility only when `stableBucketSeed` is present and contains no whitespace-heavy source-like text. If the implementation cannot obtain a source hash prefix from an already-valid manifest/provenance result, leave `stableBucketSeed` undefined and return the `missing_stable_bucket_seed` effective legacy decision. Do not read raw source text to build the canary seed.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
```

Expected: all tests pass.

### Task 2: Redacted Rollout Telemetry Event Builder

**Files:**
- Create: `lib/sourcePrimarySceneTelemetry.ts`
- Test: `tests/sourcePrimarySceneTelemetry.test.ts`

**Interfaces:**
- Consumes: rollout decision, `EndToEndValidationReport`, route policy, optional latency/cost counters.
- Produces:
  - `buildSourcePrimarySceneTelemetryEvent(input): SourcePrimarySceneTelemetryEvent`
  - `validateSourcePrimarySceneTelemetryEvent(event): SourcePrimarySceneTelemetryDiagnostic[]`

- [ ] **Step 1: Write redaction tests**

Test that the event includes only route/stage, hash prefix, counts, versions, diagnostic codes, latency, and cost class. Test that raw source text, teacher notes, prompts, file paths, names, emails, and long source-like strings are rejected.

- [ ] **Step 2: Run focused test and observe missing module failure**

Run:

```bash
node --experimental-strip-types --test tests/sourcePrimarySceneTelemetry.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` for `lib/sourcePrimarySceneTelemetry.ts`.

- [ ] **Step 3: Implement the telemetry contract**

The implementation must copy only:

- `sourceHashPrefix = sourceHash.slice(0, 12)`;
- counts from the validation report;
- contract versions;
- diagnostic codes;
- latency bucket numbers;
- asset kind/cost/failure code summaries.

It must not copy any visible scene text, raw source fields, source step raw blocks, speaker notes, prompts, or private file names.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: all tests pass.

### Task 3: Gate 6 Boundary Wiring

**Files:**
- Modify: `App.tsx`
- Create or modify tests near the Gate 6 rollout module.

**Interfaces:**
- Consumes:
  - `parseSourcePrimarySceneRolloutStage`
  - `resolveSourcePrimarySceneRolloutEligibility`
  - `SourcePrimarySceneRolloutDecision.effectiveRoutePolicy`
  - accepted Gate 5 `resolveEndToEndValidatedScenePresentationForGeneration`
- Produces:
  - Gate 6 decision runs immediately after `resolveK12GenerationRoutePolicy(...)` and before `resolveSourceManifestForGeneration(...)`;
  - Gate 1, Gate 2, and Gate 5 are attempted only when Gate 6 decision is eligible and `effectiveRoutePolicy.mode === 'source-primary'`;
  - ineligible uploaded-file source-primary requests continue to accepted legacy path without source-manifest/storyboard preflight and without cache/quota/seed ordering regressions.

- [ ] **Step 1: Add boundary tests**

Tests must prove:

- `off` with uploaded content and source-primary routing enabled uses the effective legacy route before source manifest/storyboard preflight;
- `internal` requires admin context;
- `beta` without opt-in uses the effective legacy route before source manifest/storyboard preflight;
- `canary-5` and `canary-25` use deterministic bucket decisions;
- `canary-5` or `canary-25` without a safe stable seed uses the effective legacy route before source manifest/storyboard preflight;
- `all` allows eligible uploaded-file source-primary route;
- eligible source-primary route still requires Gate 1, Gate 2, and Gate 5 validation;
- K-12 single lesson and daily unit flows both use the same `effectiveRoutePolicy` decision;
- ineligible decisions preserve legacy cache key, reusable-seed eligibility, quota ordering, AI-call ordering, image processing, and delivery behavior;
- topic-only remains unchanged.

- [ ] **Step 2: Add `SOURCE_PRIMARY_SCENE_ROLLOUT_V1_FLAG` in `App.tsx`**

```ts
const SOURCE_PRIMARY_SCENE_ROLLOUT_V1_FLAG = import.meta.env.VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1;
```

- [ ] **Step 3: Insert the Gate 6 decision immediately after route policy resolution in both K-12 flows**

In the single lesson flow, place the decision immediately after:

```ts
const originalRoutePolicy = resolveK12GenerationRoutePolicy(
  dllContent,
  SOURCE_PRIMARY_ROUTING_V1_FLAG,
);
```

In the daily unit flow, place the same decision immediately after:

```ts
const originalRoutePolicy = resolveK12GenerationRoutePolicy(
  dllContent,
  SOURCE_PRIMARY_ROUTING_V1_FLAG,
);
```

Then use:

```ts
const routePolicy = rolloutDecision.effectiveRoutePolicy;
```

for every downstream call that currently receives `routePolicy`, including:

- `resolveSourceManifestForGeneration(...)`;
- `buildTeachingStoryboard(...)` conditions based on `sourceManifestBoundary.manifest`;
- `resolveTeachingStoryboardForGeneration(...)`;
- `resolveEndToEndValidatedScenePresentationForGeneration(...)`;
- legacy cache-key construction through `routePolicy.cacheKeyParts`;
- `loadReusableSeedWhenAllowed(...)`.

Keep `rolloutDecision.originalRoutePolicy` only for redacted rollout telemetry and diagnostics. Do not move cache lookup, quota increment, reusable seed calls, AI calls, image processing, or delivery earlier.

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: all tests and typecheck pass.

### Task 4: Optional Source-Primary Scene Cache Envelope

**Files:**
- Create: `lib/sourcePrimarySceneCacheEnvelope.ts`
- Test: `tests/sourcePrimarySceneCacheEnvelope.test.ts`
- Modify: `App.tsx` only if successful source-primary scene caching is explicitly included in the implementation prompt.

**Interfaces:**
- Consumes: `CompiledScenePresentation`, `EndToEndValidationReport`, rollout stage, selected unit IDs, source hash prefix.
- Produces:
  - `createSourcePrimarySceneCacheEnvelope(input): SourcePrimarySceneCacheEnvelope`
  - `validateSourcePrimarySceneCacheEnvelope(envelope, expected): SourcePrimarySceneCacheEnvelopeResult`

- [ ] **Step 1: Write cache isolation tests**

Tests must prove:

- validation failures cannot create success envelopes;
- missing validation version is rejected;
- legacy cache readers cannot accept a source-primary scene envelope;
- source-primary scene readers reject incompatible route, rollout, source, or contract versions.

- [ ] **Step 2: Implement only if the implementation prompt includes caching**

If caching is not included, do not create this module and explicitly report that source-primary scene cache writes remain absent.

### Task 5: Operator Baseline and Rollout Runbook

**Files:**
- Create: `docs/superpowers/baselines/2026-07-11-gate6-controlled-rollout-baseline.md`
- Optionally modify: `README.md` if the implementation prompt asks for operator instructions.

**Contents:**

- flag stack and rollback order;
- sanitized internal fixture checklist;
- teacher side-by-side rubric;
- allowed telemetry fields;
- forbidden telemetry fields;
- canary stage entry/exit criteria;
- cache/version policy;
- no-production-rollout confirmation.

- [ ] **Step 1: Add the baseline/runbook**

The baseline must contain no private artifacts, no raw lesson text, and no rendered references.

- [ ] **Step 2: Run verification**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all pass.

## Verification for This Planning Commit

Run before committing this plan:

```bash
npm test
git diff --check
git diff --name-only 0fa7da2932821c90a03fd1987e7ed8191a229f5b..HEAD
git diff --name-only --diff-filter=A 0fa7da2932821c90a03fd1987e7ed8191a229f5b..HEAD | rg -i '\.(docx|pptx|pdf|png|jpe?g)$|rendered|extracted'
rg -n -i 'teacher name|learner name|school id|private source|raw lesson text|local file path' docs/superpowers/plans/2026-07-11-gate6-controlled-rollout.md
git status --short
```

Expected:

- `npm test` passes.
- `git diff --check` has no output.
- Changed-file proof shows only `docs/superpowers/plans/2026-07-11-gate6-controlled-rollout.md`.
- Artifact scan has no output.
- Privacy scan has no private artifact/source-text hits.
- Worktree is clean after the planning commit.

## Explicit Non-Goals

- No production rollout in this planning commit.
- No deployment.
- No production flag enablement.
- No live provider activation.
- No curated/R2/provider adapter activation.
- No prompt changes.
- No model/provider swap.
- No image-provider behavior change.
- No NotebookLM visual clone.
- No private artifact commits.
- No private rendered screenshot commits.
- No teacher beta execution unless the user explicitly approves after this plan.
- No removal of the legacy route.
- No forced migration of existing legacy users.

## Required Gate 6 Implementation Report

The implementer must return:

1. Worktree path, branch, base commit, and final commit hash.
2. Files changed.
3. Rollout flag contract implemented:
   - parser truth table;
   - stage eligibility matrix;
   - disable/rollback order.
4. Internal sanitized fixture review proof:
   - fixture names only;
   - expected validation report summaries;
   - preview/PPTX checklist results;
   - no private artifacts committed.
5. Teacher side-by-side review plan/artifact proof:
   - rubric fields;
   - feedback redaction;
   - no raw source text or private data stored.
6. Beta/canary stage proof:
   - internal, beta, 5 percent, 25 percent, and all-user entry/exit criteria;
   - rollback criteria.
7. Observability proof:
   - allowed fields emitted;
   - forbidden fields rejected;
   - validation reports logged only as counts/codes/versions.
8. Cache/version proof:
   - legacy/source-primary isolation;
   - validation version in source-primary scene envelope if caching exists;
   - failed validation never cached as success;
   - rollback ignores incompatible entries.
9. Exact test count and command output summary.
10. Typecheck and build outcomes if implementation touches TypeScript production code.
11. Changed-file proof against the approved Gate 6 implementation base.
12. Forbidden-scope proof for prompts, model/provider/image modules, lower-gate contracts, package files, and deployment files.
13. Proof no private DOCX/PPTX/PDF/images/rendered references/extracted text, teacher names, learner data, or school-identifying content were committed.
14. Deviations, unresolved risks, and assumptions.
15. This exact limitation: `Gate 6 defines and enforces controlled rollout for the source-primary compiled-scene path; it does not perform production rollout, deployment, live provider activation, prompt/model changes, or NotebookLM-like visual polish.`

## Risks and Open Questions

- Vite environment variables are build-time values in this app. If runtime canary changes are required without redeploy, Gate 6 implementation must add an approved runtime config source in a separate reviewed scope.
- Canary bucketing requires a stable privacy-safe seed. If no non-PII stable seed is available, the implementation must keep canary users ineligible rather than using raw source text or private identifiers.
- Teacher side-by-side review may require handling private local artifacts. That must be explicitly authorized and kept outside Git.
- Source-primary scene cache writes may remain absent. If caching is added, the envelope must include Gate 5 validation version and route identity before any success cache write.
- Operation-level PPTX validation from Gate 5 does not prove package XML round-trip unless a later reviewed plan adds dependency-free package inspection.
