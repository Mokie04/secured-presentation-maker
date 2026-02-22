
export type ImageStyle = 'photorealistic' | 'illustration' | 'infographic' | 'diagram' | 'historical photo' | 'none';
export type TeachingLevel = 'K-12' | 'College';

export interface ImageOverlayLabel {
  id: string;
  text: string;
  x: number; // Percentage from left (0-100)
  y: number; // Percentage from top (0-100)
  fontSize?: number; // Label text size in px for on-slide editing.
}

export interface Slide {
  title: string;
  content: string[]; // An array of strings, where each string is a bullet point or paragraph.
  imagePrompt?: string; // A descriptive prompt for generating a relevant image.
  imageStyle?: ImageStyle; // The artistic style for the image
  imageUrl?: string; // The data URL of the generated image.
  imageOverlays?: ImageOverlayLabel[]; // Manual label overlays rendered above the image.
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
    generationStatus: 'pending' | 'loading' | 'done';
}

export interface LessonBlueprint {
    mainTitle: string;
    subject: string;
    gradeLevel: string;
    quarter: string;
    learningCompetency: string; // The core competency from the curriculum
    smartObjectives: string[]; // Detailed SMART objectives for the teacher's plan
    studentFacingObjectives: string[]; // Consolidated objectives for the student presentation
    days: DayPlan[];
}
