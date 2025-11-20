import React, { createContext, useContext, useState, useEffect } from 'react';
import { DictionaryEntry, VocabularyLevel, NewWord } from '../types';
import { loadDictionary } from '../services/dictionaryService';
import { useVocabularyLevel } from '../hooks/useVocabularyLevel';
import { useNewWordsList } from '../hooks/useNewWordsList';

interface WordContextType {
  // 词典相关
  isDictLoading: boolean;

  // 词汇等级相关
  currentVocabularyLevel: VocabularyLevel | null;
  availableLevels: VocabularyLevel[];
  setVocabularyLevel: (levelId: string) => void;
  isLevelLoading: boolean;

  // 已掌握单词管理
  knownWords: Set<string>;
  markAsKnown: (word: string) => void;
  checkIsKnown: (word: string) => boolean;

  // 生词表管理
  newWords: NewWord[];
  addNewWord: (word: NewWord) => void;
  removeNewWord: (word: string, bookId: string) => void;
  getNewWordsByBook: (bookId: string) => NewWord[];
  exportNewWords: (bookId?: string) => void;

  // 当前书籍信息（用于生词表关联）
  currentBook: { id: string; title: string } | null;
  setCurrentBook: (book: { id: string; title: string } | null) => void;

  // 单词弹窗交互
  interactingWord: { word: string; entry: DictionaryEntry } | null;
  setInteractingWord: (data: { word: string; entry: DictionaryEntry } | null) => void;
}

const WordContext = createContext<WordContextType | undefined>(undefined);

export const WordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDictLoading, setIsDictLoading] = useState(true);
  const [userKnownWords, setUserKnownWords] = useState<Set<string>>(new Set());
  const [interactingWord, setInteractingWord] = useState<{ word: string; entry: DictionaryEntry } | null>(null);
  const [currentBook, setCurrentBook] = useState<{ id: string; title: string } | null>(null);

  // 使用词汇等级 hook
  const {
    currentLevel,
    knownWordsFromLevel,
    isLoading: isLevelLoading,
    setLevel: setVocabularyLevel,
    availableLevels
  } = useVocabularyLevel();

  // 使用生词表 hook
  const {
    newWords,
    addNewWord,
    removeNewWord,
    getNewWordsByBook,
    exportNewWords
  } = useNewWordsList();

  // 合并词汇等级的已掌握单词和用户手动标记的已掌握单词
  const knownWords = React.useMemo(() => {
    const combined = new Set([...knownWordsFromLevel, ...userKnownWords]);
    return combined;
  }, [knownWordsFromLevel, userKnownWords]);

  // 加载词典
  useEffect(() => {
    const load = async () => {
      setIsDictLoading(true);
      try {
        await loadDictionary();
        console.log('📚 词典服务已初始化');
      } catch (err) {
        console.error('Failed to load dictionary:', err);
      } finally {
        setIsDictLoading(false);
      }
    };
    load();
  }, []);

  // 从 LocalStorage 加载用户手动标记的已掌握单词
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user_known_words');
      if (stored) {
        setUserKnownWords(new Set(JSON.parse(stored)));
        console.log(`✅ 已加载用户标记的已掌握单词`);
      }
    } catch (e) {
      console.error('Failed to load user known words', e);
    }
  }, []);

  /**
   * 标记单词为已掌握（用户手动标记）
   */
  const markAsKnown = (word: string) => {
    const lower = word.toLowerCase();
    setUserKnownWords(prev => {
      const next = new Set(prev);
      next.add(lower);
      localStorage.setItem('user_known_words', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  /**
   * 检查单词是否已掌握
   * 包括：词汇等级的单词 + 用户手动标记的单词
   */
  const checkIsKnown = (word: string) => {
    const lower = word.toLowerCase();

    // 检查精确匹配
    if (knownWords.has(lower)) return true;

    // 检查复数形式
    if (lower.endsWith('s') && knownWords.has(lower.slice(0, -1))) return true;
    if (lower.endsWith('es') && knownWords.has(lower.slice(0, -2))) return true;
    if (lower.endsWith('ies') && knownWords.has(lower.slice(0, -3) + 'y')) return true;

    // 检查过去式
    if (lower.endsWith('ed')) {
      if (knownWords.has(lower.slice(0, -1))) return true;
      if (knownWords.has(lower.slice(0, -2))) return true;
      if (lower.endsWith('ied') && knownWords.has(lower.slice(0, -3) + 'y')) return true;
    }

    // 检查进行时
    if (lower.endsWith('ing')) {
      if (knownWords.has(lower.slice(0, -3))) return true;
      if (knownWords.has(lower.slice(0, -3) + 'e')) return true;
    }

    return false;
  };

  return (
    <WordContext.Provider
      value={{
        isDictLoading,
        currentVocabularyLevel: currentLevel,
        availableLevels,
        setVocabularyLevel,
        isLevelLoading,
        knownWords,
        markAsKnown,
        checkIsKnown,
        newWords,
        addNewWord,
        removeNewWord,
        getNewWordsByBook,
        exportNewWords,
        currentBook,
        setCurrentBook,
        interactingWord,
        setInteractingWord
      }}
    >
      {children}
    </WordContext.Provider>
  );
};

export const useWordContext = () => {
  const context = useContext(WordContext);
  if (!context) {
    throw new Error('useWordContext must be used within a WordProvider');
  }
  return context;
};
