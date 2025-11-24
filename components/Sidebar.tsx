import React, { useState, useRef } from 'react';
import { Settings, ChevronDown, ChevronRight, Plus, Trash2, BookOpen, RefreshCw, GraduationCap } from 'lucide-react';
import { Book, Chapter, SyncStatus, SyncProgress } from '../types';
import SettingsModal from './Settings';
import { VocabularyModal } from './VocabularyModal';
import { useWordContext } from '../context/WordContext';

interface SidebarProps {
  books: Book[];
  activeBookId: string;
  activeChapterId: string;
  chapters: Chapter[];
  onSelectBook: (id: string) => void;
  onSelectChapter: (id: string) => void;
  onAddBook: (file: File) => void;
  onDeleteBook: (id: string) => void;
  syncStatus?: SyncStatus;
  syncProgress?: SyncProgress | null;
  onManualSync?: () => Promise<boolean>;
  isWebDAVConfigured?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  books,
  activeBookId,
  activeChapterId,
  chapters,
  onSelectBook,
  onSelectChapter,
  onAddBook,
  onDeleteBook,
  syncStatus,
  syncProgress,
  onManualSync,
  isWebDAVConfigured
}) => {
  const [isLibraryOpen, setLibraryOpen] = useState(true);
  const [isTocOpen, setTocOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { newWords } = useWordContext();

  // 计算未学习单词数量
  const unstudiedCount = newWords.filter(w => !w.lastReviewedAt).length;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAddBook(file);
    }
    // Reset input so the same file can be selected again if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSyncClick = () => {
    if (!isWebDAVConfigured) {
      // 未配置 WebDAV，打开设置界面
      alert('请先在设置中配置 WebDAV 服务器信息');
      setShowSettings(true);
    } else if (onManualSync) {
      onManualSync();
    }
  };

  return (
    <div className="h-full flex bg-white dark:bg-gray-800 shadow-lg">
      {/* Far Left: Icon Strip */}
      <div className="w-12 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-6 z-20">
         {/* 手动同步按钮 */}
         <button
           onClick={handleSyncClick}
           className={`p-2 transition-colors rounded-md ${
             syncStatus === 'syncing'
               ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 animate-spin'
               : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:text-orange-700 dark:hover:text-orange-300'
           }`}
           title="手动同步"
           disabled={syncStatus === 'syncing'}
         >
            <RefreshCw size={20} />
         </button>

         {/* 生词本按钮 */}
         <button
           onClick={() => setShowVocabulary(true)}
           className="relative p-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 hover:text-purple-700 dark:hover:text-purple-300 transition-colors rounded-md"
           title="生词本"
         >
            <GraduationCap size={20} />
            {unstudiedCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unstudiedCount > 99 ? '99+' : unstudiedCount}
              </span>
            )}
         </button>

         <div className="mt-auto pb-4">
             <button
               onClick={() => setShowSettings(true)}
               className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
               title="设置"
             >
                <Settings size={20} />
            </button>
         </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          syncStatus={syncStatus}
          syncProgress={syncProgress}
          onManualSync={onManualSync}
        />
      )}

      {/* Vocabulary Modal */}
      <VocabularyModal
        isOpen={showVocabulary}
        onClose={() => setShowVocabulary(false)}
      />

      {/* Middle Left: File Tree */}
      <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col text-sm">
        {/* Library Section */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-3 hover:bg-gray-100 dark:hover:bg-gray-800 group">
              <button
                onClick={() => setLibraryOpen(!isLibraryOpen)}
                className="flex items-center flex-1 py-2 text-gray-600 dark:text-gray-300 text-xs font-medium text-left"
              >
                {isLibraryOpen ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />}
                图书馆
              </button>
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                }}
                className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded transition-colors"
                title="添加图书"
              >
                <Plus size={14} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".epub,.pdf,.txt"
                onChange={handleFileChange}
              />
          </div>

          {isLibraryOpen && (
            <div className="max-h-80 overflow-y-auto">
              {books.map(book => (
                <div
                    key={book.id}
                    onClick={() => onSelectBook(book.id)}
                    className={`group flex items-center justify-between pl-7 pr-3 py-1.5 cursor-pointer truncate transition-colors text-xs ${activeBookId === book.id ? 'bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-r-2 border-blue-500 dark:border-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <span className="truncate flex-1" title={book.title}>{book.title}</span>

                  {/* Delete Button (Visible on hover) */}
                  <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Basic confirmation is good practice
                        if(confirm('确认删除这本书吗？')) {
                            onDeleteBook(book.id);
                        }
                    }}
                    className="ml-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除图书"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {books.length === 0 && (
                  <div className="pl-7 pr-3 py-2 text-gray-400 dark:text-gray-500 text-xs italic">
                      暂无书籍
                  </div>
              )}
            </div>
          )}
        </div>

        {/* TOC Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
            <button
                onClick={() => setTocOpen(!isTocOpen)}
                className="flex items-center w-full px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium flex-shrink-0"
            >
                {isTocOpen ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />}
                章节
            </button>

            {isTocOpen && (
                <div className="flex-1 overflow-y-auto">
                    {chapters.map((chapter) => (
                        <div
                            key={chapter.id}
                            onClick={() => onSelectChapter(chapter.id)}
                            className={`pl-7 pr-3 py-1.5 cursor-pointer truncate text-xs transition-colors ${activeChapterId === chapter.id ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            title={chapter.title}
                        >
                            {chapter.title}
                        </div>
                    ))}
                    {chapters.length === 0 && (
                        <div className="pl-7 pr-3 py-1.5 text-gray-400 dark:text-gray-500 text-xs italic">
                            无章节内容
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default Sidebar;
