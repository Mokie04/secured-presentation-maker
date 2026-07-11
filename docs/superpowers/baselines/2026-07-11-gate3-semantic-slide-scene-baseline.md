# Gate 3 Semantic Slide Scene Baseline

Date: 2026-07-11
Scope: Sanitized semantic slide specs and compiled native scenes only.

## Fixtures

- `FIVE_SESSION_STORYBOARD`
- `EVIDENCE_OUTPUT_STORYBOARD`
- `MULTI_OBJECTIVE_STORYBOARD`
- `TEACHER_SCRIPT_STORYBOARD`

## Required Outcomes

- Semantic layout coverage for non-title instructional slides: at least 80%.
- Scene size: 1280 x 720, 16:9.
- Overflow diagnostics: 0 on sanitized fixtures.
- Off-canvas diagnostics: 0 on sanitized fixtures.
- Full-slide raster elements: 0.
- Image asset requests emitted: 0.
- Preview/PPTX visible text parity: exact.
- Editable visible text and instructional structures: yes.
- Legacy `Slide` route remains available when `VITE_SEMANTIC_SLIDES_V1` is false-like.

## Non-Claims

- No image asset pipeline is implemented in Gate 3.
- No generated visual system is implemented in Gate 3.
- No NotebookLM-like visual polish is implemented in Gate 3.
- No model or prompt change is implemented in Gate 3.
