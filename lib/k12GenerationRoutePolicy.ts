export const SOURCE_PRIMARY_ROUTE_SCOPE = 'source-primary-route-v1';

export type K12InputOrigin = 'uploaded-file' | 'topic-only';
export type K12RouteMode = 'legacy' | 'source-primary';

export type K12GenerationRoutePolicy = {
  inputOrigin: K12InputOrigin;
  mode: K12RouteMode;
  allowReusableSeeds: boolean;
  cacheKeyParts: readonly string[];
};

const TRUE_LIKE_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on']);

const isFeatureFlagEnabled = (value?: string): boolean => (
  TRUE_LIKE_FLAG_VALUES.has(value?.trim().toLowerCase() ?? '')
);

export const resolveK12GenerationRoutePolicy = (
  uploadedContent: string,
  featureFlagValue?: string,
): K12GenerationRoutePolicy => {
  const inputOrigin: K12InputOrigin = uploadedContent.trim()
    ? 'uploaded-file'
    : 'topic-only';
  const isSourcePrimary = inputOrigin === 'uploaded-file'
    && isFeatureFlagEnabled(featureFlagValue);

  if (isSourcePrimary) {
    return {
      inputOrigin,
      mode: 'source-primary',
      allowReusableSeeds: false,
      cacheKeyParts: [SOURCE_PRIMARY_ROUTE_SCOPE],
    };
  }

  return {
    inputOrigin,
    mode: 'legacy',
    allowReusableSeeds: true,
    cacheKeyParts: [],
  };
};

export const loadReusableSeedWhenAllowed = async <T>(
  policy: Pick<K12GenerationRoutePolicy, 'allowReusableSeeds'>,
  loader: () => T | null | Promise<T | null>,
): Promise<T | null> => {
  if (!policy.allowReusableSeeds) return null;
  return loader();
};
