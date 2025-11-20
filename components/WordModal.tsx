import React from 'react';
import { useWordContext } from '../context/WordContext';
import { X, Check, BookMarked, XCircle } from 'lucide-react';

export const WordModal: React.FC = () => {
  const {
    interactingWord,
    setInteractingWord,
    markAsKnown,
    addNewWord,
    currentBook,
    checkIsKnown
  } = useWordContext();

  if (!interactingWord) return null;

  const { word, entry } = interactingWord;
  const isKnown = checkIsKnown(word);

  // 标记为已认识
  const handleKnown = () => {
    markAsKnown(word);
    setInteractingWord(null);
  };

  // 添加到生词表
  const handleAddToNewWords = () => {
    if (currentBook) {
      addNewWord({
        word,
        translation: entry.translation,
        phonetic: entry.phonetic,
        bookId: currentBook.id,
        bookTitle: currentBook.title,
        firstSeenAt: new Date().toISOString(),
        reviewCount: 0
      });
    }
    setInteractingWord(null);
  };

  // 关闭弹窗
  const handleClose = () => {
    setInteractingWord(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-serif font-bold text-blue-900">{word}</h3>
            {entry.phonetic && (
              <p className="text-sm text-blue-600 mt-1 font-mono">{entry.phonetic}</p>
            )}
            {isKnown && (
              <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                已掌握
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-blue-300 hover:text-blue-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="mb-6">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              释义 / Definition
            </span>
            <p className="text-gray-800 text-base mt-2 leading-relaxed">
              {entry.translation || entry.definition || '暂无解释'}
            </p>
          </div>

          {!isKnown && (
            <div className="mb-6 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700">
                这是一个生词，你可以选择将其添加到生词表进行复习，或标记为已认识。
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {!isKnown && (
              <button
                onClick={handleAddToNewWords}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700 shadow-md shadow-orange-200 transition-all flex items-center justify-center gap-2"
                title="添加到生词表，后续可以导出复习"
              >
                <BookMarked size={16} />
                添加到生词表
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleKnown}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  isKnown
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-200'
                }`}
                disabled={isKnown}
                title={isKnown ? '已经标记为认识' : '标记为已认识，后续不再显示注释'}
              >
                <Check size={16} />
                {isKnown ? '已认识' : '我认识了'}
              </button>

              <button
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle size={16} />
                关闭
              </button>
            </div>
          </div>

          {currentBook && (
            <p className="text-xs text-gray-400 mt-4 text-center">
              当前书籍：{currentBook.title}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
