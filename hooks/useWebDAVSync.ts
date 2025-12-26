import { useState, useCallback, useRef, useEffect } from 'react';
import { webdavService } from '../services/webdavService';
import { syncService } from '../services/syncService';
import { SyncStatus, Book, BooksMetaData, SyncProgress } from '../types';

interface UseWebDAVSyncOptions {
  books: Book[];
  bookFiles: Map<string, string>;
  onSyncComplete?: (booksMeta: BooksMetaData) => void;
}

/**
 * WebDAV 同步管理 Hook
 * 提供手动同步、自动同步、状态管理等功能
 */
export function useWebDAVSync(options: UseWebDAVSyncOptions) {
  const { books, bookFiles, onSyncComplete } = options;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(webdavService.isConfigured());
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(webdavService.getConfig()?.autoSync ?? false);

  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  /**
   * 监听配置变化
   */
  useEffect(() => {
    const checkConfig = () => {
      const configured = webdavService.isConfigured();
      const config = webdavService.getConfig();
      setIsConfigured(configured);
      setAutoSyncEnabled(config?.autoSync ?? false);
    };

    // 初始检查
    checkConfig();

    // 监听 storage 事件（当其他标签页修改 localStorage 时触发）
    window.addEventListener('storage', checkConfig);

    // 监听自定义事件（当前标签页修改配置时触发）
    window.addEventListener('webdav-config-changed', checkConfig);

    return () => {
      window.removeEventListener('storage', checkConfig);
      window.removeEventListener('webdav-config-changed', checkConfig);
    };
  }, []);

  /**
   * 加载上次同步时间
   */
  useEffect(() => {
    const loadLastSyncTime = async () => {
      if (isConfigured) {
        const time = await syncService.getLastSyncTime();
        setLastSyncTime(time);
      }
    };
    loadLastSyncTime();
  }, [isConfigured]);

  /**
   * 执行同步
   */
  const performSync = useCallback(async (): Promise<boolean> => {
    // 检查是否已配置 WebDAV
    if (!webdavService.isConfigured()) {
      setSyncError('WebDAV 未配置');
      return false;
    }

    // 避免重复同步
    if (isSyncingRef.current) {
      console.log('同步正在进行中，跳过');
      return false;
    }

    isSyncingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);
    setSyncProgress(null);

    try {
      // 执行完整同步，传递进度回调
      const result = await syncService.performFullSync(books, bookFiles, (progress) => {
        setSyncProgress(progress);
      });

      if (result.success && result.mergedBooksMeta) {
        setSyncStatus('success');
        setLastSyncTime(new Date().toISOString());

        // 通知同步完成
        if (onSyncComplete) {
          onSyncComplete(result.mergedBooksMeta);
        }

        // 2秒后恢复为 idle 状态
        setTimeout(() => {
          setSyncStatus('idle');
          setSyncProgress(null);
        }, 2000);

        return true;
      } else {
        setSyncStatus('error');
        setSyncError(result.error || '同步失败');
        setSyncProgress(null);
        return false;
      }
    } catch (error) {
      console.error('同步失败:', error);
      setSyncStatus('error');
      setSyncError(error instanceof Error ? error.message : '未知错误');
      setSyncProgress(null);
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, [books, bookFiles, onSyncComplete]);

  /**
   * 手动触发同步
   */
  const manualSync = useCallback(async () => {
    return await performSync();
  }, [performSync]);

  /**
   * 自动同步定时器（5分钟间隔）
   */
  useEffect(() => {
    if (!autoSyncEnabled) {
      return;
    }

    console.log('启动自动同步定时器（间隔 5 分钟）');
    const intervalId = setInterval(() => {
      console.log('⏰ 触发自动同步');
      performSync();
    }, 5 * 60 * 1000); // 5分钟

    return () => {
      console.log('清除自动同步定时器');
      clearInterval(intervalId);
    };
  }, [autoSyncEnabled, performSync]);

  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * 测试 WebDAV 连接
   */
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      return await webdavService.testConnection();
    } catch (error) {
      console.error('测试连接失败:', error);
      return false;
    }
  }, []);

  return {
    syncStatus,
    syncProgress,
    lastSyncTime,
    syncError,
    manualSync,
    testConnection,
    isConfigured,
    autoSyncEnabled,
  };
}