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
  bookId: string;
  bookTitle: string;
  firstSeenAt: string; // ISO timestamp
  reviewCount: number;
  lastReviewedAt?: string;
}