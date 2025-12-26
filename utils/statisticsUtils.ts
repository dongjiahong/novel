import { ReadingStatsData, ReadingStatsSummary, DailyReadingStat } from '../types';

export function getTodayDateString(): string {
  // Use local time for "Today" as reading is a daily activity relative to user
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mergeReadingStats(local: ReadingStatsData, cloud: ReadingStatsData): ReadingStatsData {
  const mergedStats: Record<string, DailyReadingStat> = { ...local.stats };

  // Iterate over cloud stats
  Object.values(cloud.stats).forEach(cloudDayStat => {
    const date = cloudDayStat.date;
    const localDayStat = mergedStats[date];

    if (!localDayStat) {
      // If local doesn't have this day, just take cloud's
      mergedStats[date] = { ...cloudDayStat };
    } else {
      // Merge device stats
      const mergedDeviceStats = { ...localDayStat.deviceStats };
      
      Object.entries(cloudDayStat.deviceStats).forEach(([deviceId, duration]) => {
        const localDuration = mergedDeviceStats[deviceId] || 0;
        // Strategy: Max of local vs cloud for each device-day
        mergedDeviceStats[deviceId] = Math.max(localDuration, duration);
      });

      // Recalculate total duration
      const totalDuration = Object.values(mergedDeviceStats).reduce((a, b) => a + b, 0);

      mergedStats[date] = {
        date,
        totalDuration,
        deviceStats: mergedDeviceStats,
      };
    }
  });

  return {
    stats: mergedStats,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateStatsSummary(data: ReadingStatsData): ReadingStatsSummary {
  const todayStr = getTodayDateString();
  const allStats = Object.values(data.stats);
  
  const totalDuration = allStats.reduce((acc, curr) => acc + curr.totalDuration, 0);
  const totalDays = allStats.filter(s => s.totalDuration > 0).length;
  
  const todayStat = data.stats[todayStr];
  const todayDuration = todayStat ? todayStat.totalDuration : 0;

  // Weekly Stats (Last 7 days)
  const weeklyStats: { date: string; duration: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const stat = data.stats[dateStr];
    weeklyStats.push({
      date: dateStr,
      duration: stat ? stat.totalDuration : 0
    });
  }

  // Monthly Stats (Last 12 months)
  const monthlyStats: { month: string; duration: number }[] = [];
  const monthMap: Record<string, number> = {};

  allStats.forEach(stat => {
    const monthStr = stat.date.substring(0, 7); // YYYY-MM
    monthMap[monthStr] = (monthMap[monthStr] || 0) + stat.totalDuration;
  });

  // Get last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyStats.push({
      month: monthStr,
      duration: monthMap[monthStr] || 0
    });
  }
  
  // Streak Calculation (Iterate backwards from today)
  let currentStreak = 0;
  let checkDate = new Date();
  
  while (true) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    const stat = data.stats[dateStr];
    if (stat && stat.totalDuration > 0) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If it's today and duration is 0, we check yesterday to continue streak
      if (dateStr === todayStr && currentStreak === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }
  }

  return {
    todayDuration,
    totalDuration,
    totalDays,
    currentStreak,
    weeklyStats,
    monthlyStats
  };
}
