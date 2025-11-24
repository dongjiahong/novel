import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useWordContext } from '../context/WordContext';
import { X, Volume2, Eye, EyeOff } from 'lucide-react';
import { NewWord } from '../types';

interface VocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VocabularyModal: React.FC<VocabularyModalProps> = ({ isOpen, onClose }) => {
  const { newWords, markWordAsMastered, markWordAsDifficult } = useWordContext();
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(20);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [pressingWord, setPressingWord] = useState<string | null>(null);

  // 排序生词列表: 困难词 > 未学习词 > 已掌握词
  const sortedWords = useMemo(() => {
    return [...newWords].sort((a, b) => {
      // 困难词优先
      if (a.isMarkedDifficult && !b.isMarkedDifficult) return -1;
      if (!a.isMarkedDifficult && b.isMarkedDifficult) return 1;

      // 已掌握的排后面
      const aMastered = !!a.masteredAt;
      const bMastered = !!b.masteredAt;
      if (!aMastered && bMastered) return -1;
      if (aMastered && !bMastered) return 1;

      // 同优先级内,按最后复习时间倒排(最新的在前)
      const aTime = a.lastReviewedAt || a.firstSeenAt;
      const bTime = b.lastReviewedAt || b.firstSeenAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [newWords]);

  // 待学习的单词(前20个未掌握的)
  const wordsToStudy = useMemo(() => {
    return sortedWords.filter(w => !w.masteredAt).slice(0, displayCount);
  }, [sortedWords, displayCount]);

  // 未学习数量
  const unstudiedCount = useMemo(() => {
    return newWords.filter(w => !w.lastReviewedAt).length;
  }, [newWords]);

  // 已掌握数量
  const masteredCount = useMemo(() => {
    return newWords.filter(w => !!w.masteredAt).length;
  }, [newWords]);

  // 播放发音
  const playPronunciation = (word: string, type: 'uk' | 'us') => {
    const audioType = type === 'uk' ? 1 : 0;
    const audio = new Audio(`https://dict.youdao.com/dictvoice?type=${audioType}&audio=${word}`);
    audio.play().catch(err => {
      console.error('发音播放失败:', err);
    });
  };

  // 切换翻译显示
  const toggleTranslation = (word: string) => {
    setRevealedWords(prev => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  };

  // 处理长按开始
  const handlePressStart = (word: string) => {
    setPressingWord(word);
    longPressTimer.current = setTimeout(() => {
      // 长按500ms - 标记为已掌握
      markWordAsMastered(word);
      setPressingWord(null);
    }, 500);
  };

  // 处理长按结束
  const handlePressEnd = (word: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // 如果没有达到长按时间,就是点击 - 标记为困难
    if (pressingWord === word) {
      markWordAsDifficult(word);
    }
    setPressingWord(null);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 px-6 py-4 border-b border-orange-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100">生词本</h2>
            <div className="flex gap-4 mt-2 text-sm text-orange-700 dark:text-orange-300">
              <span>总计: {newWords.length}</span>
              <span>未学习: {unstudiedCount}</span>
              <span>已掌握: {masteredCount}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-orange-400 dark:text-orange-300 hover:text-orange-600 dark:hover:text-orange-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {wordsToStudy.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg">暂无生词需要学习</p>
              <p className="text-sm mt-2">开始阅读吧!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wordsToStudy.map((wordData) => (
                <WordCard
                  key={wordData.word}
                  wordData={wordData}
                  isRevealed={revealedWords.has(wordData.word)}
                  isPressing={pressingWord === wordData.word}
                  onToggleTranslation={() => toggleTranslation(wordData.word)}
                  onPlayPronunciation={(type) => playPronunciation(wordData.word, type)}
                  onPressStart={() => handlePressStart(wordData.word)}
                  onPressEnd={() => handlePressEnd(wordData.word)}
                />
              ))}
            </div>
          )}

          {/* 加载更多提示 */}
          {wordsToStudy.length >= displayCount && wordsToStudy.length < sortedWords.filter(w => !w.masteredAt).length && (
            <div className="text-center py-4">
              <button
                onClick={() => setDisplayCount(prev => prev + 20)}
                className="px-6 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors"
              >
                加载更多
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
          <p>💡 提示: 点击圆圈标记为困难词,长按(500ms)标记为已掌握</p>
        </div>
      </div>
    </div>
  );
};

// 单词卡片组件
interface WordCardProps {
  wordData: NewWord;
  isRevealed: boolean;
  isPressing: boolean;
  onToggleTranslation: () => void;
  onPlayPronunciation: (type: 'uk' | 'us') => void;
  onPressStart: () => void;
  onPressEnd: () => void;
}

const WordCard: React.FC<WordCardProps> = ({
  wordData,
  isRevealed,
  isPressing,
  onToggleTranslation,
  onPlayPronunciation,
  onPressStart,
  onPressEnd
}) => {
  return (
    <div className={`
      bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border
      ${wordData.isMarkedDifficult
        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20'
        : 'border-gray-200 dark:border-gray-700'
      }
      hover:shadow-md transition-all
    `}>
      <div className="flex items-start gap-3">
        {/* 左侧: 单词 + 音标 + 发音 */}
        <div className="flex-shrink-0 min-w-[140px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {wordData.word}
            </h3>
            {wordData.isMarkedDifficult && (
              <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                困难
              </span>
            )}
          </div>
          {wordData.phonetic && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
              {wordData.phonetic}
            </p>
          )}
          {/* 发音按钮 */}
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => onPlayPronunciation('uk')}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800/50 hover:bg-blue-200 dark:hover:bg-blue-700/50 transition-all"
              title="播放英音"
            >
              <Volume2 size={12} className="text-blue-600 dark:text-blue-300" />
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-300">UK</span>
            </button>
            <button
              onClick={() => onPlayPronunciation('us')}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-800/50 hover:bg-purple-200 dark:hover:bg-purple-700/50 transition-all"
              title="播放美音"
            >
              <Volume2 size={12} className="text-purple-600 dark:text-purple-300" />
              <span className="text-[10px] font-medium text-purple-600 dark:text-purple-300">US</span>
            </button>
          </div>
        </div>

        {/* 中间: 翻译 + 例句 */}
        <div className="flex-1 min-w-0">
          {/* 翻译 */}
          <button
            onClick={onToggleTranslation}
            className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {isRevealed ? (
                <Eye size={14} className="text-gray-400 flex-shrink-0" />
              ) : (
                <EyeOff size={14} className="text-gray-400 flex-shrink-0" />
              )}
              <p className={`
                text-xs text-gray-700 dark:text-gray-300
                ${!isRevealed ? 'filter blur-sm select-none' : ''}
              `}>
                {wordData.translation || '暂无翻译'}
              </p>
            </div>
          </button>

          {/* 例句 - PC端在翻译下面 */}
          {wordData.sentence && (
            <div className="mt-1.5 px-2 hidden md:block">
              <p className="text-[11px] text-gray-600 dark:text-gray-400 italic leading-relaxed line-clamp-2">
                {wordData.sentence}
              </p>
            </div>
          )}
        </div>

        {/* 右侧: 操作按钮 */}
        <div className="flex-shrink-0">
          <button
            onMouseDown={onPressStart}
            onMouseUp={onPressEnd}
            onMouseLeave={onPressEnd}
            onTouchStart={onPressStart}
            onTouchEnd={onPressEnd}
            className={`
              w-8 h-8 rounded-full border-2 transition-all
              ${isPressing
                ? 'border-green-500 bg-green-100 dark:bg-green-900/40 scale-90'
                : 'border-orange-400 dark:border-orange-600 hover:border-orange-500 dark:hover:border-orange-500 hover:scale-110'
              }
              active:scale-95
            `}
            title="点击=困难 | 长按=已掌握"
          />
        </div>
      </div>

      {/* 例句区域 - 移动端独立显示 */}
      {wordData.sentence && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 md:hidden">
          <p className="text-[11px] text-gray-600 dark:text-gray-400 italic leading-relaxed">
            {wordData.sentence}
          </p>
        </div>
      )}
    </div>
  );
};
