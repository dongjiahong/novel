import React, { useState, useRef } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  BookOpen,
  RefreshCw,
  GraduationCap,
  Palette,
  Library,
  List
} from 'lucide-react';
import { Book, Chapter, SyncStatus, SyncProgress, ReadingTheme } from '../types';
import SettingsModal from './Settings';
import { VocabularyModal } from './VocabularyModal';
import { useWordContext } from '../context/WordContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeSwatch } from './ThemeSwatch';

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

const ModernSidebar: React.FC<SidebarProps> = ({
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
  const [activeTab, setActiveTab] = useState<'library' | 'chapters'>('library');
  const [showSettings, setShowSettings] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { newWords } = useWordContext();
  const { readingTheme, setReadingTheme } = useTheme();

  const unstudiedCount = newWords.filter(w => !w.lastReviewedAt).length;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAddBook(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSyncClick = () => {
    if (!isWebDAVConfigured) {
      alert('请先在设置中配置 WebDAV 服务器信息');
      setShowSettings(true);
    } else if (onManualSync) {
      onManualSync();
    }
  };

  return (
    <div className="h-full w-80 flex flex-col bg-surface border-r border-border transition-colors duration-300">
      {/* Header */}
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-200 dark:shadow-none">
          <BookOpen className="text-white w-5 h-5" />
        </div>
        <h1 className="font-bold text-lg text-foreground tracking-tight">
          LingoReader
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'library'
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
              : 'text-muted hover:bg-surface2 hover:text-foreground'
          }`}
        >
          <Library size={16} />
          <span>书库</span>
        </button>
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'chapters'
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
              : 'text-muted hover:bg-surface2 hover:text-foreground'
          }`}
        >
          <List size={16} />
          <span>目录</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {activeTab === 'library' ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">我的书籍</span>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-md hover:bg-surface2 text-primary-600 transition-colors"
                title="添加书籍"
              >
                <Plus size={16} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".epub,.pdf,.txt"
                onChange={handleFileChange}
              />
            </div>
            
            {books.length === 0 ? (
              <div className="text-center py-8 px-4 text-muted text-sm bg-surface2 rounded-lg border border-dashed border-border">
                <Library size={32} className="mx-auto mb-2 opacity-50" />
                <p>暂无书籍</p>
                <p className="text-xs mt-1">点击右上角 + 添加</p>
              </div>
            ) : (
              books.map(book => (
                <div
                  key={book.id}
                  onClick={() => onSelectBook(book.id)}
                  className={`group relative flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    activeBookId === book.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-muted hover:bg-surface2 hover:text-foreground'
                  }`}
                >
                  <BookOpen size={16} className={`mr-3 shrink-0 ${activeBookId === book.id ? 'text-primary-500' : 'text-muted'}`} />
                  <span className="text-sm font-medium truncate flex-1">{book.title}</span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('确认删除这本书吗？')) onDeleteBook(book.id);
                    }}
                    className="absolute right-2 p-1.5 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-1">
             <div className="px-2 mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">章节列表</span>
            </div>
            {chapters.length === 0 ? (
               <div className="text-center py-8 text-muted text-sm">
                <List size={32} className="mx-auto mb-2 opacity-50" />
                <p>请先选择一本书</p>
              </div>
            ) : (
              chapters.map(chapter => (
                <div
                  key={chapter.id}
                  onClick={() => onSelectChapter(chapter.id)}
                  className={`flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    activeChapterId === chapter.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-muted hover:bg-surface2 hover:text-foreground'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mr-3 shrink-0 ${activeChapterId === chapter.id ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span className="text-sm truncate">{chapter.title}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-border bg-surface/50 backdrop-blur-sm">
        {/* Tools Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setShowVocabulary(true)}
            className="flex items-center justify-center gap-2 p-2 rounded-lg bg-surface border border-border hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all group"
          >
            <div className="relative">
              <GraduationCap size={18} className="text-primary-500 group-hover:scale-110 transition-transform" />
              {unstudiedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-muted group-hover:text-foreground">生词本</span>
          </button>

          <button
            onClick={() => setShowThemes(!showThemes)}
            className={`flex items-center justify-center gap-2 p-2 rounded-lg bg-surface border transition-all group ${showThemes ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20' : 'border-border hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm'}`}
          >
            <Palette size={18} className="text-amber-500 group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-medium text-muted group-hover:text-foreground">主题</span>
          </button>
        </div>

        {/* Themes Panel (Collapsible) */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showThemes ? 'max-h-32 opacity-100 mb-3' : 'max-h-0 opacity-0'}`}>
          <div className="p-2 bg-surface rounded-lg border border-border flex flex-wrap gap-2 justify-center">
             {(['light', 'dark', 'solarized-light', 'solarized-dark'] as ReadingTheme[]).map((t) => (
                <ThemeSwatch
                  key={t}
                  theme={t}
                  isActive={readingTheme === t}
                  onClick={setReadingTheme}
                />
              ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncClick}
            disabled={syncStatus === 'syncing'}
            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border text-sm font-medium transition-all ${
              syncStatus === 'syncing' 
              ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' 
              : 'bg-surface border-border text-muted hover:bg-surface2 hover:text-foreground'
            }`}
          >
            <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            <span>同步</span>
          </button>
          
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-surface border border-border text-muted hover:text-foreground hover:bg-surface2 transition-all"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          syncStatus={syncStatus}
          syncProgress={syncProgress}
          onManualSync={onManualSync}
        />
      )}

      <VocabularyModal
        isOpen={showVocabulary}
        onClose={() => setShowVocabulary(false)}
      />
    </div>
  );
};

export default ModernSidebar;