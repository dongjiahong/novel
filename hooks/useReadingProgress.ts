import { useState, useEffect, useCallback } from 'react';
import { ReadingProgress } from '../types';

const STORAGE_KEY = 'reading_progress';

/**
 * 阅读进度管理 Hook
 * 用于保存和恢复用户的阅读进度（章节+段落位置）
 */
export function useReadingProgress() {
  const [progressList, setProgressList] = useState<ReadingProgress[]>([]);

  // 从 localStorage 加载进度
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored !== 'undefined' && stored !== 'null') {
        setProgressList(JSON.parse(stored));
      }
    } catch (error) {
      console.error('加载阅读进度失败:', error);
      // 清除无效数据
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * 保存阅读进度
   */
  const saveProgress = useCallback(
    (
      bookId: string,
      bookTitle: string,
      chapterIndex: number,
      chapterTitle: string,
      paragraphIndex: number = 0
    ) => {
      const newProgress: ReadingProgress = {
        bookId,
        bookTitle,
        chapterIndex,
        chapterTitle,
        paragraphIndex,
        updatedAt: new Date().toISOString(),
      };

      setProgressList(prev => {
        // 如果该书籍已有进度记录，则更新；否则添加新记录
        const existingIndex = prev.findIndex(p => p.bookId === bookId);
        let updated: ReadingProgress[];

        if (existingIndex >= 0) {
          updated = [...prev];
          updated[existingIndex] = newProgress;
        } else {
          updated = [...prev, newProgress];
        }

        // 保存到 localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.error('保存阅读进度失败:', error);
        }

        return updated;
      });

      return newProgress;
    },
    []
  );

  /**
   * 获取特定书籍的阅读进度
   */
  const getProgress = useCallback(
    (bookId: string): ReadingProgress | null => {
      return progressList.find(p => p.bookId === bookId) || null;
    },
    [progressList]
  );

  /**
   * 删除特定书籍的阅读进度
   */
  const removeProgress = useCallback((bookId: string) => {
    setProgressList(prev => {
      const updated = prev.filter(p => p.bookId !== bookId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('删除阅读进度失败:', error);
      }
      return updated;
    });
  }, []);

  /**
   * 清空所有阅读进度
   */
  const clearAllProgress = useCallback(() => {
    setProgressList([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * 批量更新进度列表（用于同步）
   */
  const setProgressBatch = useCallback((newProgressList: ReadingProgress[]) => {
    setProgressList(newProgressList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgressList));
    } catch (error) {
      console.error('批量更新阅读进度失败:', error);
    }
  }, []);

  return {
    progressList,
    saveProgress,
    getProgress,
    removeProgress,
    clearAllProgress,
    setProgressBatch,
  };
}
