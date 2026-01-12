import React, { createContext, useContext, useState, useEffect } from 'react';
import { ReadingTheme } from '../types';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemeColor = 'cyan' | 'blue' | 'purple' | 'emerald' | 'rose' | 'amber';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  actualTheme: 'light' | 'dark'; // 实际应用的主题（auto 模式下会根据系统决定）
  readingTheme: ReadingTheme;
  setReadingTheme: (theme: ReadingTheme) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_COLORS: Record<ThemeColor, Record<number, string>> = {
  cyan: {
    50: '236 254 255',
    100: '207 250 254',
    200: '165 243 252',
    300: '103 232 249',
    400: '34 211 238',
    500: '6 182 212',
    600: '8 145 178',
    700: '14 116 144',
    800: '21 94 117',
    900: '22 78 99',
    950: '8 51 68',
  },
  blue: {
    50: '239 246 255',
    100: '219 234 254',
    200: '191 219 254',
    300: '147 197 253',
    400: '96 165 250',
    500: '59 130 246',
    600: '37 99 235',
    700: '29 78 216',
    800: '30 64 175',
    900: '30 58 138',
    950: '23 37 84',
  },
  purple: {
    50: '250 245 255',
    100: '243 232 255',
    200: '233 213 255',
    300: '216 180 254',
    400: '192 132 252',
    500: '168 85 247',
    600: '147 51 234',
    700: '126 34 206',
    800: '107 33 168',
    900: '88 28 135',
    950: '59 7 100',
  },
  emerald: {
    50: '236 253 245',
    100: '209 250 229',
    200: '167 243 208',
    300: '110 231 183',
    400: '52 211 153',
    500: '16 185 129',
    600: '5 150 105',
    700: '4 120 87',
    800: '6 95 70',
    900: '6 78 59',
    950: '2 44 34',
  },
  rose: {
    50: '255 241 242',
    100: '255 228 230',
    200: '254 205 211',
    300: '253 164 175',
    400: '251 113 133',
    500: '244 63 94',
    600: '225 29 72',
    700: '190 18 60',
    800: '159 18 57',
    900: '136 19 55',
    950: '76 5 25',
  },
  amber: {
    50: '255 251 235',
    100: '254 243 199',
    200: '253 230 138',
    300: '252 211 77',
    400: '251 191 36',
    500: '245 158 11',
    600: '217 119 6',
    700: '180 83 9',
    800: '146 64 14',
    900: '120 53 15',
    950: '69 26 3',
  },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [readingTheme, setReadingThemeState] = useState<ReadingTheme>('light');
  const [themeColor, setThemeColorState] = useState<ThemeColor>('cyan');

  // 初始化加载
  useEffect(() => {
    // 加载主题模式
    const savedMode = localStorage.getItem('theme_mode') as ThemeMode;
    if (savedMode) setThemeModeState(savedMode);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setThemeModeState('auto');

    // 加载阅读主题
    const savedReadingTheme = localStorage.getItem('reading_theme') as ReadingTheme;
    if (savedReadingTheme) setReadingThemeState(savedReadingTheme);

    // 加载颜色主题
    const savedThemeColor = localStorage.getItem('theme_color') as ThemeColor;
    if (savedThemeColor && THEME_COLORS[savedThemeColor]) {
      setThemeColorState(savedThemeColor);
    }
    
    // 监听系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 决定是否应用 'dark' 类到 DOM
  const isDark = (themeMode === 'auto' ? systemTheme === 'dark' : themeMode === 'dark') || 
                 readingTheme === 'dark' || 
                 readingTheme === 'solarized-dark';

  const actualTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';

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

  // 应用颜色主题变量
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEME_COLORS[themeColor];
    
    if (colors) {
      Object.entries(colors).forEach(([shade, value]) => {
        root.style.setProperty(`--color-primary-${shade}`, value);
      });
    }
  }, [themeColor]);

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

  // 设置颜色主题
  const setThemeColor = (color: ThemeColor) => {
    setThemeColorState(color);
    localStorage.setItem('theme_color', color);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        actualTheme,
        readingTheme,
        setReadingTheme,
        themeColor,
        setThemeColor
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