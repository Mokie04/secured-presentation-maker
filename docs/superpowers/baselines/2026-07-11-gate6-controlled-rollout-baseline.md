# Gate 6 Controlled Rollout Baseline

## Scope

Gate 6 controls eligibility for the source-primary compiled-scene path after Gates 0-5. It does not change prompts, models, providers, image behavior, deployment configuration, or production flags.

## Flag Stack

- `VITE_SOURCE_PRIMARY_ROUTING_V1`: enables uploaded-file source-primary route detection.
- `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1`: controls Gate 6 rollout stage.
- `VITE_SEMANTIC_SLIDES_V1`: enables Gate 3 semantic compiled scenes for eligible source-primary routes.
- `VITE_DECK_VISUAL_SYSTEM_V1`: enables Gate 4 visual-system and asset pipeline.
- `VITE_END_TO_END_VALIDATION_V1`: keeps Gate 5 hard validation before delivery.

Accepted Gate 6 stages:

- `off`: effective legacy route for uploaded-file users.
- `internal`: admin/internal preview only.
- `beta`: explicit opt-in only.
- `canary-5`: deterministic 5 percent bucket with a privacy-safe seed.
- `canary-25`: deterministic 25 percent bucket with a privacy-safe seed.
- `all`: all eligible uploaded-file source-primary users.

Malformed, empty, false-like, or missing rollout flag values resolve to `off`.

## Effective Route Rule

Gate 6 computes the rollout decision immediately after the Gate 0 route policy and before source manifest or storyboard preflight.

Ineligible decisions use an effective legacy route:

- `inputOrigin` preserves the original origin.
- `mode` is `legacy`.
- `allowReusableSeeds` is `true`.
- `cacheKeyParts` is empty.

Eligible source-primary decisions keep the original source-primary route and continue through Gate 1 manifest validation, Gate 2 storyboard validation, Gate 3 semantic scenes, Gate 4 visual-system/assets, and Gate 5 hard validation.

## Safe Canary Seed

Canary bucketing may use only approved safe metadata, such as a source hash prefix already available from a valid manifest/provenance result. If the safe seed is absent or private-looking, the canary decision is ineligible and falls back to the effective legacy route.

Gate 6 must not derive canary eligibility from raw source text, extracted source text, prompts, notes, file names, local paths, names, school data, email addresses, or phone numbers.

## Rollback Order

1. Set `VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1=off`.
2. If needed, set `VITE_DECK_VISUAL_SYSTEM_V1=false`.
3. If needed, set `VITE_SEMANTIC_SLIDES_V1=false`.
4. If needed, set `VITE_SOURCE_PRIMARY_ROUTING_V1=false`.
5. Do not disable Gate 5 while any source-primary compiled-scene path is delivering decks.

## Sanitized Internal Review Checklist

- Route decision records original and effective policies.
- Ineligible uploaded-file users skip source manifest, storyboard, and Gate 5 scene preflight.
- Eligible source-primary users visibly block on Gate 1, Gate 2, or Gate 5 failures.
- Preview remains editable native scene output when eligible scene delivery succeeds.
- PPTX export remains native text/table/shape/image operations as applicable.
- No full-slide raster output is introduced by Gate 6.
- No private files or rendered references are committed.

## Teacher Side-by-Side Review Rubric

Use only authorized, privacy-safe review artifacts. Store scores and issue codes, not raw lesson text.

- Source alignment.
- Instructional flow.
- Editability.
- Visual usefulness.
- Image safety.
- PPTX usability.
- Teacher trust.

Feedback telemetry may store rubric scores, sanitized summaries, route/stage, contract versions, counts, diagnostic codes, latency buckets, and cost classes.

## Allowed Telemetry Fields

- Route mode and input origin.
- Rollout stage and eligibility reason.
- Source hash prefix only.
- Unit, objective, source-step, storyboard-screen, semantic-spec, scene, and asset counts.
- Contract versions.
- Diagnostic codes.
- Render and PPTX validation status.
- Full-slide raster count.
- Asset source kind, cost class, optional/required status, and failure code.
- Latency buckets and bounded cost counters.

## Forbidden Telemetry Fields

- Raw source text.
- Generated slide text.
- Speaker notes.
- Prompts containing source details.
- Private filenames.
- Local paths.
- Teacher names.
- Learner names or data.
- School names or identifiers.
- Email addresses.
- Phone numbers.
- Private image prompts or rendered references.

## Cache And Version Policy

Gate 6 does not implement optional source-primary scene cache envelopes in this pass. Source-primary scene cache writes remain absent.

If a later reviewed pass adds source-primary scene caching, successful cache entries must include route identity, rollout version, safe source hash prefix, selected unit IDs, lower-gate contract versions, and Gate 5 validation version. Failed validation must never be cached as success, and rollback must ignore incompatible source-primary scene cache entries.

## No Production Rollout

This baseline documents local implementation behavior only. It does not deploy, push, open a pull request, enable production flags, activate live providers, or execute teacher beta rollout.
