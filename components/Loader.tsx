
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../lib/translations';

interface LoaderProps {
  customMessage?: string;
  estimatedDuration?: number; // in seconds
  progress?: number | null; // New prop for controlled progress (0-100)
}

const Loader: React.FC<LoaderProps> = ({ customMessage, estimatedDuration = 30, progress: controlledProgress = null }) => {
  const [internalProgress, setInternalProgress] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const { language } = useLanguage();
  const t = translations[language];
  const { cyclingMessages, progressText } = t.loader;

  // Effect for cycling through predefined messages if no custom one is provided
  useEffect(() => {
    if (customMessage) return;

    const messageInterval = setInterval(() => {
      setCurrentMessageIndex(prevIndex => (prevIndex + 1) % cyclingMessages.length);
    }, 4000);

    return () => clearInterval(messageInterval);
  }, [cyclingMessages, customMessage]);

  // Effect for animating the progress bar (time-based fallback)
  useEffect(() => {
    // If progress is controlled from outside, don't run the internal timer.
    if (controlledProgress !== null) {
      return;
    }

    setInternalProgress(0); // Reset progress on new load for internal logic
    const progressInterval = setInterval(() => {
      setInternalProgress(prev => {
        // Increment slowly, aiming to reach 95% over the estimated duration
        const increment = (95 / (estimatedDuration * 1000)) * 100;
        const newProgress = prev + increment;
        if (newProgress >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, [estimatedDuration, controlledProgress]); // Rerun if controlledProgress changes from a number to null

  const displayProgress = controlledProgress !== null ? controlledProgress : internalProgress;
  const displayMessage = customMessage || cyclingMessages[currentMessageIndex];
  const formattedProgressText = progressText.replace('{percent}', Math.floor(displayProgress).toString());

  return (
    <div className="flex flex-col items-center justify-center gap-6 w-full max-w-lg text-center">
        {/* Spinner Element */}
        <div className="h-12 w-12 rounded-full border-b-2 border-brand animate-spin" role="status">
            <span className="sr-only">Loading...</span>
        </div>

        {/* Dynamic Message Area */}
        <div className="h-12 flex items-center justify-center">
            <p className="text-xl font-semibold text-primary">{displayMessage}</p>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-6 rounded-full shadow-neumorphic-inset p-1">
            <div
                className="h-full rounded-full progress-bar-fill relative overflow-hidden"
                style={{ width: `${displayProgress}%`, transition: 'width 0.1s linear' }}
            >
                <div className="absolute inset-0 progress-bar-animated"></div>
            </div>
        </div>
        
        {/* Percentage Counter */}
        <p className="text-base text-secondary">{formattedProgressText}</p>
    </div>
  );
};

export default Loader;
