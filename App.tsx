
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Presentation, LessonBlueprint, DayPlan, Slide, ImageOverlayLabel } from './types';
import { IMAGES_DISABLED, createK12LessonBlueprint, generateK12SlidesForDay, generateImageFromPrompt, generateCollegeLectureSlides, generateK12SingleLessonSlides } from './services/geminiService';
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


type AppStep = 'input' | 'planning' | 'presenting';
type TransitionDirection = 'next' | 'prev' | null;
type LessonFormat = 'K-12' | 'MATATAG' | '5Es Model' | '4As Model';
type TeachingLevel = 'K-12' | 'College';
type DepEdMode = 'weekly' | 'single';
type AuthState = 'checking' | 'authorized' | 'unauthorized';
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
  
  const [selectedFormat, setSelectedFormat] = useState<LessonFormat>('K-12');
  const [teachingLevel, setTeachingLevel] = useState<TeachingLevel>('K-12');
  const [depEdMode, setDepEdMode] = useState<DepEdMode>('weekly');
  
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState<string>('');

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

        const response = await fetch(endpoint, {
          method: 'GET',
          credentials: 'include',
        });
        const payload = await response.json().catch(() => ({}));

        if (access) {
          params.delete('access');
          const nextQuery = params.toString();
          const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
          window.history.replaceState({}, '', cleanUrl);
        }

        if (cancelled) return;

        if (response.ok && payload?.authenticated) {
          setAuthState('authorized');
          setAuthError('');
          return;
        }

        setAuthState('unauthorized');
        setAuthError(payload?.error || 'Unauthorized access. Please open this tool from your app store account.');
      } catch {
        if (cancelled) return;
        setAuthState('unauthorized');
        setAuthError('Unable to validate your secure session. Please reopen this tool from your app store.');
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
    const errorMessage = (e as Error).message;
    console.error(e);

    // Specific check for when all keys are exhausted.
    if (errorMessage.includes("RATE_LIMIT_EXCEEDED")) {
        setError("The application's API usage quota has been exceeded on all available keys. Please contact the administrator or check the billing plan.");
        return; // Important to return here to avoid fallback messages.
    }

    if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        setAuthState('unauthorized');
        setAuthError('Your secure session expired. Please reopen this tool from your app store.');
        return;
    }
    
    if (errorMessage.includes("API key is missing") || errorMessage.includes("GEMINI_API_KEY")) {
        setError("The application's API key is missing from its configuration. Please contact the administrator.");
    } else if (errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("temporarily experiencing")) {
        setError("The AI service is currently under heavy load. The app retried automatically; please try again in about 1 minute.");
    } else if (errorMessage.includes('API key not valid')) {
        setError("One of the application's API keys is invalid. Please contact the administrator.");
    } else if (errorMessage.includes('permission') || errorMessage.includes('billing') || errorMessage.includes('quota')) {
        setError("An API key has a permission or billing issue. Please contact the administrator.");
    } else {
        setError(`An unexpected error occurred: ${errorMessage}`);
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
    const primary = (slide.imagePrompt || '').trim();
    const fallback = buildFallbackImagePrompt(slide);
    const bestPrompt = primary || fallback;
    return bestPrompt ? [bestPrompt] : [];
  }, [buildFallbackImagePrompt]);

  const processSlidesForImages = async (
    slidesWithPrompts: Slide[],
    language: 'EN' | 'FIL',
    options?: { muteProgress?: boolean }
  ): Promise<Slide[]> => {
    const muteProgress = options?.muteProgress === true;
    if (IMAGES_DISABLED) {
        return slidesWithPrompts.map((s) => ({ ...s, imageUrl: '', imagePrompt: '' }));
    }
    const slidesWithImages = [];
    let rateLimitWasHit = false;
    
    const imagesToGenerate = slidesWithPrompts.filter((s) => buildImagePromptCandidates(s).length > 0 && !s.imageUrl);
    const totalImagesToAttempt = imagesToGenerate.length;
    let imagesAttemptedCounter = 0;
    
    const imagesLeftToday = Math.max(0, limits.images - images);
    const totalImagesThatCanBeGenerated = Math.min(totalImagesToAttempt, imagesLeftToday);

    if (!muteProgress) {
      if (totalImagesThatCanBeGenerated > 0) {
          setLoadingProgress(0);
      } else if (totalImagesToAttempt > 0) {
          console.warn("Daily image limit reached or no prompts found. Skipping image generation.");
      }
    }
    
    for (const slide of slidesWithPrompts) {
        let newSlide = { ...slide }; 
        const promptCandidates = buildImagePromptCandidates(newSlide);
        if (!newSlide.imageUrl && promptCandidates.length > 0) {
            const promptForGeneration = promptCandidates[0];
            if (!newSlide.imagePrompt || !newSlide.imagePrompt.trim()) {
                newSlide.imagePrompt = promptForGeneration;
            }
            // Simplify: always attempt AI image once, skip open-source fetch to reduce latency and irrelevance.
            const currentImageCount = images + (slidesWithImages.filter(s => s.imageUrl && s.imageUrl.startsWith('data')).length);
            if (currentImageCount >= limits.images) {
                newSlide.imageUrl = 'limit_reached';
                slidesWithImages.push(newSlide);
                continue;
            }

            if (canGenerateImage && !rateLimitWasHit) {
                imagesAttemptedCounter++;
                if (!muteProgress) {
                  setLoadingMessage(t.presentation.loadingImages.replace('{current}', imagesAttemptedCounter.toString()).replace('{total}', totalImagesThatCanBeGenerated.toString()));
                }
                
                if (!muteProgress && totalImagesThatCanBeGenerated > 0) {
                    const progress = (imagesAttemptedCounter / totalImagesThatCanBeGenerated) * 100;
                    setLoadingProgress(progress);
                }
                
                try {
                    const imageUrl = await generateImageFromPrompt(promptForGeneration, slide.imageStyle, language);
                    newSlide.imageUrl = imageUrl;
                    incrementCount('images');
                } catch (imgError) {
                    console.error(`Failed to generate image for prompt: "${promptForGeneration}"`, imgError);
                    if ((imgError as Error).message === 'RATE_LIMIT_EXCEEDED') {
                        rateLimitWasHit = true;
                        setError("Image generation quota exceeded. Please check your Google AI plan and billing details. Further image generation has been stopped.");
                    } else {
                        handleApiError(imgError);
                    }
                    newSlide.imageUrl = 'error';
                }
            }
        }
        slidesWithImages.push(newSlide);
    }

    return slidesWithImages;
  };

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
            const hasQuota = tryIncrementCount('generations');
            if (!hasQuota) {
              setIsLoading(false);
              setError(t.presentation.errorGenerationLimit);
              return;
            }
            shouldRollbackGeneration = true;
            setLoadingDuration(45);
            setLoadingMessage(t.presentation.loadingLecture);
            const fullPresentation = await generateCollegeLectureSlides(topicContext, objectivesContext, language, (msg) => setLoadingMessage(msg));
            setLoadingMessage(t.presentation.loadingTables);
            const slidesWithTables = await processSlidesForTables(fullPresentation.slides);
            const finalSlides = await processSlidesForImages(slidesWithTables, language);

            setPresentation({ ...fullPresentation, slides: finalSlides });
            setCurrentSlide(0);
            setAppStep('presenting');
        } 
        // DepEd Flows
        else if (teachingLevel === 'K-12') {
            // DepEd Single Lesson Flow
            if (depEdMode === 'single') {
                const hasQuota = tryIncrementCount('generations');
                if (!hasQuota) {
                  setIsLoading(false);
                  setError(t.presentation.errorGenerationLimit);
                  return;
                }
                shouldRollbackGeneration = true;
                setLoadingDuration(40);
                setLoadingMessage(t.presentation.loadingSingleLesson);
                const fullPresentation = await generateK12SingleLessonSlides(content, selectedFormat, language, (msg) => setLoadingMessage(msg));
                setLoadingMessage(t.presentation.loadingTables);
                const slidesWithTables = await processSlidesForTables(fullPresentation.slides);
                const finalSlides = await processSlidesForImages(slidesWithTables, language);

                setPresentation({ ...fullPresentation, slides: finalSlides });
                setCurrentSlide(0);
                setAppStep('presenting');
            }
            // DepEd Weekly Plan Flow (default)
            else if (depEdMode === 'weekly') {
                // No generation quota consumed for creating the weekly blueprint.
                setLoadingDuration(20);
                setLoadingMessage(t.presentation.loadingBlueprint);
                const blueprint = await createK12LessonBlueprint(content, selectedFormat, language);
                const blueprintWithStatus = {
                    ...blueprint,
                    days: blueprint.days.map(d => ({...d, generationStatus: 'pending' as const}))
                };
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

                const processedInitialSlides = await processSlidesForImages(initialSlides, language, { muteProgress: true });

                setPresentation({
                    title: blueprint.mainTitle,
                    slides: processedInitialSlides
                });

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
  }, [dllContent, topicContext, objectivesContext, teachingLevel, depEdMode, selectedFormat, language, t, tryIncrementCount, decrementCount]);

  const handleGenerateDailySlides = useCallback(async (dayIndex: number) => {
    if (!lessonBlueprint) return;

    const hasQuota = tryIncrementCount('generations');
    if (!hasQuota) {
      setError(t.presentation.errorGenerationLimit);
      return;
    }
    
    setLessonBlueprint(prev => {
        if (!prev) return null;
        const newDays = [...prev.days];
        newDays[dayIndex].generationStatus = 'loading';
        return {...prev, days: newDays};
    });

    setIsLoading(true);
    setError(null);
    let shouldRollbackGeneration = true;
    
    try {
        const dayToGenerate = lessonBlueprint.days[dayIndex];
        setLoadingMessage(t.presentation.loadingDailySlides.replace('{dayNumber}', dayToGenerate.dayNumber.toString()));
        
        const content = dllContent.trim() || topicContext.trim();
        const dailySlides = await generateK12SlidesForDay(dayToGenerate, lessonBlueprint, content, selectedFormat, language);
        
        setLoadingMessage(t.presentation.loadingTables);
        const slidesWithTables = await processSlidesForTables(dailySlides);
        
        const finalSlides = await processSlidesForImages(slidesWithTables, language);

        const slideIndexOfNewDay = presentation?.slides.length ?? 0;

        setPresentation(prev => ({
            title: prev?.title ?? lessonBlueprint.mainTitle,
            slides: [...(prev?.slides ?? []), ...finalSlides]
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
  }, [lessonBlueprint, dllContent, topicContext, selectedFormat, theme, presentation, language, t, tryIncrementCount, decrementCount]);

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
            const result = await mammoth.extractRawText({ arrayBuffer });
            text = result.value;
        } else {
            text = await file.text();
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

  const resolveImageForPptx = useCallback(async (imageUrl: string | undefined): Promise<string | null> => {
    if (!imageUrl) return null;
    if (imageUrl === 'error' || imageUrl === 'loading' || imageUrl === 'limit_reached') return null;
    if (imageUrl.startsWith('data:')) return imageUrl;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;

      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return null;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to convert image blob to data URL'));
        reader.readAsDataURL(blob);
      });

      return dataUrl;
    } catch (error) {
      console.warn('Failed to resolve image for PPTX export:', error);
      return null;
    }
  }, []);

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
            
            const hasImage = !!slideData.imageUrl && slideData.imageUrl !== 'error' && slideData.imageUrl !== 'loading' && slideData.imageUrl !== 'limit_reached';
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
                    slide.addImage({ data: imageData, x: 0.5, y: 0.5, w: 4.3, h: 4.625 });

                    const overlays = (slideData.imageOverlays || []).filter(o => o.text && o.text.trim().length > 0);
                    for (const overlay of overlays) {
                        const normalizedX = Math.max(0, Math.min(100, overlay.x));
                        const normalizedY = Math.max(0, Math.min(100, overlay.y));
                        const labelText = overlay.text.trim();
                        const uiFontSize = Math.max(12, Math.min(42, Math.round(overlay.fontSize ?? 16)));
                        const pptFontSize = Math.max(10, Math.min(28, Math.round(uiFontSize * 0.78)));
                        const labelW = Math.max(1.0, Math.min(2.8, (0.058 * (uiFontSize / 16) * labelText.length) + 0.72));
                        const labelH = Math.max(0.36, Math.min(0.9, 0.12 + (uiFontSize * 0.018)));
                        const imageX = 0.5;
                        const imageY = 0.5;
                        const imageW = 4.3;
                        const imageH = 4.625;

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
                    slide.addText('Image could not be loaded.', { x: 0.5, y: 0.5, w: 4.3, h: 4.625, color: 'FF0000', align: 'center', valign: 'middle' });
                }
                
                slide.addText(slideData.title, { 
                    x: 5.2, y: 0.5, w: 4.3, h: 1.0, 
                    fontSize: 36, bold: true, color: brandColor, 
                    valign: 'top', fontFace: 'Poppins', fit: 'shrink'
                });

                if(hasContent) {
                    slide.addText(contentForPptx, { 
                        x: 5.2, y: 1.5, w: 4.3, h: 3.7, 
                        color: textColor, valign: 'top', fontSize: 22, 
                        lineSpacing: 33, fit: 'shrink'
                    });
                }
            } else {
                slide.addText(slideData.title, { 
                    x: 0.5, y: 0.5, w: 9.0, h: 1.2, 
                    fontSize: 40, bold: true, color: brandColor, 
                    valign: 'top', fontFace: 'Poppins', fit: 'shrink'
                });
                
                if (hasContent) {
                    slide.addText(contentForPptx, { 
                        x: 0.5, y: 1.7, w: 9.0, h: 3.6, 
                        color: textColor, valign: 'top', 
                        fontSize: 24, lineSpacing: 36, fit: 'shrink'
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
    if (!presentation) return;

    const originalSlideStyle = presentation.slides[slideIndex].imageStyle;
    setPresentation(prev => {
        if (!prev) return null;
        const updatedSlides = [...prev.slides];
        updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], imagePrompt: newPrompt, imageUrl: 'loading' };
        return { ...prev, slides: updatedSlides };
    });

    try {
        if (!canGenerateImage) {
            alert(t.presentation.errorImageLimit.replace('{limit}', limits.images.toString()));
            setPresentation(prev => {
                if (!prev) return null;
                const finalSlides = [...prev.slides];
                finalSlides[slideIndex] = { ...finalSlides[slideIndex], imageUrl: 'limit_reached', imagePrompt: newPrompt };
                return { ...prev, slides: finalSlides };
            });
            return;
        }

        const imageUrl = await generateImageFromPrompt(newPrompt, originalSlideStyle, language);
        incrementCount('images');
        setPresentation(prev => {
            if (!prev) return null;
            const finalSlides = [...prev.slides];
            finalSlides[slideIndex] = { ...finalSlides[slideIndex], imageUrl: imageUrl, imagePrompt: newPrompt };
            return { ...prev, slides: finalSlides };
        });
    } catch (err) {
        console.error("Image regeneration failed:", err);
        handleApiError(err);
        setPresentation(prev => {
            if (!prev) return null;
            const finalSlides = [...prev.slides];
            finalSlides[slideIndex] = { ...finalSlides[slideIndex], imageUrl: 'error', imagePrompt: newPrompt };
            return { ...prev, slides: finalSlides };
        });
    }
  }, [presentation, canGenerateImage, incrementCount, limits.images, t, language]);

  const handleUploadImage = useCallback((slideIndex: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setPresentation(prev => {
            if (!prev) return null;
            const updatedSlides = [...prev.slides];
            // When a user uploads an image, we set the URL and clear the AI prompt
            // to prevent accidental regeneration with the old prompt.
            updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], imageUrl: imageUrl, imagePrompt: "" };
            return { ...prev, slides: updatedSlides };
        });
    };
    reader.readAsDataURL(file);
  }, []);

  const renderWeeklyBlueprintView = () => {
    if (!lessonBlueprint) return null;

    return (
        <div className="w-full max-w-5xl bg-surface p-8 md:p-10 rounded-3xl shadow-neumorphic-outset border border-themed animate-fade-in">
            <div className="mb-7">
              <p className="text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2">Weekly Workflow</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-primary mb-2">{t.presentation.weeklyBlueprintTitle}</h2>
              <p className="text-secondary text-base md:text-lg">{lessonBlueprint.mainTitle}</p>
            </div>

            <div className="space-y-4">
                {lessonBlueprint.days.map((day, index) => (
                    <div key={day.dayNumber} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-themed shadow-neumorphic-inset">
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center" style={{backgroundColor: 'var(--brand-light)'}}>
                                <span className="text-xs font-semibold text-brand">{t.presentation.day}</span>
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
                        Images: <span className="text-brand">{images}/{limits.images}</span>
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
                      <div className="flex justify-center gap-2 my-7 p-1 bg-surface rounded-full shadow-neumorphic-inset w-max mx-auto flex-wrap">
                          {(['K-12', 'MATATAG', '5Es Model', '4As Model'] as LessonFormat[]).map(format => (
                              <button key={format} onClick={() => setSelectedFormat(format)}
                                  className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${selectedFormat === format ? 'text-brand shadow-neumorphic-outset-sm' : 'text-secondary'}`}>
                                  {format}
                              </button>
                          ))}
                      </div>
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
            {authError || 'This link is protected. Please open this tool from your signed-in app store account.'}
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
              Return to App Store
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
        <Header usage={{ generations, images, limits }} />
        <main className="w-full max-w-7xl mx-auto px-4 md:px-6 pb-6 pt-6 flex justify-center items-start flex-grow relative z-10">
          {renderContent()}
        </main>
        <Footer />
    </div>
  );
};

export default App;
