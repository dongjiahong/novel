import { SyncFileType } from '../../types';
import { SYNC_DIRTY_FLAGS_KEY } from './constants';

/**
 * 脏数据追踪管理器
 */
export class SyncDirtyFlags {
  private flags: Record<SyncFileType, boolean>;

  constructor() {
    this.flags = this.load();
  }

  /**
   * 从 localStorage 加载标记
   */
  private load(): Record<SyncFileType, boolean> {
    try {
      const stored = localStorage.getItem(SYNC_DIRTY_FLAGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('加载脏数据标记失败:', error);
    }
    return {
      config: false,
      booksMeta: false,
      newWords: false,
      readingProgress: false,
      readingStats: false,
    };
  }

  /**
   * 保存标记到 localStorage
   */
  private save(): void {
    localStorage.setItem(SYNC_DIRTY_FLAGS_KEY, JSON.stringify(this.flags));
  }

  /**
   * 标记某个文件类型为"脏"（有变更）
   */
  set(type: SyncFileType): void {
    this.flags[type] = true;
    this.save();
  }

  /**
   * 检查某个文件类型是否有变更
   */
  get(type: SyncFileType): boolean {
    return this.flags[type];
  }

  /**
   * 清除某个文件类型的脏标记
   */
  clear(type: SyncFileType): void {
    this.flags[type] = false;
    this.save();
  }

  /**
   * 清除所有脏标记
   */
  clearAll(): void {
    this.flags = {
      config: false,
      booksMeta: false,
      newWords: false,
      readingProgress: false,
      readingStats: false,
    };
    this.save();
  }

  /**
   * 获取所有有变更的文件类型
   */
  getDirtyTypes(): SyncFileType[] {
    return (Object.keys(this.flags) as SyncFileType[]).filter(type => this.flags[type]);
  }
}

// 导出脏数据标记管理器实例
export const syncDirtyFlags = new SyncDirtyFlags();
