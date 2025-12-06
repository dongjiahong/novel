import React, { useState, useEffect, useCallback, useRef } from 'react';
import Reader from './components/Reader';
import { MOCK_BOOKS } from './constants';
import { Book, BooksMetaData } from './types';
import { parseFile } from './services/parserService';
import { syncService, syncDirtyFlags } from './services/syncService';
import { storageService } from './services/storageService';
import { Loader2, BookOpen, RefreshCw } from 'lucide-react';
import { WordProvider } from './context/WordContext';
import { ThemeProvider } from './context/ThemeContext';
import { WordModal } from './components/WordModal';
import { useReadingProgress } from './hooks/useReadingProgress';
import { useWebDAVSync } from './hooks/useWebDAVSync';

function AppContent() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookFiles, setBookFiles] = useState<Map<string, string>>(new Map());
  const [activeBookId, setActiveBookId] = useState<string>('');
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [downloadingBook, setDownloadingBook] = useState<string | null>(null);
  const [lastProgressAppliedAt, setLastProgressAppliedAt] = useState<number>(0);

  // 标记是否已执行过启动同步，防止重复触发
  const hasInitialSyncRef = useRef(false);

  // 阅读进度 hook
  const { saveProgress, getProgress, setProgressBatch, progressList, removeProgress } = useReadingProgress();

  // WebDAV 同步完成回调
  const handleSyncComplete = useCallback(async (booksMeta: BooksMetaData) => {
    console.log('=== WebDAV 同步完成回调 ===');
    console.log('同步的书籍元数据:', booksMeta);
    console.log('书籍元数据数量:', booksMeta?.books?.length);

    if (!booksMeta || !booksMeta.books || !Array.isArray(booksMeta.books)) {
      console.error('同步返回的书籍元数据无效:', booksMeta);
      return;
    }

    console.log('同步的书籍元数据:', booksMeta.books.map(b => ({ id: b.id, title: b.title, chapterCount: b.chapterCount })));

    // 下载并解析缺失的书籍文件（按书名判断是否已存在）
    const currentBookTitles = new Set(books.map(b => b.title));
    const newBooks: Book[] = [];
    const newBookFiles = new Map(bookFiles);

    for (const bookMeta of booksMeta.books) {
      // 如果本地已有此书籍（按书名判断），跳过
      if (currentBookTitles.has(bookMeta.title)) {
        console.log(`书籍 ${bookMeta.title} 已存在，跳过`);
        continue;
      }

      try {
        console.log(`开始下载书籍: ${bookMeta.title}`);
        setDownloadingBook(bookMeta.title);
        const fileContent = await syncService.downloadBook(bookMeta.id, bookMeta.fileExtension);

        if (!fileContent) {
          console.warn(`书籍 ${bookMeta.title} 文件不存在于服务器`);
          continue;
        }

        console.log(`成功下载书籍 ${bookMeta.title}，文件大小: ${fileContent instanceof ArrayBuffer ? fileContent.byteLength : fileContent.length}，开始解析...`);

        // 将文件内容转换为 File 对象以便解析
        let file: File;
        if (fileContent instanceof ArrayBuffer) {
          // EPUB 文件（二进制）
          const blob = new Blob([fileContent], { type: 'application/epub+zip' });
          file = new File([blob], bookMeta.title, { type: 'application/epub+zip' });
          console.log(`创建 EPUB File 对象，大小: ${blob.size} 字节`);
        } else {
          // TXT 文件（文本）
          const blob = new Blob([fileContent], { type: 'text/plain' });
          file = new File([blob], bookMeta.title, { type: 'text/plain' });
          console.log(`创建 TXT File 对象，大小: ${blob.size} 字节`);
        }

        const parsedBook = await parseFile(file);
        console.log(`成功解析书籍 ${bookMeta.title}，章节数: ${parsedBook.chapters.length}`);

        newBooks.push(parsedBook);
        // 保存文件内容（用于后续同步）
        if (fileContent instanceof ArrayBuffer) {
          // 将 ArrayBuffer 转换为字符串保存（Base64 编码）
          const bytes = new Uint8Array(fileContent);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          newBookFiles.set(parsedBook.id, base64);
        } else {
          newBookFiles.set(parsedBook.id, fileContent);
        }
      } catch (error) {
        console.error(`处理书籍 ${bookMeta.title} 失败:`, error);
        console.error(`错误详情:`, error instanceof Error ? error.message : error);
        console.error(`错误堆栈:`, error instanceof Error ? error.stack : '');
      }
    }

    // 清除下载状态
    setDownloadingBook(null);

    // 更新状态
    if (newBooks.length > 0) {
      console.log(`添加 ${newBooks.length} 本新书籍到列表`);
      setBooks(prev => [...prev, ...newBooks]);
      setBookFiles(newBookFiles);

      // 如果当前没有选中的书籍，选择第一本新书
      if (!activeBookId && newBooks.length > 0) {
        const firstBook = newBooks[0];
        setActiveBookId(firstBook.id);
        if (firstBook.chapters.length > 0) {
          const progress = getProgress(firstBook.id);
          if (progress && firstBook.chapters[progress.chapterIndex]) {
            setActiveChapterId(firstBook.chapters[progress.chapterIndex].id);
          } else {
            setActiveChapterId(firstBook.chapters[0].id);
          }
        }
        console.log(`已选择书籍: ${firstBook.title}`);
      }
    } else {
      console.log('没有需要下载的新书籍');
    }

    // 同步完成后，检查当前打开的书籍是否有更新的阅读进度
    if (activeBookId) {
      // 等待一小段时间让 progressList 更新
      setTimeout(() => {
        const currentBook = books.find(b => b.id === activeBookId);
        if (!currentBook) return;

        const updatedProgress = getProgress(activeBookId);
        if (updatedProgress) {
          const currentChapters = currentBook.chapters || [];
          const currentChapterIdx = currentChapters.findIndex(c => c.id === activeChapterId);
          // 如果同步的进度与当前章节不同，则更新到同步的进度
          if (updatedProgress.chapterIndex !== currentChapterIdx) {
            console.log(`📖 应用同步后的阅读进度: 章节 ${updatedProgress.chapterIndex}`);
            const targetChapter = currentBook.chapters[updatedProgress.chapterIndex];
            if (targetChapter) {
              setActiveChapterId(targetChapter.id);
            }
          }
        }
      }, 100);
    }

    console.log('同步完成回调处理完成');
  }, [books, bookFiles, activeBookId, activeChapterId, getProgress]);

  // WebDAV 同步 hook
  const { syncStatus, syncProgress, lastSyncTime, syncError, manualSync, autoSync, isConfigured } = useWebDAVSync({
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

  // 获取当前章节的索引和初始段落索引
  const currentChapterIndex = currentBookChapters.findIndex(c => c.id === activeChapterId);
  const progress = activeBookId ? getProgress(activeBookId) : null;
  const initialParagraphIndex = (progress && progress.chapterIndex === currentChapterIndex) ? progress.paragraphIndex : 0;

  // 从 IndexedDB 加载书籍和文件内容
  useEffect(() => {
    console.log('=== 开始加载书籍数据 ===');

    const loadData = async () => {
      try {
        // 从 IndexedDB 加载数据
        const loadedBooks = await storageService.loadBooks();
        const loadedFiles = await storageService.loadBookFiles();

        console.log('IndexedDB 中的书籍数量:', loadedBooks.length);
        console.log('IndexedDB 中的文件数量:', loadedFiles.size);

        if (loadedBooks.length > 0) {
          console.log('设置已加载的书籍，数量:', loadedBooks.length);
          setBooks(loadedBooks);
          setBookFiles(loadedFiles);

          // 如果有书籍，选择第一本
          if (!activeBookId) {
            const firstBook = loadedBooks[0];
            //console.log('第一本书:', firstBook);
            //console.log('第一本书的章节:', firstBook?.chapters);
            console.log('第一本书的章节数量:', firstBook?.chapters?.length);

            if (firstBook && firstBook.id) {
              setActiveBookId(firstBook.id);
              // 注意：不在这里设置 activeChapterId，因为此时 progressList 可能还未加载
              // 阅读进度恢复将在下面的 useEffect 中处理
            } else {
              console.error('第一本书数据无效:', firstBook);
            }
          }
        } else {
          console.log('没有存储的书籍数据，MOCK_BOOKS 数量:', MOCK_BOOKS.length);
          // 如果没有存储的书籍，使用示例书籍
          setBooks(MOCK_BOOKS);
          if (MOCK_BOOKS.length > 0) {
            console.log('使用 MOCK_BOOKS[0]:', MOCK_BOOKS[0]);
            setActiveBookId(MOCK_BOOKS[0].id);
            setActiveChapterId(MOCK_BOOKS[0].chapters?.[0]?.id || '');
          } else {
            console.warn('MOCK_BOOKS 为空，没有默认书籍可用');
          }
        }
      } catch (error) {
        console.error('加载书籍数据失败:', error);
        console.error('错误堆栈:', error instanceof Error ? error.stack : '');
        // 使用示例书籍
        console.log('出错后，MOCK_BOOKS 数量:', MOCK_BOOKS.length);
        setBooks(MOCK_BOOKS);
        if (MOCK_BOOKS.length > 0) {
          console.log('使用 MOCK_BOOKS[0]:', MOCK_BOOKS[0]);
          setActiveBookId(MOCK_BOOKS[0].id);
          setActiveChapterId(MOCK_BOOKS[0].chapters?.[0]?.id || '');
        } else {
          console.warn('MOCK_BOOKS 为空，没有默认书籍可用');
        }
      } finally {
        setIsInitialLoad(false);
        console.log('=== 书籍数据加载完成 ===');
      }
    };

    loadData();
  }, []);

  // 保存书籍到 IndexedDB
  useEffect(() => {
    if (!isInitialLoad && books.length > 0) {
      storageService.saveBooks(books).catch(error => {
        console.error('保存书籍数据失败:', error);
      });
    }
  }, [books, isInitialLoad]);

  // 保存书籍文件内容到 IndexedDB
  useEffect(() => {
    if (!isInitialLoad && bookFiles.size > 0) {
      storageService.saveBookFiles(bookFiles).catch(error => {
        console.error('保存书籍文件内容失败:', error);
      });
    }
  }, [bookFiles, isInitialLoad]);

  // 应用启动时执行同步（只执行一次）
  useEffect(() => {
    if (!isInitialLoad && !hasInitialSyncRef.current) {
      hasInitialSyncRef.current = true;
      manualSync();
    }
  }, [isInitialLoad, manualSync]);

  // 当阅读进度有更晚的时间戳时，自动聚焦到对应的书籍与章节，保证多设备同步后定位正确
  useEffect(() => {
    if (books.length === 0 || progressList.length === 0) return;

    const validProgress = progressList.filter(p => books.some(b => b.id === p.bookId));
    if (validProgress.length === 0) return;

    const latest = validProgress.reduce((acc, curr) => {
      const accTime = new Date(acc.updatedAt).getTime();
      const currTime = new Date(curr.updatedAt).getTime();
      return currTime > accTime ? curr : acc;
    });

    const latestTime = new Date(latest.updatedAt).getTime();
    if (!Number.isFinite(latestTime) || latestTime <= lastProgressAppliedAt) return;

    const targetBook = books.find(b => b.id === latest.bookId);
    if (!targetBook || targetBook.chapters.length === 0) return;

    const targetChapter = targetBook.chapters[latest.chapterIndex] ?? targetBook.chapters[0];
    if (!targetChapter) return;

    setActiveBookId(targetBook.id);
    setActiveChapterId(targetChapter.id);
    setLastProgressAppliedAt(latestTime);
  }, [books, progressList, lastProgressAppliedAt]);

  // 从阅读进度恢复章节位置（当 progressList 加载完成后）
  useEffect(() => {
    if (activeBookId && books.length > 0 && !activeChapterId) {
      const book = books.find(b => b.id === activeBookId);

      if (book && book.chapters.length > 0) {
        // 尝试从进度列表中查找该书籍的进度
        const progress = progressList.find(p => p.bookId === activeBookId);
        console.log('恢复阅读进度:', progress);

        if (progress && book.chapters[progress.chapterIndex]) {
          console.log(`恢复到第 ${progress.chapterIndex} 章，段落索引 ${progress.paragraphIndex}`);
          setActiveChapterId(book.chapters[progress.chapterIndex].id);
        } else {
          console.log('没有阅读进度，从第一章开始');
          setActiveChapterId(book.chapters[0].id);
        }
      }
    }
  }, [activeBookId, books, activeChapterId, progressList]);

  // 当切换书籍时，确保章节ID有效
  useEffect(() => {
    if (activeBook && currentBookChapters.length > 0 && activeChapterId) {
      const exists = currentBookChapters.find(c => c.id === activeChapterId);
      // 只有在章节ID确实无效时才重置，避免干扰阅读进度恢复
      if (!exists && !isInitialLoad) {
        console.log('当前章节ID无效，重置为第一章');
        setActiveChapterId(currentBookChapters[0].id);
      }
    }
  }, [activeBookId, activeBook, currentBookChapters, isInitialLoad]);

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
          0 // 切换章节时从第一个段落开始
        );
      }
    }
  };

  // 处理阅读进度保存（翻页时调用）
  const handleSaveProgress = useCallback((chapterIndex: number, paragraphIndex: number) => {
    if (activeBook && activeBook.chapters[chapterIndex]) {
      const chapter = activeBook.chapters[chapterIndex];
      saveProgress(
        activeBook.id,
        activeBook.title,
        chapterIndex,
        chapter.title,
        paragraphIndex
      );
    }
  }, [activeBook, saveProgress]);

  const handleDeleteBook = async (id: string) => {
    const newBooks = books.filter(b => b.id !== id);
    setBooks(newBooks);

    // 删除书籍文件内容
    setBookFiles(prev => {
      const newFiles = new Map(prev);
      newFiles.delete(id);
      return newFiles;
    });

    // 从 IndexedDB 删除
    try {
      await storageService.deleteBook(id);
    } catch (error) {
      console.error('从 IndexedDB 删除书籍失败:', error);
    }

    // 删除阅读进度
    try {
      removeProgress(id);
      console.log(`已删除书籍 ${id} 的阅读进度`);
    } catch (error) {
      console.error('删除阅读进度失败:', error);
    }

    // 清理 localStorage 中的 books_meta
    try {
      const booksMetaStr = localStorage.getItem('books_meta');
      if (booksMetaStr) {
        const booksMeta = JSON.parse(booksMetaStr);
        const updatedMeta = booksMeta.filter((book: any) => book.id !== id);
        localStorage.setItem('books_meta', JSON.stringify(updatedMeta));
        console.log(`已从 books_meta 中删除书籍 ${id}`);

        // 标记书籍元数据为脏数据
        syncDirtyFlags.set('booksMeta');
      }
    } catch (error) {
      console.error('清理 books_meta 失败:', error);
    }

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
  };

  const handleAddBook = async (file: File) => {
    setIsParsing(true);
    setErrorMsg(null);
    try {
      console.log(`开始添加书籍: ${file.name}, 类型: ${file.type}, 大小: ${file.size} 字节`);

      const newBook = await parseFile(file);
      console.log(`书籍解析成功: ${newBook.title}, ID: ${newBook.id}, 章节数: ${newBook.chapters.length}`);

      // 读取文件内容用于上传
      let fileContent: string;
      const isEpub = file.name.endsWith('.epub') || file.type === 'application/epub+zip';

      if (isEpub) {
        // EPUB 文件：读取为 ArrayBuffer，然后转换为 Base64
        console.log('读取 EPUB 文件为二进制...');
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileContent = btoa(binary);
        console.log(`EPUB 文件已转换为 Base64，原始大小: ${arrayBuffer.byteLength} 字节, Base64 大小: ${fileContent.length} 字符`);
      } else {
        // TXT 文件：直接读取为文本
        console.log('读取 TXT 文件为文本...');
        fileContent = await file.text();
        console.log(`TXT 文件读取完成，大小: ${fileContent.length} 字符`);
      }

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

      // 标记书籍元数据为脏数据
      syncDirtyFlags.set('booksMeta');
    } catch (err: any) {
      console.error("Parsing error:", err);
      setErrorMsg(err.message || "解析文件失败");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-800 relative">

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
        <div className="absolute top-16 right-4 z-50 bg-blue-100 text-blue-700 px-2 py-1 rounded shadow border border-blue-200 w-auto">
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} />
            <span className="font-medium text-sm">
              正在同步
              {syncProgress ? `: ${syncProgress.message} (${syncProgress.currentStepIndex}/${syncProgress.totalSteps})` : ''}
            </span>
          </div>
        </div>
      )}
      {syncStatus === 'success' && (
        <div className="absolute top-16 right-4 z-50 bg-green-100 text-green-700 px-2 py-1 rounded shadow border border-green-200 text-sm">
          同步成功
        </div>
      )}
      {syncStatus === 'error' && syncError && (
        <div className="absolute top-16 right-4 z-50 bg-red-100 text-red-700 px-2 py-1 rounded shadow border border-red-200 text-sm">
          同步失败: {syncError}
        </div>
      )}

      {/* 下载书籍提示 */}
      {downloadingBook && (
        <div className="absolute top-16 right-4 z-50 bg-purple-100 text-purple-700 px-2 py-1 rounded shadow border border-purple-200 flex items-center gap-2">
          <Loader2 className="animate-spin" size={14} />
          <span className="text-sm">正在下载: {downloadingBook}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeBookId && activeBook ? (
          <Reader
            chapter={currentChapter}
            bookId={activeBook.id}
            bookTitle={activeBook.title}
            chapterIndex={currentChapterIndex >= 0 ? currentChapterIndex : 0}
            onSaveProgress={handleSaveProgress}
            initialParagraphIndex={initialParagraphIndex}
            books={books}
            chapters={currentBookChapters}
            activeChapterId={activeChapterId}
            onSelectBook={handleSelectBook}
            onSelectChapter={handleSelectChapter}
            onAddBook={handleAddBook}
            onDeleteBook={handleDeleteBook}
            syncStatus={syncStatus}
            syncProgress={syncProgress}
            onManualSync={manualSync}
            isWebDAVConfigured={isConfigured}
          />
        ) : (
          <Reader
            chapter={currentChapter}
            bookId={''}
            bookTitle={''}
            chapterIndex={0}
            onSaveProgress={handleSaveProgress}
            initialParagraphIndex={0}
            books={books}
            chapters={[]}
            activeChapterId={''}
            onSelectBook={handleSelectBook}
            onSelectChapter={handleSelectChapter}
            onAddBook={handleAddBook}
            onDeleteBook={handleDeleteBook}
            syncStatus={syncStatus}
            syncProgress={syncProgress}
            onManualSync={manualSync}
            isWebDAVConfigured={isConfigured}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WordProvider>
        <AppContent />
      </WordProvider>
    </ThemeProvider>
  );
}

export default App;
