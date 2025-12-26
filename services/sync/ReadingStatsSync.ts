import { webdavService } from '../webdavService';
import { storageService } from '../storageService';
import { ReadingStatsData, DailyReadingStat } from '../../types';
import { READING_STATS_PATH } from './constants';
import { decodeContent } from './utils';

export class ReadingStatsSync {
  /**
   * 收集本地阅读统计数据
   */
  async collectLocalReadingStats(): Promise<ReadingStatsData> {
    const allStats = await storageService.loadAllReadingStats();
    const statsMap: Record<string, DailyReadingStat> = {};
    
    allStats.forEach(stat => {
      statsMap[stat.date] = stat;
    });

    return {
      stats: statsMap,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 上传阅读统计数据
   */
  async uploadReadingStats(statsData: ReadingStatsData): Promise<void> {
    const json = JSON.stringify(statsData, null, 2);
    await webdavService.uploadFile(READING_STATS_PATH, json);
  }

  /**
   * 下载阅读统计数据
   */
  async downloadReadingStats(): Promise<ReadingStatsData | null> {
    try {
      const exists = await webdavService.fileExists(READING_STATS_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(READING_STATS_PATH);
      return JSON.parse(decodeContent(content)) as ReadingStatsData;
    } catch (error) {
      console.error('下载阅读统计失败:', error);
      return null;
    }
  }

  /**
   * 保存阅读统计到本地
   */
  async saveReadingStatsToLocal(statsData: ReadingStatsData): Promise<void> {
    const statsArray = Object.values(statsData.stats);
    for (const stat of statsArray) {
      await storageService.saveReadingStat(stat);
    }
    
    // 记录同步时间戳以供增量同步使用
    localStorage.setItem('reading_stats_updated_at', statsData.updatedAt);
    
    // 触发自定义事件通知统计数据已更新
    window.dispatchEvent(new CustomEvent('sync-stats-updated'));
    console.log('📢 已触发阅读统计更新事件');
  }
}

export const readingStatsSync = new ReadingStatsSync();
