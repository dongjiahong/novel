export const DEVICE_ID_KEY = 'device_id';
export const SYNC_DIRTY_FLAGS_KEY = 'sync_dirty_flags';
export const BOOKS_META_UPDATED_AT_KEY = 'books_meta_updated_at';
export const CONFIG_UPDATED_AT_KEY = 'config_updated_at';

// 新的文件路径
export const CONFIG_PATH = '/novel-reader/config.json';
export const BOOKS_META_PATH = '/novel-reader/books-meta.json';
export const NEW_WORDS_META_PATH = '/novel-reader/new-words-meta.json'; // 生词表元数据
export const NEW_WORDS_DIR = '/novel-reader/new-words'; // 生词表分页文件目录
export const READING_PROGRESS_PATH = '/novel-reader/reading-progress.json';
export const READING_STATS_PATH = '/novel-reader/reading-stats.json';
export const SYNC_METADATA_PATH = '/novel-reader/sync-metadata.json';
export const BOOKS_DIR = '/novel-reader/books';

// 分页配置
export const NEW_WORDS_PAGE_SIZE = 300; // 每页 300 个生词

// 旧的文件路径（用于数据迁移）
export const OLD_SYNC_DATA_PATH = '/novel-reader/data.json';

// 页级时间戳存储 key
export const NEW_WORDS_PAGE_TIMESTAMPS_KEY = 'new_words_page_timestamps';
