import { useState, useEffect, useCallback } from 'react';
import { NewWord } from '../types';

interface UseNewWordsListReturn {
  newWords: NewWord[];
  addNewWord: (word: NewWord) => void;
  removeNewWord: (word: string, bookId: string) => void;
  getNewWordsByBook: (bookId: string) => NewWord[];
  clearNewWords: (bookId?: string) => void;
  exportNewWords: (bookId?: string) => void;
  totalCount: number;
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
      if (stored) {
        const parsed = JSON.parse(stored);
        setNewWords(parsed);
        console.log(`📖 已加载 ${parsed.length} 个生词`);
      }
    } catch (err) {
      console.error('Failed to load new words list:', err);
    }
  }, []);

  /**
   * 保存生词表到 localStorage
   */
  const saveToStorage = useCallback((words: NewWord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    } catch (err) {
      console.error('Failed to save new words list:', err);
    }
  }, []);

  /**
   * 添加新生词
   */
  const addNewWord = useCallback((word: NewWord) => {
    setNewWords(prev => {
      // 检查是否已存在（同一本书中的同一个单词）
      const exists = prev.some(
        w => w.word.toLowerCase() === word.word.toLowerCase() && w.bookId === word.bookId
      );

      if (exists) {
        // 更新复习次数
        const updated = prev.map(w => {
          if (w.word.toLowerCase() === word.word.toLowerCase() && w.bookId === word.bookId) {
            return {
              ...w,
              reviewCount: w.reviewCount + 1,
              lastReviewedAt: new Date().toISOString()
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
        return updated;
      }
    });
  }, [saveToStorage]);

  /**
   * 删除生词
   */
  const removeNewWord = useCallback((word: string, bookId: string) => {
    setNewWords(prev => {
      const updated = prev.filter(
        w => !(w.word.toLowerCase() === word.toLowerCase() && w.bookId === bookId)
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  /**
   * 获取特定书籍的生词
   */
  const getNewWordsByBook = useCallback((bookId: string): NewWord[] => {
    return newWords.filter(w => w.bookId === bookId);
  }, [newWords]);

  /**
   * 清空生词表
   */
  const clearNewWords = useCallback((bookId?: string) => {
    setNewWords(prev => {
      const updated = bookId
        ? prev.filter(w => w.bookId !== bookId)
        : [];
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  /**
   * 导出生词表为文本文件
   */
  const exportNewWords = useCallback((bookId?: string) => {
    const wordsToExport = bookId
      ? newWords.filter(w => w.bookId === bookId)
      : newWords;

    if (wordsToExport.length === 0) {
      alert('没有可导出的生词');
      return;
    }

    // 按书籍分组
    const groupedByBook: { [bookTitle: string]: NewWord[] } = {};
    wordsToExport.forEach(word => {
      if (!groupedByBook[word.bookTitle]) {
        groupedByBook[word.bookTitle] = [];
      }
      groupedByBook[word.bookTitle].push(word);
    });

    // 生成文本内容
    let content = '# 生词表\n\n';
    content += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `总计: ${wordsToExport.length} 个生词\n\n`;

    Object.entries(groupedByBook).forEach(([bookTitle, words]) => {
      content += `## ${bookTitle} (${words.length} 个生词)\n\n`;
      words.forEach((word, index) => {
        content += `${index + 1}. ${word.word}`;
        if (word.phonetic) content += ` [${word.phonetic}]`;
        if (word.translation) content += ` - ${word.translation}`;
        content += `\n`;
      });
      content += '\n';
    });

    // 创建下载链接
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = bookId
      ? `${groupedByBook[Object.keys(groupedByBook)[0]][0].bookTitle}-生词表.txt`
      : `生词表-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ 已导出 ${wordsToExport.length} 个生词`);
  }, [newWords]);

  return {
    newWords,
    addNewWord,
    removeNewWord,
    getNewWordsByBook,
    clearNewWords,
    exportNewWords,
    totalCount: newWords.length
  };
};
