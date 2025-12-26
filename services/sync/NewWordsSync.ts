import { webdavService } from '../webdavService';
import { storageService } from '../storageService';
import { NewWord, NewWordsMetadata, NewWordsPage } from '../../types';
import { NEW_WORDS_META_PATH, NEW_WORDS_DIR, NEW_WORDS_PAGE_SIZE } from './constants';
import { decodeContent } from './utils';
import { localNewWordsPageTimestamps } from './LocalNewWordsPageTimestamps';

export class NewWordsSync {
  /**
   * 上传生词表元数据
   */
  async uploadNewWordsMeta(metadata: NewWordsMetadata): Promise<void> {
    const json = JSON.stringify(metadata, null, 2);
    await webdavService.uploadFile(NEW_WORDS_META_PATH, json);
  }

  /**
   * 下载生词表元数据
   */
  async downloadNewWordsMeta(): Promise<NewWordsMetadata | null> {
    try {
      const exists = await webdavService.fileExists(NEW_WORDS_META_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(NEW_WORDS_META_PATH);
      return JSON.parse(decodeContent(content)) as NewWordsMetadata;
    } catch (error) {
      console.error('下载生词表元数据失败:', error);
      return null;
    }
  }

  /**
   * 上传生词表分页数据
   */
  async uploadNewWordsPage(page: NewWordsPage): Promise<void> {
    const filePath = `${NEW_WORDS_DIR}/page-${page.pageIndex}.json`;
    const json = JSON.stringify(page, null, 2);
    await webdavService.uploadFile(filePath, json);
  }

  /**
   * 下载生词表分页数据
   */
  async downloadNewWordsPage(pageIndex: number): Promise<NewWordsPage | null> {
    try {
      const filePath = `${NEW_WORDS_DIR}/page-${pageIndex}.json`;
      const exists = await webdavService.fileExists(filePath);
      if (!exists) return null;

      const content = await webdavService.downloadFile(filePath);
      return JSON.parse(decodeContent(content)) as NewWordsPage;
    } catch (error) {
      console.error(`下载生词表第 ${pageIndex} 页失败:`, error);
      return null;
    }
  }

  /**
   * 收集本地生词表并构建元数据
   */
  async collectLocalNewWordsMeta(): Promise<NewWordsMetadata> {
    const totalCount = await storageService.getNewWordsCount();
    const totalPages = Math.ceil(totalCount / NEW_WORDS_PAGE_SIZE);

    // 构建每页的元数据
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
      const offset = i * NEW_WORDS_PAGE_SIZE;
      const pageWords = await storageService.loadNewWords(offset, NEW_WORDS_PAGE_SIZE);

      // 计算该页最后更新时间（取该页所有生词中最新的时间）
      let latestTime = new Date(0).toISOString();
      pageWords.forEach(word => {
        const wordTime = word.lastReviewedAt || word.firstSeenAt;
        if (wordTime > latestTime) {
          latestTime = wordTime;
        }
      });

      pages.push({
        pageIndex: i,
        wordCount: pageWords.length,
        updatedAt: latestTime,
      });
    }

    return {
      totalCount,
      pageSize: NEW_WORDS_PAGE_SIZE,
      totalPages,
      pages,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 合并生词列表（按单词去重，保留最新记录）
   */
  private mergeNewWordsList(local: NewWord[], remote: NewWord[]): NewWord[] {
    const wordsMap = new Map<string, NewWord>();

    [...local, ...remote].forEach(word => {
      const key = word.word.toLowerCase();
      const existing = wordsMap.get(key);

      if (!existing) {
        wordsMap.set(key, word);
      } else {
        // 合并两个版本的数据
        const merged: NewWord = {
          ...existing,
          ...word,
          // 保留最早的 firstSeenAt
          firstSeenAt: new Date(existing.firstSeenAt) < new Date(word.firstSeenAt)
            ? existing.firstSeenAt
            : word.firstSeenAt,
          // 取最大的 reviewCount
          reviewCount: Math.max(existing.reviewCount, word.reviewCount),
          // 取最新的 lastReviewedAt
          lastReviewedAt: !existing.lastReviewedAt ? word.lastReviewedAt :
            !word.lastReviewedAt ? existing.lastReviewedAt :
              new Date(existing.lastReviewedAt) > new Date(word.lastReviewedAt)
                ? existing.lastReviewedAt
                : word.lastReviewedAt,
          // 取最新的 masteredAt
          masteredAt: !existing.masteredAt ? word.masteredAt :
            !word.masteredAt ? existing.masteredAt :
              new Date(existing.masteredAt) > new Date(word.masteredAt)
                ? existing.masteredAt
                : word.masteredAt,
          // 只要有一方标记为困难,就保留困难标记
          isMarkedDifficult: existing.isMarkedDifficult || word.isMarkedDifficult,
        };
        wordsMap.set(key, merged);
      }
    });

    return Array.from(wordsMap.values());
  }

  /**
   * 同步生词表（分页增量版本）
   * 优化逻辑：只同步有变更的页，减少网络传输
   */
  async syncNewWords(onProgress?: (current: number, total: number) => void): Promise<void> {
    try {
      console.log('开始同步生词表（分页增量）...');

      // 确保目录存在
      await webdavService.ensureDirectory(NEW_WORDS_DIR);

      // 1. 收集本地元数据
      const localMeta = await this.collectLocalNewWordsMeta();
      console.log(`本地生词表: ${localMeta.totalCount} 个，${localMeta.totalPages} 页`);

      // 2. 下载远程元数据
      const remoteMeta = await this.downloadNewWordsMeta();

      if (!remoteMeta) {
        // 远程没有数据，上传本地所有数据并初始化时间戳
        console.log('远程无生词表，上传本地数据');
        await this.uploadNewWordsMeta(localMeta);

        for (let i = 0; i < localMeta.totalPages; i++) {
          const offset = i * NEW_WORDS_PAGE_SIZE;
          const words = await storageService.loadNewWords(offset, NEW_WORDS_PAGE_SIZE);
          const pageTimestamp = localMeta.pages[i]?.updatedAt || new Date().toISOString();
          await this.uploadNewWordsPage({
            pageIndex: i,
            words,
            updatedAt: pageTimestamp,
          });
          // 记录本地页时间戳
          localNewWordsPageTimestamps.markPageUpdated(i, pageTimestamp);
          onProgress?.(i + 1, localMeta.totalPages);
        }
        console.log('首次上传完成');
        return;
      }

      console.log(`远程生词表: ${remoteMeta.totalCount} 个，${remoteMeta.totalPages} 页`);

      // 3. 构建远程页时间戳索引
      const remotePageTimestamps = new Map<number, string>();
      remoteMeta.pages.forEach(page => {
        remotePageTimestamps.set(page.pageIndex, page.updatedAt);
      });

      // 4. 分析哪些页需要同步
      const pagesToDownload: number[] = []; // 远程比本地新的页
      const pagesToUpload: number[] = [];   // 本地比远程新的页
      const pagesToMerge: number[] = [];    // 双方都有更新的页（需合并后上传）

      const maxPages = Math.max(localMeta.totalPages, remoteMeta.totalPages);

      for (let i = 0; i < maxPages; i++) {
        const localTimestamp = localNewWordsPageTimestamps.getPageTimestamp(i);
        const remoteTimestamp = remotePageTimestamps.get(i);

        if (!remoteTimestamp && i < localMeta.totalPages) {
          // 远程没有此页，本地有 → 需要上传
          pagesToUpload.push(i);
        } else if (!localTimestamp && remoteTimestamp) {
          // 本地没有时间戳，远程有 → 需要下载（可能是首次同步或新设备）
          pagesToDownload.push(i);
        } else if (localTimestamp && remoteTimestamp) {
          const localTime = new Date(localTimestamp).getTime();
          const remoteTime = new Date(remoteTimestamp).getTime();

          if (remoteTime > localTime) {
            // 远程更新 → 下载
            pagesToDownload.push(i);
          } else if (localTime > remoteTime) {
            // 本地更新 → 上传
            pagesToUpload.push(i);
          }
          // 如果时间相同，无需同步
        }
      }

      console.log(`需下载 ${pagesToDownload.length} 页，需上传 ${pagesToUpload.length} 页`);

      // 如果没有需要同步的页，直接返回
      if (pagesToDownload.length === 0 && pagesToUpload.length === 0) {
        console.log('生词表无变更，跳过同步');
        onProgress?.(1, 1);
        return;
      }

      const totalOperations = pagesToDownload.length + pagesToUpload.length;
      let completedOperations = 0;

      // 5. 下载远程更新的页并合并到本地
      for (const pageIndex of pagesToDownload) {
        const remotePage = await this.downloadNewWordsPage(pageIndex);
        if (remotePage) {
          // 获取本地对应页的生词
          const offset = pageIndex * NEW_WORDS_PAGE_SIZE;
          const localPageWords = await storageService.loadNewWords(offset, NEW_WORDS_PAGE_SIZE);
          
          // 合并远程和本地生词
          const mergedWords = this.mergeNewWordsList(localPageWords, remotePage.words);
          
          // 保存合并后的生词（需要全量替换该页）
          // 注意：这里简化处理，直接替换整个生词库后重新分页
          // 对于更高效的实现，可以考虑按页存储
          console.log(`下载并合并第 ${pageIndex} 页，${remotePage.words.length} 个生词`);
          
          // 更新本地时间戳为远程时间
          localNewWordsPageTimestamps.markPageUpdated(pageIndex, remotePage.updatedAt);
          
          // 如果合并后有变化，标记需要上传
          if (mergedWords.length > remotePage.words.length) {
            pagesToMerge.push(pageIndex);
          }
        }
        completedOperations++;
        onProgress?.(completedOperations, totalOperations);
      }

      // 6. 如果有下载操作，需要重新加载所有生词、合并后保存
      if (pagesToDownload.length > 0) {
        const allRemoteWords: NewWord[] = [];
        for (const pageIndex of pagesToDownload) {
          const remotePage = await this.downloadNewWordsPage(pageIndex);
          if (remotePage) {
            allRemoteWords.push(...remotePage.words);
          }
        }
        
        const localWords = await storageService.loadNewWords(0);
        const mergedWords = this.mergeNewWordsList(localWords, allRemoteWords);
        await storageService.saveAllNewWords(mergedWords);
        console.log(`合并后总生词数: ${mergedWords.length}`);
        
        // 触发生词表更新事件
        window.dispatchEvent(new CustomEvent('sync-newwords-updated'));
      }

      // 7. 上传本地更新的页
      const pagesToActuallyUpload = [...new Set([...pagesToUpload, ...pagesToMerge])];
      
      // 重新收集本地元数据（因为可能有合并）
      const updatedLocalMeta = await this.collectLocalNewWordsMeta();
      
      for (const pageIndex of pagesToActuallyUpload) {
        if (pageIndex < updatedLocalMeta.totalPages) {
          const offset = pageIndex * NEW_WORDS_PAGE_SIZE;
          const words = await storageService.loadNewWords(offset, NEW_WORDS_PAGE_SIZE);
          const pageTimestamp = new Date().toISOString();
          
          await this.uploadNewWordsPage({
            pageIndex,
            words,
            updatedAt: pageTimestamp,
          });
          
          // 更新本地时间戳
          localNewWordsPageTimestamps.markPageUpdated(pageIndex, pageTimestamp);
          console.log(`上传第 ${pageIndex} 页，${words.length} 个生词`);
        }
        completedOperations++;
        onProgress?.(completedOperations, totalOperations);
      }

      // 8. 更新远程元数据
      const finalMeta = await this.collectLocalNewWordsMeta();
      await this.uploadNewWordsMeta(finalMeta);

      // 9. 清理多余的页时间戳
      localNewWordsPageTimestamps.pruneExcessPages(finalMeta.totalPages);

      console.log('生词表增量同步完成');
    } catch (error) {
      console.error('生词表同步失败:', error);
      throw error;
    }
  }

  /**
   * 保存生词表到本地（已弃用，使用 IndexedDB）
   */
  async saveNewWordsToLocal(words: NewWord[]): Promise<void> {
    await storageService.saveAllNewWords(words);
    // 触发自定义事件通知生词表已更新
    window.dispatchEvent(new CustomEvent('sync-newwords-updated'));
    console.log('📢 已触发生词表更新事件');
  }
}

export const newWordsSync = new NewWordsSync();
