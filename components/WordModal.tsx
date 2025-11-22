import React from 'react';
import { useWordContext } from '../context/WordContext';
import { X, Check, BookMarked, XCircle } from 'lucide-react';

export const WordModal: React.FC = () => {
  const {
    interactingWord,
    setInteractingWord,
    markAsKnown,
    unmarkAsKnown,
    addNewWord,
    removeNewWord,
    checkIsKnown,
    checkIsInNewWords
  } = useWordContext();

  if (!interactingWord) return null;

  const { word, entry, sentence } = interactingWord;
  const isKnown = checkIsKnown(word);
  const isInNewWords = checkIsInNewWords(word);

  // 标记为已认识
  const handleKnown = () => {
    markAsKnown(word);
    setInteractingWord(null);
  };

  // 取消认识
  const handleUnknown = () => {
    unmarkAsKnown(word);
    setInteractingWord(null);
  };

  // 添加到生词表
  const handleAddToNewWords = () => {
    // 如果单词被标记为"已认识"，先取消该状态（因为添加到生词表意味着还需要学习）
    if (isKnown) {
      unmarkAsKnown(word);
    }

    const newWordData = {
      word,
      translation: entry.translation,
      phonetic: entry.phonetic,
      sentence: sentence || undefined, // 添加例句
      firstSeenAt: new Date().toISOString(),
      reviewCount: 0
    };

    addNewWord(newWordData);
    setInteractingWord(null);
  };

  // 从生词表移除
  const handleRemoveFromNewWords = () => {
    removeNewWord(word);
    setInteractingWord(null);
  };

  // 关闭弹窗
  const handleClose = () => {
    setInteractingWord(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 px-6 py-4 border-b border-blue-100 dark:border-gray-700 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-serif font-bold text-blue-900 dark:text-blue-100">{word}</h3>
            {entry.phonetic && (
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1 font-mono">{entry.phonetic}</p>
            )}
            {isKnown && (
              <span className="inline-block mt-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                已掌握
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-blue-300 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="mb-6">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              释义 / Definition
            </span>
            <p className="text-gray-800 dark:text-gray-100 text-base mt-2 leading-relaxed">
              {entry.translation || entry.definition || '暂无解释'}
            </p>
          </div>

          {sentence && (
            <div className="mb-6">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                例句 / Example
              </span>
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-2 leading-relaxed italic border-l-2 border-blue-300 dark:border-blue-500 pl-3">
                {sentence}
              </p>
            </div>
          )}

          {!isKnown && !isInNewWords && (
            <div className="mb-6 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                这是一个生词，你可以选择将其添加到生词表进行复习，或标记为已认识。
              </p>
            </div>
          )}

          {isInNewWords && (
            <div className="mb-6 p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                ✓ 该单词已在生词表中
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {!isInNewWords ? (
              <button
                onClick={handleAddToNewWords}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-600 dark:bg-orange-700 text-white font-medium hover:bg-orange-700 dark:hover:bg-orange-600 shadow-md shadow-orange-200 dark:shadow-orange-900/30 transition-all flex items-center justify-center gap-2"
                title="添加到生词表，后续可以导出复习"
              >
                <BookMarked size={16} />
                添加到生词表
              </button>
            ) : (
              <button
                onClick={handleRemoveFromNewWords}
                className="w-full py-2.5 px-4 rounded-lg bg-purple-600 dark:bg-purple-700 text-white font-medium hover:bg-purple-700 dark:hover:bg-purple-600 shadow-md shadow-purple-200 dark:shadow-purple-900/30 transition-all flex items-center justify-center gap-2"
                title="从生词表中移除"
              >
                <XCircle size={16} />
                从生词表移除
              </button>
            )}

            <div className="flex gap-2">
              {!isKnown ? (
                <button
                  onClick={handleKnown}
                  className="flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600 shadow-md shadow-green-200 dark:shadow-green-900/30"
                  title="标记为已认识，后续不再显示注释"
                >
                  <Check size={16} />
                  我认识了
                </button>
              ) : (
                <button
                  onClick={handleUnknown}
                  className="flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 bg-yellow-600 dark:bg-yellow-700 text-white hover:bg-yellow-700 dark:hover:bg-yellow-600 shadow-md shadow-yellow-200 dark:shadow-yellow-900/30"
                  title="取消认识标记，重新显示注释"
                >
                  <XCircle size={16} />
                  取消认识
                </button>
              )}

              <button
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle size={16} />
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
