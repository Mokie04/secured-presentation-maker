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
