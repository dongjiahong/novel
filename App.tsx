import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Reader from './components/Reader';
import { MOCK_BOOKS } from './constants';
import { Book, SyncData } from './types';
import { parseFile } from './services/parserService';
import { Loader2, BookOpen } from 'lucide-react';
import { WordProvider, useWordContext } from './context/WordContext';
import { WordModal } from './components/WordModal';
import { useReadingProgress } from './hooks/useReadingProgress';
import { useWebDAVSync } from './hooks/useWebDAVSync';

const BOOKS_STORAGE_KEY = 'books_data';
const BOOK_FILES_STORAGE_KEY = 'book_files';

function AppContent() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookFiles, setBookFiles] = useState<Map<string, string>>(new Map());
  const [activeBookId, setActiveBookId] = useState<string>('');
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 阅读进度 hook
  const { saveProgress, getProgress, setProgressBatch } = useReadingProgress();

  // WebDAV 同步完成回调
  const handleSyncComplete = useCallback((syncData: SyncData) => {
    // 更新书籍列表
    setBooks(syncData.books);

    // 更新阅读进度
    setProgressBatch(syncData.readingProgress);

    console.log('同步完成，数据已更新');
  }, [setProgressBatch]);

  // WebDAV 同步 hook
  const { syncStatus, lastSyncTime, syncError, manualSync, autoSync } = useWebDAVSync({
    books,
    bookFiles,
    onSyncComplete: handleSyncComplete,
    autoSyncEnabled: true,
  });

  const activeBook = books.find(b => b.id === activeBookId);
  const currentBookChapters = activeBook?.chapters || [];

  const currentChapter = currentBookChapters.find(c => c.id === activeChapterId)
                         || currentBookChapters[0]
                         || { id: 'empty', title: '无内容', content: '' };

  // 从 localStorage 加载书籍和文件内容
  useEffect(() => {
    try {
      const storedBooks = localStorage.getItem(BOOKS_STORAGE_KEY);
      const storedFiles = localStorage.getItem(BOOK_FILES_STORAGE_KEY);

      if (storedBooks) {
        const loadedBooks = JSON.parse(storedBooks);
        setBooks(loadedBooks);

        // 如果有书籍，选择第一本
        if (loadedBooks.length > 0 && !activeBookId) {
          const firstBook = loadedBooks[0];
          setActiveBookId(firstBook.id);

          // 尝试从阅读进度恢复位置
          const progress = getProgress(firstBook.id);
          if (progress) {
            setActiveChapterId(firstBook.chapters[progress.chapterIndex]?.id || firstBook.chapters[0]?.id);
          } else if (firstBook.chapters.length > 0) {
            setActiveChapterId(firstBook.chapters[0].id);
          }
        }
      } else {
        // 如果没有存储的书籍，使用示例书籍
        setBooks(MOCK_BOOKS);
        if (MOCK_BOOKS.length > 0) {
          setActiveBookId(MOCK_BOOKS[0].id);
          setActiveChapterId(MOCK_BOOKS[0].chapters[0]?.id || '');
        }
      }

      if (storedFiles) {
        const filesArray = JSON.parse(storedFiles);
        setBookFiles(new Map(filesArray));
      }
    } catch (error) {
      console.error('加载书籍数据失败:', error);
      setBooks(MOCK_BOOKS);
    } finally {
      setIsInitialLoad(false);
    }
  }, []);

  // 保存书籍到 localStorage
  useEffect(() => {
    if (!isInitialLoad && books.length > 0) {
      try {
        localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(books));
        // 触发自动同步
        autoSync();
      } catch (error) {
        console.error('保存书籍数据失败:', error);
      }
    }
  }, [books, isInitialLoad, autoSync]);

  // 保存书籍文件内容到 localStorage
  useEffect(() => {
    if (!isInitialLoad && bookFiles.size > 0) {
      try {
        const filesArray = Array.from(bookFiles.entries());
        localStorage.setItem(BOOK_FILES_STORAGE_KEY, JSON.stringify(filesArray));
      } catch (error) {
        console.error('保存书籍文件内容失败:', error);
      }
    }
  }, [bookFiles, isInitialLoad]);

  // 应用启动时执行同步
  useEffect(() => {
    if (!isInitialLoad) {
      manualSync();
    }
  }, [isInitialLoad, manualSync]);

  useEffect(() => {
      if (activeBook && currentBookChapters.length > 0) {
          const exists = currentBookChapters.find(c => c.id === activeChapterId);
          if (!exists) {
              setActiveChapterId(currentBookChapters[0].id);
          }
      }
  }, [activeBookId, activeBook, currentBookChapters, activeChapterId]);

  const handleSelectBook = (id: string) => {
      setActiveBookId(id);
      const book = books.find(b => b.id === id);
      if (book && book.chapters.length > 0) {
          // 尝试从阅读进度恢复位置
          const progress = getProgress(id);
          if (progress && book.chapters[progress.chapterIndex]) {
              setActiveChapterId(book.chapters[progress.chapterIndex].id);
          } else {
              setActiveChapterId(book.chapters[0].id);
          }
      } else {
          setActiveChapterId('');
      }
  };

  const handleSelectChapter = (chapterId: string) => {
      setActiveChapterId(chapterId);

      // 保存阅读进度
      if (activeBook) {
          const chapterIndex = activeBook.chapters.findIndex(c => c.id === chapterId);
          if (chapterIndex >= 0) {
              const chapter = activeBook.chapters[chapterIndex];
              saveProgress(
                  activeBook.id,
                  activeBook.title,
                  chapterIndex,
                  chapter.title,
                  0 // 段落索引，这里简化为 0
              );
              // 触发自动同步
              autoSync();
          }
      }
  };

  const handleDeleteBook = (id: string) => {
      const newBooks = books.filter(b => b.id !== id);
      setBooks(newBooks);

      // 删除书籍文件内容
      setBookFiles(prev => {
          const newFiles = new Map(prev);
          newFiles.delete(id);
          return newFiles;
      });

      if (activeBookId === id) {
          if (newBooks.length > 0) {
              const nextBook = newBooks[0];
              setActiveBookId(nextBook.id);

              // 恢复阅读进度
              const progress = getProgress(nextBook.id);
              if (progress && nextBook.chapters[progress.chapterIndex]) {
                  setActiveChapterId(nextBook.chapters[progress.chapterIndex].id);
              } else {
                  setActiveChapterId(nextBook.chapters[0]?.id || '');
              }
          } else {
              setActiveBookId('');
              setActiveChapterId('');
          }
      }

      // 触发自动同步
      autoSync();
  };

  const handleAddBook = async (file: File) => {
    setIsParsing(true);
    setErrorMsg(null);
    try {
        const newBook = await parseFile(file);

        // 读取文件内容用于上传
        const fileContent = await file.text();
        setBookFiles(prev => {
            const newFiles = new Map(prev);
            newFiles.set(newBook.id, fileContent);
            return newFiles;
        });

        setBooks(prev => [...prev, newBook]);
        setActiveBookId(newBook.id);
        if (newBook.chapters.length > 0) {
            setActiveChapterId(newBook.chapters[0].id);

            // 保存初始阅读进度
            saveProgress(
                newBook.id,
                newBook.title,
                0,
                newBook.chapters[0].title,
                0
            );
        }

        // 触发自动同步
        autoSync();
    } catch (err: any) {
        console.error("Parsing error:", err);
        setErrorMsg(err.message || "解析文件失败");
        setTimeout(() => setErrorMsg(null), 3000);
    } finally {
        setIsParsing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white relative">
      
      {/* Global Modal for Words */}
      <WordModal />

      {/* Loading Overlay */}
      {isParsing && (
          <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
                  <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
                  <span className="text-gray-700 font-medium">正在解析图书内容...</span>
              </div>
          </div>
      )}

      {/* Error Toast */}
      {errorMsg && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 text-red-700 px-4 py-2 rounded shadow border border-red-200">
              {errorMsg}
          </div>
      )}

      {/* 同步状态提示 */}
      {syncStatus === 'syncing' && (
          <div className="absolute top-4 right-4 z-50 bg-blue-100 text-blue-700 px-4 py-2 rounded shadow border border-blue-200 flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              <span>正在同步...</span>
          </div>
      )}
      {syncStatus === 'success' && (
          <div className="absolute top-4 right-4 z-50 bg-green-100 text-green-700 px-4 py-2 rounded shadow border border-green-200">
              同步成功
          </div>
      )}
      {syncStatus === 'error' && syncError && (
          <div className="absolute top-4 right-4 z-50 bg-red-100 text-red-700 px-4 py-2 rounded shadow border border-red-200">
              同步失败: {syncError}
          </div>
      )}

      {/* Sidebar Container */}
      <div className="hidden md:block flex-shrink-0 h-full border-r border-gray-200">
        <Sidebar
          books={books}
          activeBookId={activeBookId}
          activeChapterId={currentChapter.id}
          chapters={currentBookChapters}
          onSelectBook={handleSelectBook}
          onSelectChapter={handleSelectChapter}
          onAddBook={handleAddBook}
          onDeleteBook={handleDeleteBook}
          syncStatus={syncStatus}
          onManualSync={manualSync}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
         {/* Mobile Header */}
         <div className="md:hidden h-12 bg-white border-b flex items-center px-4 justify-between flex-shrink-0">
            <span className="font-bold text-gray-700">E-Reader</span>
            <button className="text-gray-500">Menu</button>
         </div>

         {activeBookId ? (
             <Reader chapter={currentChapter} />
         ) : (
             <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-2">
                 <BookOpen size={48} className="text-gray-200" />
                 <p>请上传或选择一本书开始阅读</p>
             </div>
         )}
      </div>
    </div>
  );
}

function App() {
  return (
    <WordProvider>
      <AppContent />
    </WordProvider>
  );
}

export default App;
