import { useState, useEffect, useCallback } from 'react';
import { NewWord } from '../types';
import { syncDirtyFlags } from '../services/syncService';

interface UseNewWordsListReturn {
  newWords: NewWord[];
  addNewWord: (word: NewWord) => void;
  removeNewWord: (word: string) => void;
  clearNewWords: () => void;
  exportNewWords: () => void;
  totalCount: number;
  markWordAsMastered: (word: string) => void;
  markWordAsDifficult: (word: string) => void;
}

const STORAGE_KEY = 'new_words_list';

/**
 * Hook for managing new words list (生词表)
 */
export const useNewWordsList = (): UseNewWordsListReturn => {
  const [newWords, setNewWords] = useState<NewWord[]>([]);

  /**
   * 从 localStorage 加载生词表
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored !== 'undefined' && stored !== 'null') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setNewWords(parsed);
          console.log(`📖 已加载 ${parsed.length} 个生词`);
        }
      }
    } catch (err) {
      console.error('Failed to load new words list:', err);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * 保存生词表到 localStorage
   */
  const saveToStorage = useCallback((words: NewWord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      // 标记生词表为脏数据
      syncDirtyFlags.set('newWords');
    } catch (err) {
      console.error('Failed to save new words list:', err);
    }
  }, []);

  /**
   * 添加新生词
   */
  const addNewWord = useCallback((word: NewWord) => {
    setNewWords(prev => {
      // 检查是否已存在（同一个单词）
      const exists = prev.some(
        w => w.word.toLowerCase() === word.word.toLowerCase()
      );

      if (exists) {
        // 更新复习次数和例句
        const updated = prev.map(w => {
          if (w.word.toLowerCase() === word.word.toLowerCase()) {
            return {
              ...w,
              reviewCount: w.reviewCount + 1,
              lastReviewedAt: new Date().toISOString(),
              // 如果有新的例句，更新例句
              sentence: word.sentence || w.sentence
            };
          }
          return w;
        });
        saveToStorage(updated);
        return updated;
      } else {
        // 添加新生词
        const updated = [...prev, word];
        saveToStorage(updated);
        console.log(`➕ 添加生词 "${word.word}"`);
        return updated;
      }
    });
  }, [saveToStorage]);

  /**
   * 删除生词
   */
  const removeNewWord = useCallback((word: string) => {
    setNewWords(prev => {
      const updated = prev.filter(
        w => w.word.toLowerCase() !== word.toLowerCase()
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  /**
   * 清空生词表
   */
  const clearNewWords = useCallback(() => {
    setNewWords([]);
    saveToStorage([]);
  }, [saveToStorage]);

  /**
   * 导出生词表为文本文件
   */
  const exportNewWords = useCallback(() => {
    if (newWords.length === 0) {
      alert('没有可导出的生词');
      return;
    }

    // 生成文本内容
    let content = '# 生词表\n\n';
    content += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `总计: ${newWords.length} 个生词\n\n`;

    newWords.forEach((word, index) => {
      content += `${index + 1}. ${word.word}`;
      if (word.phonetic) content += ` [${word.phonetic}]`;
      if (word.translation) content += ` - ${word.translation}`;
      content += `\n`;
      if (word.sentence) {
        content += `   例句: ${word.sentence}\n`;
      }
      content += `\n`;
    });

    // 创建下载链接
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `生词表-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ 已导出 ${newWords.length} 个生词`);
  }, [newWords]);

  /**
   * 标记单词为已掌握
   * 更新 lastReviewedAt 和 masteredAt 时间戳
   */
  const markWordAsMastered = useCallback((word: string) => {
    setNewWords(prev => {
      const updated = prev.map(w => {
        if (w.word.toLowerCase() === word.toLowerCase()) {
          return {
            ...w,
            lastReviewedAt: new Date().toISOString(),
            masteredAt: new Date().toISOString()
          };
        }
        return w;
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  /**
   * 标记单词为困难词
   * 设置 isMarkedDifficult = true, 更新 reviewCount
   */
  const markWordAsDifficult = useCallback((word: string) => {
    setNewWords(prev => {
      const updated = prev.map(w => {
        if (w.word.toLowerCase() === word.toLowerCase()) {
          return {
            ...w,
            isMarkedDifficult: true,
            reviewCount: w.reviewCount + 1,
            lastReviewedAt: new Date().toISOString()
          };
        }
        return w;
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  return {
    newWords,
    addNewWord,
    removeNewWord,
    clearNewWords,
    exportNewWords,
    totalCount: newWords.length,
    markWordAsMastered,
    markWordAsDifficult
  };
};
