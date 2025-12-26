import { webdavService } from '../webdavService';
import { Book, BooksMetaData, BookMetadata } from '../../types';
import { BOOKS_META_PATH, BOOKS_META_UPDATED_AT_KEY } from './constants';
import { decodeContent } from './utils';

export class BooksMetaSync {
  /**
   * 收集本地书籍元数据
   */
  async collectLocalBooksMeta(books: Book[]): Promise<BooksMetaData> {
    const metadata: BookMetadata[] = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      addedAt: new Date().toISOString(),
      chapterCount: book.chapters?.length || 0,
      fileExtension: book.title.endsWith('.epub') ? '.epub' : '.txt',
    }));

    return {
      books: metadata,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 上传书籍元数据
   */
  async uploadBooksMeta(booksMeta: BooksMetaData): Promise<void> {
    const json = JSON.stringify(booksMeta, null, 2);
    await webdavService.uploadFile(BOOKS_META_PATH, json);
  }

  /**
   * 下载书籍元数据
   */
  async downloadBooksMeta(): Promise<BooksMetaData | null> {
    try {
      const exists = await webdavService.fileExists(BOOKS_META_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(BOOKS_META_PATH);
      return JSON.parse(decodeContent(content)) as BooksMetaData;
    } catch (error) {
      console.error('下载书籍元数据失败:', error);
      return null;
    }
  }

  /**
   * 合并书籍元数据（按书名去重，保留所有书籍）
   */
  mergeBooksMeta(local: BooksMetaData, remote: BooksMetaData): BooksMetaData {
    const booksMap = new Map<string, BookMetadata>();
    [...local.books, ...remote.books].forEach(book => {
      const existing = booksMap.get(book.title);
      // 如果书籍已存在（按书名判断），保留较早添加的那个
      if (!existing || new Date(book.addedAt) < new Date(existing.addedAt)) {
        booksMap.set(book.title, book);
      }
    });

    return {
      books: Array.from(booksMap.values()),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 保存书籍元数据到本地
   */
  saveBooksMetaToLocal(booksMeta: BooksMetaData): void {
    // 注意：这里只保存元数据，实际的书籍内容由 App.tsx 管理
    localStorage.setItem('books_meta', JSON.stringify(booksMeta.books));
    localStorage.setItem(BOOKS_META_UPDATED_AT_KEY, booksMeta.updatedAt);
  }
}

export const booksMetaSync = new BooksMetaSync();
