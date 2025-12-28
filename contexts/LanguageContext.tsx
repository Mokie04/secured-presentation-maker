
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

type Language = 'EN' | 'FIL';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

const getInitialLanguage = (): Language => {
  if (typeof localStorage !== 'undefined') {
    const storedLang = localStorage.getItem('sayuna-language');
    if (storedLang === 'EN' || storedLang === 'FIL') {
      return storedLang;
    }
  }
  return 'EN'; // Default to English
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    localStorage.setItem('sayuna-language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prevLang => (prevLang === 'EN' ? 'FIL' : 'EN'));
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
