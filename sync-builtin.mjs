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
const endMark = '\n};\n';
const end = html.indexOf(endMark, start);
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
// 关键：tail 必须从结束符之后开始，否则每同步一次就会多拼一个 };
const tail = html.slice(end + endMark.length).replace(/^[\r\n]+/, '\n\n');
html = html.slice(0, start) + newBlock + tail;

// 写盘前自检：内联 JS 必须语法合法（2026-09-09 事故：多余 }; 导致整段脚本被浏览器跳过）
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  try {
    new Function(scriptMatch[1]);
  } catch (e) {
    console.error('❌ 同步后内联 JS 语法错误，已中止写盘：' + e.message);
    console.error('   原文件未改动，请检查 index.html 中 BUILTIN 定义段');
    process.exit(1);
  }
}

writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log(`✅ index.html 内置词库已同步：${dict.words.length} 词 / ${dict.variants.length} 变体组`);
console.log('✅ 内联 JS 语法自检通过');
