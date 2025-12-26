import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatisticsTab from './StatisticsTab';
import React from 'react';

// Mock dependencies
vi.mock('../services/storageService', () => ({
  storageService: {
    loadAllReadingStats: vi.fn().mockResolvedValue([]),
  }
}));

describe('StatisticsTab', () => {
  it('should render correctly with empty state', async () => {
    render(<StatisticsTab />);
    
    // Wait for loader to disappear
    const elements = await screen.findAllByText(/今日阅读/i);
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.getByText(/累计时长/i)).toBeDefined();
    expect(screen.getByText(/最近 7 天/i)).toBeDefined();
  });
});
