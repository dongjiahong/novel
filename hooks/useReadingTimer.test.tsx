import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useReadingTimer } from './useReadingTimer';

describe('useReadingTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not increment time immediately on mount', () => {
    const onTick = vi.fn();
    renderHook(() => useReadingTimer({ onTick }));
    
    expect(onTick).not.toHaveBeenCalled();
  });

  it('should increment time every second when active', () => {
    const onTick = vi.fn();
    renderHook(() => useReadingTimer({ onTick }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onTick).toHaveBeenCalledTimes(1);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('should stop incrementing after 5 minutes of inactivity', () => {
    const onTick = vi.fn();
    renderHook(() => useReadingTimer({ onTick, inactivityTimeout: 5 * 60 * 1000 }));

    // Advance 4:59
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
    });
    // Should have ticked approx 299 times
    expect(onTick).toHaveBeenCalled();
    const callCountBefore = onTick.mock.calls.length;

    // Advance 2 more seconds (crossing the 5 min threshold)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should NOT have ticked 2 more times (maybe 1 more depending on boundary)
    // Effectively it should stop.
    // Let's verify it stops ticking eventually.
    
    const callCountAfter = onTick.mock.calls.length;
    
    // Advance another minute
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    
    const callCountFinal = onTick.mock.calls.length;
    
    // The timer should have stopped incrementing
    expect(callCountFinal).toBe(callCountAfter);
  });

  it('should resume incrementing on user activity', () => {
    const onTick = vi.fn();
    renderHook(() => useReadingTimer({ onTick, inactivityTimeout: 5 * 60 * 1000 }));

    // Go idle
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });
    const callCountIdle = onTick.mock.calls.length;

    // Trigger activity
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(1000);
    });

    expect(onTick.mock.calls.length).toBeGreaterThan(callCountIdle);
  });

  it('should stop incrementing when document is hidden', () => {
    const onTick = vi.fn();
    renderHook(() => useReadingTimer({ onTick }));

    // Mock visibilityState
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5000);
    });

    expect(onTick).not.toHaveBeenCalled(); // Should not tick while hidden
  });

  it('should resume when document becomes visible', () => {
    const onTick = vi.fn();
    // Start visible
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    renderHook(() => useReadingTimer({ onTick }));

    // Go hidden
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5000);
    });
    const callsWhileHidden = onTick.mock.calls.length;

    // Go visible
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(1000);
    });

    expect(onTick.mock.calls.length).toBeGreaterThan(callsWhileHidden);
  });
});
