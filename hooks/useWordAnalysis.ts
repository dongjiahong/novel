import { useState, useEffect } from 'react';
import { normalizeWord, lookupWord, wordsMatch } from '../services/dictionaryService';
import { NewWord } from '../types';

export interface WordAnalysisResult {
  words: { word: string; isNewWord: boolean; index: number }[];
  newWordIndices: number[];
  totalNewWords: number;
}

export const useWordAnalysis = (
  content: string,
  checkIsKnown: (word: string) => boolean,
  newWords: NewWord[],
  dictionarySize: 'small' | 'large'
) => {
  const [wordAnalysis, setWordAnalysis] = useState<WordAnalysisResult>({
    words: [],
    newWordIndices: [],
    totalNewWords: 0
  });

  useEffect(() => {
    let cancelled = false;

    const analyzeWords = async () => {
      const words: { word: string; isNewWord: boolean; index: number }[] = [];
      let wordIndex = 0;
      const newWordIndices: number[] = [];
      // const newWordsFoundInList = new Set<string>(); // unused?

      // 简单的单词提取（与 processText 逻辑一致）
      const paragraphs = content.split('\n');

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
              // if (inNewWordsList && cleanWord) {
              //   newWordsFoundInList.add(cleanWord);
              // }
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
  }, [content, checkIsKnown, newWords, dictionarySize]);

  return wordAnalysis;
};
