import { DictionaryEntry } from '../types';
import { smallDictionary, largeDictionary, getDictionaryStats } from '../dicts/index';

// Helper to normalize word for lookup (remove punctuation, lowercase)
export const normalizeWord = (word: string): string => {
  return word.replace(/^[^\w]+|[^\w]+$/g, '');
};

/**
 * 检查两个单词是否匹配（考虑词形变化）
 * 用于生词表单词匹配
 */
export const wordsMatch = async (word1: string, word2: string): Promise<boolean> => {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  // 精确匹配
  if (w1 === w2) return true;

  // 检查是否一个是另一个的词形变化
  // 使用词典查询来确定是否为同一个词的不同形态
  const [entry1, entry2] = await Promise.all([
    lookupWord(w1),
    lookupWord(w2)
  ]);

  // 如果两个单词查到同一个词条，则认为匹配
  if (entry1 && entry2 && entry1 === entry2) {
    return true;
  }

  return false;
};

/**
 * 词典查询策略：优先使用 small 词典，找不到再查 large 词典（如果启用）
 * 这是主要的查询入口函数
 * @param word 要查询的单词
 * @param useLarge 是否使用 large 词典，默认为 false
 */
export const lookupWord = async (word: string, useLarge: boolean = false): Promise<DictionaryEntry | null> => {
  // 先在 small 词典中查找
  const smallResult = await lookupInDictionary(smallDictionary, word);
  if (smallResult) {
    return smallResult;
  }

  // 如果 small 找不到，且启用了 large 词典，再查 large 词典
  if (useLarge) {
    const largeResult = await lookupInDictionary(largeDictionary, word);
    return largeResult;
  }

  return null;
};

/**
 * 在指定词典中查找单词（支持词形变化）
 */
const lookupInDictionary = async (dictionary: any, rawWord: string): Promise<DictionaryEntry | null> => {
  if (!dictionary) return null;

  // 1. Try exact match
  let result = await dictionary.get(rawWord);
  if (result) return result;

  // 2. Try normalized
  const clean = normalizeWord(rawWord);
  if (!clean) return null;

  result = await dictionary.get(clean);
  if (result) return result;

  // 3. Try lowercase
  const lower = clean.toLowerCase();
  result = await dictionary.get(lower);
  if (result) return result;

  // 4. Try singular (basic heuristic)
  if (lower.endsWith('s')) {
    result = await dictionary.get(lower.slice(0, -1));
    if (result) return result;
  }
  if (lower.endsWith('es')) {
    result = await dictionary.get(lower.slice(0, -2));
    if (result) return result;
  }
  if (lower.endsWith('ies')) {
    result = await dictionary.get(lower.slice(0, -3) + 'y');
    if (result) return result;
  }

  // 5. Try past tense / participles
  if (lower.endsWith('ed')) {
    // tried -> try
    result = await dictionary.get(lower.slice(0, -1));
    if (result) return result;
    // loved -> love
    result = await dictionary.get(lower.slice(0, -2));
    if (result) return result;
    // studied -> study
    if (lower.endsWith('ied')) {
      result = await dictionary.get(lower.slice(0, -3) + 'y');
      if (result) return result;
    }
  }

  // 6. Try -ing forms
  if (lower.endsWith('ing')) {
    // running -> run
    result = await dictionary.get(lower.slice(0, -3));
    if (result) return result;
    // making -> make
    result = await dictionary.get(lower.slice(0, -3) + 'e');
    if (result) return result;
    // studying -> study
    if (lower.endsWith('ying')) {
      result = await dictionary.get(lower.slice(0, -4) + 'y');
      if (result) return result;
    }
  }

  // 7. Try comparative/superlative
  if (lower.endsWith('er')) {
    result = await dictionary.get(lower.slice(0, -2));
    if (result) return result;
  }
  if (lower.endsWith('est')) {
    result = await dictionary.get(lower.slice(0, -3));
    if (result) return result;
  }

  return null;
};

/**
 * 兼容旧版本的 API（保持向后兼容）
 * 只加载 small 词典,避免不必要的加载 large 词典
 * @deprecated 使用 lookupWord 替代
 */
export const loadDictionary = async (): Promise<any> => {
  // 只预加载 small 词典
  const smallSize = await smallDictionary.getSize();
  console.log(`📚 词典已加载 - Small: ${smallSize.toLocaleString()} 词条 (Large 词典将在需要时按需加载)`);
  return {
    // 返回一个兼容对象
    small: smallDictionary,
    large: largeDictionary,
    stats: {
      small: smallSize,
      large: 0, // large 词典未加载
      total: smallSize
    }
  };
};

/**
 * 兼容旧版本的查询函数
 * @deprecated 使用 lookupWord 替代
 */
export const lookupWordInDict = async (dictionary: any, rawWord: string): Promise<DictionaryEntry | null> => {
  return lookupWord(rawWord);
};
