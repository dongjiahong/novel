import React from 'react';
import { ReadingTheme } from '../types';
import { READING_THEMES } from '../constants';

interface ThemeSwatchProps {
  theme: ReadingTheme;
  isActive: boolean;
  onClick: (theme: ReadingTheme) => void;
}

export const ThemeSwatch: React.FC<ThemeSwatchProps> = ({ theme, isActive, onClick }) => {
  const themeConfig = READING_THEMES[theme];

  return (
    <button
      onClick={() => onClick(theme)}
      className={`w-6 h-6 rounded-full border-2 transition-all transform hover:scale-110 flex items-center justify-center ${
        isActive 
          ? 'border-blue-500 scale-110 shadow-sm' 
          : 'border-gray-200 dark:border-gray-700'
      }`}
      style={{ backgroundColor: themeConfig.background }}
      title={themeConfig.name}
    >
      {isActive && (
        <div 
          className="w-2 h-2 rounded-full" 
          style={{ backgroundColor: themeConfig.text }} 
        />
      )}
    </button>
  );
};
