/**
 * 词典统一入口文件
 * 提供 dict-small 和 dict-large 的动态导入和类型转换
 * 优化：使用动态导入实现按需加载，提升首屏加载速度
 * 缓存：使用 IndexedDB 缓存词典，避免重复下载和 localStorage 配额限制
 */

import { DictionaryEntry } from '../types';

// 原始词典类型（字符串格式）
type RawDictionary = { [key: string]: string };

// 词典版本号，更新词典时递增此版本号以清除旧缓存
const DICT_VERSION = '2.1.0'; // 更新版本号以清除 localStorage 旧缓存

// IndexedDB 配置
const DICT_DB_NAME = 'NovelReaderDictDB';
const DICT_DB_VERSION = 1;
const DICT_STORE_NAME = 'dictionaries';

/**
 * 将字符串格式的释义转换为 DictionaryEntry 对象
 * 例如: "n. 狗; vt. 跟踪" -> { translation: "狗; 跟踪", phonetic: undefined }
 */
export const parseDefinition = (definition: string | any): DictionaryEntry => {
  // 如果已经是对象格式，直接返回
  if (typeof definition === 'object' && definition !== null) {
    return {
      translation: definition.translation || '',
      phonetic: definition.phonetic,
      definition: definition.definition || definition.translation || ''
    };
  }

  // 如果不是字符串，转换为字符串
  if (typeof definition !== 'string') {
    console.warn('词典数据格式异常，尝试转换:', typeof definition, definition);
    definition = String(definition);
  }

  // 简单的解析：提取词性标记后的内容作为翻译
  const cleanDef = definition
    .replace(/\\r/g, '')  // 移除转义的回车符
    .replace(/\s+/g, ' ')  // 标准化空格
    .trim();

  // 提取音标（格式：/phonetic/ 释义）
  let phonetic: string | undefined = undefined;
  let translation = cleanDef;

  const phoneticMatch = cleanDef.match(/^\/([^/]+)\//);
  if (phoneticMatch) {
    phonetic = `/${phoneticMatch[1]}/`;  // 保留斜杠
    translation = cleanDef.substring(phoneticMatch[0].length).trim();
  }

  return {
    translation,
    phonetic,
    definition: translation
  };
};

/**
 * 初始化 IndexedDB 数据库
 */
async function initDictDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DICT_DB_NAME, DICT_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DICT_STORE_NAME)) {
        db.createObjectStore(DICT_STORE_NAME);
      }
    };
  });
}

/**
 * 包装原始词典，提供懒加载的 DictionaryEntry 转换
 * 支持 IndexedDB 缓存
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
   * 从 IndexedDB 加载词典
   */
  private async loadFromStorage(): Promise<RawDictionary | null> {
    try {
      const db = await initDictDB();
      const transaction = db.transaction([DICT_STORE_NAME], 'readonly');
      const store = transaction.objectStore(DICT_STORE_NAME);
      const request = store.get(this.storageKey);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const storedData = request.result;
          if (!storedData) {
            resolve(null);
            return;
          }

          // 检查版本号
          if (storedData.version !== DICT_VERSION) {
            console.log(`📚 词典版本已更新 (${storedData.version} -> ${DICT_VERSION})，清除旧缓存`);
            this.clearFromStorage();
            resolve(null);
            return;
          }

          console.log(`📚 从 IndexedDB 加载词典: ${this.storageKey}`);
          resolve(storedData.dict);
        };
        request.onerror = () => {
          console.error(`❌ 读取词典缓存失败 (${this.storageKey}):`, request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error(`❌ IndexedDB 操作失败 (${this.storageKey}):`, error);
      return null;
    }
  }

  /**
   * 保存词典到 IndexedDB
   */
  private async saveToStorage(dict: RawDictionary): Promise<void> {
    try {
      const db = await initDictDB();
      const transaction = db.transaction([DICT_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DICT_STORE_NAME);

      const data = {
        version: DICT_VERSION,
        dict: dict,
        timestamp: Date.now()
      };

      store.put(data, this.storageKey);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(`📚 词典已缓存到 IndexedDB: ${this.storageKey}`);
          resolve();
        };
        transaction.onerror = () => {
          console.error(`❌ 保存词典缓存失败 (${this.storageKey}):`, transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error(`❌ IndexedDB 操作失败 (${this.storageKey}):`, error);
    }
  }

  /**
   * 从 IndexedDB 清除词典缓存
   */
  private async clearFromStorage(): Promise<void> {
    try {
      const db = await initDictDB();
      const transaction = db.transaction([DICT_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DICT_STORE_NAME);
      store.delete(this.storageKey);
    } catch (error) {
      console.error(`❌ 清除词典缓存失败 (${this.storageKey}):`, error);
    }
  }

  /**
   * 确保词典已加载
   */
  private async ensureLoaded(): Promise<void> {
    if (this.rawDict) return;

    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        // 清除 localStorage 中的旧缓存（迁移到 IndexedDB）
        try {
          const oldCache = localStorage.getItem(this.storageKey);
          if (oldCache) {
            console.log(`🧹 清除 localStorage 旧词典缓存: ${this.storageKey}`);
            localStorage.removeItem(this.storageKey);
          }
        } catch (error) {
          // 忽略错误
        }

        // 尝试从 IndexedDB 缓存加载
        const cachedDict = await this.loadFromStorage();
        if (cachedDict) {
          this.rawDict = cachedDict;
          return;
        }

        // 缓存未命中，从网络加载
        console.log(`📚 从网络加载词典: ${this.storageKey}`);
        const module = await this.loader();
        this.rawDict = module.dict;

        // 保存到 IndexedDB 缓存
        await this.saveToStorage(this.rawDict);
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
export async function clearDictionaryCache() {
  try {
    const db = await initDictDB();
    const transaction = db.transaction([DICT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(DICT_STORE_NAME);

    store.delete('novel-reader-dict-small');
    store.delete('novel-reader-dict-large');

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log('🧹 词典缓存已清除');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('清除词典缓存失败:', error);
  }
}
