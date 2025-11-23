#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 引用形式的正则模式
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

// 解析词典文件
function parseDictFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // 提取 export const dict = { ... } 中的内容
  const match = content.match(/export\s+const\s+dict\s*=\s*{([\s\S]+)};?\s*$/m);
  if (!match) {
    throw new Error(`无法解析词典文件: ${filePath}`);
  }

  const dictContent = match[1];
  const dict = {};

  // 逐行解析 "key": "value", 格式
  const lines = dictContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // 匹配 "key": "value", 或 "key": "value"
    const entryMatch = trimmed.match(/^"([^"]+)":\s*"([^"]*)"[,]?$/);
    if (entryMatch) {
      const [, word, definition] = entryMatch;
      dict[word] = definition;
    }
  }

  return dict;
}

// 清理基础词(去掉词性标记和多余空格)
function cleanBaseWord(baseWord) {
  // 去掉音标
  let cleaned = baseWord.replace(/^\/[^/]+\/\s*/, '');

  // 去掉词性标记 (n., v., a., ad., vt., vi., prep., conj. 等)
  cleaned = cleaned.replace(/^(n|v|a|ad|vt|vi|prep|conj|pron|num|int|aux|abbr|art)\.\s*/i, '');

  // 去掉首尾空格
  cleaned = cleaned.trim();

  return cleaned;
}

// 检查定义是否为引用形式
function parseReference(definition) {
  for (const { pattern, type } of REFERENCE_PATTERNS) {
    const match = definition.match(pattern);
    if (match) {
      const rawBaseWord = match[1];
      const cleanedBaseWord = cleanBaseWord(rawBaseWord);
      return { baseWord: cleanedBaseWord, rawBaseWord, type };
    }
  }
  return null;
}

// 检查定义是否已经是完整定义(包含音标或多个部分)
function hasFullDefinition(definition, refType) {
  // 检查是否只是"音标 + 引用"格式(如"/bi:mz/ beam的名词复数")
  const phoneticRefPattern = new RegExp(`^\/[^/]+\/\\s+[^,，;；。.]+的${refType}$`);
  if (phoneticRefPattern.test(definition)) {
    return false; // 这只是音标+引用,不是完整定义
  }

  // 如果以音标开头且后面有实质性内容,则认为是完整定义
  if (definition.startsWith('/')) {
    return true;
  }

  // 检查是否只是简单的引用(如"display的现在分词")
  const simpleRefPattern = new RegExp(`^[^,，;；。.]+的${refType}$`);
  if (simpleRefPattern.test(definition)) {
    return false;
  }

  // 如果包含中文且不是简单引用,则认为是完整定义
  return /[\u4e00-\u9fa5]/.test(definition);
}

// 提取基础定义(去掉音标,保留主要释义)
function extractCoreDefinition(definition) {
  // 移除音标部分
  const withoutPhonetic = definition.replace(/^\/[^/]+\/\s*/, '');
  return withoutPhonetic.trim();
}

// 补全词典
function expandDictionary(dict) {
  const stats = {
    total: 0,
    references: 0,
    expanded: 0,
    alreadyFull: 0,
    baseNotFound: 0,
    byType: {}
  };

  const newDict = {};

  for (const [word, definition] of Object.entries(dict)) {
    stats.total++;

    const ref = parseReference(definition);

    if (!ref) {
      // 不是引用形式,直接保留
      newDict[word] = definition;
      continue;
    }

    stats.references++;
    stats.byType[ref.type] = (stats.byType[ref.type] || 0) + 1;

    // 检查是否已经有完整定义
    if (hasFullDefinition(definition, ref.type)) {
      stats.alreadyFull++;
      newDict[word] = definition;
      continue;
    }

    // 查找基础词的定义
    const baseDefinition = dict[ref.baseWord];

    if (!baseDefinition) {
      stats.baseNotFound++;
      newDict[word] = definition; // 保留原定义
      continue;
    }

    // 如果基础词本身也是引用,不处理
    if (parseReference(baseDefinition)) {
      newDict[word] = definition;
      continue;
    }

    // 补全定义
    const coreDefinition = extractCoreDefinition(baseDefinition);

    // 检查原定义是否有音标
    const phoneticMatch = definition.match(/^(\/[^/]+\/)\s+/);
    let expandedDefinition;

    if (phoneticMatch) {
      // 保留原有音标
      expandedDefinition = `${phoneticMatch[1]} ${coreDefinition} (${ref.baseWord}的${ref.type})`;
    } else {
      // 没有音标,直接补全
      expandedDefinition = `${coreDefinition} (${ref.baseWord}的${ref.type})`;
    }

    newDict[word] = expandedDefinition;
    stats.expanded++;
  }

  return { dict: newDict, stats };
}

// 生成词典文件内容
function generateDictFile(dict) {
  const entries = Object.entries(dict)
    .map(([word, definition]) => {
      // 转义定义中的引号和反斜杠
      const escapedDef = definition.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `    "${word}": "${escapedDef}"`;
    })
    .join(',\n');

  return `export const dict = {\n${entries}\n};\n`;
}

// 处理单个词典文件
function processDictFile(inputPath, outputPath) {
  console.log(`\n处理: ${inputPath}`);
  console.log('='.repeat(60));

  // 读取和解析
  const dict = parseDictFile(inputPath);
  console.log(`读取词条: ${Object.keys(dict).length} 个`);

  // 补全
  const { dict: expandedDict, stats } = expandDictionary(dict);

  // 输出统计
  console.log(`\n统计信息:`);
  console.log(`  总词条数: ${stats.total}`);
  console.log(`  引用形式词条: ${stats.references}`);
  console.log(`  已有完整定义: ${stats.alreadyFull}`);
  console.log(`  找不到原形词: ${stats.baseNotFound}`);
  console.log(`  成功补全: ${stats.expanded}`);

  console.log(`\n各类型补全数量:`);
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`  ${type}: ${count} 个`);
  }

  // 写入文件
  const output = generateDictFile(expandedDict);
  writeFileSync(outputPath, output, 'utf-8');
  console.log(`\n已保存到: ${outputPath}`);

  return stats;
}

// 主函数
function main() {
  const dictsDir = join(__dirname, '../dicts');

  console.log('开始补全词典定义...\n');

  // 处理 dict-small.js
  const smallStats = processDictFile(
    join(dictsDir, 'dict-small.js'),
    join(dictsDir, 'dict-small.js')
  );

  // 处理 dict-large.js
  const largeStats = processDictFile(
    join(dictsDir, 'dict-large.js'),
    join(dictsDir, 'dict-large.js')
  );

  console.log('\n' + '='.repeat(60));
  console.log('总计:');
  console.log(`  dict-small.js 补全: ${smallStats.expanded} 个词条`);
  console.log(`  dict-large.js 补全: ${largeStats.expanded} 个词条`);
  console.log(`  合计补全: ${smallStats.expanded + largeStats.expanded} 个词条`);
  console.log('\n备份文件位于: dicts/backups/');
  console.log('完成!');
}

main();
