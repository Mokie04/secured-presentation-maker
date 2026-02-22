
import { Presentation, Slide, LessonBlueprint, DayPlan, ImageStyle } from '../types';

type ClientEnv = {
    VITE_GEMINI_PROXY_BASE_URL?: string;
    VITE_GEMINI_TEXT_MODEL?: string;
    VITE_GEMINI_IMAGE_MODEL?: string;
};

const ENV = (import.meta as ImportMeta & { env?: ClientEnv }).env ?? {};

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
    return Array.from(
        new Set(
            values
                .map((value) => value?.trim())
                .filter((value): value is string => Boolean(value))
        )
    );
}

// Prefer low-cost models first, with safe fallback.
const TEXT_MODELS = uniqueNonEmpty([
    ENV.VITE_GEMINI_TEXT_MODEL,
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3-flash-preview",
]);

const IMAGE_MODELS = uniqueNonEmpty([
    ENV.VITE_GEMINI_IMAGE_MODEL,
    "gemini-2.0-flash-image",
    "gemini-2.5-flash-image",
]);

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
};

type GeminiProxyRequest = {
    task: 'text' | 'image';
    model: string | string[];
    contents: unknown;
    config?: Record<string, unknown>;
};

export type OpenEducationalImage = {
    url: string;
    dataUrl?: string;
    title: string;
    source: string;
    license: string;
    creator?: string;
    attribution?: string;
    confidence: number;
    landingUrl?: string;
};

function getProxyBaseUrl(): string {
    const normalizedBase = (ENV.VITE_GEMINI_PROXY_BASE_URL || '').replace(/\/$/, '');
    return normalizedBase;
}

type ProxyError = Error & { status?: number };

function shouldRetryProxyError(status: number | undefined, message: string): boolean {
    const upperMessage = message.toUpperCase();
    return [429, 500, 502, 503, 504].includes(status || 0)
        || upperMessage.includes('UNAVAILABLE')
        || upperMessage.includes('HIGH DEMAND')
        || upperMessage.includes('TRY AGAIN LATER');
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

    const maxAttempts = 3;
    let lastError: ProxyError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorMessage = typeof data?.error === 'string'
                    ? data.error
                    : `Gemini request failed with status ${response.status}.`;
                const error = new Error(errorMessage) as ProxyError;
                error.status = response.status;
                throw error;
            }

            return data as T;
        } catch (error) {
            const proxyError = error as ProxyError;
            lastError = proxyError;
            const retryable = shouldRetryProxyError(proxyError.status, proxyError.message || '');
            const hasAttemptsLeft = attempt < maxAttempts;

            if (!retryable || !hasAttemptsLeft) {
                break;
            }

            await sleep(getRetryDelayMs(attempt));
        }
    }

    throw lastError || new Error('Gemini request failed.');
}

export async function findOpenEducationalImage(prompt: string, language: 'EN' | 'FIL'): Promise<OpenEducationalImage | null> {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
        return null;
    }

    const query = encodeURIComponent(normalizedPrompt);
    const lang = encodeURIComponent(language);
    const response = await fetch(`${getProxyBaseUrl()}/api/open-images?q=${query}&lang=${lang}`);

    if (!response.ok) {
        return null;
    }

    const data = await response.json().catch(() => null) as { image?: OpenEducationalImage } | null;
    if (!data?.image?.url) {
        return null;
    }

    return data.image;
}

function parseJsonModelResponse<T>(text: string | undefined, label: string): T {
    const raw = (text ?? '').trim();
    if (!raw) {
        throw new Error(`Gemini returned an empty response for ${label}.`);
    }

    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        console.error(`Failed to parse Gemini JSON for ${label}. Raw response:`, raw);
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

// Helper to clean and split content
function cleanSlideContent(content: string[]): string[] {
    const cleaned: string[] = [];
    const splitMarker = "|||SPLIT|||";

    for (const item of content) {
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

// --- K-12 GENERATION LOGIC ---

// PHASE 1: DEEP ANALYSIS & BLUEPRINT CREATION
export async function createK12LessonBlueprint(content: string, format: string, language: 'EN' | 'FIL'): Promise<LessonBlueprint> {
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
        - **Subject, Grade, Quarter, Title:** Identify the Subject, Grade Level, Quarter, and a creative Main Title for the entire week's lesson.
        - **Learning Competency:** Find the primary Learning Competency code and description (e.g., "S6MT-Ia-c-1: Describe mixtures"). This is the most important anchor for the lesson.

        **STEP 2: SMART Objective Formulation (CRITICAL)**
        - **Analyze Existing Objectives:** Review any objectives listed in the content.
        - **Generate/Refine SMART Objectives:** Based on the Learning Competency, formulate 3-5 **SMART** objectives (Specific, Measurable, Achievable, Relevant, Time-bound). These are for the teacher's reference.
          - Example of a GOOD SMART objective: "By the end of the lesson, students will be able to differentiate between homogeneous and heterogeneous mixtures by correctly classifying 4 out of 5 given examples."
        - **Consolidate for Students:** After creating the SMART objectives, create a separate, consolidated list of 2-3 **student-facing objectives**. These should be concise, use simple language, and ideally start with "I can..." or "You will be able to...". These will be shown to the students on the presentation slide.
          - Example of a GOOD student-facing objective: "I can tell the difference between different types of mixtures."

        **STEP 3: Daily Plan Structuring**
        - **Breakdown:** Structure the lesson into a logical 5-day plan.
        - **Daily Focus:** For each day, provide a concise 'focus' summary (e.g., "Day 1: Introduction to Mixtures and Their Types", "Day 2: Exploring Homogeneous Mixtures").
        - **Extrapolation:** If the input only covers one day, logically extrapolate the content to create a full 5-day plan that scaffolds learning from introduction to assessment. The weekly flow must align with the principles of the **${format}** curriculum/model.

        **FINAL OUTPUT (JSON FORMAT ONLY):**
        Return a single JSON object matching this schema. Do not add any extra text or explanations.
    `;

    const responseSchema = {
        type: JSON_SCHEMA.OBJECT,
        properties: {
            mainTitle: { type: JSON_SCHEMA.STRING },
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
        required: ["mainTitle", "subject", "learningCompetency", "smartObjectives", "studentFacingObjectives", "days"]
    };
    
    const response = await callGeminiProxy<GeminiTextResponse>({
        task: 'text',
        model: TEXT_MODELS,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.3,
        },
    });

    return parseJsonModelResponse<LessonBlueprint>(response.text, 'lesson blueprint generation');
}


// PHASE 2: SLIDE GENERATION (PER DAY)
export async function generateK12SlidesForDay(day: DayPlan, blueprint: LessonBlueprint, originalContent: string, format: string, language: 'EN' | 'FIL'): Promise<Slide[]> {
    let prompt = "";
    const commonRules = `
    **CRITICAL DIRECTIVES:**
    1.  **THE 6x6 RULE (STRICT):** Adhere to the 6x6 rule for slide content. Aim for a maximum of 6 bullet points (lines) per slide, and a maximum of 6-8 words per bullet point. This is crucial for readability.
    2.  **IMAGE PROMPTS REQUIRED (CRITICAL FOR ACCURACY):** For EVERY slide, you MUST include the \`imagePrompt\` and \`imageStyle\` fields.
        - **Specificity is Key:** The \`imagePrompt\` must be highly descriptive, detailed, and directly tied to the slide's title and content to ensure visual accuracy. For abstract topics, use a concrete visual metaphor. The prompt MUST be in English.
        - **Example:** For a slide on "Homogeneous Mixtures," a GOOD prompt is: "A clear glass beaker of water with salt crystals dissolving and disappearing into it." A BAD prompt is: "A glass of water."
        - **Style:** Select a suitable \`imageStyle\` from ["photorealistic", "infographic", "illustration", "diagram", "historical photo"].
        - **No Visual:** For text-only slides (like an agenda), you MUST use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
    3.  **LABELING FOR DIAGRAMS/INFOGRAPHICS:** When the \`imageStyle\` is \`diagram\` or \`infographic\` and the image requires labels to be understood (e.g., parts of a flower, steps in a process), you MUST include the specific, correctly-spelled labels within the \`imagePrompt\`. The labels should be in the target language of the presentation (${language === 'FIL' ? 'Filipino' : 'English'}). Example: \`imagePrompt: "A simple diagram of a plant cell with the following labels in ${language === 'FIL' ? 'Filipino' : 'English'}: Cell Wall, Cytoplasm, Nucleus"\`.
    4.  **SPEAKER NOTES (ESSENTIAL):** For EACH slide, you MUST provide practical, actionable speaker notes to guide the teacher. Examples: "Ask students: 'What do you notice?'", "Distribute materials.", "Emphasize the key difference is...".
    5.  **PEDAGOGICAL ALIGNMENT & TITLES:** The slide sequence must strictly follow the sections for the **${format}** model. However, slide titles must be creative and directly reflect the content, NOT the section name. For example, instead of a slide titled "Explore", a better title is "Activity: Classifying Mixtures". Generic titles like "Review" or "Assignment" are acceptable.
    6.  **CONTENT & CLARITY (CRITICAL):**
        - **Avoid Overcrowding (STRICT RULE):** Your primary goal is readability and clarity. A single slide should NEVER be a wall of text. As a strict rule, if a topic requires more than 5-6 bullet points or a few short sentences, you MUST split it into multiple, logically sequenced slides. This is not optional. Use clear follow-up titles (e.g., "Topic (Continued)" or a specific sub-topic title).
        - **Decompose Lists:** When a slide introduces multiple distinct concepts (e.g., three types of volcanoes), create a separate slide for each concept and provide a unique, relevant \`imagePrompt\`.
        - **Brevity:** Use clear, student-facing language in bullet points. Avoid long paragraphs.
        - **Line Separation:** Every bullet point or list item MUST be a separate string in the 'content' array.
    7.  **DAILY GOAL SLIDE:** If generating for Day 2 or later, the first slide should be "Today's Goal". Do NOT generate a full "Learning Objectives" slide.
    8.  **CONCLUDING SLIDE (MANDATORY):** The very last slide generated MUST serve as a conclusion for the day's lesson. This slide should typically cover the 'Evaluation' or 'Assignment' section and provide a clear end to the presentation.
    `;
    
    let sections = "";
    if (format === 'K-12') sections = `A. Review (IV-A), B. Motivation (IV-B), C. Content (IV-C), D. Discussion (IV-D), E. Concept Development (IV-E), F. Practice (IV-F), G. Application (IV-G), H. Generalization (IV-H), I. Evaluation (IV-I), J. Assignment (IV-J)`;
    else if (format === 'MATATAG') sections = `A. Activating Prior Knowledge, B. Establishing Purpose, C. Unlocking Vocabulary, D. Developing Understanding, E. Application, F. Generalization, G. Evaluating Learning, H. Homework`;
    else if (format === '5Es Model') sections = `1. ENGAGE, 2. EXPLORE, 3. EXPLAIN, 4. ELABORATE, 5. EVALUATE`;
    else if (format === '4As Model') sections = `1. MOTIVATION, 2. ACTIVITY, 3. ANALYSIS, 4. ABSTRACTION, 5. APPLICATION, 6. EVALUATE`;
    else sections = `1. Title, 2. Introduction/Review, 3. Core Concepts, 4. Practice/Activity, 5. Assessment`;

    prompt = `
        You are a professional K-12 Instructional Designer creating a slide deck for a teacher.
        
        **LANGUAGE OF OUTPUT:** You MUST generate all content (titles, content, speaker notes) in ${language === 'FIL' ? 'Filipino' : 'English'}. However, image prompts must ALWAYS be in English.

        **LESSON BLUEPRINT:**
        - Main Title: ${blueprint.mainTitle}
        - Subject: ${blueprint.subject}
        - Grade Level: ${blueprint.gradeLevel}
        - Learning Competency: ${blueprint.learningCompetency}
        - SMART Objectives for the Week: ${blueprint.smartObjectives.join(", ")}
        
        **TODAY'S FOCUS (DAY ${day.dayNumber}):**
        - Title: ${day.title}
        - Focus: ${day.focus}

        **REFERENCE DLL/TOPIC CONTENT:**
        \`\`\`
        ${originalContent}
        \`\`\`

        **TASK:**
        Generate a set of 10-12 slides for DAY ${day.dayNumber} ONLY, following the **${format}** model.

        **REQUIRED SECTIONS:**
        ${sections}

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

    try {
        const response = await callGeminiProxy<GeminiTextResponse>({
            task: 'text',
            model: TEXT_MODELS,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.4,
                tools: [{ googleSearch: {} }],
            },
        });
        const data = parseJsonModelResponse<{ slides: Slide[] }>(response.text, `day ${day.dayNumber} slide generation`);
        const slides = data.slides.map((s: any) => ({ 
            ...s, 
            content: cleanSlideContent(s.content),
        }));

        appendGroundingSources(slides, response.groundingChunks);
        
        return slides;

    } catch (e) {
        console.error(`Failed to generate slides for Day ${day.dayNumber}`, e);
        throw e;
    }
}


// K-12 SINGLE LESSON GENERATION
export async function generateK12SingleLessonSlides(content: string, format: string, language: 'EN' | 'FIL', onProgress?: (message: string) => void): Promise<Presentation> {
    if (onProgress) onProgress(`Structuring your complete lesson...`);

    let sections = "";
    if (format === 'K-12') sections = `A. Review (IV-A), B. Motivation (IV-B), C. Content (IV-C), D. Discussion (IV-D), E. Concept Development (IV-E), F. Practice (IV-F), G. Application (IV-G), H. Generalization (IV-H), I. Evaluation (IV-I), J. Assignment (IV-J)`;
    else if (format === 'MATATAG') sections = `A. Activating Prior Knowledge, B. Establishing Purpose, C. Unlocking Vocabulary, D. Developing Understanding, E. Application, F. Generalization, G. Evaluating Learning, H. Homework`;
    else if (format === '5Es Model') sections = `1. ENGAGE, 2. EXPLORE, 3. EXPLAIN, 4. ELABORATE, 5. EVALUATE`;
    else if (format === '4As Model') sections = `1. MOTIVATION, 2. ACTIVITY, 3. ANALYSIS, 4. ABSTRACTION, 5. APPLICATION, 6. EVALUATE`;
    else sections = `1. Title, 2. Introduction/Review, 3. Core Concepts, 4. Practice/Activity, 5. Assessment`;

    const prompt = `
        You are a Master K-12 Teacher and Instructional Designer creating a complete, professional slide presentation for a single lesson.

        **LANGUAGE OF OUTPUT:** You MUST generate all content (titles, content, speaker notes) in ${language === 'FIL' ? 'Filipino' : 'English'}. However, image prompts must ALWAYS be in English.

        **INPUT LESSON PLAN / TOPIC:**
        \`\`\`
        ${content}
        \`\`\`

        **TASK:**
        Generate a comprehensive slide deck for a single, self-contained lesson (e.g., for a 50-minute class period). The presentation must be engaging, clear, and logically structured from start to finish, following the specified pedagogical model.

        **PEDAGOGICAL FORMAT TO FOLLOW:** ${format}
        **REQUIRED SECTIONS TO INCLUDE:** ${sections}

        **CRITICAL DIRECTIVES:**
        1.  **THE 6x6 RULE (STRICT):** Adhere to the 6x6 rule for slide content. Aim for a maximum of 6 bullet points (lines) per slide, and a maximum of 6-8 words per bullet point. This is crucial for readability.
        2.  **IMAGE PROMPTS REQUIRED (CRITICAL FOR ACCURACY):** For EVERY slide, you MUST include the \`imagePrompt\` and \`imageStyle\` fields.
            - **Specificity is Key:** The \`imagePrompt\` must be highly descriptive, detailed, and directly tied to the slide's title and content to ensure visual accuracy. For abstract topics, use a concrete visual metaphor. The prompt MUST be in English.
            - **Example:** For a slide on "Homogeneous Mixtures," a GOOD prompt is: "A clear glass beaker of water with salt crystals dissolving and disappearing into it." A BAD prompt is: "A glass of water."
            - **Style:** Select a suitable \`imageStyle\` from ["photorealistic", "infographic", "illustration", "diagram", "historical photo"].
            - **No Visual:** For text-only slides (like an agenda), you MUST use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
        3.  **LABELING FOR DIAGRAMS/INFOGRAPHICS:** When the \`imageStyle\` is \`diagram\` or \`infographic\` and the image requires labels to be understood (e.g., parts of a flower), you MUST include the specific, correctly-spelled labels within the \`imagePrompt\`. The labels should be in the target language of the presentation (${language === 'FIL' ? 'Filipino' : 'English'}). Example: \`imagePrompt: "A simple diagram of a plant cell with the following labels in ${language === 'FIL' ? 'Filipino' : 'English'}: Cell Wall, Cytoplasm, Nucleus"\`.
        4.  **INITIAL SLIDES:** The first two slides MUST be a 'Title Slide' and a 'Learning Objectives' slide.
        5.  **SPEAKER NOTES (ESSENTIAL):** For EACH slide, you MUST provide practical, actionable speaker notes to guide the teacher.
        6.  **PEDAGOGICAL ALIGNMENT & TITLES:** The slide sequence must follow the structure of the **${format}** model. However, slide titles must be creative and directly reflect the content, NOT the section name. For example, instead of a slide titled "Explore", a better title is "Activity: Classifying Mixtures". Generic titles like "Review" or "Assignment" are acceptable.
        7.  **CONTENT & CLARITY (CRITICAL):**
            - **Avoid Overcrowding (STRICT RULE):** Your primary goal is readability and clarity. A single slide should NEVER be a wall of text. As a strict rule, if a topic requires more than 5-6 bullet points or a few short sentences, you MUST split it into multiple, logically sequenced slides. This is not optional. Use clear follow-up titles (e.g., "Topic (Continued)" or a specific sub-topic title).
            - **Decompose Lists:** When a slide introduces multiple distinct concepts (e.g., three types of rocks), create a separate slide for each concept and provide a unique, relevant \`imagePrompt\`.
            - **Brevity:** Use clear, student-facing language in bullet points. Avoid long paragraphs. Use markdown bolding (\`**term**\`) for key terminology.
            - **Line Separation:** Every bullet point or list item MUST be a separate string in the 'content' array.
        8.  **CONCLUDING SLIDE (MANDATORY):** The final slide generated MUST be an 'Assignment' or 'Summary' slide, providing a clear conclusion to the lesson.

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

    if (onProgress) onProgress(`Generating slide content...`);
    const response = await callGeminiProxy<GeminiTextResponse>({
        task: 'text',
        model: TEXT_MODELS,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.4,
            tools: [{ googleSearch: {} }],
        },
    });
    const data = parseJsonModelResponse<{ title: string; slides: Slide[] }>(response.text, 'single lesson generation');
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
            - **Example:** For a slide on "Quantum Superposition," a GOOD prompt is: "A diagram showing a single particle, like an electron, existing in multiple states simultaneously, represented by overlapping, semi-transparent wave functions." A BAD prompt is: "An atom."
            - **Style:** Select a professional \`imageStyle\` from ["photorealistic", "diagram", "infographic", "historical photo"].
            - **No Visual:** For text-only slides (like an agenda), you MUST use \`"imagePrompt": ""\` and \`"imageStyle": "none"\`.
        3.  **LABELING FOR DIAGRAMS/INFOGRAPHICS:** When the \`imageStyle\` is \`diagram\` or \`infographic\` and the image requires labels to be understood, you MUST include the specific, correctly-spelled labels within the \`imagePrompt\`. The labels should be in the target language of the presentation (${language === 'FIL' ? 'Filipino' : 'English'}). Example: \`imagePrompt: "A scientific diagram of mitochondrial respiration with labels for the following in ${language === 'FIL' ? 'Filipino' : 'English'}: Krebs Cycle, Electron Transport Chain, ATP Synthase"\`.
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
            tools: [{ googleSearch: {} }],
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

export async function generateImageFromPrompt(prompt: string, style: ImageStyle = 'illustration', language: 'EN' | 'FIL'): Promise<string> {
    if (!prompt || style === 'none') {
        return Promise.resolve('');
    }

    let styleInstructions = '';
    const langName = language === 'FIL' ? 'Filipino' : 'English';

    switch(style) {
        case 'photorealistic':
            styleInstructions = 'Create a professional, high-resolution, photorealistic image. It must look like a real photograph with accurate lighting and textures. Avoid artistic embellishments or fantastical elements. The final image must be a factually accurate representation of the subject. Under no circumstances should any text, letters, numbers, or words appear in the image.';
            break;
        case 'infographic':
            styleInstructions = `Create a clean and modern infographic using a professional, cohesive color palette. The design should be simple and use clear icons. If the prompt includes a list of labels, you MUST render these labels clearly and accurately. The labels MUST be in ${langName} and spelled exactly as provided. Use a clean, sans-serif font. Do not add any other decorative or unnecessary text.`;
            break;
        case 'diagram':
             styleInstructions = `Create a clear, accurate, scientific or technical diagram. Use thin, precise lines and a clean, minimalist style. The diagram must be factually and scientifically accurate. If the prompt contains a list of labels, you MUST render these labels onto the diagram. The labels MUST be in ${langName} and spelled exactly as provided. Use a clean, legible font. Do not add any extraneous text or titles.`;
            break;
        case 'historical photo':
            styleInstructions = 'Create an image that looks like an authentic historical photograph from the relevant era (e.g., black and white, sepia-toned). It should have realistic grain, lighting, and focus imperfections of the period. The depiction must be historically accurate. Avoid a modern, "costumed" look. Under no circumstances should any text, letters, numbers, or words appear in the image.';
            break;
        case 'illustration':
        default:
             styleInstructions = 'Create a professional, vibrant, and clear educational illustration with clean lines, bright but harmonious colors, and easy-to-understand visuals. Under no circumstances should any text, letters, numbers, or words appear in the image.';
            break;
    }

    const finalPrompt = `${styleInstructions} The image should depict: "${prompt}"`;

    try {
        const response = await callGeminiProxy<GeminiImageResponse>({
            task: 'image',
            model: IMAGE_MODELS,
            contents: {
                parts: [{ text: finalPrompt }],
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9",
                },
            },
        });

        if (response.dataUrl) {
            return response.dataUrl;
        }

        if (response.blockReason) {
            throw new Error(`Image generation was blocked. Reason: ${response.blockReason}`);
        }

        if (response.explanation) {
            console.warn(`Model returned text instead of an image for prompt "${prompt}": ${response.explanation}`);
            throw new Error(`The model returned text instead of an image.`);
        }

        throw new Error(response.error || "No image data found in the response.");
    } catch (error) {
        console.error(`Error generating image with Gemini for prompt: "${prompt}".`, error);
        throw error;
    }
}
