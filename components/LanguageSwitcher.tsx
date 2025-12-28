import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, toggleLanguage } = useLanguage();

  const handleSwitch = (lang: 'EN' | 'FIL') => {
    if (language !== lang) {
      toggleLanguage();
    }
  };

  return (
    <div className="flex rounded-full p-1 bg-surface shadow-neumorphic-inset space-x-1">
      <button
        onClick={() => handleSwitch('EN')}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
          language === 'EN' ? 'shadow-neumorphic-outset-sm text-brand' : 'text-secondary'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleSwitch('FIL')}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
          language === 'FIL' ? 'shadow-neumorphic-outset-sm text-brand' : 'text-secondary'
        }`}
      >
        FIL
      </button>
    </div>
  );
};

export default LanguageSwitcher;
