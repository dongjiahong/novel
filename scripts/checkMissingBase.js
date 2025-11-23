#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REFERENCE_PATTERNS = [
  { pattern: /^(.+)的复数$/, type: '复数' },
  { pattern: /^(.+)的名词复数$/, type: '名词复数' },
  { pattern: /^(.+)的现在分词$/, type: '现在分词' },
  { pattern: /^(.+)的ing形式$/, type: 'ing形式' },
  { pattern: /^(.+)的过去式$/, type: '过去式' },
  { pattern: /^(.+)的过去分词$/, type: '过去分词' },
  { pattern: /^(.+)的变形$/, type: '变形' },
  { pattern: /^(.+)的比较级$/, type: '比较级' },
  { pattern: /^(.+)的最高级$/, type: '最高级' },
];

function parseDictFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/export\s+const\s+dict\s*=\s*{([\s\S]+)};?\s*$/m);
  if (!match) throw new Error(`无法解析: ${filePath}`);

  const dictContent = match[1];
  const dict = {};
  const lines = dictContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const entryMatch = trimmed.match(/^"([^"]+)":\s*"([^"]*)"[,]?$/);
    if (entryMatch) {
      dict[entryMatch[1]] = entryMatch[2];
    }
  }

  return dict;
}

function parseReference(definition) {
  for (const { pattern, type } of REFERENCE_PATTERNS) {
    const match = definition.match(pattern);
    if (match) {
      return { baseWord: match[1], type };
    }
  }
  return null;
}

const dict = parseDictFile(join(__dirname, '../dicts/dict-small.js'));

const missing = [];
for (const [word, definition] of Object.entries(dict)) {
  const ref = parseReference(definition);
  if (ref && !dict[ref.baseWord]) {
    missing.push({ word, baseWord: ref.baseWord, type: ref.type, definition });
  }
}

console.log(`找到 ${missing.length} 个缺失原形词的情况`);
console.log('\n前20个例子:');
missing.slice(0, 20).forEach((item, i) => {
  console.log(`${i + 1}. ${item.word} <- 缺失: ${item.baseWord} (${item.type})`);
  console.log(`   定义: ${item.definition}`);
});
