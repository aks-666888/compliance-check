// 同步 words.json → index.html 内置词库（保证单文件双击即用全量词库）
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dict = JSON.parse(readFileSync(path.join(__dirname, 'dict', 'words.json'), 'utf8'));
let html = readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const startMark = 'const BUILTIN = {';
const start = html.indexOf(startMark);
if (start === -1) { console.error('未找到 BUILTIN 定义段'); process.exit(1); }
const end = html.indexOf('\n};\n', start);
if (end === -1) { console.error('未找到 BUILTIN 结束段'); process.exit(1); }

const builtin = {
  meta: dict.meta,
  platforms: dict.platforms,
  industries: dict.industries,
  words: dict.words,
  variants: dict.variants,
  ai_annotation: dict.ai_annotation,
  checklist: dict.checklist
};
const jsonStr = JSON.stringify(builtin, null, 2);
const newBlock = 'const BUILTIN = ' + jsonStr + ';\n\n';
const tail = html.slice(end);
html = html.slice(0, start) + newBlock + tail;
writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log(`✅ index.html 内置词库已同步：${dict.words.length} 词 / ${dict.variants.length} 变体组`);
