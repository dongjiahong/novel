// @vitest-environment jsdom
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const TestComponent = () => {
  const { readingTheme, setReadingTheme } = useTheme() as any; // Cast to any because types aren't updated yet in the implementation
  return (
    <div>
      <span data-testid="theme">{readingTheme}</span>
      <button onClick={() => setReadingTheme('dark')}>Set Dark</button>
      <button onClick={() => setReadingTheme('solarized-light')}>Set Solarized Light</button>
    </div>
  );
};

describe('ThemeContext Reading Theme', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('provides default reading theme as light', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('updates reading theme', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    act(() => {
      screen.getByText('Set Dark').click();
    });
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reading_theme', 'dark');

    act(() => {
      screen.getByText('Set Solarized Light').click();
    });
    expect(screen.getByTestId('theme').textContent).toBe('solarized-light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reading_theme', 'solarized-light');
  });

  it('loads reading theme from localStorage', async () => {
    localStorageMock.setItem('reading_theme', 'solarized-dark');
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    await waitFor(() => {
        expect(screen.getByTestId('theme').textContent).toBe('solarized-dark');
    });
  });
});