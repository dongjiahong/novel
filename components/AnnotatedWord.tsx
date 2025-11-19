import React, { useRef } from 'react';
import { useWordContext } from '../context/WordContext';
import { lookupWordInDict, normalizeWord } from '../services/dictionaryService';

interface AnnotatedWordProps {
  word: string;
  original: string; // The word with original punctuation
}

export const AnnotatedWord: React.FC<AnnotatedWordProps> = ({ word, original }) => {
  const { dictionary, checkIsKnown, setInteractingWord } = useWordContext();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Lookup logic
  const cleanWord = normalizeWord(word);
  const entry = lookupWordInDict(dictionary, cleanWord);
  const isKnown = checkIsKnown(cleanWord);
  
  const isWordChar = /[a-zA-Z]/.test(word);

  // Long Press Handlers
  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      if (entry) {
        setInteractingWord({ word: cleanWord, entry });
      }
    }, 600); // 600ms long press
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // 1. If it's just punctuation or not found in dictionary, render plain text
  if (!entry || !isWordChar) {
    return <span className="whitespace-pre-wrap">{original}</span>;
  }

  // 2. If word is marked as KNOWN, render plain text (interactive but no visual clutter)
  if (isKnown) {
    return (
      <span 
        className="cursor-text hover:bg-blue-50 rounded px-0.5 transition-colors select-text"
        title="已标记为认识 (长按查看详情)"
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
      >
        {original}
      </span>
    );
  }

  // 3. If UNKNOWN, render with annotation (Ruby-style)
  return (
    <span 
      className="inline-flex flex-col items-center justify-center align-middle mx-1 leading-tight group cursor-pointer relative top-2 select-none"
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
    >
      {/* Top: Translation */}
      <span className="text-[10px] text-blue-500/90 font-medium transform scale-90 whitespace-nowrap h-3 overflow-visible mb-0.5">
        {entry.translation?.split(/[,;]/)[0].substring(0, 12) || '...'}
      </span>
      
      {/* Middle: The Word */}
      <span className="text-gray-800 font-serif text-lg hover:text-blue-600 transition-colors border-b border-transparent hover:border-blue-200">
        {word}
      </span>

      {/* Bottom: Phonetic */}
      <span className="text-[10px] text-orange-400/90 font-light transform scale-90 h-3 mt-0.5">
        {entry.phonetic || ''}
      </span>
    </span>
  );
};