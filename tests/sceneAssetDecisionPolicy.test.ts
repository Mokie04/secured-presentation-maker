import assert from 'node:assert/strict';
import test from 'node:test';

import { decideSceneAssetForSpec } from '../lib/sceneAssetDecisionPolicy.ts';
import { EVIDENCE_OUTPUT_VISUAL_FIXTURE } from './fixtures/deckVisualSystemFixtures.ts';

test('prefers native scene structure when labels or tables are required', () => {
  const spec = EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs.find((item) => item.layoutId === 'evidence-capture-board');
  assert.ok(spec);
  const decision = decideSceneAssetForSpec(spec);

  assert.equal(decision.visualRole, 'native-diagram');
  assert.equal(decision.necessity, 'useful');
  assert.equal(decision.reason, 'relationship_explained_by_shapes');
});

test('marks output capture visuals as optional when the native scene remains complete', () => {
  const spec = EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs.find((item) => item.layoutId === 'exit-ticket-card');
  assert.ok(spec);
  const decision = decideSceneAssetForSpec(spec);

  assert.equal(decision.necessity, 'optional');
  assert.equal(decision.reason, 'source_requires_concept_model');
});

test('rejects decorative-only or random visual requests', () => {
  const spec = EVIDENCE_OUTPUT_VISUAL_FIXTURE.specs[0];
  const decorative = {
    ...spec,
    accessibility: {
      ...spec.accessibility,
      slidePurpose: 'Decorative random background only.',
    },
  };
  const decision = decideSceneAssetForSpec(decorative);

  assert.equal(decision.necessity, 'forbidden');
  assert.equal(decision.reason, 'decorative_only_rejected');
});
