import { DictionaryEntry } from '../types';
import { smallDictionary, largeDictionary, dictionaryStats } from '../dicts/index';

// Helper to normalize word for lookup (remove punctuation, lowercase)
export const normalizeWord = (word: string): string => {
  return word.replace(/^[^\w]+|[^\w]+$/g, '');
};

/**
 * 词典查询策略：优先使用 small 词典，找不到再查 large 词典
 * 这是主要的查询入口函数
 */
export const lookupWord = (word: string): DictionaryEntry | null => {
  // 先在 small 词典中查找
  const smallResult = lookupInDictionary(smallDictionary, word);
  if (smallResult) {
    return smallResult;
  }

  // 如果 small 找不到，再查 large 词典
  const largeResult = lookupInDictionary(largeDictionary, word);
  return largeResult;
};

/**
 * 在指定词典中查找单词（支持词形变化）
 */
const lookupInDictionary = (dictionary: any, rawWord: string): DictionaryEntry | null => {
  if (!dictionary) return null;

  // 1. Try exact match
  let result = dictionary.get(rawWord);
  if (result) return result;

  // 2. Try normalized
  const clean = normalizeWord(rawWord);
  if (!clean) return null;

  result = dictionary.get(clean);
  if (result) return result;

  // 3. Try lowercase
  const lower = clean.toLowerCase();
  result = dictionary.get(lower);
  if (result) return result;

  // 4. Try singular (basic heuristic)
  if (lower.endsWith('s')) {
    result = dictionary.get(lower.slice(0, -1));
    if (result) return result;
  }
  if (lower.endsWith('es')) {
    result = dictionary.get(lower.slice(0, -2));
    if (result) return result;
  }
  if (lower.endsWith('ies')) {
    result = dictionary.get(lower.slice(0, -3) + 'y');
    if (result) return result;
  }

  // 5. Try past tense / participles
  if (lower.endsWith('ed')) {
    // tried -> try
    result = dictionary.get(lower.slice(0, -1));
    if (result) return result;
    // loved -> love
    result = dictionary.get(lower.slice(0, -2));
    if (result) return result;
    // studied -> study
    if (lower.endsWith('ied')) {
      result = dictionary.get(lower.slice(0, -3) + 'y');
      if (result) return result;
    }
  }

  // 6. Try -ing forms
  if (lower.endsWith('ing')) {
    // running -> run
    result = dictionary.get(lower.slice(0, -3));
    if (result) return result;
    // making -> make
    result = dictionary.get(lower.slice(0, -3) + 'e');
    if (result) return result;
    // studying -> study
    if (lower.endsWith('ying')) {
      result = dictionary.get(lower.slice(0, -4) + 'y');
      if (result) return result;
    }
  }

  // 7. Try comparative/superlative
  if (lower.endsWith('er')) {
    result = dictionary.get(lower.slice(0, -2));
    if (result) return result;
  }
  if (lower.endsWith('est')) {
    result = dictionary.get(lower.slice(0, -3));
    if (result) return result;
  }

  return null;
};

/**
 * 兼容旧版本的 API（保持向后兼容）
 * @deprecated 使用 lookupWord 替代
 */
export const loadDictionary = async (): Promise<any> => {
  console.log(`📚 词典已加载 - Small: ${dictionaryStats.small.toLocaleString()} 词条, Large: ${dictionaryStats.large.toLocaleString()} 词条`);
  return {
    // 返回一个兼容对象
    small: smallDictionary,
    large: largeDictionary,
    stats: dictionaryStats
  };
};

/**
 * 兼容旧版本的查询函数
 * @deprecated 使用 lookupWord 替代
 */
export const lookupWordInDict = (dictionary: any, rawWord: string): DictionaryEntry | null => {
  return lookupWord(rawWord);
};
