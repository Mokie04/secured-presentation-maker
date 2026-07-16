import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DECK_THEMES,
  buildDeckVisualSystems,
  deckThemeKeyForSpecs,
  deckThemeKeyForStoryboard,
  paletteMeetsContrast,
  selectDeckTheme,
} from '../lib/deckVisualSystem.ts';
import type { TeachingStoryboard } from '../lib/teachingStoryboard.ts';
import {
  EVIDENCE_OUTPUT_VISUAL_FIXTURE,
  FIVE_SESSION_VISUAL_FIXTURE,
  MULTI_OBJECTIVE_VISUAL_FIXTURE,
} from './fixtures/deckVisualSystemFixtures.ts';

test('exposes at least three deterministic deck themes', () => {
  assert.equal(DECK_THEMES.length >= 3, true);
  const ids = new Set(DECK_THEMES.map((theme) => theme.id));
  assert.equal(ids.size, DECK_THEMES.length);
});

test('every deck theme palette meets the 4.5:1 contrast contract', () => {
  for (const theme of DECK_THEMES) {
    assert.equal(paletteMeetsContrast(theme.palette), true, theme.id);
  }
});

test('selects the same theme for the same deck key', () => {
  const first = selectDeckTheme('deck-key-alpha');
  const second = selectDeckTheme('deck-key-alpha');
  assert.equal(first.id, second.id);
  assert.deepEqual(first.palette, second.palette);
});

test('different deck keys can select different themes', () => {
  const selected = new Set(
    Array.from({ length: 64 }, (_, index) => selectDeckTheme(`deck-key-${index}`).id),
  );
  assert.equal(selected.size >= 2, true);
});

test('derives a deterministic deck theme key from source provenance', () => {
  const first = deckThemeKeyForSpecs(FIVE_SESSION_VISUAL_FIXTURE.specs);
  const second = deckThemeKeyForSpecs(FIVE_SESSION_VISUAL_FIXTURE.specs);
  assert.equal(first, second);
  assert.equal(first.length > 0, true);
});

test('applies one shared deck theme palette across every unit system', () => {
  const result = buildDeckVisualSystems(
    FIVE_SESSION_VISUAL_FIXTURE.storyboard,
    FIVE_SESSION_VISUAL_FIXTURE.specs,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const systems = Object.values(result.bundle.systemsByUnitId);
  const expected = selectDeckTheme(deckThemeKeyForStoryboard(
    FIVE_SESSION_VISUAL_FIXTURE.storyboard,
    FIVE_SESSION_VISUAL_FIXTURE.specs,
  )).palette;
  for (const system of systems) {
    assert.deepEqual(system.palette, expected);
  }
});

test('binds the canonical deck theme key to source provenance, not just generated structure', () => {
  const { storyboard, specs } = FIVE_SESSION_VISUAL_FIXTURE;
  const withSourceHash = (sourceHash: string): TeachingStoryboard => ({
    ...storyboard,
    provenance: { ...storyboard.provenance, sourceHash },
  });

  // Two structurally identical decks (same specs, same selected units) that only
  // differ by their source hash must produce different canonical theme keys.
  const keyA = deckThemeKeyForStoryboard(withSourceHash('source-hash-A'), specs);
  const keyB = deckThemeKeyForStoryboard(withSourceHash('source-hash-B'), specs);
  assert.notEqual(keyA, keyB);

  // The same source hash must remain deterministic.
  assert.equal(deckThemeKeyForStoryboard(withSourceHash('source-hash-A'), specs), keyA);

  // Structurally identical decks with different source hashes can select different themes.
  const themeIds = new Set(
    Array.from({ length: 32 }, (_, index) => (
      selectDeckTheme(deckThemeKeyForStoryboard(withSourceHash(`source-hash-${index}`), specs)).id
    )),
  );
  assert.equal(themeIds.size >= 2, true);
});

test('keeps the stronger deck type scale hierarchy in built systems', () => {
  const result = buildDeckVisualSystems(
    MULTI_OBJECTIVE_VISUAL_FIXTURE.storyboard,
    MULTI_OBJECTIVE_VISUAL_FIXTURE.specs,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const system = Object.values(result.bundle.systemsByUnitId)[0];
  assert.equal(system.typography.titleSize / system.typography.bodySize >= 1.6, true);
  assert.equal(system.typography.titleSize >= 40, true);
});

test('different decks can theme differently while staying accessible', () => {
  const first = buildDeckVisualSystems(
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.storyboard,
    EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs,
  );
  const second = buildDeckVisualSystems(
    FIVE_SESSION_VISUAL_FIXTURE.storyboard,
    FIVE_SESSION_VISUAL_FIXTURE.specs,
  );
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  const firstPalette = Object.values(first.bundle.systemsByUnitId)[0].palette;
  const secondPalette = Object.values(second.bundle.systemsByUnitId)[0].palette;
  assert.equal(paletteMeetsContrast(firstPalette), true);
  assert.equal(paletteMeetsContrast(secondPalette), true);
});
