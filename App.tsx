
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Presentation, LessonBlueprint, DayPlan, Slide, ImageOverlayLabel, ImageSemanticMetadata } from './types';
import { IMAGES_DISABLED, cacheUploadedImageForPrompt, createK12LessonBlueprint, generateK12SlidesForDay, generateImageResultFromPrompt, generateCollegeLectureSlides, generateK12SingleLessonSlides, getCachedImageResultForPrompt } from './services/geminiService';
import SlideComponent from './components/Slide';
import Loader from './components/Loader';
import { MagicWandIcon, ArrowLeftIcon, ArrowRightIcon, RefreshCwIcon, BookOpenIcon, UploadCloudIcon, DownloadIcon, FileTextIcon, XIcon, MaximizeIcon, MinimizeIcon, CheckCircle2Icon, CalendarDaysIcon, PresentationIcon, GraduationCapIcon } from './components/IconComponents';
import { useTheme } from './contexts/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';
import { useLanguage } from './contexts/LanguageContext';
import { translations } from './lib/translations';
import { useUsageTracker } from './useUsageTracker';
import { buildGenerationCacheKey, getCachedGeneration, setCachedGeneration } from './lib/generationCache';
import { SAYUNA_IMAGE_WATERMARK_LOGO_URL } from './lib/branding';


type AppStep = 'input' | 'planning' | 'presenting';
type TransitionDirection = 'next' | 'prev' | null;
type TeachingLevel = 'K-12' | 'College';
type DepEdMode = 'weekly' | 'single';
type AppLanguage = 'EN' | 'FIL';
type AuthState = 'checking' | 'authorized' | 'unauthorized';
type LoadingProgressSetter = React.Dispatch<React.SetStateAction<number | null>>;
type PptxExportImageFormat = 'image/png' | 'image/jpeg';
type SessionUser = {
  sub?: string;
  email?: string;
  role?: string;
  isAdmin?: boolean;
};
type SessionCheckResult = {
  ok: boolean;
  payload: {
    authenticated?: boolean;
    user?: SessionUser;
    error?: string;
  };
};

type PdfJsModule = typeof import('pdfjs-dist');
type Html2Canvas = typeof import('html2canvas').default;
type ReusableLessonSeedsModule = typeof import('./lib/reusableLessonSeeds');

let sessionCheckCacheKey: string | null = null;
let sessionCheckCachePromise: Promise<SessionCheckResult> | null = null;
let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let reusableLessonSeedsModulePromise: Promise<ReusableLessonSeedsModule> | null = null;

const loadPdfJs = (): Promise<PdfJsModule> => {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, pdfWorkerSrc]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc.default;
      return pdfjsLib;
    });
  }

  return pdfJsModulePromise;
};

const loadReusableLessonSeeds = (): Promise<ReusableLessonSeedsModule> => {
  if (!reusableLessonSeedsModulePromise) {
    reusableLessonSeedsModulePromise = import('./lib/reusableLessonSeeds');
  }

  return reusableLessonSeedsModulePromise;
};

const fetchSessionOnce = (endpoint: string): Promise<SessionCheckResult> => {
  if (sessionCheckCacheKey === endpoint && sessionCheckCachePromise) {
    return sessionCheckCachePromise;
  }

  sessionCheckCacheKey = endpoint;
  sessionCheckCachePromise = fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
  })
    .then(async (response) => ({
      ok: response.ok,
      payload: await response.json().catch(() => ({})),
    }))
    .catch((error) => {
      sessionCheckCacheKey = null;
      sessionCheckCachePromise = null;
      throw error;
    });

  return sessionCheckCachePromise;
};

const DEFAULT_LESSON_FORMAT = 'K-12';
const DEFAULT_PLAN_UNIT_LABEL = 'Day';
const GENERATION_CACHE_VERSION = 'lesson-plan-cache-v35';
const IMAGE_SEMANTIC_CACHE_VERSION = 'image-semantic-cache-v25';
const CACHE_HIT_LOADING_DELAY_MS = 1400;
const REUSABLE_GENERATION_LOADING_DELAY_MS = 2600;
const ADMIN_IMAGE_BATCH_LIMIT = 12;
const IMAGE_PROCESSING_CONCURRENCY = 3;
const PAID_IMAGE_ATTEMPTS_PER_DECK_LIMIT = 4;
const UPLOADED_IMAGE_CACHE_TARGET_BYTES = 3.5 * 1024 * 1024;
const UPLOADED_IMAGE_CACHE_MAX_EDGE_PX = 1920;
const UPLOADED_IMAGE_CACHE_JPEG_QUALITIES = [0.9, 0.82, 0.74, 0.66];
// Use only exact HD particle-model matches; unmapped particle visuals still go through generation/cached images.
const USE_STATIC_SCIENCE_PARTICLE_MODEL_IMAGES = true;
const UPLOADED_FILIPINO_LANGUAGE_SCORE_THRESHOLD = 5;
const UPLOADED_FILIPINO_LANGUAGE_MIN_HITS = 2;
const UPLOADED_FILIPINO_STRONG_SUBJECT_PATTERNS = [
  /\baraling\s+panlipunan\b/,
  /\baral\s*[- ]?\s*pan\b/,
  /\basignatura\s*[:\-]?\s*(?:filipino|araling\s+panlipunan|aral\s*[- ]?\s*pan)\b/,
  /\bsubject\s*[:\-]?\s*(?:filipino|araling\s+panlipunan|aral\s*[- ]?\s*pan)\b/,
];
const UPLOADED_FILIPINO_LANGUAGE_PATTERNS: Array<[RegExp, number]> = [
  [/\bfilipino\s+(?:sa|baitang|grade|quarter|kuwarter|markahan)\b/, 3],
  [/\b(?:una|ikalawa|ikatlo|ikaapat|ikalima|ikaanim|ikapito|ikawalo|ikasiyam|ikasampu)ng\s+(?:araw|sesyon)\b/, 3],
  [/\b(?:araw|sesyon)\s*(?:blg\.?|bilang|numero|#|:|-)?\s*\d{1,2}\b/, 2],
  [/\bbilang\s+ng\s+(?:mga\s+)?(?:araw|sesyon)\b/, 2],
  [/\blayunin(?:g)?\b/, 2],
  [/\bkasanayang\s+pampagkatuto\b/, 3],
  [/\bpinakamahalagang\s+kasanayan\b/, 3],
  [/\bpaksa\b/, 1],
  [/\bgawain\b/, 2],
  [/\bpagtataya\b/, 2],
  [/\btakdang\s*[- ]?\s*aralin\b/, 2],
  [/\bpamamaraan\b/, 2],
  [/\bpanimulang\s+gawain\b/, 2],
  [/\bpaglinang\b/, 2],
  [/\bpaglalahat\b/, 2],
  [/\bpaglalapat\b/, 2],
  [/\bmga\s+(?:mag[- ]?aaral|kagamitan|layunin|gawain)\b/, 1],
];
const CURATED_STATIC_IMAGE_ASSET_VERSION = '20260604-week1-approved-v7';
const CURATED_STATIC_IMAGE_BASE_PATH_BY_COLLECTION: Record<string, string> = {
  'values-education': '/curated-images/values-education',
  'english-poetry-imagery': '/curated-images/english/poetry-descriptions-imagery',
  'english-literature-values': '/curated-images/english/philippine-literature-values',
  'math-polygons': '/curated-images/math/polygons',
  'math-statistics-expressions': '/curated-images/math/statistics-expressions',
  'math-geometry-construction': '/curated-images/math/geometry-construction',
  'math-law-of-sines': '/curated-images/math/law-of-sines',
  'math-wages-income': '/curated-images/math/wages-income',
  'science-particle-model': '/curated-images/science/particle-model',
  'science-digestive-system': '/curated-images/science/digestive-system',
  'science-force-motion': '/curated-images/science/force-motion',
  'science-scientists-inventions': '/curated-images/science/scientists-inventions',
  'science-chemistry-reactions': '/curated-images/science/chemistry-reactions',
  'science-general-motion': '/curated-images/science/general-science-motion',
};
const CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE: Record<string, Record<string, string>> = {
  'values-education': {
    activity: 'practice.jpg',
    application: 'application.jpg',
    assignment: 'assignment.jpg',
    assessment: 'assessment.jpg',
    concept: 'concept.jpg',
    content: 'concept.jpg',
    generalization: 'generalization.jpg',
    model: 'model.jpg',
    objectives: 'overview.jpg',
    overview: 'overview.jpg',
    practice: 'practice.jpg',
    review: 'review.jpg',
    situation: 'situation.jpg',
    summary: 'generalization.jpg',
    'success-criteria': 'success-criteria.jpg',
  },
  'english-literature-values': {
    activity: 'g7e-hd-claim-evidence-table.png',
    application: 'g7e-hd-four-sentence-response.png',
    assignment: 'g7e-hd-focused-response-draft.png',
    assessment: 'g7e-hd-revision-reflection.png',
    concept: 'g7e-hd-literature-values-overview.png',
    content: 'g7e-hd-literature-values-overview.png',
    discussion: 'g7e-hd-context-meaning.png',
    generalization: 'g7e-hd-synthesis-sentence.png',
    model: 'g7e-hd-first-reading-trail.png',
    objectives: 'g7e-hd-literature-values-overview.png',
    overview: 'g7e-hd-literature-values-overview.png',
    practice: 'g7e-hd-four-sentence-response.png',
    review: 'g7e-hd-response-target-check.png',
    situation: 'g7e-hd-value-lens-warmup.png',
    summary: 'g7e-hd-focused-response-draft.png',
    'success-criteria': 'g7e-hd-response-target-check.png',
  },
  'english-poetry-imagery': {
    activity: 'classroom-activity-cards.png',
    application: 'tree-imagery-figurative-language.png',
    assignment: 'tree-imagery-figurative-language.png',
    assessment: 'evidence-table-card-sort.png',
    concept: 'describing-imagery-scene.png',
    content: 'describing-imagery-scene.png',
    discussion: 'describing-imagery-scene.png',
    generalization: 'evidence-table-card-sort.png',
    model: 'describing-imagery-scene.png',
    objectives: 'core-memory-sharing.png',
    overview: 'core-memory-sharing.png',
    practice: 'think-and-pick-word-puzzle.png',
    review: 'core-memory-sharing.png',
    situation: 'describing-imagery-scene.png',
    summary: 'evidence-table-card-sort.png',
    'success-criteria': 'expected-output-poem-annotation.png',
    vocabulary: 'think-and-pick-word-puzzle.png',
  },
  'math-polygons': {
    activity: 'g7-hd-side-angle-lab.png',
    application: 'g7-hd-measurement-audit.png',
    assignment: 'g7-hd-measurement-audit.png',
    assessment: 'g7-hd-measurement-audit.png',
    concept: 'g7-hd-polygon-overview.png',
    content: 'g7-hd-polygon-overview.png',
    discussion: 'g7-hd-regularity-rule.png',
    generalization: 'g7-hd-regularity-rule.png',
    model: 'g7-hd-pentagon-trace.png',
    objectives: 'g7-hd-polygon-overview.png',
    overview: 'g7-hd-polygon-overview.png',
    practice: 'g7-hd-polygon-studio.png',
    review: 'g7-hd-polygon-sort.png',
    situation: 'g7-hd-polygon-sort.png',
    summary: 'g7-hd-measurement-audit.png',
    'success-criteria': 'g7-hd-side-angle-lab.png',
  },
  'math-statistics-expressions': {
    activity: 'g8-hd-evidence-conclusion-card.png',
    application: 'g8-hd-data-expression-brief.png',
    assignment: 'g8-hd-data-expression-brief.png',
    assessment: 'g8-hd-three-measures-exit.png',
    concept: 'g8-hd-stat-algebra-overview.png',
    content: 'g8-hd-stat-algebra-overview.png',
    discussion: 'g8-hd-outlier-measure-match.png',
    generalization: 'g8-hd-evidence-conclusion-card.png',
    model: 'g8-hd-notebook-cost-expression.png',
    objectives: 'g8-hd-stat-algebra-overview.png',
    overview: 'g8-hd-stat-algebra-overview.png',
    practice: 'g8-hd-table-rule-expression.png',
    review: 'g8-hd-statistics-algebra-sort.png',
    situation: 'g8-hd-typical-score-prediction.png',
    summary: 'g8-hd-data-expression-brief.png',
    'success-criteria': 'g8-hd-data-expression-brief.png',
  },
  'math-geometry-construction': {
    activity: 'g9m-hd-perpendicular-step-check.png',
    application: 'g9m-hd-construction-report.png',
    assignment: 'g9m-hd-peer-audit-transfer.png',
    assessment: 'g9m-hd-notation-error-exit.png',
    concept: 'g9m-hd-geometry-overview.png',
    content: 'g9m-hd-geometry-overview.png',
    discussion: 'g9m-hd-two-method-parallel-compare.png',
    generalization: 'g9m-hd-construction-report.png',
    model: 'g9m-hd-equal-arc-trace.png',
    objectives: 'g9m-hd-geometry-overview.png',
    overview: 'g9m-hd-geometry-overview.png',
    practice: 'g9m-hd-notation-match-lab.png',
    review: 'g9m-hd-symbol-sort.png',
    situation: 'g9m-hd-symbol-sort.png',
    summary: 'g9m-hd-construction-report.png',
    'success-criteria': 'g9m-hd-report-walkthrough.png',
  },
  'math-law-of-sines': {
    activity: 'g10m-hd-asa-aas-solution-table.png',
    application: 'g10m-hd-law-sines-performance.png',
    assignment: 'g10m-hd-law-sines-performance.png',
    assessment: 'g10m-hd-ambiguity-peer-review.png',
    concept: 'g10m-hd-law-sines-overview.png',
    content: 'g10m-hd-law-sines-overview.png',
    discussion: 'g10m-hd-two-branch-sketch.png',
    generalization: 'g10m-hd-ssa-solution-tree.png',
    model: 'g10m-hd-aas-ratio-walkthrough.png',
    objectives: 'g10m-hd-law-sines-overview.png',
    overview: 'g10m-hd-law-sines-overview.png',
    practice: 'g10m-hd-ssa-solution-tree.png',
    review: 'g10m-hd-case-type-sort.png',
    situation: 'g10m-hd-opposite-pair-warmup.png',
    summary: 'g10m-hd-law-sines-performance.png',
    'success-criteria': 'g10m-hd-setup-checkpoint.png',
  },
  'math-wages-income': {
    activity: 'g11m-hd-two-column-solution.png',
    application: 'g11m-hd-portfolio-work.png',
    assignment: 'g11m-hd-pay-brief-template.png',
    assessment: 'g11m-hd-rubric-peer-review.png',
    concept: 'g11m-hd-income-overview.png',
    content: 'g11m-hd-income-overview.png',
    discussion: 'g11m-hd-sample-answer-check.png',
    generalization: 'g11m-hd-comparison-model.png',
    model: 'g11m-hd-salary-hourly-worked.png',
    objectives: 'g11m-hd-income-overview.png',
    overview: 'g11m-hd-income-overview.png',
    practice: 'g11m-hd-guided-payroll-pair.png',
    review: 'g11m-hd-method-choice-check.png',
    situation: 'g11m-hd-diagnostic-payroll-markup.png',
    summary: 'g11m-hd-pay-brief-template.png',
    'success-criteria': 'g11m-hd-pay-brief-template.png',
  },
  'science-particle-model': {
    activity: 'particle-evidence.png',
    application: 'phase-change-energy.png',
    assignment: 'assignment.png',
    assessment: 'assessment.png',
    'air-compression': 'air-compression.png',
    concept: 'particle-model.png',
    content: 'particle-model.png',
    'diffusion-temperature': 'diffusion-temperature.png',
    'dissolving-diffusion': 'dissolving-diffusion.png',
    generalization: 'generalization.png',
    model: 'particle-model.png',
    objectives: 'overview.png',
    overview: 'overview.png',
    'particle-evidence': 'particle-evidence.png',
    'particle-states': 'particle-states.png',
    'phase-change-energy': 'phase-change-energy.png',
    practice: 'particle-evidence.png',
    review: 'particle-evidence.png',
    situation: 'particle-evidence.png',
    summary: 'generalization.png',
    'success-criteria': 'particle-states.png',
  },
  'science-digestive-system': {
    activity: 'd8-hd-journey-build.png',
    application: 'd8-hd-journey-build.png',
    assignment: 'd8-hd-final-defense.png',
    assessment: 'd8-hd-final-defense.png',
    concept: 'd8-hd-overview.png',
    content: 'd8-hd-overview.png',
    discussion: 'd8-hd-evidence-retrieval.png',
    generalization: 'd8-hd-two-path-map.png',
    model: 'd8-hd-model-scientific.png',
    objectives: 'd8-hd-overview.png',
    overview: 'd8-hd-overview.png',
    practice: 'd8-hd-pathway-card-build.png',
    review: 'd8-hd-evidence-retrieval.png',
    situation: 'd8-hd-overview.png',
    summary: 'd8-hd-journey-output.png',
    'success-criteria': 'd8-hd-journey-output.png',
  },
  'science-force-motion': {
    activity: 'g9-hd-pull-trial.png',
    application: 'g9-hd-force-diagram-model.png',
    assignment: 'g9-hd-mastery-slip.png',
    assessment: 'g9-hd-mastery-slip.png',
    concept: 'g9-hd-balanced-unbalanced-board.png',
    content: 'g9-hd-overview.png',
    discussion: 'g9-hd-trend-board.png',
    generalization: 'g9-hd-velocity-map.png',
    model: 'g9-hd-force-diagram-model.png',
    objectives: 'g9-hd-overview.png',
    overview: 'g9-hd-overview.png',
    practice: 'g9-hd-motion-change-table.png',
    review: 'g9-hd-trend-board.png',
    situation: 'g9-hd-seatbelt-sort.png',
    summary: 'g9-hd-fma-model.png',
    'success-criteria': 'g9-hd-output-table.png',
  },
  'science-chemistry-reactions': {
    activity: 'g10-hd-micro-reaction-table.png',
    application: 'g10-hd-reaction-card-exit.png',
    assignment: 'g10-hd-reaction-card-exit.png',
    assessment: 'g10-hd-reaction-card-exit.png',
    concept: 'g10-hd-reaction-overview.png',
    content: 'g10-hd-reaction-overview.png',
    discussion: 'g10-hd-evidence-ladder.png',
    generalization: 'g10-hd-evidence-ladder.png',
    model: 'g10-hd-reaction-card-exit.png',
    objectives: 'g10-hd-reaction-overview.png',
    overview: 'g10-hd-reaction-overview.png',
    practice: 'g10-hd-micro-reaction-table.png',
    review: 'g10-hd-evidence-ladder.png',
    situation: 'g10-hd-reaction-overview.png',
    summary: 'g10-hd-reaction-card-exit.png',
    'success-criteria': 'g10-hd-micro-reaction-table.png',
  },
  'science-general-motion': {
    activity: 'g11-hd-cart-wheel-evidence.png',
    application: 'g11-hd-motion-explainer.png',
    assignment: 'g11-hd-motion-explainer.png',
    assessment: 'g11-hd-motion-explainer.png',
    concept: 'g11-hd-motion-overview.png',
    content: 'g11-hd-motion-overview.png',
    discussion: 'g11-hd-quality-life-map.png',
    generalization: 'g11-hd-circumference-model.png',
    model: 'g11-hd-two-motion-diagram.png',
    objectives: 'g11-hd-motion-overview.png',
    overview: 'g11-hd-motion-overview.png',
    practice: 'g11-hd-one-turn-trial.png',
    review: 'g11-hd-linear-angular-board.png',
    situation: 'g11-hd-motion-overview.png',
    summary: 'g11-hd-motion-explainer.png',
    'success-criteria': 'g11-hd-cart-wheel-evidence.png',
  },
};

const normalizeUploadedLanguageSignalText = (value: string): string => (
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
);

const inferUploadedLessonLanguage = (content: string, uploadedFileName = ''): AppLanguage | null => {
  const text = normalizeUploadedLanguageSignalText(`${uploadedFileName}\n${content.slice(0, 30_000)}`);
  if (!text) return null;

  if (UPLOADED_FILIPINO_STRONG_SUBJECT_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'FIL';
  }

  let score = 0;
  let hits = 0;
  UPLOADED_FILIPINO_LANGUAGE_PATTERNS.forEach(([pattern, weight]) => {
    if (pattern.test(text)) {
      score += weight;
      hits += 1;
    }
  });

  return score >= UPLOADED_FILIPINO_LANGUAGE_SCORE_THRESHOLD && hits >= UPLOADED_FILIPINO_LANGUAGE_MIN_HITS
    ? 'FIL'
    : null;
};
const USER_IMAGE_LIMIT_PLACEHOLDER = 'limit_reached';
const PROVIDER_IMAGE_LIMIT_PLACEHOLDER = 'provider_limit_reached';
const IMAGE_SKIPPED_PLACEHOLDER = 'image_generation_skipped';
const NON_EXPORTABLE_IMAGE_STATES = new Set([
  'error',
  'loading',
  USER_IMAGE_LIMIT_PLACEHOLDER,
  PROVIDER_IMAGE_LIMIT_PLACEHOLDER,
  IMAGE_SKIPPED_PLACEHOLDER,
]);
const PPTX_SLIDE_W = 10;
const PPTX_MARGIN_X = 0.58;
const PPTX_TITLE_Y = 0.34;
const PPTX_IMAGE_X = 0.58;
const PPTX_IMAGE_Y = 1.32;
const PPTX_IMAGE_W = 4.15;
const PPTX_IMAGE_H = 2.34;
const PPTX_CONTENT_X = 5.12;
const PPTX_CONTENT_Y = 1.26;
const PPTX_CONTENT_W = 4.28;
const PPTX_CONTENT_H = 3.62;
const PPTX_EVIDENCE_IMAGE_X = 0.44;
const PPTX_EVIDENCE_IMAGE_Y = 1.18;
const PPTX_EVIDENCE_IMAGE_W = 5.75;
const PPTX_EVIDENCE_IMAGE_H = 3.23;
const PPTX_EVIDENCE_CONTENT_X = 6.45;
const PPTX_EVIDENCE_CONTENT_Y = 1.18;
const PPTX_EVIDENCE_CONTENT_W = 3.05;
const PPTX_EVIDENCE_CONTENT_H = 3.55;
const PPTX_TEXT_ONLY_X = 0.78;
const PPTX_TEXT_ONLY_Y = 1.45;
const PPTX_TEXT_ONLY_W = 8.45;
const PPTX_TEXT_ONLY_H = 3.65;
const SAYUNA_WATERMARK_WIDTH_RATIO = 0.08;
const SAYUNA_WATERMARK_MARGIN_RATIO = 0.025;
const SAYUNA_WATERMARK_OPACITY = 0.26;
const PPTX_EXPORT_IMAGE_W = 1280;
const PPTX_EXPORT_IMAGE_H = 720;
const PPTX_EXPORT_JPEG_QUALITY = 0.86;
const getPptxExportImageFormat = (slide: Slide): PptxExportImageFormat => {
  if (slide.imageStyle === 'diagram' || slide.imageStyle === 'infographic') {
    return 'image/png';
  }

  if (slide.imageUrl?.startsWith('data:image/svg+xml')) {
    return 'image/png';
  }

  return 'image/jpeg';
};
const GRADE9_FORCE_MOTION_SCANNED_PDF_FALLBACK_TEXT = [
  'Grade 9 Science: Inertia, Net Force, and Acceleration Foundations',
  'Week 1 May 25-28 2026 Learning Sessions 1 2 3 4',
  'Learning competency: identify inertia as tendency for an object to stay at rest or in motion unless acted on by an unbalanced net force.',
  'Demonstrate and describe acceleration as change in speed and/or direction as a result of net force.',
  'Investigate the relationship among force, acceleration, and mass.',
  'Session 1 inertia, seatbelt prediction sort, coin-card-cup or paper-pull demo, signed net force, balanced force, unbalanced force, force diagram, inertia CER exit.',
  'Session 2 acceleration triage, motion change evidence table, velocity change map, speeding up, slowing down, turning, unbalanced force direction, cause and effect strip.',
  'Session 3 fair push question, pull strength data trial, constant mass, force acceleration data table, trend board, greater net force produces greater acceleration.',
  'Session 4 F = ma, formula meaning slip, worked acceleration cases, force diagram, units, acceleration direction from net force, constant mass mastery slip.',
].join('\\n');

type CachedLessonPlan = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const normalizeExtractedText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const mapWithConcurrency = async <T, R,>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }));

  return results;
};

let paidImageGenerationQueue: Promise<void> = Promise.resolve();

const runQueuedPaidImageGeneration = async <T,>(task: () => Promise<T>): Promise<T> => {
  const previous = paidImageGenerationQueue;
  let release: () => void = () => {};
  paidImageGenerationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    await previous.catch(() => undefined);
    return await task();
  } finally {
    release();
  }
};

const SESSION_COLUMN_MARKER_REGEX = /\b(?:learning\s+session|session|sesyon(?:\s+ng\s+pagkatuto)?|sesion)\s*(?:(?:no\.?|number|#)\s*)?(?::|-)?\s*(\d{1,2})\b/i;

type SessionTableColumn = {
  columnIndex: number;
  sessionNumber: number;
  label: string;
};

const findSessionTableColumns = (rows: string[][]): SessionTableColumn[] => {
  for (const cells of rows) {
    const firstCell = cells[0] || '';
    const hasSessionHeader = /\b(?:learning\s+session|session|sesyon|sesion)\b/i.test(firstCell);
    const sessionColumns = cells
      .map((cell, columnIndex) => {
        if (columnIndex === 0) return null;
        const markerMatch = cell.match(SESSION_COLUMN_MARKER_REGEX);
        const numberOnlyMatch = hasSessionHeader ? cell.match(/^\s*(\d{1,2})\s*$/) : null;
        const sessionNumber = markerMatch
          ? Number.parseInt(markerMatch[1], 10)
          : numberOnlyMatch
            ? Number.parseInt(numberOnlyMatch[1], 10)
            : NaN;
        if (!Number.isFinite(sessionNumber)) return null;
        return {
          columnIndex,
          sessionNumber,
          label: `Learning Session ${sessionNumber}`,
        };
      })
      .filter((column): column is SessionTableColumn => Boolean(column));

    if (sessionColumns.length >= 2) {
      return sessionColumns;
    }
  }

  return [];
};

const buildSessionColumnBlocks = (rows: string[][]): string[] => {
  const sessionColumns = findSessionTableColumns(rows);
  if (sessionColumns.length === 0) return [];

  return sessionColumns
    .map(({ columnIndex, label }) => {
      const details = rows
        .map((cells) => {
          const heading = normalizeExtractedText(cells[0] || '').slice(0, 180);
          const value = normalizeExtractedText(cells[columnIndex] || '');
          if (!value || value === label) return '';
          return heading ? `${heading}: ${value}` : value;
        })
        .filter(Boolean);

      return details.length > 0
        ? [`${label}:`, ...details].join('\n')
        : '';
    })
    .filter(Boolean);
};

const tableToStructuredText = (table: HTMLTableElement, tableIndex: number): string => {
  const rows = Array.from(table.rows)
    .map((row) => Array.from(row.cells).map((cell) => normalizeExtractedText(cell.textContent || '')))
    .filter((cells) => cells.some(Boolean));

  if (rows.length === 0) return '';

  return [
    `Table ${tableIndex + 1}:`,
    ...rows.map((cells) => `| ${cells.join(' | ')} |`),
    ...buildSessionColumnBlocks(rows),
  ].join('\n');
};

const htmlToStructuredText = (html: string): string => {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const blocks: string[] = [];
  let tableIndex = 0;

  document.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      const text = normalizeExtractedText(node.textContent || '');
      if (text) blocks.push(text);
      return;
    }

    const element = node as HTMLElement;
    if (element.tagName.toLowerCase() === 'table') {
      const tableText = tableToStructuredText(element as HTMLTableElement, tableIndex);
      tableIndex += 1;
      if (tableText) blocks.push(tableText);
      return;
    }

    const text = normalizeExtractedText(element.textContent || '');
    if (text) blocks.push(text);
  });

  return blocks.join('\n\n').trim();
};

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const inflateRawZipEntry = async (compressed: Uint8Array): Promise<Uint8Array | null> => {
  const decompressionStream = (globalThis as typeof globalThis & {
    DecompressionStream?: typeof DecompressionStream;
  }).DecompressionStream;

  if (!decompressionStream) return null;

  const compressedBuffer = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  );
  const stream = new Blob([compressedBuffer]).stream().pipeThrough(
    new decompressionStream('deflate-raw' as CompressionFormat),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const readDocxZipEntry = async (
  arrayBuffer: ArrayBuffer,
  matchesFileName: (fileName: string) => boolean,
): Promise<Uint8Array | null> => {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8');
  const eocdSearchStart = Math.max(0, bytes.length - 0xffff - 22);
  let eocdOffset = -1;

  for (let offset = bytes.length - 22; offset >= eocdSearchStart; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) return null;

  const centralDirectoryEntryCount = view.getUint16(eocdOffset + 10, true);
  let centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  for (let entryIndex = 0; entryIndex < centralDirectoryEntryCount; entryIndex += 1) {
    if (view.getUint32(centralDirectoryOffset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      return null;
    }

    const compressionMethod = view.getUint16(centralDirectoryOffset + 10, true);
    const compressedSize = view.getUint32(centralDirectoryOffset + 20, true);
    const fileNameLength = view.getUint16(centralDirectoryOffset + 28, true);
    const extraFieldLength = view.getUint16(centralDirectoryOffset + 30, true);
    const fileCommentLength = view.getUint16(centralDirectoryOffset + 32, true);
    const localHeaderOffset = view.getUint32(centralDirectoryOffset + 42, true);
    const fileNameStart = centralDirectoryOffset + 46;
    const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameStart + fileNameLength));

    if (matchesFileName(fileName)) {
      if (view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
        return null;
      }

      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraFieldLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawZipEntry(compressed);
      return null;
    }

    centralDirectoryOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return null;
};

const decodeQuotedPrintable = (value: string): string => {
  const output: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '=') {
      const next = value[index + 1];
      const following = value[index + 2];
      if (next === '\r' && following === '\n') {
        index += 2;
        continue;
      }
      if (next === '\n') {
        index += 1;
        continue;
      }
      const hex = value.slice(index + 1, index + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        output.push(Number.parseInt(hex, 16));
        index += 2;
        continue;
      }
    }

    const code = value.charCodeAt(index);
    output.push(code <= 0xff ? code : 0x20);
  }

  return new TextDecoder('utf-8').decode(new Uint8Array(output));
};

const extractHtmlFromMht = (mhtText: string): string => {
  const decoded = decodeQuotedPrintable(mhtText);
  const htmlStart = decoded.search(/<!doctype\s+html|<html[\s>]/i);
  if (htmlStart < 0) return '';

  const htmlEndMatch = decoded.slice(htmlStart).match(/<\/html>/i);
  const htmlEnd = htmlEndMatch?.index === undefined
    ? decoded.length
    : htmlStart + htmlEndMatch.index + htmlEndMatch[0].length;

  return decoded.slice(htmlStart, htmlEnd);
};

const extractAltChunkDocxText = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const altChunkBytes = await readDocxZipEntry(
    arrayBuffer,
    (fileName) => /^word\/afchunk.*\.(?:mht|html?)$/i.test(fileName),
  );

  if (!altChunkBytes) return '';

  const rawText = new TextDecoder('utf-8').decode(altChunkBytes);
  const html = extractHtmlFromMht(rawText) || rawText;
  return htmlToStructuredText(html);
};

const getPlanUnitLabel = (blueprint: LessonBlueprint | null): string => (
  blueprint?.planUnitLabel?.trim() || DEFAULT_PLAN_UNIT_LABEL
);

const waitForDuration = (durationMs: number): Promise<void> => (
  new Promise((resolve) => setTimeout(resolve, durationMs))
);

const assertSlidesGenerated = (slides: Slide[] | undefined | null, label: string): Slide[] => {
  if (!slides || slides.length === 0) {
    throw new Error(`${label} did not return any slides.`);
  }

  return slides;
};

const waitWithLoadingProgress = (
  setProgress: LoadingProgressSetter,
  durationMs: number,
  startProgress = 8,
  endProgress = 88,
): Promise<void> => {
  setProgress(startProgress);

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsedRatio = Math.min((Date.now() - startedAt) / durationMs, 1);
      const easedRatio = 1 - Math.pow(1 - elapsedRatio, 3);
      setProgress(startProgress + ((endProgress - startProgress) * easedRatio));

      if (elapsedRatio >= 1) {
        window.clearInterval(interval);
        resolve();
      }
    }, 80);
  });
};

const waitForCacheHitLoading = (setProgress?: LoadingProgressSetter): Promise<void> => (
  setProgress
    ? waitWithLoadingProgress(setProgress, CACHE_HIT_LOADING_DELAY_MS, 18, 82)
    : waitForDuration(CACHE_HIT_LOADING_DELAY_MS)
);

const waitForReusableGenerationLoading = (setProgress?: LoadingProgressSetter): Promise<void> => (
  setProgress
    ? waitWithLoadingProgress(setProgress, REUSABLE_GENERATION_LOADING_DELAY_MS, 12, 86)
    : waitForDuration(REUSABLE_GENERATION_LOADING_DELAY_MS)
);

const getKnownScannedPdfFallbackText = (file: File, pageCount: number): string => {
  const normalizedName = file.name.toLowerCase().replace(/\s+/g, ' ').trim();
  const isGrade9ForceMotionPdf = normalizedName === 'lesson_plan (1).pdf'
    && pageCount === 5
    && file.size >= 43_000_000
    && file.size <= 45_000_000;

  return isGrade9ForceMotionPdf ? GRADE9_FORCE_MOTION_SCANNED_PDF_FALLBACK_TEXT : '';
};

const finishLoadingProgress = async (setProgress: LoadingProgressSetter): Promise<void> => {
  setProgress(100);
  await waitForDuration(250);
};

const buildSlideImageCacheId = (scope: string | undefined, slideIndex: number): string | undefined => (
  scope ? `${scope}:image:${slideIndex}` : undefined
);

const normalizeImageSemanticText = (value: string | undefined): string => (
  (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
);

const slugifyImageSemanticText = (value: string | undefined): string => (
  normalizeImageSemanticText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const getDataUrlByteLength = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return 0;
  const base64 = dataUrl.slice(commaIndex + 1).replace(/\s+/g, '');
  const padding = (base64.match(/=+$/)?.[0].length) || 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const isR2SupportedImageDataUrl = (dataUrl: string): boolean => (
  /^data:image\/(?:png|jpe?g|webp);base64,/i.test(dataUrl)
);

const readFileAsDataUrl = (file: File): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Image file did not return a data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  })
);

const loadImageElement = (dataUrl: string): Promise<HTMLImageElement> => (
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load uploaded image.'));
    image.src = dataUrl;
  })
);

const resizeUploadedImageForCache = async (dataUrl: string): Promise<string> => {
  const image = await loadImageElement(dataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return dataUrl;

  let scale = Math.min(1, UPLOADED_IMAGE_CACHE_MAX_EDGE_PX / Math.max(sourceWidth, sourceHeight));
  let bestDataUrl = dataUrl;
  let bestByteLength = getDataUrlByteLength(dataUrl) || Number.POSITIVE_INFINITY;

  for (let dimensionAttempt = 0; dimensionAttempt < 4; dimensionAttempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return bestDataUrl;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of UPLOADED_IMAGE_CACHE_JPEG_QUALITIES) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      const candidateByteLength = getDataUrlByteLength(candidate);
      if (candidateByteLength < bestByteLength) {
        bestDataUrl = candidate;
        bestByteLength = candidateByteLength;
      }
      if (candidateByteLength <= UPLOADED_IMAGE_CACHE_TARGET_BYTES) {
        return candidate;
      }
    }

    scale *= 0.82;
  }

  return bestDataUrl;
};

const prepareUploadedImageForCache = async (file: File): Promise<string> => {
  const dataUrl = await readFileAsDataUrl(file);
  if (isR2SupportedImageDataUrl(dataUrl) && getDataUrlByteLength(dataUrl) <= UPLOADED_IMAGE_CACHE_TARGET_BYTES) {
    return dataUrl;
  }

  return resizeUploadedImageForCache(dataUrl);
};

const isValuesEducationSemanticSubject = (value: string | undefined): boolean => {
  const subjectSlug = slugifyImageSemanticText(value);
  const parts = subjectSlug.split('-');
  return subjectSlug === 'values-education'
    || subjectSlug === 'values-ed'
    || subjectSlug === 'esp'
    || subjectSlug === 'edukasyon-sa-pagpapakatao'
    || subjectSlug === 'edukasyon-sa-pagpapakatao-esp'
    || subjectSlug === 'values-education-esp'
    || subjectSlug.includes('values-education')
    || subjectSlug.includes('edukasyon-sa-pagpapakatao')
    || parts.includes('esp');
};

const isMathPolygonsSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasMathSubject = subjectSlug === 'mathematics'
    || subjectSlug === 'math'
    || searchable.includes('mathematics')
    || searchable.includes('math');
  const hasPolygonTopic = searchable.includes('constructing-and-describing-polygons')
    || searchable.includes('regular-polygon')
    || searchable.includes('irregular-polygon')
    || searchable.includes('polygon')
    || searchable.includes('side-angle')
    || searchable.includes('side-length')
    || searchable.includes('angle-measure')
    || searchable.includes('protractor')
    || searchable.includes('ruler')
    || searchable.includes('triangle')
    || searchable.includes('quadrilateral')
    || searchable.includes('pentagon')
    || searchable.includes('hexagon')
    || searchable.includes('octagon')
    || searchable.includes('decagon');

  return hasMathSubject && hasPolygonTopic;
};

const isEnglishLiteratureValuesSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasEnglishSubject = subjectSlug === 'english'
    || searchable.includes('english');
  const hasLiteratureValuesTopic = searchable.includes('philippine-literary-text')
    || searchable.includes('literary-text')
    || searchable.includes('communal-value')
    || searchable.includes('individual-value')
    || searchable.includes('characterization')
    || searchable.includes('character-evidence')
    || searchable.includes('claim-evidence')
    || searchable.includes('conflict-type')
    || searchable.includes('plot-pressure')
    || searchable.includes('value-under-pressure')
    || searchable.includes('literary-response')
    || searchable.includes('context-meaning')
    || searchable.includes('response-draft')
    || searchable.includes('trait-precision');

  return hasEnglishSubject && hasLiteratureValuesTopic;
};

const isEnglishPoetryImagerySemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasEnglishSubject = subjectSlug === 'english'
    || subjectSlug.includes('english')
    || searchable.includes('english');
  const hasPoetryImageryTopic = searchable.includes('poetry-descriptions-imagery')
    || searchable.includes('descriptions-and-imagery')
    || searchable.includes('poetry')
    || searchable.includes('imagery')
    || searchable.includes('descriptive-words')
    || searchable.includes('literary-text')
    || searchable.includes('en7lit-i-1')
    || searchable.includes('context-clues')
    || searchable.includes('figurative-language')
    || searchable.includes('personification')
    || searchable.includes('rhyme')
    || searchable.includes('stanza')
    || searchable.includes('tone')
    || searchable.includes('diction')
    || searchable.includes('biographical-context')
    || searchable.includes('historical-context')
    || searchable.includes('sociocultural-context')
    || searchable.includes('for-the-young-yearning-a-song-of-green');

  return hasEnglishSubject && hasPoetryImageryTopic;
};

const isMathStatisticsExpressionsSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasMathSubject = subjectSlug === 'mathematics'
    || subjectSlug === 'math'
    || searchable.includes('mathematics')
    || searchable.includes('math');
  const hasStatisticsOrExpressionTopic = searchable.includes('measures-of-central-tendency')
    || searchable.includes('mean')
    || searchable.includes('median')
    || searchable.includes('mode')
    || searchable.includes('ungrouped-data')
    || searchable.includes('statistical-data')
    || searchable.includes('data-conclusion')
    || searchable.includes('computed-evidence')
    || searchable.includes('outlier')
    || searchable.includes('algebraic-expression')
    || searchable.includes('expression-model')
    || searchable.includes('variable')
    || searchable.includes('constant')
    || searchable.includes('table-rule-expression');

  return hasMathSubject && hasStatisticsOrExpressionTopic;
};

const isMathGeometryConstructionSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasMathSubject = subjectSlug === 'mathematics'
    || subjectSlug === 'math'
    || searchable.includes('mathematics')
    || searchable.includes('math');
  const hasGeometryConstructionTopic = searchable.includes('geometric-object')
    || searchable.includes('geometric-notation')
    || searchable.includes('line-construction')
    || searchable.includes('construction-report')
    || searchable.includes('perpendicular')
    || searchable.includes('parallel')
    || searchable.includes('compass')
    || searchable.includes('straightedge')
    || searchable.includes('equal-arc')
    || searchable.includes('copied-angle')
    || searchable.includes('notation-match')
    || searchable.includes('line-segment')
    || searchable.includes('ray')
    || searchable.includes('plane');

  return hasMathSubject && hasGeometryConstructionTopic;
};

const isMathLawOfSinesSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasMathSubject = subjectSlug === 'mathematics'
    || subjectSlug === 'math'
    || searchable.includes('mathematics')
    || searchable.includes('math');
  const hasLawOfSinesTopic = searchable.includes('law-of-sines')
    || searchable.includes('oblique-triangle')
    || searchable.includes('ambiguous-case')
    || searchable.includes('opposite-angle-side')
    || searchable.includes('opposite-pair')
    || searchable.includes('ssa')
    || searchable.includes('asa')
    || searchable.includes('aas')
    || searchable.includes('height-test')
    || searchable.includes('arcsin')
    || searchable.includes('supplement')
    || searchable.includes('solution-tree')
    || searchable.includes('solution-fork')
    || searchable.includes('branch')
    || searchable.includes('case-type')
    || searchable.includes('shoreline');

  return hasMathSubject && hasLawOfSinesTopic;
};

const isMathWagesIncomeSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasMathSubject = subjectSlug === 'mathematics'
    || subjectSlug === 'math'
    || subjectSlug === 'general-mathematics'
    || searchable.includes('mathematics')
    || searchable.includes('math');
  const hasWagesIncomeTopic = searchable.includes('wage')
    || searchable.includes('salary')
    || searchable.includes('benefit')
    || searchable.includes('deduction')
    || searchable.includes('commission')
    || searchable.includes('piecework')
    || searchable.includes('gross-income')
    || searchable.includes('net-income')
    || searchable.includes('overtime')
    || searchable.includes('allowance')
    || searchable.includes('payroll')
    || searchable.includes('first-job')
    || searchable.includes('source-data')
    || searchable.includes('pay-computation-brief')
    || searchable.includes('portfolio');

  return hasMathSubject && hasWagesIncomeTopic;
};

const isScienceParticleModelSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasScienceSubject = subjectSlug === 'science'
    || subjectSlug.includes('science')
    || searchable.includes('science');
  const hasParticleModelTopic = searchable.includes('particle-model')
    || searchable.includes('particle-motion')
    || searchable.includes('particle-arrangement')
    || searchable.includes('states-of-matter')
    || searchable.includes('changes-of-state')
    || searchable.includes('phase-change')
    || (searchable.includes('particle') && searchable.includes('matter'));

  return hasScienceSubject && hasParticleModelTopic;
};

const isScienceDigestiveSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasScienceSubject = subjectSlug === 'science'
    || subjectSlug.includes('science')
    || searchable.includes('science');
  const hasDigestiveTopic = searchable.includes('digestive-tract')
    || searchable.includes('digestive-process')
    || searchable.includes('digestion')
    || searchable.includes('mechanical-processing')
    || searchable.includes('chemical-digestion')
    || searchable.includes('secretion')
    || searchable.includes('absorption')
    || searchable.includes('elimination')
    || searchable.includes('small-intestine')
    || searchable.includes('villi')
    || searchable.includes('accessory-organ')
    || searchable.includes('food-path');

  return hasScienceSubject && hasDigestiveTopic;
};

const isScienceScientistsInventionsSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasScienceSubject = subjectSlug === 'science'
    || subjectSlug.includes('science')
    || searchable.includes('science');
  const hasScientistInventionSignal = searchable.includes('scientists-inventions')
    || searchable.includes('scientist-and-invention')
    || searchable.includes('scientist-invention')
    || searchable.includes('scientist-and-their-invention')
    || searchable.includes('famous-filipino-and-or-foreign-scientist');
  const hasSourceEvidenceSignal = searchable.includes('source-evidence')
    || searchable.includes('source-supported')
    || searchable.includes('source-opinion')
    || searchable.includes('secondary-sources')
    || searchable.includes('profile-card');

  return hasScienceSubject && hasScientistInventionSignal && hasSourceEvidenceSignal;
};

const isScienceForceMotionSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasScienceSubject = subjectSlug === 'science'
    || subjectSlug.includes('science')
    || searchable.includes('science');
  const hasForceMotionTopic = searchable.includes('inertia')
    || searchable.includes('net-force')
    || searchable.includes('balanced-force')
    || searchable.includes('unbalanced-force')
    || searchable.includes('force-diagram')
    || searchable.includes('force-motion')
    || searchable.includes('force-and-acceleration')
    || searchable.includes('acceleration-foundation')
    || searchable.includes('velocity-change')
    || searchable.includes('motion-change')
    || searchable.includes('constant-mass')
    || searchable.includes('pull-strength')
    || searchable.includes('f-ma')
    || searchable.includes('formula-meaning')
    || searchable.includes('seatbelt-prediction');

  return hasScienceSubject && hasForceMotionTopic;
};

const isScienceChemistryReactionsSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasScienceSubject = subjectSlug === 'science'
    || subjectSlug.includes('science')
    || searchable.includes('science');
  const hasChemistryTopic = searchable.includes('reaction-indicator')
    || searchable.includes('chemical-reaction')
    || searchable.includes('acid-base')
    || searchable.includes('acid')
    || searchable.includes('base')
    || searchable.includes('salt')
    || searchable.includes('indicator')
    || searchable.includes('red-cabbage')
    || searchable.includes('litmus')
    || searchable.includes('ph-paper')
    || searchable.includes('neutralization')
    || searchable.includes('unknown-sample')
    || searchable.includes('micro-reaction')
    || searchable.includes('color-trail')
    || searchable.includes('vinegar')
    || searchable.includes('baking-soda');

  return hasScienceSubject && hasChemistryTopic;
};

const isScienceGeneralMotionSemanticSubject = (metadata: ImageSemanticMetadata): boolean => {
  const subjectSlug = slugifyImageSemanticText(metadata.subject);
  const searchable = slugifyImageSemanticText([
    metadata.subject,
    metadata.topic,
    metadata.learningCompetency,
    metadata.semanticAnchor,
  ].filter(Boolean).join(' '));

  const hasScienceSubject = subjectSlug === 'science'
    || subjectSlug.includes('science')
    || searchable.includes('science');
  const hasGeneralMotionTopic = searchable.includes('physics-in-daily-life')
    || searchable.includes('quality-of-life')
    || searchable.includes('translational-motion')
    || searchable.includes('rotational-motion')
    || searchable.includes('linear-angular')
    || searchable.includes('linear-distance')
    || searchable.includes('angular-turn')
    || searchable.includes('wheel-size')
    || searchable.includes('distance-turn')
    || searchable.includes('one-turn')
    || searchable.includes('same-turn')
    || searchable.includes('circumference')
    || searchable.includes('radius')
    || searchable.includes('diameter')
    || searchable.includes('device-motion')
    || searchable.includes('motion-explainer')
    || searchable.includes('cart-wheel');

  return hasScienceSubject && hasGeneralMotionTopic;
};

const LEGACY_SCIENCE_PARTICLE_MODEL_STATIC_FILES = new Set([
  'air-compression.png',
  'assessment.png',
  'assignment.png',
  'diffusion-temperature.png',
  'dissolving-diffusion.png',
  'generalization.png',
  'overview.png',
  'particle-evidence.png',
  'particle-model.png',
  'particle-states.png',
  'phase-change-energy.png',
  's2-fair-test-evidence.png',
  's2-fair-test-setup.png',
  's2-faster-motion.png',
  's2-mastery-check.png',
  's2-misconception.png',
  's2-pattern.png',
  's2-prediction.png',
  's2-spacing-attraction.png',
  's2-warm-drink.png',
  's2-watch-spread.png',
  's3-compare.png',
  's3-diagram-checklist.png',
  's3-diagram-criteria.png',
  's3-gas.png',
  's3-liquid.png',
  's3-mini-check.png',
  's3-mystery-revision.png',
  's3-peer-feedback.png',
  's3-solid.png',
  's3-three-samples.png',
  's4-assignment.png',
  's4-cer.png',
  's4-cooling-row.png',
  's4-defend.png',
  's4-droplets-source.png',
  's4-energy-rules.png',
  's4-energy-sort.png',
  's4-four-phase-changes.png',
  's4-heating-row.png',
  's4-melting-droplets.png',
]);

const getScienceParticleModelStaticFileNameFromUrl = (imageUrl: string): string | undefined => {
  const pathPart = imageUrl.split('?')[0] || '';
  const marker = '/curated-images/science/particle-model/';
  const markerIndex = pathPart.indexOf(marker);
  if (markerIndex < 0) return undefined;
  return pathPart.slice(markerIndex + marker.length);
};

const isRejectedScienceParticleModelImageUrl = (
  imageUrl: string | undefined,
  metadata: ImageSemanticMetadata | undefined,
): boolean => {
  if (!imageUrl || !metadata || !isScienceParticleModelSemanticSubject(metadata)) return false;
  if (imageUrl.startsWith('data:image/svg+xml')) return true;

  const staticFileName = getScienceParticleModelStaticFileNameFromUrl(imageUrl);
  return staticFileName ? LEGACY_SCIENCE_PARTICLE_MODEL_STATIC_FILES.has(staticFileName) : false;
};

const getCuratedStaticImageCollection = (metadata: ImageSemanticMetadata | undefined): string | undefined => {
  if (!metadata) return undefined;
  if (isValuesEducationSemanticSubject(metadata.subject || metadata.topic)) return 'values-education';
  if (isEnglishPoetryImagerySemanticSubject(metadata)) return 'english-poetry-imagery';
  if (isEnglishLiteratureValuesSemanticSubject(metadata)) return 'english-literature-values';
  if (isMathWagesIncomeSemanticSubject(metadata)) return 'math-wages-income';
  if (isMathLawOfSinesSemanticSubject(metadata)) return 'math-law-of-sines';
  if (isMathGeometryConstructionSemanticSubject(metadata)) return 'math-geometry-construction';
  if (isMathStatisticsExpressionsSemanticSubject(metadata)) return 'math-statistics-expressions';
  if (isMathPolygonsSemanticSubject(metadata)) return 'math-polygons';
  if (isScienceChemistryReactionsSemanticSubject(metadata)) return 'science-chemistry-reactions';
  if (isScienceGeneralMotionSemanticSubject(metadata)) return 'science-general-motion';
  if (isScienceForceMotionSemanticSubject(metadata)) return 'science-force-motion';
  if (isScienceScientistsInventionsSemanticSubject(metadata)) return 'science-scientists-inventions';
  if (isScienceParticleModelSemanticSubject(metadata)) return 'science-particle-model';
  if (isScienceDigestiveSemanticSubject(metadata)) return 'science-digestive-system';
  return undefined;
};

const getScienceForceMotionImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['inertia-net-force-and-acceleration-foundations', 'g9-hd-overview.png'],
    ['what-will-make-motion-change', 'g9-hd-inertia-opener.png'],
    ['todays-investigation-path', 'g9-hd-inertia-roles.png'],
    ['evidence-goal-inertia-and-net-force', 'g9-hd-balanced-unbalanced-board.png'],
    ['seatbelt-prediction-sort', 'g9-hd-seatbelt-sort.png'],
    ['inertia-demo-and-net-force-line', 'g9-hd-inertia-demo.png'],
    ['output-check-net-force-table', 'g9-hd-output-table.png'],
    ['expected-output-observation-net-force-table', 'g9-hd-output-table.png'],
    ['team-roles-and-safety', 'g9-hd-inertia-roles.png'],
    ['roles-timing-and-safety-inertia-demo', 'g9-hd-inertia-roles.png'],
    ['balanced-or-unbalanced-evidence-board', 'g9-hd-balanced-unbalanced-board.png'],
    ['force-diagram-caption-clinic', 'g9-hd-force-diagram-model.png'],
    ['inertia-is-not-a-pushing-force', 'g9-hd-inertia-misconception.png'],
    ['cer-exit-inertia-and-net-force', 'g9-hd-inertia-exit.png'],
    ['inertia-cer-exit', 'g9-hd-inertia-exit.png'],
    ['how-can-motion-change-without-speeding-up', 'g9-hd-turning-acceleration.png'],
    ['can-motion-change-without-speeding-up', 'g9-hd-turning-acceleration.png'],
    ['todays-motion-evidence-path', 'g9-hd-acceleration-roles.png'],
    ['evidence-goal-acceleration', 'g9-hd-force-diagram-model.png'],
    ['acceleration-or-not-triage', 'g9-hd-acceleration-triage.png'],
    ['motion-change-evidence-table', 'g9-hd-motion-change-table.png'],
    ['output-check-motion-change-table', 'g9-hd-motion-output.png'],
    ['expected-output-motion-change-table', 'g9-hd-motion-output.png'],
    ['team-roles-and-safety-motion-evidence', 'g9-hd-acceleration-roles.png'],
    ['roles-timing-and-safety-motion-evidence', 'g9-hd-acceleration-roles.png'],
    ['velocity-change-map', 'g9-hd-velocity-map.png'],
    ['acceleration-cause-and-effect-strip', 'g9-hd-acceleration-strip.png'],
    ['turning-can-still-be-acceleration', 'g9-hd-turning-acceleration.png'],
    ['direction-change-exit-case', 'g9-hd-direction-exit.png'],
    ['how-do-we-test-force-fairly', 'g9-hd-overview.png'],
    ['todays-fair-test-evidence-path', 'g9-hd-pull-roles.png'],
    ['evidence-goal-force-and-acceleration', 'g9-hd-force-data-table.png'],
    ['fair-test-setup-decision', 'g9-hd-fair-push-question.png'],
    ['fair-push-question', 'g9-hd-fair-push-question.png'],
    ['pull-strength-data-trial', 'g9-hd-pull-trial.png'],
    ['output-check-force-acceleration-data-table', 'g9-hd-force-data-table.png'],
    ['expected-output-force-acceleration-data-table', 'g9-hd-force-data-table.png'],
    ['team-roles-and-safety-pull-trial', 'g9-hd-pull-roles.png'],
    ['roles-timing-and-safety-pull-trial', 'g9-hd-pull-roles.png'],
    ['trend-talk-board', 'g9-hd-trend-board.png'],
    ['constant-mass-relationship-model', 'g9-hd-constant-mass-model.png'],
    ['fair-test-mischeck', 'g9-hd-fair-test-mischeck.png'],
    ['fair-test-transfer-exit', 'g9-hd-fair-test-exit.png'],
    ['how-does-f-ma-keep-its-meaning', 'g9-hd-formula-meaning.png'],
    ['todays-calculation-evidence-path', 'g9-hd-fma-roles.png'],
    ['evidence-goal-f-ma-with-meaning', 'g9-hd-fma-model.png'],
    ['formula-meaning-warm-up', 'g9-hd-formula-meaning.png'],
    ['worked-acceleration-case-set', 'g9-hd-worked-case.png'],
    ['output-check-two-worked-solutions', 'g9-hd-worked-output.png'],
    ['expected-output-two-worked-solutions', 'g9-hd-worked-output.png'],
    ['team-roles-and-accuracy-checks', 'g9-hd-fma-roles.png'],
    ['roles-timing-and-accuracy-checks', 'g9-hd-fma-roles.png'],
    ['answer-reasonableness-conference', 'g9-hd-answer-conference.png'],
    ['force-to-acceleration-worked-model', 'g9-hd-fma-model.png'],
    ['direction-before-the-number', 'g9-hd-direction-before-number.png'],
    ['constant-mass-mastery-slip', 'g9-hd-mastery-slip.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['science-force-motion'];
  return templateMap?.[template] || templateMap?.content;
};

const getScienceDigestiveImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['digestive-tract-and-digestive-processes', 'd8-hd-overview.png'],
    ['what-does-food-pass-through', 'd8-hd-food-pass-through.png'],
    ['digestive-pathway-card-build', 'd8-hd-pathway-card-build.png'],
    ['main-activity-digestive-pathway-card-build', 'd8-hd-pathway-card-build.png'],
    ['pathway-build-evidence-check', 'd8-hd-pathway-card-build.png'],
    ['expected-output-annotated-pathway-map', 'd8-hd-annotated-pathway.png'],
    ['roles-timing-and-safety-pathway-build', 'd8-hd-pathway-roles.png'],
    ['pathway-checkpoint-mouth-to-anus', 'd8-hd-mouth-to-anus-path.png'],
    ['tract-or-helper-evidence-board', 'd8-hd-tract-helper-board.png'],
    ['mouth-and-esophagus-first-movement', 'd8-hd-mouth-esophagus.png'],
    ['stomach-and-intestines-next-stops', 'd8-hd-stomach-intestines.png'],
    ['accessory-organs-help-digestion', 'd8-hd-accessory-organs.png'],
    ['arrow-and-function-diagram', 'd8-hd-arrow-function.png'],
    ['common-pathway-mistake', 'd8-hd-pathway-mistake.png'],
    ['food-path-exit-map', 'd8-hd-exit-map.png'],
    ['what-changed-and-what-did-not-change', 'd8-hd-process-model.png'],
    ['crush-mix-and-secretions-model', 'd8-hd-crush-mix-model.png'],
    ['main-activity-crush-mix-and-secretions-model', 'd8-hd-crush-mix-model.png'],
    ['model-evidence-crush-mix-secretions', 'd8-hd-crush-mix-model.png'],
    ['expected-output-three-process-evidence-table', 'd8-hd-process-evidence-table.png'],
    ['roles-timing-and-safety-process-models', 'd8-hd-process-roles.png'],
    ['mechanical-processing', 'd8-hd-mechanical-processing.png'],
    ['secretion', 'd8-hd-secretion.png'],
    ['chemical-digestion', 'd8-hd-chemical-digestion.png'],
    ['process-sorting-wall', 'd8-hd-process-sort.png'],
    ['mouth-and-stomach-annotation', 'd8-hd-mouth-stomach-annotation.png'],
    ['model-limitation-check', 'd8-hd-model-limitations.png'],
    ['three-process-quick-check', 'd8-hd-process-quick-check.png'],
    ['what-should-the-body-keep', 'd8-hd-two-path-fork.png'],
    ['villi-fold-and-dot-test', 'd8-hd-villi-fold-test.png'],
    ['main-activity-villi-fold-and-dot-test', 'd8-hd-villi-fold-test.png'],
    ['fold-and-dot-evidence-check', 'd8-hd-villi-fold-test.png'],
    ['expected-output-absorption-elimination-flow-chart', 'd8-hd-abs-elim-output.png'],
    ['roles-timing-and-safety-villi-model', 'd8-hd-villi-roles.png'],
    ['surface-area-evidence', 'd8-hd-surface-area-evidence.png'],
    ['small-intestine-and-villi', 'd8-hd-small-intestine-villi.png'],
    ['nutrients-enter-blood', 'd8-hd-nutrients-blood.png'],
    ['undigested-material-continues', 'd8-hd-waste-path.png'],
    ['two-path-digestion-map', 'd8-hd-two-path-map.png'],
    ['absorption-and-elimination-labels', 'd8-hd-abs-elim-labels.png'],
    ['misconception-repair-slip', 'd8-hd-absorption-misconception.png'],
    ['what-makes-a-model-scientific', 'd8-hd-model-scientific.png'],
    ['evidence-card-retrieval', 'd8-hd-evidence-retrieval.png'],
    ['caption-clinic', 'd8-hd-caption-clinic.png'],
    ['digestive-journey-model-build', 'd8-hd-journey-build.png'],
    ['main-activity-evidence-based-digestive-journey-model', 'd8-hd-journey-build.png'],
    ['expected-output-digestive-journey-model', 'd8-hd-journey-output.png'],
    ['roles-timing-and-safety-final-model', 'd8-hd-final-roles.png'],
    ['pathway-and-helper-check', 'd8-hd-pathway-helper-check.png'],
    ['five-process-captions', 'd8-hd-five-captions.png'],
    ['misconception-warning', 'd8-hd-misconception-warning.png'],
    ['peer-audit', 'd8-hd-peer-audit.png'],
    ['final-defense-sentence', 'd8-hd-final-defense.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['science-digestive-system'];
  return templateMap?.[template] || templateMap?.content;
};

const getScienceChemistryReactionsImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['reaction-indicators-acids-bases-and-salts', 'g10-hd-reaction-overview.png'],
    ['how-can-evidence-show-a-chemical-reaction', 'g10-hd-reaction-overview.png'],
    ['today-s-reaction-evidence-path', 'g10-hd-micro-reaction-table.png'],
    ['todays-reaction-evidence-path', 'g10-hd-micro-reaction-table.png'],
    ['evidence-goal-reaction-indicators', 'g10-hd-reaction-overview.png'],
    ['change-evidence-warm-up', 'g10-hd-reaction-overview.png'],
    ['micro-reaction-evidence-table', 'g10-hd-micro-reaction-table.png'],
    ['output-check-reaction-evidence-table', 'g10-hd-micro-reaction-table.png'],
    ['team-roles-and-safety-micro-reactions', 'g10-hd-micro-reaction-table.png'],
    ['evidence-ladder-discussion', 'g10-hd-evidence-ladder.png'],
    ['reaction-evidence-card', 'g10-hd-reaction-card-exit.png'],
    ['reaction-evidence-caution', 'g10-hd-evidence-ladder.png'],
    ['evidence-exit-sort', 'g10-hd-reaction-card-exit.png'],

    ['how-can-an-indicator-replace-guessing', 'g10-hd-indicator-color-trail.png'],
    ['today-s-indicator-evidence-path', 'g10-hd-indicator-color-trail.png'],
    ['todays-indicator-evidence-path', 'g10-hd-indicator-color-trail.png'],
    ['evidence-goal-indicator-classification', 'g10-hd-indicator-color-trail.png'],
    ['safe-indicator-prediction', 'g10-hd-indicator-color-trail.png'],
    ['indicator-color-trail', 'g10-hd-indicator-color-trail.png'],
    ['output-check-color-trail-table', 'g10-hd-indicator-color-trail.png'],
    ['team-roles-and-safety-indicators', 'g10-hd-indicator-color-trail.png'],
    ['color-evidence-conference', 'g10-hd-indicator-color-trail.png'],
    ['unknown-sample-evidence-trail', 'g10-hd-unknown-evidence-trail.png'],
    ['tasting-is-not-evidence', 'g10-hd-unknown-evidence-trail.png'],
    ['indicator-safety-exit', 'g10-hd-unknown-evidence-trail.png'],

    ['what-changes-drop-by-drop', 'g10-hd-neutralization-sequence.png'],
    ['today-s-neutralization-evidence-path', 'g10-hd-neutralization-sequence.png'],
    ['todays-neutralization-evidence-path', 'g10-hd-neutralization-sequence.png'],
    ['evidence-goal-neutralization', 'g10-hd-neutralization-sequence.png'],
    ['drop-by-drop-forecast', 'g10-hd-neutralization-sequence.png'],
    ['neutralization-color-sequence', 'g10-hd-neutralization-sequence.png'],
    ['output-check-drop-count-sequence-table', 'g10-hd-neutralization-sequence.png'],
    ['team-roles-and-safety-neutralization', 'g10-hd-neutralization-model.png'],
    ['what-changed-discussion', 'g10-hd-neutralization-model.png'],
    ['before-during-after-neutralization-model', 'g10-hd-neutralization-model.png'],
    ['near-neutral-does-not-mean-nothing', 'g10-hd-neutralization-model.png'],
    ['neutralization-interpretation-slip', 'g10-hd-neutralization-model.png'],

    ['how-do-scientists-classify-an-unknown-safely', 'g10-hd-unknown-investigation.png'],
    ['today-s-unknown-evidence-path', 'g10-hd-unknown-investigation.png'],
    ['todays-unknown-evidence-path', 'g10-hd-unknown-investigation.png'],
    ['evidence-goal-unknown-classification', 'g10-hd-unknown-investigation.png'],
    ['evidence-before-claim', 'g10-hd-unknown-investigation.png'],
    ['unknown-sample-investigation', 'g10-hd-unknown-investigation.png'],
    ['output-check-unknown-sample-table', 'g10-hd-unknown-investigation.png'],
    ['team-roles-and-safety-unknowns', 'g10-hd-unknown-investigation.png'],
    ['disagreement-clinic', 'g10-hd-unknown-cer-mastery.png'],
    ['unknown-sample-cer-brief', 'g10-hd-unknown-cer-mastery.png'],
    ['likely-or-unsure-is-scientific', 'g10-hd-unknown-cer-mastery.png'],
    ['individual-mastery-case', 'g10-hd-unknown-cer-mastery.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['science-chemistry-reactions'];
  return templateMap?.[template] || templateMap?.content;
};

const getScienceGeneralMotionImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['physics-in-daily-life-translational-motion-and-rotational-motion', 'g11-hd-motion-overview.png'],
    ['learning-roadmap', 'g11-hd-motion-overview.png'],
    ['how-we-will-work-like-physicists', 'g11-hd-linear-angular-board.png'],

    ['how-can-one-device-move-in-two-ways', 'g11-hd-motion-overview.png'],
    ['today-s-motion-evidence-path', 'g11-hd-cart-wheel-evidence.png'],
    ['todays-motion-evidence-path', 'g11-hd-cart-wheel-evidence.png'],
    ['evidence-goal-motion-in-daily-devices', 'g11-hd-motion-overview.png'],
    ['motion-around-us-sort', 'g11-hd-quality-life-map.png'],
    ['cart-and-wheel-evidence-demo', 'g11-hd-cart-wheel-evidence.png'],
    ['output-check-path-turn-use-table', 'g11-hd-cart-wheel-evidence.png'],
    ['team-roles-and-safety-cart-and-wheel', 'g11-hd-cart-wheel-evidence.png'],
    ['quality-of-life-physics-map', 'g11-hd-quality-life-map.png'],
    ['two-motion-diagram', 'g11-hd-two-motion-diagram.png'],
    ['translation-and-rotation-mischeck', 'g11-hd-two-motion-diagram.png'],
    ['exit-claim-with-evidence', 'g11-hd-motion-explainer.png'],

    ['how-far-does-one-full-turn-move', 'g11-hd-one-turn-trial.png'],
    ['today-s-distance-turn-evidence-path', 'g11-hd-one-turn-trial.png'],
    ['todays-distance-turn-evidence-path', 'g11-hd-one-turn-trial.png'],
    ['evidence-goal-distance-and-turns', 'g11-hd-one-turn-trial.png'],
    ['distance-or-turn-prediction', 'g11-hd-one-turn-trial.png'],
    ['one-turn-rolling-trial', 'g11-hd-one-turn-trial.png'],
    ['output-check-distance-turn-table', 'g11-hd-one-turn-trial.png'],
    ['team-roles-and-safety-rolling-trial', 'g11-hd-linear-angular-board.png'],
    ['linear-angular-match-board', 'g11-hd-linear-angular-board.png'],
    ['turn-to-distance-model', 'g11-hd-linear-angular-board.png'],
    ['data-reliability-check', 'g11-hd-linear-angular-board.png'],
    ['mini-case-interpretation', 'g11-hd-motion-explainer.png'],

    ['what-happens-with-same-turns', 'g11-hd-wheel-size-comparison.png'],
    ['today-s-wheel-size-evidence-path', 'g11-hd-wheel-size-comparison.png'],
    ['todays-wheel-size-evidence-path', 'g11-hd-wheel-size-comparison.png'],
    ['evidence-goal-wheel-size-and-distance', 'g11-hd-wheel-size-comparison.png'],
    ['same-turns-different-wheels-prompt', 'g11-hd-wheel-size-comparison.png'],
    ['wheel-size-comparison-trial', 'g11-hd-wheel-size-comparison.png'],
    ['output-check-wheel-size-table', 'g11-hd-wheel-size-comparison.png'],
    ['team-roles-and-safety-wheel-size-trial', 'g11-hd-wheel-size-comparison.png'],
    ['circumference-relationship-talk', 'g11-hd-circumference-model.png'],
    ['motion-relationship-diagram-2-0', 'g11-hd-circumference-model.png'],
    ['slipping-and-measurement-limits', 'g11-hd-linear-angular-board.png'],
    ['design-choice-justification', 'g11-hd-recommendation-conference.png'],

    ['what-evidence-should-guide-a-device-recommendation', 'g11-hd-device-audit.png'],
    ['today-s-device-explainer-path', 'g11-hd-device-audit.png'],
    ['todays-device-explainer-path', 'g11-hd-device-audit.png'],
    ['evidence-goal-motion-explainer', 'g11-hd-device-audit.png'],
    ['best-evidence-selection', 'g11-hd-recommendation-conference.png'],
    ['device-motion-audit', 'g11-hd-device-audit.png'],
    ['output-check-device-audit-table', 'g11-hd-device-audit.png'],
    ['team-roles-and-safety-device-audit', 'g11-hd-device-audit.png'],
    ['evidence-to-recommendation-conference', 'g11-hd-recommendation-conference.png'],
    ['motion-explainer-build', 'g11-hd-motion-explainer.png'],
    ['rotation-and-forward-motion-are-related', 'g11-hd-linear-angular-board.png'],
    ['gallery-defense-ticket', 'g11-hd-motion-explainer.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['science-general-motion'];
  return templateMap?.[template] || templateMap?.content;
};

const getScienceParticleModelImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const searchable = slugifyImageSemanticText([
    metadata.slideTemplate,
    metadata.visualRole,
    metadata.semanticAnchor,
    metadata.topic,
  ].filter(Boolean).join(' '));
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['evidence-table-routine', 's1-hd-evidence-table.png'],
    ['what-goes-in-the-evidence-table', 's1-hd-evidence-table.png'],
    ['main-activity-evidence-stations', 's1-hd-evidence-table.png'],
    ['station-roles-and-timing', 's1-hd-roles-timing.png'],
    ['roles-timing-and-safety', 's1-hd-roles-timing.png'],
    ['expected-output-evidence-based-particle-model', 's1-hd-build-model.png'],
    ['matter-mystery-claims', 's1-hd-mystery-claims.png'],
    ['what-do-you-notice-first', 's1-hd-mystery-claims.png'],
    ['observe-infer-model', 's1-hd-observe-infer.png'],
    ['observe-infer-or-unsure', 's1-hd-observe-infer.png'],
    ['what-is-evidence-and-what-is-explanation', 's1-hd-observe-infer.png'],
    ['which-evidence-is-strongest', 's1-hd-evidence-sort.png'],
    ['air-is-matter-too', 's1-hd-air-compression.png'],
    ['how-can-air-be-matter', 's1-hd-air-compression.png'],
    ['sugar-did-not-vanish', 's1-hd-sugar-dissolving.png'],
    ['where-did-the-sugar-go', 's1-hd-sugar-dissolving.png'],
    ['color-spreads-without-stirring', 's1-hd-color-diffusion.png'],
    ['why-does-color-spread-without-stirring', 's1-hd-color-diffusion.png'],
    ['evidence-board', 's1-hd-evidence-board.png'],
    ['what-pattern-do-we-see', 's1-hd-evidence-board.png'],
    ['build-a-particle-model', 's1-hd-build-model.png'],
    ['can-your-model-match-the-evidence', 's1-hd-build-model.png'],
    ['which-model-is-more-scientific', 's1-hd-model-compare.png'],
    ['new-case-transfer', 's1-hd-transfer.png'],
    ['can-your-model-explain-a-new-case', 's1-hd-transfer.png'],
    ['exit-slip', 's1-hd-exit-slip.png'],
    ['claim-evidence-model', 's1-hd-exit-slip.png'],
    ['final-output-claim-evidence-model', 's1-hd-exit-slip.png'],
    ['fair-test-evidence', 's2-hd-fair-test-evidence.png'],
    ['main-activity-warm-and-cold-diffusion-test', 's2-hd-fair-test-setup.png'],
    ['expected-output-temperature-motion-chain', 's2-hd-cause-effect-chain.png'],
    ['roles-timing-and-safety-temperature-test', 's2-hd-roles-timing.png'],
    ['cold-or-warm-prediction', 's2-hd-prediction.png'],
    ['fair-test-setup', 's2-hd-fair-test-setup.png'],
    ['watch-the-spread', 's2-hd-watch-spread.png'],
    ['what-counts-as-faster', 's2-hd-fair-test-evidence.png'],
    ['what-pattern-appeared', 's2-hd-pattern.png'],
    ['particles-move-faster', 's2-hd-faster-motion.png'],
    ['cause-effect-chain', 's2-hd-cause-effect-chain.png'],
    ['spacing-and-attraction', 's2-hd-spacing-attraction.png'],
    ['warm-drink-transfer', 's2-hd-warm-drink-transfer.png'],
    ['misconception-check', 's2-hd-misconception.png'],
    ['motion-mastery-check', 's2-hd-mastery-check.png'],
    ['diagram-criteria', 's3-hd-diagram-criteria.png'],
    ['main-activity-three-state-model-build', 's3-hd-build-model.png'],
    ['expected-output-revised-state-diagrams', 's3-hd-expected-output.png'],
    ['roles-timing-and-revision-cycle', 's3-hd-revision-codes.png'],
    ['three-samples-three-states', 's3-hd-three-samples.png'],
    ['diagram-quality-checklist', 's3-hd-diagram-criteria.png'],
    ['revision-codes', 's3-hd-revision-codes.png'],
    ['solid-particles', 's3-hd-solid.png'],
    ['liquid-particles', 's3-hd-liquid.png'],
    ['gas-particles', 's3-hd-gas.png'],
    ['compare-the-three-states', 's3-hd-compare.png'],
    ['mystery-state-revision', 's3-hd-mystery-revision.png'],
    ['peer-feedback-rule', 's3-hd-peer-feedback.png'],
    ['gallery-walk-revision', 's3-hd-gallery-walk.png'],
    ['mini-diagram-check', 's3-hd-mini-check.png'],
    ['energy-evidence-rules', 's4-hd-energy-rules.png'],
    ['main-activity-phase-change-evidence-sort', 's4-hd-energy-sort.png'],
    ['expected-output-phase-change-cer', 's4-hd-sequence-table.png'],
    ['roles-timing-and-safety-phase-change-sort', 's4-hd-roles-timing.png'],
    ['melting-and-droplets-probe', 's4-hd-melting-droplets.png'],
    ['energy-direction-sort', 's4-hd-energy-sort.png'],
    ['sequence-table-build', 's4-hd-sequence-table.png'],
    ['heating-row', 's4-hd-heating-row.png'],
    ['cooling-row', 's4-hd-cooling-row.png'],
    ['four-phase-changes', 's4-hd-four-phase-changes.png'],
    ['where-did-droplets-come-from', 's4-hd-droplets-source.png'],
    ['everyday-phase-change-cer', 's4-hd-cer.png'],
    ['defend-the-explanation', 's4-hd-defend.png'],
    ['energy-direction-mastery', 's4-hd-mastery-check.png'],
    ['assignment-and-reflection', 's4-hd-assignment.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const directAssetTemplates = new Set([
    'air-compression',
    'assessment',
    'assignment',
    'diffusion-temperature',
    'dissolving-diffusion',
    'generalization',
    'overview',
    'particle-evidence',
    'particle-model',
    'particle-states',
    'phase-change-energy',
  ]);

  if (directAssetTemplates.has(template)) {
    return `${template}.png`;
  }

  if (template === 'assessment') return 'assessment.png';
  if (template === 'assignment') return 'assignment.png';
  if (template === 'overview' || template === 'objectives') return 'overview.png';
  if (template === 'generalization' || template === 'summary') return 'generalization.png';

  if (searchable.includes('air-compression') || searchable.includes('syringe') || searchable.includes('compressed-air')) {
    return 'air-compression.png';
  }

  if (
    searchable.includes('temperature')
    || searchable.includes('warm-water')
    || searchable.includes('cold-water')
    || searchable.includes('faster-motion')
    || searchable.includes('fair-test')
  ) {
    return 'diffusion-temperature.png';
  }

  if (
    searchable.includes('dissolving')
    || searchable.includes('sugar')
    || searchable.includes('color-spreads')
    || searchable.includes('without-stirring')
  ) {
    return 'dissolving-diffusion.png';
  }

  if (
    searchable.includes('solid')
    || searchable.includes('liquid')
    || searchable.includes('gas')
    || searchable.includes('states-of-matter')
    || searchable.includes('particle-arrangement')
    || searchable.includes('particle-diagram')
    || searchable.includes('spacing')
  ) {
    return 'particle-states.png';
  }

  if (
    searchable.includes('phase-change')
    || searchable.includes('change-of-state')
    || searchable.includes('melting')
    || searchable.includes('evaporation')
    || searchable.includes('condensation')
    || searchable.includes('freezing')
    || searchable.includes('energy-direction')
    || searchable.includes('droplets')
    || searchable.includes('heating')
    || searchable.includes('cooling')
  ) {
    return 'phase-change-energy.png';
  }

  if (
    searchable.includes('evidence')
    || searchable.includes('observe')
    || searchable.includes('infer')
    || searchable.includes('claim')
    || searchable.includes('mystery')
  ) {
    return 'particle-evidence.png';
  }

  return undefined;
};

const getEnglishLiteratureValuesImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['philippine-literary-texts-as-windows-to-values-and-contexts', 'g7e-hd-literature-values-overview.png'],
    ['learning-roadmap', 'g7e-hd-literature-values-overview.png'],
    ['how-we-will-work-like-literary-readers', 'g7e-hd-literature-values-overview.png'],

    ['what-value-does-the-text-show', 'g7e-hd-value-lens-warmup.png'],
    ['today-s-value-evidence-path', 'g7e-hd-claim-evidence-table.png'],
    ['todays-value-evidence-path', 'g7e-hd-claim-evidence-table.png'],
    ['evidence-goal-detail-value-context', 'g7e-hd-literature-values-overview.png'],
    ['value-lens-warm-up', 'g7e-hd-value-lens-warmup.png'],
    ['first-reading-trail', 'g7e-hd-first-reading-trail.png'],
    ['claim-and-evidence-pair-check', 'g7e-hd-claim-evidence-table.png'],
    ['output-check-claim-evidence-table', 'g7e-hd-claim-evidence-table.png'],
    ['context-makes-meaning', 'g7e-hd-context-meaning.png'],
    ['four-sentence-value-response', 'g7e-hd-four-sentence-response.png'],
    ['retelling-is-not-explaining', 'g7e-hd-four-sentence-response.png'],
    ['value-response-exit', 'g7e-hd-four-sentence-response.png'],

    ['what-does-this-line-reveal-about-the-character', 'g7e-hd-character-clue-recall.png'],
    ['today-s-character-evidence-path', 'g7e-hd-character-claim-builder.png'],
    ['todays-character-evidence-path', 'g7e-hd-character-claim-builder.png'],
    ['evidence-goal-character-evidence', 'g7e-hd-four-way-evidence-hunt.png'],
    ['character-clue-recall', 'g7e-hd-character-clue-recall.png'],
    ['four-way-evidence-hunt', 'g7e-hd-four-way-evidence-hunt.png'],
    ['setting-pressure-talk', 'g7e-hd-setting-pressure-talk.png'],
    ['character-claim-builder', 'g7e-hd-character-claim-builder.png'],
    ['output-check-character-claim', 'g7e-hd-character-claim-builder.png'],
    ['trait-precision-exit', 'g7e-hd-trait-precision-exit.png'],
    ['character-evidence-conference', 'g7e-hd-four-way-evidence-hunt.png'],
    ['good-or-bad-is-not-analysis', 'g7e-hd-trait-precision-exit.png'],

    ['what-force-opposes-the-character', 'g7e-hd-conflict-type-sort.png'],
    ['today-s-conflict-evidence-path', 'g7e-hd-value-under-pressure.png'],
    ['todays-conflict-evidence-path', 'g7e-hd-value-under-pressure.png'],
    ['evidence-goal-conflict-choice-value', 'g7e-hd-plot-pressure-map.png'],
    ['conflict-type-quick-sort', 'g7e-hd-conflict-type-sort.png'],
    ['plot-pressure-map', 'g7e-hd-plot-pressure-map.png'],
    ['value-under-pressure', 'g7e-hd-value-under-pressure.png'],
    ['output-check-evidence-card', 'g7e-hd-value-under-pressure.png'],
    ['synthesis-sentence-workshop', 'g7e-hd-synthesis-sentence.png'],
    ['conflict-to-value-exit-slip', 'g7e-hd-conflict-value-exit.png'],
    ['event-is-not-always-conflict', 'g7e-hd-conflict-type-sort.png'],
    ['conflict-discussion', 'g7e-hd-conflict-value-exit.png'],

    ['what-makes-a-literary-response-clear', 'g7e-hd-response-target-check.png'],
    ['today-s-response-writing-path', 'g7e-hd-focused-response-draft.png'],
    ['todays-response-writing-path', 'g7e-hd-focused-response-draft.png'],
    ['evidence-goal-focused-literary-response', 'g7e-hd-response-target-check.png'],
    ['response-target-check', 'g7e-hd-response-target-check.png'],
    ['evidence-selection-board', 'g7e-hd-evidence-selection-board.png'],
    ['focused-literary-response-draft', 'g7e-hd-focused-response-draft.png'],
    ['output-check-literary-response', 'g7e-hd-response-target-check.png'],
    ['partner-clarity-review', 'g7e-hd-partner-clarity-review.png'],
    ['revision-and-reflection-close', 'g7e-hd-revision-reflection.png'],
    ['listing-evidence-is-not-enough', 'g7e-hd-focused-response-draft.png'],
    ['response-reflection-exit', 'g7e-hd-revision-reflection.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['english-literature-values'];
  return templateMap?.[template] || templateMap?.content;
};

const GENERIC_CURATED_STATIC_TEMPLATE_FALLBACKS = new Set(['concept', 'content', 'objectives', 'overview']);

const getCuratedStaticTemplateFallback = (
  template: string,
  collectionMap: Record<string, string> | undefined,
): string | undefined => {
  if (!collectionMap || GENERIC_CURATED_STATIC_TEMPLATE_FALLBACKS.has(template)) {
    return undefined;
  }

  return collectionMap[template];
};

const getEnglishPoetryImageryImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const searchable = slugifyImageSemanticText([
    metadata.slideTemplate,
    metadata.visualRole,
    metadata.semanticAnchor,
    metadata.topic,
  ].filter(Boolean).join(' '));
  const anchor = semanticAnchor || template;

  const slideSpecificImageByToken: Array<[string, string]> = [
    ['agree-or-disagree', 'classroom-activity-cards.png'],
    ['activity-card', 'classroom-activity-cards.png'],
    ['poetry-elements-check', 'classroom-activity-cards.png'],
    ['prior-knowledge-check', 'classroom-activity-cards.png'],
    ['core-memory-sharing', 'core-memory-sharing.png'],
    ['core-memory', 'core-memory-sharing.png'],
    ['strengths-and-weaknesses', 'core-memory-sharing.png'],
    ['feelings-through-music', 'feelings-through-music.png'],
    ['knowing-your-feelings-through-music', 'feelings-through-music.png'],
    ['emotional-response', 'feelings-through-music.png'],
    ['creative-expression', 'feelings-through-music.png'],
    ['think-and-pick-word-puzzle', 'think-and-pick-word-puzzle.png'],
    ['word-puzzle', 'think-and-pick-word-puzzle.png'],
    ['vocabulary', 'think-and-pick-word-puzzle.png'],
    ['power-of-words', 'context-clues-card-sort.png'],
    ['context-clues', 'context-clues-card-sort.png'],
    ['deduce-meaning', 'context-clues-card-sort.png'],
    ['word-meaning', 'context-clues-card-sort.png'],
    ['jumbled-letters', 'context-clues-card-sort.png'],
    ['describing-and-reading', 'describing-imagery-scene.png'],
    ['describing-imagery-from-a-scene', 'describing-imagery-scene.png'],
    ['beach-description', 'describing-imagery-scene.png'],
    ['imagery-scene', 'describing-imagery-scene.png'],
    ['fulfill-me-point-it-out-find-my-form-color-me', 'main-activity-poem-annotation.png'],
    ['fulfill-me', 'main-activity-poem-annotation.png'],
    ['point-it-out', 'main-activity-poem-annotation.png'],
    ['main-activity', 'main-activity-poem-annotation.png'],
    ['poem-annotation', 'main-activity-poem-annotation.png'],
    ['annotate-poem', 'main-activity-poem-annotation.png'],
    ['reading-by-stanza', 'main-activity-poem-annotation.png'],
    ['expected-output', 'expected-output-poem-annotation.png'],
    ['annotated-poem-evidence', 'expected-output-poem-annotation.png'],
    ['evidence-output', 'expected-output-poem-annotation.png'],
    ['success-criteria', 'expected-output-poem-annotation.png'],
    ['find-my-form', 'expected-output-poem-annotation.png'],
    ['color-me', 'expected-output-poem-annotation.png'],
    ['context-lens', 'context-lens-group-board.png'],
    ['structural-context', 'context-lens-group-board.png'],
    ['biographical-context', 'context-lens-group-board.png'],
    ['historical-context', 'context-lens-group-board.png'],
    ['sociocultural-context', 'context-lens-group-board.png'],
    ['poem-structure-elements', 'context-lens-group-board.png'],
    ['structure-elements', 'context-lens-group-board.png'],
    ['character-conflict-plot', 'context-lens-group-board.png'],
    ['evidence-table', 'evidence-table-card-sort.png'],
    ['formative-assessment', 'evidence-table-card-sort.png'],
    ['exit-slip', 'evidence-table-card-sort.png'],
    ['3-2-1', 'evidence-table-card-sort.png'],
    ['reflection', 'evidence-table-card-sort.png'],
    ['tree-imagery-and-figurative-language', 'tree-imagery-figurative-language.png'],
    ['for-the-young-yearning-a-song-of-green', 'tree-imagery-figurative-language.png'],
    ['figurative-language', 'tree-imagery-figurative-language.png'],
    ['personification', 'tree-imagery-figurative-language.png'],
    ['environmental-awareness', 'tree-imagery-figurative-language.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    anchor === token || anchor.startsWith(`${token}-`)
    || anchor.includes(`-${token}-`) || anchor.endsWith(`-${token}`)
    || searchable.includes(token)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  if (template === 'vocabulary') return 'think-and-pick-word-puzzle.png';
  if (template === 'review' || template === 'overview' || template === 'objectives') return 'core-memory-sharing.png';
  if (template === 'activity' || template === 'practice') return 'classroom-activity-cards.png';
  if (template === 'generalization' || template === 'summary' || template === 'assessment') return 'evidence-table-card-sort.png';

  return undefined;
};

const getMathPolygonsImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['constructing-and-describing-polygons', 'g7-hd-polygon-overview.png'],
    ['learning-roadmap', 'g7-hd-polygon-overview.png'],
    ['how-we-will-work-like-mathematicians', 'g7-hd-regularity-rule.png'],

    ['what-evidence-makes-a-shape-a-polygon', 'g7-hd-polygon-sort.png'],
    ['today-s-polygon-evidence-path', 'g7-hd-side-angle-lab.png'],
    ['todays-polygon-evidence-path', 'g7-hd-side-angle-lab.png'],
    ['evidence-goal-polygon-and-regularity', 'g7-hd-polygon-overview.png'],
    ['polygon-or-not', 'g7-hd-polygon-sort.png'],
    ['side-and-angle-evidence-lab', 'g7-hd-side-angle-lab.png'],
    ['output-check-measurement-table', 'g7-hd-side-angle-lab.png'],
    ['team-roles-and-tool-safety', 'g7-hd-side-angle-lab.png'],
    ['regularity-rule-board', 'g7-hd-regularity-rule.png'],
    ['worked-example-pentagon-trace', 'g7-hd-pentagon-trace.png'],
    ['looks-equal-is-not-proof', 'g7-hd-regularity-rule.png'],
    ['two-polygon-exit-defense', 'g7-hd-measurement-audit.png'],

    ['how-can-angle-data-build-a-figure', 'g7-hd-protractor-readiness.png'],
    ['today-s-angle-construction-path', 'g7-hd-angle-routine.png'],
    ['todays-angle-construction-path', 'g7-hd-angle-routine.png'],
    ['evidence-goal-construct-from-angles', 'g7-hd-protractor-readiness.png'],
    ['angle-data-readiness', 'g7-hd-protractor-readiness.png'],
    ['build-from-two-angles', 'g7-hd-angle-routine.png'],
    ['output-check-routine-notes', 'g7-hd-angle-routine.png'],
    ['triangle-quadrilateral-builder', 'g7-hd-triangle-quadrilateral-builder.png'],
    ['wrong-scale-repair-shop', 'g7-hd-wrong-scale-repair.png'],
    ['construction-accuracy-conference', 'g7-hd-angle-routine.png'],
    ['protractor-habits-that-prevent-errors', 'g7-hd-protractor-readiness.png'],
    ['solo-quadrilateral-check', 'g7-hd-measurement-audit.png'],

    ['what-makes-a-polygon-regular', 'g7-hd-regularity-rule.png'],
    ['today-s-regular-polygon-path', 'g7-hd-regular-polygon-planning.png'],
    ['todays-regular-polygon-path', 'g7-hd-regular-polygon-planning.png'],
    ['evidence-goal-regular-polygons', 'g7-hd-regularity-rule.png'],
    ['almost-regular-challenge', 'g7-hd-regularity-rule.png'],
    ['regular-polygon-planning-grid', 'g7-hd-regular-polygon-planning.png'],
    ['output-check-planning-grid', 'g7-hd-regular-polygon-planning.png'],
    ['worked-example-hexagon-build', 'g7-hd-hexagon-build.png'],
    ['polygon-studio', 'g7-hd-polygon-studio.png'],
    ['regularity-evidence-talk', 'g7-hd-regularity-rule.png'],
    ['equal-looking-sides-are-not-enough', 'g7-hd-regularity-rule.png'],
    ['regularity-proof-slip', 'g7-hd-measurement-audit.png'],

    ['how-can-measurements-defend-a-classification', 'g7-hd-polygon-set-blueprint.png'],
    ['how-can-a-drawing-prove-its-classification', 'g7-hd-polygon-set-blueprint.png'],
    ['today-s-polygon-set-defense-path', 'g7-hd-polygon-set-blueprint.png'],
    ['todays-polygon-set-defense-path', 'g7-hd-polygon-set-blueprint.png'],
    ['evidence-goal-polygon-set-defense', 'g7-hd-polygon-set-blueprint.png'],
    ['checklist-calibration', 'g7-hd-regularity-rule.png'],
    ['polygon-set-blueprint', 'g7-hd-polygon-set-blueprint.png'],
    ['output-check-approved-blueprint', 'g7-hd-polygon-set-blueprint.png'],
    ['evidence-drawing-studio', 'g7-hd-evidence-drawing-studio.png'],
    ['measurement-audit-exchange', 'g7-hd-measurement-audit.png'],
    ['defense-sentence-builder', 'g7-hd-measurement-audit.png'],
    ['decorative-drawing-is-not-evidence', 'g7-hd-measurement-audit.png'],
    ['evidence-defense-exit', 'g7-hd-measurement-audit.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['math-polygons'];
  return templateMap?.[template] || templateMap?.content;
};

const getMathStatisticsExpressionsImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['measures-of-central-tendency-conclusions-and-algebraic-expressions', 'g8-hd-stat-algebra-overview.png'],
    ['learning-roadmap', 'g8-hd-stat-algebra-overview.png'],
    ['how-we-will-work-like-data-thinkers', 'g8-hd-stat-algebra-overview.png'],

    ['what-makes-a-score-typical', 'g8-hd-typical-score-prediction.png'],
    ['today-s-three-measure-evidence-path', 'g8-hd-mean-median-mode-worked.png'],
    ['todays-three-measure-evidence-path', 'g8-hd-mean-median-mode-worked.png'],
    ['evidence-goal-mean-median-mode', 'g8-hd-mean-median-mode-worked.png'],
    ['typical-score-prediction', 'g8-hd-typical-score-prediction.png'],
    ['ordered-data-strip', 'g8-hd-ordered-data-strip.png'],
    ['mean-median-mode-worked-set', 'g8-hd-mean-median-mode-worked.png'],
    ['output-check-computation-table', 'g8-hd-mean-median-mode-worked.png'],
    ['team-roles-and-calculation-checks', 'g8-hd-mean-median-mode-worked.png'],
    ['outlier-measure-match', 'g8-hd-outlier-measure-match.png'],
    ['what-each-measure-really-says', 'g8-hd-mean-median-mode-worked.png'],
    ['three-measures-exit', 'g8-hd-three-measures-exit.png'],

    ['can-a-correct-average-mislead', 'g8-hd-average-trust-test.png'],
    ['today-s-supported-conclusion-path', 'g8-hd-evidence-conclusion-card.png'],
    ['todays-supported-conclusion-path', 'g8-hd-evidence-conclusion-card.png'],
    ['evidence-goal-supported-conclusions', 'g8-hd-evidence-conclusion-card.png'],
    ['average-trust-test', 'g8-hd-average-trust-test.png'],
    ['question-before-measure', 'g8-hd-question-before-measure.png'],
    ['evidence-based-conclusion-set', 'g8-hd-evidence-conclusion-card.png'],
    ['output-check-conclusion-evidence-card', 'g8-hd-evidence-conclusion-card.png'],
    ['team-roles-and-evidence-checks', 'g8-hd-evidence-conclusion-card.png'],
    ['misleading-average-clinic', 'g8-hd-misleading-average-clinic.png'],
    ['honest-data-conclusion-conference', 'g8-hd-evidence-conclusion-card.png'],
    ['supported-conclusion-exit', 'g8-hd-evidence-conclusion-card.png'],

    ['what-should-the-letter-represent', 'g8-hd-quantity-hunt.png'],
    ['today-s-expression-modeling-path', 'g8-hd-table-rule-expression.png'],
    ['todays-expression-modeling-path', 'g8-hd-table-rule-expression.png'],
    ['evidence-goal-context-to-expression', 'g8-hd-notebook-cost-expression.png'],
    ['quantity-hunt', 'g8-hd-quantity-hunt.png'],
    ['notebook-cost-expression', 'g8-hd-notebook-cost-expression.png'],
    ['table-rule-expression-match', 'g8-hd-table-rule-expression.png'],
    ['output-check-representation-table', 'g8-hd-table-rule-expression.png'],
    ['team-roles-and-meaning-checks', 'g8-hd-table-rule-expression.png'],
    ['expression-match-repair', 'g8-hd-expression-repair.png'],
    ['variable-definition-conference', 'g8-hd-notebook-cost-expression.png'],
    ['context-to-expression-exit', 'g8-hd-notebook-cost-expression.png'],

    ['what-tool-fits-the-situation', 'g8-hd-statistics-algebra-sort.png'],
    ['which-tool-fits-the-situation', 'g8-hd-statistics-algebra-sort.png'],
    ['today-s-mixed-tool-evidence-path', 'g8-hd-data-expression-brief.png'],
    ['todays-mixed-tool-evidence-path', 'g8-hd-data-expression-brief.png'],
    ['evidence-goal-statistics-and-algebra-together', 'g8-hd-stat-algebra-overview.png'],
    ['statistics-or-algebra-sort', 'g8-hd-statistics-algebra-sort.png'],
    ['study-minutes-data-investigation', 'g8-hd-study-minutes-investigation.png'],
    ['daily-target-model', 'g8-hd-daily-target-model.png'],
    ['data-and-expression-brief', 'g8-hd-data-expression-brief.png'],
    ['output-check-mini-report', 'g8-hd-data-expression-brief.png'],
    ['peer-review-and-revision', 'g8-hd-data-expression-brief.png'],
    ['average-warning-discussion', 'g8-hd-misleading-average-clinic.png'],
    ['mixed-tool-exit', 'g8-hd-data-expression-brief.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['math-statistics-expressions'];
  return templateMap?.[template] || templateMap?.content;
};

const getMathGeometryConstructionImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['geometric-objects-notation-and-line-construction', 'g9m-hd-geometry-overview.png'],
    ['learning-roadmap', 'g9m-hd-geometry-overview.png'],
    ['how-we-will-work-like-geometers', 'g9m-hd-geometry-overview.png'],

    ['what-does-each-geometry-symbol-tell-us', 'g9m-hd-symbol-sort.png'],
    ['today-s-notation-evidence-path', 'g9m-hd-notation-match-lab.png'],
    ['todays-notation-evidence-path', 'g9m-hd-notation-match-lab.png'],
    ['evidence-goal-object-symbol-meaning', 'g9m-hd-geometry-overview.png'],
    ['geometry-symbol-sort', 'g9m-hd-symbol-sort.png'],
    ['diagram-evidence-mark-up', 'g9m-hd-diagram-markup.png'],
    ['notation-match-lab', 'g9m-hd-notation-match-lab.png'],
    ['output-check-notation-match-sheet', 'g9m-hd-notation-match-lab.png'],
    ['team-roles-and-diagram-checks', 'g9m-hd-diagram-markup.png'],
    ['geometry-dictionary-build', 'g9m-hd-geometry-dictionary.png'],
    ['ray-segment-and-line-are-not-interchangeable', 'g9m-hd-geometry-dictionary.png'],
    ['notation-error-exit', 'g9m-hd-notation-error-exit.png'],

    ['what-evidence-proves-perpendicular', 'g9m-hd-perpendicular-evidence-check.png'],
    ['today-s-perpendicular-evidence-path', 'g9m-hd-perpendicular-step-check.png'],
    ['todays-perpendicular-evidence-path', 'g9m-hd-perpendicular-step-check.png'],
    ['evidence-goal-perpendicular-construction', 'g9m-hd-equal-arc-trace.png'],
    ['perpendicular-evidence-check', 'g9m-hd-perpendicular-evidence-check.png'],
    ['equal-arc-construction-trace', 'g9m-hd-equal-arc-trace.png'],
    ['perpendicular-step-check', 'g9m-hd-perpendicular-step-check.png'],
    ['output-check-guided-construction-sheet', 'g9m-hd-perpendicular-step-check.png'],
    ['team-roles-and-compass-safety', 'g9m-hd-perpendicular-step-check.png'],
    ['off-line-point-construction', 'g9m-hd-offline-point-construction.png'],
    ['not-drawn-by-sight', 'g9m-hd-construction-repair.png'],
    ['construction-repair-exit', 'g9m-hd-construction-repair.png'],

    ['what-proves-lines-are-parallel', 'g9m-hd-parallel-evidence-sort.png'],
    ['today-s-parallel-evidence-path', 'g9m-hd-parallel-step-check.png'],
    ['todays-parallel-evidence-path', 'g9m-hd-parallel-step-check.png'],
    ['evidence-goal-parallel-construction', 'g9m-hd-copied-angle-trace.png'],
    ['parallel-evidence-sort', 'g9m-hd-parallel-evidence-sort.png'],
    ['copied-angle-construction-trace', 'g9m-hd-copied-angle-trace.png'],
    ['parallel-step-check', 'g9m-hd-parallel-step-check.png'],
    ['output-check-guided-parallel-construction', 'g9m-hd-parallel-step-check.png'],
    ['team-roles-and-arc-transfer-checks', 'g9m-hd-copied-angle-trace.png'],
    ['two-method-parallel-compare', 'g9m-hd-two-method-parallel-compare.png'],
    ['same-direction-is-not-enough', 'g9m-hd-parallel-evidence-sort.png'],
    ['parallel-repair-exit', 'g9m-hd-parallel-repair.png'],

    ['what-evidence-makes-a-construction-convincing', 'g9m-hd-readiness-grid.png'],
    ['today-s-construction-report-path', 'g9m-hd-construction-report.png'],
    ['todays-construction-report-path', 'g9m-hd-construction-report.png'],
    ['evidence-goal-construction-report', 'g9m-hd-report-walkthrough.png'],
    ['construction-readiness-grid', 'g9m-hd-readiness-grid.png'],
    ['construction-report-walkthrough', 'g9m-hd-report-walkthrough.png'],
    ['report-planning-conference', 'g9m-hd-report-planning.png'],
    ['geometry-construction-report', 'g9m-hd-construction-report.png'],
    ['output-check-construction-report', 'g9m-hd-construction-report.png'],
    ['team-roles-and-report-checks', 'g9m-hd-report-planning.png'],
    ['peer-audit-and-transfer-exit', 'g9m-hd-peer-audit-transfer.png'],
    ['neat-is-not-the-same-as-proven', 'g9m-hd-peer-audit-transfer.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['math-geometry-construction'];
  return templateMap?.[template] || templateMap?.content;
};

const getMathLawOfSinesImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['law-of-sines-and-ambiguous-cases', 'g10m-hd-law-sines-overview.png'],
    ['learning-roadmap', 'g10m-hd-law-sines-overview.png'],
    ['how-we-will-work-like-trigonometry-problem-solvers', 'g10m-hd-law-sines-overview.png'],

    ['why-does-soh-cah-toa-fail-here', 'g10m-hd-opposite-pair-warmup.png'],
    ['today-s-law-of-sines-evidence-path', 'g10m-hd-asa-aas-solution-table.png'],
    ['todays-law-of-sines-evidence-path', 'g10m-hd-asa-aas-solution-table.png'],
    ['evidence-goal-opposite-pairs-and-ratios', 'g10m-hd-law-sines-overview.png'],
    ['opposite-pair-warm-up', 'g10m-hd-opposite-pair-warmup.png'],
    ['aas-ratio-walkthrough', 'g10m-hd-aas-ratio-walkthrough.png'],
    ['asa-aas-solution-table', 'g10m-hd-asa-aas-solution-table.png'],
    ['output-check-solution-table', 'g10m-hd-asa-aas-solution-table.png'],
    ['team-roles-and-calculator-checks', 'g10m-hd-asa-aas-solution-table.png'],
    ['oblique-triangle-card-exchange', 'g10m-hd-oblique-card-exchange.png'],
    ['ratio-setup-conference', 'g10m-hd-aas-ratio-walkthrough.png'],
    ['wrong-pair-repair', 'g10m-hd-wrong-pair-repair.png'],
    ['aas-exit-triangle', 'g10m-hd-wrong-pair-repair.png'],

    ['how-can-the-same-ssa-data-make-two-triangles', 'g10m-hd-swinging-side-sketch.png'],
    ['today-s-ssa-decision-path', 'g10m-hd-ssa-height-test.png'],
    ['todays-ssa-decision-path', 'g10m-hd-ssa-height-test.png'],
    ['evidence-goal-ssa-triangle-counts', 'g10m-hd-ssa-height-test.png'],
    ['swinging-side-sketch', 'g10m-hd-swinging-side-sketch.png'],
    ['ssa-height-test-model', 'g10m-hd-ssa-height-test.png'],
    ['ambiguous-case-decision-table', 'g10m-hd-ambiguous-decision-table.png'],
    ['output-check-decision-table', 'g10m-hd-ambiguous-decision-table.png'],
    ['team-roles-and-height-checks', 'g10m-hd-ssa-height-test.png'],
    ['two-branch-sketch-check', 'g10m-hd-two-branch-sketch.png'],
    ['triangle-count-discussion', 'g10m-hd-two-branch-sketch.png'],
    ['missed-supplement-repair', 'g10m-hd-missed-supplement-repair.png'],
    ['ssa-classification-exit', 'g10m-hd-ambiguous-decision-table.png'],

    ['how-do-we-know-which-branch-remains-valid', 'g10m-hd-solution-fork-preview.png'],
    ['which-branch-remains-a-valid-triangle', 'g10m-hd-solution-fork-preview.png'],
    ['today-s-branch-validation-path', 'g10m-hd-ssa-solution-tree.png'],
    ['todays-branch-validation-path', 'g10m-hd-ssa-solution-tree.png'],
    ['evidence-goal-branching-valid-solutions', 'g10m-hd-ssa-solution-tree.png'],
    ['solution-fork-preview', 'g10m-hd-solution-fork-preview.png'],
    ['two-branch-solution-model', 'g10m-hd-two-branch-model.png'],
    ['ssa-solution-tree-set', 'g10m-hd-ssa-solution-tree.png'],
    ['output-check-solution-trees', 'g10m-hd-ssa-solution-tree.png'],
    ['team-roles-and-branch-checks', 'g10m-hd-ssa-solution-tree.png'],
    ['shoreline-position-problem', 'g10m-hd-shoreline-position.png'],
    ['branch-validity-conference', 'g10m-hd-ssa-solution-tree.png'],
    ['invalid-branch-audit', 'g10m-hd-invalid-branch-audit.png'],
    ['ssa-solution-exit', 'g10m-hd-invalid-branch-audit.png'],

    ['why-identify-the-case-before-solving', 'g10m-hd-case-type-sort.png'],
    ['today-s-performance-defense-path', 'g10m-hd-performance-response.png'],
    ['todays-performance-defense-path', 'g10m-hd-performance-response.png'],
    ['evidence-goal-case-type-and-defense', 'g10m-hd-performance-response.png'],
    ['case-type-sort', 'g10m-hd-case-type-sort.png'],
    ['performance-response-review', 'g10m-hd-performance-response.png'],
    ['setup-checkpoint-pair', 'g10m-hd-setup-checkpoint.png'],
    ['law-of-sines-performance-task', 'g10m-hd-law-sines-performance.png'],
    ['output-check-performance-task', 'g10m-hd-law-sines-performance.png'],
    ['team-roles-and-peer-checks', 'g10m-hd-ambiguity-peer-review.png'],
    ['ambiguity-peer-review', 'g10m-hd-ambiguity-peer-review.png'],
    ['ssa-is-different-from-asa-and-aas', 'g10m-hd-case-type-sort.png'],
    ['transfer-defense-exit', 'g10m-hd-ambiguity-peer-review.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['math-law-of-sines'];
  return templateMap?.[template] || templateMap?.content;
};

const getMathWagesIncomeImageFileName = (
  metadata: ImageSemanticMetadata,
  exactOnly = false,
): string | undefined => {
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const slideSpecificImageByToken: Array<[string, string]> = [
    ['wages-benefits-deductions-and-net-income', 'g11m-hd-income-overview.png'],
    ['learning-roadmap', 'g11m-hd-income-overview.png'],
    ['how-we-will-work-like-financial-problem-solvers', 'g11m-hd-income-overview.png'],

    ['what-does-this-paycheck-number-mean', 'g11m-hd-diagnostic-payroll-markup.png'],
    ['today-s-payroll-meaning-path', 'g11m-hd-two-column-solution.png'],
    ['todays-payroll-meaning-path', 'g11m-hd-two-column-solution.png'],
    ['evidence-goal-quantities-units-and-meaning', 'g11m-hd-income-overview.png'],
    ['diagnostic-payroll-mark-up', 'g11m-hd-diagnostic-payroll-markup.png'],
    ['salary-and-hourly-offer-worked-example', 'g11m-hd-salary-hourly-worked.png'],
    ['guided-payroll-pair-practice', 'g11m-hd-guided-payroll-pair.png'],
    ['two-column-solution', 'g11m-hd-two-column-solution.png'],
    ['output-check-two-column-solution', 'g11m-hd-two-column-solution.png'],
    ['gross-and-net-income-error-repair', 'g11m-hd-gross-net-error.png'],
    ['reasonableness-conference', 'g11m-hd-two-column-solution.png'],
    ['payroll-meaning-exit', 'g11m-hd-gross-net-error.png'],

    ['what-method-fits-this-payroll-problem', 'g11m-hd-method-choice-check.png'],
    ['which-method-fits-this-payroll-problem', 'g11m-hd-method-choice-check.png'],
    ['today-s-multi-step-method-path', 'g11m-hd-math-decision-board.png'],
    ['todays-multi-step-method-path', 'g11m-hd-math-decision-board.png'],
    ['evidence-goal-method-choice-and-verification', 'g11m-hd-method-choice-check.png'],
    ['method-choice-check', 'g11m-hd-method-choice-check.png'],
    ['gross-to-net-sequence-model', 'g11m-hd-gross-net-sequence.png'],
    ['math-decision-board', 'g11m-hd-math-decision-board.png'],
    ['output-check-decision-board', 'g11m-hd-math-decision-board.png'],
    ['spreadsheet-verification', 'g11m-hd-spreadsheet-verification.png'],
    ['sample-answer-check', 'g11m-hd-sample-answer-check.png'],
    ['technology-is-not-a-black-box', 'g11m-hd-spreadsheet-verification.png'],
    ['net-weekly-income-exit', 'g11m-hd-sample-answer-check.png'],

    ['what-pay-option-should-we-recommend', 'g11m-hd-decision-prompt.png'],
    ['which-pay-option-should-we-recommend', 'g11m-hd-decision-prompt.png'],
    ['today-s-recommendation-evidence-path', 'g11m-hd-criteria-matrix.png'],
    ['todays-recommendation-evidence-path', 'g11m-hd-criteria-matrix.png'],
    ['evidence-goal-compare-evaluate-defend', 'g11m-hd-comparison-model.png'],
    ['decision-prompt', 'g11m-hd-decision-prompt.png'],
    ['comparison-model', 'g11m-hd-comparison-model.png'],
    ['criteria-matrix', 'g11m-hd-criteria-matrix.png'],
    ['output-check-criteria-matrix', 'g11m-hd-criteria-matrix.png'],
    ['recommendation-draft', 'g11m-hd-recommendation-draft.png'],
    ['peer-feedback-and-revision', 'g11m-hd-peer-feedback-revision.png'],
    ['recommendation-conference', 'g11m-hd-comparison-model.png'],
    ['evidence-highlight-exit', 'g11m-hd-peer-feedback-revision.png'],

    ['what-makes-a-pay-brief-portfolio-ready', 'g11m-hd-portfolio-readiness.png'],
    ['today-s-portfolio-brief-path', 'g11m-hd-pay-brief-template.png'],
    ['todays-portfolio-brief-path', 'g11m-hd-pay-brief-template.png'],
    ['evidence-goal-accurate-clear-ethical-brief', 'g11m-hd-portfolio-readiness.png'],
    ['portfolio-readiness-check', 'g11m-hd-portfolio-readiness.png'],
    ['weak-and-strong-output-review', 'g11m-hd-strong-weak-output.png'],
    ['pay-computation-brief', 'g11m-hd-pay-brief-template.png'],
    ['output-check-pay-computation-brief', 'g11m-hd-pay-brief-template.png'],
    ['independent-portfolio-work', 'g11m-hd-portfolio-work.png'],
    ['rubric-peer-review', 'g11m-hd-rubric-peer-review.png'],
    ['privacy-and-source-check', 'g11m-hd-portfolio-readiness.png'],
    ['portfolio-reflection-exit', 'g11m-hd-rubric-peer-review.png'],
  ];
  const slideSpecificImage = slideSpecificImageByToken.find(([token]) => (
    semanticAnchor === token || semanticAnchor.startsWith(`${token}-`)
    || semanticAnchor.includes(`-${token}-`) || semanticAnchor.endsWith(`-${token}`)
  ));
  if (slideSpecificImage) {
    return slideSpecificImage[1];
  }
  if (exactOnly) {
    return undefined;
  }

  const templateMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE['math-wages-income'];
  return templateMap?.[template] || templateMap?.content;
};

const SCIENCE_SCIENTISTS_INVENTIONS_STATIC_IMAGE_FILES = new Set([
  'because_sentences_work_like_evidence_chains',
  'best_source_exit',
  'build_the_evidence_board',
  'can_we_trust_this_detail',
  'check_before_you_submit',
  'compare_before_you_decide',
  'complete_the_final_profile_card',
  'cover_session_1',
  'cover_session_2',
  'cover_session_3',
  'cover_session_4',
  'final_evidence_reflection',
  'from_source_detail_to_impact',
  'how_did_the_repair_improve_trust',
  'main_activity__final_source_profile_check',
  'main_activity__scientist_invention_case_team',
  'main_activity__source_or_opinion_sort',
  'main_activity__two_source_profile_lab',
  'peer_feedback_question',
  'profile_evidence_table',
  'profile_gallery_review',
  'read_like_a_scientist',
  'reliability_conference',
  'reliable_source_transfer',
  'self_check_the_final_card',
  'source_claim_repair',
  'source_detail_talk',
  'source_evidence_exit',
  'source_repair_exit',
  'start_the_profile_card',
  'strong__weak__or_unsupported',
  'success_criteria',
  'support_and_challenge',
  'today_s_evidence_goal',
  'what_each_source_adds',
  'what_evidence_changed_your_answer',
  'what_evidence_improved_your_claim',
  'what_makes_a_profile_complete',
  'which_detail_helps_the_profile',
  'your_repair_slip',
]);

const SCIENCE_SCIENTISTS_INVENTIONS_STATIC_IMAGE_ALIASES: Record<string, string> = {
  main_activity_final_source_profile_check: 'main_activity__final_source_profile_check',
  main_activity_scientist_invention_case_team: 'main_activity__scientist_invention_case_team',
  main_activity_source_or_opinion_sort: 'main_activity__source_or_opinion_sort',
  main_activity_two_source_profile_lab: 'main_activity__two_source_profile_lab',
  strong_weak_or_unsupported: 'strong__weak__or_unsupported',
};

const getScienceScientistsInventionsImageFileName = (
  metadata: ImageSemanticMetadata,
): string | undefined => {
  const semanticAnchor = slugifyImageSemanticText(metadata.semanticAnchor);
  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const anchor = (semanticAnchor || template).replace(/-/g, '_');
  const fileStem = SCIENCE_SCIENTISTS_INVENTIONS_STATIC_IMAGE_FILES.has(anchor)
    ? anchor
    : SCIENCE_SCIENTISTS_INVENTIONS_STATIC_IMAGE_ALIASES[anchor];

  return fileStem
    ? `${fileStem}.png`
    : undefined;
};

const buildCuratedStaticImageUrl = (basePath: string, fileName: string): string => (
  `${basePath}/${fileName}?v=${CURATED_STATIC_IMAGE_ASSET_VERSION}`
);

const getCuratedStaticImageUrl = (metadata: ImageSemanticMetadata | undefined): string | undefined => {
  if (!metadata) return undefined;
  const collection = getCuratedStaticImageCollection(metadata);
  if (!collection) return undefined;
  if (collection === 'science-particle-model') {
    if (!USE_STATIC_SCIENCE_PARTICLE_MODEL_IMAGES) return undefined;
    const fileName = getScienceParticleModelImageFileName(metadata, true);
    const basePath = CURATED_STATIC_IMAGE_BASE_PATH_BY_COLLECTION[collection];
    return fileName && basePath ? buildCuratedStaticImageUrl(basePath, fileName) : undefined;
  }

  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const collectionMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE[collection];
  const fileName = collection === 'english-poetry-imagery'
    ? getEnglishPoetryImageryImageFileName(metadata, true)
      || getCuratedStaticTemplateFallback(template, collectionMap)
    : collection === 'english-literature-values'
      ? getEnglishLiteratureValuesImageFileName(metadata, true)
        || getCuratedStaticTemplateFallback(template, collectionMap)
      : collection === 'math-wages-income'
        ? getMathWagesIncomeImageFileName(metadata, true)
          || getCuratedStaticTemplateFallback(template, collectionMap)
        : collection === 'math-law-of-sines'
          ? getMathLawOfSinesImageFileName(metadata, true)
            || getCuratedStaticTemplateFallback(template, collectionMap)
          : collection === 'math-geometry-construction'
            ? getMathGeometryConstructionImageFileName(metadata, true)
              || getCuratedStaticTemplateFallback(template, collectionMap)
            : collection === 'math-statistics-expressions'
              ? getMathStatisticsExpressionsImageFileName(metadata, true)
                || getCuratedStaticTemplateFallback(template, collectionMap)
              : collection === 'math-polygons'
                ? getMathPolygonsImageFileName(metadata, true)
                  || getCuratedStaticTemplateFallback(template, collectionMap)
                : collection === 'science-digestive-system'
                  ? getScienceDigestiveImageFileName(metadata, true)
                    || getCuratedStaticTemplateFallback(template, collectionMap)
                  : collection === 'science-force-motion'
                    ? getScienceForceMotionImageFileName(metadata, true)
                      || getCuratedStaticTemplateFallback(template, collectionMap)
                    : collection === 'science-scientists-inventions'
                      ? getScienceScientistsInventionsImageFileName(metadata)
                      : collection === 'science-chemistry-reactions'
                        ? getScienceChemistryReactionsImageFileName(metadata, true)
                          || getCuratedStaticTemplateFallback(template, collectionMap)
                        : collection === 'science-general-motion'
                          ? getScienceGeneralMotionImageFileName(metadata, true)
                            || getCuratedStaticTemplateFallback(template, collectionMap)
                          : getCuratedStaticTemplateFallback(template, collectionMap);
  const basePath = CURATED_STATIC_IMAGE_BASE_PATH_BY_COLLECTION[collection];
  return fileName && basePath ? buildCuratedStaticImageUrl(basePath, fileName) : undefined;
};

const getProviderLimitFallbackImageUrl = (metadata: ImageSemanticMetadata | undefined): string | undefined => {
  if (!metadata) return undefined;
  const collection = getCuratedStaticImageCollection(metadata);
  if (
    collection !== 'english-poetry-imagery'
    && collection !== 'english-literature-values'
    && collection !== 'math-wages-income'
    && collection !== 'math-law-of-sines'
    && collection !== 'math-geometry-construction'
    && collection !== 'math-statistics-expressions'
    && collection !== 'math-polygons'
    && collection !== 'science-particle-model'
    && collection !== 'science-digestive-system'
    && collection !== 'science-force-motion'
    && collection !== 'science-scientists-inventions'
    && collection !== 'science-chemistry-reactions'
    && collection !== 'science-general-motion'
  ) return undefined;

  const fileName = collection === 'english-poetry-imagery'
    ? getEnglishPoetryImageryImageFileName(metadata, true)
    : collection === 'english-literature-values'
      ? getEnglishLiteratureValuesImageFileName(metadata, true)
      : collection === 'math-wages-income'
        ? getMathWagesIncomeImageFileName(metadata, true)
        : collection === 'math-law-of-sines'
          ? getMathLawOfSinesImageFileName(metadata, true)
          : collection === 'math-geometry-construction'
            ? getMathGeometryConstructionImageFileName(metadata, true)
            : collection === 'math-statistics-expressions'
              ? getMathStatisticsExpressionsImageFileName(metadata, true)
              : collection === 'math-polygons'
                ? getMathPolygonsImageFileName(metadata, true)
                : collection === 'science-particle-model'
                  ? getScienceParticleModelImageFileName(metadata, true)
                  : collection === 'science-digestive-system'
                    ? getScienceDigestiveImageFileName(metadata, true)
                    : collection === 'science-force-motion'
                      ? getScienceForceMotionImageFileName(metadata, true)
                      : collection === 'science-scientists-inventions'
                        ? getScienceScientistsInventionsImageFileName(metadata)
                        : collection === 'science-chemistry-reactions'
                          ? getScienceChemistryReactionsImageFileName(metadata, true)
                          : getScienceGeneralMotionImageFileName(metadata, true);
  const basePath = CURATED_STATIC_IMAGE_BASE_PATH_BY_COLLECTION[collection];
  return fileName && basePath ? buildCuratedStaticImageUrl(basePath, fileName) : undefined;
};

const getSlideImageRole = (slide: Slide): string => {
  const text = normalizeImageSemanticText([
    slide.title,
    ...(Array.isArray(slide.content) ? slide.content : []),
    slide.speakerNotes,
  ].filter(Boolean).join(' '));

  if (/\b(assignment|homework|takdang|gawain sa bahay)\b/.test(text)) return 'assignment';
  if (/\b(activity|aktibidad|gawain|group work|experiment|explore)\b/.test(text)) return 'activity';
  if (/\b(practice|drill|guided practice|independent practice|pagsasanay)\b/.test(text)) return 'practice';
  if (/\b(evaluation|assessment|quiz|test|exit ticket|evaluating|pagtataya)\b/.test(text)) return 'assessment';
  if (/\b(review|recap|balik-aral)\b/.test(text)) return 'review';
  if (/\b(summary|conclusion|generalization|synthesis|paglalahat)\b/.test(text)) return 'summary';
  if (/\b(objective|goal|layunin)\b/.test(text)) return 'objectives';
  if (/\b(title|agenda|overview)\b/.test(text)) return 'overview';
  return 'content';
};

const getSlideImageTemplateKey = (slide: Slide): string => {
  const text = normalizeImageSemanticText([
    slide.title,
    ...(Array.isArray(slide.content) ? slide.content : []),
    slide.speakerNotes,
  ].filter(Boolean).join(' '));

  if (/\b(assignment|homework|takdang|gawain sa bahay)\b/.test(text)) return 'assignment';
  if (/\b(evaluation|assessment|quiz|test|exit ticket|evaluating|pagtataya|tsek)\b/.test(text)) return 'assessment';
  if (/\b(generalization|summary|conclusion|synthesis|key takeaways|paglalahat|pagwawakas|pagninilay)\b/.test(text)) return 'generalization';
  if (/\b(criteria|success|rubric|pamantayan|tagumpay)\b/.test(text)) return 'success-criteria';
  if (/\b(application|paglalapat|individual work|sarili)\b/.test(text)) return 'application';
  if (/\b(practice|drill|guided practice|pair activity|independent practice|pagsasanay)\b/.test(text)) return 'practice';
  if (/\b(discussion|model|modelo|guro|how do we use)\b/.test(text)) return 'model';
  if (/\b(motivation|story|scenario|situation|sitwasyon|paunang)\b/.test(text)) return 'situation';
  if (/\b(review|recap|recall|balik-aral|balikan)\b/.test(text)) return 'review';
  if (/\b(welcome|objective|goal|layunin|session|sesyon|focus|title|agenda|overview)\b/.test(text)) return 'overview';
  if (/\b(content|concept development|core concept|gabay|kaisipan|evidence note|isip|kilos-loob)\b/.test(text)) return 'concept';
  return getSlideImageRole(slide);
};

const PAID_IMAGE_TEMPLATE_PRIORITY: Record<string, number> = {
  concept: 100,
  model: 96,
  activity: 94,
  application: 90,
  assessment: 86,
  overview: 80,
  'success-criteria': 76,
  practice: 72,
  review: 58,
  generalization: 54,
  assignment: 42,
  content: 64,
};

const getPaidImagePriorityScore = (slide: Slide, slideIndex: number): number => {
  const template = slide.imageSemanticMetadata?.slideTemplate || getSlideImageTemplateKey(slide);
  const role = slide.imageSemanticMetadata?.visualRole || getSlideImageRole(slide);
  const templateScore = PAID_IMAGE_TEMPLATE_PRIORITY[template] ?? 50;
  const roleScore = PAID_IMAGE_TEMPLATE_PRIORITY[role] ?? 50;
  const earlySlideBoost = Math.max(0, 8 - slideIndex);

  return Math.max(templateScore, roleScore) + earlySlideBoost;
};

const getSlideImageSemanticAnchor = (slide: Slide, prompt: string): string => {
  const slideText = normalizeImageSemanticText([
    slide.title,
    ...(Array.isArray(slide.content) ? slide.content : []),
    slide.speakerNotes,
  ].filter(Boolean).join(' '));

  return (slideText || normalizeImageSemanticText(prompt)).slice(0, 420);
};

const getGradeBand = (gradeLevel: string | undefined): string => {
  const normalized = normalizeImageSemanticText(gradeLevel);
  const gradeMatch = normalized.match(/\b(?:grade|baitang)\s*(\d{1,2})\b/) || normalized.match(/\b(\d{1,2})\b/);
  if (!gradeMatch) {
    return normalized.includes('college') ? 'college' : '';
  }

  const grade = Number.parseInt(gradeMatch[1], 10);
  if (!Number.isFinite(grade)) return '';
  if (grade <= 3) return 'k-3';
  if (grade <= 6) return '4-6';
  if (grade <= 10) return '7-10';
  return '11-12';
};

const getImageSemanticScopeValue = (scope: unknown, key: string): string => {
  if (!scope || typeof scope !== 'object') return '';
  const value = (scope as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
};

const buildSlideImageSemanticMetadata = (
  slide: Slide,
  prompt: string,
  semanticLanguage: 'EN' | 'FIL',
  semanticScope?: unknown,
): ImageSemanticMetadata => {
  const subject = getImageSemanticScopeValue(semanticScope, 'subject');
  const topic = getImageSemanticScopeValue(semanticScope, 'topic');
  const gradeLevel = getImageSemanticScopeValue(semanticScope, 'gradeLevel');

  return {
    level: getImageSemanticScopeValue(semanticScope, 'level'),
    format: getImageSemanticScopeValue(semanticScope, 'format'),
    subject,
    topic,
    gradeLevel,
    gradeBand: getGradeBand(gradeLevel),
    learningCompetency: getImageSemanticScopeValue(semanticScope, 'learningCompetency'),
    planUnitLabel: getImageSemanticScopeValue(semanticScope, 'planUnitLabel'),
    planUnitNumber: getImageSemanticScopeValue(semanticScope, 'planUnitNumber'),
    planUnitTitle: getImageSemanticScopeValue(semanticScope, 'planUnitTitle'),
    visualRole: getSlideImageRole(slide),
    slideTemplate: getSlideImageTemplateKey(slide),
    semanticAnchor: getSlideImageSemanticAnchor(slide, prompt),
    language: semanticLanguage,
    style: slide.imageStyle || 'illustration',
  };
};

const buildK12ImageSemanticScope = (
  blueprint: Pick<LessonBlueprint, 'mainTitle' | 'subject' | 'gradeLevel' | 'learningCompetency'>,
  planUnit?: Pick<DayPlan, 'dayNumber' | 'title'>,
  planUnitLabel?: string,
) => ({
  level: 'k12',
  format: DEFAULT_LESSON_FORMAT,
  subject: blueprint.subject,
  topic: blueprint.mainTitle,
  gradeLevel: blueprint.gradeLevel,
  learningCompetency: blueprint.learningCompetency,
  ...(planUnit ? {
    planUnitLabel: planUnitLabel || DEFAULT_PLAN_UNIT_LABEL,
    planUnitNumber: String(planUnit.dayNumber),
    planUnitTitle: planUnit.title,
  } : {}),
});

const buildTopicImageSemanticScope = (level: TeachingLevel, topic: string, format?: string) => ({
  level,
  format: format || '',
  topic: normalizeImageSemanticText(topic).slice(0, 240),
});

const resetBlueprintStatus = (blueprint: LessonBlueprint): LessonBlueprint => ({
  ...blueprint,
  days: blueprint.days.map((day) => ({ ...day, generationStatus: 'pending' as const })),
});

const completeBlueprintStatus = (blueprint: LessonBlueprint): LessonBlueprint => ({
  ...blueprint,
  days: blueprint.days.map((day) => ({ ...day, generationStatus: 'done' as const })),
});

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

const mergePdfTextRows = (rows: Array<{ y: number; parts: Array<{ x: number; text: string }> }>, y: number) => {
  const yTolerance = 2;
  const existingRow = rows.find((row) => Math.abs(row.y - y) <= yTolerance);
  if (existingRow) return existingRow;

  const row = { y, parts: [] as Array<{ x: number; text: string }> };
  rows.push(row);
  return row;
};

const extractStructuredPdfPageText = (items: unknown[]): string => {
  const rows: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];
  const flatTextParts: string[] = [];

  for (const item of items) {
    const textItem = item as PdfTextItem;
    const text = textItem.str?.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    flatTextParts.push(text);

    const transform = textItem.transform;
    if (!Array.isArray(transform) || transform.length < 6) continue;
    const x = Number(transform[4]) || 0;
    const y = Number(transform[5]) || 0;
    mergePdfTextRows(rows, y).parts.push({ x, text });
  }

  const structuredText = rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '))
    .filter(Boolean)
    .join('\n');

  return structuredText.trim() || flatTextParts.join(' ');
};

const shouldUseStandalonePlanUnitDeck = (blueprint: LessonBlueprint): boolean => (
  getPlanUnitLabel(blueprint).trim().toLowerCase() === 'session'
);

const buildPlanUnitPresentationTitle = (
  blueprint: LessonBlueprint,
  day: DayPlan,
): string => `${blueprint.mainTitle} - ${getPlanUnitLabel(blueprint)} ${day.dayNumber}: ${day.title}`;

const hasAdminUsageBypass = (user: SessionUser | null): boolean => {
  if (user?.isAdmin === true) {
    return true;
  }

  const role = user?.role?.trim().toLowerCase();
  return role === 'admin' || role === 'owner' || role === 'super_admin' || role === 'super-admin' || role === 'administrator';
};

const isImageProviderLimitError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  return normalized.includes('rate_limit_exceeded')
    || normalized.includes('spending cap')
    || normalized.includes('quota')
    || normalized.includes('billing')
    || normalized.includes('gateway timeout')
    || normalized.includes('timed out')
    || normalized.includes('timeout')
    || normalized.includes('temporarily experiencing');
};

const GENERIC_AUTH_ERROR = 'Secure access is required. Please sign in again from your authorized account.';
const GENERIC_REQUEST_ERROR = 'Something went wrong while processing your request. Please try again.';
const SERVICE_LIMIT_ERROR = 'A service limit or billing issue prevented this request. Please contact the administrator.';
const SERVICE_BUSY_ERROR = 'The service is temporarily busy. Please try again in about 1 minute.';
const SERVER_CONFIG_ERROR = 'A required server configuration is missing or invalid. Please contact the administrator.';
const IMAGE_LIMIT_ERROR = 'Image generation is temporarily unavailable. A placeholder was added so the slide can still be used.';
const IMAGE_LIMIT_BATCH_ERROR = 'Image generation is temporarily unavailable. Placeholder slides were added so the deck can still be used.';

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error || '')
);

const getErrorStatus = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
};

const getErrorCode = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' ? code : undefined;
};

const logRequestFailure = (error: unknown, status: number | undefined): void => {
  if (status) {
    console.error('Request failed.', { status });
    return;
  }

  const code = getErrorCode(error);
  console.error('Request failed without a response status.', {
    reason: code === 'NETWORK_ERROR' ? 'network' : (error instanceof Error ? error.name : typeof error),
  });
};
/**
 * Processes a string to identify parts of chemical formulas that need subscripting.
 * @param text The input string.
 * @returns An array of objects, each with a `text` segment and a boolean `sub` indicating if it should be a subscript.
 */
function processTextForPptx(text: string): { text: string; sub: boolean }[] {
    if (!text) return [];
    const chemicalRegex = /([A-Z][a-z]?)(\d+)/g;

    if (!chemicalRegex.test(text)) {
        return [{ text, sub: false }];
    }
    chemicalRegex.lastIndex = 0;

    const parts: { text: string; sub: boolean }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = chemicalRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ text: text.substring(lastIndex, match.index), sub: false });
        }
        const [_, element, number] = match;
        parts.push({ text: element, sub: false });
        parts.push({ text: number, sub: true });
        lastIndex = chemicalRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push({ text: text.substring(lastIndex), sub: false });
    }

    return parts;
}


const App: React.FC = () => {
  const [dllContent, setDllContent] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [topicContext, setTopicContext] = useState<string>('');
  const [objectivesContext, setObjectivesContext] = useState<string>('');
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [lessonBlueprint, setLessonBlueprint] = useState<LessonBlueprint | null>(null);
  const [generatedPlanUnitSlidesByDay, setGeneratedPlanUnitSlidesByDay] = useState<Record<number, Slide[]>>({});
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [loadingDuration, setLoadingDuration] = useState<number>(30);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [appStep, setAppStep] = useState<AppStep>('input');
  
  const [teachingLevel, setTeachingLevel] = useState<TeachingLevel>('K-12');
  const [depEdMode, setDepEdMode] = useState<DepEdMode>('weekly');
  
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState<string>('');
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const regeneratingImageIndexesRef = useRef<Set<number>>(new Set());

  const { theme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = translations[language];
  const appStoreUrl = ((import.meta as ImportMeta & { env?: { VITE_APPSTORE_URL?: string } }).env?.VITE_APPSTORE_URL || '').trim();
  const {
    generations,
    images,
    limits,
    incrementCount,
    tryIncrementCount,
    decrementCount,
    canGenerate,
    canGenerateImage,
    updateCounts
  } = useUsageTracker();
  const adminUsageLimitBypassed = hasAdminUsageBypass(sessionUser);
  const adminGenerationLimitBypassed = adminUsageLimitBypassed;
  const adminImageLimitBypassed = adminUsageLimitBypassed;

  useEffect(() => {
    updateCounts();
  }, [updateCounts]);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const access = params.get('access');
        const endpoint = access
          ? `/api/session?access=${encodeURIComponent(access)}`
          : '/api/session';

        const { ok, payload } = await fetchSessionOnce(endpoint);

        if (access) {
          params.delete('access');
          const nextQuery = params.toString();
          const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
          window.history.replaceState({}, '', cleanUrl);
        }

        if (cancelled) return;

        if (ok && payload?.authenticated) {
          setAuthState('authorized');
          setAuthError('');
          setSessionUser(payload.user || null);
          return;
        }

        setAuthState('unauthorized');
        setAuthError(GENERIC_AUTH_ERROR);
        setSessionUser(null);
      } catch {
        if (cancelled) return;
        setAuthState('unauthorized');
        setAuthError(GENERIC_AUTH_ERROR);
        setSessionUser(null);
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);
  
  const handleApiError = (e: unknown) => {
    const errorMessage = getErrorMessage(e);
    const normalizedError = errorMessage.toLowerCase();
    const status = getErrorStatus(e);
    logRequestFailure(e, status);

    if (status === 429 || normalizedError.includes("rate_limit_exceeded")) {
        setError(SERVICE_LIMIT_ERROR);
        return; // Important to return here to avoid fallback messages.
    }

    if (status === 403) {
        setError(SERVICE_LIMIT_ERROR);
        return;
    }

    if (status === 401 || normalizedError.includes('unauthorized') || errorMessage.includes('401')) {
        setAuthState('unauthorized');
        setAuthError(GENERIC_AUTH_ERROR);
        return;
    }

    if (getErrorCode(e) === 'NETWORK_ERROR') {
        setError(GENERIC_REQUEST_ERROR);
        return;
    }
    
    if (normalizedError.includes("api key") || normalizedError.includes("api_key") || normalizedError.includes("server configuration")) {
        setError(SERVER_CONFIG_ERROR);
    } else if (normalizedError.includes("high demand") || normalizedError.includes("unavailable") || normalizedError.includes("temporarily") || normalizedError.includes('timed out') || normalizedError.includes('timeout')) {
        setError(SERVICE_BUSY_ERROR);
    } else if (normalizedError.includes('spending cap') || normalizedError.includes('permission') || normalizedError.includes('billing') || normalizedError.includes('quota')) {
        setError(SERVICE_LIMIT_ERROR);
    } else {
        setError(GENERIC_REQUEST_ERROR);
    }
  };
  
  const processSlidesForTables = async (slides: Slide[]): Promise<Slide[]> => {
    const updatedSlides = [];
    let html2canvas: Html2Canvas | null = null;

    const computedStyle = getComputedStyle(document.body);
    const bgColor = computedStyle.getPropertyValue('--bg-surface').trim();
    const textColor = computedStyle.getPropertyValue('--text-primary').trim();
    const headerBg = computedStyle.getPropertyValue('--brand-light').trim();
    const headerText = computedStyle.getPropertyValue('--brand').trim();
    const borderColor = computedStyle.getPropertyValue('--border-color').trim();
    const headerBorderBottom = computedStyle.getPropertyValue('--brand').trim();
    
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '1280px';
    container.style.height = '720px';
    container.style.backgroundColor = bgColor;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.padding = '40px';
    document.body.appendChild(container);

    for (const slide of slides) {
        let newSlide = { ...slide };
        let tableFound = false;
        const newContent = [];

        for (const item of slide.content) {
            if (item.trim().startsWith('|') && item.includes('\n') && (item.includes('---|') || item.includes(':---'))) {
                tableFound = true;
                const lines = item.trim().split('\n');
                let html = `<table style="width:100%; border-collapse: collapse; font-family: 'Poppins', sans-serif; font-size: 24px; color: ${textColor};">`;
                let isHeader = true;

                for (let i = 0; i < lines.length; i++) {
                     const line = lines[i].trim();
                     if (!line.startsWith('|')) continue;
                     if (line.includes('---')) {
                         isHeader = false;
                         continue;
                     }
                     const cells = line.split('|').filter(c => c !== '');
                     html += '<tr>';
                     cells.forEach(cell => {
                         if (isHeader) {
                             html += `<th style="border-bottom: 3px solid ${headerBorderBottom}; padding: 16px; text-align: left; background-color: ${headerBg}; color: ${headerText}; font-weight: 600;">${cell.trim()}</th>`;
                         } else {
                             html += `<td style="border-bottom: 1px solid ${borderColor}; padding: 16px;">${cell.trim()}</td>`;
                         }
                     });
                     html += '</tr>';
                }
                html += '</table>';
                container.innerHTML = `<div style="width: 100%;">${html}</div>`;
                
                try {
                    if (!html2canvas) {
                        html2canvas = (await import('html2canvas')).default;
                    }
                    const canvas = await html2canvas(container, { backgroundColor: bgColor, scale: 1 });
                    newSlide.imageUrl = canvas.toDataURL('image/png');
                    newSlide.imagePrompt = '';
                } catch (err) {
                    console.error("Failed to convert table to image", err);
                    newContent.push(item);
                }
            } else {
                newContent.push(item);
            }
        }
        if (tableFound) {
            newSlide.content = newContent;
        }
        updatedSlides.push(newSlide);
    }
    document.body.removeChild(container);
    return updatedSlides;
  };

  const buildFallbackImagePrompt = useCallback((slide: Slide): string => {
    const title = (slide.title || '').trim();
    const content = Array.isArray(slide.content)
      ? slide.content.filter(Boolean).slice(0, 3).join(', ').trim()
      : '';
    const combined = [title, content].filter(Boolean).join('. ').trim();
    return combined.slice(0, 220);
  }, []);

  const buildImagePromptCandidates = useCallback((slide: Slide): string[] => {
    if (slide.imageStyle === 'none') {
      return [];
    }

    const primary = (slide.imagePrompt || '').trim();
    const fallback = buildFallbackImagePrompt(slide);
    const bestPrompt = primary || fallback;
    return bestPrompt ? [bestPrompt] : [];
  }, [buildFallbackImagePrompt]);

  const buildImageSemanticCacheId = useCallback(async (
    semanticMetadata: ImageSemanticMetadata,
    semanticLanguage: 'EN' | 'FIL',
  ): Promise<string | undefined> => {
    const template = semanticMetadata.slideTemplate || semanticMetadata.visualRole || 'content';
    if (!template || semanticMetadata.style === 'none') {
      return undefined;
    }
    const semanticAnchor = slugifyImageSemanticText(semanticMetadata.semanticAnchor || template).slice(0, 120);

    return buildGenerationCacheKey('image-semantic', [
      IMAGE_SEMANTIC_CACHE_VERSION,
      semanticMetadata.level || 'general',
      semanticMetadata.subject || 'general',
      semanticMetadata.topic || 'general',
      semanticMetadata.gradeBand || semanticMetadata.gradeLevel || 'all-grades',
      semanticLanguage,
      template,
      semanticMetadata.visualRole || 'content',
      semanticMetadata.style || 'illustration',
      semanticAnchor || template,
    ]);
  }, []);

  const buildSlideImageSemanticCacheId = useCallback(async (
    slide: Slide,
    semanticLanguage: 'EN' | 'FIL',
    semanticScope?: unknown,
    existingSemanticMetadata?: ImageSemanticMetadata
  ): Promise<string | undefined> => {
    const prompt = (slide.imagePrompt || buildFallbackImagePrompt(slide)).trim();
    if (!prompt || slide.imageStyle === 'none') {
      return undefined;
    }

    const semanticMetadata = existingSemanticMetadata
      || buildSlideImageSemanticMetadata(slide, prompt, semanticLanguage, semanticScope);
    return buildImageSemanticCacheId(semanticMetadata, semanticLanguage);
  }, [buildFallbackImagePrompt, buildImageSemanticCacheId]);

  const processSlidesForImages = async (
    slidesWithPrompts: Slide[],
    language: 'EN' | 'FIL',
    options?: { muteProgress?: boolean; imageCacheScope?: string; imageSemanticScope?: unknown }
  ): Promise<Slide[]> => {
    const muteProgress = options?.muteProgress === true;
    const attachImageCacheIds = async (slide: Slide, slideIndex: number): Promise<Slide> => {
        const imagePrompt = slide.imageStyle === 'none'
          ? (slide.imagePrompt || '')
          : (slide.imagePrompt || buildFallbackImagePrompt(slide));
        const slideWithPrompt = { ...slide, imagePrompt };
        const imageSemanticMetadata = slide.imageSemanticMetadata || buildSlideImageSemanticMetadata(
          slideWithPrompt,
          imagePrompt,
          language,
          options?.imageSemanticScope
        );
        const imageSemanticCacheId = slide.imageSemanticCacheId || await buildSlideImageSemanticCacheId(
          slideWithPrompt,
          language,
          options?.imageSemanticScope,
          imageSemanticMetadata
        );

        return {
          ...slideWithPrompt,
          imageCacheId: slide.imageCacheId || buildSlideImageCacheId(options?.imageCacheScope, slideIndex),
          ...(imageSemanticCacheId ? { imageSemanticCacheId } : {}),
          imageSemanticMetadata,
          imageUrl: isRejectedScienceParticleModelImageUrl(slideWithPrompt.imageUrl, imageSemanticMetadata)
            ? undefined
            : slideWithPrompt.imageUrl,
        };
    };

    if (IMAGES_DISABLED) {
        return Promise.all(slidesWithPrompts.map(async (s, slideIndex) => {
          const slideWithCacheIds = await attachImageCacheIds(s, slideIndex);
          return {
            ...slideWithCacheIds,
            imageUrl: IMAGE_SKIPPED_PLACEHOLDER,
          };
        }));
    }
    let rateLimitWasHit = false;
    
    const imagesToGenerate = slidesWithPrompts.filter((s) => buildImagePromptCandidates(s).length > 0 && !s.imageUrl);
    const totalImagesToAttempt = imagesToGenerate.length;
    let imagesAttemptedCounter = 0;
    
    const paidImagesLeftToday = Math.max(0, limits.images - images);
    const paidImageAttemptsAllowed = Math.min(
      totalImagesToAttempt,
      PAID_IMAGE_ATTEMPTS_PER_DECK_LIMIT,
      adminImageLimitBypassed ? ADMIN_IMAGE_BATCH_LIMIT : paidImagesLeftToday
    );
    const paidImageCandidateIndexes = new Set(
      slidesWithPrompts
        .map((slide, slideIndex) => ({
          slide,
          slideIndex,
          score: getPaidImagePriorityScore(slide, slideIndex),
        }))
        .filter(({ slide }) => buildImagePromptCandidates(slide).length > 0 && !slide.imageUrl)
        .sort((a, b) => b.score - a.score || a.slideIndex - b.slideIndex)
        .slice(0, paidImageAttemptsAllowed)
        .map(({ slideIndex }) => slideIndex)
    );
    const totalImagesThatCanBeGenerated = totalImagesToAttempt;

    if (!muteProgress) {
      if (totalImagesThatCanBeGenerated > 0) {
          setLoadingProgress(0);
      } else if (totalImagesToAttempt > 0) {
          console.warn("Daily image limit reached or no prompts found. Skipping image generation.");
      }
    }

    const resolveSlideImage = async (slide: Slide, slideIndex: number): Promise<Slide> => {
        let newSlide = await attachImageCacheIds(slide, slideIndex);
        const promptCandidates = buildImagePromptCandidates(newSlide);
        if (!newSlide.imageUrl && promptCandidates.length > 0) {
            const promptForGeneration = promptCandidates[0];
            if (!newSlide.imagePrompt || !newSlide.imagePrompt.trim()) {
                newSlide.imagePrompt = promptForGeneration;
            }

            try {
                const cachedImage = await getCachedImageResultForPrompt(
                  promptForGeneration,
                  newSlide.imageStyle,
                  language,
                  newSlide.imageCacheId,
                  newSlide.imageSemanticCacheId,
                  newSlide.imageSemanticMetadata
                );
                if (cachedImage?.dataUrl && !isRejectedScienceParticleModelImageUrl(cachedImage.dataUrl, newSlide.imageSemanticMetadata)) {
                    newSlide.imageUrl = cachedImage.dataUrl;
                    newSlide.imageAttribution = cachedImage.attribution;
                    return newSlide;
                }
                if (cachedImage?.dataUrl) {
                    console.warn('Ignored a cached particle-model image because it was an old SVG/static visual.');
                }
            } catch {
                console.warn('Failed to check saved slide image before generation.');
            }

            const curatedStaticImageUrl = getCuratedStaticImageUrl(newSlide.imageSemanticMetadata);
            if (curatedStaticImageUrl) {
                newSlide.imageUrl = curatedStaticImageUrl;
                newSlide.imageAttribution = undefined;
                return newSlide;
            }

            const allowPaidImageGeneration = !rateLimitWasHit
              && paidImageCandidateIndexes.has(slideIndex)
              && (adminImageLimitBypassed || canGenerateImage);

            if (rateLimitWasHit && !allowPaidImageGeneration) {
                const fallbackImageUrl = getProviderLimitFallbackImageUrl(newSlide.imageSemanticMetadata);
                if (fallbackImageUrl) {
                    newSlide.imageUrl = fallbackImageUrl;
                    newSlide.imageAttribution = undefined;
                    return newSlide;
                }
            }

            {
                imagesAttemptedCounter++;
                if (!muteProgress) {
                  setLoadingMessage(t.presentation.loadingImages.replace('{current}', imagesAttemptedCounter.toString()).replace('{total}', totalImagesThatCanBeGenerated.toString()));
                }
                
                if (!muteProgress && totalImagesThatCanBeGenerated > 0) {
                    const progress = (imagesAttemptedCounter / totalImagesThatCanBeGenerated) * 100;
                    setLoadingProgress(progress);
                }
                
                try {
                    const generateImage = () => generateImageResultFromPrompt(
                      promptForGeneration,
                      newSlide.imageStyle,
                      language,
                      newSlide.imageCacheId,
                      newSlide.imageSemanticCacheId,
                      newSlide.imageSemanticMetadata,
                      allowPaidImageGeneration
                    );
                    const imageResult = allowPaidImageGeneration
                      ? await runQueuedPaidImageGeneration(generateImage)
                      : await generateImage();
                    if (isRejectedScienceParticleModelImageUrl(imageResult.dataUrl, newSlide.imageSemanticMetadata)) {
                        throw new Error('Generated image resolved to an old SVG/static particle-model visual.');
                    }
                    newSlide.imageUrl = imageResult.dataUrl || (allowPaidImageGeneration ? IMAGE_SKIPPED_PLACEHOLDER : USER_IMAGE_LIMIT_PLACEHOLDER);
                    newSlide.imageAttribution = imageResult.attribution;
                    if (imageResult.dataUrl && !adminImageLimitBypassed && imageResult.provider !== 'pexels' && imageResult.cache?.hit !== true) {
                        incrementCount('images');
                    }
                } catch (imgError) {
                    console.error('Image generation failed.');
                    if (isImageProviderLimitError(imgError)) {
                        rateLimitWasHit = true;
                        const fallbackImageUrl = getProviderLimitFallbackImageUrl(newSlide.imageSemanticMetadata);
                        if (fallbackImageUrl) {
                            newSlide.imageUrl = fallbackImageUrl;
                        } else {
                            setError(IMAGE_LIMIT_BATCH_ERROR);
                            newSlide.imageUrl = PROVIDER_IMAGE_LIMIT_PLACEHOLDER;
                        }
                        newSlide.imageAttribution = undefined;
                    } else {
                        handleApiError(imgError);
                        newSlide.imageUrl = 'error';
                        newSlide.imageAttribution = undefined;
                    }
                }
            }
        }
        return newSlide;
    };

    return mapWithConcurrency(slidesWithPrompts, IMAGE_PROCESSING_CONCURRENCY, resolveSlideImage);
  };

  const refreshSlidesWithCachedImages = useCallback(async (
    slidesToRefresh: Slide[],
    refreshLanguage: 'EN' | 'FIL',
    imageCacheScope?: string,
    imageSemanticScope?: unknown
  ): Promise<Slide[]> => {
    if (IMAGES_DISABLED) {
        return slidesToRefresh;
    }

    const refreshedSlides: Slide[] = [];
    for (let slideIndex = 0; slideIndex < slidesToRefresh.length; slideIndex += 1) {
        const baseSlide = {
            ...slidesToRefresh[slideIndex],
            imageCacheId: slidesToRefresh[slideIndex].imageCacheId || buildSlideImageCacheId(imageCacheScope, slideIndex),
        };
        const imageSemanticCacheId = baseSlide.imageSemanticCacheId || await buildSlideImageSemanticCacheId(
          baseSlide,
          refreshLanguage,
          imageSemanticScope
        );
        const imageSemanticMetadata = baseSlide.imageSemanticMetadata || buildSlideImageSemanticMetadata(
          baseSlide,
          baseSlide.imagePrompt || buildFallbackImagePrompt(baseSlide),
          refreshLanguage,
          imageSemanticScope
        );
        const slide = {
            ...baseSlide,
            ...(imageSemanticCacheId ? { imageSemanticCacheId } : {}),
            imageSemanticMetadata,
            imageUrl: isRejectedScienceParticleModelImageUrl(baseSlide.imageUrl, imageSemanticMetadata)
              ? undefined
              : baseSlide.imageUrl,
        };
        if (slide.imageUrl && NON_EXPORTABLE_IMAGE_STATES.has(slide.imageUrl)) {
            const fallbackImageUrl = getProviderLimitFallbackImageUrl(slide.imageSemanticMetadata);
            if (fallbackImageUrl) {
                refreshedSlides.push({ ...slide, imageUrl: fallbackImageUrl, imageAttribution: undefined });
                continue;
            }
        }

        const prompt = (slide.imagePrompt || '').trim();
        if (!prompt || slide.imageStyle === 'none') {
            refreshedSlides.push(slide);
            continue;
        }

        try {
            const cachedImage = await getCachedImageResultForPrompt(
              prompt,
              slide.imageStyle,
              refreshLanguage,
              slide.imageCacheId,
              slide.imageSemanticCacheId,
              slide.imageSemanticMetadata
            );
            if (cachedImage?.dataUrl && !isRejectedScienceParticleModelImageUrl(cachedImage.dataUrl, slide.imageSemanticMetadata)) {
              refreshedSlides.push({ ...slide, imageUrl: cachedImage.dataUrl, imageAttribution: cachedImage.attribution });
              continue;
            }

            const fallbackImageUrl = getProviderLimitFallbackImageUrl(slide.imageSemanticMetadata);
            refreshedSlides.push(fallbackImageUrl ? { ...slide, imageUrl: fallbackImageUrl, imageAttribution: undefined } : slide);
        } catch {
            console.warn('Failed to refresh a saved slide image.');
            const fallbackImageUrl = getProviderLimitFallbackImageUrl(slide.imageSemanticMetadata);
            refreshedSlides.push(fallbackImageUrl ? { ...slide, imageUrl: fallbackImageUrl, imageAttribution: undefined } : slide);
        }
    }

    return refreshedSlides;
  }, [buildSlideImageSemanticCacheId]);

  const handleCreatePlan = useCallback(async () => {
    setError(null);
    const content = dllContent.trim() || topicContext.trim();
    if (teachingLevel === 'College' && (!topicContext.trim() || !objectivesContext.trim())) {
      setError(t.presentation.errorNoCollegeTopic);
      return;
    }

    if (teachingLevel === 'K-12' && !content) {
      setError(t.presentation.errorNoFileOrTopic);
      return;
    }

    setIsLoading(true);
    let shouldRollbackGeneration = false;

    try {
        // College Flow
        if (teachingLevel === 'College') {
            setLoadingDuration(45);
            setLoadingMessage(t.presentation.loadingLecture);
            const cacheKey = await buildGenerationCacheKey('college-presentation', [
              GENERATION_CACHE_VERSION,
              topicContext,
              objectivesContext,
              language,
            ]);
            const imageSemanticScope = buildTopicImageSemanticScope('College', `${topicContext}\n${objectivesContext}`);
            const cachedPresentation = await getCachedGeneration<Presentation>(cacheKey);
            if (cachedPresentation) {
              await waitForCacheHitLoading(setLoadingProgress);
              const refreshedSlides = await refreshSlidesWithCachedImages(cachedPresentation.slides, language, cacheKey, imageSemanticScope);
              setPresentation({ ...cachedPresentation, slides: refreshedSlides });
              setCurrentSlide(0);
              await finishLoadingProgress(setLoadingProgress);
              setAppStep('presenting');
              return;
            }

            const hasQuota = adminGenerationLimitBypassed || tryIncrementCount('generations');
            if (!hasQuota) {
              setIsLoading(false);
              setError(t.presentation.errorGenerationLimit);
              return;
            }
            shouldRollbackGeneration = !adminGenerationLimitBypassed;
            const fullPresentation = await generateCollegeLectureSlides(topicContext, objectivesContext, language, (msg) => setLoadingMessage(msg));
            setLoadingMessage(t.presentation.loadingTables);
            const slidesWithTables = await processSlidesForTables(assertSlidesGenerated(fullPresentation.slides, 'College presentation'));
            const finalSlides = assertSlidesGenerated(
              await processSlidesForImages(slidesWithTables, language, { imageCacheScope: cacheKey, imageSemanticScope }),
              'College presentation'
            );
            const finalPresentation = { ...fullPresentation, slides: finalSlides };

            setPresentation(finalPresentation);
            await setCachedGeneration(cacheKey, finalPresentation);
            setCurrentSlide(0);
            await finishLoadingProgress(setLoadingProgress);
            setAppStep('presenting');
        } 
        // DepEd Flows
        else if (teachingLevel === 'K-12') {
            // DepEd Single Lesson Flow
            if (depEdMode === 'single') {
                setLoadingDuration(40);
                setLoadingMessage(t.presentation.loadingSingleLesson);
                const cacheKey = await buildGenerationCacheKey('k12-single-presentation', [
                  GENERATION_CACHE_VERSION,
                  content,
                  DEFAULT_LESSON_FORMAT,
                  language,
                ]);
                const imageSemanticScope = buildTopicImageSemanticScope('K-12', content, DEFAULT_LESSON_FORMAT);
                const cachedPresentation = await getCachedGeneration<Presentation>(cacheKey);
                if (cachedPresentation) {
                  await waitForCacheHitLoading(setLoadingProgress);
                  const refreshedSlides = await refreshSlidesWithCachedImages(cachedPresentation.slides, language, cacheKey, imageSemanticScope);
                  setPresentation({ ...cachedPresentation, slides: refreshedSlides });
                  setCurrentSlide(0);
                  await finishLoadingProgress(setLoadingProgress);
                  setAppStep('presenting');
                  return;
                }

                const hasQuota = adminGenerationLimitBypassed || tryIncrementCount('generations');
                if (!hasQuota) {
                  setIsLoading(false);
                  setError(t.presentation.errorGenerationLimit);
                  return;
                }
                shouldRollbackGeneration = !adminGenerationLimitBypassed;
                const fullPresentation = await generateK12SingleLessonSlides(content, DEFAULT_LESSON_FORMAT, language, (msg) => setLoadingMessage(msg));
                setLoadingMessage(t.presentation.loadingTables);
                const slidesWithTables = await processSlidesForTables(assertSlidesGenerated(fullPresentation.slides, 'Single lesson presentation'));
                const finalSlides = assertSlidesGenerated(
                  await processSlidesForImages(slidesWithTables, language, { imageCacheScope: cacheKey, imageSemanticScope }),
                  'Single lesson presentation'
                );
                const finalPresentation = { ...fullPresentation, slides: finalSlides };

                setPresentation(finalPresentation);
                await setCachedGeneration(cacheKey, finalPresentation);
                setCurrentSlide(0);
                await finishLoadingProgress(setLoadingProgress);
                setAppStep('presenting');
            }
            // DepEd Weekly Plan Flow (default)
            else if (depEdMode === 'weekly') {
                setLoadingDuration(20);
                setLoadingMessage(t.presentation.loadingBlueprint);
                const cacheKey = await buildGenerationCacheKey('k12-lesson-plan', [
                  GENERATION_CACHE_VERSION,
                  content,
                  DEFAULT_LESSON_FORMAT,
                  language,
                ]);

                const { getReusableK12LessonPlanSeed } = await loadReusableLessonSeeds();
                const reusablePlan = getReusableK12LessonPlanSeed(content, language);
                if (reusablePlan) {
                  const blueprintWithStatus = resetBlueprintStatus(reusablePlan.blueprint);
                  const imageSemanticScope = buildK12ImageSemanticScope(reusablePlan.blueprint);
                  const [processedInitialSlides] = await Promise.all([
                    processSlidesForImages(
                      reusablePlan.initialPresentation.slides,
                      language,
                      { muteProgress: true, imageCacheScope: cacheKey, imageSemanticScope }
                    ),
                    waitForReusableGenerationLoading(setLoadingProgress),
                  ]);
                  const initialPresentation = {
                    ...reusablePlan.initialPresentation,
                    slides: processedInitialSlides,
                  };

                  setLessonBlueprint(blueprintWithStatus);
                  setPresentation(initialPresentation);
                  await setCachedGeneration(cacheKey, {
                    blueprint: blueprintWithStatus,
                    initialPresentation,
                  });

                  await finishLoadingProgress(setLoadingProgress);
                  setAppStep('planning');
                  shouldRollbackGeneration = false;
                  return;
                }

                const cachedPlan = await getCachedGeneration<CachedLessonPlan>(cacheKey);
                if (cachedPlan) {
                  await waitForCacheHitLoading(setLoadingProgress);
                  const imageSemanticScope = buildK12ImageSemanticScope(cachedPlan.blueprint);
                  const refreshedInitialSlides = await refreshSlidesWithCachedImages(cachedPlan.initialPresentation.slides, language, cacheKey, imageSemanticScope);
                  const shouldTreatAsComplete = cachedPlan.blueprint.days.every((day) => day.generationStatus === 'done')
                    && refreshedInitialSlides.length > 2;
                  setLessonBlueprint(shouldTreatAsComplete ? completeBlueprintStatus(cachedPlan.blueprint) : resetBlueprintStatus(cachedPlan.blueprint));
                  setPresentation({ ...cachedPlan.initialPresentation, slides: refreshedInitialSlides });
                  await finishLoadingProgress(setLoadingProgress);
                  setAppStep(shouldTreatAsComplete ? 'presenting' : 'planning');
                  shouldRollbackGeneration = false;
                  return;
                }

                const blueprint = await createK12LessonBlueprint(content, DEFAULT_LESSON_FORMAT, language);
                const blueprintWithStatus = resetBlueprintStatus(blueprint);
                const imageSemanticScope = buildK12ImageSemanticScope(blueprint);
                setLessonBlueprint(blueprintWithStatus);
                
                const initialSlides = [
                    {
                        title: blueprint.mainTitle,
                        content: [`Subject: ${blueprint.subject}`, `Grade Level: ${blueprint.gradeLevel}`, `Quarter: ${blueprint.quarter}`],
                        speakerNotes: "Welcome the class and briefly introduce the main topic for the week."
                    },
                    {
                        title: "Learning Objectives",
                        content: blueprint.studentFacingObjectives,
                        speakerNotes: "Read the objectives aloud. Explain what students will be able to do by the end of the week. These are the simplified goals. The full SMART objectives are in your lesson plan for reference."
                    }
                ];

                const processedInitialSlides = await processSlidesForImages(initialSlides, language, { muteProgress: true, imageCacheScope: cacheKey, imageSemanticScope });
                const initialPresentation = {
                    title: blueprint.mainTitle,
                    slides: processedInitialSlides
                };

                setPresentation(initialPresentation);
                await setCachedGeneration(cacheKey, { blueprint, initialPresentation });

                await finishLoadingProgress(setLoadingProgress);
                setAppStep('planning');
            }
        }
        shouldRollbackGeneration = false;
    } catch (e) {
        if (shouldRollbackGeneration) {
            decrementCount('generations');
        }
        handleApiError(e);
        setAppStep('input');
    } finally {
        setIsLoading(false);
        setLoadingProgress(null);
    }
  }, [dllContent, topicContext, objectivesContext, teachingLevel, depEdMode, language, t, adminGenerationLimitBypassed, tryIncrementCount, decrementCount, refreshSlidesWithCachedImages]);

  const handleGenerateDailySlides = useCallback(async (dayIndex: number) => {
    if (!lessonBlueprint) return;
    
    setLessonBlueprint(prev => {
        if (!prev) return null;
        const newDays = [...prev.days];
        newDays[dayIndex].generationStatus = 'loading';
        return {...prev, days: newDays};
    });

    setIsLoading(true);
    setError(null);
    let shouldRollbackGeneration = false;
    
    try {
        const dayToGenerate = lessonBlueprint.days[dayIndex];
        const unitLabel = getPlanUnitLabel(lessonBlueprint);
        const isStandalonePlanUnitDeck = shouldUseStandalonePlanUnitDeck(lessonBlueprint);
        const planUnitPresentationTitle = buildPlanUnitPresentationTitle(lessonBlueprint, dayToGenerate);
        const content = dllContent.trim() || topicContext.trim();
        const cacheKey = await buildGenerationCacheKey('k12-plan-unit-slides', [
          GENERATION_CACHE_VERSION,
          content,
          DEFAULT_LESSON_FORMAT,
          language,
          unitLabel,
          {
            dayNumber: dayToGenerate.dayNumber,
            title: dayToGenerate.title,
            focus: dayToGenerate.focus,
            mainTitle: lessonBlueprint.mainTitle,
            learningCompetency: lessonBlueprint.learningCompetency,
          },
        ]);
        const imageCacheScope = await buildGenerationCacheKey('k12-plan-unit-images', [
          GENERATION_CACHE_VERSION,
          content,
          DEFAULT_LESSON_FORMAT,
          language,
          unitLabel,
          dayToGenerate.dayNumber,
        ]);
        const imageSemanticScope = buildK12ImageSemanticScope(lessonBlueprint, dayToGenerate, unitLabel);

        setLoadingMessage(
          t.presentation.loadingDailySlides
            .replace('{unitLabel}', unitLabel)
            .replace('{dayNumber}', dayToGenerate.dayNumber.toString())
        );

        const hasQuota = adminGenerationLimitBypassed || tryIncrementCount('generations');
        if (!hasQuota) {
          setError(t.presentation.errorGenerationLimit);
          setLessonBlueprint(prev => {
              if (!prev) return null;
              const newDays = [...prev.days];
              newDays[dayIndex].generationStatus = 'pending';
              return {...prev, days: newDays};
          });
          return;
        }

        shouldRollbackGeneration = !adminGenerationLimitBypassed;
        const cachedSlides = await getCachedGeneration<Slide[]>(cacheKey);
        const slideIndexOfNewDay = isStandalonePlanUnitDeck ? 0 : (presentation?.slides.length ?? 0);

        if (cachedSlides && cachedSlides.length > 0) {
            await waitForCacheHitLoading(setLoadingProgress);
            const refreshedSlides = await refreshSlidesWithCachedImages(cachedSlides, language, imageCacheScope, imageSemanticScope);
            setGeneratedPlanUnitSlidesByDay(prev => ({
                ...prev,
                [dayToGenerate.dayNumber]: refreshedSlides,
            }));
            setPresentation(prev => ({
                title: isStandalonePlanUnitDeck ? planUnitPresentationTitle : (prev?.title ?? lessonBlueprint.mainTitle),
                slides: isStandalonePlanUnitDeck ? refreshedSlides : [...(prev?.slides ?? []), ...refreshedSlides]
            }));

            setLessonBlueprint(prev => {
                if (!prev) return null;
                const newDays = [...prev.days];
                newDays[dayIndex].generationStatus = 'done';
                return {...prev, days: newDays};
            });

            setCurrentSlide(slideIndexOfNewDay);
            await finishLoadingProgress(setLoadingProgress);
            setAppStep('presenting');
            shouldRollbackGeneration = false;
            return;
        }

        const { getReusableK12PlanUnitSlidesSeed } = await loadReusableLessonSeeds();
        const reusableSlides = getReusableK12PlanUnitSlidesSeed(content, dayToGenerate.dayNumber, language);
        if (reusableSlides && reusableSlides.length > 0) {
            await waitForReusableGenerationLoading(setLoadingProgress);
            setLoadingMessage(t.presentation.loadingTables);
            const slidesWithTables = await processSlidesForTables(reusableSlides);
            const finalSlides = assertSlidesGenerated(
                await processSlidesForImages(slidesWithTables, language, { imageCacheScope, imageSemanticScope }),
                `${unitLabel} ${dayToGenerate.dayNumber}`
            );

            setGeneratedPlanUnitSlidesByDay(prev => ({
                ...prev,
                [dayToGenerate.dayNumber]: finalSlides,
            }));
            setPresentation(prev => ({
                title: isStandalonePlanUnitDeck ? planUnitPresentationTitle : (prev?.title ?? lessonBlueprint.mainTitle),
                slides: isStandalonePlanUnitDeck ? finalSlides : [...(prev?.slides ?? []), ...finalSlides]
            }));
            await setCachedGeneration(cacheKey, finalSlides);

            setLessonBlueprint(prev => {
                if (!prev) return null;
                const newDays = [...prev.days];
                newDays[dayIndex].generationStatus = 'done';
                return {...prev, days: newDays};
            });

            setCurrentSlide(slideIndexOfNewDay);
            await finishLoadingProgress(setLoadingProgress);
            setAppStep('presenting');
            shouldRollbackGeneration = false;
            return;
        }

        const dailySlides = assertSlidesGenerated(
            await generateK12SlidesForDay(dayToGenerate, lessonBlueprint, content, DEFAULT_LESSON_FORMAT, language),
            `${unitLabel} ${dayToGenerate.dayNumber}`
        );
        
        setLoadingMessage(t.presentation.loadingTables);
        const slidesWithTables = await processSlidesForTables(dailySlides);
        
        const finalSlides = assertSlidesGenerated(
            await processSlidesForImages(slidesWithTables, language, { imageCacheScope, imageSemanticScope }),
            `${unitLabel} ${dayToGenerate.dayNumber}`
        );

        setGeneratedPlanUnitSlidesByDay(prev => ({
            ...prev,
            [dayToGenerate.dayNumber]: finalSlides,
        }));
        setPresentation(prev => ({
            title: isStandalonePlanUnitDeck ? planUnitPresentationTitle : (prev?.title ?? lessonBlueprint.mainTitle),
            slides: isStandalonePlanUnitDeck ? finalSlides : [...(prev?.slides ?? []), ...finalSlides]
        }));
        await setCachedGeneration(cacheKey, finalSlides);
        
        setLessonBlueprint(prev => {
            if (!prev) return null;
            const newDays = [...prev.days];
            newDays[dayIndex].generationStatus = 'done';
            return {...prev, days: newDays};
        });

        setCurrentSlide(slideIndexOfNewDay);
        await finishLoadingProgress(setLoadingProgress);
        setAppStep('presenting');
        shouldRollbackGeneration = false;

    } catch (e) {
        if (shouldRollbackGeneration) {
            decrementCount('generations');
        }
        handleApiError(e);
        setLessonBlueprint(prev => {
            if (!prev) return null;
            const newDays = [...prev.days];
            newDays[dayIndex].generationStatus = 'pending';
            return {...prev, days: newDays};
        });
    } finally {
        setIsLoading(false);
        setLoadingProgress(null);
    }
  }, [lessonBlueprint, dllContent, topicContext, theme, presentation, language, t, adminGenerationLimitBypassed, tryIncrementCount, decrementCount, refreshSlidesWithCachedImages]);

  const handleGenerateAllDailySlides = useCallback(async () => {
    if (!lessonBlueprint || isLoading) return;
    if (shouldUseStandalonePlanUnitDeck(lessonBlueprint)) return;

    for (let dayIndex = 0; dayIndex < lessonBlueprint.days.length; dayIndex += 1) {
      if (lessonBlueprint.days[dayIndex].generationStatus !== 'done') {
        await handleGenerateDailySlides(dayIndex);
      }
    }
  }, [lessonBlueprint, isLoading, handleGenerateDailySlides]);

  const handleViewGeneratedPlanUnit = useCallback((dayIndex: number) => {
    if (!lessonBlueprint) return;
    const day = lessonBlueprint.days[dayIndex];
    if (!day) return;
    const slides = generatedPlanUnitSlidesByDay[day.dayNumber];
    if (!slides || slides.length === 0) return;

    setPresentation({
      title: shouldUseStandalonePlanUnitDeck(lessonBlueprint)
        ? buildPlanUnitPresentationTitle(lessonBlueprint, day)
        : lessonBlueprint.mainTitle,
      slides,
    });
    setCurrentSlide(0);
    setAppStep('presenting');
  }, [generatedPlanUnitSlidesByDay, lessonBlueprint]);

  const handleNextSlide = useCallback(() => {
    if (presentation && currentSlide < presentation.slides.length - 1) {
      setTransitionDirection('next');
      setCurrentSlide(prev => prev + 1);
    }
  }, [presentation, currentSlide]);

  const handlePrevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setTransitionDirection('prev');
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);
  
  useEffect(() => {
    if (appStep !== 'presenting' || !presentation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            handleNextSlide();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlePrevSlide();
        } else if (e.key === 'Escape') {
            setIsFullScreen(false);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appStep, presentation, handleNextSlide, handlePrevSlide]);
  
  const handleUpdateSpeakerNotes = (newNotes: string) => {
    if (!presentation) return;
    const updatedSlides = [...presentation.slides];
    updatedSlides[currentSlide] = { ...updatedSlides[currentSlide], speakerNotes: newNotes };
    setPresentation({ ...presentation, slides: updatedSlides });
  };

  const handleUpdateImageOverlays = useCallback((slideIndex: number, overlays: ImageOverlayLabel[]) => {
    setPresentation(prev => {
      if (!prev) return null;
      const updatedSlides = [...prev.slides];
      updatedSlides[slideIndex] = {
        ...updatedSlides[slideIndex],
        imageOverlays: overlays,
      };
      return { ...prev, slides: updatedSlides };
    });
  }, []);

  const handleReset = () => {
    setPresentation(null);
    setLessonBlueprint(null);
    setGeneratedPlanUnitSlidesByDay({});
    setDllContent('');
    setFileName(null);
    setCurrentSlide(0);
    setError(null);
    setTopicContext('');
    setObjectivesContext('');
    setAppStep('input');
    setIsFullScreen(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  
  const readFile = async (file: File) => {
    const fileExtension = ('.' + file.name.split('.').pop()?.toLowerCase()) || '';
    const validExtensions = ['.txt', '.md', '.pdf', '.docx'];

    if (!validExtensions.includes(fileExtension)) {
        setError(t.presentation.errorFileUpload);
        return;
    }

    setLoadingDuration(5);
    setLoadingMessage('Reading your document...');
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
        let text = '';
        if (fileExtension === '.pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = await loadPdfJs();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = extractStructuredPdfPageText(content.items);
                text += `\n\n--- Page ${i} ---\n${pageText}`;
            }
            if (!text.trim()) {
                text = getKnownScannedPdfFallbackText(file, pdf.numPages);
            }
        } else if (fileExtension === '.docx') {
            const arrayBuffer = await file.arrayBuffer();
            const mammoth = (await import('mammoth')).default;
            const result = await mammoth.convertToHtml(
                { arrayBuffer },
                { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) }
            );
            text = htmlToStructuredText(result.value);

            if (!text.trim()) {
                const fallback = await mammoth.extractRawText({ arrayBuffer });
                text = fallback.value;
            }

            if (!text.trim()) {
                text = await extractAltChunkDocxText(arrayBuffer);
            }
        } else {
            text = await file.text();
        }
        if (!text.trim()) {
            setError(t.presentation.errorFileNoText.replace('{fileName}', file.name));
            setFileName(null);
            setDllContent('');
            return;
        }
        const inferredLanguage = inferUploadedLessonLanguage(text, file.name);
        if (inferredLanguage && inferredLanguage !== language) {
            setLanguage(inferredLanguage);
        }
        setDllContent(text);
    } catch (err) {
        console.error("Error parsing file:", err);
        setError(t.presentation.errorFileRead.replace('{fileName}', file.name));
        setFileName(null);
        setDllContent('');
    } finally {
        setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const clearFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDllContent('');
    setFileName(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const rasterizeSvgForPptx = useCallback(async (svgDataUrl: string): Promise<string> => {
    const image = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load SVG for PPTX export.'));
    });
    image.src = svgDataUrl;
    await imageLoaded;

    const canvas = document.createElement('canvas');
    canvas.width = PPTX_EXPORT_IMAGE_W;
    canvas.height = PPTX_EXPORT_IMAGE_H;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable for PPTX image export.');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }, []);

  const loadCanvasImage = useCallback(async (imageUrl: string): Promise<HTMLImageElement> => {
    const image = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load image for canvas processing.'));
    });
    image.src = imageUrl;
    await imageLoaded;
    return image;
  }, []);

  const applySayunaWatermarkToImageData = useCallback(async (
    imageData: string,
    watermarkData: string,
    fit: 'cover' | 'contain' = 'cover',
    outputFormat: PptxExportImageFormat = 'image/png',
  ): Promise<string> => {
    const [baseImage, watermarkImage] = await Promise.all([
      loadCanvasImage(imageData),
      loadCanvasImage(watermarkData),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = PPTX_EXPORT_IMAGE_W;
    canvas.height = PPTX_EXPORT_IMAGE_H;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable for image watermarking.');
    }

    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const baseW = Math.max(1, baseImage.naturalWidth || baseImage.width);
    const baseH = Math.max(1, baseImage.naturalHeight || baseImage.height);
    const imageScale = fit === 'contain'
      ? Math.min(canvas.width / baseW, canvas.height / baseH)
      : Math.max(canvas.width / baseW, canvas.height / baseH);
    const drawW = baseW * imageScale;
    const drawH = baseH * imageScale;

    context.drawImage(
      baseImage,
      (canvas.width - drawW) / 2,
      (canvas.height - drawH) / 2,
      drawW,
      drawH,
    );

    const watermarkW = Math.round(canvas.width * SAYUNA_WATERMARK_WIDTH_RATIO);
    const watermarkH = Math.round(watermarkW * ((watermarkImage.naturalHeight || watermarkImage.height) / (watermarkImage.naturalWidth || watermarkImage.width)));
    const margin = Math.round(canvas.width * SAYUNA_WATERMARK_MARGIN_RATIO);

    context.globalAlpha = SAYUNA_WATERMARK_OPACITY;
    context.drawImage(
      watermarkImage,
      canvas.width - watermarkW - margin,
      canvas.height - watermarkH - margin,
      watermarkW,
      watermarkH,
    );
    context.globalAlpha = 1;

    return outputFormat === 'image/jpeg'
      ? canvas.toDataURL(outputFormat, PPTX_EXPORT_JPEG_QUALITY)
      : canvas.toDataURL(outputFormat);
  }, [loadCanvasImage]);

  const resolveImageForPptx = useCallback(async (imageUrl: string | undefined): Promise<string | null> => {
    if (!imageUrl) return null;
    if (NON_EXPORTABLE_IMAGE_STATES.has(imageUrl)) return null;
    if (imageUrl.startsWith('data:')) {
      return imageUrl.startsWith('data:image/svg+xml')
        ? rasterizeSvgForPptx(imageUrl)
        : imageUrl;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;

      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return null;
      const isSvg = blob.type.includes('svg') || imageUrl.split('?')[0].toLowerCase().endsWith('.svg');

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to convert image blob to data URL'));
        reader.readAsDataURL(blob);
      });

      return isSvg ? await rasterizeSvgForPptx(dataUrl) : dataUrl;
    } catch (error) {
      console.warn('Failed to resolve image for PPTX export:', error);
      return null;
    }
  }, [rasterizeSvgForPptx]);

  const handleExportAsPPTX = useCallback(async () => {
    if (!presentation) return;

    setError(null);
    setIsExporting(true);
    setExportMessage(t.presentation.exportingMessage);
    const exportStartedAt = performance.now();
    try {
        const PptxGenJS = (await import('pptxgenjs')).default;
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        pptx.author = 'SAYUNA AI Presentation Maker';
        pptx.title = presentation.title;

        const computedStyle = getComputedStyle(document.body);
        const backgroundColor = computedStyle.getPropertyValue('--bg-surface').trim().replace('#', '');
        const brandColor = computedStyle.getPropertyValue('--brand').trim().replace('#', '');
        const textColor = computedStyle.getPropertyValue('--text-primary').trim().replace('#', '');
        const watermarkImageData = await resolveImageForPptx(SAYUNA_IMAGE_WATERMARK_LOGO_URL);
        const resolvedImageCache = new Map<string, Promise<string | null>>();
        const watermarkedImageCache = new Map<string, Promise<string>>();
        let resolvedImageCacheHits = 0;
        let watermarkedImageCacheHits = 0;
        let imageResolveMs = 0;
        let watermarkMs = 0;

        const resolveImageForCurrentExport = (imageUrl: string | undefined): Promise<string | null> => {
            const cacheKey = imageUrl || '';
            if (!cacheKey) return Promise.resolve(null);

            const cached = resolvedImageCache.get(cacheKey);
            if (cached) {
                resolvedImageCacheHits++;
                return cached;
            }

            const startedAt = performance.now();
            const imagePromise = resolveImageForPptx(imageUrl)
                .finally(() => {
                    imageResolveMs += performance.now() - startedAt;
                });
            resolvedImageCache.set(cacheKey, imagePromise);
            return imagePromise;
        };

        const applyWatermarkForCurrentExport = (
            cacheKey: string,
            imageData: string,
            fit: 'cover' | 'contain',
            outputFormat: PptxExportImageFormat,
        ): Promise<string> => {
            const cached = watermarkedImageCache.get(cacheKey);
            if (cached) {
                watermarkedImageCacheHits++;
                return cached;
            }

            const startedAt = performance.now();
            const watermarkedImagePromise = applySayunaWatermarkToImageData(imageData, watermarkImageData || '', fit, outputFormat)
                .finally(() => {
                    watermarkMs += performance.now() - startedAt;
                });
            watermarkedImageCache.set(cacheKey, watermarkedImagePromise);
            return watermarkedImagePromise;
        };

        for (let i = 0; i < presentation.slides.length; i++) {
            setExportMessage(t.presentation.exportingSlideMessage.replace('{current}', (i + 1).toString()).replace('{total}', presentation.slides.length.toString()));
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const slideData = presentation.slides[i];
            const slide = pptx.addSlide({ masterName: 'BLANK' });
            slide.background = { color: backgroundColor };
            
            const hasImage = !!slideData.imageUrl && !NON_EXPORTABLE_IMAGE_STATES.has(slideData.imageUrl);
            const hasContent = slideData.content && slideData.content.length > 0 && slideData.content.some(c => c.trim() !== '');
            
            let contentForPptx: any[] = [];
            if (hasContent) {
                contentForPptx = slideData.content.flatMap(point => {
                    if (!point.trim()) return [];

                    const textObjects = point.split(/(\*\*.*?\*\*)/g).filter(Boolean).flatMap(part => {
                        const isBold = part.startsWith('**') && part.endsWith('**');
                        const content = isBold ? part.slice(2, -2) : part;

                        const processedParts = processTextForPptx(content);

                        return processedParts.map(p => {
                            const baseOptions: any = {
                                fontFace: 'Poppins',
                                bold: isBold,
                                color: isBold ? brandColor : textColor,
                            };
                            if (p.sub) {
                                baseOptions.subscript = true;
                            }
                            return {
                                text: p.text,
                                options: baseOptions
                            };
                        });
                    });

                    if (textObjects.length > 0) {
                        textObjects[0].options = {
                            ...textObjects[0].options,
                            bullet: !/^[A-E0-9]+\./.test(point.trim()),
                        };
                        textObjects[textObjects.length - 1].options = {
                            ...textObjects[textObjects.length - 1].options,
                            breakLine: true,
                        };
                    }
                    return textObjects;
                });

                if (contentForPptx.length > 0 && contentForPptx[contentForPptx.length - 1].options) {
                    delete contentForPptx[contentForPptx.length - 1].options.breakLine;
                }
            }

            if (hasImage) {
                const isEvidenceLayout = slideData.visualLayout === 'evidence';
                const imageX = isEvidenceLayout ? PPTX_EVIDENCE_IMAGE_X : PPTX_IMAGE_X;
                const imageY = isEvidenceLayout ? PPTX_EVIDENCE_IMAGE_Y : PPTX_IMAGE_Y;
                const imageW = isEvidenceLayout ? PPTX_EVIDENCE_IMAGE_W : PPTX_IMAGE_W;
                const imageH = isEvidenceLayout ? PPTX_EVIDENCE_IMAGE_H : PPTX_IMAGE_H;
                let imageAdded = false;
                try {
                    const imageData = await resolveImageForCurrentExport(slideData.imageUrl);
                    if (!imageData) {
                        throw new Error('No valid image data available for export.');
                    }
                    let exportImageData = imageData;
                    if (watermarkImageData) {
                        try {
                            const imageFit = slideData.imageStyle === 'diagram' || slideData.imageStyle === 'infographic'
                                || slideData.visualLayout === 'evidence'
                                ? 'contain'
                                : 'cover';
                            const outputFormat = getPptxExportImageFormat(slideData);
                            const watermarkedCacheKey = `${slideData.imageUrl || ''}|${imageFit}|${outputFormat}`;
                            exportImageData = await applyWatermarkForCurrentExport(watermarkedCacheKey, imageData, imageFit, outputFormat);
                        } catch (watermarkError) {
                            console.warn('Failed to apply Sayuna watermark to image:', watermarkError);
                        }
                    }
                    slide.addImage({ data: exportImageData, x: imageX, y: imageY, w: imageW, h: imageH });
                    imageAdded = true;
                    if (slideData.imageAttribution?.provider === 'pexels') {
                        const attributionText = slideData.imageAttribution.label || 'Photo provided by Pexels';
                        slide.addText(attributionText, {
                            x: imageX + 0.08,
                            y: imageY + imageH - 0.24,
                            w: Math.min(imageW - 0.16, 3.8),
                            h: 0.16,
                            fontSize: 5.5,
                            color: 'FFFFFF',
                            fontFace: 'Poppins',
                            fit: 'shrink',
                            fill: { color: '111827', transparency: 25 },
                            margin: 0.03,
                            ...(slideData.imageAttribution.sourceUrl
                                ? { hyperlink: { url: slideData.imageAttribution.sourceUrl } }
                                : {}),
                        } as any);
                    }
                } catch (e) {
                    console.error("Failed to add image to PPTX slide:", e);
                    slide.addText('Image could not be loaded.', { x: imageX, y: imageY, w: imageW, h: imageH, color: 'FF0000', align: 'center', valign: 'middle' });
                }

                if (imageAdded) {
                    const overlays = (slideData.imageOverlays || []).filter(o => o.text && o.text.trim().length > 0);
                    try {
                        for (const overlay of overlays) {
                            const normalizedX = Math.max(0, Math.min(100, overlay.x));
                            const normalizedY = Math.max(0, Math.min(100, overlay.y));
                            const labelText = overlay.text.trim();
                            const uiFontSize = Math.max(12, Math.min(42, Math.round(overlay.fontSize ?? 16)));
                            const pptFontSize = Math.max(10, Math.min(28, Math.round(uiFontSize * 0.78)));
                            const labelW = Math.max(1.0, Math.min(2.8, (0.058 * (uiFontSize / 16) * labelText.length) + 0.72));
                            const labelH = Math.max(0.36, Math.min(0.9, 0.12 + (uiFontSize * 0.018)));

                            let boxX = imageX + (normalizedX / 100) * imageW - (labelW / 2);
                            let boxY = imageY + (normalizedY / 100) * imageH - (labelH / 2);
                            boxX = Math.max(imageX, Math.min(imageX + imageW - labelW, boxX));
                            boxY = Math.max(imageY, Math.min(imageY + imageH - labelH, boxY));

                            slide.addText(labelText, {
                                x: boxX,
                                y: boxY,
                                w: labelW,
                                h: labelH,
                                fontSize: pptFontSize,
                                bold: true,
                                color: 'FFFFFF',
                                align: 'center',
                                valign: 'middle',
                                fit: 'shrink',
                                fontFace: 'Poppins',
                                fill: { color: '111827', transparency: 20 },
                                line: { color: '111827', transparency: 100 },
                            });
                        }
                    } catch (overlayError) {
                        console.warn('Failed to add image labels to PPTX slide:', overlayError);
                    }
                }

                const titleFontSize = slideData.title.length > 58
                    ? 25
                    : slideData.title.length > 38
                        ? 28
                        : 31;

                slide.addText(slideData.title, {
                    x: PPTX_MARGIN_X, y: PPTX_TITLE_Y, w: PPTX_SLIDE_W - (PPTX_MARGIN_X * 2), h: 0.72,
                    fontSize: titleFontSize, bold: true, color: brandColor,
                    valign: 'top', fontFace: 'Poppins', fit: 'shrink'
                });

                if(hasContent) {
                    const bulletCount = slideData.content.filter((point) => point.trim()).length;
                    const isEvidenceLayout = slideData.visualLayout === 'evidence';
                    const contentFontSize = isEvidenceLayout
                        ? (bulletCount > 5 ? 20 : bulletCount > 4 ? 22 : 24)
                        : (bulletCount > 5 ? 18 : bulletCount > 3 ? 20 : 22);
                    slide.addText(contentForPptx, {
                        x: isEvidenceLayout ? PPTX_EVIDENCE_CONTENT_X : PPTX_CONTENT_X,
                        y: isEvidenceLayout ? PPTX_EVIDENCE_CONTENT_Y : PPTX_CONTENT_Y,
                        w: isEvidenceLayout ? PPTX_EVIDENCE_CONTENT_W : PPTX_CONTENT_W,
                        h: isEvidenceLayout ? PPTX_EVIDENCE_CONTENT_H : PPTX_CONTENT_H,
                        color: textColor, valign: 'top', fontSize: contentFontSize,
                        lineSpacing: isEvidenceLayout
                            ? (contentFontSize >= 24 ? 31 : contentFontSize >= 22 ? 29 : 27)
                            : (contentFontSize >= 22 ? 30 : contentFontSize === 20 ? 27 : 25),
                        fit: 'shrink',
                        breakLine: false,
                    });
                }
            } else {
                const titleFontSize = slideData.title.length > 58
                    ? 27
                    : slideData.title.length > 38
                        ? 30
                        : 34;
                slide.addText(slideData.title, {
                    x: PPTX_MARGIN_X, y: 0.42, w: PPTX_SLIDE_W - (PPTX_MARGIN_X * 2), h: 0.86,
                    fontSize: titleFontSize, bold: true, color: brandColor,
                    valign: 'top', fontFace: 'Poppins', fit: 'shrink'
                });

                if (hasContent) {
                    const bulletCount = slideData.content.filter((point) => point.trim()).length;
                    const contentFontSize = bulletCount > 6 ? 22 : bulletCount > 4 ? 24 : 26;
                    slide.addText(contentForPptx, {
                        x: PPTX_TEXT_ONLY_X, y: PPTX_TEXT_ONLY_Y, w: PPTX_TEXT_ONLY_W, h: PPTX_TEXT_ONLY_H,
                        color: textColor, valign: 'top',
                        fontSize: contentFontSize,
                        lineSpacing: contentFontSize >= 26 ? 35 : contentFontSize === 24 ? 32 : 29,
                        fit: 'shrink',
                        breakLine: false,
                    });
                }
            }

            const imageCreditNote = slideData.imageAttribution?.provider === 'pexels'
                ? [
                    'Image credit:',
                    slideData.imageAttribution.label || 'Photo provided by Pexels',
                    slideData.imageAttribution.sourceUrl || '',
                  ].filter(Boolean).join(' ')
                : '';
            const slideNotes = [slideData.speakerNotes, imageCreditNote].filter(Boolean).join('\n\n');
            if (slideNotes) {
                slide.addNotes(slideNotes);
            }
        }
        const safeTitle = presentation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const writeStartedAt = performance.now();
        await pptx.writeFile({ fileName: `${safeTitle}_presentation.pptx` });
        console.info('PPTX export completed.', {
            slideCount: presentation.slides.length,
            resolvedImageCount: resolvedImageCache.size,
            resolvedImageCacheHits,
            watermarkedImageCount: watermarkedImageCache.size,
            watermarkedImageCacheHits,
            imageResolveMs: Math.round(imageResolveMs),
            watermarkMs: Math.round(watermarkMs),
            writeMs: Math.round(performance.now() - writeStartedAt),
            totalMs: Math.round(performance.now() - exportStartedAt),
        });
    } catch (error) {
        console.error("Failed to generate PPTX:", error);
        setError(t.presentation.errorPptx);
    } finally {
        setIsExporting(false);
        setExportMessage('');
    }
  }, [presentation, lessonBlueprint, theme, t, resolveImageForPptx, applySayunaWatermarkToImageData]);

  const handleRegenerateImage = useCallback(async (slideIndex: number, newPrompt: string) => {
    const trimmedPrompt = newPrompt.trim();
    const originalSlide = presentation?.slides[slideIndex];
    if (!originalSlide || !trimmedPrompt) return;
    if (regeneratingImageIndexesRef.current.has(slideIndex)) return;

    regeneratingImageIndexesRef.current.add(slideIndex);
    const originalSlideStyle = originalSlide.imageStyle;
    setPresentation(prev => {
        if (!prev) return null;
        const updatedSlides = [...prev.slides];
        const currentSlide = updatedSlides[slideIndex];
        if (!currentSlide) return prev;
        updatedSlides[slideIndex] = { ...currentSlide, imagePrompt: trimmedPrompt, imageUrl: 'loading', imageAttribution: undefined };
        return { ...prev, slides: updatedSlides };
    });

    try {
        if (IMAGES_DISABLED) {
            setPresentation(prev => {
                if (!prev) return null;
                const finalSlides = [...prev.slides];
                const currentSlide = finalSlides[slideIndex];
                if (!currentSlide) return prev;
                finalSlides[slideIndex] = { ...currentSlide, imageUrl: IMAGE_SKIPPED_PLACEHOLDER, imagePrompt: trimmedPrompt, imageAttribution: undefined };
                return { ...prev, slides: finalSlides };
            });
            return;
        }

        try {
            const cachedImage = await getCachedImageResultForPrompt(
                trimmedPrompt,
                originalSlideStyle,
                language,
                originalSlide.imageCacheId,
                originalSlide.imageSemanticCacheId,
                originalSlide.imageSemanticMetadata
            );
            if (cachedImage?.dataUrl && !isRejectedScienceParticleModelImageUrl(cachedImage.dataUrl, originalSlide.imageSemanticMetadata)) {
                setPresentation(prev => {
                    if (!prev) return null;
                    const finalSlides = [...prev.slides];
                    const currentSlide = finalSlides[slideIndex];
                    if (!currentSlide) return prev;
                    finalSlides[slideIndex] = {
                        ...currentSlide,
                        imageUrl: cachedImage.dataUrl,
                        imagePrompt: trimmedPrompt,
                        imageAttribution: cachedImage.attribution,
                    };
                    return { ...prev, slides: finalSlides };
                });
                return;
            }
            if (cachedImage?.dataUrl) {
                console.warn('Ignored a cached particle-model image because it was an old SVG/static visual.');
            }
        } catch {
            console.warn('Failed to check saved slide image before regeneration.');
        }

        const allowPaidImageGeneration = adminImageLimitBypassed || canGenerateImage;
        const generateImage = () => generateImageResultFromPrompt(
            trimmedPrompt,
            originalSlideStyle,
            language,
            originalSlide.imageCacheId,
            originalSlide.imageSemanticCacheId,
            originalSlide.imageSemanticMetadata,
            allowPaidImageGeneration
        );
        const imageResult = allowPaidImageGeneration
            ? await runQueuedPaidImageGeneration(generateImage)
            : await generateImage();
        if (imageResult.dataUrl && !adminImageLimitBypassed && imageResult.provider !== 'pexels' && imageResult.cache?.hit !== true) {
            incrementCount('images');
        }
        setPresentation(prev => {
            if (!prev) return null;
            const finalSlides = [...prev.slides];
            const currentSlide = finalSlides[slideIndex];
            if (!currentSlide) return prev;
            finalSlides[slideIndex] = {
                ...currentSlide,
                imageUrl: imageResult.dataUrl || USER_IMAGE_LIMIT_PLACEHOLDER,
                imagePrompt: trimmedPrompt,
                imageAttribution: imageResult.attribution,
            };
            return { ...prev, slides: finalSlides };
        });
    } catch (err) {
        console.error('Image regeneration failed.');
        if (!isImageProviderLimitError(err)) {
            handleApiError(err);
        } else {
            setError(IMAGE_LIMIT_ERROR);
        }
        setPresentation(prev => {
            if (!prev) return null;
            const finalSlides = [...prev.slides];
            const currentSlide = finalSlides[slideIndex];
            if (!currentSlide) return prev;
            finalSlides[slideIndex] = {
                ...currentSlide,
                imageUrl: isImageProviderLimitError(err) ? PROVIDER_IMAGE_LIMIT_PLACEHOLDER : 'error',
                imagePrompt: trimmedPrompt,
                imageAttribution: undefined,
            };
            return { ...prev, slides: finalSlides };
        });
    } finally {
        regeneratingImageIndexesRef.current.delete(slideIndex);
    }
  }, [presentation, adminImageLimitBypassed, canGenerateImage, incrementCount, limits.images, t, language]);

  const handleUploadImage = useCallback((slideIndex: number, file: File) => {
    const slideForCache = presentation?.slides[slideIndex];
    const promptForCache = slideForCache
        ? ((slideForCache.imagePrompt || buildFallbackImagePrompt(slideForCache)).trim())
        : '';
    const styleForCache = slideForCache?.imageStyle;
    const imageCacheId = slideForCache?.imageCacheId;
    const imageSemanticCacheId = slideForCache?.imageSemanticCacheId;
    const imageSemanticMetadata = slideForCache?.imageSemanticMetadata;
    prepareUploadedImageForCache(file).then((imageUrl) => {
        setError(null);
        setPresentation(prev => {
            if (!prev) return null;
            const updatedSlides = [...prev.slides];
            const currentSlide = updatedSlides[slideIndex];
            if (!currentSlide) return prev;
            const retainedPrompt = promptForCache || currentSlide.imagePrompt || buildFallbackImagePrompt(currentSlide);
            updatedSlides[slideIndex] = { ...currentSlide, imageUrl, imagePrompt: retainedPrompt, imageAttribution: undefined };
            return { ...prev, slides: updatedSlides };
        });

        if (promptForCache) {
            cacheUploadedImageForPrompt(promptForCache, imageUrl, styleForCache, language, imageCacheId, imageSemanticCacheId, imageSemanticMetadata).then((cached) => {
                if (!cached) {
                    console.warn('Uploaded image was not saved for reuse.');
                    setError('The uploaded image was applied to this slide, but it could not be saved for reuse. Please try a smaller PNG, JPEG, or WebP file.');
                }
            }).catch(() => {
                console.warn('Failed to save uploaded slide image for reuse.');
                setError('The uploaded image was applied to this slide, but it could not be saved for reuse. Please try a smaller PNG, JPEG, or WebP file.');
            });
        }
    }).catch(() => {
        setError('The uploaded image could not be read. Please use a PNG, JPEG, or WebP file.');
    });
  }, [buildFallbackImagePrompt, language, presentation]);

  const renderWeeklyBlueprintView = () => {
    if (!lessonBlueprint) return null;
    const unitLabel = getPlanUnitLabel(lessonBlueprint);
    const usesStandalonePlanUnitDeck = shouldUseStandalonePlanUnitDeck(lessonBlueprint);
    const hasGeneratedPlanUnit = lessonBlueprint.days.some((day) => day.generationStatus === 'done');
    const hasCompletedAllPlanUnits = lessonBlueprint.days.every((day) => day.generationStatus === 'done');
    const isGeneratingPlanUnit = lessonBlueprint.days.some((day) => day.generationStatus === 'loading');
    const pendingPlanUnitCount = lessonBlueprint.days.filter((day) => day.generationStatus !== 'done').length;
    const generationSlotsAvailable = adminGenerationLimitBypassed
      ? Number.POSITIVE_INFINITY
      : Math.max(0, limits.generations - generations);
    const canGenerateAllPlanUnits = pendingPlanUnitCount > 0
      && pendingPlanUnitCount <= generationSlotsAvailable
      && !isGeneratingPlanUnit
      && !usesStandalonePlanUnitDeck;

    return (
        <div className="w-full max-w-5xl bg-surface p-8 md:p-10 rounded-3xl shadow-neumorphic-outset border border-themed animate-fade-in">
            <div className="mb-7">
              <p className="text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2">{t.presentation.lessonWorkflowLabel}</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-primary mb-2">{t.presentation.lessonBlueprintTitle}</h2>
              <p className="text-secondary text-base md:text-lg">{lessonBlueprint.mainTitle}</p>
            </div>

            <div className="space-y-4">
                {lessonBlueprint.days.map((day, index) => (
                    <div key={day.dayNumber} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-themed shadow-neumorphic-inset">
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center" style={{backgroundColor: 'var(--brand-light)'}}>
                                <span className="text-xs font-semibold text-brand">{unitLabel.toUpperCase()}</span>
                                <span className="text-xl font-bold text-brand">{day.dayNumber}</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-primary">{day.title}</h3>
                                <p className="text-base text-secondary">{day.focus}</p>
                            </div>
                        </div>
                        
                        {day.generationStatus === 'pending' && (
                            <button 
                                onClick={() => handleGenerateDailySlides(index)} 
                                disabled={!adminGenerationLimitBypassed && !canGenerate}
                                className="px-4 py-2 text-sm font-semibold bg-brand text-brand-contrast rounded-lg shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t.presentation.generateSlidesButton}
                            </button>
                        )}
                        {day.generationStatus === 'loading' && (
                            <div className="px-4 py-2 text-sm font-semibold text-secondary flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-t-2 border-themed border-t-brand rounded-full animate-spin"></div>
                                {t.presentation.generatingButton}
                            </div>
                        )}
                        {day.generationStatus === 'done' && (
                            <div className="flex items-center gap-2">
                                <div className="px-4 py-2 text-sm font-semibold text-emerald-500 flex items-center gap-2">
                                    <CheckCircle2Icon className="w-5 h-5" />
                                    {t.presentation.completeStatus}
                                </div>
                                {usesStandalonePlanUnitDeck && generatedPlanUnitSlidesByDay[day.dayNumber]?.length > 0 && (
                                    <button
                                        onClick={() => handleViewGeneratedPlanUnit(index)}
                                        className="px-4 py-2 text-sm font-semibold bg-brand text-brand-contrast rounded-lg shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all"
                                    >
                                        {t.presentation.viewSessionButton}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
             <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
                <button onClick={handleReset} className="px-6 py-3 text-base font-semibold bg-surface text-secondary rounded-lg shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all">
                    <RefreshCwIcon className="w-5 h-5 inline-block mr-2" />
                    {t.presentation.startOverButton}
                </button>
                {!usesStandalonePlanUnitDeck && (
                    <button
                        onClick={handleGenerateAllDailySlides}
                        disabled={!canGenerateAllPlanUnits}
                        className="px-6 py-3 text-base font-semibold bg-surface text-primary rounded-lg shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MagicWandIcon className="w-5 h-5 inline-block mr-2" />
                        {t.presentation.generateAllSlidesButton}
                    </button>
                )}
                 <button 
                    onClick={() => { setCurrentSlide(0); setAppStep('presenting'); }} 
                    disabled={!presentation || presentation.slides.length === 0 || !hasGeneratedPlanUnit}
                    className="px-6 py-3 text-base font-semibold bg-brand text-brand-contrast rounded-lg shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                     {t.presentation.viewPresentationButton}
                     <ArrowRightIcon className="w-5 h-5 inline-block ml-2" />
                </button>
            </div>
            {!hasCompletedAllPlanUnits && (
                <p className="mt-4 text-center text-sm text-secondary">
                    {usesStandalonePlanUnitDeck ? t.presentation.standaloneSessionExportNote : t.presentation.partialPlanExportNote}
                </p>
            )}
        </div>
    );
  };

  const renderPresentationView = () => {
    if (!presentation || !presentation.slides || presentation.slides.length === 0) {
      return (
        <div className="w-full max-w-4xl bg-surface p-8 rounded-2xl shadow-neumorphic-outset animate-fade-in text-center">
            <h2 className="text-2xl font-bold text-primary mb-4">Presentation Error</h2>
            <p className="text-secondary mb-6">No slides were generated. This might be due to an issue with the input provided or a temporary error.</p>
            <button onClick={handleReset} className="px-6 py-3 text-base font-semibold bg-surface text-secondary rounded-lg shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all">
                <RefreshCwIcon className="w-5 h-5 inline-block mr-2" />
                {t.presentation.startOverButton}
            </button>
        </div>
      );
    }

    const isPlanViewAvailable = lessonBlueprint !== null;
    const { slides } = presentation;

    if (!slides[currentSlide]) {
        console.error("Error: currentSlide index is out of bounds. Resetting to 0.");
        setCurrentSlide(0);
        return null;
    }

    return (
      <div className={`w-full max-w-7xl mx-auto flex flex-col items-center gap-6 ${isFullScreen ? 'p-0' : 'p-2 md:p-4'}`}>
        <div className={`w-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-[100] bg-surface' : 'relative'}`}>
            <div className={`relative w-full ${isFullScreen ? 'h-full flex items-center justify-center' : ''}`}>
                <div className={`${isFullScreen ? 'w-[95vw] h-auto' : 'w-full'}`}>
                    <SlideComponent 
                        slide={slides[currentSlide]} 
                        slideIndex={currentSlide} 
                        direction={transitionDirection}
                        onRegenerateImage={handleRegenerateImage}
                        onUploadImage={handleUploadImage}
                        onUpdateImageOverlays={handleUpdateImageOverlays}
                    />
                </div>
            </div>
        </div>

        {!isFullScreen && (
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-surface rounded-3xl shadow-neumorphic-outset border border-themed p-5 flex flex-col justify-between">
                    <div className="mb-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-secondary font-bold">Presenter Console</p>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-semibold text-secondary bg-surface px-3 py-1.5 rounded-full shadow-neumorphic-inset">
                            Slide {currentSlide + 1} / {slides.length}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className="p-3 bg-surface text-primary rounded-lg shadow-neumorphic-outset-sm hover:shadow-neumorphic-inset transition-all"
                                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                            >
                                {isFullScreen ? <MinimizeIcon className="w-5 h-5" /> : <MaximizeIcon className="w-5 h-5" />}
                            </button>
                             <button 
                                onClick={handleExportAsPPTX} 
                                disabled={isExporting}
                                className="p-3 bg-surface text-primary rounded-lg shadow-neumorphic-outset-sm hover:shadow-neumorphic-inset transition-all" 
                                title={t.presentation.exportButton}
                            >
                                {isExporting ? <div className="w-5 h-5 border-2 border-t-2 border-themed border-t-brand rounded-full animate-spin"></div> : <DownloadIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-center items-center gap-4 py-2">
                        <button onClick={handlePrevSlide} disabled={currentSlide === 0} className="p-4 bg-surface text-primary rounded-full shadow-neumorphic-outset-sm hover:shadow-neumorphic-inset transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <button onClick={handleNextSlide} disabled={currentSlide === slides.length - 1} className="p-4 bg-brand text-brand-contrast rounded-full shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            <ArrowRightIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex justify-center items-center gap-2 mt-4 text-xs text-secondary">{isExporting && exportMessage}</div>
                    {error && (
                        <p className="mt-3 text-xs text-center text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                    
                    <div className="mt-4 border-t border-themed pt-4 flex gap-2">
                       {isPlanViewAvailable && (
                           <button onClick={() => setAppStep('planning')} className="flex-1 px-4 py-2 text-sm font-semibold bg-surface text-secondary rounded-lg shadow-neumorphic-outset-sm hover:shadow-neumorphic-inset transition-all">
                               <ArrowLeftIcon className="w-4 h-4 inline-block mr-1" />
                               {t.presentation.backToPlanButton}
                           </button>
                       )}
                       <button onClick={handleReset} className="flex-1 px-4 py-2 text-sm font-semibold bg-surface text-secondary rounded-lg shadow-neumorphic-outset-sm hover:shadow-neumorphic-inset transition-all">
                           <RefreshCwIcon className="w-4 h-4 inline-block mr-1" />
                           {t.presentation.startOverButton}
                       </button>
                    </div>
                </div>

                <div className="md:col-span-2 bg-surface rounded-3xl shadow-neumorphic-outset border border-themed p-6 md:p-7">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-extrabold text-primary">{t.presentation.speakerNotesTitle}</h3>
                      <span className="text-xs uppercase tracking-[0.15em] text-secondary font-bold">Live Notes</span>
                    </div>
                    <textarea
                        value={slides[currentSlide].speakerNotes}
                        onChange={(e) => handleUpdateSpeakerNotes(e.target.value)}
                        placeholder={t.presentation.speakerNotesPlaceholder}
                        className="w-full h-48 p-4 text-base bg-surface rounded-lg shadow-neumorphic-inset outline-none focus:ring-2 focus:ring-brand transition-all custom-scrollbar"
                    />
                </div>
            </div>
        )}
      </div>
    );
  };

  const renderInputView = () => {
    const shouldRequireGenerationQuota = !adminGenerationLimitBypassed && (teachingLevel === 'College' || depEdMode === 'single');

    const renderDepEdInputs = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Side: Weekly Plan */}
          <div 
              onClick={() => setDepEdMode('weekly')}
              className={`p-6 rounded-3xl transition-all cursor-pointer border border-themed ${depEdMode === 'weekly' ? 'shadow-neumorphic-outset bg-brand-light' : 'shadow-neumorphic-inset opacity-80 hover:opacity-100'}`}
          >
              <div className="flex items-center gap-3 mb-4">
                  <CalendarDaysIcon className="w-7 h-7 text-brand" />
                  <h3 className="text-xl font-bold text-primary">{t.main.weeklyPlanButton}</h3>
              </div>
              <p className="text-sm text-secondary mb-4">{t.main.weeklyPlanDescription}</p>
              
              {/* Content input for weekly */}
              <div className="flex flex-col items-center">
                  <div 
                      onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                      onClick={handleUploadClick}
                      className="w-full h-28 p-2 border-2 border-dashed border-themed rounded-2xl flex flex-col items-center justify-center text-center transition-all bg-surface hover:bg-opacity-80 shadow-neumorphic-inset"
                  >
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".docx,.pdf,.txt,.md" />
                      {fileName && depEdMode === 'weekly' ? (
                          <>
                              <FileTextIcon className="w-8 h-8 text-brand mb-1"/>
                              <p className="font-semibold text-primary text-sm">{fileName}</p>
                              <button onClick={clearFile} className="mt-1 text-xs text-red-500 hover:underline">{t.main.removeFile}</button>
                          </>
                      ) : (
                          <>
                              <UploadCloudIcon className="w-8 h-8 text-secondary mb-1"/>
                              <p className="font-semibold text-primary text-sm">{t.main.uploadPrompt}</p>
                          </>
                      )}
                  </div>
                  <div className="w-full max-w-sm mx-auto flex items-center my-4">
                      <div className="flex-grow h-px bg-themed"></div>
                      <span className="flex-shrink-0 bg-transparent px-2 text-xs font-semibold text-secondary uppercase">{t.main.or}</span>
                      <div className="flex-grow h-px bg-themed"></div>
                  </div>
                   <textarea value={topicContext} onChange={(e) => setTopicContext(e.target.value)}
                      placeholder={t.main.topicPlaceholderWeekly}
                      rows={3}
                      className="w-full p-3 text-sm bg-surface rounded-2xl shadow-neumorphic-inset outline-none focus:ring-2 focus:ring-brand transition-all custom-scrollbar"
                  />
              </div>
          </div>
          
          {/* Right Side: Single Lesson */}
          <div 
              onClick={() => setDepEdMode('single')}
              className={`p-6 rounded-3xl transition-all cursor-pointer border border-themed ${depEdMode === 'single' ? 'shadow-neumorphic-outset bg-brand-light' : 'shadow-neumorphic-inset opacity-80 hover:opacity-100'}`}
          >
              <div className="flex items-center gap-3 mb-4">
                  <PresentationIcon className="w-7 h-7 text-brand" />
                  <h3 className="text-xl font-bold text-primary">{t.main.singleLessonButton}</h3>
              </div>
              <p className="text-sm text-secondary mb-4">{t.main.singleLessonDescription}</p>
              
              {/* Content input for single */}
               <div className="flex flex-col items-center">
                  <div 
                      onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                      onClick={handleUploadClick}
                      className="w-full h-28 p-2 border-2 border-dashed border-themed rounded-2xl flex flex-col items-center justify-center text-center transition-all bg-surface hover:bg-opacity-80 shadow-neumorphic-inset"
                  >
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".docx,.pdf,.txt,.md" />
                      {fileName && depEdMode === 'single' ? (
                          <>
                              <FileTextIcon className="w-8 h-8 text-brand mb-1"/>
                              <p className="font-semibold text-primary text-sm">{fileName}</p>
                              <button onClick={clearFile} className="mt-1 text-xs text-red-500 hover:underline">{t.main.removeFile}</button>
                          </>
                      ) : (
                          <>
                              <UploadCloudIcon className="w-8 h-8 text-secondary mb-1"/>
                              <p className="font-semibold text-primary text-sm">{t.main.uploadPrompt}</p>
                          </>
                      )}
                  </div>
                  <div className="w-full max-w-sm mx-auto flex items-center my-4">
                      <div className="flex-grow h-px bg-themed"></div>
                      <span className="flex-shrink-0 bg-transparent px-2 text-xs font-semibold text-secondary uppercase">{t.main.or}</span>
                      <div className="flex-grow h-px bg-themed"></div>
                  </div>
                   <textarea value={topicContext} onChange={(e) => setTopicContext(e.target.value)}
                      placeholder={t.main.topicPlaceholder}
                      rows={3}
                      className="w-full p-3 text-sm bg-surface rounded-2xl shadow-neumorphic-inset outline-none focus:ring-2 focus:ring-brand transition-all custom-scrollbar"
                  />
              </div>
          </div>
      </div>
    );


    return (
    <div className="w-full max-w-6xl mx-auto">
        <div className="bg-surface rounded-3xl shadow-neumorphic-outset border border-themed p-7 md:p-10 mb-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, var(--brand-light) 0%, transparent 70%)' }} />
            <div className="absolute -bottom-20 -left-10 w-52 h-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 70%)' }} />
            <div className="relative">
                <p className="text-xs uppercase tracking-[0.22em] text-secondary font-bold mb-3">Neumorphic Studio</p>
                <h1 className="text-4xl md:text-5xl font-extrabold text-primary leading-tight">
                    {t.app.mainTitle} <span className="text-brand">{t.app.presentationMaker}</span>
                </h1>
                <p className="text-base md:text-lg text-secondary mt-4 max-w-3xl">{t.app.tagline}</p>
                <div className="flex flex-wrap gap-3 mt-6">
                    <div className="px-4 py-2 rounded-2xl bg-surface shadow-neumorphic-inset text-sm font-semibold text-secondary">
                        Generations: <span className="text-brand">{adminGenerationLimitBypassed ? 'Unlimited' : `${generations}/${limits.generations}`}</span>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-surface shadow-neumorphic-inset text-sm font-semibold text-secondary">
                        Images: <span className="text-brand">{adminImageLimitBypassed ? 'Unlimited' : `${images}/${limits.images}`}</span>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-surface shadow-neumorphic-inset text-sm font-semibold text-secondary">
                        Active Mode: <span className="text-brand">{teachingLevel}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-surface p-8 md:p-10 rounded-3xl shadow-neumorphic-outset border border-themed">
            {/* Step 1: Teaching Level */}
            <div>
                <h3 className="text-xl font-semibold text-primary mb-5 text-center">{t.main.selectLevel}</h3>
                <div className="flex justify-center gap-4 flex-wrap">
                    <button 
                        onClick={() => setTeachingLevel('K-12')} 
                        className={`px-6 py-3 rounded-2xl font-semibold transition-all w-64 flex flex-col items-center gap-2 border border-themed ${teachingLevel === 'K-12' ? 'bg-brand text-brand-contrast shadow-neumorphic-outset' : 'bg-surface text-secondary hover:shadow-neumorphic-outset-sm'}`}
                    >
                        <BookOpenIcon className="w-6 h-6"/>
                        <span>{t.main.k12Button}</span>
                    </button>
                    <button 
                        onClick={() => setTeachingLevel('College')}
                        className={`px-6 py-3 rounded-2xl font-semibold transition-all w-64 flex flex-col items-center gap-2 border border-themed ${teachingLevel === 'College' ? 'bg-brand text-brand-contrast shadow-neumorphic-outset' : 'bg-surface text-secondary hover:shadow-neumorphic-outset-sm'}`}
                    >
                        <GraduationCapIcon className="w-6 h-6"/>
                        <span>{t.main.collegeButton}</span>
                    </button>
                </div>
            </div>
            
            {/* Step 2: Input Content */}
            <div className="mt-8 pt-8 border-t border-themed">
                {teachingLevel === 'K-12' && (
                  <div className="animate-fade-in">
                      <h3 className="text-xl font-semibold text-primary mb-5 text-center">{t.main.selectPlanType}</h3>
                      {renderDepEdInputs()}
                  </div>
                )}
                
                {teachingLevel === 'College' && (
                  <div className="animate-fade-in">
                      <h3 className="text-xl font-semibold text-primary mb-5 text-center">{t.main.collegeInputTitle}</h3>
                       <div className="max-w-xl mx-auto space-y-4">
                          <div>
                              <label className="block text-base font-medium text-secondary mb-2">{t.main.collegeTopic}</label>
                              <input type="text" value={topicContext} onChange={(e) => setTopicContext(e.target.value)}
                                  placeholder={t.main.collegeTopicPlaceholder}
                                  className="w-full px-4 py-3 text-lg rounded-2xl neumorphic-input outline-none focus:ring-2 focus:ring-brand transition"
                              />
                          </div>
                          <div>
                              <label className="block text-base font-medium text-secondary mb-2">{t.main.collegeObjectives}</label>
                              <textarea value={objectivesContext} onChange={(e) => setObjectivesContext(e.target.value)}
                                  placeholder={t.main.collegeObjectivesPlaceholder}
                                  rows={4}
                                  className="w-full px-4 py-3 text-base rounded-2xl neumorphic-input outline-none focus:ring-2 focus:ring-brand transition"
                              />
                          </div>
                      </div>
                  </div>
                )}
                
                {error && <p className="text-center text-red-500 bg-red-500/10 p-3 rounded-lg mt-6">{error}</p>}

                {/* Generate Button */}
                <div className="mt-8 text-center">
                    <button onClick={handleCreatePlan} disabled={isLoading || (!dllContent && !topicContext && !objectivesContext) || (shouldRequireGenerationQuota && !canGenerate)}
                        className="px-8 py-4 text-xl font-semibold rounded-3xl neumorphic-btn-primary"
                    >
                        <MagicWandIcon className="w-6 h-6 inline-block mr-3" />
                         {teachingLevel === 'College' ? t.main.generateCollegeButton : (depEdMode === 'weekly' ? t.main.generateK12Button : t.main.generateSingleLessonButton)}
                    </button>
                    {shouldRequireGenerationQuota && !canGenerate && <p className="text-center text-yellow-600 dark:text-yellow-400 mt-4">{t.presentation.errorGenerationLimit}</p>}
                </div>
            </div>
        </div>
    </div>
  );
  }

  const renderContent = () => {
    if (authState === 'checking') {
      return <Loader customMessage="Verifying secure access..." estimatedDuration={6} progress={null} />;
    }

    if (authState === 'unauthorized') {
      return (
        <div className="w-full max-w-2xl bg-surface p-8 md:p-10 rounded-3xl shadow-neumorphic-outset border border-themed animate-fade-in text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-primary mb-4">Secure Access Required</h2>
          <p className="text-secondary text-base md:text-lg mb-6">
            {authError || GENERIC_AUTH_ERROR}
          </p>
          {appStoreUrl && (
            <button
              onClick={() => {
                try {
                  if (window.top) {
                    window.top.location.href = appStoreUrl;
                    return;
                  }
                } catch (_) {}
                window.location.href = appStoreUrl;
              }}
              className="inline-flex items-center px-5 py-3 rounded-xl bg-brand text-brand-contrast font-semibold shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all"
            >
              Return to Account
            </button>
          )}
        </div>
      );
    }

    if (isLoading) return <Loader customMessage={loadingMessage} estimatedDuration={loadingDuration} progress={loadingProgress} />;
    
    switch(appStep) {
        case 'input': return renderInputView();
        case 'planning': return renderWeeklyBlueprintView();
        case 'presenting': return renderPresentationView();
        default: return renderInputView();
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 left-[-8rem] w-[28rem] h-[28rem] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 68%)' }} />
          <div className="absolute top-1/4 right-[-9rem] w-[26rem] h-[26rem] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--brand-light) 0%, transparent 72%)' }} />
          <div className="absolute bottom-[-8rem] left-1/3 w-[22rem] h-[22rem] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, var(--shadow-dark) 0%, transparent 72%)' }} />
        </div>
        <Header usage={{ generations, images, limits, generationLimitBypassed: adminGenerationLimitBypassed, imageLimitBypassed: adminImageLimitBypassed }} />
        <main className="w-full max-w-7xl mx-auto px-4 md:px-6 pb-6 pt-6 flex justify-center items-start flex-grow relative z-10">
          {renderContent()}
        </main>
        <Footer />
    </div>
  );
};

export default App;
