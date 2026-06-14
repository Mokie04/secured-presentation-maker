
import { Presentation, Slide, LessonBlueprint, DayPlan, ImageStyle, ImageSemanticMetadata, ImageAttribution } from '../types';
import { K12_ADAPTIVE_PRESENTATION_STANDARD } from '../lib/presentationStandards';
import { buildFinalImagePrompt } from '../lib/imagePrompting';

type ClientEnv = {
    VITE_GEMINI_PROXY_BASE_URL?: string;
    VITE_GEMINI_TEXT_MODEL?: string;
    VITE_GEMINI_IMAGE_MODEL?: string;
    VITE_DISABLE_IMAGES?: string;
};

const ENV = ((import.meta as unknown as { env?: ClientEnv }).env ?? {}) as ClientEnv;
const PROXY_FALLBACK_URL = '';

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
    return Array.from(
        new Set(
            values
                .map((value) => value?.trim())
                .filter((value): value is string => Boolean(value))
        )
    );
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (typeof value !== 'string') return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
}

// Prefer low-cost models first, with safe fallback.
const TEXT_MODELS = uniqueNonEmpty([
    ENV.VITE_GEMINI_TEXT_MODEL,
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
]);

const IMAGE_MODELS = uniqueNonEmpty([
    ENV.VITE_GEMINI_IMAGE_MODEL,
    // Use only models confirmed available on the account
    "models/gemini-2.5-flash-image",
    "models/imagen-4.0-fast-generate-001",
]);

export const IMAGES_DISABLED = parseBooleanEnv(ENV.VITE_DISABLE_IMAGES, false);

const JSON_SCHEMA = {
    OBJECT: "object",
    ARRAY: "array",
    STRING: "string",
    INTEGER: "integer",
} as const;

type GroundingChunk = {
    web?: {
        uri?: string;
        title?: string;
    };
};

type GeminiTextResponse = {
    text?: string;
    groundingChunks?: GroundingChunk[];
};

type GeminiImageResponse = {
    dataUrl?: string;
    error?: string;
    blockReason?: string;
    explanation?: string;
    provider?: string;
    attribution?: ImageAttribution;
    paidImageGenerationSkipped?: boolean;
    cache?: {
        hit: boolean;
        provider: string;
    };
    ok?: boolean;
};

export type ImagePromptResult = {
    dataUrl: string;
    provider?: string;
    attribution?: ImageAttribution;
    cache?: {
        hit: boolean;
        provider: string;
    };
};

type GeminiProxyRequest = {
    task: 'text' | 'image' | 'cacheImage' | 'cachedImage';
    model: string | string[];
    contents: unknown;
    config?: Record<string, unknown>;
};

function getProxyBaseUrl(): string {
    const normalizedEnv = (ENV.VITE_GEMINI_PROXY_BASE_URL || '').replace(/\/$/, '');
    if (normalizedEnv) return normalizedEnv;
    return PROXY_FALLBACK_URL;
}

type ProxyError = Error & {
    status?: number;
    code?: 'NETWORK_ERROR' | 'REQUEST_ERROR';
};

const NETWORK_REQUEST_ERROR = 'The request could not reach the service. Please check your connection and try again.';
const GENERIC_PROXY_ERROR = 'The request could not be completed. Please try again.';

function shouldRetryProxyError(status: number | undefined, message: string): boolean {
    const upperMessage = message.toUpperCase();
    if (upperMessage.includes('SPENDING CAP')) {
        return false;
    }

    return [429, 500, 502, 503, 504].includes(status || 0)
        || upperMessage.includes('UNAVAILABLE')
        || upperMessage.includes('HIGH DEMAND')
        || upperMessage.includes('TRY AGAIN LATER');
}

function toProxyError(error: unknown): ProxyError {
    const existingStatus = (error as { status?: unknown })?.status;
    const existingCode = (error as { code?: unknown })?.code;
    if (error instanceof Error && typeof existingStatus === 'number') {
        return error as ProxyError;
    }

    if (error instanceof TypeError) {
        const proxyError = new Error(NETWORK_REQUEST_ERROR) as ProxyError;
        proxyError.name = 'NetworkError';
        proxyError.code = 'NETWORK_ERROR';
        return proxyError;
    }

    const proxyError = new Error(error instanceof Error && error.message ? error.message : GENERIC_PROXY_ERROR) as ProxyError;
    proxyError.name = error instanceof Error && error.name ? error.name : 'RequestError';
    if (existingCode === 'NETWORK_ERROR' || existingCode === 'REQUEST_ERROR') {
        proxyError.code = existingCode;
    } else {
        proxyError.code = 'REQUEST_ERROR';
    }
    return proxyError;
}

function getRetryDelayMs(attempt: number): number {
    // Exponential backoff with jitter: 0.8s, 1.6s, 3.2s (+ jitter)
    const baseDelay = Math.min(3200, 800 * Math.pow(2, attempt - 1));
    const jitter = Math.floor(Math.random() * 350);
    return baseDelay + jitter;
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiProxy<T>(payload: GeminiProxyRequest): Promise<T> {
    const proxyUrl = `${getProxyBaseUrl()}/api/gemini`;

    const maxAttempts = payload.task === 'text' ? 3 : 1;
    let lastError: ProxyError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorMessage = typeof data?.error === 'string'
                    ? data.error
                    : `AI request failed with status ${response.status}.`;
                const error = new Error(errorMessage) as ProxyError;
                error.status = response.status;
                throw error;
            }

            return data as T;
        } catch (error) {
            const proxyError = toProxyError(error);
            lastError = proxyError;
            const retryable = proxyError.code === 'NETWORK_ERROR'
                || shouldRetryProxyError(proxyError.status, proxyError.message || '');
            const hasAttemptsLeft = attempt < maxAttempts;

            if (!retryable || !hasAttemptsLeft) {
                break;
            }

            await sleep(getRetryDelayMs(attempt));
        }
    }

    throw lastError || new Error('AI request failed.');
}

function parseJsonModelResponse<T>(text: string | undefined, label: string): T {
    const raw = (text ?? '').trim();
    if (!raw) {
        throw new Error(`The response was empty for ${label}.`);
    }

    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        console.error(`Failed to parse generated JSON for ${label}.`);
        throw error;
    }
}

function appendGroundingSources(slides: Slide[], groundingChunks?: GroundingChunk[]): void {
    if (!groundingChunks || groundingChunks.length === 0) {
        return;
    }

    const sourceContent = groundingChunks
        .map((chunk) => chunk.web)
        .filter((web): web is { uri: string; title: string } => Boolean(web?.uri && web?.title))
        .flatMap((web) => [`**${web.title}**`, web.uri]);

    if (sourceContent.length === 0) {
        return;
    }

    slides.push({
        title: "Sources",
        content: sourceContent,
        speakerNotes: "These are the web sources the AI consulted to generate the content for this presentation.",
        imagePrompt: "",
        imageStyle: "none",
    });
}

const normalizeGeneratedString = (value: unknown, fallback = ''): string => (
    typeof value === 'string' && value.trim() ? value.trim() : fallback
);

const normalizeGeneratedStringList = (value: unknown, fallback: string[] = []): string[] => {
    const source = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/\n|[;•]+/)
            : [];
    const normalized = source
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);

    return normalized.length > 0 ? normalized : fallback;
};

// Helper to clean and split content
function cleanSlideContent(content: unknown): string[] {
    const cleaned: string[] = [];
    const splitMarker = "|||SPLIT|||";
    const contentItems = normalizeGeneratedStringList(content);

    for (const item of contentItems) {
        let formatted = item;

        // 0. Normalize newlines to splits first
        formatted = formatted.replace(/\n/g, splitMarker);

        // 1. Handle Numbered Lists (e.g. "1. Question", "2. Answer")
        // Case: Punctuation followed by number (e.g. "end.2. Start", "end?2. Start")
        formatted = formatted.replace(/([.?!])\s*(\d+\.)/g, `$1${splitMarker}$2`);
        // Case: Clumped text followed by number (e.g. "word2. Start")
        formatted = formatted.replace(/([a-z])(\d+\.)/g, `$1${splitMarker}$2`);
        // Case: Standard space before Number (aggressive splitting for lists)
        // Matches " 1. " but tries to avoid "Figure 1." by checking for trailing capital letter (start of sentence)
        formatted = formatted.replace(/(\s)(\d+\.\s+[A-Z])/g, `${splitMarker}$2`);

        // 2. Handle Options (A., B., etc.)
        // Case: Punctuation followed by Option (e.g. "Question?A. Answer")
        formatted = formatted.replace(/([.?!])\s*([A-E]\.)/g, `$1${splitMarker}$2`);
        // Case: Clumped text followed by Option (e.g. "flowB. Answer", "OptionA. Answer")
        formatted = formatted.replace(/([a-z])([A-E]\.)/g, `$1${splitMarker}$2`);
        // Case: Standard space before Option (e.g. " A. Option")
        formatted = formatted.replace(/(\s)([A-E]\.)/g, `${splitMarker}$2`);

        // 3. Handle Definition Clumping (e.g. "Magma: Rock.Lava: Flow.")
        // Looks for Punctuation + Optional Space + Title Case Word + Colon
        formatted = formatted.replace(/([.?!])\s*([A-Z][a-zA-Z\s-]{1,30}:)/g, `$1${splitMarker}$2`);
        
        // 4. Handle Bullets (e.g. "- Item", "* Item", "• Item") and Sticky Bullets
        formatted = formatted.replace(/(\s|^|[:.;])([-•*]\s)/g, (match, p1, p2) => {
             return `${p1}${splitMarker}${p2}`;
        });

        const parts = formatted.split(splitMarker);
        
        parts.forEach(p => {
            let trimmed = p.trim();
            if (trimmed) {
                // Remove generic bullet markers if they exist at the start
                trimmed = trimmed.replace(/^[-•*]\s+/, '');
                
                // Remove leading split markers that might have been left over
                if (trimmed.length > 0) {
                     cleaned.push(trimmed);
                }
            }
        });
    }
    return cleaned;
}

const EMPTY_VISIBLE_ITEM_PATTERN = /^(?:[-•*]|\d+\.|[A-E]\.)\s*$/i;
const TEACHER_ONLY_VISIBLE_PATTERN = /\b(?:teachers?\s+(?:checks?|models?|circulates?|collects?|distributes?|asks?|uses?|notes?|facilitates?|reminds?|explains?|shows?|guides?)|circulate\s+and\s+ask|collect\s+(?:responses|exit|slips?)|sort\s+support\s+needs?|use\s+(?:this|results?)\s+to\s+(?:sort|plan)|check\s+attendance|read\s+the\s+(?:learner-friendly\s+)?objective|facilitate\s+(?:pair|group|class)|distribute\s+(?:cards?|slips?|materials?))\b/i;
const GENERIC_SUCCESS_CRITERION_PATTERN = /\b(?:identify\s+the\s+session\s+target\s+in\s+context|justify\s+one\s+claim\s+using\s+evidence|produce\s+one\s+accurate\s+session\s+artifact)\b/i;
const GENERIC_TITLE_PATTERN = /\b(?:session\s+lesson\s+plan|single\s+lesson\s+presentation|uploaded\s+lesson\s+plan|lesson\s+plan\s+content|source\s+material)\b/i;
const BAD_FOCUS_LINE_PATTERN = /\bfocus\s*:\s*(?:formative\s+assessment|assessment\s*&?|procedure\s+mapping)\b/i;
const UNKNOWN_METADATA_VALUE_PATTERN = /^(?:not\s+specified|not\s+provided|not\s+available|unknown|uploaded\s+lesson\s+plan|source\s+material|lesson\s+plan\s+content|n\/?a|none|null|undefined)$/i;
const TITLE_SOURCE_LEAK_PATTERN = /\b(?:formative\s+assessment|formatibong\s+pagtataya|ebidensiyang\s+pormatibo|evidence\s+of\s+learning|what\s+task,\s*activity|what\s+can\s+we\s+do\s+together|bumuo\s+ng\s+(?:gawain|tanong)|pagtataya\s+sa\s+pagkatuto|uploaded\s+lesson\s+plan|source\s+extract|source\s+material|lesson\s+blueprint)\b/i;
const CLASSROOM_ARTIFACT_PATTERN = /\b(?:answer\s+frame|body[-\s]?signal\s+chart|card\s+sort|checklist|concept\s+map|criteria|decision\s+board|draft\s+artifact|emotion\s+cards?|evidence\s+(?:organizer|table|map|chart)|exit\s+ticket|flow\s+map|graphic\s+organizer|organizer|private\s+self[-\s]?rating|rating\s+slip|reflection\s+(?:card|frame)|rubric|scenario\s+card|scenario[-\s]?analysis\s+table|self[-\s]?rating\s+slip|sentence\s+frame|situation\s+card|task\s+card|worksheet|chart|table|kard|mapa|organisador|pamantayan|rubriko|sitwasyon)\b/i;
const GEOGRAPHIC_MAP_PATTERN = /\b(?:philippine|philippines|world|country|province|region|city|municipality|community|geographic|geography|location|route|topographic|territory|mapang\s+pisikal|mapang\s+politikal)\b/i;
const GENERIC_CLASSROOM_PROMPT_PATTERN = /\b(?:teacher|teachers|student|students|learner|learners|classroom|school|education|group\s+work|writing|worksheet|notebook|board|discussion|lecture)\b/i;
const GENERIC_VISUAL_TERM_PATTERN = /^(?:classroom|school|education|student|students|learner|learners|teacher|teachers|group|writing|worksheet|notebook|board|discussion|activity|lesson|slide|presentation)$/i;

function cleanVisibleSlideItem(item: string): string {
    return item
        .replace(/\banswer\s+these\s+\d+\s+items\b/i, 'Answer these items')
        .replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, '')
        .trim();
}

function isTeacherOnlyVisibleItem(item: string): boolean {
    return TEACHER_ONLY_VISIBLE_PATTERN.test(item);
}

function isGenericSuccessCriterion(item: string): boolean {
    return GENERIC_SUCCESS_CRITERION_PATTERN.test(item);
}

function isUnknownMetadataValue(value: string | undefined): boolean {
    const normalized = normalizeSourceText(value);
    return !normalized || UNKNOWN_METADATA_VALUE_PATTERN.test(normalized);
}

function normalizeMetadataString(value: unknown, fallback = ''): string {
    const normalized = normalizeGeneratedString(value);
    return isUnknownMetadataValue(normalized) ? fallback : normalized;
}

function isBadTitleSourceCandidate(value: string | undefined): boolean {
    const normalized = normalizeGeneratedString(value);
    if (!normalized) return true;
    return TITLE_SOURCE_LEAK_PATTERN.test(normalized)
        || BAD_FOCUS_LINE_PATTERN.test(normalized)
        || (normalized.length > 130 && /\?/.test(normalized));
}

function extractSourceGradeLevel(sourceContent: string | undefined): string {
    const lines = (sourceContent || '').split(/\r?\n/).slice(0, 160);
    const patterns = [
        /\b(?:grade\s*level|grade|baitang(?:\s+at\s+seksyon)?|antas\s+ng\s+baitang)\s*(?:[:|,\-–—]|\s)\s*(?:grade\s*)?(\d{1,2})\b/i,
        /\b(?:grade|baitang)\s*(\d{1,2})\b/i,
    ];

    for (const line of lines) {
        if (!/\b(?:grade|baitang)\b/i.test(line)) continue;
        for (const pattern of patterns) {
            const match = line.match(pattern);
            const grade = match ? Number.parseInt(match[1], 10) : NaN;
            if (Number.isFinite(grade) && grade >= 1 && grade <= 12) {
                return `Grade ${grade}`;
            }
        }
    }

    return '';
}

function extractSourceSubject(sourceContent: string | undefined): string {
    const lines = (sourceContent || '').split(/\r?\n/).slice(0, 160);
    const patterns = [
        /\b(?:learning\s+area|subject|asignatura|larangan\s+ng\s+pagkatuto)\s*(?:[:|,\-–—])\s*([^|\n]{2,80})/i,
        /\b(?:learning\s+area|subject|asignatura)\b\s+([^|\n]{2,80})/i,
    ];

    for (const line of lines) {
        for (const pattern of patterns) {
            const match = line.match(pattern);
            const subject = cleanCandidateTopicTitle(match?.[1] || '');
            if (
                subject
                && subject.length <= 60
                && !/\b(?:grade|baitang|quarter|markahan|week|linggo|session|day)\b/i.test(subject)
                && !isBadTitleSourceCandidate(subject)
            ) {
                return subject;
            }
        }
    }

    return '';
}

function isEditableClassroomArtifactSlide(slide: Slide): boolean {
    const text = [
        slide.title,
        ...(Array.isArray(slide.content) ? slide.content : []),
        slide.speakerNotes,
    ].filter(Boolean).join(' ');
    const hasArtifact = CLASSROOM_ARTIFACT_PATTERN.test(text);
    const hasNonGeographicMap = /\b(?:map|mapa)\b/i.test(text) && !GEOGRAPHIC_MAP_PATTERN.test(text);
    return hasArtifact || hasNonGeographicMap;
}

function hasEditableArtifactStructure(slide: Slide): boolean {
    const content = Array.isArray(slide.content) ? slide.content : [];
    const fieldLikeItems = content.filter((item) => /[:：]/.test(item) || /\b(?:criterion|criteria|step|hakbang|pamantayan|ebidensiya|evidence|scenario|sitwasyon|tanong|question)\b/i.test(item));
    return fieldLikeItems.length >= 2 || content.length >= 4;
}

function isGenericClassroomImagePrompt(slide: Slide): boolean {
    const prompt = normalizeGeneratedString(slide.imagePrompt);
    if (!prompt || !GENERIC_CLASSROOM_PROMPT_PATTERN.test(prompt)) return false;

    const promptTerms = extractImportantTerms(prompt, 10)
        .filter((term) => !GENERIC_VISUAL_TERM_PATTERN.test(term));
    const slideTerms = extractImportantTerms([
        slide.title,
        ...(Array.isArray(slide.content) ? slide.content : []),
        slide.speakerNotes,
    ].filter(Boolean).join(' '), 12);
    const normalizedPrompt = normalizeSourceText(prompt);
    const matchedSlideTerms = slideTerms.filter((term) => normalizedPrompt.includes(term));

    return promptTerms.length < 4 || matchedSlideTerms.length < 2;
}

function repairSlideVisualDecision(slide: Slide): Slide {
    const prompt = normalizeGeneratedString(slide.imagePrompt);
    if (!prompt || slide.imageStyle === 'none') return slide;

    if (isEditableClassroomArtifactSlide(slide)) {
        return {
            ...slide,
            imagePrompt: '',
            imageStyle: 'none',
            imageUrl: undefined,
            imageAttribution: undefined,
        };
    }

    if (isGenericClassroomImagePrompt(slide)) {
        return {
            ...slide,
            imagePrompt: '',
            imageStyle: 'none',
            imageUrl: undefined,
            imageAttribution: undefined,
        };
    }

    return slide;
}

function cleanSlideItemsForDisplay(content: unknown): { content: string[]; movedToNotes: string[] } {
    const movedToNotes: string[] = [];
    const cleaned = cleanSlideContent(content)
        .map(cleanVisibleSlideItem)
        .filter((item) => item && !EMPTY_VISIBLE_ITEM_PATTERN.test(item))
        .filter((item) => {
            if (isTeacherOnlyVisibleItem(item)) {
                movedToNotes.push(item);
                return false;
            }
            if (isGenericSuccessCriterion(item)) {
                return false;
            }
            return true;
        });

    return {
        content: Array.from(new Set(cleaned)),
        movedToNotes,
    };
}

function isGenericDeckTitle(value: string | undefined): boolean {
    const normalized = normalizeSourceText(value);
    if (!normalized) return true;
    return GENERIC_TITLE_PATTERN.test(normalized)
        || /^(?:session|day|lesson)\s*\d*$/i.test(normalized);
}

function cleanCandidateTopicTitle(value: string): string {
    return value
        .replace(/\|/g, ' ')
        .replace(/^\s*(?:title|topic|lesson\s+title|week\s+topic|main\s+title|paksa|pamagat)\s*[:\-–—]\s*/i, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, '')
        .trim();
}

function extractSourceTopicTitle(sourceText: string | undefined, fallback = ''): string {
    const fallbackTitle = cleanCandidateTopicTitle(fallback);
    if (fallbackTitle && !isGenericDeckTitle(fallbackTitle) && !isBadTitleSourceCandidate(fallbackTitle)) return fallbackTitle;

    const candidates = (sourceText || '')
        .split(/\r?\n/)
        .slice(0, 80)
        .map((rawLine) => ({
            rawLine,
            line: cleanCandidateTopicTitle(rawLine),
        }))
        .filter(({ line }) => {
            const normalized = normalizeSourceText(line);
            return line.length >= 18
                && line.length <= 120
                && !line.includes('?')
                && !normalized.startsWith('table ')
                && !normalized.includes('learning session')
                && !normalized.includes('formative assessment')
                && !isBadTitleSourceCandidate(line)
                && !PLAN_UNIT_OBJECTIVE_HEADING_PATTERN.test(line)
                && !isPlanUnitFocusScaffoldText(line)
                && !isGenericDeckTitle(line);
        })
        .map(({ rawLine, line }, index) => {
            const explicitTitleScore = /\b(?:title|topic|paksa|pamagat)\b/i.test(rawLine) ? 200 : 0;
            const earlyScore = Math.max(0, 80 - index);
            const wordScore = Math.min(line.split(/\s+/).length * 6, 70);
            return { line, score: explicitTitleScore + earlyScore + wordScore };
        })
        .sort((a, b) => b.score - a.score || a.line.length - b.line.length);

    return candidates[0]?.line || fallbackTitle || '';
}

function getBestFocusText(context: SlideRepairContext): string {
    const focus = normalizeGeneratedString(context.focus);
    if (focus && !isGenericPlanUnitSummary(focus, normalizePlanUnitLabel(context.unitLabel, 'Session'), context.dayNumber || 1)
        && !BAD_FOCUS_LINE_PATTERN.test(`Focus: ${focus}`)
        && !isBadTitleSourceCandidate(focus)) {
        return focus;
    }
    return '';
}

function repairTitleSlide(slide: Slide, context: SlideRepairContext): Slide {
    const topicTitle = normalizeGeneratedString(context.topicTitle);
    const rawTitle = normalizeGeneratedString(slide.title);
    const titleCandidate = topicTitle && (
        isGenericDeckTitle(rawTitle)
        || isBadTitleSourceCandidate(rawTitle)
        || /^session\s+\d+\s*:/i.test(rawTitle)
        || rawTitle.length < topicTitle.length
    )
        ? topicTitle
        : normalizeGeneratedString(rawTitle, topicTitle || 'Lesson Presentation');
    const title = isBadTitleSourceCandidate(titleCandidate)
        ? topicTitle || 'Lesson Presentation'
        : titleCandidate;
    const focus = getBestFocusText(context);
    const unitContext = context.unitLabel && context.dayNumber
        ? `${context.unitLabel} ${context.dayNumber}${focus ? `: ${focus}` : ''}`
        : focus;
    const { content } = cleanSlideItemsForDisplay(slide.content);
    const filteredContent = content.filter((item) => (
        !BAD_FOCUS_LINE_PATTERN.test(item)
        && !isBadTitleSourceCandidate(item)
        && !isGenericPlanUnitSummary(item, normalizePlanUnitLabel(context.unitLabel, 'Session'), context.dayNumber || 1)
        && !/^grade\s+level\s*:\s*(?:not\s+specified|unknown|n\/?a|none)$/i.test(item)
    ));
    const subject = normalizeMetadataString(context.subject);
    const gradeLevel = normalizeMetadataString(context.gradeLevel);
    const contextLines = [
        unitContext,
        subject ? `Subject: ${subject}` : '',
        gradeLevel ? `Grade Level: ${gradeLevel}` : '',
    ].filter(Boolean);
    const mergedContent = Array.from(new Set([
        ...contextLines,
        ...filteredContent.filter((item) => !contextLines.some((line) => normalizeSourceText(line) === normalizeSourceText(item))),
    ])).slice(0, 4);

    return {
        ...slide,
        title,
        content: mergedContent,
        imagePrompt: '',
        imageStyle: 'none',
    };
}

function repairGeneratedSlidesForClassroomUse(slides: Slide[], context: SlideRepairContext = {}): Slide[] {
    return slides.map((slide, index) => {
        const { content, movedToNotes } = cleanSlideItemsForDisplay(slide.content);
        const movedTeacherNotes = movedToNotes.length > 0
            ? `Teacher-only directions moved from visible slide text: ${movedToNotes.join(' ')}`
            : '';
        const speakerNotes = [slide.speakerNotes, movedTeacherNotes].filter(Boolean).join('\n\n').trim();
        const repairedSlide = {
            ...slide,
            title: normalizeGeneratedString(slide.title, `Slide ${index + 1}`),
            content,
            speakerNotes,
        };

        const repairedVisualSlide = repairSlideVisualDecision(repairedSlide);
        return index === 0 ? repairTitleSlide(repairedVisualSlide, context) : repairedVisualSlide;
    });
}

// --- K-12 GENERATION LOGIC ---

const getPlanUnitLabel = (blueprint: LessonBlueprint): string => blueprint.planUnitLabel?.trim() || 'Day';
type PlanUnitLabel = 'Day' | 'Session';
type InferredPlanUnitInfo = {
    label?: PlanUnitLabel;
    count?: number;
};

type PlanUnitSourceBlock = {
    text: string;
    found: boolean;
    strategy: 'marker' | 'focus' | 'full-plan';
    keyTerms: string[];
};

type PlanUnitSourceDetails = Pick<
    DayPlan,
    'sourceSummary' | 'sourceObjective' | 'sourceFlow' | 'sourceMaterials' | 'sourceAssessment' | 'sourceOutput'
>;

type SessionAlignmentIssue = {
    code: string;
    message: string;
};

type PresentationOutlineStep = {
    section: string;
    slideTitle: string;
    slidePurpose: string;
    sourceEvidence: string[];
    keyPoints: string[];
    teacherMove: string;
    studentAction: string;
    assessmentCue: string;
    visualIntent: string;
};

type PresentationOutline = {
    title: string;
    unitLabel: string;
    unitNumber: number;
    learningTarget: string;
    sourceSummary: string;
    flow: PresentationOutlineStep[];
    missingSourceDetails: string[];
};

type PlanUnitMarkerBlockCandidate = {
    index: number;
    text: string;
    focusScore: number;
    wrongMarkerCount: number;
    isDedicatedBlock: boolean;
    score: number;
};

type SlideRepairContext = {
    topicTitle?: string;
    unitLabel?: string;
    dayNumber?: number;
    focus?: string;
    subject?: string;
    gradeLevel?: string;
};

const clampPlanUnitCount = (count: number): number | undefined => {
    if (!Number.isFinite(count) || count < 1 || count > 20) return undefined;
    return count;
};

const inferPlanUnitInfo = (content: string): InferredPlanUnitInfo => {
    const normalized = content.replace(/\s+/g, ' ').trim();
    const sessionNumbers = [...normalized.matchAll(/\b(?:learning\s+session|session|sesyon(?:\s+ng\s+pagkatuto)?|sesion)\s*(?:no\.?|#|:|-)?\s*(\d{1,2})\b/gi)]
        .map((match) => Number.parseInt(match[1], 10))
        .filter(Number.isFinite);
    const dayNumbers = [...normalized.matchAll(/\b(?:day|araw)\s*(?:no\.?|#|:|-)?\s*(\d{1,2})\b/gi)]
        .map((match) => Number.parseInt(match[1], 10))
        .filter(Number.isFinite);

    const sessionCountMatch = normalized.match(/\b(?:bilang\s+ng\s+(?:mga\s+)?sesyon|number\s+of\s+sessions?|session\s+count)\b\D{0,40}(\d{1,2})/i);
    const dayCountMatch = normalized.match(/\b(?:number\s+of\s+days?|day\s+count|bilang\s+ng\s+(?:mga\s+)?araw)\b\D{0,40}(\d{1,2})/i);
    const sessionCount = sessionCountMatch ? clampPlanUnitCount(Number.parseInt(sessionCountMatch[1], 10)) : undefined;
    const dayCount = dayCountMatch ? clampPlanUnitCount(Number.parseInt(dayCountMatch[1], 10)) : undefined;

    if (sessionNumbers.length > 0 || sessionCount) {
        return {
            label: 'Session',
            count: clampPlanUnitCount(Math.max(...sessionNumbers, sessionCount || 0)) || sessionCount,
        };
    }

    if (dayNumbers.length > 0 || dayCount) {
        return {
            label: 'Day',
            count: clampPlanUnitCount(Math.max(...dayNumbers, dayCount || 0)) || dayCount,
        };
    }

    return {};
};

const normalizePlanUnitLabel = (label: string | undefined, fallback: PlanUnitLabel = 'Day'): PlanUnitLabel => {
    if (label?.trim().toLowerCase() === 'session') return 'Session';
    if (label?.trim().toLowerCase() === 'day') return 'Day';
    return fallback;
};

const PLAN_UNIT_OBJECTIVE_HEADING_PATTERN = /\b(?:objectives?|learning\s+(?:objectives?|targets?|outcomes?|competenc(?:y|ies))|success\s+criteria|melc|most\s+essential\s+learning\s+competenc(?:y|ies)|layunin|mga\s+layunin|kasanayang\s+pampagkatuto|kasanayan)\b/i;
const PLAN_UNIT_OBJECTIVE_ACTION_PATTERN = /\b(?:determine|identify|describe|explain|compare|classify|analy[sz]e|solve|compute|calculate|interpret|construct|represent|differentiate|evaluate|create|use|apply|measure|infer|predict|illustrate|define|recognize|read|write|discuss|relate|natutukoy|matukoy|tukuyin|nailalarawan|mailarawan|ilarawan|naipaliliwanag|maipaliwanag|ipaliwanag|naihahambing|maihambing|nasusuri|masuri|suriin|nakakalkula|makalkula|nakakuwenta|makuwenta|nalulutas|malutas|lutasin|naipakikita|maipakita|nagagamit|magamit|gamitin|nakabubuo|makabuo)\b/i;
const PLAN_UNIT_OBJECTIVE_LEARNER_SIGNAL_PATTERN = /\b(?:(?:students?|learners?|pupils?)\s+(?:will|should|can|shall|must|are\s+able\s+to|be\s+able\s+to|are\s+expected\s+to(?:\s+be\s+able\s+to)?)|(?:mga\s+)?mag-aaral\s+(?:ay\s+)?(?:inaasahang|maaaring|makakaya(?:ng)?|dapat))\b/i;
const PLAN_UNIT_STANDARD_LABEL_PATTERN = /\b(?:content\s+standard|performance\s+standard|pamantayang\s+pangnilalaman|pamantayan\s+sa\s+pagganap)\b/i;
const PLAN_UNIT_FOCUS_SCAFFOLD_PATTERN = /\b(?:what\s+task,?\s+activity,?\s+or\s+questions\s+can\s+i\s+use|what\s+can\s+we\s+do\s+together\s+so\s+that\s+learners|what\s+kind\s+of\s+questions\s+will\s+check|assessment\s+reveal|ways\s+forward|meaningful\s+learning\s+can\s+also\s+happen|learning\s+experience\s+is\s+like\s+a\s+thoughtfully\s+designed\s+journey|what\s+can\s+i\s+do\s+to\s+make\s+the\s+objectives?\s+clear|what\s+learning\s+resources\s+(?:do|will)\s+i\s+need|are\s+there\s+spaces\s+to\s+meaningfully\s+integrate|think\s+about\s+what\s+you\s+need\s+to\s+adjust|what\s+experiences?\s+outside\s+the\s+classroom)\b/i;
const PLAN_UNIT_METADATA_LINE_PATTERN = /\b(?:school|teacher|date|time|duration|quarter|grade\s+level|subject|section|learning\s+area)\b/i;
const PLAN_UNIT_FLOW_HEADING_PATTERN = /\b(?:review|motivation|pre[-\s]?activity|presentation|discussion|concept\s+development|activity|analysis|abstraction|application|generalization|evaluation|assessment|assignment|homework|reflection|closing|lesson\s+proper|guided\s+practice|independent\s+practice|engage|explore|explain|elaborate|evaluate|demo|demonstration|performance\s+task|pre[-\s]?lesson|during\s+lesson|post[-\s]?lesson)\b/i;
const PLAN_UNIT_FLOW_ACTION_PATTERN = /\b(?:ask|answer|observe|predict|record|calculate|solve|compute|draw|construct|classify|compare|explain|analy[sz]e|discuss|demonstrate|practice|present|write|complete|identify|determine|inspect|check|sort|match|group|measure|interpret|create|revise|evaluate|submit|use|apply|describe|show|share|read|listen|gawin|sagutin|tukuyin|ilarawan|ipaliwanag|suriin|ihambing|buoin|gumawa|gamitin|isulat|ipakita)\b/i;
const PLAN_UNIT_MATERIAL_HEADING_PATTERN = /\b(?:materials?|resources?|learning\s+resources?|tools?|equipment|facilit(?:y|ies)|supplies|worksheets?|cards?|chart|rubric|visual\s+aid|apparatus|kagamitan|sanggunian)\b/i;
const PLAN_UNIT_ASSESSMENT_HEADING_PATTERN = /\b(?:assessment|evaluation|quiz|exit\s+(?:ticket|slip)|formative|summative|check(?:ing)?|rubric|criteria|score|pagtataya|ebalwasyon)\b/i;
const PLAN_UNIT_OUTPUT_HEADING_PATTERN = /\b(?:output|artifact|product|performance\s+task|worksheet|table|chart|poster|report|presentation|draft|slip|card|journal|paragraph|solution|portfolio|awtput|produkto)\b/i;
const PLAN_UNIT_SPLIT_HEADING_PATTERN = /\b(?:Learning\s+Objectives?|Objectives?|Learning\s+Targets?|Content|Learning\s+Resources?|Materials?|Review|Motivation|Presentation|Discussion|Concept\s+Development|Activity|Analysis|Abstraction|Application|Generalization|Evaluation|Assessment|Assignment|Reflection|Formative\s+Assessment|Extended\s+Learning\s+Opportunities|Opportunities\s+for\s+Integration)\b/g;
const PLAN_UNIT_BARE_HEADING_PATTERN = /^(?:learning\s+objectives?|objectives?|learning\s+targets?|content|learning\s+resources?|materials?|review|motivation|presentation|discussion|concept\s+development|activity|analysis|abstraction|application|generalization|evaluation|assessment|formative\s+assessment|assignment|reflection|extended\s+learning\s+opportunities|opportunities\s+for\s+integration)$/i;

function isPlanUnitFocusScaffoldText(value: unknown): boolean {
    const normalized = normalizeSourceText(typeof value === 'string' ? value : '');
    if (!normalized) return false;

    return PLAN_UNIT_FOCUS_SCAFFOLD_PATTERN.test(normalized)
        || (normalized.includes('formative assessment') && normalized.includes('what task'))
        || (normalized.includes('learning resources') && normalized.includes('what learning resources'))
        || (normalized.includes('opportunities for integration') && normalized.includes('are there spaces'))
        || (normalized.includes('extended learning opportunities') && normalized.includes('what experiences'))
        || (normalized.includes('reflections') && normalized.includes('think about what you need'));
}

function isGenericPlanUnitSummary(value: unknown, unitLabel: PlanUnitLabel, dayNumber: number): boolean {
    const normalized = normalizeSourceText(typeof value === 'string' ? value : '');
    if (!normalized) return true;
    if (isPlanUnitFocusScaffoldText(normalized)) return true;

    const unit = unitLabel.toLowerCase();
    return normalized === `${unit} ${dayNumber}`
        || normalized === `${unit} ${dayNumber}.`
        || normalized.includes('uploaded lesson plan')
        || normalized.includes('provided lesson plan')
        || normalized.includes('uploaded content')
        || normalized.includes('source material')
        || normalized.includes('source document');
}

function cleanPlanUnitFocusCandidateLine(line: string, unitLabel: PlanUnitLabel, dayNumber: number): string {
    let cleaned = line
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (isPlanUnitFocusScaffoldText(cleaned)) return '';

    cleaned = cleaned
        .replace(planUnitMarkerRegex(unitLabel, dayNumber, 'i'), '')
        .replace(/^\s*(?:[-•*]|\(?[a-zA-Z]\)|[a-zA-Z][\).]|\d+[\).])\s*/, '')
        .replace(/^\s*(?:focus|topic|paksa|lesson|title|content|objectives?|learning\s+(?:objectives?|targets?|outcomes?|competenc(?:y|ies))(?:\s*\/\s*objectives?)?|competenc(?:y|ies)(?:\s*\/\s*objectives?)?|melc|layunin|mga\s+layunin|kasanayang\s+pampagkatuto|kasanayan|activity|gawain|materials?|assessment|evaluation)\s*[:\-–—]\s*/i, '')
        .replace(/\b(?:from|of)\s+(?:the\s+)?(?:uploaded|provided)\s+(?:lesson\s+plan|content|source|material|document)\b/gi, '')
        .replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, '')
        .trim();

    if (cleaned.length < 12 || isGenericPlanUnitSummary(cleaned, unitLabel, dayNumber)) return '';
    return cleaned;
}

function normalizeObjectiveFocusText(value: string, unitLabel: PlanUnitLabel, dayNumber: number): string {
    let cleaned = cleanPlanUnitFocusCandidateLine(value, unitLabel, dayNumber);
    if (!cleaned) return '';

    const learnerSignalClause = cleaned.match(/\b(?:(?:students?|learners?|pupils?)\s+(?:will|should|can|shall|must|are\s+able\s+to|be\s+able\s+to|are\s+expected\s+to(?:\s+be\s+able\s+to)?)|(?:mga\s+)?mag-aaral\s+(?:ay\s+)?(?:inaasahang|maaaring|makakaya(?:ng)?|dapat))\s+(.+)$/i);
    if (learnerSignalClause?.[1]) {
        cleaned = learnerSignalClause[1].trim();
    }

    cleaned = cleaned
        .replace(/^(?:(?:at|by)\s+the\s+end\s+of\s+(?:the\s+)?(?:lesson|session|period|discussion|activity|week),?\s*)/i, '')
        .replace(/^(?:(?:the\s+)?(?:students?|learners?|pupils?)|(?:mga\s+)?mag-aaral)\s+(?:will|should|can|shall|must|are\s+able\s+to|be\s+able\s+to|are\s+expected\s+to(?:\s+be\s+able\s+to)?|ay\s+inaasahang|ay\s+maaaring|ay\s+makakaya(?:ng)?|dapat)\s*/i, '')
        .replace(/^(?:be\s+able\s+to|able\s+to|to)\s+/i, '')
        .replace(/^[\s:;,\-–—]+|[\s:;,\-–—.]+$/g, '')
        .trim();

    if (cleaned.length < 12 || isGenericPlanUnitSummary(cleaned, unitLabel, dayNumber)) return '';

    const clipped = cleaned.length > 150 ? `${cleaned.slice(0, 147).trim()}...` : cleaned;
    return clipped.replace(/^[a-z]/, (letter) => letter.toUpperCase());
}

function extractPlanUnitObjectiveFocus(sourceText: string, unitLabel: PlanUnitLabel, dayNumber: number): string {
    const candidates: Array<{ text: string; score: number; index: number }> = [];
    const seen = new Set<string>();
    let latestObjectiveHeadingIndex = -1;

    sourceText.split(/\r?\n/).forEach((line, index) => {
        const raw = line.replace(/\s+/g, ' ').trim();
        if (!raw) return;
        if (isPlanUnitFocusScaffoldText(raw)) return;

        const hasObjectiveHeading = PLAN_UNIT_OBJECTIVE_HEADING_PATTERN.test(raw);
        const hasLearnerSignal = PLAN_UNIT_OBJECTIVE_LEARNER_SIGNAL_PATTERN.test(raw);
        const opensObjectiveList = hasObjectiveHeading || (hasLearnerSignal && /:\s*$/.test(raw));
        if (opensObjectiveList) {
            latestObjectiveHeadingIndex = index;
        }

        const isBroadStandard = PLAN_UNIT_STANDARD_LABEL_PATTERN.test(raw) && !hasObjectiveHeading;
        if (isBroadStandard) return;

        const text = normalizeObjectiveFocusText(raw, unitLabel, dayNumber);
        if (!text) return;

        const hasAction = PLAN_UNIT_OBJECTIVE_ACTION_PATTERN.test(text);
        const isUnderObjectiveHeading = latestObjectiveHeadingIndex >= 0
            && index > latestObjectiveHeadingIndex
            && index - latestObjectiveHeadingIndex <= 10;

        if (!hasAction && !hasObjectiveHeading && !hasLearnerSignal && !isUnderObjectiveHeading) return;

        const key = normalizeSourceText(text);
        if (seen.has(key)) return;
        seen.add(key);

        const headingDistance = isUnderObjectiveHeading ? index - latestObjectiveHeadingIndex : 0;
        const score = (hasAction ? 140 : 0)
            + (hasObjectiveHeading ? 90 : 0)
            + (hasLearnerSignal ? 70 : 0)
            + (isUnderObjectiveHeading ? Math.max(20, 80 - headingDistance * 6) : 0)
            + Math.min(text.length, 120);

        candidates.push({ text, score, index });
    });

    return candidates
        .sort((a, b) => b.score - a.score || a.index - b.index || a.text.length - b.text.length)[0]?.text || '';
}

function summarizePlanUnitSourceText(
    sourceText: string,
    unitLabel: PlanUnitLabel,
    dayNumber: number,
    language: 'EN' | 'FIL',
): string {
    const objectiveFocus = extractPlanUnitObjectiveFocus(sourceText, unitLabel, dayNumber);
    if (objectiveFocus) return objectiveFocus;

    const candidates = sourceText
        .split(/\r?\n/)
        .map((line) => cleanPlanUnitFocusCandidateLine(line, unitLabel, dayNumber))
        .filter(Boolean)
        .map((text) => {
            const actionScore = /\b(activity|demo|experiment|sort|compare|classify|analyze|explain|model|practice|application|assessment|exit|ticket|gawain|pagsasanay|pagtataya|talakayan|suriin|ipaliwanag|uriin)\b/i.test(text)
                ? 80
                : 0;
            const lengthScore = Math.min(text.length, 140);
            return { text, score: actionScore + lengthScore };
        })
        .sort((a, b) => b.score - a.score || a.text.length - b.text.length);

    const bestLine = candidates[0]?.text;
    if (bestLine) {
        return bestLine.length > 150 ? `${bestLine.slice(0, 147).trim()}...` : bestLine;
    }

    const terms = extractImportantTerms(sourceText, 5);
    if (terms.length >= 2) {
        const joinedTerms = terms.slice(0, 4).join(', ');
        return language === 'FIL'
            ? `Tumutok sa ${joinedTerms}`
            : `Focus on ${joinedTerms}`;
    }

    return '';
}

function splitPlanUnitSourceLines(sourceText: string): string[] {
    return sourceText
        .replace(/\t/g, '\n')
        .replace(PLAN_UNIT_SPLIT_HEADING_PATTERN, '\n$&')
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
}

function cleanPlanUnitSourceDetailLine(line: string, unitLabel: PlanUnitLabel, dayNumber: number): string {
    const cleaned = cleanPlanUnitFocusCandidateLine(line, unitLabel, dayNumber)
        .replace(/^(?:learners?|students?|pupils?)\s+(?:will|should|can|shall|must|are\s+able\s+to)\s+/i, '')
        .replace(/^[\s:;,\-–—]+|[\s:;,\-–—.]+$/g, '')
        .trim();
    const normalized = normalizeSourceText(cleaned);

    if (!cleaned || cleaned.length < 8) return '';
    if (isGenericPlanUnitSummary(cleaned, unitLabel, dayNumber)) return '';
    if (PLAN_UNIT_BARE_HEADING_PATTERN.test(cleaned)) return '';
    if (PLAN_UNIT_STANDARD_LABEL_PATTERN.test(cleaned)) return '';
    if (PLAN_UNIT_METADATA_LINE_PATTERN.test(cleaned) && cleaned.length < 80) return '';
    if (normalized === 'not specified' || normalized === 'none' || normalized === 'n/a') return '';

    return cleaned.length > 190 ? `${cleaned.slice(0, 187).trim()}...` : cleaned;
}

function uniqueSourceDetails(items: string[], maxItems: number): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const item of items) {
        const key = normalizeSourceText(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
        if (unique.length >= maxItems) break;
    }

    return unique;
}

function extractPlanUnitDetailList(
    sourceText: string,
    unitLabel: PlanUnitLabel,
    dayNumber: number,
    headingPattern: RegExp,
    itemPattern: RegExp,
    maxItems: number,
): string[] {
    const lines = splitPlanUnitSourceLines(sourceText);
    const candidates: string[] = [];
    let activeDetailUntil = -1;

    lines.forEach((line, index) => {
        if (headingPattern.test(line)) {
            activeDetailUntil = Math.max(activeDetailUntil, index + 4);
        }

        const cleaned = cleanPlanUnitSourceDetailLine(line, unitLabel, dayNumber);
        if (!cleaned) return;

        const isInActiveDetailBlock = index <= activeDetailUntil;
        const isDirectMatch = headingPattern.test(line) || itemPattern.test(line);
        if (!isInActiveDetailBlock && !isDirectMatch) return;

        candidates.push(cleaned);
    });

    return uniqueSourceDetails(candidates, maxItems);
}

function extractPlanUnitSourceFlow(sourceText: string, unitLabel: PlanUnitLabel, dayNumber: number): string[] {
    const candidates = splitPlanUnitSourceLines(sourceText)
        .map((line, index) => {
            const cleaned = cleanPlanUnitSourceDetailLine(line, unitLabel, dayNumber);
            if (!cleaned) return null;

            const hasFlowHeading = PLAN_UNIT_FLOW_HEADING_PATTERN.test(line);
            const hasFlowAction = PLAN_UNIT_FLOW_ACTION_PATTERN.test(cleaned) || PLAN_UNIT_OBJECTIVE_ACTION_PATTERN.test(cleaned);
            const hasAssessmentOrOutput = PLAN_UNIT_ASSESSMENT_HEADING_PATTERN.test(line) || PLAN_UNIT_OUTPUT_HEADING_PATTERN.test(line);
            if (!hasFlowHeading && !hasFlowAction && !hasAssessmentOrOutput) return null;

            const score = (hasFlowHeading ? 90 : 0)
                + (hasFlowAction ? 70 : 0)
                + (hasAssessmentOrOutput ? 50 : 0)
                + Math.min(cleaned.length, 120);

            return { text: cleaned, index, score };
        })
        .filter((candidate): candidate is { text: string; index: number; score: number } => Boolean(candidate));

    const selected = candidates
        .filter((candidate) => candidate.score >= 80)
        .sort((a, b) => a.index - b.index)
        .map((candidate) => candidate.text);

    return uniqueSourceDetails(selected, 10);
}

function extractPlanUnitSourceDetails(
    sourceText: string,
    unitLabel: PlanUnitLabel,
    dayNumber: number,
    language: 'EN' | 'FIL',
): PlanUnitSourceDetails {
    const sourceObjective = extractPlanUnitObjectiveFocus(sourceText, unitLabel, dayNumber);
    const sourceFlow = extractPlanUnitSourceFlow(sourceText, unitLabel, dayNumber);
    const sourceMaterials = extractPlanUnitDetailList(
        sourceText,
        unitLabel,
        dayNumber,
        PLAN_UNIT_MATERIAL_HEADING_PATTERN,
        PLAN_UNIT_MATERIAL_HEADING_PATTERN,
        6,
    );
    const sourceAssessment = extractPlanUnitDetailList(
        sourceText,
        unitLabel,
        dayNumber,
        PLAN_UNIT_ASSESSMENT_HEADING_PATTERN,
        PLAN_UNIT_ASSESSMENT_HEADING_PATTERN,
        3,
    )[0] || '';
    const sourceOutput = extractPlanUnitDetailList(
        sourceText,
        unitLabel,
        dayNumber,
        PLAN_UNIT_OUTPUT_HEADING_PATTERN,
        PLAN_UNIT_OUTPUT_HEADING_PATTERN,
        3,
    )[0] || '';
    const sourceSummary = sourceObjective
        || sourceFlow[0]
        || summarizePlanUnitSourceText(sourceText, unitLabel, dayNumber, language);

    return {
        sourceSummary: sourceSummary || undefined,
        sourceObjective: sourceObjective || undefined,
        sourceFlow: sourceFlow.length > 0 ? sourceFlow : undefined,
        sourceMaterials: sourceMaterials.length > 0 ? sourceMaterials : undefined,
        sourceAssessment: sourceAssessment || undefined,
        sourceOutput: sourceOutput || undefined,
    };
}

function derivePlanUnitSourceDetails(
    sourceContent: string | undefined,
    unitLabel: PlanUnitLabel,
    day: DayPlan,
    language: 'EN' | 'FIL',
): PlanUnitSourceDetails {
    if (!sourceContent?.trim()) return {};
    const sourceBlock = extractPlanUnitSourceBlock(sourceContent, unitLabel, day);
    return extractPlanUnitSourceDetails(sourceBlock.text, unitLabel, day.dayNumber, language);
}

function derivePlanUnitFocusFromSource(
    sourceContent: string | undefined,
    unitLabel: PlanUnitLabel,
    day: DayPlan,
    language: 'EN' | 'FIL',
): string {
    if (!sourceContent?.trim()) return '';
    const sourceBlock = extractPlanUnitSourceBlock(sourceContent, unitLabel, day);
    return summarizePlanUnitSourceText(sourceBlock.text, unitLabel, day.dayNumber, language);
}

const normalizeLessonBlueprintUnits = (
    blueprint: LessonBlueprint,
    inferred: InferredPlanUnitInfo,
    sourceContent?: string,
    language: 'EN' | 'FIL' = 'EN',
): LessonBlueprint => {
    const planUnitLabel = normalizePlanUnitLabel(blueprint.planUnitLabel, inferred.label || 'Day');
    const sourceSubject = extractSourceSubject(sourceContent);
    const sourceGradeLevel = extractSourceGradeLevel(sourceContent);
    const subject = normalizeMetadataString(blueprint.subject, sourceSubject) || sourceSubject;
    const gradeLevel = normalizeMetadataString(blueprint.gradeLevel, sourceGradeLevel) || sourceGradeLevel;
    const quarter = normalizeMetadataString(blueprint.quarter);
    const learningCompetency = normalizeGeneratedString(
        blueprint.learningCompetency,
        'Learning competency from the uploaded lesson plan'
    );
    const studentObjectivesFromModel = normalizeGeneratedStringList(blueprint.studentFacingObjectives);
    const smartObjectives = normalizeGeneratedStringList(
        blueprint.smartObjectives,
        studentObjectivesFromModel.length > 0 ? studentObjectivesFromModel : [learningCompetency]
    );
    const studentFacingObjectives = studentObjectivesFromModel.length > 0
        ? studentObjectivesFromModel
        : smartObjectives.slice(0, 3);
    const normalizedDays = (Array.isArray(blueprint.days) ? blueprint.days : [])
        .map((day, index) => {
            const dayNumber = Number.isFinite(day.dayNumber) && day.dayNumber > 0 ? day.dayNumber : index + 1;
            const title = normalizeGeneratedString(day.title, `${planUnitLabel} ${dayNumber}`);
            const fallbackDay = {
                ...day,
                dayNumber,
                title,
                focus: normalizeGeneratedString(day.focus),
                generationStatus: day.generationStatus || 'pending' as const,
            };
            const sourceDetails = derivePlanUnitSourceDetails(sourceContent, planUnitLabel, fallbackDay, language);
            const modelSourceFlow = normalizeGeneratedStringList(day.sourceFlow);
            const modelSourceMaterials = normalizeGeneratedStringList(day.sourceMaterials);
            const modelFocus = isGenericPlanUnitSummary(fallbackDay.focus, planUnitLabel, dayNumber)
                ? ''
                : fallbackDay.focus;
            return {
                ...day,
                dayNumber,
                title,
                focus: sourceDetails.sourceSummary || modelFocus,
                sourceSummary: sourceDetails.sourceSummary || normalizeGeneratedString(day.sourceSummary) || undefined,
                sourceObjective: sourceDetails.sourceObjective || normalizeGeneratedString(day.sourceObjective) || undefined,
                sourceFlow: sourceDetails.sourceFlow || (modelSourceFlow.length > 0 ? modelSourceFlow : undefined),
                sourceMaterials: sourceDetails.sourceMaterials || (modelSourceMaterials.length > 0 ? modelSourceMaterials : undefined),
                sourceAssessment: sourceDetails.sourceAssessment || normalizeGeneratedString(day.sourceAssessment) || undefined,
                sourceOutput: sourceDetails.sourceOutput || normalizeGeneratedString(day.sourceOutput) || undefined,
                generationStatus: day.generationStatus || 'pending' as const,
            };
        })
        .sort((a, b) => a.dayNumber - b.dayNumber);
    const fallbackDayDetails = derivePlanUnitSourceDetails(sourceContent, planUnitLabel, {
        dayNumber: 1,
        title: `${planUnitLabel} 1`,
        focus: '',
        generationStatus: 'pending',
    }, language);
    const fallbackDay = {
        dayNumber: 1,
        title: `${planUnitLabel} 1`,
        focus: fallbackDayDetails.sourceSummary || derivePlanUnitFocusFromSource(sourceContent, planUnitLabel, {
            dayNumber: 1,
            title: `${planUnitLabel} 1`,
            focus: '',
            generationStatus: 'pending',
        }, language),
        ...fallbackDayDetails,
        generationStatus: 'pending' as const,
    };

    if (!inferred.count) {
        return {
            ...blueprint,
            mainTitle: normalizeGeneratedString(blueprint.mainTitle, `${planUnitLabel} Lesson Plan`),
            planUnitLabel,
            subject,
            gradeLevel,
            quarter,
            learningCompetency,
            smartObjectives,
            studentFacingObjectives,
            days: normalizedDays.length > 0 ? normalizedDays : [fallbackDay],
        };
    }

    const byNumber = new Map(normalizedDays.map((day) => [day.dayNumber, day]));
    const days = Array.from({ length: inferred.count }, (_, index) => {
        const dayNumber = index + 1;
        const generatedFallbackDayDetails = derivePlanUnitSourceDetails(sourceContent, planUnitLabel, {
            dayNumber,
            title: `${planUnitLabel} ${dayNumber}`,
            focus: '',
            generationStatus: 'pending',
        }, language);
        return byNumber.get(dayNumber) || {
            dayNumber,
            title: `${planUnitLabel} ${dayNumber}`,
            focus: generatedFallbackDayDetails.sourceSummary || derivePlanUnitFocusFromSource(sourceContent, planUnitLabel, {
                dayNumber,
                title: `${planUnitLabel} ${dayNumber}`,
                focus: '',
                generationStatus: 'pending',
            }, language),
            ...generatedFallbackDayDetails,
            generationStatus: 'pending' as const,
        };
    });

    return {
        ...blueprint,
        mainTitle: normalizeGeneratedString(blueprint.mainTitle, `${planUnitLabel} Lesson Plan`),
        planUnitLabel,
        subject,
        gradeLevel,
        quarter,
        learningCompetency,
        smartObjectives,
        studentFacingObjectives,
        days,
    };
};

const SOURCE_EXTRACT_MAX_CHARS = 12_000;
const SOURCE_CONTEXT_MAX_CHARS = 18_000;
const MAX_ALIGNMENT_REPAIR_ATTEMPTS = 1;

function getK12FlowReference(format: string): string {
    if (format === 'K-12') return `A. Review (IV-A), B. Motivation (IV-B), C. Content (IV-C), D. Discussion (IV-D), E. Concept Development (IV-E), F. Practice (IV-F), G. Application (IV-G), H. Generalization (IV-H), I. Evaluation (IV-I), J. Assignment (IV-J)`;
    if (format === 'MATATAG') return `A. Activating Prior Knowledge, B. Establishing Purpose, C. Unlocking Vocabulary, D. Developing Understanding, E. Application, F. Generalization, G. Evaluating Learning, H. Homework`;
    if (format === '5Es Model') return `1. ENGAGE, 2. EXPLORE, 3. EXPLAIN, 4. ELABORATE, 5. EVALUATE`;
    if (format === '4As Model') return `1. MOTIVATION, 2. ACTIVITY, 3. ANALYSIS, 4. ABSTRACTION, 5. APPLICATION, 6. EVALUATE`;
    return `1. Title, 2. Introduction/Review, 3. Core Concepts, 4. Practice/Activity, 5. Assessment`;
}

const PLAN_UNIT_TERMS: Record<PlanUnitLabel, string[]> = {
    Session: ['learning session', 'session', 'sesyon ng pagkatuto', 'sesyon', 'sesion'],
    Day: ['day', 'araw'],
};

const SOURCE_KEYWORD_STOPWORDS = new Set([
    'about', 'above', 'after', 'again', 'along', 'also', 'and', 'answer', 'answers', 'activity',
    'aralin', 'araw', 'before', 'class', 'content', 'day', 'during', 'each', 'every', 'following',
    'grade', 'group', 'groups', 'guro', 'lesson', 'learning', 'learners', 'lesson', 'materials',
    'mga', 'need', 'objective', 'objectives', 'output', 'page', 'plan', 'question', 'questions',
    'review', 'rubric', 'session', 'shall', 'should', 'student', 'students', 'teacher', 'through',
    'today', 'using', 'will', 'with',
]);

function truncateSourceText(value: string, maxLength = SOURCE_EXTRACT_MAX_CHARS): string {
    const normalized = value.replace(/\n{3,}/g, '\n\n').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength).trim()}\n\n[Source extract truncated for length.]`;
}

function normalizeSourceText(value: string | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function planUnitMarkerRegex(unitLabel: PlanUnitLabel, dayNumber?: number, flags = 'i'): RegExp {
    const terms = PLAN_UNIT_TERMS[unitLabel]
        .map((term) => term.replace(/\s+/g, '\\s+'))
        .join('|');
    const numberPattern = dayNumber === undefined ? '(\\d{1,2})' : String(dayNumber);
    return new RegExp(
        `\\b(?:${terms})\\s*(?:(?:no\\.?|number|#)\\s*)?(?::|-)?\\s*${numberPattern}\\b`,
        flags
    );
}

function findPlanUnitMarkers(lines: string[], unitLabel: PlanUnitLabel): Array<{ index: number; dayNumber: number }> {
    const regex = planUnitMarkerRegex(unitLabel, undefined, 'gi');
    const markers: Array<{ index: number; dayNumber: number }> = [];

    lines.forEach((line, index) => {
        regex.lastIndex = 0;
        for (const match of line.matchAll(regex)) {
            const matchedNumber = Number.parseInt(match[1], 10);
            if (Number.isFinite(matchedNumber)) {
                markers.push({ index, dayNumber: matchedNumber });
            }
        }
    });

    return markers;
}

function extractImportantTerms(value: string, maxTerms = 14): string[] {
    const counts = new Map<string, number>();
    const normalized = normalizeSourceText(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]+/g, ' ');

    normalized.split(/\s+/).forEach((rawToken) => {
        const token = rawToken.replace(/^-+|-+$/g, '');
        if (token.length < 5 || /^\d+$/.test(token) || SOURCE_KEYWORD_STOPWORDS.has(token)) return;
        counts.set(token, (counts.get(token) || 0) + 1);
    });

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, maxTerms)
        .map(([term]) => term);
}

function scoreLineAgainstTerms(line: string, terms: string[]): number {
    const normalizedLine = normalizeSourceText(line);
    return terms.reduce((score, term) => score + (normalizedLine.includes(term) ? 1 : 0), 0);
}

function sliceSourceLines(lines: string[], start: number, end: number): string {
    return lines.slice(Math.max(0, start), Math.min(lines.length, end)).join('\n').trim();
}

function countWrongPlanUnitMarkers(text: string, unitLabel: PlanUnitLabel, dayNumber: number): number {
    const regex = planUnitMarkerRegex(unitLabel, undefined, 'gi');
    let wrongMarkerCount = 0;

    for (const match of text.matchAll(regex)) {
        const matchedNumber = Number.parseInt(match[1], 10);
        if (Number.isFinite(matchedNumber) && matchedNumber !== dayNumber) {
            wrongMarkerCount += 1;
        }
    }

    return wrongMarkerCount;
}

function isDedicatedPlanUnitBlockStart(line: string, unitLabel: PlanUnitLabel, dayNumber: number): boolean {
    const terms = PLAN_UNIT_TERMS[unitLabel]
        .map((term) => term.replace(/\s+/g, '\\s+'))
        .join('|');

    return new RegExp(
        `^\\s*(?:${terms})\\s*(?:(?:no\\.?|number|#)\\s*)?(?::|-)?\\s*${dayNumber}\\s*:?\\s*$`,
        'i'
    ).test(line);
}

function getMarkerBlockCandidates(
    lines: string[],
    markers: Array<{ index: number; dayNumber: number }>,
    unitLabel: PlanUnitLabel,
    day: DayPlan,
): PlanUnitMarkerBlockCandidate[] {
    const focusTerms = extractImportantTerms(`${day.title} ${day.focus}`, 10);

    const candidates = markers
        .filter((marker) => marker.dayNumber === day.dayNumber)
        .map((marker) => {
            const markerLine = lines[marker.index] || '';
            const isDedicatedBlock = isDedicatedPlanUnitBlockStart(markerLine, unitLabel, day.dayNumber);
            const boundaryMarkers = isDedicatedBlock
                ? markers.filter((candidate) => (
                    isDedicatedPlanUnitBlockStart(lines[candidate.index] || '', unitLabel, candidate.dayNumber)
                ))
                : markers;
            const nextMarker = boundaryMarkers.find((candidate) => (
                candidate.index > marker.index && candidate.dayNumber !== day.dayNumber
            ));
            const nextBlockBoundaryIndex = isDedicatedBlock
                ? lines.findIndex((line, index) => index > marker.index && !line.trim())
                : -1;
            const sameLineHasOtherUnit = boundaryMarkers.some((candidate) => (
                candidate.index === marker.index && candidate.dayNumber !== day.dayNumber
            ));
            const start = Math.max(0, marker.index - (isDedicatedBlock || sameLineHasOtherUnit ? 0 : 1));
            const end = Math.min(
                nextMarker ? nextMarker.index : lines.length,
                nextBlockBoundaryIndex > marker.index ? nextBlockBoundaryIndex : lines.length,
            );
            const text = sliceSourceLines(lines, start, end);
            const focusScore = scoreLineAgainstTerms(text, focusTerms);
            const wrongMarkerCount = isDedicatedBlock
                ? 0
                : countWrongPlanUnitMarkers(text, unitLabel, day.dayNumber);
            const score = (focusScore * 100)
                + Math.min(text.length, 2400)
                + (isDedicatedBlock ? 5000 : 0)
                - (wrongMarkerCount * 500);

            return {
                index: marker.index,
                text,
                focusScore,
                wrongMarkerCount,
                isDedicatedBlock,
                score,
            };
        })
        .filter((candidate) => candidate.text.length >= 80);

    const preferredCandidates = candidates.some((candidate) => candidate.isDedicatedBlock)
        ? candidates.filter((candidate) => candidate.isDedicatedBlock)
        : candidates;

    return preferredCandidates
        .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
}

function combineMarkerBlockCandidates(candidates: PlanUnitMarkerBlockCandidate[]): string {
    const cleanCandidates = candidates.filter((candidate) => candidate.wrongMarkerCount === 0);
    const selected = (cleanCandidates.length > 0 ? cleanCandidates : candidates)
        .slice(0, 4)
        .sort((a, b) => a.index - b.index);

    const seen = new Set<string>();
    const blocks = selected
        .map((candidate) => candidate.text)
        .filter((text) => {
            const key = normalizeSourceText(text).slice(0, 300);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

    return truncateSourceText(blocks.join('\n\n---\n\n'));
}

function extractPlanUnitSourceBlock(
    content: string,
    unitLabel: PlanUnitLabel,
    day: DayPlan,
): PlanUnitSourceBlock {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
        return { text: '', found: false, strategy: 'full-plan', keyTerms: [] };
    }

    const lines = normalizedContent.split(/\r?\n/);
    const labelsToTry = Array.from(new Set<PlanUnitLabel>([
        unitLabel,
        unitLabel === 'Session' ? 'Day' : 'Session',
    ]));

    for (const label of labelsToTry) {
        const markers = findPlanUnitMarkers(lines, label);
        const candidates = getMarkerBlockCandidates(lines, markers, label, day);
        if (candidates.length > 0) {
            const text = combineMarkerBlockCandidates(candidates);
            return {
                text,
                found: true,
                strategy: 'marker',
                keyTerms: extractImportantTerms(`${day.title} ${day.focus} ${text}`),
            };
        }
    }

    const focusTerms = extractImportantTerms(`${day.title} ${day.focus}`, 10);
    if (focusTerms.length > 0) {
        let bestIndex = -1;
        let bestScore = 0;
        lines.forEach((line, index) => {
            const score = scoreLineAgainstTerms(line, focusTerms);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });

        if (bestIndex >= 0 && bestScore >= Math.min(2, focusTerms.length)) {
            const block = sliceSourceLines(lines, bestIndex - 10, bestIndex + 28);
            if (block.length >= 80) {
                const text = truncateSourceText(block);
                return {
                    text,
                    found: true,
                    strategy: 'focus',
                    keyTerms: extractImportantTerms(`${day.title} ${day.focus} ${text}`),
                };
            }
        }
    }

    const text = truncateSourceText(normalizedContent, SOURCE_CONTEXT_MAX_CHARS);
    return {
        text,
        found: false,
        strategy: 'full-plan',
        keyTerms: extractImportantTerms(`${day.title} ${day.focus} ${text}`),
    };
}

function findWrongUnitReferencesInText(text: string, unitLabel: PlanUnitLabel, dayNumber: number): number[] {
    const regex = planUnitMarkerRegex(unitLabel, undefined, 'gi');
    const wrongNumbers = new Set<number>();

    for (const match of text.matchAll(regex)) {
        const matchedNumber = Number.parseInt(match[1], 10);
        if (Number.isFinite(matchedNumber) && matchedNumber !== dayNumber) {
            wrongNumbers.add(matchedNumber);
        }
    }

    return [...wrongNumbers].sort((a, b) => a - b);
}

function findWrongUnitTitleReferences(slides: Slide[], unitLabel: PlanUnitLabel, dayNumber: number): number[] {
    return findWrongUnitReferencesInText(slides.map((slide) => slide.title || '').join('\n'), unitLabel, dayNumber);
}

function collectPresentationOutlineText(outline: PresentationOutline): string {
    return [
        outline.title,
        outline.unitLabel,
        outline.learningTarget,
        outline.sourceSummary,
        ...outline.missingSourceDetails,
        ...outline.flow.flatMap((step) => [
            step.section,
            step.slideTitle,
            step.slidePurpose,
            ...step.sourceEvidence,
            ...step.keyPoints,
            step.teacherMove,
            step.studentAction,
            step.assessmentCue,
        ]),
    ].filter(Boolean).join(' ');
}

function collectPlanUnitSourceDetailsText(day: DayPlan): string {
    return [
        day.sourceSummary,
        day.sourceObjective,
        ...(day.sourceFlow || []),
        ...(day.sourceMaterials || []),
        day.sourceAssessment,
        day.sourceOutput,
    ].filter(Boolean).join(' ');
}

function validateGeneratedSessionAlignment(
    slides: Slide[],
    sourceBlock: PlanUnitSourceBlock,
    unitLabel: PlanUnitLabel,
    day: DayPlan,
    outline?: PresentationOutline,
): SessionAlignmentIssue[] {
    const issues: SessionAlignmentIssue[] = [];
    const slideText = normalizeSourceText(slides.map((slide) => [
        slide.title,
        ...(Array.isArray(slide.content) ? slide.content : []),
        slide.speakerNotes,
    ].filter(Boolean).join(' ')).join(' '));

    const wrongTitleUnits = findWrongUnitTitleReferences(slides, unitLabel, day.dayNumber);
    if (wrongTitleUnits.length > 0) {
        issues.push({
            code: 'wrong_unit_title',
            message: `Slide titles reference ${unitLabel} ${wrongTitleUnits.join(', ')} while generating ${unitLabel} ${day.dayNumber}.`,
        });
    }

    const focusTerms = extractImportantTerms(`${day.title} ${day.focus}`, 8);
    const focusHits = focusTerms.filter((term) => slideText.includes(term));
    if (focusTerms.length >= 3 && focusHits.length < 2) {
        issues.push({
            code: 'weak_focus_coverage',
            message: `Slides weakly cover the selected ${unitLabel.toLowerCase()} focus. Missing focus terms: ${focusTerms.filter((term) => !focusHits.includes(term)).slice(0, 5).join(', ')}.`,
        });
    }

    if (sourceBlock.found && sourceBlock.keyTerms.length >= 6) {
        const sourceHits = sourceBlock.keyTerms.filter((term) => slideText.includes(term));
        const requiredHits = Math.min(4, Math.ceil(sourceBlock.keyTerms.length * 0.3));
        if (sourceHits.length < requiredHits) {
            issues.push({
                code: 'weak_source_coverage',
                message: `Slides do not preserve enough source-specific details from the extracted ${unitLabel.toLowerCase()} block. Missing source terms: ${sourceBlock.keyTerms.filter((term) => !sourceHits.includes(term)).slice(0, 6).join(', ')}.`,
            });
        }
    }

    const sourceDetailsTerms = extractImportantTerms(collectPlanUnitSourceDetailsText(day), 10);
    if (sourceDetailsTerms.length >= 4) {
        const detailHits = sourceDetailsTerms.filter((term) => slideText.includes(term));
        const requiredHits = Math.min(4, Math.ceil(sourceDetailsTerms.length * 0.35));
        if (detailHits.length < requiredHits) {
            issues.push({
                code: 'weak_source_map_coverage',
                message: `Slides do not preserve enough details from the extracted ${unitLabel.toLowerCase()} source map. Missing source-map terms: ${sourceDetailsTerms.filter((term) => !detailHits.includes(term)).slice(0, 6).join(', ')}.`,
            });
        }
    }

    if (outline) {
        const outlineTerms = extractImportantTerms(collectPresentationOutlineText(outline), 12);
        const outlineHits = outlineTerms.filter((term) => slideText.includes(term));
        const requiredHits = Math.min(5, Math.ceil(outlineTerms.length * 0.35));
        if (outlineTerms.length >= 6 && outlineHits.length < requiredHits) {
            issues.push({
                code: 'weak_outline_coverage',
                message: `Slides do not preserve enough details from the presentation outline. Missing outline terms: ${outlineTerms.filter((term) => !outlineHits.includes(term)).slice(0, 6).join(', ')}.`,
            });
        }
    }

    return [
        ...issues,
        ...validateGeneratedSlideQuality(slides, {
            unitLabel,
            dayNumber: day.dayNumber,
            focus: day.focus,
        }),
    ];
}

function slideVisibleTextLoad(slide: Slide): number {
    return [
        slide.title,
        ...(Array.isArray(slide.content) ? slide.content : []),
    ].filter(Boolean).join(' ').length;
}

function validateGeneratedSlideQuality(slides: Slide[], context: SlideRepairContext = {}): SessionAlignmentIssue[] {
    const issues: SessionAlignmentIssue[] = [];
    const firstSlide = slides[0];
    if (firstSlide) {
        const firstSlideText = [firstSlide.title, ...(firstSlide.content || [])].join(' ');
        if (isGenericDeckTitle(firstSlide.title) || isBadTitleSourceCandidate(firstSlide.title) || BAD_FOCUS_LINE_PATTERN.test(firstSlideText) || TITLE_SOURCE_LEAK_PATTERN.test(firstSlideText)) {
            issues.push({
                code: 'weak_title_slide',
                message: 'The first slide still uses a generic title or a planning/assessment phrase instead of the lesson topic plus session focus.',
            });
        }
        if ((firstSlide.content || []).some((item) => /^grade\s+level\s*:\s*(?:not\s+specified|unknown|n\/?a|none)$/i.test(item.trim()))) {
            issues.push({
                code: 'unknown_title_metadata',
                message: 'The first slide shows unknown metadata instead of omitting it or extracting it from the source.',
            });
        }
        if (context.unitLabel && context.dayNumber) {
            const expectedUnit = `${context.unitLabel} ${context.dayNumber}`.toLowerCase();
            if (!normalizeSourceText(firstSlideText).includes(expectedUnit)) {
                issues.push({
                    code: 'missing_title_context',
                    message: `The first slide should name ${context.unitLabel} ${context.dayNumber} as context below the lesson topic.`,
                });
            }
        }
    }

    slides.forEach((slide, index) => {
        const content = Array.isArray(slide.content) ? slide.content : [];
        if (content.some((item) => EMPTY_VISIBLE_ITEM_PATTERN.test(item.trim()))) {
            issues.push({
                code: 'empty_visible_item',
                message: `Slide ${index + 1} contains an empty bullet, numbered item, or answer option.`,
            });
        }

        const teacherOnlyItems = content.filter(isTeacherOnlyVisibleItem);
        if (teacherOnlyItems.length > 0) {
            issues.push({
                code: 'teacher_only_visible_text',
                message: `Slide ${index + 1} has teacher-facing directions in visible student slide text.`,
            });
        }

        if (content.some(isGenericSuccessCriterion)) {
            issues.push({
                code: 'generic_success_criteria',
                message: `Slide ${index + 1} uses generic success criteria instead of source-specific learning evidence.`,
            });
        }

        if (isGenericClassroomImagePrompt(slide)) {
            issues.push({
                code: 'generic_visual_prompt',
                message: `Slide ${index + 1} asks for a generic classroom image instead of a source-specific instructional visual or text-only slide.`,
            });
        }

        if (isEditableClassroomArtifactSlide(slide) && !hasEditableArtifactStructure(slide)) {
            issues.push({
                code: 'artifact_without_editable_structure',
                message: `Slide ${index + 1} names a card, organizer, checklist, map, chart, or table but does not show enough editable learner-facing structure.`,
            });
        }

        const hasImage = Boolean(slide.imagePrompt || slide.imageUrl) && slide.imageStyle !== 'none';
        const nonEmptyContent = content.filter((item) => item.trim());
        const longestItemLength = Math.max(0, ...nonEmptyContent.map((item) => item.length));
        const visibleLoad = slideVisibleTextLoad(slide);
        const overflowRisk = hasImage
            ? nonEmptyContent.length > 5 || visibleLoad > 460 || longestItemLength > 150
            : nonEmptyContent.length > 7 || visibleLoad > 700 || longestItemLength > 180;
        if (overflowRisk) {
            issues.push({
                code: 'overflow_risk',
                message: `Slide ${index + 1} has too much visible text for its layout and should be split, shortened, or moved into speaker notes.`,
            });
        }
    });

    return issues;
}

function validatePresentationOutlineAlignment(
    outline: PresentationOutline,
    sourceBlock: PlanUnitSourceBlock,
    unitLabel: PlanUnitLabel,
    day: DayPlan,
): SessionAlignmentIssue[] {
    const issues: SessionAlignmentIssue[] = [];
    const outlineRawText = collectPresentationOutlineText(outline);
    const outlineText = normalizeSourceText(outlineRawText);

    const wrongUnits = findWrongUnitReferencesInText(outlineRawText, unitLabel, day.dayNumber);
    if (wrongUnits.length > 0) {
        issues.push({
            code: 'wrong_unit_outline',
            message: `Outline references ${unitLabel} ${wrongUnits.join(', ')} while planning ${unitLabel} ${day.dayNumber}.`,
        });
    }

    const focusTerms = extractImportantTerms(`${day.title} ${day.focus}`, 8);
    const focusHits = focusTerms.filter((term) => outlineText.includes(term));
    if (focusTerms.length >= 3 && focusHits.length < 2) {
        issues.push({
            code: 'weak_outline_focus',
            message: `Outline weakly covers the selected ${unitLabel.toLowerCase()} focus. Missing focus terms: ${focusTerms.filter((term) => !focusHits.includes(term)).slice(0, 5).join(', ')}.`,
        });
    }

    if (sourceBlock.found && sourceBlock.keyTerms.length >= 6) {
        const sourceHits = sourceBlock.keyTerms.filter((term) => outlineText.includes(term));
        const requiredHits = Math.min(5, Math.ceil(sourceBlock.keyTerms.length * 0.35));
        if (sourceHits.length < requiredHits) {
            issues.push({
                code: 'weak_outline_source',
                message: `Outline does not preserve enough source-specific details from the extracted ${unitLabel.toLowerCase()} block. Missing source terms: ${sourceBlock.keyTerms.filter((term) => !sourceHits.includes(term)).slice(0, 6).join(', ')}.`,
            });
        }
    }

    const sourceDetailsTerms = extractImportantTerms(collectPlanUnitSourceDetailsText(day), 10);
    if (sourceDetailsTerms.length >= 4) {
        const detailHits = sourceDetailsTerms.filter((term) => outlineText.includes(term));
        const requiredHits = Math.min(4, Math.ceil(sourceDetailsTerms.length * 0.35));
        if (detailHits.length < requiredHits) {
            issues.push({
                code: 'weak_outline_source_map',
                message: `Outline does not preserve enough details from the extracted ${unitLabel.toLowerCase()} source map. Missing source-map terms: ${sourceDetailsTerms.filter((term) => !detailHits.includes(term)).slice(0, 6).join(', ')}.`,
            });
        }
    }

    return issues;
}

function alignmentRepairInstruction(issues: SessionAlignmentIssue[]): string {
    if (issues.length === 0) return '';

    return `
        **ALIGNMENT REPAIR REQUIRED:**
        The previous draft failed the source-alignment check:
        ${issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n')}

        Regenerate the deck so every slide clearly belongs to the selected session/day source extract. Remove any slide title that points to a different session/day. Preserve source-specific materials, activity steps, expected output, assessment, and assignment details from the selected source extract.
        Also fix any slide-quality failures: visible slide content must be student-facing, teacher actions belong in speaker notes, numbered lists must have no blank items, title slides must show the lesson topic plus session/day context, dense slides must be split or shortened instead of overflowing, generic classroom photo prompts must be removed, and named cards, organizers, checklists, maps, charts, or tables must appear as editable learner-facing slide structure instead of vague bullets.
    `;
}

function outlineRepairInstruction(issues: SessionAlignmentIssue[]): string {
    if (issues.length === 0) return '';

    return `
        **OUTLINE REPAIR REQUIRED:**
        The previous outline failed the source-alignment check:
        ${issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n')}

        Regenerate the outline so it follows only the selected lesson-plan source extract. Remove any activity, assessment, assignment, output, or title that belongs to a different session/day.
    `;
}

function normalizePresentationOutline(
    outline: PresentationOutline,
    fallbackTitle: string,
    fallbackUnitLabel: string,
    fallbackUnitNumber: number,
): PresentationOutline {
    const flow = (Array.isArray(outline.flow) ? outline.flow : [])
        .map((step, index) => ({
            section: normalizeGeneratedString(step?.section, `Step ${index + 1}`),
            slideTitle: normalizeGeneratedString(step?.slideTitle, `${fallbackTitle} ${index + 1}`),
            slidePurpose: normalizeGeneratedString(step?.slidePurpose, 'Present a source-aligned lesson-plan step.'),
            sourceEvidence: normalizeGeneratedStringList(step?.sourceEvidence),
            keyPoints: normalizeGeneratedStringList(step?.keyPoints),
            teacherMove: normalizeGeneratedString(step?.teacherMove, 'Guide students through this lesson-plan step.'),
            studentAction: normalizeGeneratedString(step?.studentAction, 'Respond to the teacher prompt or task.'),
            assessmentCue: normalizeGeneratedString(step?.assessmentCue, 'Check student understanding before moving on.'),
            visualIntent: normalizeGeneratedString(step?.visualIntent, 'No visual needed unless a source-specific material, process, or output is available.'),
        }))
        .filter((step) => step.slideTitle || step.slidePurpose || step.keyPoints.length > 0);

    return {
        title: normalizeGeneratedString(outline.title, fallbackTitle),
        unitLabel: normalizeGeneratedString(outline.unitLabel, fallbackUnitLabel),
        unitNumber: Number.isFinite(outline.unitNumber) && outline.unitNumber > 0
            ? outline.unitNumber
            : fallbackUnitNumber,
        learningTarget: normalizeGeneratedString(outline.learningTarget, fallbackTitle),
        sourceSummary: normalizeGeneratedString(outline.sourceSummary, fallbackTitle),
        flow: flow.length > 0
            ? flow
            : [{
                section: 'Lesson Flow',
                slideTitle: fallbackTitle,
                slidePurpose: 'Present the selected lesson-plan source in a clear sequence.',
                sourceEvidence: [],
                keyPoints: [fallbackTitle],
                teacherMove: 'Guide students through the lesson-plan sequence.',
                studentAction: 'Participate in the planned activity.',
                assessmentCue: 'Check for understanding before closing.',
                visualIntent: 'No visual needed unless a source-specific material, process, or output is available.',
            }],
        missingSourceDetails: normalizeGeneratedStringList(outline.missingSourceDetails),
    };
}

const PRESENTATION_OUTLINE_RESPONSE_SCHEMA = {
    type: JSON_SCHEMA.OBJECT,
    properties: {
        title: { type: JSON_SCHEMA.STRING },
        unitLabel: { type: JSON_SCHEMA.STRING },
        unitNumber: { type: JSON_SCHEMA.INTEGER },
        learningTarget: { type: JSON_SCHEMA.STRING },
        sourceSummary: { type: JSON_SCHEMA.STRING },
        flow: {
            type: JSON_SCHEMA.ARRAY,
            items: {
                type: JSON_SCHEMA.OBJECT,
                properties: {
                    section: { type: JSON_SCHEMA.STRING },
                    slideTitle: { type: JSON_SCHEMA.STRING },
                    slidePurpose: { type: JSON_SCHEMA.STRING },
                    sourceEvidence: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
                    keyPoints: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
                    teacherMove: { type: JSON_SCHEMA.STRING },
                    studentAction: { type: JSON_SCHEMA.STRING },
                    assessmentCue: { type: JSON_SCHEMA.STRING },
                    visualIntent: { type: JSON_SCHEMA.STRING },
                },
                required: ["section", "slideTitle", "slidePurpose", "sourceEvidence", "keyPoints", "teacherMove", "studentAction", "assessmentCue", "visualIntent"],
            },
        },
        missingSourceDetails: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
    },
    required: ["title", "unitLabel", "unitNumber", "learningTarget", "sourceSummary", "flow", "missingSourceDetails"],
};

async function createK12PresentationOutline(params: {
    sourceLabel: string;
    sourceText: string;
    secondarySourceContext?: string;
    format: string;
    flowReference: string;
    language: 'EN' | 'FIL';
    unitLabel: string;
    unitNumber: number;
    targetSlideCount: string;
    fallbackTitle: string;
    blueprint?: LessonBlueprint;
    day?: DayPlan;
    alignmentIssues?: SessionAlignmentIssue[];
}): Promise<PresentationOutline> {
    const {
        sourceLabel,
        sourceText,
        secondarySourceContext,
        format,
        flowReference,
        language,
        unitLabel,
        unitNumber,
        targetSlideCount,
        fallbackTitle,
        blueprint,
        day,
        alignmentIssues = [],
    } = params;
    const blueprintContext = blueprint
        ? `
        **LESSON BLUEPRINT CONTEXT:**
        - Main Title: ${blueprint.mainTitle}
        - Subject: ${blueprint.subject}
        - Grade Level: ${blueprint.gradeLevel}
        - Learning Competency: ${blueprint.learningCompetency}
        - Plan Objectives: ${blueprint.smartObjectives.join(', ')}
        `
        : '';
    const dayContext = day
        ? `
        **SELECTED ${unitLabel.toUpperCase()} ${unitNumber}:**
        - Title: ${day.title}
        - Focus: ${day.focus}
        `
        : '';
    const sourceDetailsContext = day
        ? `
        **EXTRACTED ${unitLabel.toUpperCase()} ${unitNumber} SOURCE MAP:**
        - Source objective/target: ${day.sourceObjective || day.sourceSummary || 'Not explicitly extracted.'}
        - Ordered source flow: ${(day.sourceFlow || []).join(' | ') || 'Use the selected source extract order.'}
        - Materials/resources: ${(day.sourceMaterials || []).join(' | ') || 'Use only materials explicitly named in the selected source extract.'}
        - Assessment/check: ${day.sourceAssessment || 'Use only assessment details explicitly named in the selected source extract.'}
        - Expected output/artifact: ${day.sourceOutput || 'Use only output details explicitly named in the selected source extract.'}
        `
        : '';

    const prompt = `
        You are a senior K-12 instructional designer. Create the PRESENTATION OUTLINE ONLY.
        Do not write final slide content yet.

        **LANGUAGE OF OUTPUT:** Use ${language === 'FIL' ? 'Filipino' : 'English'} for title, learning target, flow, teacher moves, student actions, and assessment cues. Use English for visualIntent.
        **PEDAGOGICAL FORMAT:** ${format}
        **FORMAT FLOW LABELS (REFERENCE ONLY):** ${flowReference}
        **TARGET OUTLINE SIZE:** ${targetSlideCount}.

        ${outlineRepairInstruction(alignmentIssues)}
        ${blueprintContext}
        ${dayContext}
        ${sourceDetailsContext}

        **BINDING LESSON-PLAN SOURCE (${sourceLabel}):**
        This is the source of truth. Extract the teaching flow, materials, prompts, student tasks, assessment, assignment, and output requirements from this source. Preserve the order used by the lesson plan.
        \`\`\`
        ${sourceText}
        \`\`\`

        **SECONDARY CONTEXT:**
        Use this only for shared metadata or missing competency wording. Do not borrow main activities from a different session/day.
        \`\`\`
        ${secondarySourceContext || 'No secondary context provided.'}
        \`\`\`

        **OUTLINE RULES:**
        - The outline is the binding bridge between lesson plan and slide deck.
        - Treat the extracted source map as a concise guide to the selected ${unitLabel.toLowerCase()} only. If it conflicts with the source extract, the source extract wins.
        - Preserve the extracted source flow in order. Use it to decide slide sequence, sourceEvidence, teacherMove, studentAction, assessmentCue, and visualIntent.
        - Add one first \`flow\` item for the title/context slide. Its visible title should be the week topic or lesson name, not merely "${unitLabel} ${unitNumber}". Its key points should narrow to the selected ${unitLabel.toLowerCase()} focus plus subject, grade, week/term, or session context when available.
        - After the title/context item, every \`flow\` item must come from the selected lesson-plan source in the same order the teacher would teach it.
        - Treat the selected source block as an ordered session script. If it has row labels, headings, or table sections, walk them top-to-bottom and convert only the source-backed teaching steps into outline items.
        - Use the format flow labels only as a classification aid. Do not force a Review, Motivation, Activity, Reflection, Assignment, or any other template section unless the source actually contains or clearly implies it.
        - Each \`flow\` item should become one slide plan unless the source step must be split for readability or two adjacent source micro-steps belong on one clear slide.
        - Do not invent new activities, examples, assessments, assignments, or outputs.
        - If a transition must be inferred, keep it small and list it under \`missingSourceDetails\`.
        - Use \`sourceEvidence\` to capture short source-grounded details for each slide plan, such as exact materials, task names, questions, output, rubric, or assignment.
        - Make \`slideTitle\` student-facing and content-specific, not just the pedagogy section name.
        - Make \`keyPoints\` concise. They are planning notes, not final slide bullets.
        - Make \`teacherMove\`, \`studentAction\`, and \`assessmentCue\` practical enough for speaker notes.
        - Make \`visualIntent\` concrete and source-specific. Name the exact object, material, setup, process, expected output, misconception, or real-world setting the image should show.
        - If the source names a card, slip, organizer, checklist, board, map, chart, table, sentence frame, answer frame, or reflection frame, plan it as an editable classroom artifact in slide content first. Its \`visualIntent\` must be "No visual needed" unless the lesson requires a real subject/process photo rather than the classroom material itself.
        - If the source mentions fictional situations, scenario cards, or task cards but does not provide the full text, create short safe classroom examples that directly match the session focus and list them in sourceEvidence/keyPoints so the final deck is usable.
        - If the best visual would only be a teacher, students, group work, writing, worksheet, or classroom board, set \`visualIntent\` to "No visual needed" instead of describing a generic classroom photo.
        - Clean awkward source wording into natural classroom language, but keep the meaning and required task intact.

        **OUTPUT (JSON FORMAT ONLY):**
        Return a single JSON object matching the schema. Do not add extra text.
    `;

    const response = await callGeminiProxy<GeminiTextResponse>({
        task: 'text',
        model: TEXT_MODELS,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: PRESENTATION_OUTLINE_RESPONSE_SCHEMA,
            temperature: 0.2,
        },
    });
    const outline = parseJsonModelResponse<PresentationOutline>(response.text, `${sourceLabel} presentation outline`);
    return normalizePresentationOutline(outline, fallbackTitle, unitLabel, unitNumber);
}

function formatPresentationOutlineForPrompt(outline: PresentationOutline): string {
    return JSON.stringify(outline, null, 2);
}

// PHASE 1: DEEP ANALYSIS & BLUEPRINT CREATION
export async function createK12LessonBlueprint(content: string, format: string, language: 'EN' | 'FIL'): Promise<LessonBlueprint> {
    const inferredPlanUnitInfo = inferPlanUnitInfo(content);
    const prompt = `
        You are a Master K-12 Teacher and Instructional Designer. Your task is to analyze the provided educational content and create a professional, comprehensive Lesson Blueprint for a school setting.

        **LANGUAGE OF OUTPUT:** You MUST generate all content in ${language === 'FIL' ? 'Filipino' : 'English'}.
        **PEDAGOGICAL FORMAT TO FOLLOW:** ${format}

        **INPUT CONTENT:**
        \`\`\`
        ${content}
        \`\`\`

        **YOUR THREE-STEP PROCESS:**

        **STEP 1: Core Component Identification**
        - **Subject, Grade, Quarter, Title:** Identify the Subject, Grade Level, Quarter, and a creative Main Title for the whole lesson plan.
        - **Learning Competency:** Find the primary Learning Competency code and description (e.g., "S6MT-Ia-c-1: Describe mixtures"). This is the most important anchor for the lesson.
        - **Planning Unit Label:** Determine whether the input is organized by "Day" or "Session". If the source uses "Learning Session", "Session 1", "Sesyon 1", "Bilang ng Sesyon", "Number of Sessions", or similar wording, set \`planUnitLabel\` to "Session". Otherwise set it to "Day".

        **STEP 2: SMART Objective Formulation (CRITICAL)**
        - **Analyze Existing Objectives:** Review any objectives listed in the content.
        - **Generate/Refine SMART Objectives:** Based on the Learning Competency, formulate 3-5 **SMART** objectives (Specific, Measurable, Achievable, Relevant, Time-bound). These are for the teacher's reference.
          - Example of a GOOD SMART objective: "By the end of the lesson, students will be able to differentiate between homogeneous and heterogeneous mixtures by correctly classifying 4 out of 5 given examples."
        - **Consolidate for Students:** After creating the SMART objectives, create a separate, consolidated list of 2-3 **student-facing objectives**. These should be concise, use simple language, and ideally start with "I can..." or "You will be able to...". These will be shown to the students on the presentation slide.
          - Example of a GOOD student-facing objective: "I can tell the difference between different types of mixtures."

        **STEP 3: Plan Unit Structuring**
        - **Breakdown:** Structure the plan using the exact units present in the source material.
        - **Explicit Sessions/Days Rule:** If the input lists explicit units such as "Learning Session 1", "Session 1", "Sesyon 1", "Day 1", or "Araw 1", output exactly those numbered units. If the input states a total such as "Bilang ng Sesyon: 5" or "Number of Sessions: 5", output exactly that many Session units.
        - **Fallback Rule:** Only infer a 5-day plan when the source is a traditional weekly DLL without explicit session/day breakdowns.
        - **Unit Focus:** For each unit, provide a concise, specific 8-16 word 'focus' summary that captures the actual lesson topic, skill, activity, assessment, or output for that session/day (e.g., "Introduce inertia through prediction sorting and a coin-card-cup demo", "Analyze acceleration using motion-change evidence tables").
        - **No Generic Focus Text:** Never use vague text such as "from the uploaded lesson plan", "from the source material", "uploaded content", "lesson plan content", or only "Session 1" / "Day 1" for a unit title or focus.
        - **Source Fidelity:** Preserve each unit's objective, pre-lesson, flow, resources, assessment, extended learning, and reflection details when the document provides them.

        **FINAL OUTPUT (JSON FORMAT ONLY):**
        Return a single JSON object matching this schema. Do not add any extra text or explanations.
    `;

    const responseSchema = {
        type: JSON_SCHEMA.OBJECT,
        properties: {
            mainTitle: { type: JSON_SCHEMA.STRING },
            planUnitLabel: { type: JSON_SCHEMA.STRING, enum: ["Day", "Session"] },
            subject: { type: JSON_SCHEMA.STRING },
            gradeLevel: { type: JSON_SCHEMA.STRING },
            quarter: { type: JSON_SCHEMA.STRING },
            learningCompetency: { type: JSON_SCHEMA.STRING },
            smartObjectives: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
            studentFacingObjectives: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
            days: {
                type: JSON_SCHEMA.ARRAY,
                items: {
                    type: JSON_SCHEMA.OBJECT,
                    properties: {
                        dayNumber: { type: JSON_SCHEMA.INTEGER },
                        title: { type: JSON_SCHEMA.STRING },
                        focus: { type: JSON_SCHEMA.STRING }
                    },
                    required: ["dayNumber", "title", "focus"]
                }
            }
        },
        required: ["mainTitle", "planUnitLabel", "subject", "gradeLevel", "quarter", "learningCompetency", "smartObjectives", "studentFacingObjectives", "days"]
    };
    
    const response = await callGeminiProxy<GeminiTextResponse>({
        task: 'text',
        model: TEXT_MODELS,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.3,
            // No tools when using JSON mime; tools cause unsupported mime errors
        },
    });

    const blueprint = parseJsonModelResponse<LessonBlueprint>(response.text, 'lesson blueprint generation');
    return normalizeLessonBlueprintUnits(blueprint, inferredPlanUnitInfo, content, language);
}


export type K12SessionGenerationMilestone =
    | 'outline-start'
    | 'outline-draft-ready'
    | 'outline-repair-start'
    | 'outline-ready'
    | 'slides-start'
    | 'slides-draft-ready'
    | 'slides-repair-start'
    | 'slides-ready';

type K12SessionGenerationOptions = {
    onMilestone?: (milestone: K12SessionGenerationMilestone) => void;
};

// PHASE 2: SLIDE GENERATION (PER DAY)
export async function generateK12SlidesForDay(day: DayPlan, blueprint: LessonBlueprint, originalContent: string, format: string, language: 'EN' | 'FIL', options: K12SessionGenerationOptions = {}): Promise<Slide[]> {
    const blueprintForGeneration = normalizeLessonBlueprintUnits(blueprint, inferPlanUnitInfo(originalContent), originalContent, language);
    const dayForGeneration = blueprintForGeneration.days.find((candidateDay) => candidateDay.dayNumber === day.dayNumber) || day;
    const unitLabel = getPlanUnitLabel(blueprintForGeneration);
    const normalizedUnitLabel = normalizePlanUnitLabel(blueprintForGeneration.planUnitLabel, 'Day');
    const sourceBlock = extractPlanUnitSourceBlock(originalContent, normalizedUnitLabel, dayForGeneration);
    const secondarySourceContext = sourceBlock.found
        ? truncateSourceText(originalContent, SOURCE_CONTEXT_MAX_CHARS)
        : 'Same as the best available source context above.';
    const commonRules = `
    ${K12_ADAPTIVE_PRESENTATION_STANDARD}

    **CRITICAL DIRECTIVES:**
    1.  **SOURCE-DRIVEN FLOW (STRICT):** The lesson plan controls the slide sequence. Do not add a template section just because the pedagogical format names it. Preserve the selected source order after the title/context slide.
    2.  **TITLE/CONTEXT SLIDE (STRICT):** The first slide must use the week topic or lesson name as the main title, then narrow to ${unitLabel} ${day.dayNumber}'s focus in the content. Include grade, subject, week/term, or session context when available. This slide must use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
        - The first slide title should be the topic only, not "${unitLabel} ${day.dayNumber}: ...". Put "${unitLabel} ${day.dayNumber}: ${dayForGeneration.focus || dayForGeneration.title}" in the content/subtitle context.
    3.  **THE 6x6 RULE (STRICT):** Adhere to the 6x6 rule for slide content. Aim for a maximum of 6 bullet points (lines) per slide, and a maximum of 6-8 words per bullet point. This is crucial for readability.
    4.  **IMAGE PROMPTS REQUIRED (CRITICAL FOR ACCURACY):** For EVERY slide, you MUST include the \`imagePrompt\` and \`imageStyle\` fields.
        - **Outline Visual Contract:** For each slide generated from a presentation outline item, derive \`imagePrompt\` from that item's \`visualIntent\` plus its \`sourceEvidence\`. The prompt must show the exact classroom material, demo, task, output, evidence, or misconception from the outline when one is present.
        - **Instructional Visuals:** Prefer visuals that help the teacher teach: before/after comparisons, process diagrams, evidence tables, classroom demos, sorting tasks, expected outputs, or misconception contrasts. Avoid stock-photo style decorative images.
        - **No Generic Classroom Filler:** Do not use image prompts that only show a teacher, students, group work, writing, a worksheet, or a classroom board. If a slide needs a visual, the prompt must name the exact subject-specific object, material, process, output, setting, or misconception from this lesson. If no such concrete visual exists, use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
        - **Real-World Materials Rule:** For Science/STEM/TLE/TVL/AFA slides showing real tools, equipment, facilities, demos, lab setups, worksheets, card sorts, or student outputs, choose \`"photorealistic"\` and prompt for a high-resolution realistic classroom or workplace photo. Use \`"diagram"\` only for invisible models, process relationships, structures, or sequences that a photo cannot teach clearly.
        - **Specificity is Key:** The \`imagePrompt\` must be highly descriptive, detailed, and directly tied to the slide's title and content to ensure visual accuracy. Do not reuse the same generic background prompt across multiple slides. For abstract topics, use a concrete visual metaphor. The prompt MUST be in English.
        - **Example:** For a slide on "Homogeneous Mixtures," a GOOD prompt is: "A clear glass beaker of water with salt crystals dissolving and disappearing into it." A BAD prompt is: "A glass of water."
        - **Style:** Select a suitable \`imageStyle\` from ["photorealistic", "infographic", "illustration", "diagram", "historical photo"].
        - **No Visual:** For text-only slides, title-only slides, agenda slides, objective/goal slides, transition slides, summary slides, or slides where a visual would be decorative, optional, or merely nice-to-have, you MUST use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`. Do not create an image prompt just to fill a layout.
    5.  **TEACHER-READY MATERIALS CONTRACT:** If the source names a situation card, task card, self-rating slip, organizer, checklist, decision board, rubric, map, chart, table, sentence frame, answer frame, reflection card, reflection frame, or output template, make that material visible as editable slide content and set \`"imagePrompt": ""\` and \`"imageStyle": "none"\`. Do not search for or generate a photo of the classroom material itself. If a fictional situation or classroom example is required but missing from the source, create a short, safe, grade-appropriate example that directly matches the session focus.
    6.  **NO TEXT INSIDE GENERATED IMAGES (MANDATORY):** Do NOT request any words, labels, letters, numbers, or captions to appear inside generated images, including diagrams and infographics. If labels are needed for teaching, place them in slide content and speaker notes only; they will be added manually as editable overlays in the app.
    7.  **SPEAKER NOTES (ESSENTIAL):** For EACH slide, provide practical, actionable speaker notes with: teacher move, student action, evidence to collect, and one misconception or check-for-understanding when relevant.
        - **Visible vs Notes:** The \`content\` array is for learner-facing slide text only: what students see, answer, sort, build, check, revise, or submit. Teacher-only directions such as "Teacher checks draft artifact against criteria", "Teacher models...", "circulate", "collect", or "sort support needs" must go in \`speakerNotes\`, not visible slide bullets.
    8.  **CLASSROOM-READY FLOW:** Use concrete teacher-use slide types only when they fit the source lesson: Do Now/Hook, Think-Pair-Share, Teacher Demo, Group Task, Guided Model, Misconception Check, Exit Ticket, and Homework/Home Connection. Do not make every slide the same bullet-summary format.
    9.  **SOURCE DETAIL FIDELITY:** Pull exact materials, questions, examples, expected outputs, assessment criteria, and extended-learning details from the uploaded plan when available. Do not replace specific lesson-plan details with generic summaries.
    10. **PEDAGOGICAL ALIGNMENT & TITLES:** The slide sequence must follow the presentation outline, which is source-derived. Use **${format}** section names only when they accurately describe a source step. Slide titles must be creative and directly reflect the content, NOT generic section names.
    11. **CONTENT & CLARITY (CRITICAL):**
        - **Avoid Overcrowding (STRICT RULE):** Your primary goal is readability and clarity. A single slide should NEVER be a wall of text. As a strict rule, if a topic requires more than 5-6 bullet points or a few short sentences, you MUST split it into multiple, logically sequenced slides. This is not optional. Use clear follow-up titles (e.g., "Topic (Continued)" or a specific sub-topic title).
        - **Decompose Lists:** When a slide introduces multiple distinct concepts (e.g., three types of volcanoes), create a separate slide for each concept and provide a unique, relevant \`imagePrompt\`.
        - **Brevity:** Use clear, student-facing language in bullet points. Avoid long paragraphs.
        - **Line Separation:** Every bullet point or list item MUST be a separate string in the 'content' array.
        - **Complete Lists:** Never output an empty numbered item, empty answer option, or placeholder-only bullet. If the source has only three assessment items, show three items and do not write "4.".
    12. **CLOSING SOURCE STEP:** The final slide must represent the final source-backed step in the selected lesson flow, such as assessment, expected output, reflection, assignment, or handoff. Do not invent a summary or assignment if the source does not provide one.
    `;
    
    const flowReference = getK12FlowReference(format);
    let outlineIssues: SessionAlignmentIssue[] = [];
    let presentationOutline: PresentationOutline | null = null;

    for (let attempt = 0; attempt <= MAX_ALIGNMENT_REPAIR_ATTEMPTS; attempt += 1) {
        options.onMilestone?.(attempt === 0 ? 'outline-start' : 'outline-repair-start');
        presentationOutline = await createK12PresentationOutline({
            sourceLabel: `${unitLabel} ${day.dayNumber} source extract`,
            sourceText: sourceBlock.text,
            secondarySourceContext,
            format,
            flowReference,
            language,
            unitLabel,
            unitNumber: day.dayNumber,
            targetSlideCount: 'adaptive to the lesson-plan flow, usually 8-14 slide-plan items for one class session',
            fallbackTitle: dayForGeneration.title,
            blueprint: blueprintForGeneration,
            day: dayForGeneration,
            alignmentIssues: outlineIssues,
        });
        options.onMilestone?.('outline-draft-ready');
        outlineIssues = validatePresentationOutlineAlignment(presentationOutline, sourceBlock, normalizedUnitLabel, dayForGeneration);

        if (outlineIssues.length === 0 || attempt === MAX_ALIGNMENT_REPAIR_ATTEMPTS) {
            if (outlineIssues.length > 0) {
                console.warn('Generated presentation outline still has source-alignment warnings after repair.', {
                    unitLabel,
                    dayNumber: day.dayNumber,
                    issues: outlineIssues,
                });
            }
            options.onMilestone?.('outline-ready');
            break;
        }
    }

    if (!presentationOutline) {
        throw new Error(`${unitLabel} ${day.dayNumber} presentation outline was not generated.`);
    }
    const boundPresentationOutline = presentationOutline;
    const topicTitle = extractSourceTopicTitle(originalContent, blueprintForGeneration.mainTitle || boundPresentationOutline.title);

    const buildPrompt = (alignmentIssues: SessionAlignmentIssue[] = []) => `
        You are a professional K-12 Instructional Designer creating a slide deck for a teacher.
        
        **LANGUAGE OF OUTPUT:** You MUST generate all content (titles, content, speaker notes) in ${language === 'FIL' ? 'Filipino' : 'English'}. However, image prompts must ALWAYS be in English.

        ${alignmentRepairInstruction(alignmentIssues)}

        **LESSON BLUEPRINT:**
        - Main Title: ${blueprintForGeneration.mainTitle}
        - Subject: ${blueprintForGeneration.subject}
        - Grade Level: ${blueprintForGeneration.gradeLevel}
        - Learning Competency: ${blueprintForGeneration.learningCompetency}
        - SMART Objectives for the Plan: ${blueprintForGeneration.smartObjectives.join(", ")}
        
        **TODAY'S FOCUS (${unitLabel.toUpperCase()} ${day.dayNumber}):**
        - Title: ${dayForGeneration.title}
        - Focus: ${dayForGeneration.focus}
        - Source objective/target: ${dayForGeneration.sourceObjective || dayForGeneration.sourceSummary || 'Use the selected source extract.'}
        - Ordered source flow: ${(dayForGeneration.sourceFlow || []).join(' | ') || 'Use the selected source extract order.'}
        - Materials/resources: ${(dayForGeneration.sourceMaterials || []).join(' | ') || 'Use only source-named materials.'}
        - Assessment/check: ${dayForGeneration.sourceAssessment || 'Use only source-named assessment details.'}
        - Expected output/artifact: ${dayForGeneration.sourceOutput || 'Use only source-named output details.'}

        **SELECTED ${unitLabel.toUpperCase()} ${day.dayNumber} SOURCE EXTRACT (${sourceBlock.strategy.toUpperCase()} MATCH):**
        ${sourceBlock.found
            ? 'This extract is the binding source for the main lesson flow. Preserve its source-specific materials, questions, tasks, outputs, assessment, assignment, and reflection details when present.'
            : `No exact ${unitLabel} ${day.dayNumber} block was found, so use Today's Focus plus this best available source context. Do not invent details that conflict with the full plan.`
        }
        Key source terms to preserve when relevant: ${sourceBlock.keyTerms.slice(0, 10).join(', ') || 'none detected'}.
        \`\`\`
        ${sourceBlock.text}
        \`\`\`

        **PRESENTATION OUTLINE (BINDING PLAN):**
        This outline was extracted from the selected lesson-plan source. Generate the slide deck from this outline in order. Do not add, remove, reorder, or replace lesson activities, assessments, assignments, or outputs unless needed to split one dense outline item into readable slides.
        \`\`\`json
        ${formatPresentationOutlineForPrompt(boundPresentationOutline)}
        \`\`\`

        **FULL REFERENCE LESSON PLAN/TOPIC CONTENT (SECONDARY CONTEXT):**
        Use this only to resolve missing context, shared competency wording, or resources. If it conflicts with the selected source extract, the selected extract wins.
        \`\`\`
        ${secondarySourceContext}
        \`\`\`

        **TASK:**
        Generate a source-aligned slide deck for ${unitLabel} ${day.dayNumber} ONLY from the presentation outline. The slide count must be adaptive: use enough slides to make the source flow teachable, but do not pad to a fixed count.
        If the reference content includes session-specific columns or rows, use only the details tied to ${unitLabel} ${day.dayNumber} for the main lesson flow. Do not borrow activities, assessments, assignments, or outputs from a different ${unitLabel.toLowerCase()} except for a brief review reference when pedagogically necessary.

        **FORMAT FLOW LABELS (REFERENCE ONLY, NOT A CHECKLIST):**
        ${flowReference}

        ${commonRules}

        **OUTPUT (JSON FORMAT ONLY):**
        Return a single JSON object. Do not add any extra text.
    `;

    const responseSchema = {
        type: JSON_SCHEMA.OBJECT,
        properties: {
            slides: {
                type: JSON_SCHEMA.ARRAY,
                items: {
                    type: JSON_SCHEMA.OBJECT,
                    properties: {
                        title: { type: JSON_SCHEMA.STRING },
                        content: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
                        speakerNotes: { type: JSON_SCHEMA.STRING },
                        imagePrompt: { type: JSON_SCHEMA.STRING },
                        imageStyle: { type: JSON_SCHEMA.STRING, enum: ["photorealistic", "infographic", "illustration", "diagram", "historical photo", "none"] }
                    },
                    required: ["title", "content", "speakerNotes", "imagePrompt", "imageStyle"] 
                }
            }
        },
        required: ["slides"]
    };

    const requestSlides = async (prompt: string): Promise<{ slides: Slide[]; groundingChunks?: GroundingChunk[] }> => {
        const response = await callGeminiProxy<GeminiTextResponse>({
            task: 'text',
            model: TEXT_MODELS,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.4,
                // Removed tools because Gemini does not support tool use with JSON mime responses
            },
        });
        const data = parseJsonModelResponse<{ slides: Slide[] }>(response.text, `day ${day.dayNumber} slide generation`);
        const slides = repairGeneratedSlidesForClassroomUse(data.slides.map((s: any) => ({
            ...s,
            content: cleanSlideContent(s.content),
        })), {
            topicTitle,
            unitLabel,
            dayNumber: day.dayNumber,
            focus: dayForGeneration.focus || dayForGeneration.title,
            subject: blueprintForGeneration.subject,
            gradeLevel: blueprintForGeneration.gradeLevel,
        });

        return { slides, groundingChunks: response.groundingChunks };
    };

    try {
        let alignmentIssues: SessionAlignmentIssue[] = [];

        for (let attempt = 0; attempt <= MAX_ALIGNMENT_REPAIR_ATTEMPTS; attempt += 1) {
            options.onMilestone?.(attempt === 0 ? 'slides-start' : 'slides-repair-start');
            const { slides, groundingChunks } = await requestSlides(buildPrompt(alignmentIssues));
            options.onMilestone?.('slides-draft-ready');
            alignmentIssues = validateGeneratedSessionAlignment(slides, sourceBlock, normalizedUnitLabel, dayForGeneration, boundPresentationOutline);

            if (alignmentIssues.length === 0 || attempt === MAX_ALIGNMENT_REPAIR_ATTEMPTS) {
                if (alignmentIssues.length > 0) {
                    console.warn('Generated session deck still has source-alignment warnings after repair.', {
                        unitLabel,
                        dayNumber: day.dayNumber,
                        issues: alignmentIssues,
                    });
                }
                appendGroundingSources(slides, groundingChunks);
                options.onMilestone?.('slides-ready');
                return slides;
            }
        }

        throw new Error(`${unitLabel} ${day.dayNumber} did not pass source alignment.`);

    } catch (e) {
        console.error(`Failed to generate slides for Day ${day.dayNumber}`, e);
        throw e;
    }
}


// K-12 SINGLE LESSON GENERATION
export async function generateK12SingleLessonSlides(content: string, format: string, language: 'EN' | 'FIL', onProgress?: (message: string) => void): Promise<Presentation> {
    if (onProgress) onProgress(`Structuring your complete lesson...`);

    const flowReference = getK12FlowReference(format);
    const sourceText = content.trim();
    const presentationOutline = await createK12PresentationOutline({
        sourceLabel: 'single lesson plan',
        sourceText,
        secondarySourceContext: 'Same as the binding single lesson plan source.',
        format,
        flowReference,
        language,
        unitLabel: 'Lesson',
        unitNumber: 1,
        targetSlideCount: 'adaptive to the lesson-plan flow, usually 8-14 slide-plan items for one class period',
        fallbackTitle: 'Single Lesson Presentation',
    });

    const prompt = `
        You are a Master K-12 Teacher and Instructional Designer creating a complete, professional slide presentation for a single lesson.

        **LANGUAGE OF OUTPUT:** You MUST generate all content (titles, content, speaker notes) in ${language === 'FIL' ? 'Filipino' : 'English'}. However, image prompts must ALWAYS be in English.

        **PRESENTATION OUTLINE (BINDING PLAN):**
        This outline was extracted from the lesson plan. Generate the slide deck from this outline in order. Do not add, remove, reorder, or replace lesson activities, assessments, assignments, or outputs unless needed to split one dense outline item into readable slides.
        \`\`\`json
        ${formatPresentationOutlineForPrompt(presentationOutline)}
        \`\`\`

        **INPUT LESSON PLAN / TOPIC (FACTUAL REFERENCE ONLY):**
        \`\`\`
        ${sourceText}
        \`\`\`

        **TASK:**
        Generate a comprehensive slide deck for a single, self-contained lesson from the presentation outline. The presentation must be engaging, clear, and logically structured from start to finish, but the uploaded lesson plan controls the order and scope.

        **PEDAGOGICAL FORMAT TO FOLLOW:** ${format}
        **FORMAT FLOW LABELS (REFERENCE ONLY, NOT A CHECKLIST):** ${flowReference}

        ${K12_ADAPTIVE_PRESENTATION_STANDARD}

        **CRITICAL DIRECTIVES:**
        1.  **SOURCE-DRIVEN FLOW (STRICT):** The lesson plan controls the slide sequence. Do not add a template section just because the pedagogical format names it. Preserve the source order after the title/context slide.
        2.  **TITLE/CONTEXT SLIDE (STRICT):** The first slide must use the week topic, lesson name, or strongest source title as the main title. Add subject, grade, term/week, or lesson context when available. This slide must use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
            - The first slide title should be the topic only. Put lesson/session context in the visible content/subtitle, not as a generic title.
        3.  **THE 6x6 RULE (STRICT):** Adhere to the 6x6 rule for slide content. Aim for a maximum of 6 bullet points (lines) per slide, and a maximum of 6-8 words per bullet point. This is crucial for readability.
        4.  **IMAGE PROMPTS REQUIRED (CRITICAL FOR ACCURACY):** For EVERY slide, you MUST include the \`imagePrompt\` and \`imageStyle\` fields.
            - **Outline Visual Contract:** Derive each \`imagePrompt\` from the matching presentation outline item's \`visualIntent\` plus \`sourceEvidence\`. The prompt must show the exact classroom material, demo, task, output, evidence, or misconception from the outline when one is present.
            - **Instructional Visuals:** Prefer visuals that help the teacher teach: before/after comparisons, process diagrams, evidence tables, classroom demos, sorting tasks, expected outputs, or misconception contrasts. Avoid stock-photo style decorative images.
            - **No Generic Classroom Filler:** Do not use image prompts that only show a teacher, students, group work, writing, a worksheet, or a classroom board. If a slide needs a visual, the prompt must name the exact subject-specific object, material, process, output, setting, or misconception from this lesson. If no such concrete visual exists, use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
            - **Real-World Materials Rule:** For Science/STEM/TLE/TVL/AFA slides showing real tools, equipment, facilities, demos, lab setups, worksheets, card sorts, or student outputs, choose \`"photorealistic"\` and prompt for a high-resolution realistic classroom or workplace photo. Use \`"diagram"\` only for invisible models, process relationships, structures, or sequences that a photo cannot teach clearly.
            - **Specificity is Key:** The \`imagePrompt\` must be highly descriptive, detailed, and directly tied to the slide's title and content to ensure visual accuracy. Do not reuse the same generic background prompt across multiple slides. For abstract topics, use a concrete visual metaphor. The prompt MUST be in English.
            - **Example:** For a slide on "Homogeneous Mixtures," a GOOD prompt is: "A clear glass beaker of water with salt crystals dissolving and disappearing into it." A BAD prompt is: "A glass of water."
            - **Style:** Select a suitable \`imageStyle\` from ["photorealistic", "infographic", "illustration", "diagram", "historical photo"].
            - **No Visual:** For text-only slides, title-only slides, agenda slides, objective/goal slides, transition slides, summary slides, or slides where a visual would be decorative, optional, or merely nice-to-have, you MUST use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`. Do not create an image prompt just to fill a layout.
        5.  **TEACHER-READY MATERIALS CONTRACT:** If the source names a situation card, task card, self-rating slip, organizer, checklist, decision board, rubric, map, chart, table, sentence frame, answer frame, reflection card, reflection frame, or output template, make that material visible as editable slide content and set \`"imagePrompt": ""\` and \`"imageStyle": "none"\`. Do not search for or generate a photo of the classroom material itself. If a fictional situation or classroom example is required but missing from the source, create a short, safe, grade-appropriate example that directly matches the lesson focus.
        6.  **NO TEXT INSIDE GENERATED IMAGES (MANDATORY):** Do NOT request any words, labels, letters, numbers, or captions to appear inside generated images, including diagrams and infographics. If labels are needed for teaching, place them in slide content and speaker notes only; they will be added manually as editable overlays in the app.
        7.  **SPEAKER NOTES (ESSENTIAL):** For EACH slide, provide practical, actionable speaker notes with: teacher move, student action, evidence to collect, and one misconception or check-for-understanding when relevant.
            - **Visible vs Notes:** The \`content\` array is for learner-facing slide text only: what students see, answer, sort, build, check, revise, or submit. Teacher-only directions such as "Teacher checks draft artifact against criteria", "Teacher models...", "circulate", "collect", or "sort support needs" must go in \`speakerNotes\`, not visible slide bullets.
        8.  **CLASSROOM-READY FLOW:** Use concrete teacher-use slide types only when they fit the source lesson: Do Now/Hook, Think-Pair-Share, Teacher Demo, Group Task, Guided Model, Misconception Check, Exit Ticket, and Homework/Home Connection. Do not make every slide the same bullet-summary format.
        9.  **SOURCE DETAIL FIDELITY:** Pull exact materials, questions, examples, expected outputs, assessment criteria, and extended-learning details from the uploaded plan when available. Do not replace specific lesson-plan details with generic summaries.
        10. **PEDAGOGICAL ALIGNMENT & TITLES:** The slide sequence must follow the presentation outline, which is source-derived. Use **${format}** section names only when they accurately describe a source step. Slide titles must be creative and directly reflect the content, NOT generic section names.
        11. **CONTENT & CLARITY (CRITICAL):**
            - **Avoid Overcrowding (STRICT RULE):** Your primary goal is readability and clarity. A single slide should NEVER be a wall of text. As a strict rule, if a topic requires more than 5-6 bullet points or a few short sentences, you MUST split it into multiple, logically sequenced slides. This is not optional. Use clear follow-up titles (e.g., "Topic (Continued)" or a specific sub-topic title).
            - **Decompose Lists:** When a slide introduces multiple distinct concepts (e.g., three types of rocks), create a separate slide for each concept and provide a unique, relevant \`imagePrompt\`.
            - **Brevity:** Use clear, student-facing language in bullet points. Avoid long paragraphs. Use markdown bolding (\`**term**\`) for key terminology.
            - **Line Separation:** Every bullet point or list item MUST be a separate string in the 'content' array.
            - **Complete Lists:** Never output an empty numbered item, empty answer option, or placeholder-only bullet. If the source has only three assessment items, show three items and do not write "4.".
        12. **CLOSING SOURCE STEP:** The final slide must represent the final source-backed step in the lesson flow, such as assessment, expected output, reflection, assignment, or handoff. Do not invent a summary or assignment if the source does not provide one.

        **OUTPUT (JSON FORMAT ONLY):**
        Return a single JSON object. Do not add any extra text.
    `;

    const responseSchema = {
        type: JSON_SCHEMA.OBJECT,
        properties: {
            title: { type: JSON_SCHEMA.STRING },
            slides: {
                type: JSON_SCHEMA.ARRAY,
                items: {
                    type: JSON_SCHEMA.OBJECT,
                    properties: {
                        title: { type: JSON_SCHEMA.STRING },
                        content: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
                        speakerNotes: { type: JSON_SCHEMA.STRING },
                        imagePrompt: { type: JSON_SCHEMA.STRING },
                        imageStyle: { type: JSON_SCHEMA.STRING, enum: ["photorealistic", "infographic", "illustration", "diagram", "historical photo", "none"] }
                    },
                    required: ["title", "content", "speakerNotes", "imagePrompt", "imageStyle"]
                }
            }
        },
        required: ["title", "slides"]
    };

    if (onProgress) onProgress(`Generating slide content from the outline...`);
    const response = await callGeminiProxy<GeminiTextResponse>({
        task: 'text',
        model: TEXT_MODELS,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.4,
            // No tools when using JSON mime; tools cause unsupported mime errors
        },
    });
    const data = parseJsonModelResponse<{ title: string; slides: Slide[] }>(response.text, 'single lesson generation');
    const topicTitle = extractSourceTopicTitle(sourceText, data.title || presentationOutline.title);
    const slides = repairGeneratedSlidesForClassroomUse(data.slides.map((s: any) => ({
         ...s,
         content: cleanSlideContent(s.content),
    })), {
        topicTitle,
        unitLabel: 'Lesson',
        dayNumber: 1,
        subject: extractSourceSubject(sourceText),
        gradeLevel: extractSourceGradeLevel(sourceText),
    });
    appendGroundingSources(slides, response.groundingChunks);

    return {
        title: topicTitle || data.title,
        slides: slides
    };
}


// --- COLLEGE GENERATION LOGIC ---

export async function generateCollegeLectureSlides(topic: string, objectives: string, language: 'EN' | 'FIL', onProgress?: (message: string) => void): Promise<Presentation> {
    if (onProgress) onProgress(`Structuring your lecture...`);

    const prompt = `
        You are a Subject Matter Expert and University Lecturer creating a professional presentation for a college-level course.

        **LANGUAGE OF OUTPUT:** You MUST generate all content (titles, content, speaker notes) in ${language === 'FIL' ? 'Filipino' : 'English'}. However, image prompts must ALWAYS be in English.

        **LECTURE TOPIC:** ${topic}
        **LEARNING OBJECTIVES:**
        ${objectives}

        **TASK:**
        Create a comprehensive slide deck for a single, cohesive university lecture (approx. 50-90 minutes). The presentation must be sophisticated, academically rigorous, and logically structured.

        **REQUIRED LECTURE STRUCTURE:**
        1.  Title Slide
        2.  Agenda/Objectives Slide
        3.  Introduction/Hook
        4.  Key Concepts (Multiple Slides)
        5.  Case Study / Example / Application
        6.  Discussion Questions
        7.  Summary/Conclusion
        8.  Next Steps / Further Reading

        **CRITICAL DIRECTIVES:**
        1.  **THE 6x6 RULE (STRICT):** Adhere to the 6x6 rule for slide content. Aim for a maximum of 6 bullet points (lines) per slide, and a maximum of 6-8 words per bullet point. This is crucial for readability and applies to all content slides.
        2.  **IMAGE PROMPTS REQUIRED (CRITICAL FOR ACCURACY):** For EVERY slide, you MUST include the \`imagePrompt\` and \`imageStyle\` fields.
            - **Specificity is Key:** The \`imagePrompt\` must be detailed, academic, and directly tied to the slide's title and content to ensure visual accuracy. For abstract concepts, use a sophisticated visual metaphor. The prompt MUST be in English.
            - **No Generic Classroom Filler:** Do not use image prompts that only show a teacher, students, group work, writing, a worksheet, or a classroom board. If a slide needs a visual, the prompt must name the exact subject-specific object, material, process, output, setting, or misconception from this lesson. If no such concrete visual exists, use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
            - **Example:** For a slide on "Quantum Superposition," a GOOD prompt is: "A diagram showing a single particle, like an electron, existing in multiple states simultaneously, represented by overlapping, semi-transparent wave functions." A BAD prompt is: "An atom."
            - **Style:** Select a professional \`imageStyle\` from ["photorealistic", "diagram", "infographic", "historical photo"].
            - **No Visual:** For text-only slides (like an agenda), summary slides, or slides where a visual would be decorative, optional, or merely nice-to-have, you MUST use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`. Do not create an image prompt just to fill a layout.
        3.  **NO TEXT INSIDE GENERATED IMAGES (MANDATORY):** Do NOT request any words, labels, letters, numbers, or captions to appear inside generated images, including diagrams and infographics. If labels are needed for teaching, place them in slide content and speaker notes only; they will be added manually as editable overlays in the app.
        4.  **SPEAKER NOTES:** Provide insightful speaker notes for each slide to guide the lecturer, including potential discussion points, deeper explanations, or transitions.
        5.  **CONTENT & CLARITY (CRITICAL):**
            - **Avoid Overcrowding (STRICT RULE):** Your primary goal is academic clarity. A single slide must never be a dense wall of text. As a strict rule, if a single concept requires more than 5-6 concise points or a dense paragraph, you MUST break it down into multiple, logically sequenced slides to allow for focused discussion. Use clear follow-up titles (e.g., "Topic - Part 2" or a more specific sub-topic title). Prioritize depth over density.
            - **Decompose Lists:** When introducing several key items (e.g., multiple theories, examples), create a separate slide for each to allow for focused discussion. Generate a relevant \`imagePrompt\` for each.
            - **Professionalism:** Prioritize clarity and a clear content hierarchy. The tone must be authoritative and academic. Use markdown bolding (\`**term**\`) for key terminology.
            - **Line Separation:** Every bullet point or paragraph MUST be a separate string in the 'content' array.
        6.  **STYLE PREFERENCE:** Strongly prefer "photorealistic", "diagram", and "infographic". AVOID "illustration" for this academic context.
        7.  **CONCLUDING SLIDE (MANDATORY):** The final slide of the lecture MUST be the 'Next Steps / Further Reading' slide. Do not add any other slides after it.

        **OUTPUT (JSON FORMAT ONLY):**
        Return a single JSON object. Do not add any extra text.
    `;

     const responseSchema = {
        type: JSON_SCHEMA.OBJECT,
        properties: {
            title: { type: JSON_SCHEMA.STRING },
            slides: {
                type: JSON_SCHEMA.ARRAY,
                items: {
                    type: JSON_SCHEMA.OBJECT,
                    properties: {
                        title: { type: JSON_SCHEMA.STRING },
                        content: { type: JSON_SCHEMA.ARRAY, items: { type: JSON_SCHEMA.STRING } },
                        speakerNotes: { type: JSON_SCHEMA.STRING },
                        imagePrompt: { type: JSON_SCHEMA.STRING },
                        imageStyle: { type: JSON_SCHEMA.STRING, enum: ["photorealistic", "infographic", "diagram", "historical photo", "none"] }
                    },
                    required: ["title", "content", "speakerNotes", "imagePrompt", "imageStyle"]
                }
            }
        },
        required: ["title", "slides"]
    };

    if (onProgress) onProgress(`Generating slide content...`);
    const response = await callGeminiProxy<GeminiTextResponse>({
        task: 'text',
        model: TEXT_MODELS,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.5,
            // Removed tools because Gemini does not support tool use with JSON mime responses
        },
    });
    const data = parseJsonModelResponse<{ title: string; slides: Slide[] }>(response.text, 'college lecture generation');
    const slides = data.slides.map((s: any) => ({
         ...s,
         content: cleanSlideContent(s.content),
    }));
    appendGroundingSources(slides, response.groundingChunks);

    return {
        title: data.title,
        slides: slides
    };
}


// --- IMAGE GENERATION ---

export async function getCachedImageResultForPrompt(prompt: string, style: ImageStyle = 'illustration', language: 'EN' | 'FIL', cacheId?: string, semanticCacheId?: string, semanticMetadata?: ImageSemanticMetadata): Promise<ImagePromptResult | null> {
    if (!prompt || style === 'none' || IMAGES_DISABLED) {
        return null;
    }

    const finalPrompt = buildFinalImagePrompt(prompt, style, language);

    const response = await callGeminiProxy<GeminiImageResponse>({
        task: 'cachedImage',
        model: IMAGE_MODELS,
        contents: {
            prompt: finalPrompt,
            ...(cacheId ? { cacheId } : {}),
            ...(semanticCacheId ? { semanticCacheId } : {}),
            ...(semanticMetadata ? { semanticMetadata } : {}),
        },
        config: {
            imageConfig: {
                aspectRatio: "16:9",
            },
        },
    });

    return response.dataUrl
        ? {
            dataUrl: response.dataUrl,
            provider: response.provider,
            attribution: response.attribution,
            cache: response.cache,
        }
        : null;
}

export async function getCachedImageForPrompt(prompt: string, style: ImageStyle = 'illustration', language: 'EN' | 'FIL', cacheId?: string, semanticCacheId?: string, semanticMetadata?: ImageSemanticMetadata): Promise<string | null> {
    const result = await getCachedImageResultForPrompt(prompt, style, language, cacheId, semanticCacheId, semanticMetadata);
    return result?.dataUrl || null;
}

export async function cacheUploadedImageForPrompt(prompt: string, dataUrl: string, style: ImageStyle = 'illustration', language: 'EN' | 'FIL', cacheId?: string, semanticCacheId?: string, semanticMetadata?: ImageSemanticMetadata): Promise<boolean> {
    if (!prompt || !dataUrl || style === 'none' || IMAGES_DISABLED) {
        return false;
    }

    const finalPrompt = buildFinalImagePrompt(prompt, style, language);

    const response = await callGeminiProxy<GeminiImageResponse>({
        task: 'cacheImage',
        model: IMAGE_MODELS,
        contents: {
            prompt: finalPrompt,
            dataUrl,
            ...(cacheId ? { cacheId } : {}),
            ...(semanticCacheId ? { semanticCacheId } : {}),
            ...(semanticMetadata ? { semanticMetadata } : {}),
        },
        config: {
            imageConfig: {
                aspectRatio: "16:9",
            },
        },
    });

    return response.ok === true;
}

export async function generateImageResultFromPrompt(
    prompt: string,
    style: ImageStyle = 'illustration',
    language: 'EN' | 'FIL',
    cacheId?: string,
    semanticCacheId?: string,
    semanticMetadata?: ImageSemanticMetadata,
    allowPaidImageGeneration = true
): Promise<ImagePromptResult> {
    if (!prompt || style === 'none') {
        return Promise.resolve({ dataUrl: '' });
    }

    const finalPrompt = buildFinalImagePrompt(prompt, style, language);

    try {
        const response = await callGeminiProxy<GeminiImageResponse>({
            task: 'image',
            model: IMAGE_MODELS,
            contents: {
                parts: [{ text: finalPrompt }],
                allowPaidImageGeneration,
                ...(cacheId ? { cacheId } : {}),
                ...(semanticCacheId ? { semanticCacheId } : {}),
                ...(semanticMetadata ? { semanticMetadata } : {}),
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9",
                },
            },
        });

        if (response.dataUrl) {
            return {
                dataUrl: response.dataUrl,
                provider: response.provider,
                attribution: response.attribution,
                cache: response.cache,
            };
        }

        if (response.paidImageGenerationSkipped) {
            return {
                dataUrl: '',
                provider: response.provider,
                attribution: response.attribution,
                cache: response.cache,
            };
        }

        if (response.blockReason) {
            throw new Error('Image generation was blocked. Try a different prompt.');
        }

        if (response.explanation) {
            console.warn('Image generation returned unusable data.');
            throw new Error('Image generation did not return usable image data.');
        }

        throw new Error(response.error || "No image data found in the response.");
    } catch (error) {
        console.error('Image generation failed.');
        throw error;
    }
}

export async function generateImageFromPrompt(
    prompt: string,
    style: ImageStyle = 'illustration',
    language: 'EN' | 'FIL',
    cacheId?: string,
    semanticCacheId?: string,
    semanticMetadata?: ImageSemanticMetadata,
    allowPaidImageGeneration = true
): Promise<string> {
    const result = await generateImageResultFromPrompt(prompt, style, language, cacheId, semanticCacheId, semanticMetadata, allowPaidImageGeneration);
    return result.dataUrl;
}
