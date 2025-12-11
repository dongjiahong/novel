import { useState, useEffect, useCallback } from 'react';
import { NewWord } from '../types';
import { syncDirtyFlags, localNewWordsPageTimestamps } from '../services/syncService';
import { storageService } from '../services/storageService';

interface UseNewWordsListReturn {
  newWords: NewWord[];
  addNewWord: (word: NewWord) => void;
  removeNewWord: (word: string) => void;
  clearNewWords: () => void;
  exportNewWords: () => void;
  totalCount: number;
  markWordAsMastered: (word: string) => void;
  markWordAsDifficult: (word: string) => void;
  loadMore: () => void;
  hasMore: boolean;
}

const PAGE_SIZE = 50; // 每次加载 50 个生词用于显示

/**
 * Hook for managing new words list (生词表)
 * 使用 IndexedDB 存储，支持分页加载
 */
export const useNewWordsList = (): UseNewWordsListReturn => {
  const [newWords, setNewWords] = useState<NewWord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);

  /**
   * 从 IndexedDB 加载生词表（首次加载）
   */
  const loadInitialWords = useCallback(async () => {
    try {
      const words = await storageService.loadNewWords(0, PAGE_SIZE);
      const count = await storageService.getNewWordsCount();
      setNewWords(words);
      setTotalCount(count);
      setCurrentPage(1);
      console.log(`📖 已加载 ${words.length}/${count} 个生词`);
    } catch (err) {
      console.error('加载生词表失败:', err);
    }
  }, []);

  /**
   * 加载更多生词
   */
  const loadMore = useCallback(async () => {
    try {
      const offset = currentPage * PAGE_SIZE;
      const moreWords = await storageService.loadNewWords(offset, PAGE_SIZE);
      if (moreWords.length > 0) {
        setNewWords(prev => [...prev, ...moreWords]);
        setCurrentPage(prev => prev + 1);
        console.log(`📖 加载了更多 ${moreWords.length} 个生词`);
      }
    } catch (err) {
      console.error('加载更多生词失败:', err);
    }
  }, [currentPage]);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadInitialWords();
  }, [loadInitialWords]);

  /**
   * 监听同步更新事件
   */
  useEffect(() => {
    const handleSyncUpdate = () => {
      console.log('📢 收到生词表同步更新通知，重新加载数据');
      loadInitialWords();
    };

    window.addEventListener('sync-newwords-updated', handleSyncUpdate);
    return () => {
      window.removeEventListener('sync-newwords-updated', handleSyncUpdate);
    };
  }, [loadInitialWords]);

  /**
   * 添加新生词
   */
  const addNewWord = useCallback(async (word: NewWord) => {
    try {
      // 先查找是否存在
      const existingWords = await storageService.loadNewWords(0);
      const existing = existingWords.find(
        w => w.word.toLowerCase() === word.word.toLowerCase()
      );

      if (existing) {
        // 更新现有生词
        const updated: NewWord = {
          ...existing,
          reviewCount: existing.reviewCount + 1,
          lastReviewedAt: new Date().toISOString(),
          sentence: word.sentence || existing.sentence,
        };
        await storageService.saveNewWord(updated);
        console.log(`🔄 更新生词 "${word.word}"`);
      } else {
        // 添加新生词
        await storageService.saveNewWord(word);
        console.log(`➕ 添加生词 "${word.word}"`);
      }

      // 标记为脏数据，并更新第0页时间戳（新生词总是在第0页，按时间倒序）
      syncDirtyFlags.set('newWords');
      localNewWordsPageTimestamps.markPageUpdated(0);

      // 重新加载生词列表
      await loadInitialWords();
    } catch (err) {
      console.error('添加生词失败:', err);
    }
  }, [loadInitialWords]);

  /**
   * 删除生词
   */
  const removeNewWord = useCallback(async (word: string) => {
    try {
      await storageService.deleteNewWord(word);
      syncDirtyFlags.set('newWords');
      // 删除生词会影响分页，简单起见标记第0页
      localNewWordsPageTimestamps.markPageUpdated(0);
      await loadInitialWords();
      console.log(`🗑️ 删除生词 "${word}"`);
    } catch (err) {
      console.error('删除生词失败:', err);
    }
  }, [loadInitialWords]);

  /**
   * 清空生词表
   */
  const clearNewWords = useCallback(async () => {
    try {
      await storageService.clearNewWords();
      syncDirtyFlags.set('newWords');
      setNewWords([]);
      setTotalCount(0);
      setCurrentPage(0);
      console.log('🗑️ 已清空生词表');
    } catch (err) {
      console.error('清空生词表失败:', err);
    }
  }, []);

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
  const markWordAsMastered = useCallback(async (word: string) => {
    try {
      const existingWords = await storageService.loadNewWords(0);
      const existing = existingWords.find(
        w => w.word.toLowerCase() === word.toLowerCase()
      );

      if (existing) {
        const updated: NewWord = {
          ...existing,
          lastReviewedAt: new Date().toISOString(),
          masteredAt: new Date().toISOString(),
        };
        await storageService.saveNewWord(updated);
        syncDirtyFlags.set('newWords');
        localNewWordsPageTimestamps.markPageUpdated(0);
        await loadInitialWords();
        console.log(`✅ 标记生词 "${word}" 为已掌握`);
      }
    } catch (err) {
      console.error('标记生词为已掌握失败:', err);
    }
  }, [loadInitialWords]);

  /**
   * 标记单词为困难词
   * 设置 isMarkedDifficult = true, 更新 reviewCount
   */
  const markWordAsDifficult = useCallback(async (word: string) => {
    try {
      const existingWords = await storageService.loadNewWords(0);
      const existing = existingWords.find(
        w => w.word.toLowerCase() === word.toLowerCase()
      );

      if (existing) {
        const updated: NewWord = {
          ...existing,
          isMarkedDifficult: true,
          reviewCount: existing.reviewCount + 1,
          lastReviewedAt: new Date().toISOString(),
        };
        await storageService.saveNewWord(updated);
        syncDirtyFlags.set('newWords');
        localNewWordsPageTimestamps.markPageUpdated(0);
        await loadInitialWords();
        console.log(`⚠️ 标记生词 "${word}" 为困难词`);
      }
    } catch (err) {
      console.error('标记生词为困难词失败:', err);
    }
  }, [loadInitialWords]);

  const hasMore = newWords.length < totalCount;

  return {
    newWords,
    addNewWord,
    removeNewWord,
    clearNewWords,
    exportNewWords,
    totalCount,
    markWordAsMastered,
    markWordAsDifficult,
    loadMore,
    hasMore,
  };
};
