import assert from 'node:assert/strict';
import test from 'node:test';

import { END_TO_END_VALIDATION_VERSION, type EndToEndValidationReport } from '../lib/endToEndValidation.ts';
import { resolveK12GenerationRoutePolicy } from '../lib/k12GenerationRoutePolicy.ts';
import { resolveSourcePrimarySceneRolloutEligibility } from '../lib/sourcePrimarySceneRollout.ts';
import {
  buildSourcePrimarySceneTelemetryEvent,
  validateSourcePrimarySceneTelemetryEvent,
} from '../lib/sourcePrimarySceneTelemetry.ts';

const reportFixture = (): EndToEndValidationReport => ({
  contractVersion: END_TO_END_VALIDATION_VERSION,
  route: { mode: 'source-primary', inputOrigin: 'uploaded-file' },
  sourceManifest: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    contractVersion: 'lesson-source-manifest-v1',
    sourceHash: 'abcdef1234567890abcdef1234567890',
    selectedUnitIds: ['unit-001'],
    objectiveCount: 2,
    sourceStepCount: 4,
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
    specCount: 3,
  },
  visualSystemAndAssets: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    visualSystemCount: 1,
    assetRequestCount: 2,
    resolvedAssetCount: 1,
    omittedOptionalAssetCount: 1,
  },
  scenes: {
    checked: 1,
    passed: 1,
    failed: 0,
    blocking: 0,
    renderedSceneCount: 3,
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
    renderedSceneCount: 3,
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
    slideCount: 3,
    nativeTextOperationCount: 6,
    nativeTableOperationCount: 1,
    nativeShapeOperationCount: 4,
    imageOperationCount: 1,
    speakerNotesCount: 3,
    extractedTextCount: 7,
    extractedNotesCount: 3,
    fullSlideImageCount: 0,
  },
  cacheSafety: {
    cacheContractVersion: 'source-primary-scene-cache-v1',
    validationVersion: END_TO_END_VALIDATION_VERSION,
    mayWriteSuccessCache: true,
    mayDeliverPresentation: true,
    reason: 'validation_passed',
  },
  diagnostics: [{
    code: 'e2e_source_step_coverage_failed',
    severity: 'blocking',
    message: 'Sanitized diagnostic message excluded from telemetry event.',
  }],
});

test('builds redacted source-primary scene telemetry from route and validation metadata', () => {
  const originalPolicy = resolveK12GenerationRoutePolicy('uploaded source text', 'true');
  const decision = resolveSourcePrimarySceneRolloutEligibility(originalPolicy, 'all', {});
  const event = buildSourcePrimarySceneTelemetryEvent({
    decision,
    validationReport: reportFixture(),
    sourceHash: 'abcdef1234567890abcdef1234567890',
    latencyBucketsMs: {
      manifest: 10,
      storyboard: 20,
      gate5: 30,
      total: 60,
    },
    costClass: 'free',
  });

  assert.equal(event.contractVersion, 'source-primary-scene-telemetry-v1');
  assert.equal(event.rollout.stage, 'all');
  assert.equal(event.rollout.eligible, true);
  assert.equal(event.route.originalMode, 'source-primary');
  assert.equal(event.route.effectiveMode, 'source-primary');
  assert.equal(event.source?.sourceHashPrefix, 'abcdef123456');
  assert.equal(event.counts?.objectiveCount, 2);
  assert.equal(event.counts?.sourceStepCount, 4);
  assert.deepEqual(event.diagnosticCodes, ['e2e_source_step_coverage_failed']);
  assert.deepEqual(validateSourcePrimarySceneTelemetryEvent(event), []);

  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes('Sanitized diagnostic message'), false);
  assert.equal(serialized.includes('uploaded source text'), false);
});

test('rejects forbidden telemetry fields and private-looking values', () => {
  const forbiddenEvent = {
    contractVersion: 'source-primary-scene-telemetry-v1',
    route: { originalMode: 'source-primary', effectiveMode: 'source-primary', inputOrigin: 'uploaded-file' },
    rollout: { stage: 'all', eligible: true, reason: 'all_eligible' },
    rawSourceText: 'The teacher will ask learners to copy a private objective.',
    prompt: 'Generate a slide about a private source detail.',
    fileName: 'C:\\redacted\\fixture\\source-file',
    teacherName: 'Example Educator',
    schoolName: 'Example Learning Campus',
    email: 'redacted@example.test',
    phone: '5550101000',
    speakerNotes: 'Private teacher notes should never be logged.',
  };

  const diagnostics = validateSourcePrimarySceneTelemetryEvent(forbiddenEvent);
  const codes = diagnostics.map((diagnostic) => diagnostic.code);

  assert.ok(codes.includes('telemetry_forbidden_field'));
  assert.ok(codes.includes('telemetry_private_value'));
});

test('rejects long copied source-like strings even under allowed-looking keys', () => {
  const event = {
    contractVersion: 'source-primary-scene-telemetry-v1',
    route: { originalMode: 'source-primary', effectiveMode: 'source-primary', inputOrigin: 'uploaded-file' },
    rollout: { stage: 'all', eligible: true, reason: 'all_eligible' },
    diagnostics: [
      'This is a long copied paragraph that describes classroom directions, lesson objectives, assessment details, and teacher-facing instructions rather than a diagnostic code.',
    ],
  };

  const diagnostics = validateSourcePrimarySceneTelemetryEvent(event);

  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'telemetry_private_value'), true);
});
