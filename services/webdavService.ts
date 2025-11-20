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
    console.log('保存配置前 - URL:', config.url);
    console.log('当前页面协议:', typeof window !== 'undefined' ? window.location.protocol : 'unknown');

    // 如果当前页面是 HTTPS，自动将 HTTP URL 转换为 HTTPS
    // 这样可以避免浏览器的混合内容（Mixed Content）错误
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (config.url.startsWith('http://')) {
        config.url = config.url.replace('http://', 'https://');
        console.log('✓ 已将 WebDAV URL 从 HTTP 自动转换为 HTTPS');
      }
    }

    // 确保 URL 以 https:// 开头（如果当前页面是 HTTPS）
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (!config.url.startsWith('https://') && !config.url.startsWith('http://')) {
        config.url = 'https://' + config.url;
        console.log('✓ 已为 URL 添加 https:// 前缀');
      }
    }

    console.log('保存配置后 - URL:', config.url);

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

    // 强制确保 URL 使用 HTTPS（解决 webdav 库可能降级的问题）
    let url = this.config.url;
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
        console.warn('⚠️ WebDAV URL 被强制转换为 HTTPS:', url);
      }
    }

    console.log('初始化 WebDAV 客户端 - URL:', url);

    this.client = createClient(url, {
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

      // 检查目录是否存在
      let exists = false;
      try {
        exists = await client.exists(path);
      } catch (error) {
        // 404 错误表示目录不存在，这是正常的
        console.log(`目录 ${path} 不存在，准备创建`);
        exists = false;
      }

      if (!exists) {
        // 递归创建父目录
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        if (parentPath && parentPath !== '/novel-reader') {
          await this.ensureDirectory(parentPath);
        }

        // 创建当前目录
        console.log(`创建目录: ${path}`);
        await client.createDirectory(path, { recursive: true });
        console.log(`目录创建成功: ${path}`);
      } else {
        console.log(`目录已存在: ${path}`);
      }
    } catch (error) {
      console.error(`创建目录 ${path} 失败:`, error);
      // 不抛出错误，因为目录可能已经存在但 exists 检查失败
      // throw error;
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(path: string, content: string | Buffer | ArrayBuffer | Uint8Array): Promise<void> {
    try {
      const client = this.getClient();

      // 确保父目录存在
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      if (parentPath) {
        await this.ensureDirectory(parentPath);
      }

      // WebDAV 客户端支持 string、Buffer、ArrayBuffer 和 Uint8Array
      // 直接传递即可，无需转换
      if (content instanceof ArrayBuffer) {
        console.log(`上传 ArrayBuffer (${content.byteLength} 字节)`);
      } else if (content instanceof Uint8Array) {
        console.log(`上传 Uint8Array (${content.length} 字节)`);
      } else {
        console.log(`上传文本内容 (${typeof content === 'string' ? content.length : 'unknown'} 字符)`);
      }

      await client.putFileContents(path, content as any);
    } catch (error) {
      console.error(`上传文件 ${path} 失败:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(path: string, format?: 'text' | 'binary'): Promise<string | Buffer | ArrayBuffer> {
    try {
      const client = this.getClient();

      // 根据文件扩展名或指定的格式决定下载方式
      const isBinary = format === 'binary' || path.endsWith('.epub');

      if (isBinary) {
        // 二进制文件，请求 ArrayBuffer
        const content = await client.getFileContents(path, { format: 'binary' });
        return content as ArrayBuffer;
      } else {
        // 文本文件
        const content = await client.getFileContents(path, { format: 'text' });
        return content as string;
      }
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
