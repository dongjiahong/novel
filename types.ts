export interface DictionaryEntry {
  phonetic?: string;
  translation?: string;
  definition?: string;
}

export interface Dictionary {
  [key: string]: DictionaryEntry;
}

export interface Chapter {
  id: string;
  title: string;
  content: string; // Simplified for this demo, real app might use HTML or AST
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  chapters: Chapter[];
}

// Reading Themes
export type ReadingTheme = 'light' | 'dark' | 'solarized-light' | 'solarized-dark';

// Navigation Items
export type NavItem = 'library' | 'search' | 'settings' | 'stats';

// 词汇等级定义
export interface VocabularyLevel {
  id: string;
  name: string;
  fileName: string;
  wordCount: number;
  description?: string;
}

// 生词记录
export interface NewWord {
  word: string;
  translation?: string;
  phonetic?: string;
  sentence?: string; // 例句：单词所在的句子
  firstSeenAt: string; // ISO timestamp
  reviewCount: number;
  lastReviewedAt?: string;
  bookId?: string; // 关联的书籍ID
  isMarkedDifficult?: boolean; // 标记为困难词
  masteredAt?: string; // ISO timestamp - 掌握时间
}

// WebDAV 配置
export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  autoSync: boolean;
}

// 同步状态
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// 同步步骤
export type SyncStep =
  | 'config'           // 同步用户配置
  | 'books-meta'       // 同步书籍元数据
  | 'new-words'        // 同步生词表
  | 'reading-progress' // 同步阅读进度
  | 'book-files'       // 同步书籍文件
  | 'complete';        // 同步完成

// 同步进度信息
export interface SyncProgress {
  currentStep: SyncStep;
  totalSteps: number;
  currentStepIndex: number;
  message: string; // 当前步骤的描述信息
}

/**
 * 脏数据标记类型
 */
export type SyncFileType = 'config' | 'booksMeta' | 'newWords' | 'readingProgress' | 'readingStats';

// 阅读进度
export interface ReadingProgress {
  bookId: string;
  bookTitle: string;
  chapterIndex: number;
  chapterTitle: string;
  paragraphIndex: number;
  updatedAt: string; // ISO timestamp
}

// ============ 新的同步数据结构 ============

// 书籍元数据（不包含章节内容，只包含基本信息）
export interface BookMetadata {
  id: string;
  title: string;
  author?: string;
  addedAt: string; // ISO timestamp
  chapterCount: number;
  fileExtension: '.txt' | '.epub';
}

// 用户配置数据
export interface UserConfig {
  selectedVocabularyLevel: string;
  userKnownWords: string[];
  excludedWords: string[];
  themeMode?: 'light' | 'dark' | 'auto'; // 主题模式
  updatedAt: string; // ISO timestamp
}

// 书籍元数据列表
export interface BooksMetaData {
  books: BookMetadata[];
  updatedAt: string; // ISO timestamp
}

// 生词表数据（单页）
export interface NewWordsData {
  words: NewWord[];
  updatedAt: string; // ISO timestamp
}

// 生词表分页数据
export interface NewWordsPage {
  pageIndex: number; // 页码（从 0 开始）
  words: NewWord[];
  updatedAt: string; // ISO timestamp
}

// 生词表元数据（用于分页同步）
export interface NewWordsMetadata {
  totalCount: number; // 生词总数
  pageSize: number; // 每页生词数
  totalPages: number; // 总页数
  pages: {
    pageIndex: number;
    wordCount: number;
    updatedAt: string; // 该页最后更新时间
  }[];
  updatedAt: string; // 元数据最后更新时间
}

// 阅读进度数据
export interface ReadingProgressData {
  progress: ReadingProgress[];
  updatedAt: string; // ISO timestamp
}

// 同步元数据
export interface SyncMetadata {
  lastSyncAt: string; // ISO timestamp
  deviceId: string;
  // 记录各个数据文件的最后更新时间，用于增量同步
  fileTimestamps?: {
    config?: string;
    booksMeta?: string;
    newWords?: string; // 生词表元数据的更新时间
    readingProgress?: string;
    readingStats?: string; // 阅读统计数据的更新时间
  };
}

// ============ 阅读统计数据结构 ============

export interface DailyReadingStat {
  date: string; // YYYY-MM-DD
  totalDuration: number; // 当日总时长 (seconds) - 这是一个衍生值，等于 deviceStats 之和
  deviceStats: Record<string, number>; // key: deviceId, value: duration (seconds)
}

export interface ReadingStatsData {
  stats: Record<string, DailyReadingStat>; // Key: YYYY-MM-DD
  updatedAt: string; // ISO timestamp
}

// 统计总览数据（用于UI展示）
export interface ReadingStatsSummary {
  todayDuration: number;
  totalDuration: number;
  totalDays: number;
  currentStreak: number; // 连续阅读天数
  weeklyStats: { date: string; duration: number }[]; // 最近7天
  monthlyStats: { month: string; duration: number }[]; // 最近12个月
}

// ============ 旧的同步数据结构（保留以便迁移）============

// 同步数据结构（已废弃，保留用于数据迁移）
export interface SyncData {
  books: Book[];
  newWords: NewWord[];
  userKnownWords: string[];
  excludedWords: string[];
  selectedVocabularyLevel: string;
  readingProgress: ReadingProgress[];
  updatedAt: string; // ISO timestamp
}