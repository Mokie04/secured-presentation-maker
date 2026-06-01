import type { Slide } from '../types';

export const K12_SCIENCE_APPROVED_PRESENTATION_STANDARD = `
**APPROVED K-12 SCIENCE PRESENTATION STANDARD:**
- **Student-centered flow:** Slides should guide what learners observe, decide, build, explain, revise, and defend. Avoid teacher-facing exposition as the main slide content.
- **Inquiry spine:** Each session deck must follow a usable classroom arc: question/hook -> main activity instructions -> expected output/success criteria -> evidence discussion -> debrief/reflection -> independent check.
- **Objectives placement:** Keep official or long lesson-plan objectives in speaker notes. Student-facing slides should use short learning targets, success criteria, or "I can" statements only.
- **Activity completeness:** When the lesson plan has a main activity, include a dedicated slide with complete learner instructions, roles/materials when useful, timing or checking point, and the expected output.
- **Debrief questions:** Add student-centered questions after activities, such as "What evidence changed your first answer?", "Which part of the model is strongest?", "What does the model show, and what does it fail to show?", and "Which misconception did your work correct?"
- **Evidence visuals:** Discussion images must directly match the claim on the slide. Do not reuse the same generic background image across multiple slides.
- **HD accurate visuals only:** For Science/STEM, prefer high-resolution photorealistic classroom evidence visuals, accurate lab/setup photos, realistic anatomical/scientific references, or precise raster diagrams. Avoid cheap SVG/vector/cartoon/flat-icon visuals unless the source topic truly requires a simple abstract model.
- **Visual QA gate:** Before treating a deck as approved, inspect a rendered deck or image contact sheet. Reject decks where evidence slides repeat the same generic background, where visuals are too small for classroom viewing, or where visuals do not prove the slide statement.
- **Visual necessity:** Every image must teach something: a setup, pathway, comparison, process, expected output, misconception contrast, or evidence object. Decorative stock-style images are not acceptable.
- **Subtle branding:** If branded watermarks are used, keep them small, low-opacity, and outside the instructional focus area.
- **Slide readability:** Keep bullets short and learner-facing. Split overloaded explanations into multiple slides or move teacher details to speaker notes.
`;

export type SessionPresentationQualityIssueSeverity = 'error' | 'warning';

export type SessionPresentationQualityIssue = {
  code: string;
  message: string;
  severity: SessionPresentationQualityIssueSeverity;
  slideIndex?: number;
  slideTitle?: string;
};

export type SessionPresentationQualityResult = {
  ok: boolean;
  score: number;
  issues: SessionPresentationQualityIssue[];
  summary: {
    slideCount: number;
    imageBackedSlideCount: number;
    evidenceLayoutSlideCount: number;
    promptCountRange: [number, number];
    longestPromptLength: number;
  };
};

export type SessionPresentationQualityOptions = {
  subject?: string;
  gradeLevel?: string;
  sessionNumber?: number;
  objective?: string;
  expectedOutput?: string;
  mainActivityTitle?: string;
  minSlides?: number;
  maxSlides?: number;
  minPromptsPerSlide?: number;
  maxPromptsPerSlide?: number;
  maxPromptLength?: number;
  requireEvidenceImages?: boolean;
  requirePhotorealisticScienceVisuals?: boolean;
};

const normalizeForValidation = (value: string | undefined): string => (
  (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
);

const includesAnyValidationToken = (value: string, tokens: string[]): boolean => (
  tokens.some((token) => value.includes(token))
);

const addQualityIssue = (
  issues: SessionPresentationQualityIssue[],
  issue: SessionPresentationQualityIssue,
): void => {
  issues.push(issue);
};

export const validateK12ScienceSessionPresentation = (
  slides: Slide[],
  options: SessionPresentationQualityOptions = {},
): SessionPresentationQualityResult => {
  const {
    minSlides = 8,
    maxSlides = 14,
    minPromptsPerSlide = 3,
    maxPromptsPerSlide = 6,
    maxPromptLength = 72,
    requireEvidenceImages = true,
    requirePhotorealisticScienceVisuals = normalizeForValidation(options.subject).includes('science'),
  } = options;

  const issues: SessionPresentationQualityIssue[] = [];
  const promptCounts = slides.map((slide) => slide.content.filter((item) => item.trim()).length);
  const promptLengths = slides.flatMap((slide) => slide.content.map((item) => item.trim().length));
  const imageBackedSlideCount = slides.filter((slide) => Boolean(slide.imagePrompt || slide.imageUrl)).length;
  const evidenceLayoutSlideCount = slides.filter((slide) => slide.visualLayout === 'evidence').length;

  if (slides.length < minSlides || slides.length > maxSlides) {
    addQualityIssue(issues, {
      code: 'session.slide_count',
      severity: 'error',
      message: `Session deck should have ${minSlides}-${maxSlides} slides; found ${slides.length}.`,
    });
  }

  const firstSlideText = normalizeForValidation([
    slides[0]?.title,
    ...(slides[0]?.content || []),
  ].join(' '));
  if (!includesAnyValidationToken(firstSlideText, ['what', 'how', 'why', 'predict', 'notice', 'question'])) {
    addQualityIssue(issues, {
      code: 'session.missing_inquiry_opener',
      severity: 'error',
      slideIndex: 0,
      slideTitle: slides[0]?.title,
      message: 'First slide should open with inquiry, prediction, or an observable question.',
    });
  }

  const allSlideText = normalizeForValidation(slides.map((slide) => [
    slide.title,
    ...slide.content,
    slide.speakerNotes,
  ].join(' ')).join(' '));

  if (!includesAnyValidationToken(allSlideText, ['output', 'success', 'criteria', 'claim', 'table', 'cer', 'exit'])) {
    addQualityIssue(issues, {
      code: 'session.missing_expected_output',
      severity: 'error',
      message: 'Session deck needs an expected output, success criteria, or exit product aligned to the objective.',
    });
  }

  if (!includesAnyValidationToken(allSlideText, ['ask:', 'discuss', 'evidence board', 'debrief', 'misconception', 'explain'])) {
    addQualityIssue(issues, {
      code: 'session.missing_debrief',
      severity: 'error',
      message: 'Session deck needs student-centered discussion/debrief prompts, not only activity steps.',
    });
  }

  const mainActivityNeedle = normalizeForValidation(options.mainActivityTitle);
  const mainActivitySlide = slides.find((slide) => {
    const slideText = normalizeForValidation([slide.title, ...slide.content, slide.speakerNotes].join(' '));
    return mainActivityNeedle
      ? slideText.includes(mainActivityNeedle)
      : includesAnyValidationToken(slideText, ['main activity', 'activity', 'observe', 'record', 'calculate', 'construct', 'investigate']);
  });

  if (!mainActivitySlide) {
    addQualityIssue(issues, {
      code: 'activity.missing',
      severity: 'error',
      message: 'Session deck needs a dedicated main activity slide.',
    });
  } else {
    const activityPrompts = mainActivitySlide.content.filter((item) => item.trim());
    const activityText = normalizeForValidation(activityPrompts.join(' '));
    if (activityPrompts.length < 4) {
      addQualityIssue(issues, {
        code: 'activity.incomplete_steps',
        severity: 'error',
        slideIndex: slides.indexOf(mainActivitySlide),
        slideTitle: mainActivitySlide.title,
        message: 'Main activity slide should include complete learner instructions, usually 4-5 prompts.',
      });
    }
    if (!includesAnyValidationToken(activityText, ['predict', 'observe', 'record', 'calculate', 'draw', 'construct', 'explain', 'classify', 'compare'])) {
      addQualityIssue(issues, {
        code: 'activity.missing_learner_actions',
        severity: 'error',
        slideIndex: slides.indexOf(mainActivitySlide),
        slideTitle: mainActivitySlide.title,
        message: 'Main activity slide should use learner actions from the lesson plan.',
      });
    }
  }

  slides.forEach((slide, slideIndex) => {
    const prompts = slide.content.filter((item) => item.trim());
    const slideText = normalizeForValidation([slide.title, ...slide.content].join(' '));
    const notesText = normalizeForValidation(slide.speakerNotes);

    if (prompts.length < minPromptsPerSlide || prompts.length > maxPromptsPerSlide) {
      addQualityIssue(issues, {
        code: 'slide.prompt_count',
        severity: prompts.length > maxPromptsPerSlide + 1 ? 'error' : 'warning',
        slideIndex,
        slideTitle: slide.title,
        message: `Slide should have ${minPromptsPerSlide}-${maxPromptsPerSlide} readable learner prompts; found ${prompts.length}.`,
      });
    }

    prompts.forEach((prompt) => {
      if (prompt.trim().length > maxPromptLength) {
        addQualityIssue(issues, {
          code: 'slide.prompt_too_long',
          severity: 'warning',
          slideIndex,
          slideTitle: slide.title,
          message: `Learner prompt is long (${prompt.trim().length} characters): "${prompt.trim()}".`,
        });
      }
    });

    if (slideText.includes('by the end of session') || slideText.includes('learning competency:')) {
      addQualityIssue(issues, {
        code: 'slide.objective_overload',
        severity: 'error',
        slideIndex,
        slideTitle: slide.title,
        message: 'Official objective wording should stay in speaker notes, not overload student-facing slide text.',
      });
    }

    if (!notesText || notesText.length < 40) {
      addQualityIssue(issues, {
        code: 'slide.missing_teacher_support',
        severity: 'warning',
        slideIndex,
        slideTitle: slide.title,
        message: 'Slide should include teacher notes with facilitation guidance.',
      });
    }

    if (requireEvidenceImages && !(slide.imagePrompt || slide.imageUrl)) {
      addQualityIssue(issues, {
        code: 'visual.missing_evidence_image',
        severity: 'error',
        slideIndex,
        slideTitle: slide.title,
        message: 'Science session slide should use an evidence visual unless intentionally text-only.',
      });
    }

    if (requireEvidenceImages && slide.visualLayout !== 'evidence') {
      addQualityIssue(issues, {
        code: 'visual.not_evidence_layout',
        severity: 'warning',
        slideIndex,
        slideTitle: slide.title,
        message: 'Evidence-heavy session slides should use the evidence layout for readable image/text balance.',
      });
    }

    if (requirePhotorealisticScienceVisuals && slide.imageStyle === 'illustration') {
      addQualityIssue(issues, {
        code: 'visual.cheap_illustration_style',
        severity: 'error',
        slideIndex,
        slideTitle: slide.title,
        message: 'Science/STEM visual should not use generic illustration style when realistic evidence is required.',
      });
    }

    slide.imageOverlays?.forEach((overlay) => {
      if (overlay.x < 0 || overlay.x > 100 || overlay.y < 0 || overlay.y > 100) {
        addQualityIssue(issues, {
          code: 'visual.overlay_out_of_bounds',
          severity: 'error',
          slideIndex,
          slideTitle: slide.title,
          message: `Overlay "${overlay.text}" is outside the image bounds.`,
        });
      }
      if (overlay.text.trim().length > 24) {
        addQualityIssue(issues, {
          code: 'visual.overlay_too_long',
          severity: 'warning',
          slideIndex,
          slideTitle: slide.title,
          message: `Overlay "${overlay.text}" is too long for a minimal clean label.`,
        });
      }
    });
  });

  const promptReuseCount = new Map<string, number>();
  slides.forEach((slide) => {
    const normalizedPrompt = normalizeForValidation(slide.imagePrompt);
    if (!normalizedPrompt) return;
    promptReuseCount.set(normalizedPrompt, (promptReuseCount.get(normalizedPrompt) || 0) + 1);
  });
  promptReuseCount.forEach((count, prompt) => {
    if (count > 1) {
      addQualityIssue(issues, {
        code: 'visual.repeated_prompt',
        severity: 'warning',
        message: `The same image prompt is reused ${count} times; repeated visuals must be intentional, not generic filler. Prompt: "${prompt.slice(0, 90)}..."`,
      });
    }
  });

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;
  const score = Math.max(0, 100 - (errorCount * 18) - (warningCount * 5));

  return {
    ok: errorCount === 0 && score >= 90,
    score,
    issues,
    summary: {
      slideCount: slides.length,
      imageBackedSlideCount,
      evidenceLayoutSlideCount,
      promptCountRange: [
        promptCounts.length ? Math.min(...promptCounts) : 0,
        promptCounts.length ? Math.max(...promptCounts) : 0,
      ],
      longestPromptLength: promptLengths.length ? Math.max(...promptLengths) : 0,
    },
  };
};
