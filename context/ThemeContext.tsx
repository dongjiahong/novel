import React, { createContext, useContext, useState, useEffect } from 'react';
import { ReadingTheme } from '../types';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  actualTheme: 'light' | 'dark'; // 实际应用的主题（auto 模式下会根据系统决定）
  readingTheme: ReadingTheme;
  setReadingTheme: (theme: ReadingTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [readingTheme, setReadingThemeState] = useState<ReadingTheme>('light');

  // 决定是否应用 'dark' 类到 DOM
  const isDark = (themeMode === 'auto' ? systemTheme === 'dark' : themeMode === 'dark') || 
                 readingTheme === 'dark' || 
                 readingTheme === 'solarized-dark';

  const actualTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';

  // 监听系统主题变化
// ... (omitting mid part)
  // 应用主题到 DOM
  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // 同时移除旧的主题类并添加新的阅读主题类
    const themeClasses = ['theme-light', 'theme-dark', 'theme-solarized-light', 'theme-solarized-dark'];
    root.classList.remove(...themeClasses);
    root.classList.add(`theme-${readingTheme}`);
  }, [isDark, readingTheme]);

  // 设置主题模式
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('theme_mode', mode);
  };

  // 设置阅读主题
  const setReadingTheme = (theme: ReadingTheme) => {
    setReadingThemeState(theme);
    localStorage.setItem('reading_theme', theme);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        actualTheme,
        readingTheme,
        setReadingTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
