import assert from 'node:assert/strict';
import test from 'node:test';

import { classifySourceContent } from '../lib/sourceContentDisposition.ts';
import {
  scienceFixture,
  VISUAL_COMPOSER_HUMANITIES_DOCUMENT,
} from './fixtures/visualTeachingComposerFixtures.ts';
import { buildLessonSourceManifest } from '../lib/lessonSourceManifest.ts';
import { buildTeachingStoryboard } from '../lib/teachingStoryboard.ts';

test('classifies planning scaffolds without hiding learner-facing requirements', () => {
  const { manifest, storyboard } = scienceFixture();
  const result = classifySourceContent(manifest, storyboard);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.decisions.find((item) => item.sourceLabel.startsWith('References'))?.disposition, 'omit-administrative');
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Learner Context')?.disposition, 'speaker-notes');
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Relationship Model')?.disposition, 'learner-visible');
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Check')?.disposition, 'learner-visible');
  assert.equal(new Set(result.decisions.map((item) => item.sourceId)).size, result.decisions.length);
});

test('uses anchored administrative labels and preserves explicit learner reference actions', () => {
  const { manifest, storyboard } = scienceFixture();
  const referencesStep = manifest.units[0].steps.find((step) => step.sourceLabel.startsWith('References'));
  assert.ok(referencesStep);
  const instructionalStep = manifest.units[0].steps.find((step) => step.sourceLabel === 'Relationship Model');
  assert.ok(instructionalStep);

  const mutatedManifest = {
    ...manifest,
    units: [{
      ...manifest.units[0],
      steps: manifest.units[0].steps.map((step) => (
        step.id === referencesStep.id
          ? { ...step, rawBlocks: ['Learners consult the source before comparing the recorded pattern.'] }
          : step.id === instructionalStep.id
            ? { ...step, sourceLabel: 'References in Activity' }
            : step
      )),
    }],
  };
  const result = classifySourceContent(mutatedManifest, storyboard);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.decisions.find((item) => item.sourceId === referencesStep.id)?.disposition, 'learner-visible');
  assert.equal(result.decisions.find((item) => item.sourceId === instructionalStep.id)?.disposition, 'learner-visible');
});

test('classifies subject-neutral humanities steps as learner-visible', () => {
  const manifestResult = buildLessonSourceManifest(VISUAL_COMPOSER_HUMANITIES_DOCUMENT);
  assert.equal(manifestResult.ok, true);
  if (!manifestResult.ok) return;
  const storyboardResult = buildTeachingStoryboard(manifestResult.manifest);
  assert.equal(storyboardResult.ok, true);
  if (!storyboardResult.ok) return;

  const result = classifySourceContent(manifestResult.manifest, storyboardResult.storyboard);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Source Comparison')?.disposition, 'learner-visible');
  assert.equal(result.decisions.find((item) => item.sourceLabel === 'Evidence Board')?.disposition, 'learner-visible');
});

test('blocks classification when the storyboard does not belong to the manifest', () => {
  const { manifest, storyboard } = scienceFixture();
  const result = classifySourceContent(manifest, {
    ...storyboard,
    provenance: { ...storyboard.provenance, sourceHash: 'foreign-source-hash' },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics.some((item) => item.code === 'visual_plan_contract_invalid'), true);
});

test('applies anchored planning rules to source fields', () => {
  const { manifest, storyboard } = scienceFixture();
  const mutatedManifest = {
    ...manifest,
    units: [{
      ...manifest.units[0],
      fields: {
        administrative: {
          id: 'field-administrative',
          label: 'Administrative Notes',
          value: 'Planning-only filing note.',
          state: 'present' as const,
          sourceOrder: 9,
          sourceLocation: { blockId: 'field-administrative' },
        },
        learnerContext: {
          id: 'field-learner-context',
          label: 'Learner Context',
          value: 'Planning observation about the class.',
          state: 'present' as const,
          sourceOrder: 10,
          sourceLocation: { blockId: 'field-learner-context' },
        },
      },
    }],
  };

  const result = classifySourceContent(mutatedManifest, storyboard);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.decisions.find((item) => item.sourceId === 'field-administrative')?.disposition, 'omit-administrative');
  assert.equal(result.decisions.find((item) => item.sourceId === 'field-learner-context')?.disposition, 'speaker-notes');
});
