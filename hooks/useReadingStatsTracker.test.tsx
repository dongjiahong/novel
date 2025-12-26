import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useReadingStatsTracker } from './useReadingStatsTracker';
import { storageService } from '../services/storageService';
import { syncService } from '../services/syncService';
import * as timerHook from './useReadingTimer';

// Mock dependencies
vi.mock('../services/storageService', () => ({
  storageService: {
    updateDailyReadingDuration: vi.fn(),
  }
}));

vi.mock('../services/syncService', () => ({
  syncService: {
    getDeviceId: vi.fn(() => 'test-device'),
  },
  syncDirtyFlags: {
    set: vi.fn(),
  }
}));

describe('useReadingStatsTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save stats when timer ticks 30 times', async () => {
    // Mock useReadingTimer to simulate ticks
    let tickCallback: (() => void) | undefined;
    vi.spyOn(timerHook, 'useReadingTimer').mockImplementation(({ onTick }) => {
      tickCallback = onTick;
    });

    renderHook(() => useReadingStatsTracker(true));

    expect(tickCallback).toBeDefined();

    // Simulate 30 ticks
    for (let i = 0; i < 30; i++) {
      tickCallback?.();
    }

    expect(storageService.updateDailyReadingDuration).toHaveBeenCalledTimes(1);
    expect(storageService.updateDailyReadingDuration).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        30,
        'test-device'
    );
  });
  
  it('should save stats on unmount', () => {
    let tickCallback: (() => void) | undefined;
    vi.spyOn(timerHook, 'useReadingTimer').mockImplementation(({ onTick }) => {
      tickCallback = onTick;
    });

    const { unmount } = renderHook(() => useReadingStatsTracker(true));
    
    // Tick 10 times
    for (let i = 0; i < 10; i++) {
        tickCallback?.();
    }
    
    // Should not have saved yet
    expect(storageService.updateDailyReadingDuration).not.toHaveBeenCalled();
    
    unmount();
    
    // Should save on unmount
    expect(storageService.updateDailyReadingDuration).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        10,
        'test-device'
    );
  });
});
