/**
 * 词典统一入口文件
 * 提供 dict-small 和 dict-large 的动态导入和类型转换
 * 优化：使用动态导入实现按需加载，提升首屏加载速度
 * 缓存：使用 localStorage 缓存词典，避免重复下载
 */

import { DictionaryEntry } from '../types';

// 原始词典类型（字符串格式）
type RawDictionary = { [key: string]: string };

// 词典版本号，更新词典时递增此版本号以清除旧缓存
const DICT_VERSION = '1.0.0';

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
 * 支持 localStorage 缓存
 */
class DictionaryWrapper {
  private rawDict: RawDictionary | null = null;
  private cache: Map<string, DictionaryEntry> = new Map();
  private loadPromise: Promise<void> | null = null;
  private loader: () => Promise<{ dict: RawDictionary }>;
  private storageKey: string;

  constructor(loader: () => Promise<{ dict: RawDictionary }>, storageKey: string) {
    this.loader = loader;
    this.storageKey = storageKey;
  }

  /**
   * 从 localStorage 加载词典
   */
  private loadFromStorage(): RawDictionary | null {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (!storedData) return null;

      const parsed = JSON.parse(storedData);

      // 检查版本号
      if (parsed.version !== DICT_VERSION) {
        console.log(`📚 词典版本已更新 (${parsed.version} -> ${DICT_VERSION})，清除旧缓存`);
        localStorage.removeItem(this.storageKey);
        return null;
      }

      console.log(`📚 从缓存加载词典: ${this.storageKey}`);
      return parsed.dict;
    } catch (error) {
      console.error(`❌ 读取词典缓存失败 (${this.storageKey}):`, error);
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  /**
   * 保存词典到 localStorage
   */
  private saveToStorage(dict: RawDictionary): void {
    try {
      const data = {
        version: DICT_VERSION,
        dict: dict,
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log(`📚 词典已缓存: ${this.storageKey}`);
    } catch (error) {
      console.error(`❌ 保存词典缓存失败 (${this.storageKey}):`, error);
      // localStorage 可能已满，尝试清理
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.log('💾 localStorage 空间不足，跳过缓存');
      }
    }
  }

  /**
   * 确保词典已加载
   */
  private async ensureLoaded(): Promise<void> {
    if (this.rawDict) return;

    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        // 尝试从缓存加载
        const cachedDict = this.loadFromStorage();
        if (cachedDict) {
          this.rawDict = cachedDict;
          return;
        }

        // 缓存未命中，从网络加载
        console.log(`📚 从网络加载词典: ${this.storageKey}`);
        const module = await this.loader();
        this.rawDict = module.dict;

        // 保存到缓存
        this.saveToStorage(this.rawDict);
      })();
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

// 导出包装后的词典（使用动态导入 + localStorage 缓存）
export const smallDictionary = new DictionaryWrapper(
  () => import('./dict-small.js'),
  'novel-reader-dict-small'
);

export const largeDictionary = new DictionaryWrapper(
  () => import('./dict-large.js'),
  'novel-reader-dict-large'
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

/**
 * 清除词典缓存
 * 用于手动清理或调试
 */
export function clearDictionaryCache() {
  localStorage.removeItem('novel-reader-dict-small');
  localStorage.removeItem('novel-reader-dict-large');
  console.log('🧹 词典缓存已清除');
}
