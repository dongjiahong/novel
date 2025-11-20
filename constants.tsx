
import { Book, VocabularyLevel } from './types';

export const MOCK_BOOKS: Book[] = [];

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
