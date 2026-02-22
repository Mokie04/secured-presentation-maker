
import React, { useState, useRef, useEffect } from 'react';
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

const SlideComponent: React.FC<SlideProps> = ({ slide, slideIndex, direction, onRegenerateImage, onUploadImage, onUpdateImageOverlays }) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(slide.imagePrompt || '');
  const [draftOverlays, setDraftOverlays] = useState<ImageOverlayLabel[]>(slide.imageOverlays || []);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
    setDraftOverlays(slide.imageOverlays || []);
  }, [slide.imageOverlays, slideIndex]);

  const createOverlayLabel = (): ImageOverlayLabel => ({
    id: `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: '',
    x: 50,
    y: 50,
  });

  const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

  const handleRegenerate = () => {
    onRegenerateImage(slideIndex, currentPrompt);
    setIsEditingPrompt(false);
  };

  const handleAddOverlay = () => {
    setDraftOverlays((prev) => [...prev, createOverlayLabel()]);
  };

  const openLabelsEditor = () => {
    setDraftOverlays(slide.imageOverlays || []);
    setIsEditingLabels(true);
  };

  const cancelLabelsEditor = () => {
    setDraftOverlays(slide.imageOverlays || []);
    setIsEditingLabels(false);
  };

  const handleOverlayChange = (id: string, field: 'text' | 'x' | 'y', value: string) => {
    setDraftOverlays((prev) =>
      prev.map((overlay) => {
        if (overlay.id !== id) return overlay;
        if (field === 'text') {
          return { ...overlay, text: value };
        }
        const numericValue = Number(value);
        return { ...overlay, [field]: clampPercent(Number.isFinite(numericValue) ? numericValue : 0) };
      })
    );
  };

  const handleRemoveOverlay = (id: string) => {
    setDraftOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
  };

  const handleSaveOverlays = () => {
    const sanitized = draftOverlays
      .map((overlay) => ({
        ...overlay,
        text: overlay.text.trim(),
        x: clampPercent(overlay.x),
        y: clampPercent(overlay.y),
      }))
      .filter((overlay) => overlay.text.length > 0);
    onUpdateImageOverlays(slideIndex, sanitized);
    setIsEditingLabels(false);
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(slideIndex, e.target.files[0]);
    }
  };
  
  const hasImageLayout = !!slide.imageUrl || !!slide.imagePrompt;

  const hasContent = slide.content && slide.content.length > 0 && slide.content.some(c => c.trim() !== '');

  const parseMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    return parts.map((part, i) => {
        const isBold = part.startsWith('**') && part.endsWith('**');
        const content = isBold ? part.slice(2, -2) : part;

        const chemicalRegex = /([A-Z][a-z]?)(\d+)/g;
        // FIX: Use React.ReactNode instead of JSX.Element to resolve "Cannot find namespace 'JSX'" error. React.ReactNode is more appropriate as it can be a string or a React element.
        const subParts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;
        const keyPrefix = `part-${i}`;

        while ((match = chemicalRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                subParts.push(content.substring(lastIndex, match.index));
            }
            const [_, element, number] = match;
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
        <div className="w-1/2 flex-shrink-0 h-full relative group" style={{backgroundColor: 'var(--shadow-dark)'}}>
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
            <>
              <img 
                src={slide.imageUrl} 
                alt={slide.title} 
                className="w-full h-full object-cover" 
              />
              {(slide.imageOverlays || []).map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute px-2 py-1 rounded-md text-[11px] md:text-xs font-bold text-white bg-black/65 border border-white/20 backdrop-blur-sm shadow"
                  style={{
                    left: `${clampPercent(overlay.x)}%`,
                    top: `${clampPercent(overlay.y)}%`,
                    transform: 'translate(-50%, -50%)',
                    maxWidth: '45%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={overlay.text}
                >
                  {overlay.text}
                </div>
              ))}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-secondary p-4 text-center">
                <ImageIcon className="w-24 h-24 mb-4" />
                <span className="text-sm font-semibold text-primary">{t.imageSkippedTitle}</span>
                <span className="text-xs mt-1">{t.imageSkippedSubtitle}</span>
            </div>
          )}

           <div className="absolute inset-0 bg-[color:var(--shadow-dark)] opacity-0 group-hover:opacity-80 transition-opacity flex items-center justify-center gap-4">
                <button
                onClick={() => setIsEditingPrompt(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary rounded-lg shadow-neumorphic-outset bg-surface transition-all hover:shadow-neumorphic-inset"
                >
                <RefreshCwIcon className="w-4 h-4" /> Regenerate
                </button>
                <button
                onClick={handleUploadClick}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary rounded-lg shadow-neumorphic-outset bg-surface transition-all hover:shadow-neumorphic-inset"
                >
                <UploadCloudIcon className="w-4 h-4" /> Replace
                </button>
                <button
                onClick={openLabelsEditor}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary rounded-lg shadow-neumorphic-outset bg-surface transition-all hover:shadow-neumorphic-inset"
                >
                <FileTextIcon className="w-4 h-4" /> Labels
                </button>
                <input type="file" ref={uploadInputRef} onChange={handleFileSelected} className="hidden" accept="image/*" />
            </div>

            {isEditingPrompt && (
                <div className="absolute inset-0 bg-black/80 p-4 flex flex-col justify-center items-center backdrop-blur-sm z-10">
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

            {isEditingLabels && (
                <div className="absolute inset-0 bg-black/85 p-4 md:p-5 flex flex-col backdrop-blur-sm z-20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-bold text-base">Manual Labels</h4>
                    <button
                      onClick={cancelLabelsEditor}
                      className="p-2 rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {draftOverlays.map((overlay) => (
                      <div key={overlay.id} className="bg-slate-900/80 border border-slate-700 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            value={overlay.text}
                            onChange={(e) => handleOverlayChange(overlay.id, 'text', e.target.value)}
                            className="flex-1 px-2 py-1.5 bg-slate-800 text-white rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Label text"
                          />
                          <button
                            onClick={() => handleRemoveOverlay(overlay.id)}
                            className="px-2 py-1.5 text-xs font-semibold text-red-200 bg-red-900/50 rounded-md hover:bg-red-800/60"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs text-slate-300">
                            X ({Math.round(overlay.x)}%)
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={overlay.x}
                              onChange={(e) => handleOverlayChange(overlay.id, 'x', e.target.value)}
                              className="w-full mt-1 accent-indigo-500"
                            />
                          </label>
                          <label className="text-xs text-slate-300">
                            Y ({Math.round(overlay.y)}%)
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={overlay.y}
                              onChange={(e) => handleOverlayChange(overlay.id, 'y', e.target.value)}
                              className="w-full mt-1 accent-indigo-500"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 justify-between">
                    <button
                      onClick={handleAddOverlay}
                      className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                    >
                      Add Label
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelLabelsEditor}
                        className="px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveOverlays}
                        className="px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                      >
                        Save Labels
                      </button>
                    </div>
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
