/**
 * 词典统一入口文件
 * 提供 dict-small 和 dict-large 的导入和类型转换
 */

import { dict as dictSmall } from './dict-small.js';
import { dict as dictLarge } from './dict-large.js';
import { DictionaryEntry } from '../types';

// 原始词典类型（字符串格式）
type RawDictionary = { [key: string]: string };

/**
 * 将字符串格式的释义转换为 DictionaryEntry 对象
 * 例如: "n. 狗; vt. 跟踪" -> { translation: "狗; 跟踪", phonetic: undefined }
 */
export const parseDefinition = (definition: string): DictionaryEntry => {
  // 简单的解析：提取词性标记后的内容作为翻译
  const cleanDef = definition
    .replace(/\\r/g, '')  // 移除转义的回车符
    .replace(/\s+/g, ' ')  // 标准化空格
    .trim();

  return {
    translation: cleanDef,
    phonetic: undefined,
    definition: cleanDef
  };
};

/**
 * 包装原始词典，提供懒加载的 DictionaryEntry 转换
 */
class DictionaryWrapper {
  private rawDict: RawDictionary;
  private cache: Map<string, DictionaryEntry> = new Map();

  constructor(rawDict: RawDictionary) {
    this.rawDict = rawDict;
  }

  get(word: string): DictionaryEntry | undefined {
    // 检查缓存
    if (this.cache.has(word)) {
      return this.cache.get(word);
    }

    // 查找原始词典
    const rawDef = this.rawDict[word];
    if (!rawDef) return undefined;

    // 转换并缓存
    const entry = parseDefinition(rawDef);
    this.cache.set(word, entry);
    return entry;
  }

  has(word: string): boolean {
    return word in this.rawDict;
  }

  keys(): string[] {
    return Object.keys(this.rawDict);
  }

  get size(): number {
    return Object.keys(this.rawDict).length;
  }
}

// 导出包装后的词典
export const smallDictionary = new DictionaryWrapper(dictSmall as RawDictionary);
export const largeDictionary = new DictionaryWrapper(dictLarge as RawDictionary);

// 词典统计信息
export const dictionaryStats = {
  small: Object.keys(dictSmall).length,
  large: Object.keys(dictLarge).length,
  total: Object.keys(dictSmall).length + Object.keys(dictLarge).length
};

console.log(`📚 词典加载完成 - Small: ${dictionaryStats.small.toLocaleString()} 词条, Large: ${dictionaryStats.large.toLocaleString()} 词条`);
