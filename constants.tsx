
import { Book, VocabularyLevel } from './types';

export const MOCK_BOOKS: Book[] = [];

// 阅读主题配置
export const READING_THEMES = {
  light: {
    name: 'Light',
    background: '#ffffff',
    text: '#0f172a', // slate-900
  },
  dark: {
    name: 'Dark',
    background: '#020617', // slate-950
    text: '#f8fafc', // slate-50
  },
  'solarized-light': {
    name: 'Solarized Light',
    background: '#fdf6e3',
    text: '#657b83',
  },
  'solarized-dark': {
    name: 'Solarized Dark',
    background: '#002b36',
    text: '#839496',
  },
} as const;

// 可用的词汇等级配置
export const VOCABULARY_LEVELS: VocabularyLevel[] = [
  {
    id: 'junior-2000',
    name: '中考-2000',
    fileName: '中考-2000.txt',
    wordCount: 2000,
    description: '初中毕业水平，基础词汇'
  },
  {
    id: 'common-3000',
    name: '常用-3000',
    fileName: '常用-3000.txt',
    wordCount: 3000,
    description: '日常交流必备词汇'
  },
  {
    id: 'cet4-4600',
    name: 'CET4-4600',
    fileName: 'CET4-4600.txt',
    wordCount: 4600,
    description: '大学英语四级词汇'
  },
  {
    id: 'cet6-2200',
    name: 'CET6-2200',
    fileName: 'CET6-2200.txt',
    wordCount: 2200,
    description: '大学英语六级词汇（额外）'
  },
  {
    id: 'common-5000',
    name: '常用-5000',
    fileName: '常用-5000.txt',
    wordCount: 5000,
    description: '高频常用词汇扩展'
  },
  {
    id: 'toefl-4500',
    name: 'TOEFL-4500',
    fileName: 'TOEFL-4500.txt',
    wordCount: 4500,
    description: '托福考试词汇'
  },
  {
    id: 'gre-8000',
    name: 'GRE-8000',
    fileName: 'GRE-8000.txt',
    wordCount: 8000,
    description: 'GRE考试词汇'
  },
  {
    id: 'common-8000',
    name: '常用-8000',
    fileName: '常用-8000.txt',
    wordCount: 8000,
    description: '高级常用词汇'
  },
  {
    id: 'tem-13000',
    name: '英语专业四八级-13000',
    fileName: '英语专业四八级-13000.txt',
    wordCount: 13000,
    description: '英语专业四八级词汇'
  }
];

// 默认词汇等级
export const DEFAULT_VOCABULARY_LEVEL = 'junior-2000';
