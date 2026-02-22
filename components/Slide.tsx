import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Slide, ImageOverlayLabel } from '../types';
import { ImageIcon, RefreshCwIcon, UploadCloudIcon, FileTextIcon, XIcon } from './IconComponents';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../lib/translations';

interface SlideProps {
  slide: Slide;
  slideIndex: number;
  direction: 'next' | 'prev' | null;
  onRegenerateImage: (slideIndex: number, newPrompt: string) => void;
  onUploadImage: (slideIndex: number, file: File) => void;
  onUpdateImageOverlays: (slideIndex: number, overlays: ImageOverlayLabel[]) => void;
}

const DEFAULT_LABEL_FONT_SIZE = 16;
const MIN_LABEL_FONT_SIZE = 12;
const MAX_LABEL_FONT_SIZE = 42;

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));
const clampFontSize = (value: number): number => Math.max(MIN_LABEL_FONT_SIZE, Math.min(MAX_LABEL_FONT_SIZE, Math.round(value)));

const normalizeOverlay = (overlay: ImageOverlayLabel): ImageOverlayLabel => ({
  ...overlay,
  x: clampPercent(overlay.x),
  y: clampPercent(overlay.y),
  fontSize: clampFontSize(overlay.fontSize ?? DEFAULT_LABEL_FONT_SIZE),
});

const createOverlayLabel = (x = 50, y = 50): ImageOverlayLabel => ({
  id: `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  text: '',
  x: clampPercent(x),
  y: clampPercent(y),
  fontSize: DEFAULT_LABEL_FONT_SIZE,
});

const SlideComponent: React.FC<SlideProps> = ({ slide, slideIndex, direction, onRegenerateImage, onUploadImage, onUpdateImageOverlays }) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(slide.imagePrompt || '');
  const [draftOverlays, setDraftOverlays] = useState<ImageOverlayLabel[]>((slide.imageOverlays || []).map(normalizeOverlay));
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const imageStageRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);

  const { language } = useLanguage();
  const t = translations[language].presentation;

  const animationClass = direction === 'next'
    ? 'animate-slide-in-from-right'
    : direction === 'prev'
    ? 'animate-slide-in-from-left'
    : '';

  useEffect(() => {
    setCurrentPrompt(slide.imagePrompt || '');
  }, [slide.imagePrompt]);

  useEffect(() => {
    setDraftOverlays((slide.imageOverlays || []).map(normalizeOverlay));
    setSelectedOverlayId(null);
    setEditingOverlayId(null);
    setIsEditingLabels(false);
  }, [slide.imageOverlays, slideIndex]);

  const renderableImage = Boolean(slide.imageUrl && !['loading', 'error', 'limit_reached'].includes(slide.imageUrl));

  const selectedOverlay = draftOverlays.find((overlay) => overlay.id === selectedOverlayId) || null;

  const getRelativePercentFromClient = useCallback((clientX: number, clientY: number) => {
    const stage = imageStageRef.current;
    if (!stage) return { x: 50, y: 50 };

    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 50, y: 50 };

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: clampPercent(x), y: clampPercent(y) };
  }, []);

  const setOverlayPosition = useCallback((overlayId: string, x: number, y: number) => {
    setDraftOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === overlayId
          ? { ...overlay, x: clampPercent(x), y: clampPercent(y) }
          : overlay
      )
    );
  }, []);

  const addOverlayAt = useCallback((x: number, y: number) => {
    const newOverlay = createOverlayLabel(x, y);
    setDraftOverlays((prev) => [...prev, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
    setEditingOverlayId(newOverlay.id);
  }, []);

  const handleOverlayTextChange = useCallback((overlayId: string, text: string) => {
    setDraftOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === overlayId
          ? { ...overlay, text }
          : overlay
      )
    );
  }, []);

  const handleOverlayFontSizeChange = useCallback((overlayId: string, fontSize: number) => {
    setDraftOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === overlayId
          ? { ...overlay, fontSize: clampFontSize(fontSize) }
          : overlay
      )
    );
  }, []);

  const handleRemoveOverlay = useCallback((overlayId: string) => {
    setDraftOverlays((prev) => prev.filter((overlay) => overlay.id !== overlayId));
    setEditingOverlayId((prev) => (prev === overlayId ? null : prev));
    setSelectedOverlayId((prev) => (prev === overlayId ? null : prev));
  }, []);

  const handleSaveOverlays = useCallback(() => {
    const sanitized = draftOverlays
      .map((overlay) => ({
        ...overlay,
        text: overlay.text.trim(),
        x: clampPercent(overlay.x),
        y: clampPercent(overlay.y),
        fontSize: clampFontSize(overlay.fontSize ?? DEFAULT_LABEL_FONT_SIZE),
      }))
      .filter((overlay) => overlay.text.length > 0);

    onUpdateImageOverlays(slideIndex, sanitized);
    setIsEditingLabels(false);
    setEditingOverlayId(null);
    setSelectedOverlayId(null);
  }, [draftOverlays, onUpdateImageOverlays, slideIndex]);

  const openLabelsEditor = () => {
    if (!renderableImage) return;
    setDraftOverlays((slide.imageOverlays || []).map(normalizeOverlay));
    setIsEditingLabels(true);
    setIsEditingPrompt(false);
    setEditingOverlayId(null);
    setSelectedOverlayId((slide.imageOverlays || [])[0]?.id || null);
  };

  const cancelLabelsEditor = () => {
    setDraftOverlays((slide.imageOverlays || []).map(normalizeOverlay));
    setIsEditingLabels(false);
    setEditingOverlayId(null);
    setSelectedOverlayId(null);
  };

  const handleRegenerate = () => {
    onRegenerateImage(slideIndex, currentPrompt);
    setIsEditingPrompt(false);
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(slideIndex, e.target.files[0]);
    }
  };

  const handleImageStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditingLabels) return;

    const target = event.target as HTMLElement;
    if (target.closest('[data-overlay-label="true"]') || target.closest('[data-overlay-ui="true"]')) {
      return;
    }

    const { x, y } = getRelativePercentFromClient(event.clientX, event.clientY);
    addOverlayAt(x, y);
  };

  const startDragOverlay = (event: React.PointerEvent<HTMLDivElement>, overlayId: string) => {
    if (!isEditingLabels) return;

    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('button')) return;

    event.preventDefault();
    event.stopPropagation();

    setSelectedOverlayId(overlayId);
    setEditingOverlayId(null);

    dragMovedRef.current = false;
    let moved = false;

    const onMove = (moveEvent: PointerEvent) => {
      moved = true;
      dragMovedRef.current = true;
      const { x, y } = getRelativePercentFromClient(moveEvent.clientX, moveEvent.clientY);
      setOverlayPosition(overlayId, x, y);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      if (moved) {
        setEditingOverlayId(null);
      }

      window.setTimeout(() => {
        dragMovedRef.current = false;
      }, 0);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  useEffect(() => {
    if (!isEditingLabels) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedOverlayId) return;
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleRemoveOverlay(selectedOverlayId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditingLabels, selectedOverlayId, handleRemoveOverlay]);

  const hasImageLayout = !!slide.imageUrl || !!slide.imagePrompt;
  const hasContent = slide.content && slide.content.length > 0 && slide.content.some((c) => c.trim() !== '');

  const parseMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    return parts.map((part, i) => {
      const isBold = part.startsWith('**') && part.endsWith('**');
      const content = isBold ? part.slice(2, -2) : part;

      const chemicalRegex = /([A-Z][a-z]?)(\d+)/g;
      const subParts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      const keyPrefix = `part-${i}`;

      while ((match = chemicalRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          subParts.push(content.substring(lastIndex, match.index));
        }
        const [, element, number] = match;
        subParts.push(<span key={`${keyPrefix}-${lastIndex}`}>{element}<sub>{number}</sub></span>);
        lastIndex = chemicalRegex.lastIndex;
      }

      if (lastIndex < content.length) {
        subParts.push(content.substring(lastIndex));
      }

      if (isBold) {
        return <strong key={keyPrefix} className="font-bold text-brand">{subParts}</strong>;
      }

      return <React.Fragment key={keyPrefix}>{subParts}</React.Fragment>;
    });
  };

  return (
    <div className={`w-full h-full aspect-[16/9] bg-surface rounded-2xl shadow-neumorphic-outset flex overflow-hidden ${animationClass}`}>
      {hasImageLayout && (
        <div className="w-1/2 flex-shrink-0 h-full relative group" style={{ backgroundColor: 'var(--shadow-dark)' }}>
          {slide.imageUrl === 'loading' ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-secondary">
              <div className="w-12 h-12 border-4 border-t-4 border-themed border-t-brand rounded-full animate-spin"></div>
              <span className="text-sm mt-4">Generating...</span>
            </div>
          ) : slide.imageUrl === 'error' ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-secondary p-4 text-center">
              <ImageIcon className="w-16 h-16 mb-4 text-red-500" />
              <span className="text-base font-semibold text-primary">{t.imageErrorTitle}</span>
              <span className="text-xs mt-1">{t.imageErrorSubtitle}</span>
            </div>
          ) : slide.imageUrl === 'limit_reached' ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-secondary p-4 text-center">
              <ImageIcon className="w-16 h-16 mb-4 text-yellow-500" />
              <span className="text-base font-semibold text-primary">{t.imageLimitReachedTitle}</span>
              <span className="text-xs mt-1">{t.imageLimitReachedSubtitle}</span>
            </div>
          ) : slide.imageUrl ? (
            <div
              ref={imageStageRef}
              className={`w-full h-full relative ${isEditingLabels ? 'cursor-crosshair' : ''}`}
              onClick={handleImageStageClick}
            >
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-full h-full object-cover pointer-events-none select-none"
                draggable={false}
              />

              {(isEditingLabels ? draftOverlays : (slide.imageOverlays || []).map(normalizeOverlay)).map((overlay) => {
                const isSelected = isEditingLabels && selectedOverlayId === overlay.id;
                const isInlineEditing = isEditingLabels && editingOverlayId === overlay.id;
                const fontSize = clampFontSize(overlay.fontSize ?? DEFAULT_LABEL_FONT_SIZE);

                return (
                  <div
                    key={overlay.id}
                    data-overlay-label="true"
                    className={`absolute px-2 py-1 rounded-md border backdrop-blur-sm shadow select-none ${isEditingLabels ? 'cursor-move' : ''} ${isSelected ? 'ring-2 ring-cyan-300 border-cyan-200/50 bg-black/75' : 'border-white/20 bg-black/65'}`}
                    style={{
                      left: `${clampPercent(overlay.x)}%`,
                      top: `${clampPercent(overlay.y)}%`,
                      transform: 'translate(-50%, -50%)',
                      maxWidth: '60%',
                      fontSize: `${fontSize}px`,
                      lineHeight: 1.2,
                    }}
                    title={overlay.text || 'Label'}
                    onPointerDown={(event) => startDragOverlay(event, overlay.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isEditingLabels) return;
                      if (dragMovedRef.current) {
                        return;
                      }
                      if (selectedOverlayId === overlay.id) {
                        setEditingOverlayId(overlay.id);
                        return;
                      }
                      setSelectedOverlayId(overlay.id);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      if (!isEditingLabels) return;
                      setSelectedOverlayId(overlay.id);
                      setEditingOverlayId(overlay.id);
                    }}
                  >
                    {isInlineEditing ? (
                      <input
                        autoFocus
                        value={overlay.text}
                        onChange={(event) => handleOverlayTextChange(overlay.id, event.target.value)}
                        onBlur={() => setEditingOverlayId(null)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            setEditingOverlayId(null);
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setEditingOverlayId(null);
                          }
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        className="w-44 max-w-full bg-slate-900 text-white border border-cyan-300/60 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                        placeholder="Type label"
                      />
                    ) : (
                      <span className="font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis block" style={{ maxWidth: '100%' }}>
                        {overlay.text || (isEditingLabels ? 'Type label' : '')}
                      </span>
                    )}
                  </div>
                );
              })}

              {isEditingLabels && (
                <>
                  <div
                    data-overlay-ui="true"
                    className="absolute top-3 left-3 right-3 px-3 py-2 rounded-lg bg-black/65 border border-white/20 text-white text-xs md:text-sm"
                  >
                    Click anywhere on the image to add a label. Drag labels to move. Double-click a label to type directly.
                  </div>

                  <div
                    data-overlay-ui="true"
                    className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/70 border border-white/20 text-white p-3 md:p-4"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          onClick={() => addOverlayAt(50, 50)}
                          className="px-3 py-1.5 text-xs md:text-sm font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500"
                        >
                          Add Label
                        </button>

                        {selectedOverlay && (
                          <>
                            <button
                              onClick={() => handleOverlayFontSizeChange(selectedOverlay.id, (selectedOverlay.fontSize ?? DEFAULT_LABEL_FONT_SIZE) - 2)}
                              className="px-3 py-1.5 text-xs md:text-sm font-semibold rounded-md bg-slate-700 hover:bg-slate-600"
                            >
                              A-
                            </button>
                            <button
                              onClick={() => handleOverlayFontSizeChange(selectedOverlay.id, (selectedOverlay.fontSize ?? DEFAULT_LABEL_FONT_SIZE) + 2)}
                              className="px-3 py-1.5 text-xs md:text-sm font-semibold rounded-md bg-slate-700 hover:bg-slate-600"
                            >
                              A+
                            </button>
                            <button
                              onClick={() => handleRemoveOverlay(selectedOverlay.id)}
                              className="px-3 py-1.5 text-xs md:text-sm font-semibold rounded-md bg-red-700 hover:bg-red-600"
                            >
                              Remove
                            </button>
                          </>
                        )}

                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={cancelLabelsEditor}
                            className="px-3 py-1.5 text-xs md:text-sm font-semibold rounded-md bg-slate-700 hover:bg-slate-600"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveOverlays}
                            className="px-3 py-1.5 text-xs md:text-sm font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500"
                          >
                            Done
                          </button>
                        </div>
                      </div>

                      {selectedOverlay && (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 md:gap-4 items-center">
                          <input
                            value={selectedOverlay.text}
                            onChange={(event) => handleOverlayTextChange(selectedOverlay.id, event.target.value)}
                            className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                            placeholder="Label text"
                          />
                          <div className="flex items-center gap-2 min-w-[220px]">
                            <span className="text-xs md:text-sm whitespace-nowrap">Text Size</span>
                            <input
                              type="range"
                              min={MIN_LABEL_FONT_SIZE}
                              max={MAX_LABEL_FONT_SIZE}
                              value={clampFontSize(selectedOverlay.fontSize ?? DEFAULT_LABEL_FONT_SIZE)}
                              onChange={(event) => handleOverlayFontSizeChange(selectedOverlay.id, Number(event.target.value))}
                              className="w-full accent-cyan-400"
                            />
                            <span className="text-xs md:text-sm w-10 text-right">{clampFontSize(selectedOverlay.fontSize ?? DEFAULT_LABEL_FONT_SIZE)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-secondary p-4 text-center">
              <ImageIcon className="w-24 h-24 mb-4" />
              <span className="text-sm font-semibold text-primary">{t.imageSkippedTitle}</span>
              <span className="text-xs mt-1">{t.imageSkippedSubtitle}</span>
            </div>
          )}

          {!isEditingLabels && (
            <div className="absolute top-3 right-3 z-20 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setIsEditingPrompt(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold text-primary rounded-lg shadow-neumorphic-outset bg-surface/95 transition-all hover:shadow-neumorphic-inset"
              >
                <RefreshCwIcon className="w-4 h-4" /> Regenerate
              </button>
              <button
                onClick={handleUploadClick}
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold text-primary rounded-lg shadow-neumorphic-outset bg-surface/95 transition-all hover:shadow-neumorphic-inset"
              >
                <UploadCloudIcon className="w-4 h-4" /> Replace
              </button>
              <button
                onClick={openLabelsEditor}
                disabled={!renderableImage}
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold text-primary rounded-lg shadow-neumorphic-outset bg-surface/95 transition-all hover:shadow-neumorphic-inset disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileTextIcon className="w-4 h-4" /> Labels
              </button>
              <input type="file" ref={uploadInputRef} onChange={handleFileSelected} className="hidden" accept="image/*" />
            </div>
          )}

          {isEditingPrompt && (
            <div className="absolute inset-0 bg-black/80 p-4 flex flex-col justify-center items-center backdrop-blur-sm z-30">
              <textarea
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                className="w-full h-32 p-2 bg-slate-900 text-white rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter new image prompt..."
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setIsEditingPrompt(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerate}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Generate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`${hasImageLayout ? 'w-1/2' : 'w-full'} h-full p-8 md:p-12 flex flex-col ${!hasContent ? 'justify-center' : ''} overflow-hidden`}>
        <h2 className={`font-bold text-brand flex-shrink-0 ${hasContent ? 'text-4xl md:text-5xl mb-4' : 'text-5xl md:text-7xl text-center'}`}>{slide.title}</h2>
        {hasContent && <div className="w-24 h-1.5 bg-brand rounded-full mb-8"></div>}
        {hasContent && (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mr-6 pr-4">
            <ul className="space-y-4 w-full">
              {slide.content.map((point, index) => {
                const isOrderedList = /^[A-E0-9]+\./.test(point);

                return (
                  <li key={index} className="text-xl md:text-2xl text-primary flex items-start leading-relaxed">
                    {!isOrderedList && <span className="text-brand mr-4 mt-1.5 flex-shrink-0">•</span>}
                    <span className="whitespace-pre-wrap">{parseMarkdown(point)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: var(--shadow-dark);
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
};

export default SlideComponent;
