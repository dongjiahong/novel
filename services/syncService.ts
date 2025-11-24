import { webdavService } from './webdavService';
import {
  Book,
  BookMetadata,
  BooksMetaData,
  NewWord,
  NewWordsData,
  ReadingProgress,
  ReadingProgressData,
  SyncMetadata,
  UserConfig,
  SyncData, // 旧数据结构，用于迁移
  SyncProgress,
  SyncStep,
} from '../types';

const DEVICE_ID_KEY = 'device_id';
const SYNC_DIRTY_FLAGS_KEY = 'sync_dirty_flags';

// 新的文件路径
const CONFIG_PATH = '/novel-reader/config.json';
const BOOKS_META_PATH = '/novel-reader/books-meta.json';
const NEW_WORDS_PATH = '/novel-reader/new-words.json';
const READING_PROGRESS_PATH = '/novel-reader/reading-progress.json';
const SYNC_METADATA_PATH = '/novel-reader/sync-metadata.json';
const BOOKS_DIR = '/novel-reader/books';

// 旧的文件路径（用于数据迁移）
const OLD_SYNC_DATA_PATH = '/novel-reader/data.json';

/**
 * 脏数据标记类型
 */
type SyncFileType = 'config' | 'booksMeta' | 'newWords' | 'readingProgress';

/**
 * 脏数据追踪管理器
 * 用于标记本地数据的变更状态，实现增量同步
 */
class SyncDirtyFlags {
  private flags: Record<SyncFileType, boolean>;

  constructor() {
    this.flags = this.load();
  }

  /**
   * 从 localStorage 加载标记
   */
  private load(): Record<SyncFileType, boolean> {
    try {
      const stored = localStorage.getItem(SYNC_DIRTY_FLAGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('加载脏数据标记失败:', error);
    }
    return {
      config: false,
      booksMeta: false,
      newWords: false,
      readingProgress: false,
    };
  }

  /**
   * 保存标记到 localStorage
   */
  private save(): void {
    localStorage.setItem(SYNC_DIRTY_FLAGS_KEY, JSON.stringify(this.flags));
  }

  /**
   * 标记某个文件类型为"脏"（有变更）
   */
  set(type: SyncFileType): void {
    this.flags[type] = true;
    this.save();
  }

  /**
   * 检查某个文件类型是否有变更
   */
  get(type: SyncFileType): boolean {
    return this.flags[type];
  }

  /**
   * 清除某个文件类型的脏标记
   */
  clear(type: SyncFileType): void {
    this.flags[type] = false;
    this.save();
  }

  /**
   * 清除所有脏标记
   */
  clearAll(): void {
    this.flags = {
      config: false,
      booksMeta: false,
      newWords: false,
      readingProgress: false,
    };
    this.save();
  }

  /**
   * 获取所有有变更的文件类型
   */
  getDirtyTypes(): SyncFileType[] {
    return (Object.keys(this.flags) as SyncFileType[]).filter(type => this.flags[type]);
  }
}

// 导出脏数据标记管理器实例
export const syncDirtyFlags = new SyncDirtyFlags();

/**
 * 同步服务类 - 重构版
 * 提供分离式数据同步、智能合并等功能
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
   * 正确处理 ArrayBuffer 类型
   */
  private decodeContent(content: string | Buffer | ArrayBuffer): string {
    if (content instanceof ArrayBuffer) {
      return new TextDecoder().decode(content);
    } else if (typeof content === 'string') {
      return content;
    } else {
      return content.toString();
    }
  }

  // ============ 用户配置同步 ============

  /**
   * 收集本地用户配置
   */
  async collectLocalConfig(): Promise<UserConfig> {
    const userKnownWordsStr = localStorage.getItem('user_known_words');
    const excludedWordsStr = localStorage.getItem('excluded_words');
    const selectedLevel = localStorage.getItem('selected_vocabulary_level') || '';
    const themeMode = localStorage.getItem('theme_mode') as 'light' | 'dark' | 'auto' | null;

    return {
      selectedVocabularyLevel: selectedLevel,
      userKnownWords: (userKnownWordsStr && userKnownWordsStr !== 'undefined' && userKnownWordsStr !== 'null') ? JSON.parse(userKnownWordsStr) : [],
      excludedWords: (excludedWordsStr && excludedWordsStr !== 'undefined' && excludedWordsStr !== 'null') ? JSON.parse(excludedWordsStr) : [],
      themeMode: themeMode || undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 上传用户配置
   */
  async uploadConfig(config: UserConfig): Promise<void> {
    const json = JSON.stringify(config, null, 2);
    await webdavService.uploadFile(CONFIG_PATH, json);
  }

  /**
   * 下载用户配置
   */
  async downloadConfig(): Promise<UserConfig | null> {
    try {
      const exists = await webdavService.fileExists(CONFIG_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(CONFIG_PATH);
      return JSON.parse(this.decodeContent(content)) as UserConfig;
    } catch (error) {
      console.error('下载用户配置失败:', error);
      return null;
    }
  }

  /**
   * 合并用户配置
   */
  mergeConfig(local: UserConfig, remote: UserConfig): UserConfig {
    const localTime = new Date(local.updatedAt);
    const remoteTime = new Date(remote.updatedAt);

    // 词汇等级和主题：取最新的
    const selectedVocabularyLevel = localTime > remoteTime
      ? local.selectedVocabularyLevel
      : remote.selectedVocabularyLevel;

    const themeMode = localTime > remoteTime
      ? local.themeMode
      : remote.themeMode;

    // 已掌握单词和排除单词：取并集
    const userKnownWords = Array.from(
      new Set([...local.userKnownWords, ...remote.userKnownWords])
    );
    const excludedWords = Array.from(
      new Set([...local.excludedWords, ...remote.excludedWords])
    );

    return {
      selectedVocabularyLevel,
      userKnownWords,
      excludedWords,
      themeMode,
      updatedAt: new Date().toISOString(),
    };
  }

  // ============ 书籍元数据同步 ============

  /**
   * 收集本地书籍元数据
   */
  async collectLocalBooksMeta(books: Book[]): Promise<BooksMetaData> {
    const metadata: BookMetadata[] = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      addedAt: new Date().toISOString(),
      chapterCount: book.chapters?.length || 0,
      fileExtension: book.title.endsWith('.epub') ? '.epub' : '.txt',
    }));

    return {
      books: metadata,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 上传书籍元数据
   */
  async uploadBooksMeta(booksMeta: BooksMetaData): Promise<void> {
    const json = JSON.stringify(booksMeta, null, 2);
    await webdavService.uploadFile(BOOKS_META_PATH, json);
  }

  /**
   * 下载书籍元数据
   */
  async downloadBooksMeta(): Promise<BooksMetaData | null> {
    try {
      const exists = await webdavService.fileExists(BOOKS_META_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(BOOKS_META_PATH);
      return JSON.parse(this.decodeContent(content)) as BooksMetaData;
    } catch (error) {
      console.error('下载书籍元数据失败:', error);
      return null;
    }
  }

  /**
   * 合并书籍元数据（按书名去重，保留所有书籍）
   */
  mergeBooksMeta(local: BooksMetaData, remote: BooksMetaData): BooksMetaData {
    const booksMap = new Map<string, BookMetadata>();
    [...local.books, ...remote.books].forEach(book => {
      const existing = booksMap.get(book.title);
      // 如果书籍已存在（按书名判断），保留较早添加的那个
      if (!existing || new Date(book.addedAt) < new Date(existing.addedAt)) {
        booksMap.set(book.title, book);
      }
    });

    return {
      books: Array.from(booksMap.values()),
      updatedAt: new Date().toISOString(),
    };
  }

  // ============ 生词表同步 ============

  /**
   * 收集本地生词表
   */
  async collectLocalNewWords(): Promise<NewWordsData> {
    const newWordsStr = localStorage.getItem('new_words_list');
    const newWords: NewWord[] = (newWordsStr && newWordsStr !== 'undefined' && newWordsStr !== 'null') ? JSON.parse(newWordsStr) : [];

    return {
      words: newWords,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 上传生词表
   */
  async uploadNewWords(newWords: NewWordsData): Promise<void> {
    const json = JSON.stringify(newWords, null, 2);
    await webdavService.uploadFile(NEW_WORDS_PATH, json);
  }

  /**
   * 下载生词表
   */
  async downloadNewWords(): Promise<NewWordsData | null> {
    try {
      const exists = await webdavService.fileExists(NEW_WORDS_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(NEW_WORDS_PATH);
      return JSON.parse(this.decodeContent(content)) as NewWordsData;
    } catch (error) {
      console.error('下载生词表失败:', error);
      return null;
    }
  }

  /**
   * 合并生词表（按单词+书籍去重，保留最新的记录）
   */
  mergeNewWords(local: NewWordsData, remote: NewWordsData): NewWordsData {
    const wordsMap = new Map<string, NewWord>();
    [...local.words, ...remote.words].forEach(word => {
      const key = `${word.word}-${word.bookId || 'unknown'}`;
      const existing = wordsMap.get(key);

      if (!existing) {
        // 如果不存在,直接添加
        wordsMap.set(key, word);
      } else {
        // 如果存在,合并两个版本的数据,取最新的时间戳
        const merged: NewWord = {
          ...existing,
          ...word,
          // 保留最早的 firstSeenAt
          firstSeenAt: new Date(existing.firstSeenAt) < new Date(word.firstSeenAt)
            ? existing.firstSeenAt
            : word.firstSeenAt,
          // 取最大的 reviewCount
          reviewCount: Math.max(existing.reviewCount, word.reviewCount),
          // 取最新的 lastReviewedAt
          lastReviewedAt: !existing.lastReviewedAt ? word.lastReviewedAt :
                          !word.lastReviewedAt ? existing.lastReviewedAt :
                          new Date(existing.lastReviewedAt) > new Date(word.lastReviewedAt)
                            ? existing.lastReviewedAt
                            : word.lastReviewedAt,
          // 取最新的 masteredAt
          masteredAt: !existing.masteredAt ? word.masteredAt :
                      !word.masteredAt ? existing.masteredAt :
                      new Date(existing.masteredAt) > new Date(word.masteredAt)
                        ? existing.masteredAt
                        : word.masteredAt,
          // 只要有一方标记为困难,就保留困难标记
          isMarkedDifficult: existing.isMarkedDifficult || word.isMarkedDifficult,
        };
        wordsMap.set(key, merged);
      }
    });

    return {
      words: Array.from(wordsMap.values()),
      updatedAt: new Date().toISOString(),
    };
  }

  // ============ 阅读进度同步 ============

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
      return JSON.parse(this.decodeContent(content)) as ReadingProgressData;
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

  // ============ 书籍文件同步 ============

  /**
   * 上传书籍文件
   */
  async uploadBook(book: Book, fileContent: string): Promise<void> {
    const extension = book.title.endsWith('.epub') ? '.epub' : '.txt';
    const filePath = `${BOOKS_DIR}/${book.id}${extension}`;

    console.log(`准备上传书籍: ${book.title}, 路径: ${filePath}`);

    // 如果是 EPUB 文件且内容是 Base64 字符串，需要转换回 ArrayBuffer
    if (extension === '.epub') {
      try {
        // 检查是否是 Base64 字符串
        const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(fileContent.substring(0, 100));

        if (isBase64) {
          console.log(`将 Base64 转换为二进制数据，Base64 长度: ${fileContent.length}`);
          // 将 Base64 解码为二进制字符串
          const binaryString = atob(fileContent);
          // 转换为 Uint8Array
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          console.log(`上传 EPUB 二进制数据，大小: ${bytes.length} 字节`);
          await webdavService.uploadFile(filePath, bytes.buffer);
        } else {
          console.log(`直接上传 EPUB 文本数据`);
          await webdavService.uploadFile(filePath, fileContent);
        }
      } catch (error) {
        console.error(`转换或上传 EPUB 文件失败:`, error);
        throw error;
      }
    } else {
      // TXT 文件直接上传
      console.log(`上传 TXT 文件，大小: ${fileContent.length} 字符`);
      await webdavService.uploadFile(filePath, fileContent);
    }

    console.log(`书籍上传完成: ${book.title}`);
  }

  /**
   * 下载书籍文件
   */
  async downloadBook(bookId: string, extension: string = '.txt'): Promise<string | ArrayBuffer | null> {
    try {
      const filePath = `${BOOKS_DIR}/${bookId}${extension}`;
      console.log(`准备下载书籍文件: ${filePath}`);

      const exists = await webdavService.fileExists(filePath);
      if (!exists) {
        console.warn(`书籍文件不存在: ${filePath}`);
        return null;
      }

      console.log(`开始下载文件: ${filePath}, 扩展名: ${extension}`);
      const content = await webdavService.downloadFile(filePath);

      // webdavService 已经根据文件扩展名自动处理了格式
      // EPUB 文件会返回 ArrayBuffer，TXT 文件会返回 string
      if (content instanceof ArrayBuffer) {
        console.log(`下载完成（二进制）: ${filePath}, 大小: ${content.byteLength} 字节`);
        return content;
      } else if (typeof content === 'string') {
        console.log(`下载完成（文本）: ${filePath}, 大小: ${content.length} 字符`);
        return content;
      } else {
        // Buffer 类型，转换为字符串
        console.log(`下载完成（Buffer）: ${filePath}`);
        return this.decodeContent(content);
      }
    } catch (error) {
      console.error(`下载书籍 ${bookId} 失败:`, error);
      return null;
    }
  }

  // ============ 将合并后的数据保存到本地 ============

  /**
   * 保存配置到本地
   */
  saveConfigToLocal(config: UserConfig): void {
    localStorage.setItem('selected_vocabulary_level', config.selectedVocabularyLevel);
    localStorage.setItem('user_known_words', JSON.stringify(config.userKnownWords));
    localStorage.setItem('excluded_words', JSON.stringify(config.excludedWords));
    if (config.themeMode) {
      localStorage.setItem('theme_mode', config.themeMode);
    }

    // 触发自定义事件通知配置已更新
    window.dispatchEvent(new CustomEvent('sync-config-updated'));
    console.log('📢 已触发配置更新事件');
  }

  /**
   * 保存生词表到本地
   */
  saveNewWordsToLocal(newWords: NewWordsData): void {
    localStorage.setItem('new_words_list', JSON.stringify(newWords.words));
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

  /**
   * 保存书籍元数据到本地
   */
  saveBooksMetaToLocal(booksMeta: BooksMetaData): void {
    // 注意：这里只保存元数据，实际的书籍内容由 App.tsx 管理
    localStorage.setItem('books_meta', JSON.stringify(booksMeta.books));
  }

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
          const config = localStorage.getItem('selected_vocabulary_level');
          return config ? new Date().toISOString() : new Date(0).toISOString();
        }
        case 'booksMeta': {
          const meta = localStorage.getItem('books_meta');
          return meta ? new Date().toISOString() : new Date(0).toISOString();
        }
        case 'newWords': {
          const words = localStorage.getItem('new_words_list');
          return words ? new Date().toISOString() : new Date(0).toISOString();
        }
        case 'readingProgress': {
          const progress = localStorage.getItem('reading_progress');
          return progress ? new Date().toISOString() : new Date(0).toISOString();
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
          remoteSyncMeta = JSON.parse(this.decodeContent(content)) as SyncMetadata;
          console.log('远程同步元数据:', remoteSyncMeta.fileTimestamps);
        }
      } catch (error) {
        console.warn('获取远程同步元数据失败:', error);
      }

      // 用于保存合并后的数据（需要在最后更新元数据时使用）
      let mergedConfig: UserConfig;
      let mergedBooksMeta: BooksMetaData;
      let mergedNewWords: NewWordsData;
      let mergedProgress: ReadingProgressData;

      let currentStep = 0;
      const totalSteps = 5;

      // 1. 同步用户配置（如果需要）
      const localConfig = await this.collectLocalConfig();
      const localConfigTimestamp = this.getLocalTimestamp('config');
      const needSyncConfig = this.shouldSyncFile(
        'config',
        localConfigTimestamp,
        remoteSyncMeta?.fileTimestamps?.config
      );

      if (needSyncConfig) {
        currentStep++;
        console.log('同步用户配置...');
        onProgress?.({
          currentStep: 'config',
          totalSteps,
          currentStepIndex: currentStep,
          message: '同步配置',
        });
        const remoteConfig = await this.downloadConfig();
        mergedConfig = remoteConfig
          ? this.mergeConfig(localConfig, remoteConfig)
          : localConfig;
        this.saveConfigToLocal(mergedConfig);
        await this.uploadConfig(mergedConfig);
        syncDirtyFlags.clear('config');
      } else {
        console.log('跳过用户配置同步（无变更）');
        mergedConfig = localConfig;
      }

      // 2. 同步书籍元数据（如果需要）
      const localBooksMeta = await this.collectLocalBooksMeta(localBooks);
      const localBooksMetaTimestamp = this.getLocalTimestamp('booksMeta');
      const needSyncBooksMeta = this.shouldSyncFile(
        'booksMeta',
        localBooksMetaTimestamp,
        remoteSyncMeta?.fileTimestamps?.booksMeta
      );

      if (needSyncBooksMeta) {
        currentStep++;
        console.log('同步书籍元数据...');
        onProgress?.({
          currentStep: 'books-meta',
          totalSteps,
          currentStepIndex: currentStep,
          message: '同步书籍列表',
        });
        const remoteBooksMeta = await this.downloadBooksMeta();
        mergedBooksMeta = remoteBooksMeta
          ? this.mergeBooksMeta(localBooksMeta, remoteBooksMeta)
          : localBooksMeta;
        this.saveBooksMetaToLocal(mergedBooksMeta);
        await this.uploadBooksMeta(mergedBooksMeta);
        syncDirtyFlags.clear('booksMeta');
      } else {
        console.log('跳过书籍元数据同步（无变更）');
        mergedBooksMeta = localBooksMeta;
      }

      // 3. 同步生词表（如果需要）
      const localNewWords = await this.collectLocalNewWords();
      const localNewWordsTimestamp = this.getLocalTimestamp('newWords');
      const needSyncNewWords = this.shouldSyncFile(
        'newWords',
        localNewWordsTimestamp,
        remoteSyncMeta?.fileTimestamps?.newWords
      );

      if (needSyncNewWords) {
        currentStep++;
        console.log('同步生词表...');
        onProgress?.({
          currentStep: 'new-words',
          totalSteps,
          currentStepIndex: currentStep,
          message: '同步生词表',
        });
        const remoteNewWords = await this.downloadNewWords();
        mergedNewWords = remoteNewWords
          ? this.mergeNewWords(localNewWords, remoteNewWords)
          : localNewWords;
        this.saveNewWordsToLocal(mergedNewWords);
        await this.uploadNewWords(mergedNewWords);
        syncDirtyFlags.clear('newWords');
      } else {
        console.log('跳过生词表同步（无变更）');
        mergedNewWords = localNewWords;
      }

      // 4. 同步阅读进度（如果需要）
      const localProgress = await this.collectLocalReadingProgress();
      const localProgressTimestamp = this.getLocalTimestamp('readingProgress');
      const needSyncProgress = this.shouldSyncFile(
        'readingProgress',
        localProgressTimestamp,
        remoteSyncMeta?.fileTimestamps?.readingProgress
      );

      if (needSyncProgress) {
        currentStep++;
        console.log('同步阅读进度...');
        onProgress?.({
          currentStep: 'reading-progress',
          totalSteps,
          currentStepIndex: currentStep,
          message: '同步阅读进度',
        });
        const remoteProgress = await this.downloadReadingProgress();
        mergedProgress = remoteProgress
          ? this.mergeReadingProgress(localProgress, remoteProgress)
          : localProgress;
        this.saveReadingProgressToLocal(mergedProgress);
        await this.uploadReadingProgress(mergedProgress);
        syncDirtyFlags.clear('readingProgress');
      } else {
        console.log('跳过阅读进度同步（无变更）');
        mergedProgress = localProgress;
      }

      // 5. 同步书籍文件（只上传本地有但远程没有的书籍）
      if (bookFiles.size > 0) {
        currentStep++;
        console.log('同步书籍文件...');
        onProgress?.({
          currentStep: 'book-files',
          totalSteps,
          currentStepIndex: currentStep,
          message: '同步书籍文件',
        });
        for (const [bookId, fileContent] of bookFiles.entries()) {
          const book = localBooks.find(b => b.id === bookId);
          if (book) {
            const extension = book.title.endsWith('.epub') ? '.epub' : '.txt';
            const exists = await webdavService.fileExists(`${BOOKS_DIR}/${bookId}${extension}`);
            if (!exists) {
              console.log(`上传书籍: ${book.title}`);
              await this.uploadBook(book, fileContent);
            }
          }
        }
      } else {
        console.log('跳过书籍文件同步（无新书籍）');
      }

      // 6. 更新同步元数据
      const metadata: SyncMetadata = {
        lastSyncAt: new Date().toISOString(),
        deviceId: this.getDeviceId(),
        fileTimestamps: {
          config: mergedConfig.updatedAt,
          booksMeta: mergedBooksMeta.updatedAt,
          newWords: mergedNewWords.updatedAt,
          readingProgress: mergedProgress.updatedAt,
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
      const metadata = JSON.parse(this.decodeContent(content)) as SyncMetadata;
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
      const oldData = JSON.parse(this.decodeContent(content)) as SyncData;

      // 转换为新格式并上传
      const config: UserConfig = {
        selectedVocabularyLevel: oldData.selectedVocabularyLevel,
        userKnownWords: oldData.userKnownWords,
        excludedWords: oldData.excludedWords,
        updatedAt: oldData.updatedAt,
      };
      await this.uploadConfig(config);

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
      await this.uploadBooksMeta(booksMeta);

      const newWords: NewWordsData = {
        words: oldData.newWords,
        updatedAt: oldData.updatedAt,
      };
      await this.uploadNewWords(newWords);

      const progress: ReadingProgressData = {
        progress: oldData.readingProgress,
        updatedAt: oldData.updatedAt,
      };
      await this.uploadReadingProgress(progress);

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
