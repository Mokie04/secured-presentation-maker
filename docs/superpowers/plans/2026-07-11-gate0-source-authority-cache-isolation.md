# Gate 0 Source Authority and Cache Isolation Implementation Plan

> **For the implementing developer:** REQUIRED SUB-SKILL: Use `superpowers:using-git-worktrees`, then `superpowers:subagent-driven-development` or `superpowers:executing-plans`, and follow this plan task by task. Use `superpowers:test-driven-development` for behavior changes and `superpowers:verification-before-completion` before reporting success.

**Goal:** Make uploaded K-12 lesson plans source-primary at the routing boundary so reusable lesson seeds and legacy browser-cache entries cannot silently override them when the feature flag is enabled.

**Architecture:** Add one pure routing-policy module that classifies the input from the upload channel, parses a rollout flag, exposes cache-key scope, and guards lazy reusable-seed loaders. Wire that policy into the existing K-12 single, weekly, and per-unit browser-cache paths. Preserve the exact legacy route and cache keys while the flag is off and preserve topic-only behavior even while the flag is on.

**Tech stack:** React 19, TypeScript 5.8, Vite 6, IndexedDB browser cache, and the current Node 26 runtime's built-in `node:test` with TypeScript type stripping.

**Approved design:** `docs/superpowers/specs/2026-07-11-source-aligned-editable-presentations-design.md`, especially Gate 0 at lines 471-490.

**Scope boundary:** This is containment and characterization only. Do not change prompts, AI providers/models, response schemas, lesson parsing, slide schemas, image behavior, layout/rendering, PPTX export, or the visible lesson wording. Do not claim this gate fixes end-to-end lesson alignment.

---

## Preconditions and branch safety

Run from the repository root:

```bash
git status --short --branch
git rev-parse codex/source-aligned-presentation-spec
git merge-base --is-ancestor e9c722d56255394eb213117d59a9eb258e063b4b codex/source-aligned-presentation-spec
git show -s --format=%s HEAD
test -f docs/superpowers/plans/2026-07-11-gate0-source-authority-cache-isolation.md
```

Expected clean planning base:

```text
## codex/source-aligned-presentation-spec
docs: add Gate 0 source authority plan
```

The exact planning commit is pinned in the developer handoff prompt that accompanies this plan. If the worktree is dirty, the named branch is not at that pinned commit, the ancestor check fails, or the plan file is missing, stop and report the exact state. Do not reset, stash, overwrite, or discard user work.

Create an isolated worktree and branch named `codex/gate0-source-authority` from the pinned planning commit. Leave `codex/source-aligned-presentation-spec` at that commit for use as the implementation diff base. Do not implement on the specification branch. Do not push or open a pull request without explicit user authorization.

## Locked behavior contract

| Input channel | Flag value | Route mode | Reusable seeds | Browser cache scope |
|---|---|---|---|---|
| Uploaded file (`dllContent.trim()` is non-empty) | true-like | `source-primary` | blocked before lazy import | add `source-primary-route-v1` |
| Uploaded file | false-like or unset | `legacy` | unchanged | unchanged |
| Topic-only (`dllContent.trim()` is empty) | any | `legacy` | unchanged | unchanged |

True-like values are `1`, `true`, `yes`, and `on`, ignoring case and surrounding whitespace. Every other value is false.

The input origin must be determined only from the app's upload channel, `dllContent`. Do not infer upload origin from filenames, source wording, topic similarity, 5E labels, or reusable-seed matches. This keeps the route format-agnostic.

---

### Task 1: Add the focused test harness and pure K-12 route policy

**Files:**

- Modify: `package.json`
- Create: `tests/fixtures/k12RouteInputs.ts`
- Create: `tests/k12GenerationRoutePolicy.test.ts`
- Create: `lib/k12GenerationRoutePolicy.ts`

#### Step 1: Add a dependency-free test command

Add this script after `typecheck` in `package.json`:

```json
"test": "node --experimental-strip-types --test tests/*.test.ts",
```

Do not install a test framework and do not change `package-lock.json`.

#### Step 2: Create a sanitized, format-agnostic route fixture

Create `tests/fixtures/k12RouteInputs.ts`:

```ts
export const SANITIZED_SEED_SIGNAL_UPLOAD = `
Grade 7 Science | Quarter 3
Session 1: Explaining changes in matter
Learning objective: Use observations to explain how particles behave during diffusion and phase change.
Opening prompt: Compare what happens when a drop of food coloring enters warm and cold water.
Investigation: Record observations, discuss a particle-model explanation, and compare group evidence.
Concept building: Relate particle spacing and motion to the observed change.
Application: Predict a new situation and justify the prediction with evidence.
Assessment: Explain the relationship in the learner's own words.
`.trim();
```

This is intentionally not encoded as a 5E object. It is text that happens to contain a recognizable teaching sequence; the routing policy must not parse its pedagogical format.

#### Step 3: Write the failing policy tests first

Create `tests/k12GenerationRoutePolicy.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGenerationCacheKey } from '../lib/generationCache.ts';
import {
  SOURCE_PRIMARY_ROUTE_SCOPE,
  loadReusableSeedWhenAllowed,
  resolveK12GenerationRoutePolicy,
} from '../lib/k12GenerationRoutePolicy.ts';
import { SANITIZED_SEED_SIGNAL_UPLOAD } from './fixtures/k12RouteInputs.ts';

const LEGACY_CACHE_PARTS = [
  'lesson-plan-cache-v38',
  SANITIZED_SEED_SIGNAL_UPLOAD,
  'K-12',
  'EN',
];

test('routes an uploaded lesson plan to source-primary when the flag is enabled', () => {
  const policy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'true');

  assert.deepEqual(policy, {
    inputOrigin: 'uploaded-file',
    mode: 'source-primary',
    allowReusableSeeds: false,
    cacheKeyParts: [SOURCE_PRIMARY_ROUTE_SCOPE],
  });
});

test('keeps uploaded lesson plans on the exact legacy policy when the flag is disabled or unset', () => {
  for (const flagValue of [undefined, '', 'false', '0', 'off']) {
    const policy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, flagValue);

    assert.equal(policy.inputOrigin, 'uploaded-file');
    assert.equal(policy.mode, 'legacy');
    assert.equal(policy.allowReusableSeeds, true);
    assert.deepEqual(policy.cacheKeyParts, []);
  }
});

test('keeps whitespace-only upload content on the topic-only legacy route', () => {
  const policy = resolveK12GenerationRoutePolicy('  \n\t ', 'true');

  assert.deepEqual(policy, {
    inputOrigin: 'topic-only',
    mode: 'legacy',
    allowReusableSeeds: true,
    cacheKeyParts: [],
  });
});

test('accepts only documented case-insensitive true-like flag values', () => {
  for (const flagValue of ['1', 'true', 'TRUE', ' yes ', 'On']) {
    assert.equal(
      resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, flagValue).mode,
      'source-primary',
    );
  }
});

test('isolates enabled uploaded cache keys while preserving the legacy key when disabled', async () => {
  const sourcePolicy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'true');
  const disabledUploadPolicy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'false');
  const topicPolicy = resolveK12GenerationRoutePolicy('', 'true');

  const oldUnscopedKey = await buildGenerationCacheKey('k12-lesson-plan', LEGACY_CACHE_PARTS);
  const enabledUploadKey = await buildGenerationCacheKey('k12-lesson-plan', [
    LEGACY_CACHE_PARTS[0],
    ...sourcePolicy.cacheKeyParts,
    ...LEGACY_CACHE_PARTS.slice(1),
  ]);
  const disabledUploadKey = await buildGenerationCacheKey('k12-lesson-plan', [
    LEGACY_CACHE_PARTS[0],
    ...disabledUploadPolicy.cacheKeyParts,
    ...LEGACY_CACHE_PARTS.slice(1),
  ]);
  const identicalTopicOnlyKey = await buildGenerationCacheKey('k12-lesson-plan', [
    LEGACY_CACHE_PARTS[0],
    ...topicPolicy.cacheKeyParts,
    ...LEGACY_CACHE_PARTS.slice(1),
  ]);

  assert.notEqual(enabledUploadKey, oldUnscopedKey);
  assert.equal(disabledUploadKey, oldUnscopedKey);
  assert.equal(identicalTopicOnlyKey, oldUnscopedKey);
});

test('does not invoke a reusable-seed loader on the source-primary route', async () => {
  const policy = resolveK12GenerationRoutePolicy(SANITIZED_SEED_SIGNAL_UPLOAD, 'true');
  let callCount = 0;

  const result = await loadReusableSeedWhenAllowed(policy, () => {
    callCount += 1;
    return { id: 'must-not-load' };
  });

  assert.equal(result, null);
  assert.equal(callCount, 0);
});

test('invokes a reusable-seed loader exactly once on the legacy route', async () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  let callCount = 0;

  const result = await loadReusableSeedWhenAllowed(policy, async () => {
    callCount += 1;
    return { id: 'legacy-seed' };
  });

  assert.deepEqual(result, { id: 'legacy-seed' });
  assert.equal(callCount, 1);
});

test('preserves reusable-seed loader failures on the legacy route', async () => {
  const policy = resolveK12GenerationRoutePolicy('', 'true');
  const expectedError = new Error('seed load failed');

  await assert.rejects(
    loadReusableSeedWhenAllowed(policy, async () => {
      throw expectedError;
    }),
    expectedError,
  );
});
```

#### Step 4: Run the test and confirm it fails for the missing module

```bash
npm test
```

Expected: non-zero exit and an `ERR_MODULE_NOT_FOUND` referring to `lib/k12GenerationRoutePolicy.ts`. A syntax error or failure in an unrelated module is not the expected red state and must be investigated before continuing.

#### Step 5: Implement the minimal policy module

Create `lib/k12GenerationRoutePolicy.ts`:

```ts
export const SOURCE_PRIMARY_ROUTE_SCOPE = 'source-primary-route-v1';

export type K12InputOrigin = 'uploaded-file' | 'topic-only';
export type K12RouteMode = 'legacy' | 'source-primary';

export type K12GenerationRoutePolicy = {
  inputOrigin: K12InputOrigin;
  mode: K12RouteMode;
  allowReusableSeeds: boolean;
  cacheKeyParts: readonly string[];
};

const TRUE_LIKE_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on']);

const isFeatureFlagEnabled = (value?: string): boolean => (
  TRUE_LIKE_FLAG_VALUES.has(value?.trim().toLowerCase() ?? '')
);

export const resolveK12GenerationRoutePolicy = (
  uploadedContent: string,
  featureFlagValue?: string,
): K12GenerationRoutePolicy => {
  const inputOrigin: K12InputOrigin = uploadedContent.trim()
    ? 'uploaded-file'
    : 'topic-only';
  const isSourcePrimary = inputOrigin === 'uploaded-file'
    && isFeatureFlagEnabled(featureFlagValue);

  if (isSourcePrimary) {
    return {
      inputOrigin,
      mode: 'source-primary',
      allowReusableSeeds: false,
      cacheKeyParts: [SOURCE_PRIMARY_ROUTE_SCOPE],
    };
  }

  return {
    inputOrigin,
    mode: 'legacy',
    allowReusableSeeds: true,
    cacheKeyParts: [],
  };
};

export const loadReusableSeedWhenAllowed = async <T>(
  policy: Pick<K12GenerationRoutePolicy, 'allowReusableSeeds'>,
  loader: () => T | null | Promise<T | null>,
): Promise<T | null> => {
  if (!policy.allowReusableSeeds) return null;
  return loader();
};
```

Keep the cache scope immutable and versioned. Do not add content heuristics or import reusable seeds into this module.

#### Step 6: Run focused verification

```bash
npm test
npm run typecheck
git diff --check
```

Expected: eight tests pass, zero fail; TypeScript exits 0; `git diff --check` prints nothing.

#### Step 7: Commit the policy slice

```bash
git add package.json lib/k12GenerationRoutePolicy.ts tests/fixtures/k12RouteInputs.ts tests/k12GenerationRoutePolicy.test.ts
git commit -m "feat: add K-12 source routing policy"
```

---

### Task 2: Wire the policy into K-12 generation without changing generated content

**Files:**

- Modify: `App.tsx`
- Modify: `README.md`
- Test: `tests/k12GenerationRoutePolicy.test.ts`

#### Step 1: Record the pre-edit integration seams

```bash
rg -n "GENERATION_CACHE_VERSION|k12-single-presentation|k12-lesson-plan|k12-plan-unit-slides|k12-plan-unit-images|getReusableK12LessonPlanSeed|getReusableK12PlanUnitSlidesSeed" App.tsx
```

Expected: three text-generation cache namespaces, one image-cache namespace, and the weekly/per-unit reusable-seed call sites. `k12-plan-unit-images` is deliberately out of scope and must remain unchanged.

#### Step 2: Import the policy and declare the rollout flag

Add this import beside the existing `lib/` imports in `App.tsx`:

```ts
import { loadReusableSeedWhenAllowed, resolveK12GenerationRoutePolicy } from './lib/k12GenerationRoutePolicy';
```

Add this constant beside `GENERATION_CACHE_VERSION`:

```ts
const SOURCE_PRIMARY_ROUTING_V1_FLAG = import.meta.env.VITE_SOURCE_PRIMARY_ROUTING_V1;
```

The flag is intentionally client-visible and contains no secret. Do not rename or increment `GENERATION_CACHE_VERSION`; route scoping provides the targeted invalidation.

#### Step 3: Resolve one policy for the K-12 create-plan path

At the start of the `teachingLevel === 'K-12'` branch inside `handleCreatePlan`, resolve the policy from the upload channel, not from the merged `content` value:

```ts
const routePolicy = resolveK12GenerationRoutePolicy(
  dllContent,
  SOURCE_PRIMARY_ROUTING_V1_FLAG,
);
```

In the `k12-single-presentation` and `k12-lesson-plan` cache arrays, insert the policy scope immediately after `GENERATION_CACHE_VERSION`:

```ts
[
  GENERATION_CACHE_VERSION,
  ...routePolicy.cacheKeyParts,
  content,
  DEFAULT_LESSON_FORMAT,
  generationLanguage,
]
```

This ordering is part of the contract and must be consistent across text-generation cache namespaces.

#### Step 4: Guard the weekly reusable-seed lazy import

Replace the unconditional weekly seed import/call with:

```ts
const reusablePlan = await loadReusableSeedWhenAllowed(routePolicy, async () => {
  const { getReusableK12LessonPlanSeed } = await loadReusableLessonSeeds();
  return getReusableK12LessonPlanSeed(content, generationLanguage);
});
```

Keep the existing `if (reusablePlan) { ... }` block unchanged. The lazy import must occur inside the guarded thunk so a source-primary upload does not call the reusable-seed module at all.

#### Step 5: Resolve and wire the per-unit route

Inside `handleGenerateDailySlides`, resolve the same policy after `content` is assigned:

```ts
const routePolicy = resolveK12GenerationRoutePolicy(
  dllContent,
  SOURCE_PRIMARY_ROUTING_V1_FLAG,
);
```

Insert `...routePolicy.cacheKeyParts` immediately after `GENERATION_CACHE_VERSION` in the `k12-plan-unit-slides` cache array.

Do not add the route token to `k12-plan-unit-images`. Gate 0 changes text-generation routing only; changing image cache identity could increase paid image calls and would violate the approved scope.

Replace the unconditional per-unit seed import/call with:

```ts
const reusableSlides = await loadReusableSeedWhenAllowed(routePolicy, async () => {
  const { getReusableK12PlanUnitSlidesSeed } = await loadReusableLessonSeeds();
  return getReusableK12PlanUnitSlidesSeed(
    content,
    dayToGenerate.dayNumber,
    generationLanguage,
  );
});
```

Keep the existing `if (reusableSlides && reusableSlides.length > 0) { ... }` block unchanged.

#### Step 6: Document activation and rollback

Add this commented variable to the README environment example near the other `VITE_` feature switches:

```bash
# Optional Gate 0 routing boundary. Uploaded K-12 files skip reusable seeds and use isolated browser text-cache keys.
# Leave unset or false for the exact legacy route and cache behavior.
# VITE_SOURCE_PRIMARY_ROUTING_V1=true
```

Add this paragraph under `## Session Alignment`:

```md
`VITE_SOURCE_PRIMARY_ROUTING_V1=true` activates the reversible Gate 0 source-authority boundary. Uploaded K-12 content then bypasses reusable lesson seeds and uses route-scoped browser text-generation cache keys; topic-only generation remains on the legacy path. Unset or set the flag to `false` to use the previous routing and cache keys. Gate 0 does not change prompts, models, images, layouts, or export behavior.
```

#### Step 7: Verify behavior and scope

```bash
npm test
npm run typecheck
npm run build
git diff --check
rg -n "VITE_SOURCE_PRIMARY_ROUTING_V1|routePolicy\.cacheKeyParts|loadReusableSeedWhenAllowed" App.tsx README.md
git diff -- services/geminiService.ts types.ts components/Slide.tsx lib/generationCache.ts
```

Expected:

- eight policy tests pass and zero fail;
- typecheck and production build exit 0;
- the first `rg` shows one flag declaration, three text-cache scope insertions, and two guarded reusable-seed calls;
- the final `git diff` is empty;
- no prompt, schema, model, image, renderer, or export files changed.

Manually inspect the `App.tsx` diff to confirm `k12-plan-unit-images` has no route token and all surrounding generation code is unchanged.

#### Step 8: Commit the integration slice

```bash
git add App.tsx README.md
git commit -m "fix: keep uploaded lesson plans source primary"
```

---

### Task 3: Capture the Gate 0 baseline without committing user files

**Files:**

- Create: `docs/superpowers/baselines/2026-07-11-gate0-source-authority-baseline.md`

#### Step 1: Reconfirm the two local reference artifacts

```bash
shasum -a 256 \
  "/Users/johnnavarro/Downloads/Word Docs/2026July/Week 4 Grade 9 Science - Infer relationships among current, voltage, and resistance in series and parallel circuits (8).docx" \
  "/Users/johnnavarro/Downloads/PPT/2026July/The_Three_Domains_of_Life.pptx"
```

Expected:

```text
d31f05a8f503f670a234580d560ffcb3131f11887d8065c9c50068f27fdcc1c8  /Users/johnnavarro/Downloads/Word Docs/2026July/Week 4 Grade 9 Science - Infer relationships among current, voltage, and resistance in series and parallel circuits (8).docx
d633b55501f5e0ed09919160c550f6eb17dbace2904d390be15012e1815e0f71  /Users/johnnavarro/Downloads/PPT/2026July/The_Three_Domains_of_Life.pptx
```

If either hash differs, stop and report the changed artifact instead of copying stale observations.

#### Step 2: Write the baseline record

Create the directory if needed:

```bash
mkdir -p docs/superpowers/baselines
```

Create `docs/superpowers/baselines/2026-07-11-gate0-source-authority-baseline.md` with these sections and facts:

```md
# Gate 0 Source Authority Baseline

## Purpose

This is a characterization record for the approved source-aligned presentation architecture. Gate 0 isolates uploaded K-12 generation from reusable seeds and old browser text-cache entries when enabled. It does not yet repair parsing, semantic alignment, visual storytelling, images, or PPTX editability.

## Private reference artifacts

The original user files remain outside Git and must not be copied into the repository.

- Grade 9 circuits DOCX: SHA-256 `d31f05a8f503f670a234580d560ffcb3131f11887d8065c9c50068f27fdcc1c8`, 93,285 bytes.
- NotebookLM domains PPTX: SHA-256 `d633b55501f5e0ed09919160c550f6eb17dbace2904d390be15012e1815e0f71`, 24,142,102 bytes.

## Uploaded lesson-plan contract

- The circuits source contains five sessions.
- It contains five session objectives with one-to-one session ownership.
- Each session has an Engage, Explore, Explain, Elaborate, and Evaluate sequence totaling 45 minutes.
- It contains five intentionally blank reflection areas; blank is source state, not permission to invent content.

## Current extraction observations

- Mammoth extraction completes without a warning for this DOCX.
- The extracted structured text contains 37,859 characters.
- The five detected session blocks contain 6,775; 4,816; 4,829; 4,889; and 5,706 characters.
- No detected session block is truncated by the current source-block size ceiling.
- Empty reflection cells disappear from plain-text extraction, so blank-state fidelity is currently lost.
- The circuits source does not currently match a bundled reusable lesson seed, but seed override remains a general routing risk for other uploads.

## NotebookLM reference observations

- The reference contains 21 ordered 16:9 slides.
- Every slide is one full-slide 1,376 by 768 PNG; visible text and diagrams are flattened pixels.
- The deck is visually coherent but has no editable/searchable slide text, speaker notes, alt text, or semantic reading order.
- Its useful pattern is a teaching arc with persistent semantic colors, parallel concept profiles, comparison views, prompt/reveal pairs, modeled reasoning, transfer, assessment, and a closing reprise.
- The target product should reproduce that coherence with native editable slide objects, not by copying image-only output.

## Known gaps after Gate 0

- Paragraph/table extraction still flattens important internal structure.
- Objectives and source steps have no stable source IDs or one-to-one accounting.
- Current generation can rewrite, compress, omit, or reorder lesson content.
- Alignment validators remain largely order-blind and fail open after retry.
- Existing server-side/shared text-generation cache behavior is unchanged in Gate 0; only the browser generation cache is route-scoped.
- The current slide contract remains dominated by title, bullets, and optional image slots.
- Image selection, visual-system planning, deterministic layout, and editable scene parity remain later gates.
```

Do not add the DOCX, PPTX, extracted source text, rendered slide PNGs, or any learner/teacher-identifying content to Git.

#### Step 3: Verify and commit the baseline record

```bash
rg -n "five sessions|37,859|21 ordered|Known gaps after Gate 0" docs/superpowers/baselines/2026-07-11-gate0-source-authority-baseline.md
git status --short
git diff --check
git add docs/superpowers/baselines/2026-07-11-gate0-source-authority-baseline.md
git commit -m "docs: record Gate 0 source baseline"
```

Expected: only the Markdown baseline is staged for this commit, and `git diff --check` prints nothing.

---

### Task 4: Run the Gate 0 release-gate verification

**Files:** No new changes expected.

#### Step 1: Run the complete local verification sequence

```bash
npm test
npm run typecheck
npm run build
git diff --check codex/source-aligned-presentation-spec..HEAD
git status --short --branch
git diff --name-only codex/source-aligned-presentation-spec..HEAD
```

Expected changed-file set:

```text
App.tsx
README.md
docs/superpowers/baselines/2026-07-11-gate0-source-authority-baseline.md
lib/k12GenerationRoutePolicy.ts
package.json
tests/fixtures/k12RouteInputs.ts
tests/k12GenerationRoutePolicy.test.ts
```

`package-lock.json` must not change because this plan adds no dependency.

#### Step 2: Prove forbidden scope remained untouched

```bash
git diff --exit-code codex/source-aligned-presentation-spec..HEAD -- \
  services/geminiService.ts \
  types.ts \
  components/Slide.tsx \
  lib/generationCache.ts
git status --porcelain
```

Expected: both commands print nothing and exit 0. If the implementation worktree contains pre-existing changes, do not misrepresent it as clean; report them precisely.

#### Step 3: Review the three contracts explicitly

Before reporting completion, verify from code and tests:

1. With `VITE_SOURCE_PRIMARY_ROUTING_V1=true`, any non-empty `dllContent` skips both reusable-seed lazy loaders and adds `source-primary-route-v1` to all three browser text-generation cache keys.
2. With the flag unset or false, uploaded generation preserves the old seed eligibility and exact old cache-key arrays.
3. Topic-only generation preserves legacy seed eligibility and exact old cache-key arrays regardless of the flag.

Do not run paid AI generation as part of Gate 0. The focused policy tests, compiler, build, static diff proof, and private-artifact characterization are the approved evidence for this containment gate.

## Required implementation report

Return all of the following to the planner chat:

- branch and exact commit hashes;
- files changed;
- the implemented route-policy truth table;
- exact `npm test`, `npm run typecheck`, and `npm run build` outcomes;
- confirmation that the changed-file set matches the seven expected paths;
- confirmation that forbidden prompt/model/image/layout/export files are unchanged;
- confirmation that no private DOCX/PPTX or extracted content was committed;
- confirmation that the rollout flag was documented but no deployment environment was changed;
- any deviation, ambiguity, or remaining risk;
- this exact limitation: **Gate 0 prevents hidden seed/cache override when enabled; it does not yet make generated presentations fully aligned or NotebookLM-like.**

Stop after Gate 0. Do not begin Gate 1 without planner review and user approval.
