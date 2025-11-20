import { createClient, WebDAVClient } from 'webdav';
import { WebDAVConfig } from '../types';

const CONFIG_KEY = 'webdav_config';

/**
 * WebDAV 服务类
 * 提供 WebDAV 连接、文件操作等功能
 */
class WebDAVService {
  private client: WebDAVClient | null = null;
  private config: WebDAVConfig | null = null;

  /**
   * 保存 WebDAV 配置到 localStorage
   */
  saveConfig(config: WebDAVConfig): void {
    // 如果当前页面是 HTTPS，自动将 HTTP URL 转换为 HTTPS
    // 这样可以避免浏览器的混合内容（Mixed Content）错误
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (config.url.startsWith('http://')) {
        config.url = config.url.replace('http://', 'https://');
        console.log('已将 WebDAV URL 从 HTTP 自动转换为 HTTPS 以避免混合内容错误');
      }
    }

    this.config = config;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    this.initClient();
  }

  /**
   * 从 localStorage 加载 WebDAV 配置
   */
  loadConfig(): WebDAVConfig | null {
    try {
      const configStr = localStorage.getItem(CONFIG_KEY);
      if (configStr) {
        this.config = JSON.parse(configStr);
        this.initClient();
        return this.config;
      }
    } catch (error) {
      console.error('加载 WebDAV 配置失败:', error);
    }
    return null;
  }

  /**
   * 获取当前配置
   */
  getConfig(): WebDAVConfig | null {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config;
  }

  /**
   * 初始化 WebDAV 客户端
   */
  private initClient(): void {
    if (!this.config) {
      return;
    }

    this.client = createClient(this.config.url, {
      username: this.config.username,
      password: this.config.password,
    });
  }

  /**
   * 获取 WebDAV 客户端实例
   */
  private getClient(): WebDAVClient {
    if (!this.client) {
      this.loadConfig();
      if (!this.client) {
        throw new Error('WebDAV 未配置，请先在设置中配置 WebDAV');
      }
    }
    return this.client;
  }

  /**
   * 检查配置是否有效
   */
  isConfigured(): boolean {
    return this.config !== null && this.config.url !== '' && this.config.username !== '';
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.exists('/');
      return true;
    } catch (error) {
      console.error('WebDAV 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 确保目录存在
   */
  async ensureDirectory(path: string): Promise<void> {
    try {
      const client = this.getClient();
      const exists = await client.exists(path);
      if (!exists) {
        await client.createDirectory(path);
      }
    } catch (error) {
      console.error(`创建目录 ${path} 失败:`, error);
      throw error;
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(path: string, content: string | Buffer): Promise<void> {
    try {
      const client = this.getClient();

      // 确保父目录存在
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      if (parentPath) {
        await this.ensureDirectory(parentPath);
      }

      await client.putFileContents(path, content);
    } catch (error) {
      console.error(`上传文件 ${path} 失败:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(path: string): Promise<string | Buffer> {
    try {
      const client = this.getClient();
      const content = await client.getFileContents(path);
      return content as string | Buffer;
    } catch (error) {
      console.error(`下载文件 ${path} 失败:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const client = this.getClient();
      return await client.exists(path);
    } catch (error) {
      console.error(`检查文件 ${path} 是否存在失败:`, error);
      return false;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const client = this.getClient();
      await client.deleteFile(path);
    } catch (error) {
      console.error(`删除文件 ${path} 失败:`, error);
      throw error;
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(path: string): Promise<any[]> {
    try {
      const client = this.getClient();
      const contents = await client.getDirectoryContents(path);
      return contents as any[];
    } catch (error) {
      console.error(`列出目录 ${path} 内容失败:`, error);
      throw error;
    }
  }

  /**
   * 清除配置
   */
  clearConfig(): void {
    this.config = null;
    this.client = null;
    localStorage.removeItem(CONFIG_KEY);
  }
}

// 导出单例
export const webdavService = new WebDAVService();
