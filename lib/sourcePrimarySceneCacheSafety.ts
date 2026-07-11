import {
  END_TO_END_VALIDATION_VERSION,
  hasBlockingEndToEndDiagnostics,
  type CacheSafetyDecision,
  type EndToEndValidationReport,
} from './endToEndValidation.ts';

export const decideSourcePrimarySceneCacheSafety = (
  report: Pick<EndToEndValidationReport, 'diagnostics'>,
): CacheSafetyDecision => {
  const blocked = hasBlockingEndToEndDiagnostics(report.diagnostics);
  return {
    cacheContractVersion: 'source-primary-scene-cache-v1',
    validationVersion: END_TO_END_VALIDATION_VERSION,
    mayWriteSuccessCache: !blocked,
    mayDeliverPresentation: !blocked,
    reason: blocked ? 'validation_failed' : 'validation_passed',
  };
};
