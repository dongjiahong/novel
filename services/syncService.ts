import { webdavService } from './webdavService';
import { SyncData, SyncMetadata, Book, NewWord, ReadingProgress } from '../types';

const DEVICE_ID_KEY = 'device_id';
const SYNC_DATA_PATH = '/novel-reader/data.json';
const SYNC_METADATA_PATH = '/novel-reader/sync-metadata.json';
const BOOKS_DIR = '/novel-reader/books';

/**
 * 同步服务类
 * 提供数据同步、智能合并等功能
 */
class SyncService {
  /**
   * 获取或生成设备ID
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  /**
   * 从本地存储收集所有需要同步的数据
   */
  async collectLocalData(books: Book[]): Promise<SyncData> {
    const newWordsStr = localStorage.getItem('new_words_list');
    const userKnownWordsStr = localStorage.getItem('user_known_words');
    const excludedWordsStr = localStorage.getItem('excluded_words');
    const selectedLevel = localStorage.getItem('selected_vocabulary_level') || '';
    const readingProgressStr = localStorage.getItem('reading_progress');

    const newWords: NewWord[] = newWordsStr ? JSON.parse(newWordsStr) : [];
    const userKnownWords: string[] = userKnownWordsStr ? JSON.parse(userKnownWordsStr) : [];
    const excludedWords: string[] = excludedWordsStr ? JSON.parse(excludedWordsStr) : [];
    const readingProgress: ReadingProgress[] = readingProgressStr ? JSON.parse(readingProgressStr) : [];

    return {
      books,
      newWords,
      userKnownWords,
      excludedWords,
      selectedVocabularyLevel: selectedLevel,
      readingProgress,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 智能合并本地和远程数据
   */
  mergeData(local: SyncData, remote: SyncData): SyncData {
    // 合并书籍列表（去重，保留所有书籍）
    const booksMap = new Map<string, Book>();
    [...local.books, ...remote.books].forEach(book => {
      booksMap.set(book.id, book);
    });
    const mergedBooks = Array.from(booksMap.values());

    // 合并生词列表（按单词+书籍去重，保留最新的记录）
    const newWordsMap = new Map<string, NewWord>();
    [...local.newWords, ...remote.newWords].forEach(word => {
      const key = `${word.word}-${word.bookId || 'unknown'}`;
      const existing = newWordsMap.get(key);
      if (!existing || new Date(word.firstSeenAt) > new Date(existing.firstSeenAt)) {
        newWordsMap.set(key, word);
      }
    });
    const mergedNewWords = Array.from(newWordsMap.values());

    // 合并已掌握单词（取并集）
    const mergedUserKnownWords = Array.from(
      new Set([...local.userKnownWords, ...remote.userKnownWords])
    );

    // 合并排除单词（取并集）
    const mergedExcludedWords = Array.from(
      new Set([...local.excludedWords, ...remote.excludedWords])
    );

    // 词汇等级选择（取最新的）
    const localTime = new Date(local.updatedAt);
    const remoteTime = new Date(remote.updatedAt);
    const selectedVocabularyLevel = localTime > remoteTime
      ? local.selectedVocabularyLevel
      : remote.selectedVocabularyLevel;

    // 合并阅读进度（按书籍ID，保留最新的进度）
    const progressMap = new Map<string, ReadingProgress>();
    [...local.readingProgress, ...remote.readingProgress].forEach(progress => {
      const existing = progressMap.get(progress.bookId);
      if (!existing || new Date(progress.updatedAt) > new Date(existing.updatedAt)) {
        progressMap.set(progress.bookId, progress);
      }
    });
    const mergedReadingProgress = Array.from(progressMap.values());

    return {
      books: mergedBooks,
      newWords: mergedNewWords,
      userKnownWords: mergedUserKnownWords,
      excludedWords: mergedExcludedWords,
      selectedVocabularyLevel,
      readingProgress: mergedReadingProgress,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 将合并后的数据保存到本地存储
   */
  saveToLocal(data: SyncData): void {
    localStorage.setItem('new_words_list', JSON.stringify(data.newWords));
    localStorage.setItem('user_known_words', JSON.stringify(data.userKnownWords));
    localStorage.setItem('excluded_words', JSON.stringify(data.excludedWords));
    localStorage.setItem('selected_vocabulary_level', data.selectedVocabularyLevel);
    localStorage.setItem('reading_progress', JSON.stringify(data.readingProgress));
    localStorage.setItem('books_data', JSON.stringify(data.books));
  }

  /**
   * 上传同步数据到 WebDAV
   */
  async uploadSyncData(data: SyncData): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await webdavService.uploadFile(SYNC_DATA_PATH, json);

    // 更新同步元数据
    const metadata: SyncMetadata = {
      lastSyncAt: new Date().toISOString(),
      deviceId: this.getDeviceId(),
    };
    await webdavService.uploadFile(SYNC_METADATA_PATH, JSON.stringify(metadata, null, 2));
  }

  /**
   * 从 WebDAV 下载同步数据
   */
  async downloadSyncData(): Promise<SyncData | null> {
    try {
      const exists = await webdavService.fileExists(SYNC_DATA_PATH);
      if (!exists) {
        return null;
      }

      const content = await webdavService.downloadFile(SYNC_DATA_PATH);

      // 正确处理 ArrayBuffer 类型
      let contentStr: string;
      if (content instanceof ArrayBuffer) {
        contentStr = new TextDecoder().decode(content);
      } else if (typeof content === 'string') {
        contentStr = content;
      } else {
        contentStr = content.toString();
      }

      const data = JSON.parse(contentStr);
      return data as SyncData;
    } catch (error) {
      console.error('下载同步数据失败:', error);
      return null;
    }
  }

  /**
   * 上传书籍文件
   */
  async uploadBook(book: Book, fileContent: string): Promise<void> {
    const extension = book.title.endsWith('.epub') ? '.epub' : '.txt';
    const filePath = `${BOOKS_DIR}/${book.id}${extension}`;
    await webdavService.uploadFile(filePath, fileContent);
  }

  /**
   * 下载书籍文件
   */
  async downloadBook(bookId: string, extension: string = '.txt'): Promise<string | null> {
    try {
      const filePath = `${BOOKS_DIR}/${bookId}${extension}`;
      const exists = await webdavService.fileExists(filePath);
      if (!exists) {
        return null;
      }

      const content = await webdavService.downloadFile(filePath);

      // 正确处理 ArrayBuffer 类型
      if (content instanceof ArrayBuffer) {
        return new TextDecoder().decode(content);
      } else if (typeof content === 'string') {
        return content;
      } else {
        return content.toString();
      }
    } catch (error) {
      console.error(`下载书籍 ${bookId} 失败:`, error);
      return null;
    }
  }

  /**
   * 完整同步流程：下载远程数据，合并，上传
   */
  async performFullSync(localBooks: Book[], bookFiles: Map<string, string>): Promise<{
    success: boolean;
    mergedData: SyncData | null;
    error?: string;
  }> {
    try {
      // 1. 收集本地数据
      const localData = await this.collectLocalData(localBooks);

      // 2. 下载远程数据
      const remoteData = await this.downloadSyncData();

      // 3. 合并数据
      const mergedData = remoteData
        ? this.mergeData(localData, remoteData)
        : localData;

      // 4. 保存合并后的数据到本地
      this.saveToLocal(mergedData);

      // 5. 上传合并后的数据到远程
      await this.uploadSyncData(mergedData);

      // 6. 同步书籍文件
      // 上传本地有但远程没有的书籍
      for (const [bookId, fileContent] of bookFiles.entries()) {
        const book = mergedData.books.find(b => b.id === bookId);
        if (book) {
          await this.uploadBook(book, fileContent);
        }
      }

      return {
        success: true,
        mergedData,
      };
    } catch (error) {
      console.error('同步失败:', error);
      return {
        success: false,
        mergedData: null,
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
      if (!exists) {
        return null;
      }

      const content = await webdavService.downloadFile(SYNC_METADATA_PATH);

      // 正确处理 ArrayBuffer 类型
      let contentStr: string;
      if (content instanceof ArrayBuffer) {
        contentStr = new TextDecoder().decode(content);
      } else if (typeof content === 'string') {
        contentStr = content;
      } else {
        contentStr = content.toString();
      }

      const metadata = JSON.parse(contentStr) as SyncMetadata;
      return metadata.lastSyncAt;
    } catch (error) {
      console.error('获取上次同步时间失败:', error);
      return null;
    }
  }
}

// 导出单例
export const syncService = new SyncService();
