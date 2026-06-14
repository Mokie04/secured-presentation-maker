
export type ImageStyle = 'photorealistic' | 'illustration' | 'infographic' | 'diagram' | 'historical photo' | 'none';
export type SlideVisualLayout = 'standard' | 'evidence';
export type TeachingLevel = 'K-12' | 'College';

export interface ImageOverlayLabel {
  id: string;
  text: string;
  x: number; // Percentage from left (0-100)
  y: number; // Percentage from top (0-100)
  fontSize?: number; // Label text size in px for on-slide editing.
}

export interface ImageSemanticMetadata {
  level?: string;
  format?: string;
  subject?: string;
  topic?: string;
  gradeLevel?: string;
  gradeBand?: string;
  learningCompetency?: string;
  planUnitLabel?: string;
  planUnitNumber?: string;
  planUnitTitle?: string;
  visualRole?: string;
  slideTemplate?: string;
  semanticAnchor?: string;
  language?: 'EN' | 'FIL';
  style?: ImageStyle;
}

export interface ImageAttribution {
  provider: 'pexels' | string;
  label?: string;
  photographer?: string;
  photographerUrl?: string;
  sourceUrl?: string;
  sourceId?: string;
  cacheVersion?: string;
}

export interface Slide {
  title: string;
  content: string[]; // An array of strings, where each string is a bullet point or paragraph.
  imagePrompt?: string; // A descriptive prompt for generating a relevant image.
  imageStyle?: ImageStyle; // The artistic style for the image
  imageUrl?: string; // The data URL of the generated image.
  imageAttribution?: ImageAttribution; // Optional source credit for externally sourced images.
  imageCacheId?: string; // Stable cache key for reusing the same image across matching generations.
  imageSemanticCacheId?: string; // Concept-level cache key for reusing images across similar slide contexts.
  imageSemanticMetadata?: ImageSemanticMetadata; // Structured semantic cache metadata for cross-lesson reuse.
  imageOverlays?: ImageOverlayLabel[]; // Manual label overlays rendered above the image.
  visualLayout?: SlideVisualLayout; // Optional layout hint for image-led classroom evidence slides.
  speakerNotes: string; // Notes for the teacher presenting the slide.
}

export interface Presentation {
  title:string;
  slides: Slide[];
}

// --- New Interfaces for Professional Generation Flow ---

export interface DayPlan {
    dayNumber: number;
    title: string;
    focus: string; // Brief description of what this day covers
    sourceSummary?: string; // Clean source-derived session summary for the planning UI.
    sourceObjective?: string; // Best source-derived learning objective or target for this unit.
    sourceFlow?: string[]; // Ordered teaching moves extracted from the lesson plan.
    sourceMaterials?: string[]; // Concrete resources, tools, or materials named by the source.
    sourceAssessment?: string; // Source-derived assessment/checking detail.
    sourceOutput?: string; // Source-derived learner output or artifact.
    generationStatus: 'pending' | 'loading' | 'done';
}

export interface LessonBlueprint {
    mainTitle: string;
    planUnitLabel?: string; // Display label for each generated unit, e.g. "Day" or "Session".
    subject: string;
    gradeLevel: string;
    quarter: string;
    learningCompetency: string; // The core competency from the curriculum
    smartObjectives: string[]; // Detailed SMART objectives for the teacher's plan
    studentFacingObjectives: string[]; // Consolidated objectives for the student presentation
    days: DayPlan[];
}
