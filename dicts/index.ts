/**
 * 词典统一入口文件
 * 提供 dict-small 和 dict-large 的动态导入和类型转换
 * 优化：使用动态导入实现按需加载，提升首屏加载速度
 */

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
  private rawDict: RawDictionary | null = null;
  private cache: Map<string, DictionaryEntry> = new Map();
  private loadPromise: Promise<void> | null = null;
  private loader: () => Promise<{ dict: RawDictionary }>;

  constructor(loader: () => Promise<{ dict: RawDictionary }>) {
    this.loader = loader;
  }

  /**
   * 确保词典已加载
   */
  private async ensureLoaded(): Promise<void> {
    if (this.rawDict) return;

    if (!this.loadPromise) {
      this.loadPromise = this.loader().then(module => {
        this.rawDict = module.dict;
      });
    }

    await this.loadPromise;
  }

  async get(word: string): Promise<DictionaryEntry | undefined> {
    // 检查缓存
    if (this.cache.has(word)) {
      return this.cache.get(word);
    }

    // 确保词典已加载
    await this.ensureLoaded();
    if (!this.rawDict) return undefined;

    // 查找原始词典
    const rawDef = this.rawDict[word];
    if (!rawDef) return undefined;

    // 转换并缓存
    const entry = parseDefinition(rawDef);
    this.cache.set(word, entry);
    return entry;
  }

  async has(word: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.rawDict ? word in this.rawDict : false;
  }

  async keys(): Promise<string[]> {
    await this.ensureLoaded();
    return this.rawDict ? Object.keys(this.rawDict) : [];
  }

  async getSize(): Promise<number> {
    await this.ensureLoaded();
    return this.rawDict ? Object.keys(this.rawDict).length : 0;
  }

  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.rawDict !== null;
  }
}

// 导出包装后的词典（使用动态导入）
export const smallDictionary = new DictionaryWrapper(
  () => import('./dict-small.js')
);

export const largeDictionary = new DictionaryWrapper(
  () => import('./dict-large.js')
);

/**
 * 获取词典统计信息（异步）
 */
export async function getDictionaryStats() {
  const [smallSize, largeSize] = await Promise.all([
    smallDictionary.getSize(),
    largeDictionary.getSize()
  ]);

  return {
    small: smallSize,
    large: largeSize,
    total: smallSize + largeSize
  };
}

/**
 * 预加载词典（可选）
 * 在应用空闲时调用此函数可以预先加载词典
 */
export async function preloadDictionaries() {
  console.log('📚 开始预加载词典...');
  const startTime = performance.now();

  await Promise.all([
    smallDictionary.getSize(),
    largeDictionary.getSize()
  ]);

  const stats = await getDictionaryStats();
  const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);

  console.log(`📚 词典加载完成 (${loadTime}s) - Small: ${stats.small.toLocaleString()} 词条, Large: ${stats.large.toLocaleString()} 词条`);

  return stats;
}
