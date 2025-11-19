import { Dictionary, DictionaryEntry } from '../types';
import localDictionary from '../dicts/dictionary';

// Helper to normalize word for lookup (remove punctuation, lowercase)
export const normalizeWord = (word: string): string => {
  return word.replace(/^[^\w]+|[^\w]+$/g, ''); 
};

/**
 * Load dictionary directly from local file
 */
export const loadDictionary = async (): Promise<Dictionary> => {
  // Simulating async to match previous interface if needed, 
  // but technically the import is synchronous.
  console.log('Local dictionary loaded, keys:', Object.keys(localDictionary).length);
  return localDictionary as Dictionary;
};

export const lookupWordInDict = (dictionary: Dictionary, rawWord: string): DictionaryEntry | null => {
  if (!dictionary || Object.keys(dictionary).length === 0) return null;

  // 1. Try exact match
  if (dictionary[rawWord]) return dictionary[rawWord];

  // 2. Try normalized
  const clean = normalizeWord(rawWord);
  if (!clean) return null;
  if (dictionary[clean]) return dictionary[clean];

  // 3. Try lowercase
  const lower = clean.toLowerCase();
  if (dictionary[lower]) return dictionary[lower];
  
  // 4. Try singular (basic heuristic)
  if (lower.endsWith('s') && dictionary[lower.slice(0, -1)]) {
      return dictionary[lower.slice(0, -1)];
  }
  if (lower.endsWith('es') && dictionary[lower.slice(0, -2)]) {
      return dictionary[lower.slice(0, -2)];
  }
  
  // 5. Try past tense / participles
  if (lower.endsWith('ed')) {
      if (dictionary[lower.slice(0, -1)]) return dictionary[lower.slice(0, -1)];
      if (dictionary[lower.slice(0, -2)]) return dictionary[lower.slice(0, -2)];
  }
  if (lower.endsWith('ing')) {
      if (dictionary[lower.slice(0, -3)]) return dictionary[lower.slice(0, -3)];
      if (dictionary[lower.slice(0, -3) + 'e']) return dictionary[lower.slice(0, -3) + 'e'];
  }

  return null;
};
