import { webdavService } from '../webdavService';
import { storageService } from '../storageService';
import { UserConfig } from '../../types';
import { CONFIG_PATH, CONFIG_UPDATED_AT_KEY } from './constants';
import { decodeContent } from './utils';

export class ConfigSync {
  /**
   * 收集本地用户配置
   */
  async collectLocalConfig(): Promise<UserConfig> {
    const userKnownWords = await storageService.loadKnownWords();
    const excludedWords = await storageService.loadExcludedWords();
    const selectedLevel = localStorage.getItem('selected_vocabulary_level') || '';
    const themeMode = localStorage.getItem('theme_mode') as 'light' | 'dark' | 'auto' | null;

    return {
      selectedVocabularyLevel: selectedLevel,
      userKnownWords,
      excludedWords,
      themeMode: themeMode || undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 上传用户配置
   */
  async uploadConfig(config: UserConfig): Promise<void> {
    const json = JSON.stringify(config, null, 2);
    await webdavService.uploadFile(CONFIG_PATH, json);
  }

  /**
   * 下载用户配置
   */
  async downloadConfig(): Promise<UserConfig | null> {
    try {
      const exists = await webdavService.fileExists(CONFIG_PATH);
      if (!exists) return null;

      const content = await webdavService.downloadFile(CONFIG_PATH);
      return JSON.parse(decodeContent(content)) as UserConfig;
    } catch (error) {
      console.error('下载用户配置失败:', error);
      return null;
    }
  }

  /**
   * 合并用户配置
   */
  mergeConfig(local: UserConfig, remote: UserConfig): UserConfig {
    const localTime = new Date(local.updatedAt);
    const remoteTime = new Date(remote.updatedAt);

    // 词汇等级和主题：取最新的
    const selectedVocabularyLevel = localTime > remoteTime
      ? local.selectedVocabularyLevel
      : remote.selectedVocabularyLevel;

    const themeMode = localTime > remoteTime
      ? local.themeMode
      : remote.themeMode;

    // 已掌握单词和排除单词：取并集
    const userKnownWords = Array.from(
      new Set([...local.userKnownWords, ...remote.userKnownWords])
    );
    const excludedWords = Array.from(
      new Set([...local.excludedWords, ...remote.excludedWords])
    );

    return {
      selectedVocabularyLevel,
      userKnownWords,
      excludedWords,
      themeMode,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 保存配置到本地
   */
  async saveConfigToLocal(config: UserConfig): Promise<void> {
    localStorage.setItem('selected_vocabulary_level', config.selectedVocabularyLevel);
    await storageService.saveKnownWords(config.userKnownWords);
    await storageService.saveExcludedWords(config.excludedWords);
    if (config.themeMode) {
      localStorage.setItem('theme_mode', config.themeMode);
    }

    if (config.updatedAt) {
      localStorage.setItem(CONFIG_UPDATED_AT_KEY, config.updatedAt);
    }

    // 触发自定义事件通知配置已更新
    window.dispatchEvent(new CustomEvent('sync-config-updated'));
    console.log('📢 已触发配置更新事件');
  }
}

export const configSync = new ConfigSync();
