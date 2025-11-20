import React, { useState, useEffect } from 'react';
import { useWordContext } from '../context/WordContext';
import { X, Download, Trash2, BookOpen, CheckCircle, Cloud, RefreshCw, Loader2, Check } from 'lucide-react';
import { webdavService } from '../services/webdavService';
import { WebDAVConfig, SyncStatus } from '../types';

interface SettingsProps {
  onClose: () => void;
  syncStatus?: SyncStatus;
  onManualSync?: () => Promise<boolean>;
}

const Settings: React.FC<SettingsProps> = ({ onClose, syncStatus, onManualSync }) => {
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

  const [activeTab, setActiveTab] = useState<'vocabulary' | 'newwords' | 'webdav'>('vocabulary');

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
    webdavService.saveConfig(webdavConfig);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    // 先保存配置
    webdavService.saveConfig(webdavConfig);

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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-xl font-bold text-gray-800">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'vocabulary'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            词汇等级
          </button>
          <button
            onClick={() => setActiveTab('newwords')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'newwords'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
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
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Cloud size={16} />
            WebDAV
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 词汇等级选择 */}
          {activeTab === 'vocabulary' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">选择已掌握词汇等级</h3>
              <p className="text-sm text-gray-600 mb-6">
                选择你当前的词汇水平，该等级及以下的单词将不会显示注释。
              </p>

              {isLevelLoading && (
                <div className="text-center py-4">
                  <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500 mt-2">加载中...</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableLevels.map(level => (
                  <button
                    key={level.id}
                    onClick={() => setVocabularyLevel(level.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      currentVocabularyLevel?.id === level.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800">{level.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{level.description}</p>
                        <p className="text-xs text-blue-600 mt-2">
                          约 {level.wordCount.toLocaleString()} 词
                        </p>
                      </div>
                      {currentVocabularyLevel?.id === level.id && (
                        <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* 词典大小选择 */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">词典大小</h3>
                <p className="text-sm text-gray-600 mb-6">
                  选择词典范围。small词典包含常用词汇，large词典包含更多生僻词汇。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setDictionarySize('small')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      dictionarySize === 'small'
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800">Small（默认）</h4>
                        <p className="text-xs text-gray-500 mt-1">仅使用常用词典</p>
                        <p className="text-xs text-blue-600 mt-2">
                          推荐日常阅读使用
                        </p>
                      </div>
                      {dictionarySize === 'small' && (
                        <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => setDictionarySize('large')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      dictionarySize === 'large'
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800">Large</h4>
                        <p className="text-xs text-gray-500 mt-1">包含常用词典 + 扩展词典</p>
                        <p className="text-xs text-blue-600 mt-2">
                          适合专业文献阅读
                        </p>
                      </div>
                      {dictionarySize === 'large' && (
                        <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
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
                <h3 className="text-lg font-semibold text-gray-800">我的生词表</h3>
                <button
                  onClick={() => exportNewWords()}
                  disabled={newWords.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <Download size={16} />
                  导出全部
                </button>
              </div>

              {newWords.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500">还没有添加任何生词</p>
                  <p className="text-sm text-gray-400 mt-2">
                    点击文章中的生词，选择"添加到生词表"即可
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(newWordsByBook).map(([bookTitle, words]) => (
                    <div key={bookTitle} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-800">
                          {bookTitle}
                          <span className="ml-2 text-sm text-gray-500">({words.length} 词)</span>
                        </h4>
                        <button
                          onClick={() => exportNewWords(words[0]?.bookId)}
                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                        >
                          <Download size={14} />
                          导出
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {words.slice(0, 12).map((word, idx) => (
                          <div
                            key={idx}
                            className="text-sm bg-gray-50 px-2 py-1 rounded border border-gray-200"
                            title={word.translation}
                          >
                            <span className="font-medium text-gray-800">{word.word}</span>
                            {word.translation && (
                              <span className="text-xs text-gray-500 block truncate">
                                {word.translation.split(/[,;]/)[0]}
                              </span>
                            )}
                          </div>
                        ))}
                        {words.length > 12 && (
                          <div className="text-sm text-gray-400 px-2 py-1 flex items-center justify-center">
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
                <Cloud className="text-blue-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-800">WebDAV 同步配置</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                配置 WebDAV 服务器，实现多设备数据同步（书籍、生词、阅读进度等）
              </p>

              <div className="space-y-4">
                {/* 服务器 URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    服务器 URL *
                  </label>
                  <input
                    type="url"
                    value={webdavConfig.url}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, url: e.target.value })}
                    placeholder="https://example.com/webdav"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 用户名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    用户名 *
                  </label>
                  <input
                    type="text"
                    value={webdavConfig.username}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, username: e.target.value })}
                    placeholder="username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 密码 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    密码 *
                  </label>
                  <input
                    type="password"
                    value={webdavConfig.password}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, password: e.target.value })}
                    placeholder="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 自动同步开关 */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={webdavConfig.autoSync}
                    onChange={(e) => setWebdavConfig({ ...webdavConfig, autoSync: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="autoSync" className="text-sm text-gray-700">
                    启用自动同步（数据变更时自动上传到服务器）
                  </label>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveWebDAVConfig}
                    disabled={!webdavConfig.url || !webdavConfig.username}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {configSaved ? <Check size={16} /> : null}
                    {configSaved ? '已保存' : '保存配置'}
                  </button>

                  <button
                    onClick={handleTestConnection}
                    disabled={!webdavConfig.url || !webdavConfig.username || isTesting}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
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
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}
                  >
                    {testResult === 'success'
                      ? '✓ 连接成功！可以正常同步'
                      : '✗ 连接失败，请检查配置信息'}
                  </div>
                )}

                {/* 同步状态 */}
                {syncStatus && (
                  <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-3">同步状态</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {syncStatus === 'syncing' && (
                          <>
                            <Loader2 className="animate-spin text-blue-600" size={16} />
                            <span className="text-sm text-blue-600">正在同步...</span>
                          </>
                        )}
                        {syncStatus === 'success' && (
                          <>
                            <Check className="text-green-600" size={16} />
                            <span className="text-sm text-green-600">同步成功</span>
                          </>
                        )}
                        {syncStatus === 'error' && (
                          <>
                            <X className="text-red-600" size={16} />
                            <span className="text-sm text-red-600">同步失败</span>
                          </>
                        )}
                        {syncStatus === 'idle' && (
                          <span className="text-sm text-gray-500">就绪</span>
                        )}
                      </div>

                      <button
                        onClick={handleManualSync}
                        disabled={!webdavConfig.url || syncStatus === 'syncing'}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw size={14} />
                        手动同步
                      </button>
                    </div>
                  </div>
                )}

                {/* 功能说明 */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">同步说明</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 同步内容：书籍文件、生词表、已掌握单词、阅读进度</li>
                    <li>• 智能合并：多设备数据自动合并，不会丢失</li>
                    <li>• 自动同步：启用后，数据变更时自动上传（3秒防抖）</li>
                    <li>• 启动同步：打开应用时自动从服务器拉取最新数据</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
