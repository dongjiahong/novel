import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chapter, Book, SyncStatus } from '../types';
import { AnnotatedWord } from './AnnotatedWord';
import { useWordContext } from '../context/WordContext';
import { lookupWord, normalizeWord, wordsMatch } from '../services/dictionaryService';
import { ChevronLeft, ChevronRight, Settings, RefreshCw, BookOpen, List, Plus, Trash2 } from 'lucide-react';
import SettingsModal from './Settings';
import Sidebar from './Sidebar';

interface ReaderProps {
  chapter: Chapter;
  bookId: string;
  bookTitle: string;
  chapterIndex: number;
  onSaveProgress: (chapterIndex: number, pageIndex: number) => void;
  initialPage?: number;
  books: Book[];
  chapters: Chapter[];
  activeChapterId: string;
  onSelectBook: (id: string) => void;
  onSelectChapter: (id: string) => void;
  onAddBook: (file: File) => void;
  onDeleteBook: (id: string) => void;
  syncStatus?: SyncStatus;
  onManualSync?: () => Promise<boolean>;
  isWebDAVConfigured?: boolean;
}

const BATCH_SIZE = 500; // 每批标注500个生词
const HEADER_HEIGHT = 50; // 顶部标题栏高度
const FOOTER_HEIGHT = 72; // 底部翻页按钮高度
const CONTENT_PADDING = 96; // 内容区域上下padding总和
const MOBILE_TOP_BAR_HEIGHT = 48; // 移动端顶部栏高度

const Reader: React.FC<ReaderProps> = ({
  chapter,
  bookId,
  bookTitle,
  chapterIndex,
  onSaveProgress,
  initialPage = 0,
  books,
  chapters,
  activeChapterId,
  onSelectBook,
  onSelectChapter,
  onAddBook,
  onDeleteBook,
  syncStatus,
  onManualSync,
  isWebDAVConfigured
}) => {
  const { checkIsKnown, newWords, dictionarySize } = useWordContext();
  const [annotatedNewWordsCount, setAnnotatedNewWordsCount] = useState(BATCH_SIZE);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageRanges, setPageRanges] = useState<{ start: number; end: number }[]>([{ start: 0, end: 0 }]);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBookMenu, setShowBookMenu] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理同步点击
  const handleSyncClick = () => {
    if (!isWebDAVConfigured) {
      alert('请先在设置中配置 WebDAV 服务器信息');
      setShowSettings(true);
    } else if (onManualSync) {
      onManualSync();
    }
  };

  // 处理文件上传
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAddBook(file);
      setShowBookMenu(false);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 词汇分析结果状态
  const [wordAnalysis, setWordAnalysis] = useState<{
    words: { word: string; isNewWord: boolean; index: number }[];
    newWordIndices: number[];
    totalNewWords: number;
  }>({ words: [], newWordIndices: [], totalNewWords: 0 });

  // 异步提取章节中的所有单词并标记生词位置
  useEffect(() => {
    let cancelled = false;

    const analyzeWords = async () => {
      const words: { word: string; isNewWord: boolean; index: number }[] = [];
      let wordIndex = 0;
      const newWordIndices: number[] = [];
      const newWordsFoundInList = new Set<string>();

      // 简单的单词提取（与 processText 逻辑一致）
      const paragraphs = chapter.content.split('\n');

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;
        if (paragraph.trim().startsWith('#') || paragraph.trim().startsWith('**')) continue;

        const tokens = paragraph.split(/([a-zA-Z''-]+)/g);

        for (const token of tokens) {
          if (/[a-zA-Z]/.test(token)) {
            const cleanWord = normalizeWord(token);
            const isKnown = cleanWord ? checkIsKnown(cleanWord) : true;
            const useLarge = dictionarySize === 'large';
            const entry = cleanWord ? await lookupWord(cleanWord, useLarge) : null;
            const hasEntry = entry !== null;

            // 检查是否在生词表中（使用词形匹配）
            let inNewWordsList = false;
            if (cleanWord) {
              for (const nw of newWords) {
                if (await wordsMatch(cleanWord, nw.word)) {
                  inNewWordsList = true;
                  break;
                }
              }
            }

            // 如果单词在生词表中，或者是未掌握且词典中有的单词，则标记为生词
            const isNewWord = (inNewWordsList || !isKnown) && hasEntry;

            words.push({ word: token, isNewWord, index: wordIndex });

            if (isNewWord) {
              newWordIndices.push(wordIndex);
              if (inNewWordsList && cleanWord) {
                newWordsFoundInList.add(cleanWord);
              }
            }

            wordIndex++;
          }
        }
      }

      if (!cancelled) {
        setWordAnalysis({ words, newWordIndices, totalNewWords: newWordIndices.length });
      }
    };

    analyzeWords();

    return () => {
      cancelled = true;
    };
  }, [chapter.content, checkIsKnown, newWords, dictionarySize]);

  // 创建一个 Set 来快速查找哪些单词应该被标注
  const [shouldAnnotateSet, setShouldAnnotateSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const buildAnnotateSet = async () => {
      const set = new Set<number>();

      // 1. 标注前 annotatedNewWordsCount 个生词
      const batchCount = Math.min(annotatedNewWordsCount, wordAnalysis.newWordIndices.length);
      for (let i = 0; i < batchCount; i++) {
        set.add(wordAnalysis.newWordIndices[i]);
      }

      // 2. 确保生词表中的所有单词都被标注（无论位置）
      for (let idx = 0; idx < wordAnalysis.words.length; idx++) {
        const w = wordAnalysis.words[idx];
        const cleanWord = normalizeWord(w.word);
        if (cleanWord) {
          for (const nw of newWords) {
            if (await wordsMatch(cleanWord, nw.word)) {
              set.add(idx);
              break;
            }
          }
        }
      }

      if (!cancelled) {
        setShouldAnnotateSet(set);
      }
    };

    buildAnnotateSet();

    return () => {
      cancelled = true;
    };
  }, [annotatedNewWordsCount, wordAnalysis.newWordIndices, wordAnalysis.words, newWords]);

  // 计算段落总数
  const paragraphs = useMemo(() => {
    return chapter.content.split('\n').filter(p => p.trim());
  }, [chapter.content]);

  // 根据实际内容高度动态计算分页
  useEffect(() => {
    const calculatePages = () => {
      if (!measureRef.current || paragraphs.length === 0) return;

      const windowHeight = window.innerHeight;
      const isMobile = window.innerWidth < 768; // md breakpoint
      const extraHeight = isMobile ? MOBILE_TOP_BAR_HEIGHT : 0;
      const availableHeight = windowHeight - HEADER_HEIGHT - FOOTER_HEIGHT - CONTENT_PADDING - extraHeight;

      // 测量每个段落的实际高度
      const paragraphElements = measureRef.current.children;
      const ranges: { start: number; end: number }[] = [];
      let currentHeight = 0;
      let pageStart = 0;

      for (let i = 0; i < paragraphElements.length; i++) {
        const element = paragraphElements[i] as HTMLElement;
        const elementHeight = element.offsetHeight;

        // 如果加上当前段落会超过可用高度，且当前页已有内容，则开始新页
        if (currentHeight + elementHeight > availableHeight && i > pageStart) {
          ranges.push({ start: pageStart, end: i });
          pageStart = i;
          currentHeight = elementHeight;
        } else {
          currentHeight += elementHeight;
        }
      }

      // 添加最后一页
      if (pageStart < paragraphs.length) {
        ranges.push({ start: pageStart, end: paragraphs.length });
      }

      setPageRanges(ranges.length > 0 ? ranges : [{ start: 0, end: paragraphs.length }]);
    };

    // 需要等待测量容器渲染完成
    const timer = setTimeout(calculatePages, 100);

    // 监听窗口大小变化
    window.addEventListener('resize', calculatePages);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePages);
    };
  }, [paragraphs]);

  // 重置页码和标注计数（章节切换时）
  useEffect(() => {
    setAnnotatedNewWordsCount(BATCH_SIZE);
    setCurrentPage(initialPage);
  }, [chapter.id, initialPage]);

  const totalPages = pageRanges.length;

  // 翻页函数
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      onSaveProgress(chapterIndex, newPage);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      onSaveProgress(chapterIndex, newPage);
    }
  };

  // 处理内容区域点击事件，实现点击左右两侧翻页
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 获取点击位置
    const clickX = e.clientX;
    const windowWidth = window.innerWidth;

    // 左侧 30% 区域：上一页
    if (clickX < windowWidth * 0.3) {
      goToPrevPage();
    }
    // 右侧 30% 区域：下一页
    else if (clickX > windowWidth * 0.7) {
      goToNextPage();
    }
    // 中间区域：不做处理，保留原有的单词点击功能
  };

  // 翻页时检查是否需要加载更多标注
  useEffect(() => {
    if (currentPage >= pageRanges.length) return;

    // 计算当前页最后一个单词的全局索引
    const currentRange = pageRanges[currentPage];
    const paragraphsUpToCurrentPage = paragraphs.slice(0, currentRange.end);
    let wordCount = 0;

    paragraphsUpToCurrentPage.forEach(paragraph => {
      // 跳过空行和标题（与 wordAnalysis 保持一致）
      if (!paragraph.trim()) return;
      if (paragraph.trim().startsWith('#') || paragraph.trim().startsWith('**')) return;

      const tokens = paragraph.split(/([a-zA-Z''-]+)/g);
      tokens.forEach(token => {
        if (/[a-zA-Z]/.test(token)) {
          wordCount++;
        }
      });
    });

    // 如果当前页的单词数超过已标注的数量，加载更多
    if (wordCount > annotatedNewWordsCount && annotatedNewWordsCount < wordAnalysis.totalNewWords) {
      setAnnotatedNewWordsCount(prev => Math.min(prev + BATCH_SIZE, wordAnalysis.totalNewWords));
    }
  }, [currentPage, paragraphs, pageRanges, annotatedNewWordsCount, wordAnalysis.totalNewWords]);

  // 处理文本：分词并渲染当前页的段落
  const processText = (paragraphsToRender: string[]) => {
    let globalWordIndex = 0;

    // 计算当前页之前的所有单词数（用于正确的单词索引）
    if (currentPage < pageRanges.length) {
      const currentRange = pageRanges[currentPage];
      const paragraphsBeforeCurrentPage = paragraphs.slice(0, currentRange.start);
      paragraphsBeforeCurrentPage.forEach(paragraph => {
        // 跳过空行和标题（与 wordAnalysis 保持一致）
        if (!paragraph.trim()) return;
        if (paragraph.trim().startsWith('#') || paragraph.trim().startsWith('**')) return;

        const tokens = paragraph.split(/([a-zA-Z''-]+)/g);
        tokens.forEach(token => {
          if (/[a-zA-Z]/.test(token)) {
            globalWordIndex++;
          }
        });
      });
    }

    return paragraphsToRender.map((paragraph, pIndex) => {
      if (!paragraph.trim()) return <div key={pIndex} className="h-6" />;

      // 标题检测
      if (paragraph.trim().startsWith('# ')) {
        return (
          <h1 key={pIndex} className="text-2xl font-bold text-gray-800 mb-6 mt-4">
            {paragraph.replace('# ', '')}
          </h1>
        );
      }
      if (paragraph.trim().startsWith('**')) {
        return (
          <h2 key={pIndex} className="text-lg font-bold text-gray-700 mb-4 mt-4">
            {paragraph.replace(/\*\*/g, '')}
          </h2>
        );
      }

      // 分词
      const tokens = paragraph.split(/([a-zA-Z''-]+)/g);

      return (
        <p key={pIndex} className="mb-3 leading-[3rem] text-lg text-gray-700 font-serif text-justify">
          {tokens.map((token, tIndex) => {
            if (!token) return null;

            // 如果是单词
            if (/[a-zA-Z]/.test(token)) {
              const currentWordIndex = globalWordIndex;
              globalWordIndex++;

              const shouldAnnotate = shouldAnnotateSet.has(currentWordIndex);

              return (
                <AnnotatedWord
                  key={`${pIndex}-${tIndex}`}
                  word={token}
                  original={token}
                  shouldAnnotate={shouldAnnotate}
                  paragraph={paragraph}
                />
              );
            }

            // 标点和空格
            return <span key={`${pIndex}-${tIndex}`}>{token}</span>;
          })}
        </p>
      );
    });
  };

  // 获取当前页的段落
  const currentPageParagraphs = useMemo(() => {
    if (currentPage >= pageRanges.length) return [];
    const range = pageRanges[currentPage];
    return paragraphs.slice(range.start, range.end);
  }, [paragraphs, currentPage, pageRanges]);


  // 渲染用于测量的段落（简化版，不包含单词标注）
  const renderMeasureParagraph = (paragraph: string, index: number) => {
    if (!paragraph.trim()) return <div key={index} className="h-6" />;

    if (paragraph.trim().startsWith('# ')) {
      return (
        <h1 key={index} className="text-2xl font-bold text-gray-800 mb-6 mt-4">
          {paragraph.replace('# ', '')}
        </h1>
      );
    }
    if (paragraph.trim().startsWith('**')) {
      return (
        <h2 key={index} className="text-lg font-bold text-gray-700 mb-4 mt-4">
          {paragraph.replace(/\*\*/g, '')}
        </h2>
      );
    }

    return (
      <p key={index} className="mb-3 leading-[3rem] text-lg text-gray-700 font-serif text-justify">
        {paragraph}
      </p>
    );
  };

  // 检查是否有活动书籍
  const hasActiveBook = bookId && bookId !== '';

  return (
    <div ref={contentRef} className="flex-1 h-full overflow-hidden bg-white relative flex">
      {/* 桌面端侧边栏 - 只在 md 以上屏幕显示 */}
      <div className="hidden md:flex h-full">
        <Sidebar
          books={books}
          activeBookId={bookId}
          activeChapterId={activeChapterId}
          chapters={chapters}
          onSelectBook={onSelectBook}
          onSelectChapter={onSelectChapter}
          onAddBook={onAddBook}
          onDeleteBook={onDeleteBook}
          syncStatus={syncStatus}
          onManualSync={onManualSync}
          isWebDAVConfigured={isWebDAVConfigured}
        />
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 h-full overflow-hidden bg-white relative flex flex-col">
        {/* 隐藏的测量容器 */}
        <div
          ref={measureRef}
          className="fixed top-0 left-0 invisible pointer-events-none max-w-3xl px-8"
          style={{ width: 'calc(100vw - 16rem)' }}
          aria-hidden="true"
        >
          {paragraphs.map((p, i) => renderMeasureParagraph(p, i))}
        </div>

        {/* 顶部标题栏 - 移动端显示下拉菜单，桌面端只显示信息和操作按钮 */}
        {hasActiveBook && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center shadow-sm flex-shrink-0">
          {/* 移动端：图书选择按钮 - 只在 md 以下屏幕显示 */}
          <div className="relative md:hidden">
          <button
            onClick={() => setShowBookMenu(!showBookMenu)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="选择图书"
          >
            <BookOpen size={16} />
            <span className="hidden sm:inline max-w-[150px] truncate">{bookTitle}</span>
          </button>

          {/* 图书菜单 */}
          {showBookMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowBookMenu(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="p-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <Plus size={16} />
                    <span>添加图书</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".epub,.pdf,.txt"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="border-t border-gray-200">
                  {books.map(book => (
                    <div
                      key={book.id}
                      className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                        bookId === book.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span
                        onClick={() => {
                          onSelectBook(book.id);
                          setShowBookMenu(false);
                        }}
                        className={`flex-1 text-sm truncate ${
                          bookId === book.id ? 'text-blue-600 font-medium' : 'text-gray-700'
                        }`}
                        title={book.title}
                      >
                        {book.title}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('确认删除这本书吗？')) {
                            onDeleteBook(book.id);
                            setShowBookMenu(false);
                          }
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除图书"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          </div>

          {/* 移动端：章节选择按钮 - 只在 md 以下屏幕显示 */}
          <div className="relative ml-2 md:hidden">
          <button
            onClick={() => setShowChapterMenu(!showChapterMenu)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="选择章节"
          >
            <List size={16} />
            <span className="hidden md:inline max-w-[200px] truncate">{chapter.title}</span>
          </button>

          {/* 章节菜单 */}
          {showChapterMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowChapterMenu(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                {chapters.map(ch => (
                  <div
                    key={ch.id}
                    onClick={() => {
                      onSelectChapter(ch.id);
                      setShowChapterMenu(false);
                    }}
                    className={`px-4 py-2 cursor-pointer text-sm hover:bg-gray-50 ${
                      activeChapterId === ch.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                    title={ch.title}
                  >
                    {ch.title}
                  </div>
                ))}
              </div>
            </>
          )}
          </div>

          {/* 桌面端：当前书籍和章节标题 - 只在 md 以上屏幕显示 */}
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            <BookOpen size={16} className="text-gray-400" />
            <span className="font-medium max-w-[200px] truncate">{bookTitle}</span>
            <span className="text-gray-400">/</span>
            <span className="max-w-[250px] truncate">{chapter.title}</span>
          </div>

          {/* 生词统计 */}
          {wordAnalysis.totalNewWords > 0 && (
            <span className="ml-2 text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded hidden lg:inline">
              {Math.min(annotatedNewWordsCount, wordAnalysis.totalNewWords)} /{' '}
              {wordAnalysis.totalNewWords} 生词
            </span>
          )}

          {/* 页码显示 */}
          <span className="ml-auto text-xs text-gray-400 mr-2">
            {currentPage + 1}/{totalPages}
          </span>

          {/* 右侧：同步和设置按钮 - 只在移动端显示，桌面端在侧边栏 */}
          <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={handleSyncClick}
            className={`p-2 transition-colors rounded-md ${
              syncStatus === 'syncing'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="同步"
            disabled={syncStatus === 'syncing'}
          >
            <RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="设置"
          >
            <Settings size={18} />
          </button>
          </div>
        </div>
        )}

        {/* 移动端：无书籍时的顶部栏 */}
        {!hasActiveBook && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm flex-shrink-0 md:hidden">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-gray-400" />
            <span className="text-sm text-gray-600 font-medium">E-Book Lingo Reader</span>
          </div>

          <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="添加图书"
          >
            <Plus size={18} />
          </button>

          <button
            onClick={handleSyncClick}
            className={`p-2 transition-colors rounded-md ${
              syncStatus === 'syncing'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="同步"
            disabled={syncStatus === 'syncing'}
          >
            <RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="设置"
          >
            <Settings size={18} />
          </button>
          </div>
        </div>
        )}

        {/* Settings Modal - 只在移动端使用 */}
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            syncStatus={syncStatus}
            onManualSync={onManualSync}
          />
        )}

        {/* 内容区域 */}
        {hasActiveBook ? (
        <>
        <div className="flex-1 overflow-hidden cursor-pointer" onClick={handleContentClick}>
          <div className="max-w-3xl mx-auto px-8 py-12 h-full pointer-events-none">
            <div className="pointer-events-auto">
              {processText(currentPageParagraphs)}
            </div>
          </div>
        </div>

        {/* 翻页按钮 */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentPage === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft size={20} />
            <span>上一页</span>
          </button>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages - 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentPage >= totalPages - 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>下一页</span>
            <ChevronRight size={20} />
          </button>
        </div>
        </>
        ) : (
        /* 无书籍时的欢迎页面 */
        <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4 px-4">
          <BookOpen size={64} className="text-gray-300" />
          <p className="text-lg text-gray-500 text-center">欢迎使用 E-Book Lingo Reader</p>
          <p className="text-sm text-gray-400 text-center max-w-md">
            点击左侧侧边栏的 <Plus size={14} className="inline" /> 按钮上传 EPUB 或 TXT 文件开始阅读，或使用 <RefreshCw size={14} className="inline" /> 按钮从 WebDAV 同步书籍
          </p>
          {/* 移动端提示 */}
          <p className="text-sm text-gray-400 text-center max-w-md md:hidden">
            点击右上角的 <Plus size={14} className="inline" /> 按钮上传图书，或使用 <RefreshCw size={14} className="inline" /> 按钮同步书籍
          </p>
        </div>
        )}
      </div>
    </div>
  );
};

export default Reader;
