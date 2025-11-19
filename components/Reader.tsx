import React from 'react';
import { Chapter } from '../types';
import { AnnotatedWord } from './AnnotatedWord';

interface ReaderProps {
  chapter: Chapter;
}

const Reader: React.FC<ReaderProps> = ({ chapter }) => {
  
  // Complex regex to split text but keep delimiters (spaces, punctuation)
  // Groups: 1=Word, 2=Space/Punctuation
  const processText = (text: string) => {
    return text.split('\n').map((paragraph, pIndex) => {
      if (!paragraph.trim()) return <div key={pIndex} className="h-6" />; // Empty line

      // Header detection (Simple markdown-ish)
      if (paragraph.trim().startsWith('# ')) {
        return <h1 key={pIndex} className="text-2xl font-bold text-gray-800 mb-6 mt-4">{paragraph.replace('# ', '')}</h1>;
      }
      if (paragraph.trim().startsWith('**')) {
         return <h2 key={pIndex} className="text-lg font-bold text-gray-700 mb-4 mt-4">{paragraph.replace(/\*\*/g, '')}</h2>;
      }

      // Split by words, keeping separators. 
      // This regex looks for sequences of letters/apostrophes OR non-letters.
      const tokens = paragraph.split(/([a-zA-Z’'-]+)/g);

      return (
        <p key={pIndex} className="mb-8 leading-[3rem] text-lg text-gray-700 font-serif text-justify">
          {tokens.map((token, tIndex) => {
             if (!token) return null;
             // Check if it's a word (basic check)
             if (/[a-zA-Z]/.test(token)) {
                 return <AnnotatedWord key={tIndex} word={token} original={token} />;
             }
             // Punctuation/Spaces
             return <span key={tIndex}>{token}</span>;
          })}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-white relative">
      {/* Top Tab Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-2 flex items-center shadow-sm">
        <span className="text-sm text-gray-500 flex items-center gap-2">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
           {chapter.title}
        </span>
        <button className="ml-auto text-gray-400 hover:text-gray-600">
            <span className="text-xl">×</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="max-w-3xl mx-auto px-8 py-12 pb-32">
        {processText(chapter.content)}
      </div>
    </div>
  );
};

export default Reader;