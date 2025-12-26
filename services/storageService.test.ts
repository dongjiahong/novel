import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from './storageService';
import { DailyReadingStat } from '../types';

describe('StorageService - Reading Stats', () => {
  // Since storageService is a singleton, we need to be careful.
  // fake-indexeddb keeps state in memory.
  // We can try to clear the DB before each test or just use unique keys.
  
  beforeEach(async () => {
     // Ideally we could clear the DB here but storageService doesn't expose a clear method for stats yet.
     // We'll rely on unique dates for now.
  });

  it('should save and load daily reading stats', async () => {
    const date = '2023-10-27';
    const stat: DailyReadingStat = {
      date,
      totalDuration: 120,
      deviceStats: { 'dev1': 120 }
    };

    await storageService.saveReadingStat(stat);

    const loaded = await storageService.loadReadingStat(date);
    expect(loaded).toEqual(stat);
  });

  it('should return null for non-existent stat', async () => {
    const loaded = await storageService.loadReadingStat('2099-01-01');
    expect(loaded).toBeNull();
  });

  it('should load all reading stats', async () => {
    const stat1: DailyReadingStat = { date: '2023-10-28', totalDuration: 10, deviceStats: {} };
    const stat2: DailyReadingStat = { date: '2023-10-29', totalDuration: 20, deviceStats: {} };
    
    await storageService.saveReadingStat(stat1);
    await storageService.saveReadingStat(stat2);
    
    const all = await storageService.loadAllReadingStats();
    expect(all).toContainEqual(stat1);
    expect(all).toContainEqual(stat2);
  });
});
