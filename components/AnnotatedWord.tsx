import React, { useState, useEffect, useMemo } from 'react';
import { useWordContext } from '../context/WordContext';
import { lookupWord, normalizeWord } from '../services/dictionaryService';
import { DictionaryEntry } from '../types';

interface AnnotatedWordProps {
  word: string;
  original: string;
  shouldAnnotate?: boolean; // 控制是否应该标注（用于分批加载）
  paragraph?: string; // 单词所在的段落，用于提取例句
}

// 公共样式常量
const INTERACTIVE_STYLE = {
  WebkitUserSelect: 'none' as const,
  WebkitTouchCallout: 'none' as const,
  touchAction: 'manipulation' as const,
};

// 从段落中提取包含该单词的句子
function extractSentence(para: string, targetWord: string): string {
  if (!para || !targetWord) return '';

  const sentences = para.split(/([.!?]+\s+)/);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const wordRegex = new RegExp(`\\b${targetWord}\\b`, 'i');
    if (wordRegex.test(sentence)) {
      const punctuation = (i + 1 < sentences.length && /^[.!?]+\s*$/.test(sentences[i + 1]))
        ? sentences[i + 1]
        : '';
      return (sentence + punctuation).trim();
    }
  }

  return '';
}

export const AnnotatedWord: React.FC<AnnotatedWordProps> = ({
  word,
  original,
  shouldAnnotate = true,
  paragraph = ''
}) => {
  const { checkIsKnown, setInteractingWord, checkIsInNewWords, dictionarySize } = useWordContext();
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // 标准化单词
  const cleanWord = normalizeWord(word);
  const isKnown = cleanWord ? checkIsKnown(cleanWord) : true;
  const isInNewWords = cleanWord ? checkIsInNewWords(cleanWord) : false;
  const isWordChar = /[a-zA-Z]/.test(word);

  // 异步加载词典数据
  useEffect(() => {
    if (!cleanWord || !isWordChar) {
      return;
    }

    let cancelled = false;
    const useLarge = dictionarySize === 'large';

    lookupWord(cleanWord, useLarge).then(result => {
      if (!cancelled) {
        setEntry(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cleanWord, isWordChar, dictionarySize]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // 长按事件处理器（合并公共逻辑）
  const pressHandlers = useMemo(() => {
    const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
      if (!entry || !isWordChar) return;
      e.stopPropagation();
      e.preventDefault();

      const timer = setTimeout(() => {
        const sentence = extractSentence(paragraph, cleanWord);
        setInteractingWord({ word: cleanWord, entry, sentence });
      }, 500);

      setLongPressTimer(timer);
    };

    const clearTimer = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };

    const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      clearTimer();
    };

    return {
      onMouseDown: handlePressStart,
      onMouseUp: handlePressEnd,
      onMouseLeave: handlePressEnd,
      onTouchStart: handlePressStart,
      onTouchMove: clearTimer,
      onTouchEnd: handlePressEnd,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
  }, [entry, isWordChar, paragraph, cleanWord, setInteractingWord, longPressTimer]);

  // 1. 如果不是单词字符，直接渲染
  if (!isWordChar) {
    return <span className="whitespace-pre-wrap">{original}</span>;
  }

  // 2. 如果词典中没有这个单词，渲染为普通文本
  if (!entry) {
    return <span className="whitespace-pre-wrap">{original}</span>;
  }

  // 3. 如果是已认识的单词，渲染为普通文本（可长按查看详情）
  if (isKnown) {
    return (
      <span
        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-0.5 transition-colors select-none"
        style={INTERACTIVE_STYLE}
        {...pressHandlers}
        title="长按查看详情"
      >
        {original}
      </span>
    );
  }

  // 4. 如果是生词但不应该标注（性能优化），渲染为普通文本
  if (!shouldAnnotate) {
    const hoverBgClass = isInNewWords
      ? 'hover:bg-primary-50 dark:hover:bg-primary-900/30'
      : 'hover:bg-orange-50 dark:hover:bg-orange-900/30';
    return (
      <span
        className={`cursor-pointer ${hoverBgClass} rounded px-0.5 transition-colors select-none`}
        style={INTERACTIVE_STYLE}
        {...pressHandlers}
      >
        {original}
      </span>
    );
  }

  // 5. 生词：显示完整标注（悬浮样式）
  const textColorClass = isInNewWords
    ? 'text-primary-600 dark:text-primary-400'
    : 'text-orange-600 dark:text-orange-400';
  const hoverColorClass = isInNewWords
    ? 'hover:text-primary-700 dark:hover:text-primary-300'
    : 'hover:text-orange-700 dark:hover:text-orange-300';

  return (
    <span
      className="relative inline-block cursor-pointer group select-none"
      style={INTERACTIVE_STYLE}
      {...pressHandlers}
      title={isInNewWords ? "生词表 - 长按查看详情" : "长按查看详情"}
    >
      {/* 中文翻译 - 绝对定位在单词上方 */}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-[-12px] flex flex-col items-center pointer-events-none z-10">
        <span className={`text-[10px] ${textColorClass} font-medium whitespace-nowrap leading-tight`}>
          {entry.translation?.split(/[,;]/).slice(0, 3).join(', ').substring(0, 24) || '...'}
        </span>
      </span>

      {/* 英文单词 - 生词用橙色，生词表中的用紫色 */}
      <span className={`${textColorClass} font-serif text-lg ${hoverColorClass} transition-colors`}>
        {word}
      </span>

      {/* 音标 - 绝对定位在单词下方 */}
      {entry.phonetic && (
        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-[-34px] pointer-events-none z-10">
          <span className={`text-[10px] ${textColorClass} font-light whitespace-nowrap leading-tight`}>
            {entry.phonetic}
          </span>
        </span>
      )}
    </span>
  );
};
