import React, { useState, useEffect } from 'react';
import { useWordContext } from '../context/WordContext';
import { lookupWord, normalizeWord } from '../services/dictionaryService';
import { DictionaryEntry } from '../types';

interface AnnotatedWordProps {
  word: string;
  original: string;
  shouldAnnotate?: boolean; // 控制是否应该标注（用于分批加载）
  paragraph?: string; // 单词所在的段落，用于提取例句
}

export const AnnotatedWord: React.FC<AnnotatedWordProps> = ({
  word,
  original,
  shouldAnnotate = true,
  paragraph = ''
}) => {
  const { checkIsKnown, setInteractingWord, checkIsInNewWords } = useWordContext();
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  // 标准化单词
  const cleanWord = normalizeWord(word);
  const isKnown = cleanWord ? checkIsKnown(cleanWord) : true;
  const isInNewWords = cleanWord ? checkIsInNewWords(cleanWord) : false;
  const isWordChar = /[a-zA-Z]/.test(word);

  // 异步加载词典数据
  useEffect(() => {
    if (!cleanWord || !isWordChar) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    lookupWord(cleanWord).then(result => {
      if (!cancelled) {
        setEntry(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cleanWord, isWordChar]);

  // 从段落中提取包含该单词的句子
  const extractSentence = (para: string, targetWord: string): string => {
    if (!para || !targetWord) return '';

    // 按句子分割（简单处理：按 . ! ? 分割）
    const sentences = para.split(/([.!?]+\s+)/);
    let fullSentence = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      // 检查句子是否包含目标单词（忽略大小写）
      const wordRegex = new RegExp(`\\b${targetWord}\\b`, 'i');
      if (wordRegex.test(sentence)) {
        // 找到包含单词的句子，拼接完整句子（包括标点）
        fullSentence = sentence;
        if (i + 1 < sentences.length && /^[.!?]+\s*$/.test(sentences[i + 1])) {
          fullSentence += sentences[i + 1];
        }
        break;
      }
    }

    return fullSentence.trim();
  };


  // 点击处理：显示单词详情弹窗
  const handleClick = () => {
    if (entry && isWordChar) {
      const sentence = extractSentence(paragraph, cleanWord);
      setInteractingWord({ word: cleanWord, entry, sentence });
    }
  };

  // 1. 如果不是单词字符，直接渲染
  if (!isWordChar) {
    return <span className="whitespace-pre-wrap">{original}</span>;
  }

  // 2. 如果词典中没有这个单词，渲染为普通文本
  if (!entry) {
    return <span className="whitespace-pre-wrap">{original}</span>;
  }

  // 3. 如果是已认识的单词，渲染为普通文本（可点击查看详情）
  if (isKnown) {
    return (
      <span
        className="cursor-pointer hover:bg-blue-50 rounded px-0.5 transition-colors select-text"
        onClick={handleClick}
        title="点击查看详情"
      >
        {original}
      </span>
    );
  }

  // 4. 如果是生词但不应该标注（性能优化），渲染为普通文本
  if (!shouldAnnotate) {
    const hoverBgClass = isInNewWords ? 'hover:bg-purple-50' : 'hover:bg-orange-50';
    return (
      <span
        className={`cursor-pointer ${hoverBgClass} rounded px-0.5 transition-colors`}
        onClick={handleClick}
      >
        {original}
      </span>
    );
  }

  // 5. 生词：显示完整标注（悬浮样式）
  // 区分普通生词（橙色）和生词表中的生词（紫色）
  const annotationColor = isInNewWords ? 'purple' : 'orange';
  const textColorClass = isInNewWords ? 'text-purple-600' : 'text-orange-600';
  const hoverColorClass = isInNewWords ? 'hover:text-purple-700' : 'hover:text-orange-700';

  return (
    <span
      className="relative inline-block cursor-pointer group select-text"
      onClick={handleClick}
      title={isInNewWords ? "生词表 - 点击查看详情" : "点击查看详情"}
    >
      {/* 悬浮注释 - 绝对定位在单词上方 */}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-[-8px] flex flex-col items-center pointer-events-none z-10">
        {/* 中文翻译 */}
        <span className={`text-[9px] ${textColorClass} font-medium whitespace-nowrap leading-tight`}>
          {entry.translation?.split(/[,;]/)[0].substring(0, 12) || '...'}
        </span>
        {/* 音标 */}
        {entry.phonetic && (
          <span className="text-[8px] text-gray-400 font-light whitespace-nowrap leading-tight">
            {entry.phonetic}
          </span>
        )}
      </span>

      {/* 英文单词 - 生词用橙色，生词表中的用紫色 */}
      <span className={`${textColorClass} font-serif text-lg ${hoverColorClass} transition-colors`}>
        {word}
      </span>
    </span>
  );
};
