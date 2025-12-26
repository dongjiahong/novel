import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDrag } from '@use-gesture/react';
import { Chapter, Book, SyncStatus, SyncProgress } from '../types';
import { AnnotatedWord } from './AnnotatedWord';
import { useWordContext } from '../context/WordContext';
import { normalizeWord, wordsMatch } from '../services/dictionaryService';
import { Settings, RefreshCw, BookOpen, List, Plus, Trash2, GraduationCap, Palette } from 'lucide-react';
import SettingsModal from './Settings';
import Sidebar from './Sidebar';
import { VocabularyModal } from './VocabularyModal';
import { useTheme } from '../context/ThemeContext';
import { READING_THEMES } from '../constants';
import { ReadingTheme } from '../types';
import { ThemeSwatch } from './ThemeSwatch';
import { useReadingStatsTracker } from '../hooks/useReadingStatsTracker';
import { useWordAnalysis } from '../hooks/useWordAnalysis';
import { usePagination } from '../hooks/usePagination';

interface ReaderProps {
  chapter: Chapter;
  bookId: string;
  bookTitle: string;
  chapterIndex: number;
  onSaveProgress: (chapterIndex: number, paragraphIndex: number) => void;
  initialParagraphIndex?: number;
  books: Book[];
  chapters: Chapter[];
  activeChapterId: string;
  onSelectBook: (id: string) => void;
  onSelectChapter: (id: string) => void;
  onAddBook: (file: File) => void;
  onDeleteBook: (id: string) => void;
  syncStatus?: SyncStatus;
  syncProgress?: SyncProgress | null;
  onManualSync?: () => Promise<boolean>;
  isWebDAVConfigured?: boolean;
}

const BATCH_SIZE = 500; // 每批标注500个生词

const Reader: React.FC<ReaderProps> = ({
  chapter,
  bookId,
  bookTitle,
  chapterIndex,
  onSaveProgress,
  initialParagraphIndex = 0,
  books,
  chapters,
  activeChapterId,
  onSelectBook,
  onSelectChapter,
  onAddBook,
  onDeleteBook,
  syncStatus,
  syncProgress,
  onManualSync,
  isWebDAVConfigured
}) => {
  const { checkIsKnown, newWords, dictionarySize } = useWordContext();
  const { readingTheme, setReadingTheme } = useTheme();
  const currentTheme = READING_THEMES[readingTheme];
  
  // 检查是否有活动书籍
  const hasActiveBook = bookId && bookId !== '';

  // 启用阅读时长统计
  useReadingStatsTracker(hasActiveBook);
  
  const [annotatedNewWordsCount, setAnnotatedNewWordsCount] = useState(BATCH_SIZE);
  const [currentPage, setCurrentPage] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBookMenu, setShowBookMenu] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 计算未学习单词数量
  const unstudiedCount = newWords.filter(w => !w.lastReviewedAt).length;

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

  // 词汇分析
  const wordAnalysis = useWordAnalysis(chapter.content, checkIsKnown, newWords, dictionarySize);

  // 创建一个 Set 来快速查找哪些单词应该被标注
  const [shouldAnnotateSet, setShouldAnnotateSet] = useState<Set<number>>(new Set());
  const appliedInitialPageRef = useRef<{ chapterId: string; paragraphIndex: number } | null>(null);

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
  const { pageRanges } = usePagination(paragraphs, measureRef);


  // 根据段落索引计算并设置初始页码
  useEffect(() => {
    const hasValidRanges = pageRanges.length > 0 && !(pageRanges.length === 1 && pageRanges[0].start === 0 && pageRanges[0].end === 0);
    if (!hasValidRanges) return;

    const alreadyApplied = appliedInitialPageRef.current
      && appliedInitialPageRef.current.chapterId === chapter.id
      && appliedInitialPageRef.current.paragraphIndex === initialParagraphIndex;
    if (alreadyApplied) return;

    // 将段落索引夹在可用范围内，避免越界导致回到第一页
    const lastRange = pageRanges[pageRanges.length - 1];
    const maxParagraphIndex = Math.max(0, lastRange.end - 1);
    const clampedParagraphIndex = Math.min(Math.max(initialParagraphIndex, 0), maxParagraphIndex);

    const pageIndex = pageRanges.findIndex(
      range => clampedParagraphIndex >= range.start && clampedParagraphIndex < range.end
    );

    if (pageIndex !== -1) {
      setCurrentPage(pageIndex);
      appliedInitialPageRef.current = { chapterId: chapter.id, paragraphIndex: initialParagraphIndex };
    }
  }, [pageRanges, initialParagraphIndex, chapter.id]);

  // 当章节变化时重置初始页应用状态
  useEffect(() => {
    appliedInitialPageRef.current = null;
  }, [chapter.id]);

  // 重置标注计数（章节切换时）
  useEffect(() => {
    setAnnotatedNewWordsCount(BATCH_SIZE);
  }, [chapter.id]);

  const totalPages = pageRanges.length;

  // 翻页函数
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      // 保存段落索引（当前页的第一个段落）
      const paragraphIndex = pageRanges[newPage]?.start ?? 0;
      onSaveProgress(chapterIndex, paragraphIndex);
      // 滚动到顶部
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // 已经在最后一页，尝试跳到下一章
      const currentChapterIndex = chapters.findIndex(ch => ch.id === activeChapterId);
      if (currentChapterIndex !== -1 && currentChapterIndex < chapters.length - 1) {
        // 跳到下一章
        const nextChapter = chapters[currentChapterIndex + 1];
        onSelectChapter(nextChapter.id);
      }
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      // 保存段落索引（当前页的第一个段落）
      const paragraphIndex = pageRanges[newPage]?.start ?? 0;
      onSaveProgress(chapterIndex, paragraphIndex);
      // 滚动到顶部
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 处理内容区域点击事件，实现点击左右两侧翻页（仅PC端）
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 只在PC端处理点击翻页
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

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

  // 使用 useDrag hook 来处理移动端滑动翻页
  const bind = useDrag(
    ({ swipe: [swipeX], tap, event }) => {
      // 如果是点击事件，或者点击的目标是交互式元素（如单词弹窗），则不执行翻页
      if (
        tap ||
        (event?.target &&
          (event.target as HTMLElement).closest(
            'a, button, [data-interactive="true"]'
          ))
      ) {
        return;
      }

      // 根据滑动方向调用翻页函数
      if (swipeX === -1) { // 向左滑动 (swipe left) -> 下一页
        goToNextPage();
      } else if (swipeX === 1) { // 向右滑动 (swipe right) -> 上一页
        goToPrevPage();
      }
    },
    {
      axis: 'x', // 只在 x 轴方向触发
      swipe: {
        velocity: 0.2, // 滑动速度阈值
        distance: 30,  // 滑动距离阈值
      },
      filterTaps: true, // 过滤掉点击事件
      eventOptions: { passive: false }, // 允许阻止默认事件（如果需要）
    }
  );


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
          <h1 key={pIndex} className="text-2xl font-bold mb-8 mt-4" style={{ color: currentTheme.text }}>
            {paragraph.replace('# ', '')}
          </h1>
        );
      }
      if (paragraph.trim().startsWith('**')) {
        return (
          <h2 key={pIndex} className="text-lg font-bold mb-6 mt-4" style={{ color: currentTheme.text }}>
            {paragraph.replace(/\*\*/g, '')}
          </h2>
        );
      }

      // 分词
      const tokens = paragraph.split(/([a-zA-Z''-]+)/g);

      return (
        <p key={pIndex} className="mb-6 leading-[2.75rem] tracking-wide text-lg font-serif text-justify" style={{ color: currentTheme.text }}>
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
        <h1 key={index} className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-8 mt-4">
          {paragraph.replace('# ', '')}
        </h1>
      );
    }
    if (paragraph.trim().startsWith('**')) {
      return (
        <h2 key={index} className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-6 mt-4">
          {paragraph.replace(/\*\*/g, '')}
        </h2>
      );
    }

    return (
      <p key={index} className="mb-6 leading-[2.75rem] tracking-wide text-lg text-gray-700 dark:text-gray-200 font-serif text-justify">
        {paragraph}
      </p>
    );
  };

  return (
    <div ref={contentRef} className="flex-1 h-full overflow-hidden bg-white dark:bg-gray-900 relative flex">
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
          syncProgress={syncProgress}
          onManualSync={onManualSync}
          isWebDAVConfigured={isWebDAVConfigured}
        />
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 h-full overflow-hidden relative flex flex-col" style={{ backgroundColor: currentTheme.background }}>
        {/* 隐藏的测量容器 */}
        <div
          ref={measureRef}
          className="fixed top-0 left-0 invisible pointer-events-none max-w-3xl px-8 py-12 w-full md:w-[calc(100vw-16rem)]"
          aria-hidden="true"
          style={{ backgroundColor: currentTheme.background, color: currentTheme.text }}
        >
          {paragraphs.map((p, i) => renderMeasureParagraph(p, i))}
        </div>

        {/* 顶部标题栏 - 移动端显示下拉菜单，桌面端只显示信息和操作按钮 */}
        {hasActiveBook && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center shadow-sm flex-shrink-0">
            {/* 移动端：图书选择按钮 - 只在 md 以下屏幕显示 */}
            <div className="relative md:hidden">
              <button
                onClick={() => setShowBookMenu(!showBookMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
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
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md transition-colors"
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
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      {books.map(book => (
                        <div
                          key={book.id}
                          className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${bookId === book.id ? 'bg-blue-50 dark:bg-gray-700' : ''
                            }`}
                        >
                          <span
                            onClick={() => {
                              onSelectBook(book.id);
                              setShowBookMenu(false);
                            }}
                            className={`flex-1 text-sm truncate ${bookId === book.id ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
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
                            className="ml-2 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="选择章节"
              >
                <List size={16} />
                <span className="hidden sm:inline max-w-[150px] truncate">{chapter.title}</span>
              </button>

              {/* 章节菜单 */}
              {showChapterMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowChapterMenu(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    {chapters.map(ch => (
                      <div
                        key={ch.id}
                        onClick={() => {
                          onSelectChapter(ch.id);
                          setShowChapterMenu(false);
                        }}
                        className={`px-4 py-2 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${activeChapterId === ch.id ? 'bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
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

            {/* 移动端：主题选择按钮 - 只在 md 以下屏幕显示 */}
            <div className="relative ml-2 md:hidden">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="选择主题"
              >
                <Palette size={16} />
              </button>

              {/* 主题菜单 */}
              {showThemeMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowThemeMenu(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 p-3 flex gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    {(['light', 'dark', 'solarized-light', 'solarized-dark'] as ReadingTheme[]).map((t) => (
                      <ThemeSwatch
                        key={t}
                        theme={t}
                        isActive={readingTheme === t}
                        onClick={(theme) => {
                          setReadingTheme(theme);
                          setShowThemeMenu(false);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 桌面端：当前书籍和章节标题 - 只在 md 以上屏幕显示 */}
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <BookOpen size={16} className="text-gray-400 dark:text-gray-500" />
              <span className="font-medium max-w-[200px] truncate">{bookTitle}</span>
              <span className="text-gray-400 dark:text-gray-500">/</span>
              <span className="max-w-[250px] truncate">{chapter.title}</span>
            </div>

            {/* 生词统计 */}
            {wordAnalysis.totalNewWords > 0 && (
              <span className="ml-2 text-xs text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded hidden lg:inline">
                {Math.min(annotatedNewWordsCount, wordAnalysis.totalNewWords)} /{' '}
                {wordAnalysis.totalNewWords} 生词
              </span>
            )}

            {/* 页码显示 */}
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 mr-2">
              {currentPage + 1}/{totalPages}
            </span>

            {/* 右侧：同步、生词本和设置按钮 - 只在移动端显示，桌面端在侧边栏 */}
            <div className="flex items-center gap-1 md:hidden">
              <button
                onClick={handleSyncClick}
                className={`p-2 transition-colors rounded-md ${syncStatus === 'syncing'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                title="同步"
                disabled={syncStatus === 'syncing'}
              >
                <RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => setShowVocabulary(true)}
                className="relative p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                title="生词本"
              >
                <GraduationCap size={18} />
                {unstudiedCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                    {unstudiedCount > 99 ? '99' : unstudiedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="设置"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        )}

        {/* 移动端：无书籍时的顶部栏 */}
        {!hasActiveBook && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between shadow-sm flex-shrink-0 md:hidden">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Logo" className="w-6 h-6" />
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">E-Book Lingo Reader</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="添加图书"
              >
                <Plus size={18} />
              </button>

              <button
                onClick={handleSyncClick}
                className={`p-2 transition-colors rounded-md ${syncStatus === 'syncing'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                title="同步"
                disabled={syncStatus === 'syncing'}
              >
                <RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
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

        {/* Vocabulary Modal */}
        <VocabularyModal
          isOpen={showVocabulary}
          onClose={() => setShowVocabulary(false)}
        />

        {/* 内容区域 */}
        {hasActiveBook ? (
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto cursor-pointer"
            style={{ touchAction: 'none', backgroundColor: currentTheme.background }}
            onClick={handleContentClick}
            {...bind()}
          >
            <div className="max-w-3xl mx-auto px-8 py-12 min-h-full pointer-events-none">
              <div className="pointer-events-auto">
                {processText(currentPageParagraphs)}
              </div>
            </div>
          </div>
        ) : (
          /* 无书籍时的欢迎页面 */
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 flex-col gap-4 px-4" style={{ backgroundColor: currentTheme.background }}>
            <BookOpen size={64} className="text-gray-300 dark:text-gray-600" />
            <p className="text-lg text-gray-500 dark:text-gray-400 text-center">欢迎使用 E-Book Lingo Reader</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-md">
              点击左侧侧边栏的 <Plus size={14} className="inline" /> 按钮上传 EPUB 或 TXT 文件开始阅读，或使用 <RefreshCw size={14} className="inline" /> 按钮从 WebDAV 同步书籍
            </p>
            {/* 移动端提示 */}
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-md md:hidden">
              点击右上角的 <Plus size={14} className="inline" /> 按钮上传图书，或使用 <RefreshCw size={14} className="inline" /> 按钮同步书籍
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reader;
