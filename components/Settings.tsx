import React, { useState, useEffect } from 'react';
import { useWordContext } from '../context/WordContext';
import { useTheme } from '../context/ThemeContext';
import { X, Download, BookOpen, CheckCircle, Cloud, RefreshCw, Loader2, Check, Sun, Moon, Settings2, Book, Globe, Palette } from 'lucide-react';
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
    newWords,
    exportNewWords,
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

  const tabs = [
    { id: 'vocabulary', label: '词汇', icon: Book },
    { id: 'newwords', label: '生词本', icon: BookOpen, count: newWords.length },
    { id: 'webdav', label: '同步', icon: Cloud },
    { id: 'theme', label: '外观', icon: Palette },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col ring-1 ring-white/10">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-5 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Settings2 size={18} className="sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Navigation (Segmented Control) */}
        <div className="px-3 sm:px-6 pb-2">
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                <tab.icon size={14} className="sm:w-4 sm:h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id 
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' 
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-[300px] sm:min-h-[400px]">
          {/* 词汇等级 */}
          {activeTab === 'vocabulary' && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">词汇量等级</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                  选择你的英语水平，系统将自动标注超出该等级的生词。
                </p>

                {isLevelLoading ? (
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="animate-spin text-indigo-500" size={28} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {availableLevels.map(level => (
                      <button
                        key={level.id}
                        onClick={() => setVocabularyLevel(level.id)}
                        className={`group relative p-3 sm:p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                          currentVocabularyLevel?.id === level.id
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className={`font-bold text-sm sm:text-base ${currentVocabularyLevel?.id === level.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                              {level.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{level.description}</p>
                            <div className="mt-2 sm:mt-3 inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300">
                              ≈ {level.wordCount.toLocaleString()} 词
                            </div>
                          </div>
                          {currentVocabularyLevel?.id === level.id && (
                            <div className="bg-indigo-500 text-white p-0.5 sm:p-1 rounded-full shadow-sm">
                              <Check size={12} strokeWidth={3} className="sm:w-[14px] sm:h-[14px]" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              <section>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">词典范围</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                  Small 词典加载更快，Large 词典释义更全。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {['small', 'large'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setDictionarySize(size as 'small' | 'large')}
                      className={`p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                        dictionarySize === size
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="text-left">
                        <h4 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white capitalize">{size} Dictionary</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                          {size === 'small' ? '常用词汇，极速体验' : '海量词库，专业覆盖'}
                        </p>
                      </div>
                      {dictionarySize === size && (
                        <CheckCircle className="text-indigo-500 w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* 生词表 */}
          {activeTab === 'newwords' && (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-100">我的生词本</h3>
                  <p className="text-xs sm:text-sm text-indigo-600/80 dark:text-indigo-300/80 mt-0.5 sm:mt-1">
                    共 {newWords.length} 个生词等待复习
                  </p>
                </div>
                <button
                  onClick={() => exportNewWords()}
                  disabled={newWords.length === 0}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded-lg hover:shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-xs sm:text-sm font-medium shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-800"
                >
                  <Download size={14} className="sm:w-4 sm:h-4" />
                  导出所有生词
                </button>
              </div>

              {newWords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                    <BookOpen className="text-gray-300 dark:text-gray-600 w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <p className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-200">空空如也</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-2 max-w-xs mx-auto">
                    阅读时点击生词并选择"添加到生词表"，它们就会出现在这里。
                  </p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  {Object.entries(newWordsByBook).map(([bookTitle, words]) => (
                    <div key={bookTitle} className="group bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                      <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Book size={14} className="text-gray-400 sm:w-4 sm:h-4" />
                          <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-sm">
                            {bookTitle}
                          </h4>
                          <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] sm:text-xs rounded-full">
                            {words.length}
                          </span>
                        </div>
                        <button
                          onClick={() => exportNewWords(words[0]?.bookId)}
                          className="text-[10px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center gap-1"
                        >
                          <Download size={12} />
                          导出
                        </button>
                      </div>
                      
                      <div className="p-3 sm:p-4">
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {words.slice(0, 15).map((word, idx) => (
                            <div
                              key={idx}
                              className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-200/50 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors cursor-default group/word relative"
                            >
                              <span className="font-medium text-gray-700 dark:text-gray-200">{word.word}</span>
                              {word.translation && (
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] sm:text-xs rounded opacity-0 group-hover/word:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 hidden sm:block">
                                  {word.translation.split(/[,;]/)[0]}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </span>
                              )}
                            </div>
                          ))}
                          {words.length > 15 && (
                            <div className="text-xs sm:text-sm text-gray-400 px-2 py-1 flex items-center">
                              +{words.length - 15} ...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WebDAV 同步 */}
          {activeTab === 'webdav' && (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-blue-50 dark:bg-blue-900/10 p-3 sm:p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 mt-0.5">
                    <Cloud size={16} className="sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-lg font-semibold text-blue-900 dark:text-blue-100">多端同步</h3>
                    <p className="text-xs sm:text-sm text-blue-700/80 dark:text-blue-300/80 mt-0.5 sm:mt-1 leading-relaxed">
                      配置 WebDAV 服务，在你的所有设备间实时同步阅读进度、生词本和已掌握词汇。
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div className="space-y-3 sm:space-y-4">
                  <div className="group">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      服务器地址 (URL)
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      <input
                        type="text"
                        value={webdavConfig.url}
                        onChange={(e) => setWebdavConfig({ ...webdavConfig, url: e.target.value })}
                        placeholder={`${window.location.origin}/webdav-proxy/`}
                        className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        用户名
                      </label>
                      <input
                        type="text"
                        value={webdavConfig.username}
                        onChange={(e) => setWebdavConfig({ ...webdavConfig, username: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        密码
                      </label>
                      <input
                        type="password"
                        value={webdavConfig.password}
                        onChange={(e) => setWebdavConfig({ ...webdavConfig, password: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50">
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">自动同步</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">数据变更时自动上传</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={webdavConfig.autoSync}
                      onChange={(e) => setWebdavConfig({ ...webdavConfig, autoSync: e.target.checked })}
                    />
                    <div className="w-9 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveWebDAVConfig}
                    disabled={!webdavConfig.username}
                    className="flex-1 px-3 py-2 sm:px-4 sm:py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium"
                  >
                    {configSaved ? <Check size={16} className="sm:w-[18px] sm:h-[18px]" /> : null}
                    {configSaved ? '已保存' : '保存配置'}
                  </button>

                  <button
                    onClick={handleTestConnection}
                    disabled={!webdavConfig.username || isTesting}
                    className="flex-1 px-3 py-2 sm:px-4 sm:py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium"
                  >
                    {isTesting ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      '测试连接'
                    )}
                  </button>
                </div>

                {/* 反馈信息 */}
                {(testResult || syncStatus) && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    {testResult && (
                      <div className={`p-2 sm:p-3 rounded-lg mb-3 flex items-center gap-2 text-xs sm:text-sm font-medium ${
                        testResult === 'success'
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {testResult === 'success' ? <CheckCircle size={14} className="sm:w-4 sm:h-4" /> : <X size={14} className="sm:w-4 sm:h-4" />}
                        {testResult === 'success' ? '连接成功，配置有效' : '连接失败，请检查配置'}
                      </div>
                    )}

                    {syncStatus && (
                      <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`p-1.5 rounded-full ${
                            syncStatus === 'syncing' ? 'bg-blue-100 text-blue-600' :
                            syncStatus === 'success' ? 'bg-green-100 text-green-600' :
                            syncStatus === 'error' ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                             {syncStatus === 'syncing' ? <Loader2 size={14} className="animate-spin sm:w-4 sm:h-4" /> :
                              syncStatus === 'success' ? <Check size={14} className="sm:w-4 sm:h-4" /> :
                              syncStatus === 'error' ? <X size={14} className="sm:w-4 sm:h-4" /> : <Cloud size={14} className="sm:w-4 sm:h-4" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                              {syncStatus === 'syncing' ? '正在同步...' :
                               syncStatus === 'success' ? '同步完成' :
                               syncStatus === 'error' ? '同步出错' : '准备就绪'}
                            </span>
                            {syncProgress?.message && (
                              <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{syncProgress.message}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={handleManualSync}
                          disabled={!webdavConfig.url || syncStatus === 'syncing'}
                          className="p-1.5 sm:p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title="立即同步"
                        >
                          <RefreshCw size={16} className={`sm:w-[18px] sm:h-[18px] ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 主题设置 */}
          {activeTab === 'theme' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {[
                  { mode: 'light', icon: Sun, label: '浅色模式', desc: '清晰明亮' },
                  { mode: 'dark', icon: Moon, label: '深色模式', desc: '舒适护眼' },
                ].map((theme) => (
                  <button
                    key={theme.mode}
                    onClick={() => setThemeMode(theme.mode as any)}
                    className={`flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border-2 transition-all duration-200 ${
                      themeMode === theme.mode
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full mb-2 sm:mb-3 flex items-center justify-center ${
                      themeMode === theme.mode 
                        ? 'bg-indigo-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      <theme.icon size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <h4 className={`font-bold text-sm sm:text-base ${themeMode === theme.mode ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-white'}`}>
                      {theme.label}
                    </h4>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">{theme.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
