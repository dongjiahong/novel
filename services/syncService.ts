import { webdavService } from './webdavService';
import { storageService } from './storageService';
import { mergeReadingStats } from '../utils/statisticsUtils';
import {
  Book,
  BooksMetaData,
  NewWord,
  NewWordsMetadata,
  ReadingProgressData,
  ReadingStatsData,
  SyncMetadata,
  UserConfig,
  SyncData, // 旧数据结构，用于迁移
  SyncProgress,
  SyncStep,
  SyncFileType
} from '../types';

import { 
  DEVICE_ID_KEY,
  SYNC_METADATA_PATH,
  OLD_SYNC_DATA_PATH,
  BOOKS_DIR,
  NEW_WORDS_PAGE_SIZE,
  CONFIG_UPDATED_AT_KEY,
  BOOKS_META_UPDATED_AT_KEY
} from './sync/constants';

import { decodeContent } from './sync/utils';
import { syncDirtyFlags } from './sync/SyncDirtyFlags';
import { configSync } from './sync/ConfigSync';
import { readingProgressSync } from './sync/ReadingProgressSync';
import { readingStatsSync } from './sync/ReadingStatsSync';
import { booksMetaSync } from './sync/BooksMetaSync';
import { bookFileSync } from './sync/BookFileSync';
import { newWordsSync } from './sync/NewWordsSync';

// Re-export for compatibility
export { syncDirtyFlags };
export { localNewWordsPageTimestamps } from './sync/LocalNewWordsPageTimestamps';

/**
 * 并发控制工具函数
 * 限制同时执行的 Promise 数量
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task()).then(result => {
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // 移除已完成的 Promise
      for (let i = executing.length - 1; i >= 0; i--) {
        const status = await Promise.race([
          executing[i].then(() => 'fulfilled'),
          Promise.resolve('pending')
        ]);
        if (status === 'fulfilled') {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * 同步服务类 - 重构版
 * 提供分离式数据同步、智能合并等功能
 */
class SyncService {
  /**
   * 获取或生成设备ID
   */
  public getDeviceId(): string {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  // Delegate methods to sub-services for backward compatibility or direct usage
  
  // User Config
  collectLocalConfig = configSync.collectLocalConfig.bind(configSync);
  uploadConfig = configSync.uploadConfig.bind(configSync);
  downloadConfig = configSync.downloadConfig.bind(configSync);
  mergeConfig = configSync.mergeConfig.bind(configSync);
  saveConfigToLocal = configSync.saveConfigToLocal.bind(configSync);

  // Books Meta
  collectLocalBooksMeta = booksMetaSync.collectLocalBooksMeta.bind(booksMetaSync);
  uploadBooksMeta = booksMetaSync.uploadBooksMeta.bind(booksMetaSync);
  downloadBooksMeta = booksMetaSync.downloadBooksMeta.bind(booksMetaSync);
  mergeBooksMeta = booksMetaSync.mergeBooksMeta.bind(booksMetaSync);
  saveBooksMetaToLocal = booksMetaSync.saveBooksMetaToLocal.bind(booksMetaSync);

  // New Words
  uploadNewWordsMeta = newWordsSync.uploadNewWordsMeta.bind(newWordsSync);
  downloadNewWordsMeta = newWordsSync.downloadNewWordsMeta.bind(newWordsSync);
  uploadNewWordsPage = newWordsSync.uploadNewWordsPage.bind(newWordsSync);
  downloadNewWordsPage = newWordsSync.downloadNewWordsPage.bind(newWordsSync);
  collectLocalNewWordsMeta = newWordsSync.collectLocalNewWordsMeta.bind(newWordsSync);
  syncNewWords = newWordsSync.syncNewWords.bind(newWordsSync);
  saveNewWordsToLocal = newWordsSync.saveNewWordsToLocal.bind(newWordsSync);

  // Reading Progress
  collectLocalReadingProgress = readingProgressSync.collectLocalReadingProgress.bind(readingProgressSync);
  uploadReadingProgress = readingProgressSync.uploadReadingProgress.bind(readingProgressSync);
  downloadReadingProgress = readingProgressSync.downloadReadingProgress.bind(readingProgressSync);
  mergeReadingProgress = readingProgressSync.mergeReadingProgress.bind(readingProgressSync);
  saveReadingProgressToLocal = readingProgressSync.saveReadingProgressToLocal.bind(readingProgressSync);

  // Book Files
  uploadBook = bookFileSync.uploadBook.bind(bookFileSync);
  downloadBook = bookFileSync.downloadBook.bind(bookFileSync);

  // Reading Stats
  collectLocalReadingStats = readingStatsSync.collectLocalReadingStats.bind(readingStatsSync);
  uploadReadingStats = readingStatsSync.uploadReadingStats.bind(readingStatsSync);
  downloadReadingStats = readingStatsSync.downloadReadingStats.bind(readingStatsSync);
  saveReadingStatsToLocal = readingStatsSync.saveReadingStatsToLocal.bind(readingStatsSync);

  // ============ 增量同步逻辑 ============

  /**
   * 判断是否需要同步某个文件
   * 基于本地脏标记和远程时间戳比较
   */
  private shouldSyncFile(
    type: SyncFileType,
    localTimestamp: string,
    remoteTimestamp?: string
  ): boolean {
    // 如果本地有变更，必须同步
    if (syncDirtyFlags.get(type)) {
      return true;
    }

    // 如果远程没有数据，不需要下载
    if (!remoteTimestamp) {
      return false;
    }

    // 比较时间戳，如果远程更新则需要同步
    const localTime = new Date(localTimestamp).getTime();
    const remoteTime = new Date(remoteTimestamp).getTime();
    return remoteTime > localTime;
  }

  /**
   * 获取本地文件的时间戳
   */
  private getLocalTimestamp(type: SyncFileType): string {
    try {
      switch (type) {
        case 'config': {
          const timestamp = localStorage.getItem(CONFIG_UPDATED_AT_KEY);
          return timestamp || new Date(0).toISOString();
        }
        case 'booksMeta': {
          const timestamp = localStorage.getItem(BOOKS_META_UPDATED_AT_KEY);
          return timestamp || new Date(0).toISOString();
        }
        case 'newWords': {
          const words = localStorage.getItem('new_words_list');
          // new_words_list 已废弃,使用 IndexedDB
          return words ? new Date().toISOString() : new Date(0).toISOString();
        }
        case 'readingProgress': {
          const progressStr = localStorage.getItem('reading_progress');
          if (!progressStr || progressStr === 'undefined' || progressStr === 'null') {
            return new Date(0).toISOString();
          }
          try {
            const progressList = JSON.parse(progressStr) as ReadingProgressData['progress'];
            if (!Array.isArray(progressList) || progressList.length === 0) {
              return new Date(0).toISOString();
            }
            // 返回所有进度中最新的 updatedAt
            const latestTime = progressList.reduce((latest, p) => {
              const pTime = new Date(p.updatedAt).getTime();
              return pTime > latest ? pTime : latest;
            }, 0);
            return new Date(latestTime).toISOString();
          } catch {
            return new Date(0).toISOString();
          }
        }
        case 'readingStats': {
          const timestamp = localStorage.getItem('reading_stats_updated_at');
          return timestamp || new Date(0).toISOString();
        }
        default:
          return new Date(0).toISOString();
      }
    } catch {
      return new Date(0).toISOString();
    }
  }

  // ============ 完整同步流程 ============

  /**
   * 增量同步流程：只同步有变更的数据文件
   */
  async performFullSync(
    localBooks: Book[],
    bookFiles: Map<string, string>,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    success: boolean;
    mergedBooksMeta: BooksMetaData | null;
    error?: string;
  }> {
    try {
      console.log('开始增量同步...');

      // 确保 books 目录存在
      try {
        await webdavService.ensureDirectory(BOOKS_DIR);
        console.log('Books 目录已确认存在');
      } catch (error) {
        console.warn('创建 books 目录失败，但继续同步:', error);
      }

      // 获取远程同步元数据（用于时间戳比较）
      let remoteSyncMeta: SyncMetadata | null = null;
      try {
        const exists = await webdavService.fileExists(SYNC_METADATA_PATH);
        if (exists) {
          const content = await webdavService.downloadFile(SYNC_METADATA_PATH);
          remoteSyncMeta = JSON.parse(decodeContent(content)) as SyncMetadata;
          console.log('远程同步元数据:', remoteSyncMeta.fileTimestamps);
        }
      } catch (error) {
        console.warn('获取远程同步元数据失败:', error);
      }

      // 用于保存合并后的数据（需要在最后更新元数据时使用）
      let mergedConfig: UserConfig;
      let mergedBooksMeta: BooksMetaData;
      let mergedProgress: ReadingProgressData;
      let mergedStats: ReadingStatsData;

      const totalSteps = 4; // 并发后步骤减少
      let currentStep = 0;

      // ========== 第一批并发：阅读进度、阅读统计、用户配置 ==========
      currentStep++;
      console.log('并发同步: 阅读进度、阅读统计、用户配置...');
      onProgress?.({
        currentStep: 'reading-progress',
        totalSteps,
        currentStepIndex: currentStep,
        message: '同步阅读进度、统计、配置',
      });

      // 收集本地数据（可并发）
      const [localProgress, localStats, localConfig] = await Promise.all([
        readingProgressSync.collectLocalReadingProgress(),
        readingStatsSync.collectLocalReadingStats(),
        configSync.collectLocalConfig(),
      ]);

      // 定义第一批同步任务
      const batch1Tasks: (() => Promise<void>)[] = [];

      // 阅读进度同步任务
      const localProgressTimestamp = this.getLocalTimestamp('readingProgress');
      const needSyncProgress = this.shouldSyncFile(
        'readingProgress',
        localProgressTimestamp,
        remoteSyncMeta?.fileTimestamps?.readingProgress
      );
      if (needSyncProgress) {
        batch1Tasks.push(async () => {
          console.log('  ↳ 同步阅读进度...');
          const remoteProgress = await readingProgressSync.downloadReadingProgress();
          mergedProgress = remoteProgress
            ? readingProgressSync.mergeReadingProgress(localProgress, remoteProgress)
            : localProgress;
          readingProgressSync.saveReadingProgressToLocal(mergedProgress);
          await readingProgressSync.uploadReadingProgress(mergedProgress);
          syncDirtyFlags.clear('readingProgress');
          console.log('  ✓ 阅读进度同步完成');
        });
      } else {
        mergedProgress = localProgress;
        console.log('  ⊘ 跳过阅读进度同步（无变更）');
      }

      // 阅读统计同步任务
      const localStatsTimestamp = this.getLocalTimestamp('readingStats');
      const needSyncStats = this.shouldSyncFile(
        'readingStats',
        localStatsTimestamp,
        remoteSyncMeta?.fileTimestamps?.readingStats
      );
      if (needSyncStats) {
        batch1Tasks.push(async () => {
          console.log('  ↳ 同步阅读统计...');
          const remoteStats = await readingStatsSync.downloadReadingStats();
          mergedStats = remoteStats
            ? mergeReadingStats(localStats, remoteStats)
            : localStats;
          await readingStatsSync.saveReadingStatsToLocal(mergedStats);
          await readingStatsSync.uploadReadingStats(mergedStats);
          syncDirtyFlags.clear('readingStats');
          console.log('  ✓ 阅读统计同步完成');
        });
      } else {
        mergedStats = localStats;
        console.log('  ⊘ 跳过阅读统计同步（无变更）');
      }

      // 用户配置同步任务
      const localConfigTimestamp = this.getLocalTimestamp('config');
      const needSyncConfig = this.shouldSyncFile(
        'config',
        localConfigTimestamp,
        remoteSyncMeta?.fileTimestamps?.config
      );
      if (needSyncConfig) {
        batch1Tasks.push(async () => {
          console.log('  ↳ 同步用户配置...');
          const remoteConfig = await configSync.downloadConfig();
          mergedConfig = remoteConfig
            ? configSync.mergeConfig(localConfig, remoteConfig)
            : localConfig;
          await configSync.saveConfigToLocal(mergedConfig);
          await configSync.uploadConfig(mergedConfig);
          syncDirtyFlags.clear('config');
          console.log('  ✓ 用户配置同步完成');
        });
      } else {
        mergedConfig = localConfig;
        console.log('  ⊘ 跳过用户配置同步（无变更）');
      }

      // 执行第一批并发任务（最多3个并发）
      if (batch1Tasks.length > 0) {
        await runWithConcurrency(batch1Tasks, 3);
      }

      // ========== 第二批并发：书籍元数据、生词表 ==========
      currentStep++;
      console.log('并发同步: 书籍元数据、生词表...');
      onProgress?.({
        currentStep: 'books-meta',
        totalSteps,
        currentStepIndex: currentStep,
        message: '同步书籍列表、生词表',
      });

      // 收集本地书籍元数据
      const localBooksMeta = await booksMetaSync.collectLocalBooksMeta(localBooks);

      // 定义第二批同步任务
      const batch2Tasks: (() => Promise<void>)[] = [];

      // 书籍元数据同步任务
      const localBooksMetaTimestamp = this.getLocalTimestamp('booksMeta');
      const needSyncBooksMeta = this.shouldSyncFile(
        'booksMeta',
        localBooksMetaTimestamp,
        remoteSyncMeta?.fileTimestamps?.booksMeta
      );
      if (needSyncBooksMeta) {
        batch2Tasks.push(async () => {
          console.log('  ↳ 同步书籍元数据...');
          const remoteBooksMeta = await booksMetaSync.downloadBooksMeta();
          mergedBooksMeta = remoteBooksMeta
            ? booksMetaSync.mergeBooksMeta(localBooksMeta, remoteBooksMeta)
            : localBooksMeta;
          booksMetaSync.saveBooksMetaToLocal(mergedBooksMeta);
          await booksMetaSync.uploadBooksMeta(mergedBooksMeta);
          syncDirtyFlags.clear('booksMeta');
          console.log('  ✓ 书籍元数据同步完成');
        });
      } else {
        mergedBooksMeta = localBooksMeta;
        console.log('  ⊘ 跳过书籍元数据同步（无变更）');
      }

      // 生词表同步任务
      batch2Tasks.push(async () => {
        console.log('  ↳ 同步生词表...');
        await newWordsSync.syncNewWords((current, total) => {
          // 可以在这里更新进度，但为了简化先不显示子进度
        });
        syncDirtyFlags.clear('newWords');
        console.log('  ✓ 生词表同步完成');
      });

      // 执行第二批并发任务（最多3个并发）
      await runWithConcurrency(batch2Tasks, 3);

      // ========== 顺序执行：书籍文件同步 ==========
      if (bookFiles.size > 0) {
        currentStep++;
        console.log('同步书籍文件...');
        onProgress?.({
          currentStep: 'book-files',
          totalSteps,
          currentStepIndex: currentStep,
          message: '同步书籍文件',
        });
        
        // 书籍文件也可以并发上传（最多3个）
        const bookUploadTasks: (() => Promise<void>)[] = [];
        for (const [bookId, fileContent] of bookFiles.entries()) {
          const book = localBooks.find(b => b.id === bookId);
          if (book) {
            bookUploadTasks.push(async () => {
              const extension = book.title.endsWith('.epub') ? '.epub' : '.txt';
              const exists = await webdavService.fileExists(`${BOOKS_DIR}/${bookId}${extension}`);
              if (!exists) {
                console.log(`  ↳ 上传书籍: ${book.title}`);
                await bookFileSync.uploadBook(book, fileContent);
              }
            });
          }
        }
        if (bookUploadTasks.length > 0) {
          await runWithConcurrency(bookUploadTasks, 3);
        }
      } else {
        console.log('跳过书籍文件同步（无新书籍）');
      }

      // 7. 更新同步元数据
      const newWordsMeta = await newWordsSync.downloadNewWordsMeta();
      const metadata: SyncMetadata = {
        lastSyncAt: new Date().toISOString(),
        deviceId: this.getDeviceId(),
        fileTimestamps: {
          config: mergedConfig.updatedAt,
          booksMeta: mergedBooksMeta.updatedAt,
          newWords: newWordsMeta?.updatedAt || new Date().toISOString(),
          readingProgress: mergedProgress.updatedAt,
          readingStats: mergedStats.updatedAt,
        },
      };
      await webdavService.uploadFile(SYNC_METADATA_PATH, JSON.stringify(metadata, null, 2));

      // 同步完成
      onProgress?.({
        currentStep: 'complete',
        totalSteps,
        currentStepIndex: totalSteps,
        message: '同步完成',
      });

      console.log(`增量同步完成！实际同步步骤: ${currentStep}/${totalSteps}`);
      return {
        success: true,
        mergedBooksMeta,
      };
    } catch (error) {
      console.error('同步失败:', error);
      return {
        success: false,
        mergedBooksMeta: null,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取上次同步时间
   */
  async getLastSyncTime(): Promise<string | null> {
    try {
      const exists = await webdavService.fileExists(SYNC_METADATA_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(SYNC_METADATA_PATH);
      const metadata = JSON.parse(decodeContent(content)) as SyncMetadata;
      return metadata.lastSyncAt;
    } catch (error) {
      console.error('获取上次同步时间失败:', error);
      return null;
    }
  }

  // ============ 数据迁移（从旧格式到新格式）============

  /**
   * 检查是否存在旧的同步数据
   */
  async hasOldSyncData(): Promise<boolean> {
    try {
      return await webdavService.fileExists(OLD_SYNC_DATA_PATH);
    } catch (error) {
      return false;
    }
  }

  /**
   * 从旧格式迁移数据到新格式
   */
  async migrateFromOldFormat(): Promise<boolean> {
    try {
      console.log('检测到旧格式数据，开始迁移...');

      // 下载旧数据
      const content = await webdavService.downloadFile(OLD_SYNC_DATA_PATH);
      const oldData = JSON.parse(decodeContent(content)) as SyncData;

      // 转换为新格式并上传
      const config: UserConfig = {
        selectedVocabularyLevel: oldData.selectedVocabularyLevel,
        userKnownWords: oldData.userKnownWords,
        excludedWords: oldData.excludedWords,
        updatedAt: oldData.updatedAt,
      };
      await configSync.uploadConfig(config);

      const booksMeta: BooksMetaData = {
        books: oldData.books.map(book => ({
          id: book.id,
          title: book.title,
          author: book.author,
          addedAt: oldData.updatedAt,
          chapterCount: book.chapters.length,
          fileExtension: book.title.endsWith('.epub') ? '.epub' : '.txt',
        })),
        updatedAt: oldData.updatedAt,
      };
      await booksMetaSync.uploadBooksMeta(booksMeta);

      // 生词表需要分页上传
      const words = oldData.newWords;
      const totalPages = Math.ceil(words.length / NEW_WORDS_PAGE_SIZE);
      
      // 上传生词表元数据
      const newWordsMeta: NewWordsMetadata = {
        totalCount: words.length,
        pageSize: NEW_WORDS_PAGE_SIZE,
        totalPages,
        pages: [],
        updatedAt: oldData.updatedAt,
      };
      
      for (let i = 0; i < totalPages; i++) {
        const start = i * NEW_WORDS_PAGE_SIZE;
        const end = Math.min(start + NEW_WORDS_PAGE_SIZE, words.length);
        const pageWords = words.slice(start, end);
        
        newWordsMeta.pages.push({
          pageIndex: i,
          wordCount: pageWords.length,
          updatedAt: oldData.updatedAt,
        });
        
        await newWordsSync.uploadNewWordsPage({
          pageIndex: i,
          words: pageWords,
          updatedAt: oldData.updatedAt,
        });
      }
      await newWordsSync.uploadNewWordsMeta(newWordsMeta);

      const progress: ReadingProgressData = {
        progress: oldData.readingProgress,
        updatedAt: oldData.updatedAt,
      };
      await readingProgressSync.uploadReadingProgress(progress);

      console.log('数据迁移完成！');
      return true;
    } catch (error) {
      console.error('数据迁移失败:', error);
      return false;
    }
  }
}

// 导出单例
export const syncService = new SyncService();