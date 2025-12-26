import { webdavService } from '../webdavService';
import { ReadingProgress, ReadingProgressData } from '../../types';
import { READING_PROGRESS_PATH } from './constants';
import { decodeContent } from './utils';

export class ReadingProgressSync {
  /**
   * 收集本地阅读进度
   */
  async collectLocalReadingProgress(): Promise<ReadingProgressData> {
    const progressStr = localStorage.getItem('reading_progress');
    const progress: ReadingProgress[] = (progressStr && progressStr !== 'undefined' && progressStr !== 'null') ? JSON.parse(progressStr) : [];

    return {
      progress,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 上传阅读进度
   */
  async uploadReadingProgress(progressData: ReadingProgressData): Promise<void> {
    const json = JSON.stringify(progressData, null, 2);
    await webdavService.uploadFile(READING_PROGRESS_PATH, json);
  }

  /**
   * 下载阅读进度
   */
  async downloadReadingProgress(): Promise<ReadingProgressData | null> {
    try {
      const exists = await webdavService.fileExists(READING_PROGRESS_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(READING_PROGRESS_PATH);
      return JSON.parse(decodeContent(content)) as ReadingProgressData;
    } catch (error) {
      console.error('下载阅读进度失败:', error);
      return null;
    }
  }

  /**
   * 合并阅读进度（按书籍ID，保留最新的进度）
   */
  mergeReadingProgress(
    local: ReadingProgressData,
    remote: ReadingProgressData
  ): ReadingProgressData {
    const progressMap = new Map<string, ReadingProgress>();
    [...local.progress, ...remote.progress].forEach(progress => {
      const existing = progressMap.get(progress.bookId);
      if (!existing || new Date(progress.updatedAt) > new Date(existing.updatedAt)) {
        progressMap.set(progress.bookId, progress);
      }
    });

    return {
      progress: Array.from(progressMap.values()),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 保存阅读进度到本地
   */
  saveReadingProgressToLocal(progressData: ReadingProgressData): void {
    localStorage.setItem('reading_progress', JSON.stringify(progressData.progress));

    // 触发自定义事件通知阅读进度已更新
    window.dispatchEvent(new CustomEvent('sync-progress-updated'));
    console.log('📢 已触发阅读进度更新事件');
  }
}

export const readingProgressSync = new ReadingProgressSync();
