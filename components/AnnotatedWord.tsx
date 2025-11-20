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

  // 5. 生词：显示完整标注（Ruby样式）
  return (
    <span
      className="inline-flex flex-col items-center justify-center align-middle mx-1 leading-tight group cursor-pointer relative top-2 select-none"
      onClick={handleClick}
      title="点击查看详情"
    >
      {/* 上方：中文翻译 - 使用橙色突出显示生词 */}
      <span className="text-[10px] text-orange-600 font-medium transform scale-90 whitespace-nowrap h-3 overflow-visible mb-0.5">
        {entry.translation?.split(/[,;]/)[0].substring(0, 15) || '...'}
      </span>

      {/* 中间：英文单词 - 生词用橙色边框 */}
      <span className="text-gray-800 font-serif text-lg hover:text-orange-600 transition-colors border-b-2 border-orange-300 hover:border-orange-500">
        {word}
      </span>

      {/* 下方：音标 - 使用灰色 */}
      <span className="text-[10px] text-gray-400 font-light transform scale-90 h-3 mt-0.5">
        {entry.phonetic || ''}
      </span>
    </span>
  );
};
