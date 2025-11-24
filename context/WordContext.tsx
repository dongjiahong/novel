import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DictionaryEntry, VocabularyLevel, NewWord } from '../types';
import { loadDictionary } from '../services/dictionaryService';
import { useVocabularyLevel } from '../hooks/useVocabularyLevel';
import { useNewWordsList } from '../hooks/useNewWordsList';
import { syncDirtyFlags } from '../services/syncService';
import { storageService } from '../services/storageService';

interface WordContextType {
  // 词典相关
  isDictLoading: boolean;
  dictionarySize: 'small' | 'large';
  setDictionarySize: (size: 'small' | 'large') => void;

  // 词汇等级相关
  currentVocabularyLevel: VocabularyLevel | null;
  availableLevels: VocabularyLevel[];
  setVocabularyLevel: (levelId: string) => void;
  isLevelLoading: boolean;

  // 已掌握单词管理
  knownWords: Set<string>;
  markAsKnown: (word: string) => void;
  unmarkAsKnown: (word: string) => void;
  checkIsKnown: (word: string) => boolean;

  // 生词表管理
  newWords: NewWord[];
  addNewWord: (word: NewWord) => void;
  removeNewWord: (word: string) => void;
  clearNewWords: () => void;
  exportNewWords: () => void;
  checkIsInNewWords: (word: string) => boolean;
  markWordAsMastered: (word: string) => void;
  markWordAsDifficult: (word: string) => void;

  // 单词弹窗交互
  interactingWord: { word: string; entry: DictionaryEntry; sentence?: string } | null;
  setInteractingWord: (data: { word: string; entry: DictionaryEntry; sentence?: string } | null) => void;
}

const WordContext = createContext<WordContextType | undefined>(undefined);

export const WordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDictLoading, setIsDictLoading] = useState(true);
  const [dictionarySize, setDictionarySizeState] = useState<'small' | 'large'>('small');
  const [userKnownWords, setUserKnownWords] = useState<Set<string>>(new Set());
  const [excludedWords, setExcludedWords] = useState<Set<string>>(new Set()); // 用户明确不认识的单词
  const [interactingWord, setInteractingWord] = useState<{ word: string; entry: DictionaryEntry; sentence?: string } | null>(null);

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
    clearNewWords,
    exportNewWords,
    markWordAsMastered,
    markWordAsDifficult
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

  // 重新加载配置的函数
  const reloadConfigFromStorage = useCallback(async () => {
    console.log('🔄 重新加载用户配置...');

    // 从 IndexedDB 重新加载已掌握单词
    try {
      const words = await storageService.loadKnownWords();
      setUserKnownWords(new Set(words));
      console.log(`✅ 已从 IndexedDB 重新加载 ${words.length} 个用户标记的已掌握单词`);
    } catch (e) {
      console.error('Failed to reload user known words from IndexedDB', e);
      setUserKnownWords(new Set());
    }

    // 从 IndexedDB 重新加载排除的单词
    try {
      const words = await storageService.loadExcludedWords();
      setExcludedWords(new Set(words));
      console.log(`✅ 已从 IndexedDB 重新加载 ${words.length} 个用户排除的单词`);
    } catch (e) {
      console.error('Failed to reload excluded words from IndexedDB', e);
      setExcludedWords(new Set());
    }
  }, []);

  // 从 LocalStorage 加载用户手动标记的已掌握单词
  useEffect(() => {
    reloadConfigFromStorage();
  }, [reloadConfigFromStorage]);

  // 监听同步完成事件，重新加载配置
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('📥 收到同步完成事件，重新加载配置');
      reloadConfigFromStorage();
    };

    window.addEventListener('sync-config-updated', handleSyncComplete);

    return () => {
      window.removeEventListener('sync-config-updated', handleSyncComplete);
    };
  }, [reloadConfigFromStorage]);

  // 从 LocalStorage 加载词典大小设置
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dictionary_size');
      if (stored && (stored === 'small' || stored === 'large')) {
        setDictionarySizeState(stored);
        console.log(`✅ 已加载词典大小设置: ${stored}`);
      }
    } catch (e) {
      console.error('Failed to load dictionary size', e);
    }
  }, []);

  // 设置词典大小
  const setDictionarySize = (size: 'small' | 'large') => {
    setDictionarySizeState(size);
    localStorage.setItem('dictionary_size', size);
    console.log(`📚 词典大小已设置为: ${size}`);
  };

  /**
   * 标记单词为已掌握（用户手动标记）
   */
  const markAsKnown = async (word: string) => {
    const lower = word.toLowerCase();
    // 添加到已掌握列表
    setUserKnownWords(prev => {
      const next = new Set(prev);
      next.add(lower);
      // 保存到 IndexedDB
      storageService.addKnownWord(lower).catch(err =>
        console.error('Failed to save known word to IndexedDB:', err)
      );
      return next;
    });
    // 从排除列表中移除（如果存在）
    setExcludedWords(prev => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
        // 从 IndexedDB 移除
        storageService.removeExcludedWord(lower).catch(err =>
          console.error('Failed to remove excluded word from IndexedDB:', err)
        );
      }
      return next;
    });
    // 标记配置为脏数据
    syncDirtyFlags.set('config');
  };

  /**
   * 取消标记单词为已掌握
   * 会从用户标记列表中移除，并添加到排除列表（即使是词汇等级默认的单词也会被排除）
   */
  const unmarkAsKnown = async (word: string) => {
    const lower = word.toLowerCase();
    // 从已掌握列表中移除
    setUserKnownWords(prev => {
      const next = new Set(prev);
      next.delete(lower);
      // 从 IndexedDB 移除
      storageService.removeKnownWord(lower).catch(err =>
        console.error('Failed to remove known word from IndexedDB:', err)
      );
      return next;
    });
    // 添加到排除列表
    setExcludedWords(prev => {
      const next = new Set(prev);
      next.add(lower);
      // 保存到 IndexedDB
      storageService.addExcludedWord(lower).catch(err =>
        console.error('Failed to save excluded word to IndexedDB:', err)
      );
      return next;
    });
    // 标记配置为脏数据
    syncDirtyFlags.set('config');
  };

  /**
   * 检查单词是否已掌握
   * 包括：词汇等级的单词 + 用户手动标记的单词 - 用户排除的单词
   */
  const checkIsKnown = (word: string) => {
    const lower = word.toLowerCase();

    // 先检查是否在排除列表中
    if (excludedWords.has(lower)) return false;

    // 检查精确匹配
    if (knownWords.has(lower)) return true;

    // 检查复数形式
    if (lower.endsWith('s')) {
      const base = lower.slice(0, -1);
      if (excludedWords.has(base)) return false;
      if (knownWords.has(base)) return true;
    }
    if (lower.endsWith('es')) {
      const base = lower.slice(0, -2);
      if (excludedWords.has(base)) return false;
      if (knownWords.has(base)) return true;
    }
    if (lower.endsWith('ies')) {
      const base = lower.slice(0, -3) + 'y';
      if (excludedWords.has(base)) return false;
      if (knownWords.has(base)) return true;
    }

    // 检查过去式
    if (lower.endsWith('ed')) {
      let base = lower.slice(0, -1);
      if (excludedWords.has(base)) return false;
      if (knownWords.has(base)) return true;

      base = lower.slice(0, -2);
      if (excludedWords.has(base)) return false;
      if (knownWords.has(base)) return true;

      if (lower.endsWith('ied')) {
        base = lower.slice(0, -3) + 'y';
        if (excludedWords.has(base)) return false;
        if (knownWords.has(base)) return true;
      }
    }

    // 检查进行时
    if (lower.endsWith('ing')) {
      let base = lower.slice(0, -3);
      if (excludedWords.has(base)) return false;
      if (knownWords.has(base)) return true;

      base = lower.slice(0, -3) + 'e';
      if (excludedWords.has(base)) return false;
      if (knownWords.has(base)) return true;
    }

    return false;
  };

  /**
   * 检查单词是否在生词表中
   */
  const checkIsInNewWords = (word: string) => {
    const lower = word.toLowerCase();
    return newWords.some(w => w.word.toLowerCase() === lower);
  };

  return (
    <WordContext.Provider
      value={{
        isDictLoading,
        dictionarySize,
        setDictionarySize,
        currentVocabularyLevel: currentLevel,
        availableLevels,
        setVocabularyLevel,
        isLevelLoading,
        knownWords,
        markAsKnown,
        unmarkAsKnown,
        checkIsKnown,
        newWords,
        addNewWord,
        removeNewWord,
        clearNewWords,
        exportNewWords,
        checkIsInNewWords,
        markWordAsMastered,
        markWordAsDifficult,
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
