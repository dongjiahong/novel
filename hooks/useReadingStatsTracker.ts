import { useEffect, useRef } from 'react';
import { useReadingTimer } from './useReadingTimer';
import { storageService } from '../services/storageService';
import { syncService, syncDirtyFlags } from '../services/syncService';
import { getTodayDateString } from '../utils/statisticsUtils';

export function useReadingStatsTracker(isActive: boolean = true) {
  const accumulatedRef = useRef(0);

  const saveStats = async () => {
    if (accumulatedRef.current === 0) return;
    const seconds = accumulatedRef.current;
    accumulatedRef.current = 0;

    const today = getTodayDateString();
    // Assuming syncService is initialized or deviceId is available synchronously from localStorage
    const deviceId = syncService.getDeviceId(); 
    
    try {
      await storageService.updateDailyReadingDuration(today, seconds, deviceId);
      // 标记阅读统计数据为脏数据，触发同步
      syncDirtyFlags.set('readingStats');
      window.dispatchEvent(new CustomEvent('sync-needed'));
    } catch (e) {
      console.error('Failed to save reading stats', e);
      // If failed, maybe push back to accumulated?
      // For now, just log.
      accumulatedRef.current += seconds; // Try to recover the lost seconds for next time
    }
  };

  useReadingTimer({
    enabled: isActive,
    onTick: () => {
      accumulatedRef.current += 1;
      
      // Save every 30 seconds to persist progress
      if (accumulatedRef.current >= 30) {
        saveStats();
      }
    },
    inactivityTimeout: 5 * 60 * 1000 // 5 mins
  });

  // Save on unmount or when isActive changes to false
  useEffect(() => {
    return () => {
      saveStats();
    };
  }, []); // Run on unmount

  // Also save when isActive changes from true to false?
  // The timer stops ticking, but we might want to flush pending seconds.
  const prevActive = useRef(isActive);
  useEffect(() => {
    if (prevActive.current && !isActive) {
      saveStats();
    }
    prevActive.current = isActive;
  }, [isActive]);
}
