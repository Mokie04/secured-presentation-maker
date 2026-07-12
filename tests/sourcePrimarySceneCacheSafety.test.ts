import assert from 'node:assert/strict';
import test from 'node:test';

import {
  END_TO_END_VALIDATION_VERSION,
  type EndToEndValidationReport,
} from '../lib/endToEndValidation.ts';
import { decideSourcePrimarySceneCacheSafety } from '../lib/sourcePrimarySceneCacheSafety.ts';

const report = (diagnosticCount: number): EndToEndValidationReport => ({
  contractVersion: END_TO_END_VALIDATION_VERSION,
  route: { mode: 'source-primary', inputOrigin: 'uploaded-file' },
  sourceManifest: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    contractVersion: 'lesson-source-manifest-v1',
    sourceHash: 'fixture-hash',
    selectedUnitIds: ['unit-001'],
    objectiveCount: 1,
    sourceStepCount: 2,
  },
  storyboard: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    sourceStepCoverageRatio: 1,
    objectiveCoverageRatio: 1,
    sequenceInversionCount: 0,
    foreignSessionContentCount: 0,
    unsupportedInventionCount: 0,
    blankFieldInventionCount: 0,
    teacherScriptViolationCount: 0,
  },
  semanticSpecs: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    sourceStepCoverageRatio: 1,
    objectiveCoverageRatio: 1,
    sequenceInversionCount: 0,
    foreignSessionContentCount: 0,
    unsupportedInventionCount: 0,
    blankFieldInventionCount: 0,
    teacherScriptViolationCount: 0,
    specCount: 2,
  },
  visualSystemAndAssets: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    visualSystemCount: 1,
    assetRequestCount: 1,
    resolvedAssetCount: 1,
    omittedOptionalAssetCount: 1,
  },
  scenes: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    renderedSceneCount: 2,
    canvasWidth: 1280,
    canvasHeight: 720,
    offCanvasCount: 0,
    overflowCount: 0,
    unreadableTextCount: 0,
    uneditableVisibleTextCount: 0,
    fullSlideRasterCount: 0,
  },
  renderedPreview: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    renderedSceneCount: 2,
    canvasWidth: 1280,
    canvasHeight: 720,
    offCanvasCount: 0,
    overflowCount: 0,
    unreadableTextCount: 0,
    uneditableVisibleTextCount: 0,
    fullSlideRasterCount: 0,
  },
  pptxRoundTrip: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    slideCount: 2,
    nativeTextOperationCount: 2,
    nativeTableOperationCount: 1,
    nativeShapeOperationCount: 2,
    imageOperationCount: 0,
    speakerNotesCount: 2,
    extractedTextCount: 3,
    extractedNotesCount: 2,
    fullSlideImageCount: 0,
  },
  cacheSafety: {
    cacheContractVersion: 'source-primary-scene-cache-v1',
    validationVersion: END_TO_END_VALIDATION_VERSION,
    mayWriteSuccessCache: diagnosticCount === 0,
    mayDeliverPresentation: diagnosticCount === 0,
    reason: diagnosticCount === 0 ? 'validation_passed' : 'validation_failed',
  },
  diagnostics: Array.from({ length: diagnosticCount }, (_, index) => ({
    code: 'e2e_source_step_coverage_failed',
    severity: 'blocking',
    message: `Diagnostic ${index + 1}`,
  })),
});

test('allows success cache writes only for passing validation reports', () => {
  assert.equal(decideSourcePrimarySceneCacheSafety(report(0)).mayWriteSuccessCache, true);
  assert.equal(decideSourcePrimarySceneCacheSafety(report(0)).mayDeliverPresentation, true);
});

test('blocks cache writes and delivery when any blocking diagnostic exists', () => {
  const decision = decideSourcePrimarySceneCacheSafety(report(1));

  assert.equal(decision.mayWriteSuccessCache, false);
  assert.equal(decision.mayDeliverPresentation, false);
  assert.equal(decision.reason, 'validation_failed');
});
