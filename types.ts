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

// 阅读进度
export interface ReadingProgress {
  bookId: string;
  bookTitle: string;
  chapterIndex: number;
  chapterTitle: string;
  paragraphIndex: number;
  updatedAt: string; // ISO timestamp
}

// 同步数据结构
export interface SyncData {
  books: Book[];
  newWords: NewWord[];
  userKnownWords: string[];
  excludedWords: string[];
  selectedVocabularyLevel: string;
  readingProgress: ReadingProgress[];
  updatedAt: string; // ISO timestamp
}

// 同步元数据
export interface SyncMetadata {
  lastSyncAt: string; // ISO timestamp
  deviceId: string;
}