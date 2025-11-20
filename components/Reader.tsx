import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chapter } from '../types';
import { AnnotatedWord } from './AnnotatedWord';
import { useWordContext } from '../context/WordContext';
import { lookupWord, normalizeWord, wordsMatch } from '../services/dictionaryService';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReaderProps {
  chapter: Chapter;
  bookId: string;
  bookTitle: string;
  chapterIndex: number;
  onSaveProgress: (chapterIndex: number, pageIndex: number) => void;
  initialPage?: number;
}

const BATCH_SIZE = 500; // 每批标注500个生词
const PARAGRAPH_HEIGHT = 140; // 每个段落的估计高度（像素）
const HEADER_HEIGHT = 50; // 顶部标题栏高度
const FOOTER_HEIGHT = 72; // 底部翻页按钮高度
const CONTENT_PADDING = 96; // 内容区域上下padding总和

const Reader: React.FC<ReaderProps> = ({ chapter, bookId, bookTitle, chapterIndex, onSaveProgress, initialPage = 0 }) => {
  const { checkIsKnown, newWords, dictionarySize } = useWordContext();
  const [annotatedNewWordsCount, setAnnotatedNewWordsCount] = useState(BATCH_SIZE);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [paragraphsPerPage, setParagraphsPerPage] = useState(8);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // 根据窗口高度动态计算每页段落数
  useEffect(() => {
    const calculateParagraphsPerPage = () => {
      const windowHeight = window.innerHeight;
      const availableHeight = windowHeight - HEADER_HEIGHT - FOOTER_HEIGHT - CONTENT_PADDING;
      const calculatedParagraphs = Math.max(3, Math.floor(availableHeight / PARAGRAPH_HEIGHT));
      setParagraphsPerPage(calculatedParagraphs);
    };

    // 初始计算
    calculateParagraphsPerPage();

    // 监听窗口大小变化
    window.addEventListener('resize', calculateParagraphsPerPage);
    return () => window.removeEventListener('resize', calculateParagraphsPerPage);
  }, []);

  // 重置页码和标注计数（章节切换时）
  useEffect(() => {
    setAnnotatedNewWordsCount(BATCH_SIZE);
    setCurrentPage(initialPage);
  }, [chapter.id, initialPage]);

  // 计算段落总数和总页数
  const paragraphs = useMemo(() => {
    return chapter.content.split('\n').filter(p => p.trim());
  }, [chapter.content]);

  const totalPages = Math.ceil(paragraphs.length / paragraphsPerPage);

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
    // 计算当前页最后一个单词的全局索引
    const paragraphsUpToCurrentPage = paragraphs.slice(0, (currentPage + 1) * paragraphsPerPage);
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
  }, [currentPage, paragraphs, paragraphsPerPage, annotatedNewWordsCount, wordAnalysis.totalNewWords]);

  // 处理文本：分词并渲染当前页的段落
  const processText = (paragraphsToRender: string[]) => {
    let globalWordIndex = 0;

    // 计算当前页之前的所有单词数（用于正确的单词索引）
    const paragraphsBeforeCurrentPage = paragraphs.slice(0, currentPage * paragraphsPerPage);
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
        <p key={pIndex} className="mb-8 leading-[3rem] text-lg text-gray-700 font-serif text-justify">
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
    const start = currentPage * paragraphsPerPage;
    const end = start + paragraphsPerPage;
    return paragraphs.slice(start, end);
  }, [paragraphs, currentPage, paragraphsPerPage]);


  return (
    <div ref={contentRef} className="flex-1 h-full overflow-hidden bg-white relative flex flex-col">
      {/* 顶部标题栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center shadow-sm flex-shrink-0">
        <span className="text-sm text-gray-500 flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          {chapter.title}
        </span>

        {/* 生词统计 */}
        {wordAnalysis.totalNewWords > 0 && (
          <span className="ml-4 text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded">
            {Math.min(annotatedNewWordsCount, wordAnalysis.totalNewWords)} /{' '}
            {wordAnalysis.totalNewWords} 生词已标注
          </span>
        )}

        {/* 页码显示 */}
        <span className="ml-auto text-xs text-gray-400">
          第 {currentPage + 1} / {totalPages} 页
        </span>
      </div>

      {/* 内容区域 */}
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
    </div>
  );
};

export default Reader;
