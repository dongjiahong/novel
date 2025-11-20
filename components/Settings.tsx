import React, { useState } from 'react';
import { useWordContext } from '../context/WordContext';
import { X, Download, Trash2, BookOpen, CheckCircle } from 'lucide-react';

interface SettingsProps {
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const {
    currentVocabularyLevel,
    availableLevels,
    setVocabularyLevel,
    isLevelLoading,
    knownWords,
    newWords,
    exportNewWords,
    currentBook
  } = useWordContext();

  const [activeTab, setActiveTab] = useState<'vocabulary' | 'newwords' | 'stats'>('vocabulary');

  // 按书籍分组生词
  const newWordsByBook = React.useMemo(() => {
    const grouped: { [bookTitle: string]: typeof newWords } = {};
    newWords.forEach(word => {
      if (!grouped[word.bookTitle]) {
        grouped[word.bookTitle] = [];
      }
      grouped[word.bookTitle].push(word);
    });
    return grouped;
  }, [newWords]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-xl font-bold text-gray-800">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'vocabulary'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            词汇等级
          </button>
          <button
            onClick={() => setActiveTab('newwords')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'newwords'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            生词表
            {newWords.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-orange-500 rounded-full">
                {newWords.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'stats'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            统计
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 词汇等级选择 */}
          {activeTab === 'vocabulary' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">选择已掌握词汇等级</h3>
              <p className="text-sm text-gray-600 mb-6">
                选择你当前的词汇水平，该等级及以下的单词将不会显示注释。
              </p>

              {isLevelLoading && (
                <div className="text-center py-4">
                  <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500 mt-2">加载中...</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableLevels.map(level => (
                  <button
                    key={level.id}
                    onClick={() => setVocabularyLevel(level.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      currentVocabularyLevel?.id === level.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800">{level.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{level.description}</p>
                        <p className="text-xs text-blue-600 mt-2">
                          约 {level.wordCount.toLocaleString()} 词
                        </p>
                      </div>
                      {currentVocabularyLevel?.id === level.id && (
                        <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 生词表 */}
          {activeTab === 'newwords' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">我的生词表</h3>
                <button
                  onClick={() => exportNewWords()}
                  disabled={newWords.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <Download size={16} />
                  导出全部
                </button>
              </div>

              {newWords.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500">还没有添加任何生词</p>
                  <p className="text-sm text-gray-400 mt-2">
                    点击文章中的生词，选择"添加到生词表"即可
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(newWordsByBook).map(([bookTitle, words]) => (
                    <div key={bookTitle} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-800">
                          {bookTitle}
                          <span className="ml-2 text-sm text-gray-500">({words.length} 词)</span>
                        </h4>
                        <button
                          onClick={() => exportNewWords(words[0]?.bookId)}
                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                        >
                          <Download size={14} />
                          导出
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {words.slice(0, 12).map((word, idx) => (
                          <div
                            key={idx}
                            className="text-sm bg-gray-50 px-2 py-1 rounded border border-gray-200"
                            title={word.translation}
                          >
                            <span className="font-medium text-gray-800">{word.word}</span>
                            {word.translation && (
                              <span className="text-xs text-gray-500 block truncate">
                                {word.translation.split(/[,;]/)[0]}
                              </span>
                            )}
                          </div>
                        ))}
                        {words.length > 12 && (
                          <div className="text-sm text-gray-400 px-2 py-1 flex items-center justify-center">
                            +{words.length - 12} 更多...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 统计信息 */}
          {activeTab === 'stats' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">学习统计</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">已掌握词汇</p>
                  <p className="text-3xl font-bold text-blue-700 mt-2">
                    {knownWords.size.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    包含等级词汇和手动标记
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-600 font-medium">生词表总数</p>
                  <p className="text-3xl font-bold text-orange-700 mt-2">
                    {newWords.length.toLocaleString()}
                  </p>
                  <p className="text-xs text-orange-500 mt-1">
                    需要复习的单词
                  </p>
                </div>

                {currentVocabularyLevel && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-medium">当前等级</p>
                    <p className="text-xl font-bold text-green-700 mt-2">
                      {currentVocabularyLevel.name}
                    </p>
                    <p className="text-xs text-green-500 mt-1">
                      {currentVocabularyLevel.description}
                    </p>
                  </div>
                )}

                {currentBook && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-600 font-medium">当前书籍</p>
                    <p className="text-sm font-bold text-purple-700 mt-2 truncate">
                      {currentBook.title}
                    </p>
                    <p className="text-xs text-purple-500 mt-1">
                      本书生词: {newWords.filter(w => w.bookId === currentBook.id).length}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">功能说明</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 橙色标注的单词表示生词，点击可查看详情</li>
                  <li>• 已认识的单词不会显示注释，但可点击查看</li>
                  <li>• 生词表可按书籍分类导出，方便复习</li>
                  <li>• 词汇等级可随时切换，立即生效</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
