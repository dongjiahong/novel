import React, { useState, useRef } from 'react';
import { Settings, ChevronDown, ChevronRight, Plus, Trash2, BookOpen, RefreshCw } from 'lucide-react';
import { Book, Chapter, SyncStatus } from '../types';
import SettingsModal from './Settings';

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
  onManualSync,
  isWebDAVConfigured
}) => {
  const [isLibraryOpen, setLibraryOpen] = useState(true);
  const [isTocOpen, setTocOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="h-full flex bg-white shadow-lg">
      {/* Far Left: Icon Strip */}
      <div className="w-12 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-4 gap-6 z-20">
         {/* 手动同步按钮 */}
         <button
           onClick={handleSyncClick}
           className={`p-2 transition-colors rounded-md ${
             syncStatus === 'syncing'
               ? 'text-orange-600 bg-orange-50 animate-spin'
               : 'text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700'
           }`}
           title="手动同步"
           disabled={syncStatus === 'syncing'}
         >
            <RefreshCw size={20} />
         </button>

         <div className="mt-auto pb-4">
             <button
               onClick={() => setShowSettings(true)}
               className="p-2 text-gray-400 hover:text-gray-800 transition-colors"
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
          onManualSync={onManualSync}
        />
      )}

      {/* Middle Left: File Tree */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col text-sm">
        {/* Library Section */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between px-3 hover:bg-gray-100 group">
              <button
                onClick={() => setLibraryOpen(!isLibraryOpen)}
                className="flex items-center flex-1 py-2 text-gray-600 text-xs font-medium text-left"
              >
                {isLibraryOpen ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />}
                图书馆
              </button>
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                }}
                className="p-1 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors"
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
                    className={`group flex items-center justify-between pl-7 pr-3 py-1.5 cursor-pointer truncate transition-colors text-xs ${activeBookId === book.id ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-500' : 'text-gray-600 hover:bg-gray-100'}`}
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
                    className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除图书"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {books.length === 0 && (
                  <div className="pl-7 pr-3 py-2 text-gray-400 text-xs italic">
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
                className="flex items-center w-full px-3 py-2 text-gray-600 hover:bg-gray-100 text-xs font-medium flex-shrink-0"
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
                            className={`pl-7 pr-3 py-1.5 cursor-pointer truncate text-xs transition-colors ${activeChapterId === chapter.id ? 'text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                            title={chapter.title}
                        >
                            {chapter.title}
                        </div>
                    ))}
                    {chapters.length === 0 && (
                        <div className="pl-7 pr-3 py-1.5 text-gray-400 text-xs italic">
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
