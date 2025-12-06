import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useWordContext } from '../context/WordContext';
import { X, Volume2, Eye, EyeOff, BookOpen, CheckCircle2, AlertCircle, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';
import { NewWord } from '../types';

interface VocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VocabularyModal: React.FC<VocabularyModalProps> = ({ isOpen, onClose }) => {
  const { newWords, markWordAsMastered, markWordAsDifficult } = useWordContext();
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [expandedSentences, setExpandedSentences] = useState<Set<string>>(new Set());
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
  const playPronunciation = (e: React.MouseEvent, word: string, type: 'uk' | 'us') => {
    e.stopPropagation(); // 防止触发卡片点击
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

  // 切换例句展开
  const toggleSentence = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    setExpandedSentences(prev => {
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
      // 这里可以加一个震动反馈如果设备支持 navigator.vibrate
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  // 处理长按结束
  const handlePressEnd = (word: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // 如果没有达到长按时间,就是点击 - 标记为困难
    // 注意：这里只有在点击右侧操作按钮时才会触发，卡片主体点击是切换翻译
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 flex justify-between items-center z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
              <BookOpen size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">生词本</h2>
              <div className="flex gap-2 sm:gap-3 mt-1">
                <span className="text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  总计 {newWords.length}
                </span>
                <span className="text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                  待复习 {unstudiedCount}
                </span>
                <span className="text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  已掌握 {masteredCount}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-gray-50/50 dark:bg-black/20">
          {wordsToStudy.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 sm:py-20 text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center mb-4 sm:mb-6">
                <BrainCircuit className="text-gray-300 dark:text-gray-600 w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">暂无生词需要学习</h3>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-xs">
                太棒了！你已经完成了所有生词的学习，快去阅读新的文章积累更多词汇吧。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {wordsToStudy.map((wordData, index) => (
                <WordCard
                  key={wordData.word}
                  wordData={wordData}
                  isRevealed={revealedWords.has(wordData.word)}
                  isSentenceExpanded={expandedSentences.has(wordData.word)}
                  isPressing={pressingWord === wordData.word}
                  onToggleTranslation={() => toggleTranslation(wordData.word)}
                  onToggleSentence={(e) => toggleSentence(e, wordData.word)}
                  onPlayPronunciation={playPronunciation}
                  onPressStart={() => handlePressStart(wordData.word)}
                  onPressEnd={() => handlePressEnd(wordData.word)}
                  index={index}
                />
              ))}
            </div>
          )}

          {/* 加载更多提示 */}
          {wordsToStudy.length >= displayCount && wordsToStudy.length < sortedWords.filter(w => !w.masteredAt).length && (
            <div className="text-center py-6 sm:py-8">
              <button
                onClick={() => setDisplayCount(prev => prev + 20)}
                className="px-5 py-2 sm:px-6 sm:py-2.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium rounded-full border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 hover:text-orange-600 dark:hover:text-orange-400 transition-all shadow-sm"
              >
                加载更多生词
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white dark:bg-gray-900 px-4 py-2.5 sm:px-6 sm:py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
              点击卡片显示释义
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              点击圆圈标记困难
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              长按圆圈标记掌握
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 单词卡片组件
interface WordCardProps {
  wordData: NewWord;
  isRevealed: boolean;
  isSentenceExpanded: boolean;
  isPressing: boolean;
  onToggleTranslation: () => void;
  onToggleSentence: (e: React.MouseEvent) => void;
  onPlayPronunciation: (e: React.MouseEvent, word: string, type: 'uk' | 'us') => void;
  onPressStart: () => void;
  onPressEnd: () => void;
  index: number;
}

const WordCard: React.FC<WordCardProps> = ({
  wordData,
  isRevealed,
  isSentenceExpanded,
  isPressing,
  onToggleTranslation,
  onToggleSentence,
  onPlayPronunciation,
  onPressStart,
  onPressEnd,
  index
}) => {
  // Staggered animation delay style
  const style = {
    animationDelay: `${index * 50}ms`
  };

  return (
    <div
      className={`
        group relative bg-white dark:bg-gray-800 rounded-xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2
        ${isPressing ? 'scale-[0.98] ring-2 ring-green-500/50 border-green-500/50' : 'hover:shadow-lg hover:-translate-y-0.5'}
        ${wordData.isMarkedDifficult
          ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-gray-700'
        }
      `}
      style={style}
      onClick={onToggleTranslation}
    >
      <div className="p-3 sm:p-5 flex gap-3 sm:gap-4">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-x-2 sm:gap-x-3 mb-1"> {/* flex-wrap to handle overflow on small screens */}
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {wordData.word}
            </h3>
            {wordData.phonetic && (
              <div className="flex items-center gap-1 sm:gap-2"> {/* This div contains phonetic and pronunciation buttons */}
                <span className="text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400">
                  {wordData.phonetic}
                </span>
                <button
                  onClick={(e) => onPlayPronunciation(e, wordData.word, 'uk')}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                  title="英式发音"
                >
                  <span className="text-[8px] font-bold">UK</span>
                </button>
                <button
                  onClick={(e) => onPlayPronunciation(e, wordData.word, 'us')}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                  title="美式发音"
                >
                  <span className="text-[8px] font-bold">US</span>
                </button>
              </div>
            )}
          </div>

          {/* Difficulty Badge */}
          {wordData.isMarkedDifficult && (
            <div className="mb-2 sm:mb-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <AlertCircle size={10} />
              困难词汇
            </div>
          )}

          {/* Hidden/Revealed Content */}
          <div className="relative mt-1 sm:mt-2 min-h-[2.5rem] sm:min-h-[3rem]">
            {/* Translation */}
            {/* Translation & Click to reveal hint */}
            <div className="min-h-[1.5rem] sm:min-h-[1.75rem] flex items-center">
              {isRevealed ? (
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium animate-in fade-in duration-200">
                  {wordData.translation || '暂无翻译'}
                </p>
              ) : (
                <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 font-medium animate-in fade-in duration-200">
                  <EyeOff size={12} className="sm:w-[14px] sm:h-[14px]" />
                  <span className="text-[10px] sm:text-xs">点击显示释义</span>
                </div>
              )}
            </div>


            {/* Sentence Section (Only shown if revealed and has sentence) */}
            {wordData.sentence && (<div className="mt-2">
              {isSentenceExpanded ? (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic leading-relaxed border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                      {wordData.sentence}
                    </div>
                    <button
                      onClick={onToggleSentence}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50"
                      title="收起例句"
                    >
                      <ChevronUp size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onToggleSentence}
                  className="flex items-center gap-1 text-[10px] sm:text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium py-1"
                >
                  <ChevronDown size={12} className="sm:w-[14px] sm:h-[14px]" />
                  展开例句
                </button>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Right Action Column */}

        <div className="flex flex-col items-center justify-center gap-2 border-l border-gray-100 dark:border-gray-700 pl-3 sm:pl-4 py-1">

          {/* Mastery Button */}

          <div> {/* Removed mt-auto */}

            <button

              onMouseDown={(e) => { e.stopPropagation(); onPressStart(); }}

              onMouseUp={(e) => { e.stopPropagation(); onPressEnd(); }}

              onMouseLeave={(e) => { e.stopPropagation(); onPressEnd(); }}

              onTouchStart={(e) => { e.stopPropagation(); onPressStart(); }}

              onTouchEnd={(e) => { e.stopPropagation(); onPressEnd(); }}

              className={`

                        relative w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-200

                        ${isPressing

                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 scale-110'

                  : 'border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:border-green-400 hover:text-green-400'

                }

                      `}

            >

              <CheckCircle2 size={16} className={`sm:w-5 sm:h-5 transition-all ${isPressing ? 'text-green-500' : 'currentColor'}`} />



              {/* Progress Ring Animation (CSS only for simplicity) */}

              {isPressing && (

                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none overflow-visible">

                  <circle

                    cx="50%"

                    cy="50%"

                    r="46%"

                    fill="none"

                    stroke="currentColor"

                    strokeWidth="2"

                    className="text-green-500"

                    strokeDasharray="100"

                    strokeDashoffset="0"

                    style={{

                      animation: 'dash 0.5s linear forwards'

                    }}

                  />

                </svg>

              )}

            </button>

          </div>

        </div>
      </div>

      {/* Inline CSS for the circle animation */}
      <style>{`
        @keyframes dash {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};
