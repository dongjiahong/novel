import React from 'react';
import { useWordContext } from '../context/WordContext';
import { lookupWord, normalizeWord } from '../services/dictionaryService';

interface AnnotatedWordProps {
  word: string;
  original: string;
  shouldAnnotate?: boolean; // 控制是否应该标注（用于分批加载）
}

export const AnnotatedWord: React.FC<AnnotatedWordProps> = ({
  word,
  original,
  shouldAnnotate = true
}) => {
  const { checkIsKnown, setInteractingWord } = useWordContext();

  // 标准化单词并查询词典
  const cleanWord = normalizeWord(word);
  const entry = cleanWord ? lookupWord(cleanWord) : null;
  const isKnown = cleanWord ? checkIsKnown(cleanWord) : true;
  const isWordChar = /[a-zA-Z]/.test(word);

  // 点击处理：显示单词详情弹窗
  const handleClick = () => {
    if (entry && isWordChar) {
      setInteractingWord({ word: cleanWord, entry });
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
    return (
      <span
        className="cursor-pointer hover:bg-orange-50 rounded px-0.5 transition-colors"
        onClick={handleClick}
      >
        {original}
      </span>
    );
  }

  // 5. 生词：显示完整标注（悬浮样式）
  return (
    <span
      className="relative inline-block cursor-pointer group select-text"
      onClick={handleClick}
      title="点击查看详情"
    >
      {/* 悬浮注释 - 绝对定位在单词上方 */}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-0.5 flex flex-col items-center pointer-events-none z-10">
        {/* 中文翻译 */}
        <span className="text-[9px] text-orange-600 font-medium whitespace-nowrap leading-tight">
          {entry.translation?.split(/[,;]/)[0].substring(0, 12) || '...'}
        </span>
        {/* 音标 */}
        {entry.phonetic && (
          <span className="text-[8px] text-gray-400 font-light whitespace-nowrap leading-tight">
            {entry.phonetic}
          </span>
        )}
      </span>

      {/* 英文单词 - 生词用橙色文字 */}
      <span className="text-orange-600 font-serif text-lg hover:text-orange-700 transition-colors">
        {word}
      </span>
    </span>
  );
};
