
import React from 'react';
import { MagicWandIcon, ImageIcon, BookOpenIcon } from './IconComponents';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../lib/translations';

interface HeaderProps {
  usage: {
    generations: number;
    images: number;
    limits: {
        generations: number;
        images: number;
    }
  }
}

const QuotaIndicator: React.FC<{ icon: React.ReactNode; label: string; count: number; limit: number; }> = ({ icon, label, count, limit }) => {
    const itemsLeft = Math.max(0, limit - count);
    const percentage = limit > 0 ? (itemsLeft / limit) * 100 : 0;

    let barColor = 'bg-brand';
    if (percentage <= 25) barColor = 'bg-yellow-500';
    if (percentage <= 10) barColor = 'bg-red-500';

    return (
        <div className="flex items-center gap-2 text-xs font-semibold text-secondary bg-surface px-3 py-2 rounded-lg shadow-neumorphic-inset" title={`${itemsLeft} ${label.toLowerCase()} remaining today.`}>
            {icon}
            <div className="flex flex-col items-center w-16">
                <span className="text-primary">{itemsLeft} / {limit}</span>
                <div className="w-full h-1 bg-surface rounded-full shadow-neumorphic-inset mt-0.5">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }}></div>
                </div>
            </div>
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ usage }) => {
  const { language } = useLanguage();
  const t = translations[language].header;

  return (
    <header className="sticky top-0 z-50 w-full flex justify-center pt-4">
      <div className="w-full max-w-7xl bg-surface rounded-2xl shadow-neumorphic-outset-sm flex items-center justify-between p-4">
        {/* Left Side: Logo */}
        <div className="flex items-center gap-2">
            <div className="p-2 bg-surface rounded-full shadow-neumorphic-outset-sm">
                <MagicWandIcon className="w-5 h-5 text-brand" />
            </div>
            <span className="font-bold text-primary tracking-tight hidden sm:block text-2xl">
              SAYUNA AI-POWERED <span className="text-brand">PRESENTATION MAKER</span>
            </span>
        </div>

        {/* Right Side: Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <QuotaIndicator
              icon={<BookOpenIcon className="w-4 h-4 text-brand" />}
              label={t.generationsQuota}
              count={usage.generations}
              limit={usage.limits.generations}
          />
          <QuotaIndicator
              icon={<ImageIcon className="w-4 h-4 text-brand" />}
              label={t.imagesQuota}
              count={usage.images}
              limit={usage.limits.images}
          />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
};

export default Header;