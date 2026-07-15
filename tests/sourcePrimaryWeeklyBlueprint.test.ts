import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import { buildLessonSourceManifest } from '../lib/lessonSourceManifest.ts';
import {
  buildSourcePrimaryWeeklyBlueprint,
  resolveSourcePrimaryWeeklyBlueprintForGeneration,
} from '../lib/sourcePrimaryWeeklyBlueprint.ts';
import {
  FIVE_SESSION_MATRIX_DOCUMENT,
  MULTI_OBJECTIVE_UNIT_DOCUMENT,
} from './fixtures/lessonSourceManifestFixtures.ts';

test('builds a weekly blueprint directly from a source manifest without inventing units', () => {
  const manifestResult = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) return;

  const blueprint = buildSourcePrimaryWeeklyBlueprint(manifestResult.manifest, 'EN');

  assert.equal(blueprint.planUnitLabel, 'Session');
  assert.equal(blueprint.mainTitle, 'Sanitized Five Session Matrix');
  assert.equal(blueprint.days.length, 5);
  assert.deepEqual(
    blueprint.days.map((day) => day.dayNumber),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    blueprint.days.map((day) => day.title),
    ['Learning Session 1', 'Learning Session 2', 'Learning Session 3', 'Learning Session 4', 'Learning Session 5'],
  );
  assert.deepEqual(
    blueprint.days.map((day) => day.generationStatus),
    ['pending', 'pending', 'pending', 'pending', 'pending'],
  );
  assert.equal(blueprint.smartObjectives.length, 5);
  assert.equal(blueprint.studentFacingObjectives.length, 5);
  assert.match(blueprint.smartObjectives[0], /S1-OBJ-CIRCUIT-A/);
  assert.match(blueprint.smartObjectives[4], /S5-OBJ-CIRCUIT-E/);
  assert.match(blueprint.days[0].focus, /S1-OBJ-CIRCUIT-A/);
  assert.match(blueprint.days[4].focus, /S5-OBJ-CIRCUIT-E/);
});

test('preserves multi-objective unit ownership in each weekly blueprint focus', () => {
  const manifestResult = buildLessonSourceManifest(MULTI_OBJECTIVE_UNIT_DOCUMENT);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) return;

  const blueprint = buildSourcePrimaryWeeklyBlueprint(manifestResult.manifest, 'EN');

  assert.equal(blueprint.planUnitLabel, 'Day');
  assert.equal(blueprint.days.length, 2);
  assert.match(blueprint.days[0].focus, /M1-OBJ-A/);
  assert.match(blueprint.days[0].focus, /M1-OBJ-B/);
  assert.doesNotMatch(blueprint.days[0].focus, /M2-OBJ-A/);
  assert.match(blueprint.days[1].focus, /M2-OBJ-A/);
  assert.deepEqual(
    blueprint.smartObjectives.map((objective) => objective.match(/M\d-OBJ-[A-Z]/)?.[0]),
    ['M1-OBJ-A', 'M1-OBJ-B', 'M2-OBJ-A'],
  );
});

test('resolves a source-primary weekly blueprint only for uploaded source-primary routes', () => {
  const manifestResult = buildLessonSourceManifest(FIVE_SESSION_MATRIX_DOCUMENT);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) return;

  const sourcePrimaryPolicy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const sourcePrimaryResult = resolveSourcePrimaryWeeklyBlueprintForGeneration(
    sourcePrimaryPolicy,
    manifestResult.manifest,
    'EN',
  );
  assert.equal(sourcePrimaryResult.ok, true);
  if (!sourcePrimaryResult.ok) return;
  assert.equal(sourcePrimaryResult.blueprint?.days.length, 5);

  const legacyPolicy = resolveK12GenerationRoutePolicy('uploaded source text', 'false');
  const legacyResult = resolveSourcePrimaryWeeklyBlueprintForGeneration(
    legacyPolicy,
    manifestResult.manifest,
    'EN',
  );
  assert.equal(legacyResult.ok, true);
  if (!legacyResult.ok) return;
  assert.equal(legacyResult.blueprint, null);
});

test('blocks source-primary weekly blueprint resolution when the manifest is missing', () => {
  const sourcePrimaryPolicy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const result = resolveSourcePrimaryWeeklyBlueprintForGeneration(
    sourcePrimaryPolicy,
    null,
    'EN',
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /source manifest/i);
});
