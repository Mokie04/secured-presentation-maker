# Gate 5 End-to-End Hard Validation Baseline

## Contract Versions

- end-to-end-validation-v1
- source-primary-scene-cache-v1
- lesson-source-manifest-v1
- teaching-storyboard-v1
- semantic-slide-spec-v1
- deck-visual-system-v1
- scene-asset-request-v1
- scene-asset-resolution-v1
- compiled-slide-scene-v1

## Sanitized Fixtures

- Evidence/output fixture: validates required evidence/output attachment through scene, preview, PPTX operations, and cache decision.
- Teacher-script fixture: validates teacher-script is absent from visible preview/PPTX text.
- Five-session fixture: validates selected-session coverage and zero foreign-session leakage.
- Multi-objective fixture: validates objective count, source order, and ownership.
- Bounded asset fallback fixture: validates optional omitted asset keeps an editable scene.

## Expected Passing Summaries

- Source-step coverage ratio: 1.
- Objective coverage ratio: 1.
- Sequence inversion count: 0.
- Foreign-session content count: 0.
- Unsupported invention count: 0.
- Blank-field invention count: 0.
- Teacher-script violation count: 0.
- Render surface: 1280 by 720, 16:9.
- Full-slide raster count: 0.
- Cache decision after passing validation: deliver presentation and allow success cache write.

## Required Negative Diagnostics

- e2e_source_step_coverage_failed
- e2e_objective_preservation_failed
- e2e_sequence_inversion
- e2e_foreign_session_content
- e2e_unsupported_invention
- e2e_blank_field_invented
- e2e_teacher_script_visible
- e2e_scene_render_invalid
- e2e_preview_text_not_editable
- e2e_pptx_round_trip_invalid
- e2e_full_slide_raster
- e2e_cache_write_forbidden

No rendered screenshots, PPTX files, DOCX/PDF inputs, extracted private source text, teacher names, learner data, or school-identifying content are part of this baseline.
