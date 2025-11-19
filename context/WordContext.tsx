import React, { createContext, useContext, useState, useEffect } from 'react';
import { Dictionary, DictionaryEntry } from '../types';
import { loadDictionary } from '../services/dictionaryService';

interface WordContextType {
  dictionary: Dictionary;
  isDictLoading: boolean;
  knownWords: Set<string>;
  markAsKnown: (word: string) => void;
  checkIsKnown: (word: string) => boolean;
  
  // Modal Interaction
  interactingWord: { word: string; entry: DictionaryEntry } | null;
  setInteractingWord: (data: { word: string; entry: DictionaryEntry } | null) => void;
}

const WordContext = createContext<WordContextType | undefined>(undefined);

export const WordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dictionary, setDictionary] = useState<Dictionary>({});
  const [isDictLoading, setIsDictLoading] = useState(true);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [interactingWord, setInteractingWord] = useState<{ word: string; entry: DictionaryEntry } | null>(null);

  // Load Dictionary on Mount
  useEffect(() => {
    const load = async () => {
      setIsDictLoading(true);
      const dict = await loadDictionary();
      setDictionary(dict);
      setIsDictLoading(false);
    };
    load();
  }, []);

  // Load Known Words from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('known_words');
      if (stored) {
        setKnownWords(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error("Failed to load known words", e);
    }
  }, []);

  const markAsKnown = (word: string) => {
    const lower = word.toLowerCase();
    setKnownWords(prev => {
      const next = new Set(prev);
      next.add(lower);
      localStorage.setItem('known_words', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const checkIsKnown = (word: string) => {
    const lower = word.toLowerCase();
    // Check exact or singular forms basic check
    if (knownWords.has(lower)) return true;
    if (lower.endsWith('s') && knownWords.has(lower.slice(0, -1))) return true;
    return false;
  };

  return (
    <WordContext.Provider value={{ 
      dictionary, 
      isDictLoading, 
      knownWords, 
      markAsKnown, 
      checkIsKnown,
      interactingWord,
      setInteractingWord
    }}>
      {children}
    </WordContext.Provider>
  );
};

export const useWordContext = () => {
  const context = useContext(WordContext);
  if (!context) {
    throw new Error('useWordContext must be used within a WordProvider');
  }
  return context;
};
