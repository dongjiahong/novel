import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  actualTheme: 'light' | 'dark'; // 实际应用的主题（auto 模式下会根据系统决定）
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // 计算实际应用的主题
  const actualTheme: 'light' | 'dark' = themeMode === 'auto' ? systemTheme : themeMode;

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // 初始化系统主题
    handleChange(mediaQuery);

    // 监听变化
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // 从 localStorage 加载主题设置
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme_mode');
      if (stored && (stored === 'light' || stored === 'dark' || stored === 'auto')) {
        setThemeModeState(stored);
      }
    } catch (e) {
      console.error('Failed to load theme mode', e);
    }
  }, []);

  // 监听同步完成事件，重新加载主题设置
  useEffect(() => {
    const handleSyncComplete = () => {
      try {
        const stored = localStorage.getItem('theme_mode');
        if (stored && (stored === 'light' || stored === 'dark' || stored === 'auto')) {
          setThemeModeState(stored);
        }
      } catch (e) {
        console.error('Failed to reload theme mode', e);
      }
    };

    window.addEventListener('sync-config-updated', handleSyncComplete);

    return () => {
      window.removeEventListener('sync-config-updated', handleSyncComplete);
    };
  }, []);

  // 应用主题到 DOM
  useEffect(() => {
    const root = document.documentElement;

    if (actualTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [actualTheme]);

  // 设置主题模式
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('theme_mode', mode);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        actualTheme
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
