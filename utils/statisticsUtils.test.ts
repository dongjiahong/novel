import { ReadingStatsData, DailyReadingStat, ReadingStatsSummary } from '../types';
import { mergeReadingStats, calculateStatsSummary, getTodayDateString } from './statisticsUtils';
import { describe, it, expect } from 'vitest';

describe('statisticsUtils', () => {
  const deviceA = 'device-a';
  const deviceB = 'device-b';

  describe('getTodayDateString', () => {
    it('should return a date string in YYYY-MM-DD format', () => {
      const dateStr = getTodayDateString();
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('mergeReadingStats', () => {
    it('should merge stats from different devices for the same day', () => {
      const local: ReadingStatsData = {
        updatedAt: '2023-01-01T10:00:00Z',
        stats: {
          '2023-01-01': {
            date: '2023-01-01',
            totalDuration: 100,
            deviceStats: { [deviceA]: 100 },
          },
        },
      };

      const cloud: ReadingStatsData = {
        updatedAt: '2023-01-01T11:00:00Z',
        stats: {
          '2023-01-01': {
            date: '2023-01-01',
            totalDuration: 50,
            deviceStats: { [deviceB]: 50 },
          },
        },
      };

      const merged = mergeReadingStats(local, cloud);
      const dayStat = merged.stats['2023-01-01'];

      expect(dayStat.totalDuration).toBe(150);
      expect(dayStat.deviceStats[deviceA]).toBe(100);
      expect(dayStat.deviceStats[deviceB]).toBe(50);
    });

    it('should update local device stat if local is newer/different', () => {
      // Scenario: Cloud has old data for Device A (50s). Local has new data for Device A (100s).
      const local: ReadingStatsData = {
        updatedAt: '2023-01-01T12:00:00Z',
        stats: {
          '2023-01-01': {
            date: '2023-01-01',
            totalDuration: 100,
            deviceStats: { [deviceA]: 100 },
          },
        },
      };

      const cloud: ReadingStatsData = {
        updatedAt: '2023-01-01T11:00:00Z',
        stats: {
          '2023-01-01': {
            date: '2023-01-01',
            totalDuration: 50,
            deviceStats: { [deviceA]: 50 }, // Old data
          },
        },
      };

      // When merging, we usually prioritize the "incoming" data if we are syncing "down", 
      // BUT for our own device ID, we should trust our local state if we are the one initiating the merge?
      // Actually, the merge function usually takes (base, incoming).
      // If we are Device A, and we download Cloud, we want to keep OUR higher value for Device A, 
      // but accept Cloud's value for Device B.
      
      // Let's define the signature: mergeReadingStats(local, cloud). 
      // We assume 'local' has the authoritative data for the current device's *current session*.
      // However, the function itself doesn't know "who" called it unless we pass deviceId, 
      // OR we just take the max for each deviceId key.
      
      // Strategy: For each date, for each deviceId in deviceStats, take Math.max().
      // This handles the case where Cloud might have an older sync of Device A, or Local might be behind Cloud (if we cleared storage).
      // Wait, if I clear storage, my local is 0. Cloud has 100. I want 100. Max works.
      
      const merged = mergeReadingStats(local, cloud);
      expect(merged.stats['2023-01-01'].deviceStats[deviceA]).toBe(100);
      expect(merged.stats['2023-01-01'].totalDuration).toBe(100);
    });
  });
  
  describe('calculateStatsSummary', () => {
    it('should calculate correct summary', () => {
       const today = getTodayDateString();
       const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
       
       const data: ReadingStatsData = {
         updatedAt: new Date().toISOString(),
         stats: {
           [today]: {
             date: today,
             totalDuration: 60, // 1 min
             deviceStats: { 'dev1': 60 }
           },
           [yesterday]: {
             date: yesterday,
             totalDuration: 120, // 2 mins
             deviceStats: { 'dev1': 120 }
           }
         }
       };
       
       const summary = calculateStatsSummary(data);
       
       expect(summary.todayDuration).toBe(60);
       expect(summary.totalDuration).toBe(180);
       expect(summary.totalDays).toBe(2);
       expect(summary.weeklyStats.length).toBe(7);
       // Check that today is in weekly stats
       const todayStat = summary.weeklyStats.find(s => s.date === today);
       expect(todayStat?.duration).toBe(60);
    });
  });
});
