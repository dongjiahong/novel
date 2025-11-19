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