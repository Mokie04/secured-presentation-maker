import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSourcePrimaryDebugSnapshot,
  isSourcePrimaryDebugEnabled,
  sanitizeSourcePrimaryDebugValue,
  SOURCE_PRIMARY_DEBUG_CONSOLE_LABEL,
} from '../lib/sourcePrimaryDebugSnapshot.ts';

test('enables source-primary debug only for the explicit query parameter', () => {
  assert.equal(isSourcePrimaryDebugEnabled('?debugSourcePrimary=1'), true);
  assert.equal(isSourcePrimaryDebugEnabled('?debugSourcePrimary=true'), false);
  assert.equal(isSourcePrimaryDebugEnabled('?other=1'), false);
  assert.equal(isSourcePrimaryDebugEnabled(''), false);
});

test('builds a sanitized source-primary debug snapshot without private values', () => {
  const snapshot = buildSourcePrimaryDebugSnapshot({
    flags: {
      VITE_SOURCE_PRIMARY_ROUTING_V1: 'true',
      VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1: 'all',
      VITE_SOURCE_PRIMARY_PRODUCTION_ARMED: undefined,
      VITE_SEMANTIC_SLIDES_V1: 'true',
      VITE_DECK_VISUAL_SYSTEM_V1: 'true',
      VITE_END_TO_END_VALIDATION_V1: 'true',
      VITE_VISUAL_TEACHING_COMPOSER_V1: 'true',
    },
    flow: 'k12-daily-unit',
    originalRouteMode: 'source-primary',
    effectiveRouteMode: 'legacy',
    manifestBuiltValid: false,
    storyboardBuiltValid: null,
    gate3SemanticEnabled: true,
    gate4VisualSystemEnabled: true,
    gate5ValidationEnabled: true,
    composerEligible: false,
    composerAttempted: false,
    composerStatus: 'skipped',
    composerReason: 'beta not opted in for private.teacher@example.edu /Users/private/source.docx',
    finalDeckPath: 'legacy',
  });

  assert.equal(SOURCE_PRIMARY_DEBUG_CONSOLE_LABEL, 'SOURCE_PRIMARY_DEBUG_SNAPSHOT');
  assert.deepEqual(snapshot.flags, {
    VITE_SOURCE_PRIMARY_ROUTING_V1: 'true',
    VITE_SOURCE_PRIMARY_SCENE_ROLLOUT_V1: 'all',
    VITE_SOURCE_PRIMARY_PRODUCTION_ARMED: 'undefined',
    VITE_SEMANTIC_SLIDES_V1: 'true',
    VITE_DECK_VISUAL_SYSTEM_V1: 'true',
    VITE_END_TO_END_VALIDATION_V1: 'true',
    VITE_VISUAL_TEACHING_COMPOSER_V1: 'true',
  });
  assert.equal(snapshot.flow, 'k12-daily-unit');
  assert.equal(snapshot.originalRouteMode, 'source-primary');
  assert.equal(snapshot.effectiveRouteMode, 'legacy');
  assert.equal(snapshot.manifestBuiltValid, false);
  assert.equal(snapshot.storyboardBuiltValid, null);
  assert.equal(snapshot.composerStatus, 'skipped');
  assert.equal(snapshot.finalDeckPath, 'legacy');
  assert.doesNotMatch(JSON.stringify(snapshot), /teacher@example|source\.docx|\/Users/);
});

test('sanitizes arbitrary debug values before display or console logging', () => {
  assert.equal(sanitizeSourcePrimaryDebugValue(undefined), 'undefined');
  assert.equal(sanitizeSourcePrimaryDebugValue(true), 'true');
  assert.equal(sanitizeSourcePrimaryDebugValue('preview /Users/private/file.docx teacher@example.edu'), 'preview [redacted-path] [redacted-email]');
});
