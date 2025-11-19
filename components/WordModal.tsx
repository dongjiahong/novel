import React from 'react';
import { useWordContext } from '../context/WordContext';
import { X, Check, BookOpen } from 'lucide-react';

export const WordModal: React.FC = () => {
  const { interactingWord, setInteractingWord, markAsKnown } = useWordContext();

  if (!interactingWord) return null;

  const { word, entry } = interactingWord;

  const handleKnown = () => {
    markAsKnown(word);
    setInteractingWord(null);
  };

  const handleClose = () => {
    setInteractingWord(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-serif font-bold text-blue-900">{word}</h3>
            <p className="text-sm text-blue-600 mt-1 font-mono">{entry.phonetic}</p>
          </div>
          <button onClick={handleClose} className="text-blue-300 hover:text-blue-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="mb-6">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">释义 / Definition</span>
            <p className="text-gray-800 text-lg mt-1 leading-relaxed">
              {entry.translation || entry.definition || "暂无解释"}
            </p>
          </div>

          <p className="text-sm text-gray-500 mb-6 text-center">
            是否标记为“已认识”？<br/>标记后，该单词将不再显示中文注释。
          </p>

          <div className="flex gap-3">
            <button 
              onClick={handleClose}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen size={16} />
              保持生词
            </button>
            <button 
              onClick={handleKnown}
              className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2"
            >
              <Check size={16} />
              我认识了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
