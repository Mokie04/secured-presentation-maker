
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Presentation, LessonBlueprint, DayPlan, Slide, ImageOverlayLabel, ImageSemanticMetadata } from './types';
import { IMAGES_DISABLED, cacheUploadedImageForPrompt, createK12LessonBlueprint, generateK12SlidesForDay, generateImageFromPrompt, generateCollegeLectureSlides, generateK12SingleLessonSlides, getCachedImageForPrompt } from './services/geminiService';
import SlideComponent from './components/Slide';
import Loader from './components/Loader';
import { MagicWandIcon, ArrowLeftIcon, ArrowRightIcon, RefreshCwIcon, BookOpenIcon, UploadCloudIcon, DownloadIcon, FileTextIcon, XIcon, MaximizeIcon, MinimizeIcon, CheckCircle2Icon, CalendarDaysIcon, PresentationIcon, GraduationCapIcon } from './components/IconComponents';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import html2canvas from 'html2canvas';
import { useTheme } from './contexts/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';
import { useLanguage } from './contexts/LanguageContext';
import { translations } from './lib/translations';
import { useUsageTracker } from './useUsageTracker';
import { buildGenerationCacheKey, getCachedGeneration, setCachedGeneration } from './lib/generationCache';
import { getReusableK12CompleteLessonPlanSeed, getReusableK12PlanUnitSlidesSeed } from './lib/reusableLessonSeeds';


type AppStep = 'input' | 'planning' | 'presenting';
type TransitionDirection = 'next' | 'prev' | null;
type TeachingLevel = 'K-12' | 'College';
type DepEdMode = 'weekly' | 'single';
type AuthState = 'checking' | 'authorized' | 'unauthorized';
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

let sessionCheckCacheKey: string | null = null;
let sessionCheckCachePromise: Promise<SessionCheckResult> | null = null;

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
const GENERATION_CACHE_VERSION = 'lesson-plan-cache-v3';
const IMAGE_SEMANTIC_CACHE_VERSION = 'image-semantic-cache-v3';
const CACHE_HIT_LOADING_DELAY_MS = 1400;
const ADMIN_IMAGE_BATCH_LIMIT = 8;
const CURATED_STATIC_IMAGE_BASE_PATH_BY_COLLECTION: Record<string, string> = {
  'values-education': '/curated-images/values-education',
  'science-particle-model': '/curated-images/science/particle-model',
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

type CachedLessonPlan = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const normalizeExtractedText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const tableToStructuredText = (table: HTMLTableElement, tableIndex: number): string => {
  const rows = Array.from(table.rows)
    .map((row) => Array.from(row.cells).map((cell) => normalizeExtractedText(cell.textContent || '')))
    .filter((cells) => cells.some(Boolean));

  if (rows.length === 0) return '';

  return [
    `Table ${tableIndex + 1}:`,
    ...rows.map((cells) => `| ${cells.join(' | ')} |`),
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

const getPlanUnitLabel = (blueprint: LessonBlueprint | null): string => (
  blueprint?.planUnitLabel?.trim() || DEFAULT_PLAN_UNIT_LABEL
);

const waitForCacheHitLoading = (): Promise<void> => (
  new Promise((resolve) => setTimeout(resolve, CACHE_HIT_LOADING_DELAY_MS))
);

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

const getCuratedStaticImageCollection = (metadata: ImageSemanticMetadata | undefined): string | undefined => {
  if (!metadata) return undefined;
  if (isValuesEducationSemanticSubject(metadata.subject || metadata.topic)) return 'values-education';
  if (isScienceParticleModelSemanticSubject(metadata)) return 'science-particle-model';
  return undefined;
};

const getCuratedStaticImageUrl = (metadata: ImageSemanticMetadata | undefined): string | undefined => {
  if (!metadata) return undefined;
  const collection = getCuratedStaticImageCollection(metadata);
  if (!collection) return undefined;

  const template = slugifyImageSemanticText(metadata.slideTemplate || metadata.visualRole || 'content');
  const collectionMap = CURATED_STATIC_IMAGE_BY_COLLECTION_TEMPLATE[collection];
  const fileName = collectionMap?.[template] || collectionMap?.content;
  const basePath = CURATED_STATIC_IMAGE_BASE_PATH_BY_COLLECTION[collection];
  return fileName && basePath ? `${basePath}/${fileName}` : undefined;
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
    visualRole: getSlideImageRole(slide),
    slideTemplate: getSlideImageTemplateKey(slide),
    semanticAnchor: getSlideImageSemanticAnchor(slide, prompt),
    language: semanticLanguage,
    style: slide.imageStyle || 'illustration',
  };
};

const buildK12ImageSemanticScope = (blueprint: Pick<LessonBlueprint, 'mainTitle' | 'subject' | 'gradeLevel' | 'learningCompetency'>) => ({
  level: 'k12',
  format: DEFAULT_LESSON_FORMAT,
  subject: blueprint.subject,
  topic: blueprint.mainTitle,
  gradeLevel: blueprint.gradeLevel,
  learningCompetency: blueprint.learningCompetency,
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

const hasAdminImageBypass = (user: SessionUser | null): boolean => {
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
const IMAGE_LIMIT_ERROR = 'Image generation is temporarily unavailable because a service limit was reached. A placeholder was added so the slide can still be used.';
const IMAGE_LIMIT_BATCH_ERROR = 'Image generation is temporarily unavailable because a service limit was reached. Placeholder slides were added so the deck can still be used.';

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
  const { language } = useLanguage();
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
  const adminImageLimitBypassed = hasAdminImageBypass(sessionUser);

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
  
  // Safely set worker path for pdf.js after mount
  useEffect(() => {
    try {
      if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
      }
    } catch (e) {
      console.warn("Failed to set PDF worker source", e);
    }
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

    return buildGenerationCacheKey('image-semantic', [
      IMAGE_SEMANTIC_CACHE_VERSION,
      semanticMetadata.level || 'general',
      semanticMetadata.subject || 'general',
      semanticMetadata.topic || 'general',
      semanticMetadata.gradeBand || semanticMetadata.gradeLevel || 'all-grades',
      semanticLanguage,
      template,
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
    const slidesWithImages = [];
    let rateLimitWasHit = false;
    
    const imagesToGenerate = slidesWithPrompts.filter((s) => buildImagePromptCandidates(s).length > 0 && !s.imageUrl);
    const totalImagesToAttempt = imagesToGenerate.length;
    let imagesAttemptedCounter = 0;
    
    const imagesLeftToday = Math.max(0, limits.images - images);
    const imageAttemptsAllowed = adminImageLimitBypassed
      ? Math.min(totalImagesToAttempt, ADMIN_IMAGE_BATCH_LIMIT)
      : Math.min(totalImagesToAttempt, imagesLeftToday);
    const totalImagesThatCanBeGenerated = imageAttemptsAllowed;
    let imageAttemptsUsed = 0;

    if (!muteProgress) {
      if (totalImagesThatCanBeGenerated > 0) {
          setLoadingProgress(0);
      } else if (totalImagesToAttempt > 0) {
          console.warn("Daily image limit reached or no prompts found. Skipping image generation.");
      }
    }

    for (let slideIndex = 0; slideIndex < slidesWithPrompts.length; slideIndex += 1) {
        const slide = slidesWithPrompts[slideIndex];
        let newSlide = await attachImageCacheIds(slide, slideIndex);
        const promptCandidates = buildImagePromptCandidates(newSlide);
        if (!newSlide.imageUrl && promptCandidates.length > 0) {
            const promptForGeneration = promptCandidates[0];
            if (!newSlide.imagePrompt || !newSlide.imagePrompt.trim()) {
                newSlide.imagePrompt = promptForGeneration;
            }

            const curatedStaticImageUrl = getCuratedStaticImageUrl(newSlide.imageSemanticMetadata);
            if (curatedStaticImageUrl) {
                newSlide.imageUrl = curatedStaticImageUrl;
                slidesWithImages.push(newSlide);
                continue;
            }

            try {
                const cachedImageUrl = await getCachedImageForPrompt(
                  promptForGeneration,
                  newSlide.imageStyle,
                  language,
                  newSlide.imageCacheId,
                  newSlide.imageSemanticCacheId,
                  newSlide.imageSemanticMetadata
                );
                if (cachedImageUrl) {
                    newSlide.imageUrl = cachedImageUrl;
                    slidesWithImages.push(newSlide);
                    continue;
                }
            } catch {
                console.warn('Failed to check saved slide image before generation.');
            }

            // Simplify: always attempt AI image once, skip open-source fetch to reduce latency and irrelevance.
            if (imageAttemptsUsed >= imageAttemptsAllowed) {
                newSlide.imageUrl = adminImageLimitBypassed ? IMAGE_SKIPPED_PLACEHOLDER : USER_IMAGE_LIMIT_PLACEHOLDER;
                slidesWithImages.push(newSlide);
                continue;
            }

            if (!adminImageLimitBypassed && !canGenerateImage) {
                newSlide.imageUrl = USER_IMAGE_LIMIT_PLACEHOLDER;
            } else if (rateLimitWasHit) {
                newSlide.imageUrl = PROVIDER_IMAGE_LIMIT_PLACEHOLDER;
            } else {
                imagesAttemptedCounter++;
                imageAttemptsUsed++;
                if (!muteProgress) {
                  setLoadingMessage(t.presentation.loadingImages.replace('{current}', imagesAttemptedCounter.toString()).replace('{total}', totalImagesThatCanBeGenerated.toString()));
                }
                
                if (!muteProgress && totalImagesThatCanBeGenerated > 0) {
                    const progress = (imagesAttemptedCounter / totalImagesThatCanBeGenerated) * 100;
                    setLoadingProgress(progress);
                }
                
                try {
                    const imageUrl = await generateImageFromPrompt(
                      promptForGeneration,
                      newSlide.imageStyle,
                      language,
                      newSlide.imageCacheId,
                      newSlide.imageSemanticCacheId,
                      newSlide.imageSemanticMetadata
                    );
                    newSlide.imageUrl = imageUrl;
                    if (!adminImageLimitBypassed) {
                        incrementCount('images');
                    }
                } catch (imgError) {
                    console.error('Image generation failed.');
                    if (isImageProviderLimitError(imgError)) {
                        rateLimitWasHit = true;
                        setError(IMAGE_LIMIT_BATCH_ERROR);
                        newSlide.imageUrl = PROVIDER_IMAGE_LIMIT_PLACEHOLDER;
                    } else {
                        handleApiError(imgError);
                        newSlide.imageUrl = 'error';
                    }
                }
            }
        }
        slidesWithImages.push(newSlide);
    }

    return slidesWithImages;
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
        };
        const prompt = (slide.imagePrompt || '').trim();
        if (!prompt || slide.imageStyle === 'none') {
            refreshedSlides.push(slide);
            continue;
        }

        const curatedStaticImageUrl = getCuratedStaticImageUrl(slide.imageSemanticMetadata);
        if (curatedStaticImageUrl) {
            refreshedSlides.push({ ...slide, imageUrl: curatedStaticImageUrl });
            continue;
        }

        try {
            const cachedImageUrl = await getCachedImageForPrompt(
              prompt,
              slide.imageStyle,
              refreshLanguage,
              slide.imageCacheId,
              slide.imageSemanticCacheId,
              slide.imageSemanticMetadata
            );
            refreshedSlides.push(cachedImageUrl ? { ...slide, imageUrl: cachedImageUrl } : slide);
        } catch {
            console.warn('Failed to refresh a saved slide image.');
            refreshedSlides.push(slide);
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
              await waitForCacheHitLoading();
              const refreshedSlides = await refreshSlidesWithCachedImages(cachedPresentation.slides, language, cacheKey, imageSemanticScope);
              setPresentation({ ...cachedPresentation, slides: refreshedSlides });
              setCurrentSlide(0);
              setAppStep('presenting');
              return;
            }

            const hasQuota = tryIncrementCount('generations');
            if (!hasQuota) {
              setIsLoading(false);
              setError(t.presentation.errorGenerationLimit);
              return;
            }
            shouldRollbackGeneration = true;
            const fullPresentation = await generateCollegeLectureSlides(topicContext, objectivesContext, language, (msg) => setLoadingMessage(msg));
            setLoadingMessage(t.presentation.loadingTables);
            const slidesWithTables = await processSlidesForTables(fullPresentation.slides);
            const finalSlides = await processSlidesForImages(slidesWithTables, language, { imageCacheScope: cacheKey, imageSemanticScope });
            const finalPresentation = { ...fullPresentation, slides: finalSlides };

            setPresentation(finalPresentation);
            await setCachedGeneration(cacheKey, finalPresentation);
            setCurrentSlide(0);
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
                  await waitForCacheHitLoading();
                  const refreshedSlides = await refreshSlidesWithCachedImages(cachedPresentation.slides, language, cacheKey, imageSemanticScope);
                  setPresentation({ ...cachedPresentation, slides: refreshedSlides });
                  setCurrentSlide(0);
                  setAppStep('presenting');
                  return;
                }

                const hasQuota = tryIncrementCount('generations');
                if (!hasQuota) {
                  setIsLoading(false);
                  setError(t.presentation.errorGenerationLimit);
                  return;
                }
                shouldRollbackGeneration = true;
                const fullPresentation = await generateK12SingleLessonSlides(content, DEFAULT_LESSON_FORMAT, language, (msg) => setLoadingMessage(msg));
                setLoadingMessage(t.presentation.loadingTables);
                const slidesWithTables = await processSlidesForTables(fullPresentation.slides);
                const finalSlides = await processSlidesForImages(slidesWithTables, language, { imageCacheScope: cacheKey, imageSemanticScope });
                const finalPresentation = { ...fullPresentation, slides: finalSlides };

                setPresentation(finalPresentation);
                await setCachedGeneration(cacheKey, finalPresentation);
                setCurrentSlide(0);
                setAppStep('presenting');
            }
            // DepEd Weekly Plan Flow (default)
            else if (depEdMode === 'weekly') {
                // No generation quota consumed for creating the weekly blueprint.
                setLoadingDuration(20);
                setLoadingMessage(t.presentation.loadingBlueprint);
                const cacheKey = await buildGenerationCacheKey('k12-lesson-plan', [
                  GENERATION_CACHE_VERSION,
                  content,
                  DEFAULT_LESSON_FORMAT,
                  language,
                ]);

                const reusablePlan = getReusableK12CompleteLessonPlanSeed(content, language);
                if (reusablePlan) {
                  const blueprintWithStatus = completeBlueprintStatus(reusablePlan.blueprint);
                  const imageSemanticScope = buildK12ImageSemanticScope(reusablePlan.blueprint);
                  const processedInitialSlides = await processSlidesForImages(
                    reusablePlan.initialPresentation.slides,
                    language,
                    { muteProgress: true, imageCacheScope: cacheKey, imageSemanticScope }
                  );
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

                  setCurrentSlide(0);
                  setAppStep('presenting');
                  return;
                }

                const cachedPlan = await getCachedGeneration<CachedLessonPlan>(cacheKey);
                if (cachedPlan) {
                  await waitForCacheHitLoading();
                  const imageSemanticScope = buildK12ImageSemanticScope(cachedPlan.blueprint);
                  const refreshedInitialSlides = await refreshSlidesWithCachedImages(cachedPlan.initialPresentation.slides, language, cacheKey, imageSemanticScope);
                  const shouldTreatAsComplete = cachedPlan.blueprint.days.every((day) => day.generationStatus === 'done')
                    && refreshedInitialSlides.length > 2;
                  setLessonBlueprint(shouldTreatAsComplete ? completeBlueprintStatus(cachedPlan.blueprint) : resetBlueprintStatus(cachedPlan.blueprint));
                  setPresentation({ ...cachedPlan.initialPresentation, slides: refreshedInitialSlides });
                  setAppStep(shouldTreatAsComplete ? 'presenting' : 'planning');
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
  }, [dllContent, topicContext, objectivesContext, teachingLevel, depEdMode, language, t, tryIncrementCount, decrementCount, refreshSlidesWithCachedImages]);

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
        const imageSemanticScope = buildK12ImageSemanticScope(lessonBlueprint);

        setLoadingMessage(
          t.presentation.loadingDailySlides
            .replace('{unitLabel}', unitLabel)
            .replace('{dayNumber}', dayToGenerate.dayNumber.toString())
        );

        const cachedSlides = await getCachedGeneration<Slide[]>(cacheKey);
        const slideIndexOfNewDay = presentation?.slides.length ?? 0;

        if (cachedSlides) {
            await waitForCacheHitLoading();
            const refreshedSlides = await refreshSlidesWithCachedImages(cachedSlides, language, imageCacheScope, imageSemanticScope);
            setPresentation(prev => ({
                title: prev?.title ?? lessonBlueprint.mainTitle,
                slides: [...(prev?.slides ?? []), ...refreshedSlides]
            }));

            setLessonBlueprint(prev => {
                if (!prev) return null;
                const newDays = [...prev.days];
                newDays[dayIndex].generationStatus = 'done';
                return {...prev, days: newDays};
            });

            setCurrentSlide(slideIndexOfNewDay);
            setAppStep('presenting');
            shouldRollbackGeneration = false;
            return;
        }

        const reusableSlides = getReusableK12PlanUnitSlidesSeed(content, dayToGenerate.dayNumber, language);
        if (reusableSlides) {
            setLoadingMessage(t.presentation.loadingTables);
            const slidesWithTables = await processSlidesForTables(reusableSlides);
            const finalSlides = await processSlidesForImages(slidesWithTables, language, { imageCacheScope, imageSemanticScope });

            setPresentation(prev => ({
                title: prev?.title ?? lessonBlueprint.mainTitle,
                slides: [...(prev?.slides ?? []), ...finalSlides]
            }));
            await setCachedGeneration(cacheKey, finalSlides);

            setLessonBlueprint(prev => {
                if (!prev) return null;
                const newDays = [...prev.days];
                newDays[dayIndex].generationStatus = 'done';
                return {...prev, days: newDays};
            });

            setCurrentSlide(slideIndexOfNewDay);
            setAppStep('presenting');
            return;
        }

        const hasQuota = tryIncrementCount('generations');
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

        shouldRollbackGeneration = true;
        const dailySlides = await generateK12SlidesForDay(dayToGenerate, lessonBlueprint, content, DEFAULT_LESSON_FORMAT, language);
        
        setLoadingMessage(t.presentation.loadingTables);
        const slidesWithTables = await processSlidesForTables(dailySlides);
        
        const finalSlides = await processSlidesForImages(slidesWithTables, language, { imageCacheScope, imageSemanticScope });

        setPresentation(prev => ({
            title: prev?.title ?? lessonBlueprint.mainTitle,
            slides: [...(prev?.slides ?? []), ...finalSlides]
        }));
        await setCachedGeneration(cacheKey, finalSlides);
        
        setLessonBlueprint(prev => {
            if (!prev) return null;
            const newDays = [...prev.days];
            newDays[dayIndex].generationStatus = 'done';
            return {...prev, days: newDays};
        });

        setCurrentSlide(slideIndexOfNewDay);
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
  }, [lessonBlueprint, dllContent, topicContext, theme, presentation, language, t, tryIncrementCount, decrementCount, refreshSlidesWithCachedImages]);

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
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => ('str' in item ? item.str : '')).join(' ');
                text += pageText + '\n';
            }
        } else if (fileExtension === '.docx') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml(
                { arrayBuffer },
                { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) }
            );
            text = htmlToStructuredText(result.value);

            if (!text.trim()) {
                const fallback = await mammoth.extractRawText({ arrayBuffer });
                text = fallback.value;
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
    canvas.width = 1600;
    canvas.height = 900;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable for PPTX image export.');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }, []);

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
    setIsExporting(true);
    setExportMessage(t.presentation.exportingMessage);
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
                try { 
                    const imageData = await resolveImageForPptx(slideData.imageUrl);
                    if (!imageData) {
                        throw new Error('No valid image data available for export.');
                    }
                    const imageX = 0.55;
                    const imageY = 1.2;
                    const imageW = 3.55;
                    const imageH = 4.0;
                    slide.addImage({ data: imageData, x: imageX, y: imageY, w: imageW, h: imageH });

                    const overlays = (slideData.imageOverlays || []).filter(o => o.text && o.text.trim().length > 0);
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

                        slide.addShape(PptxGenJS.ShapeType.roundRect, {
                            x: boxX,
                            y: boxY,
                            w: labelW,
                            h: labelH,
                            fill: { color: '111827', transparency: 20 },
                            line: { color: '111827', transparency: 100 },
                        });
                        slide.addText(labelText, {
                            x: boxX + 0.03,
                            y: boxY + 0.01,
                            w: Math.max(0.1, labelW - 0.06),
                            h: Math.max(0.1, labelH - 0.02),
                            fontSize: pptFontSize,
                            bold: true,
                            color: 'FFFFFF',
                            align: 'center',
                            valign: 'middle',
                            fit: 'shrink',
                            fontFace: 'Poppins',
                        });
                    }
                } catch (e) { 
                    console.error("Failed to add image to PPTX slide:", e);
                    slide.addText('Image could not be loaded.', { x: 0.55, y: 1.2, w: 3.55, h: 4.0, color: 'FF0000', align: 'center', valign: 'middle' });
                }

                const titleFontSize = slideData.title.length > 58
                    ? 22
                    : slideData.title.length > 38
                        ? 26
                        : 30;

                slide.addText(slideData.title, {
                    x: 0.55, y: 0.35, w: 9.0, h: 0.75,
                    fontSize: titleFontSize, bold: true, color: brandColor,
                    valign: 'top', fontFace: 'Poppins', fit: 'shrink'
                });

                if(hasContent) {
                    const contentFontSize = contentForPptx.length > 10 ? 16 : 18;
                    slide.addText(contentForPptx, {
                        x: 4.45, y: 1.35, w: 5.05, h: 3.75,
                        color: textColor, valign: 'top', fontSize: contentFontSize,
                        lineSpacing: contentFontSize === 16 ? 22 : 25, fit: 'shrink'
                    });
                }
            } else {
                const titleFontSize = slideData.title.length > 58
                    ? 24
                    : slideData.title.length > 38
                        ? 28
                        : 32;
                slide.addText(slideData.title, {
                    x: 0.55, y: 0.45, w: 8.9, h: 0.9,
                    fontSize: titleFontSize, bold: true, color: brandColor,
                    valign: 'top', fontFace: 'Poppins', fit: 'shrink'
                });

                if (hasContent) {
                    const contentFontSize = contentForPptx.length > 10 ? 19 : 21;
                    slide.addText(contentForPptx, {
                        x: 0.75, y: 1.55, w: 8.5, h: 3.7,
                        color: textColor, valign: 'top',
                        fontSize: contentFontSize, lineSpacing: contentFontSize === 19 ? 26 : 30, fit: 'shrink'
                    });
                }
            }

            if (slideData.speakerNotes) {
                slide.addNotes(slideData.speakerNotes);
            }
        }
        const safeTitle = presentation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        await pptx.writeFile({ fileName: `${safeTitle}_presentation.pptx` });
    } catch (error) {
        console.error("Failed to generate PPTX:", error);
        setError(t.presentation.errorPptx);
    } finally {
        setIsExporting(false);
        setExportMessage('');
    }
  }, [presentation, theme, t, resolveImageForPptx]);

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
        updatedSlides[slideIndex] = { ...currentSlide, imagePrompt: trimmedPrompt, imageUrl: 'loading' };
        return { ...prev, slides: updatedSlides };
    });

    try {
        if (IMAGES_DISABLED) {
            setPresentation(prev => {
                if (!prev) return null;
                const finalSlides = [...prev.slides];
                const currentSlide = finalSlides[slideIndex];
                if (!currentSlide) return prev;
                finalSlides[slideIndex] = { ...currentSlide, imageUrl: IMAGE_SKIPPED_PLACEHOLDER, imagePrompt: trimmedPrompt };
                return { ...prev, slides: finalSlides };
            });
            return;
        }

        if (!adminImageLimitBypassed && !canGenerateImage) {
            alert(t.presentation.errorImageLimit.replace('{limit}', limits.images.toString()));
            setPresentation(prev => {
                if (!prev) return null;
                const finalSlides = [...prev.slides];
                const currentSlide = finalSlides[slideIndex];
                if (!currentSlide) return prev;
                finalSlides[slideIndex] = { ...currentSlide, imageUrl: USER_IMAGE_LIMIT_PLACEHOLDER, imagePrompt: trimmedPrompt };
                return { ...prev, slides: finalSlides };
            });
            return;
        }

        const imageUrl = await generateImageFromPrompt(
            trimmedPrompt,
            originalSlideStyle,
            language,
            originalSlide.imageCacheId,
            originalSlide.imageSemanticCacheId,
            originalSlide.imageSemanticMetadata
        );
        if (!adminImageLimitBypassed) {
            incrementCount('images');
        }
        setPresentation(prev => {
            if (!prev) return null;
            const finalSlides = [...prev.slides];
            const currentSlide = finalSlides[slideIndex];
            if (!currentSlide) return prev;
            finalSlides[slideIndex] = { ...currentSlide, imageUrl: imageUrl || IMAGE_SKIPPED_PLACEHOLDER, imagePrompt: trimmedPrompt };
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
                imagePrompt: trimmedPrompt
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
    const reader = new FileReader();
    reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setPresentation(prev => {
            if (!prev) return null;
            const updatedSlides = [...prev.slides];
            const currentSlide = updatedSlides[slideIndex];
            if (!currentSlide) return prev;
            const retainedPrompt = promptForCache || currentSlide.imagePrompt || buildFallbackImagePrompt(currentSlide);
            updatedSlides[slideIndex] = { ...currentSlide, imageUrl, imagePrompt: retainedPrompt };
            return { ...prev, slides: updatedSlides };
        });

        if (promptForCache) {
            cacheUploadedImageForPrompt(promptForCache, imageUrl, styleForCache, language, imageCacheId, imageSemanticCacheId, imageSemanticMetadata).then((cached) => {
                if (!cached) {
                    console.warn('Uploaded image was not saved for reuse.');
                }
            }).catch(() => {
                console.warn('Failed to save uploaded slide image for reuse.');
            });
        }
    };
    reader.readAsDataURL(file);
  }, [buildFallbackImagePrompt, language, presentation]);

  const renderWeeklyBlueprintView = () => {
    if (!lessonBlueprint) return null;
    const unitLabel = getPlanUnitLabel(lessonBlueprint);

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
                                disabled={!canGenerate}
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
                            <div className="px-4 py-2 text-sm font-semibold text-emerald-500 flex items-center gap-2">
                                <CheckCircle2Icon className="w-5 h-5" />
                                {t.presentation.completeStatus}
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
                 <button 
                    onClick={() => { setCurrentSlide(0); setAppStep('presenting'); }} 
                    disabled={!presentation || presentation.slides.length === 0}
                    className="px-6 py-3 text-base font-semibold bg-brand text-brand-contrast rounded-lg shadow-neumorphic-outset hover:shadow-neumorphic-inset transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                     {t.presentation.viewPresentationButton}
                     <ArrowRightIcon className="w-5 h-5 inline-block ml-2" />
                </button>
            </div>
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
    const shouldRequireGenerationQuota = teachingLevel === 'College' || (teachingLevel === 'K-12' && depEdMode === 'single');

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
                        Generations: <span className="text-brand">{generations}/{limits.generations}</span>
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
        <Header usage={{ generations, images, limits, imageLimitBypassed: adminImageLimitBypassed }} />
        <main className="w-full max-w-7xl mx-auto px-4 md:px-6 pb-6 pt-6 flex justify-center items-start flex-grow relative z-10">
          {renderContent()}
        </main>
        <Footer />
    </div>
  );
};

export default App;
