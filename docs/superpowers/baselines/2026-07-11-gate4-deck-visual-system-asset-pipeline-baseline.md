# Gate 4 Deck Visual System Asset Pipeline Baseline

## Scope

Gate 4 adds a deterministic deck-level visual system and source-backed asset pipeline on top of Gate 3 compiled scenes. This baseline records sanitized fixture-level expectations only.

## Contract Versions

- `deck-visual-system-v1`
- `scene-asset-request-v1`
- `scene-asset-resolution-v1`
- `semantic-slide-spec-v1`
- `compiled-slide-scene-v1`

## Sanitized Fixtures

- `FIVE_SESSION_VISUAL_FIXTURE`
  - Expected visual systems: 5
  - Expected unit IDs: `unit-001` through `unit-005`
  - Expected validation diagnostics: none
- `MULTI_OBJECTIVE_VISUAL_FIXTURE`
  - Expected visual systems: 1
  - Expected repeated concept consistency: `objective:obj-001` keeps one stable semantic color
  - Expected validation diagnostics: none
- `EVIDENCE_OUTPUT_VISUAL_FIXTURE`
  - Expected visual systems: 1
  - Expected semantic specs: 3
  - Expected asset requests: source-owned, privacy-sanitized, text-free briefs
  - Expected optional asset fallback: editable omitted asset when no adapter resolves an image
  - Expected validation diagnostics: none

## Required Negative Diagnostics

- `visual_system_contrast_failed`
- `scene_asset_decorative_forbidden`
- `scene_asset_request_private_text_leak`
- `scene_asset_request_text_in_image`
- `scene_asset_forbidden_request`
- `scene_asset_required_unavailable`
- `scene_full_slide_raster_forbidden`

## Preview and PPTX Expectations

- Gate 3 scenes remain image-free when no resolved assets are supplied.
- Gate 4 may add bounded `image` scene elements only from resolved source-backed assets.
- Bounded image elements must carry `assetId`, source step IDs, storyboard screen ID, semantic spec ID, and `noEmbeddedText: true`.
- PPTX export emits native `addImage` operations only for bounded image scene elements.
- Text, tables, shapes, connectors, and speaker notes remain native editable scene/PPTX operations.

## Privacy

This baseline contains no private DOCX, PPTX, PDF, images, rendered references, extracted lesson text, teacher names, learner data, or school-identifying content.
