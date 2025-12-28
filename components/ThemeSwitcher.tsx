
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { SunIcon, MoonIcon } from './IconComponents';

const ThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-3 text-primary bg-surface rounded-full shadow-neumorphic-outset-sm transition-all hover:shadow-neumorphic-inset"
      title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
    </button>
  );
};

export default ThemeSwitcher;
