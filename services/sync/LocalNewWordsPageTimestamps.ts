import { NEW_WORDS_PAGE_TIMESTAMPS_KEY } from './constants';

/**
 * 生词表页级时间戳管理器
 * 用于追踪每页生词的本地更新时间，实现分页增量同步
 */
export class LocalNewWordsPageTimestamps {
  private timestamps: Map<number, string>;

  constructor() {
    this.timestamps = this.load();
  }

  /**
   * 从 localStorage 加载时间戳
   */
  private load(): Map<number, string> {
    try {
      const stored = localStorage.getItem(NEW_WORDS_PAGE_TIMESTAMPS_KEY);
      if (stored) {
        const obj = JSON.parse(stored) as Record<string, string>;
        const map = new Map<number, string>();
        Object.entries(obj).forEach(([key, value]) => {
          map.set(parseInt(key), value);
        });
        return map;
      }
    } catch (error) {
      console.error('加载页级时间戳失败:', error);
    }
    return new Map();
  }

  /**
   * 保存时间戳到 localStorage
   */
  private save(): void {
    const obj: Record<string, string> = {};
    this.timestamps.forEach((value, key) => {
      obj[key.toString()] = value;
    });
    localStorage.setItem(NEW_WORDS_PAGE_TIMESTAMPS_KEY, JSON.stringify(obj));
  }

  /**
   * 标记某页已更新
   */
  markPageUpdated(pageIndex: number, timestamp?: string): void {
    this.timestamps.set(pageIndex, timestamp || new Date().toISOString());
    this.save();
  }

  /**
   * 获取某页的时间戳
   */
  getPageTimestamp(pageIndex: number): string | null {
    return this.timestamps.get(pageIndex) || null;
  }

  /**
   * 获取所有页的时间戳
   */
  getAllTimestamps(): Map<number, string> {
    return new Map(this.timestamps);
  }

  /**
   * 通过远程元数据同步本地时间戳（首次同步时使用）
   */
  syncFromRemoteMeta(pages: { pageIndex: number; updatedAt: string }[]): void {
    pages.forEach(page => {
      // 只有本地没有时间戳时才设置远程时间戳
      if (!this.timestamps.has(page.pageIndex)) {
        this.timestamps.set(page.pageIndex, page.updatedAt);
      }
    });
    this.save();
  }

  /**
   * 清除所有时间戳（用于重置）
   */
  clear(): void {
    this.timestamps.clear();
    this.save();
  }

  /**
   * 移除超出总页数的时间戳
   */
  pruneExcessPages(totalPages: number): void {
    const keysToRemove: number[] = [];
    this.timestamps.forEach((_, pageIndex) => {
      if (pageIndex >= totalPages) {
        keysToRemove.push(pageIndex);
      }
    });
    keysToRemove.forEach(key => this.timestamps.delete(key));
    if (keysToRemove.length > 0) {
      this.save();
    }
  }
}

// 导出页级时间戳管理器实例
export const localNewWordsPageTimestamps = new LocalNewWordsPageTimestamps();
