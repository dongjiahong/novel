import { useState, useEffect, useCallback } from 'react';
import { VocabularyLevel } from '../types';
import { VOCABULARY_LEVELS, DEFAULT_VOCABULARY_LEVEL } from '../constants';

interface UseVocabularyLevelReturn {
  currentLevel: VocabularyLevel | null;
  knownWordsFromLevel: Set<string>;
  isLoading: boolean;
  error: string | null;
  setLevel: (levelId: string) => void;
  availableLevels: VocabularyLevel[];
}

/**
 * Hook for managing vocabulary level and loading word lists
 */
export const useVocabularyLevel = (): UseVocabularyLevelReturn => {
  const [currentLevel, setCurrentLevel] = useState<VocabularyLevel | null>(null);
  const [knownWordsFromLevel, setKnownWordsFromLevel] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 从文本文件加载单词列表
   */
  const loadWordList = useCallback(async (fileName: string): Promise<Set<string>> => {
    try {
      const response = await fetch(`/wordlists/${fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
      }

      const text = await response.text();

      // 解析文本文件：每行一个单词
      const words = text
        .split('\n')
        .map(line => line.trim().toLowerCase())
        .filter(word => word.length > 0);

      return new Set(words);
    } catch (err) {
      console.error(`Error loading word list ${fileName}:`, err);
      throw err;
    }
  }, []);

  /**
   * 切换词汇等级
   */
  const setLevel = useCallback(async (levelId: string) => {
    const level = VOCABULARY_LEVELS.find(l => l.id === levelId);
    if (!level) {
      console.error(`Vocabulary level ${levelId} not found`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const words = await loadWordList(level.fileName);
      setKnownWordsFromLevel(words);
      setCurrentLevel(level);

      // 保存选择到 localStorage
      localStorage.setItem('selected_vocabulary_level', levelId);

      console.log(`✅ 已加载词汇等级: ${level.name} (${words.size} 个单词)`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to load vocabulary level:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadWordList]);

  /**
   * 初始化：从 localStorage 恢复上次选择的等级，或使用默认等级
   */
  useEffect(() => {
    const initializeLevel = async () => {
      const savedLevelId = localStorage.getItem('selected_vocabulary_level');
      const levelId = savedLevelId || DEFAULT_VOCABULARY_LEVEL;
      await setLevel(levelId);
    };

    initializeLevel();
  }, [setLevel]);

  return {
    currentLevel,
    knownWordsFromLevel,
    isLoading,
    error,
    setLevel,
    availableLevels: VOCABULARY_LEVELS
  };
};
