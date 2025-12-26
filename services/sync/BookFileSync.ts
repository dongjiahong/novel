import { webdavService } from '../webdavService';
import { Book } from '../../types';
import { BOOKS_DIR } from './constants';
import { decodeContent } from './utils';

export class BookFileSync {
  /**
   * 上传书籍文件
   */
  async uploadBook(book: Book, fileContent: string): Promise<void> {
    const extension = book.title.endsWith('.epub') ? '.epub' : '.txt';
    const filePath = `${BOOKS_DIR}/${book.id}${extension}`;

    console.log(`准备上传书籍: ${book.title}, 路径: ${filePath}`);

    // 如果是 EPUB 文件且内容是 Base64 字符串，需要转换回 ArrayBuffer
    if (extension === '.epub') {
      try {
        // 检查是否是 Base64 字符串
        const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(fileContent.substring(0, 100));

        if (isBase64) {
          console.log(`将 Base64 转换为二进制数据，Base64 长度: ${fileContent.length}`);
          // 将 Base64 解码为二进制字符串
          const binaryString = atob(fileContent);
          // 转换为 Uint8Array
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          console.log(`上传 EPUB 二进制数据，大小: ${bytes.length} 字节`);
          await webdavService.uploadFile(filePath, bytes.buffer);
        } else {
          console.log(`直接上传 EPUB 文本数据`);
          await webdavService.uploadFile(filePath, fileContent);
        }
      } catch (error) {
        console.error(`转换或上传 EPUB 文件失败:`, error);
        throw error;
      }
    } else {
      // TXT 文件直接上传
      console.log(`上传 TXT 文件，大小: ${fileContent.length} 字符`);
      await webdavService.uploadFile(filePath, fileContent);
    }

    console.log(`书籍上传完成: ${book.title}`);
  }

  /**
   * 下载书籍文件
   */
  async downloadBook(bookId: string, extension: string = '.txt'): Promise<string | ArrayBuffer | null> {
    try {
      const filePath = `${BOOKS_DIR}/${bookId}${extension}`;
      console.log(`准备下载书籍文件: ${filePath}`);

      const exists = await webdavService.fileExists(filePath);
      if (!exists) {
        console.warn(`书籍文件不存在: ${filePath}`);
        return null;
      }

      console.log(`开始下载文件: ${filePath}, 扩展名: ${extension}`);
      const content = await webdavService.downloadFile(filePath);

      // webdavService 已经根据文件扩展名自动处理了格式
      // EPUB 文件会返回 ArrayBuffer，TXT 文件会返回 string
      if (content instanceof ArrayBuffer) {
        console.log(`下载完成（二进制）: ${filePath}, 大小: ${content.byteLength} 字节`);
        return content;
      } else if (typeof content === 'string') {
        console.log(`下载完成（文本）: ${filePath}, 大小: ${content.length} 字符`);
        return content;
      } else {
        // Buffer 类型，转换为字符串
        console.log(`下载完成（Buffer）: ${filePath}`);
        return decodeContent(content);
      }
    } catch (error) {
      console.error(`下载书籍 ${bookId} 失败:`, error);
      return null;
    }
  }
}

export const bookFileSync = new BookFileSync();
