import type { SemanticSlideSpec } from './semanticSlideSpec.ts';
import type {
  SceneAssetDecisionReason,
  SceneAssetNecessity,
  SceneAssetVisualRole,
} from './sceneAssetRequests.ts';

export type SceneAssetDecision = {
  visualRole: SceneAssetVisualRole;
  necessity: SceneAssetNecessity;
  reason: SceneAssetDecisionReason;
};

const DECORATIVE_PATTERN = /\b(?:decorative|random|background\s+only|filler|stock\s+photo)\b/i;

export const decideSceneAssetForSpec = (spec: Pick<SemanticSlideSpec, 'layoutId' | 'intent' | 'sourceStepIds' | 'accessibility'>): SceneAssetDecision => {
  const searchable = `${spec.intent} ${spec.layoutId} ${spec.accessibility.slidePurpose}`;
  if (DECORATIVE_PATTERN.test(searchable) || spec.sourceStepIds.length === 0) {
    return {
      visualRole: 'no-image-fallback',
      necessity: 'forbidden',
      reason: 'decorative_only_rejected',
    };
  }

  if (
    spec.layoutId === 'evidence-capture-board'
    || spec.layoutId === 'comparison-matrix'
    || spec.layoutId === 'process-flow-horizontal'
    || spec.layoutId === 'guided-example-steps'
  ) {
    return {
      visualRole: 'native-diagram',
      necessity: 'useful',
      reason: 'relationship_explained_by_shapes',
    };
  }

  if (spec.layoutId === 'exit-ticket-card') {
    return {
      visualRole: 'curated-educational-visual',
      necessity: 'optional',
      reason: 'source_requires_concept_model',
    };
  }

  return {
    visualRole: 'no-image-fallback',
    necessity: 'optional',
    reason: 'relationship_explained_by_shapes',
  };
};
