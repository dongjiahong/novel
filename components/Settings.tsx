import React, { useState, useEffect } from 'react';
import { useWordContext } from '../context/WordContext';
import { useTheme } from '../context/ThemeContext';
import { X, Download, Trash2, BookOpen, CheckCircle, Cloud, RefreshCw, Loader2, Check, Sun, Moon, Monitor } from 'lucide-react';
import { webdavService } from '../services/webdavService';
import { WebDAVConfig, SyncStatus, SyncProgress } from '../types';

interface SettingsProps {
  onClose: () => void;
  syncStatus?: SyncStatus;
  syncProgress?: SyncProgress | null;
  onManualSync?: () => Promise<boolean>;
}

const Settings: React.FC<SettingsProps> = ({ onClose, syncStatus, syncProgress, onManualSync }) => {
  const {
    currentVocabularyLevel,
    availableLevels,
    setVocabularyLevel,
    isLevelLoading,
    knownWords,
    newWords,
    exportNewWords,
    currentBook,
    dictionarySize,
    setDictionarySize
  } = useWordContext();

  const { themeMode, setThemeMode } = useTheme();

  const [activeTab, setActiveTab] = useState<'vocabulary' | 'newwords' | 'webdav' | 'theme'>('vocabulary');

  // WebDAV 配置状态
  const [webdavConfig, setWebdavConfig] = useState<WebDAVConfig>({
    url: '',
    username: '',
    password: '',
    autoSync: true,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [configSaved, setConfigSaved] = useState(false);

  // 加载 WebDAV 配置
  useEffect(() => {
    const config = webdavService.getConfig();
    if (config) {
      setWebdavConfig(config);
    }
  }, []);

  // WebDAV 配置处理函数
  const handleSaveWebDAVConfig = () => {
    const configToSave = {
      ...webdavConfig,
      // 如果 URL 为空，提供默认值
      url: webdavConfig.url || `${window.location.origin}/webdav-proxy/`
    };
    webdavService.saveConfig(configToSave);
    // 触发配置变化事件
    window.dispatchEvent(new Event('webdav-config-changed'));
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    // 先保存配置
    const configToSave = {
      ...webdavConfig,
      // 如果 URL 为空，提供默认值
      url: webdavConfig.url || `${window.location.origin}/webdav-proxy/`
    };
    webdavService.saveConfig(configToSave);
    // 触发配置变化事件
    window.dispatchEvent(new Event('webdav-config-changed'));

    try {
      const result = await webdavService.testConnection();
      setTestResult(result ? 'success' : 'error');
    } catch (error) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleManualSync = async () => {
    if (onManualSync) {
      await onManualSync();
    }
  };

  // 按书籍分组生词
  const newWordsByBook = React.useMemo(() => {
    const grouped: { [bookTitle: string]: typeof newWords } = {};
    newWords.forEach(word => {
      if (!grouped[word.bookTitle]) {
        grouped[word.bookTitle] = [];
      }
      grouped[word.bookTitle].push(word);
    });
    return grouped;
  }, [newWords]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'vocabulary'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            词汇等级
          </button>
          <button
            onClick={() => setActiveTab('newwords')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'newwords'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            生词表
            {newWords.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-orange-500 rounded-full">
                {newWords.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('webdav')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'webdav'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Cloud size={16} />
            WebDAV
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'theme'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Sun size={16} className="dark:hidden" />
            <Moon size={16} className="hidden dark:block" />
            主题
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 词汇等级选择 */}
          {activeTab === 'vocabulary' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">选择已掌握词汇等级</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                选择你当前的词汇水平，该等级及以下的单词将不会显示注释。
              </p>

              {isLevelLoading && (
                <div className="text-center py-4">
                  <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">加载中...</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableLevels.map(level => (
                  <button
                    key={level.id}
                    onClick={() => setVocabularyLevel(level.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      currentVocabularyLevel?.id === level.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">{level.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{level.description}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          约 {level.wordCount.toLocaleString()} 词
                        </p>
                      </div>
                      {currentVocabularyLevel?.id === level.id && (
                        <CheckCircle className="text-blue-500 dark:text-blue-400 flex-shrink-0" size={20} />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* 词典大小选择 */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">词典大小</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  选择词典范围。small词典包含常用词汇，large词典包含更多生僻词汇。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setDictionarySize('small')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      dictionarySize === 'small'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">Small（默认）</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">仅使用常用词典</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          推荐日常阅读使用
                        </p>
                      </div>
                      {dictionarySize === 'small' && (
                        <CheckCircle className="text-blue-500 dark:text-blue-400 flex-shrink-0" size={20} />
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => setDictionarySize('large')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      dictionarySize === 'large'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">Large</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">包含常用词典 + 扩展词典</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          适合专业文献阅读
                        </p>
                      </div>
                      {dictionarySize === 'large' && (
                        <CheckCircle className="text-blue-500 dark:text-blue-400 flex-shrink-0" size={20} />
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 生词表 */}
          {activeTab === 'newwords' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">我的生词表</h3>
                <button
                  onClick={() => exportNewWords()}
                  disabled={newWords.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <Download size={16} />
                  导出全部
                </button>
              </div>

              {newWords.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} />
                  <p className="text-gray-500 dark:text-gray-400">还没有添加任何生词</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    点击文章中的生词，选择"添加到生词表"即可
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(newWordsByBook).map(([bookTitle, words]) => (
                    <div key={bookTitle} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-800 dark:text-gray-100">
                          {bookTitle}
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({words.length} 词)</span>
                        </h4>
                        <button
                          onClick={() => exportNewWords(words[0]?.bookId)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm flex items-center gap-1"
                        >
                          <Download size={14} />
                          导出
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {words.slice(0, 12).map((word, idx) => (
                          <div
                            key={idx}
                            className="text-sm bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700"
                            title={word.translation}
                          >
                            <span className="font-medium text-gray-800 dark:text-gray-100">{word.word}</span>
                            {word.translation && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                                {word.translation.split(/[,;]/)[0]}
                              </span>
                            )}
                          </div>
                        ))}
                        {words.length > 12 && (
                          <div className="text-sm text-gray-400 dark:text-gray-500 px-2 py-1 flex items-center justify-center">
                            +{words.length - 12} 更多...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WebDAV 同步配置 */}
          {activeTab === 'webdav' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Cloud className="text-blue-600 dark:text-blue-400" size={24} />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">WebDAV 同步配置</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                配置 WebDAV 服务器，实现多设备数据同步（书籍、生词、阅读进度等）
              </p>

              <div className="space-y-4">
                {/* 服务器 URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    服务器 URL
                  </label>
                  <input
                    type="text"
                    value={webdavConfig.url}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, url: e.target.value })}
                    placeholder={`${window.location.origin}/webdav-proxy/`}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    WebDAV 服务地址（留空则使用默认代理地址）
                  </p>
                </div>

                {/* 用户名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    用户名 *
                  </label>
                  <input
                    type="text"
                    value={webdavConfig.username}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, username: e.target.value })}
                    placeholder="username"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                  />
                </div>

                {/* 密码 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    密码 *
                  </label>
                  <input
                    type="password"
                    value={webdavConfig.password}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, password: e.target.value })}
                    placeholder="password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                  />
                </div>

                {/* 自动同步开关 */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={webdavConfig.autoSync}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, autoSync: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="autoSync" className="text-sm text-gray-700 dark:text-gray-300">
                    启用自动同步（数据变更时自动上传到服务器）
                  </label>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveWebDAVConfig}
                    disabled={!webdavConfig.username}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {configSaved ? <Check size={16} /> : null}
                    {configSaved ? '已保存' : '保存配置'}
                  </button>

                  <button
                    onClick={handleTestConnection}
                    disabled={!webdavConfig.username || isTesting}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        测试中...
                      </>
                    ) : (
                      '测试连接'
                    )}
                  </button>
                </div>

                {/* 测试结果 */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg ${
                      testResult === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {testResult === 'success'
                      ? '✓ 连接成功！可以正常同步'
                      : '✗ 连接失败，请检查配置信息'}
                  </div>
                )}

                {/* 同步状态 */}
                {syncStatus && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-3">同步状态</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {syncStatus === 'syncing' && (
                          <>
                            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={16} />
                            <span className="text-sm text-blue-600 dark:text-blue-400">
                              {syncProgress?.message || '同步中...'}
                            </span>
                          </>
                        )}
                        {syncStatus === 'success' && (
                          <>
                            <Check className="text-green-600 dark:text-green-400" size={16} />
                            <span className="text-sm text-green-600 dark:text-green-400">同步成功</span>
                          </>
                        )}
                        {syncStatus === 'error' && (
                          <>
                            <X className="text-red-600 dark:text-red-400" size={16} />
                            <span className="text-sm text-red-600 dark:text-red-400">同步失败</span>
                          </>
                        )}
                        {syncStatus === 'idle' && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">就绪</span>
                        )}
                      </div>

                      <button
                        onClick={handleManualSync}
                        disabled={!webdavConfig.url || syncStatus === 'syncing'}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw size={14} />
                        手动同步
                      </button>
                    </div>
                  </div>
                )}

                {/* 功能说明 */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">同步说明</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• 同步内容：书籍文件、生词表、已掌握单词、阅读进度</li>
                    <li>• 智能合并：多设备数据自动合并，不会丢失</li>
                    <li>• 自动同步：启用后，数据变更时自动上传（3秒防抖）</li>
                    <li>• 启动同步：打开应用时自动从服务器拉取最新数据</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 主题设置 */}
          {activeTab === 'theme' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sun className="text-blue-600 dark:hidden" size={24} />
                <Moon className="text-blue-600 hidden dark:block" size={24} />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">主题设置</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                选择你偏好的主题外观，自动模式将跟随系统设置
              </p>

              <div className="grid grid-cols-1 gap-3">
                {/* 浅色主题 */}
                <button
                  onClick={() => setThemeMode('light')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    themeMode === 'light'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-200 to-orange-300 flex items-center justify-center">
                        <Sun className="text-orange-700" size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">浅色模式</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">适合白天阅读，清晰明亮</p>
                      </div>
                    </div>
                    {themeMode === 'light' && (
                      <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
                    )}
                  </div>
                </button>

                {/* 暗色主题 */}
                <button
                  onClick={() => setThemeMode('dark')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    themeMode === 'dark'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Moon className="text-blue-100" size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">暗色模式</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">适合夜间阅读，护眼舒适</p>
                      </div>
                    </div>
                    {themeMode === 'dark' && (
                      <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
                    )}
                  </div>
                </button>

                {/* 自动主题 */}
                <button
                  onClick={() => setThemeMode('auto')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    themeMode === 'auto'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                        <Monitor className="text-white" size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">自动模式</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">跟随系统主题自动切换</p>
                      </div>
                    </div>
                    {themeMode === 'auto' && (
                      <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
                    )}
                  </div>
                </button>
              </div>

              {/* 提示信息 */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">主题说明</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• 浅色模式：适合光线充足的环境，提供清晰的阅读体验</li>
                  <li>• 暗色模式：减少眼睛疲劳，适合夜间或低光环境阅读</li>
                  <li>• 自动模式：根据你的系统设置自动切换主题</li>
                  <li>• 主题设置会自动同步到所有设备（需配置 WebDAV）</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
