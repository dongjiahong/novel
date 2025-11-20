import { Book } from '../types';

// IndexedDB 数据库名称和版本
const DB_NAME = 'NovelReaderDB';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';
const FILES_STORE = 'book_files';

class StorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // 初始化数据库
  private async init(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB 打开成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建书籍存储
        if (!db.objectStoreNames.contains(BOOKS_STORE)) {
          db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
          console.log('创建书籍对象存储');
        }

        // 创建文件存储
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          db.createObjectStore(FILES_STORE);
          console.log('创建文件对象存储');
        }
      };
    });

    return this.initPromise;
  }

  // 保存所有书籍
  async saveBooks(books: Book[]): Promise<void> {
    try {
      await this.init();
      if (!this.db) throw new Error('数据库未初始化');

      const transaction = this.db.transaction([BOOKS_STORE], 'readwrite');
      const store = transaction.objectStore(BOOKS_STORE);

      // 清空现有数据
      store.clear();

      // 保存所有书籍
      for (const book of books) {
        store.put(book);
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(`成功保存 ${books.length} 本书籍到 IndexedDB`);
          resolve();
        };
        transaction.onerror = () => {
          console.error('保存书籍失败:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('保存书籍到 IndexedDB 失败:', error);
      throw error;
    }
  }

  // 加载所有书籍
  async loadBooks(): Promise<Book[]> {
    try {
      await this.init();
      if (!this.db) throw new Error('数据库未初始化');

      const transaction = this.db.transaction([BOOKS_STORE], 'readonly');
      const store = transaction.objectStore(BOOKS_STORE);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const books = request.result as Book[];
          console.log(`从 IndexedDB 加载了 ${books.length} 本书籍`);
          resolve(books);
        };
        request.onerror = () => {
          console.error('加载书籍失败:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('从 IndexedDB 加载书籍失败:', error);
      return [];
    }
  }

  // 保存书籍文件内容
  async saveBookFiles(bookFiles: Map<string, string>): Promise<void> {
    try {
      await this.init();
      if (!this.db) throw new Error('数据库未初始化');

      const transaction = this.db.transaction([FILES_STORE], 'readwrite');
      const store = transaction.objectStore(FILES_STORE);

      // 清空现有数据
      store.clear();

      // 保存所有文件
      for (const [bookId, content] of bookFiles.entries()) {
        store.put(content, bookId);
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(`成功保存 ${bookFiles.size} 个书籍文件到 IndexedDB`);
          resolve();
        };
        transaction.onerror = () => {
          console.error('保存书籍文件失败:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('保存书籍文件到 IndexedDB 失败:', error);
      throw error;
    }
  }

  // 加载书籍文件内容
  async loadBookFiles(): Promise<Map<string, string>> {
    try {
      await this.init();
      if (!this.db) throw new Error('数据库未初始化');

      const transaction = this.db.transaction([FILES_STORE], 'readonly');
      const store = transaction.objectStore(FILES_STORE);
      const request = store.getAllKeys();

      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const keys = request.result as string[];
          const filesMap = new Map<string, string>();

          // 逐个获取文件内容
          for (const key of keys) {
            const getRequest = store.get(key);
            await new Promise<void>((resolveGet, rejectGet) => {
              getRequest.onsuccess = () => {
                filesMap.set(key, getRequest.result);
                resolveGet();
              };
              getRequest.onerror = () => rejectGet(getRequest.error);
            });
          }

          console.log(`从 IndexedDB 加载了 ${filesMap.size} 个书籍文件`);
          resolve(filesMap);
        };
        request.onerror = () => {
          console.error('加载书籍文件失败:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('从 IndexedDB 加载书籍文件失败:', error);
      return new Map();
    }
  }


  // 删除指定书籍
  async deleteBook(bookId: string): Promise<void> {
    try {
      await this.init();
      if (!this.db) throw new Error('数据库未初始化');

      const transaction = this.db.transaction([BOOKS_STORE, FILES_STORE], 'readwrite');

      // 删除书籍
      transaction.objectStore(BOOKS_STORE).delete(bookId);

      // 删除文件
      transaction.objectStore(FILES_STORE).delete(bookId);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(`成功删除书籍 ${bookId}`);
          resolve();
        };
        transaction.onerror = () => {
          console.error('删除书籍失败:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('删除书籍失败:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();
