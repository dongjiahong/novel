import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chapter } from '../types';
import { AnnotatedWord } from './AnnotatedWord';
import { useWordContext } from '../context/WordContext';
import { lookupWord, normalizeWord } from '../services/dictionaryService';

interface ReaderProps {
  chapter: Chapter;
}

const BATCH_SIZE = 500; // 每批标注500个生词

const Reader: React.FC<ReaderProps> = ({ chapter }) => {
  const { checkIsKnown } = useWordContext();
  const [annotatedNewWordsCount, setAnnotatedNewWordsCount] = useState(BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 提取章节中的所有单词并标记生词位置
  const wordAnalysis = useMemo(() => {
    const words: { word: string; isNewWord: boolean; index: number }[] = [];
    let wordIndex = 0;
    const newWordIndices: number[] = [];

    // 简单的单词提取（与 processText 逻辑一致）
    const paragraphs = chapter.content.split('\n');
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      if (paragraph.trim().startsWith('#') || paragraph.trim().startsWith('**')) return;

      const tokens = paragraph.split(/([a-zA-Z''-]+)/g);
      tokens.forEach(token => {
        if (/[a-zA-Z]/.test(token)) {
          const cleanWord = normalizeWord(token);
          const isKnown = cleanWord ? checkIsKnown(cleanWord) : true;
          const hasEntry = cleanWord ? lookupWord(cleanWord) !== null : false;

          const isNewWord = !isKnown && hasEntry;

          words.push({ word: token, isNewWord, index: wordIndex });

          if (isNewWord) {
            newWordIndices.push(wordIndex);
          }

          wordIndex++;
        }
      });
    });

    return { words, newWordIndices, totalNewWords: newWordIndices.length };
  }, [chapter.content, checkIsKnown]);

  // 创建一个 Set 来快速查找哪些单词应该被标注
  const shouldAnnotateSet = useMemo(() => {
    const set = new Set<number>();
    // 只标注前 annotatedNewWordsCount 个生词
    for (let i = 0; i < Math.min(annotatedNewWordsCount, wordAnalysis.newWordIndices.length); i++) {
      set.add(wordAnalysis.newWordIndices[i]);
    }
    return set;
  }, [annotatedNewWordsCount, wordAnalysis.newWordIndices]);

  // 重置滚动位置和标注计数（章节切换时）
  useEffect(() => {
    setAnnotatedNewWordsCount(BATCH_SIZE);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [chapter.id]);

  // 设置 Intersection Observer 来监听滚动
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // 当底部元素进入视野时，加载更多标注
          setAnnotatedNewWordsCount(prev => {
            const next = prev + BATCH_SIZE;
            if (next > prev) {
              console.log(`📝 加载更多标注: ${prev} → ${Math.min(next, wordAnalysis.totalNewWords)}`);
            }
            return next;
          });
        }
      },
      {
        root: contentRef.current,
        rootMargin: '200px', // 提前200px触发加载
        threshold: 0.1
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [wordAnalysis.totalNewWords]);

  // 处理文本：分词并渲染
  const processText = (text: string) => {
    let globalWordIndex = 0;

    return text.split('\n').map((paragraph, pIndex) => {
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

  return (
    <div ref={contentRef} className="flex-1 h-full overflow-y-auto bg-white relative">
      {/* 顶部标题栏 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-2 flex items-center shadow-sm">
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

        <button className="ml-auto text-gray-400 hover:text-gray-600">
          <span className="text-xl">×</span>
        </button>
      </div>

      {/* 内容区域 */}
      <div className="max-w-3xl mx-auto px-8 py-12 pb-32">
        {processText(chapter.content)}

        {/* 加载更多触发器 */}
        {annotatedNewWordsCount < wordAnalysis.totalNewWords && (
          <div ref={loadMoreRef} className="h-10 flex items-center justify-center text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
              加载更多标注...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reader;
