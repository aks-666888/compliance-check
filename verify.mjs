// 文案安检 · 发布前校验 v0.3.2（node）
// 背景：2026-09-09 事故——index.html 内联 JS 因多余 }; 整段被浏览器跳过，
//       而 smoke-test.mjs 只测自己复制的逻辑 + words.json，不加载 index.html，
//       所以「32 用例全过」依然发布了一个坏工具。
// 本脚本补上这道缺口：校验**真正交付的 index.html 本身**能被浏览器执行。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let fail = 0;
const ok = (m) => console.log('  ✅ ' + m);
const bad = (m) => { console.log('  ❌ ' + m); fail++; };

console.log('文案安检 · 发布前校验\n');

// 1. 内联 JS 语法（最关键：语法错 → 整段脚本被跳过 → 工具全瘫）
const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) {
  bad('未找到内联 <script> 段');
} else {
  try {
    new Function(jsMatch[1]);
    ok('内联 JS 语法合法（浏览器会真正执行）');
  } catch (e) {
    bad('内联 JS 语法错误：' + e.message);
  }
}

// 2. BUILTIN 结束符唯一（防止 sync-builtin 重复追加 };）
const bStart = html.indexOf('const BUILTIN');
const dStart = html.indexOf('let DICT');
if (bStart === -1 || dStart === -1) {
  bad('未找到 BUILTIN / DICT 定义');
} else {
  const seg = html.slice(bStart, dStart);
  const closes = (seg.match(/\n\};\n/g) || []).length;
  if (closes === 1) ok('BUILTIN 结束符唯一（1 个 };）');
  else bad(`BUILTIN 结束符异常：${closes} 个 };（应为 1，多出的多半是 sync 重复追加）`);
}

// 3. 内置词库与 dict/words.json 一致
try {
  const dict = JSON.parse(readFileSync(path.join(__dirname, 'dict', 'words.json'), 'utf8'));
  const s = html.indexOf('const BUILTIN = ');
  const e = html.indexOf('\nlet DICT');
  if (s === -1 || e === -1) bad('无法定位内置 BUILTIN');
  else {
    let raw = html.slice(s + 'const BUILTIN = '.length, e).trim();
    while (raw.endsWith(';')) raw = raw.slice(0, -1);
    const builtin = JSON.parse(raw);
    const bw = builtin.words.length, dw = dict.words.length;
    if (bw === dw) ok(`内置词库与 words.json 一致（${bw} 词）`);
    else bad(`词库不一致：内置 ${bw} 词 vs words.json ${dw} 词（需运行 sync-builtin.mjs）`);
  }
} catch (e) {
  bad('词库比对失败：' + e.message);
}

// 4. 关键交互函数存在（保证按钮点得动）
for (const fn of ['runCheck', 'loadSample']) {
  if (new RegExp(`function\\s+${fn}\\b`).test(jsMatch ? jsMatch[1] : '')) ok(`函数 ${fn} 已定义`);
  else bad(`函数 ${fn} 缺失`);
}

console.log('\n' + (fail === 0 ? '✅ 全部通过，可发布' : `❌ ${fail} 项未通过，禁止发布`));
process.exit(fail === 0 ? 0 : 1);
