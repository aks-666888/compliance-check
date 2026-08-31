// 文案安检 · 冒烟测试脚本 v0.2（node）
// 验证：词库命中 / 平台语境 / 变体词 / 行业筛选 / 自定义词 / 批量拆分 / 异常输入
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dict = JSON.parse(readFileSync(path.join(__dirname, 'dict', 'words.json'), 'utf8'));

// ===== 与 index.html 相同的逻辑（同步维护）=====
const VARIANTS = dict.variants;
function norm(s) { return s.replace(/[\s✨❤️💰➕]/g, '').toLowerCase(); }

function detectOne(text, platforms, industries, customWords) {
  const hits = [];
  for (const w of dict.words) {
    if (industries.length > 0 && w.industry && !industries.includes(w.industry)) continue;
    const re = new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ word: w.word, level: w.level, type: w.type, industry: w.industry || '', platform: w.platform || [] });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  for (const v of VARIANTS) {
    for (const pat of v.patterns) {
      if (text.toLowerCase().includes(pat.toLowerCase())) {
        hits.push({ word: v.base, level: 'hard', type: '变体词', industry: '通用', platform: ['小红书', '抖音', '公众号', '视频号'] });
      }
    }
  }
  (customWords || []).forEach(c => {
    if (text.includes(c)) hits.push({ word: c, level: 'soft', type: '自定义词', industry: '', platform: [] });
  });
  return hits.filter(h => {
    if (h.platform.length === 0) return true;
    const inPlat = h.platform.some(p => platforms.includes(p));
    if (h.level === 'context') return inPlat;
    return inPlat;
  });
}

let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const allPlats = ['小红书', '抖音', '公众号', '视频号'];

// ---- 用例 1：示例文案全平台 ----
console.log('\n【用例1】示例文案（全平台）');
const sample = '纯天然蜂蜜，全网最低价，史上最强配方！防癌抗老，加微信领取优惠，v信同号。减✨肥✨药一周见效，稳赚不赔，保本理财，专家推荐，包过必过。直播间有惊喜。';
const h1 = detectOne(sample, allPlats, []);
const types = [...new Set(h1.map(h => h.word))];
console.log(`  命中 ${h1.length} 处`);
assert('命中数 >= 12', h1.length >= 12, `实际 ${h1.length}`);
['最', '史上', '加微信', '稳赚不赔', '保本', '防癌', '包过', '全网最低', '纯天然'].forEach(w => {
  assert(`词「${w}」命中`, h1.some(h => h.word === w));
});
assert('变体「v信」命中', h1.some(h => h.type === '变体词' && h.word === '微信'));
assert('变体「减✨肥✨药」命中', h1.some(h => h.type === '变体词' && h.word === '减肥'));

// ---- 用例 2：平台语境 ----
console.log('\n【用例2】平台语境判定');
const s2 = '今晚8点直播间见';
assert('小红书：直播间=场景相关', detectOne(s2, ['小红书'], []).some(h => h.word === '直播间' && h.level === 'context'));
assert('抖音：直播间不命中', !detectOne(s2, ['抖音'], []).some(h => h.word === '直播间'));

// ---- 用例 3：变体词（v0.2 新增扫码变体）----
console.log('\n【用例3】变体词识别');
const s3 = '加V领取资料，zhuan米找我，扫码加我s码';
const h3 = detectOne(s3, allPlats, []);
assert('拼音变体 zhuan米 命中', h3.some(h => h.type === '变体词' && h.word === '赚钱'));
assert('加v 变体命中', h3.some(h => h.type === '变体词' && h.word === '加微信'));
assert('s码 变体命中（扫码）', h3.some(h => h.type === '变体词' && h.word === '扫码'));

// ---- 用例 4：行业筛选 ----
console.log('\n【用例4】行业筛选');
const s4 = '这款祛斑霜能立刻见效，美白提亮，保本理财也行';
const hAll = detectOne(s4, allPlats, []);
assert('全行业：医疗词+美妆词+财经词都命中', hAll.some(h => h.word === '祛斑') && hAll.some(h => h.word === '美白') && hAll.some(h => h.word === '保本'));
const hMZ = detectOne(s4, allPlats, ['美妆']);
assert('仅美妆行业：祛斑/美白命中、保本不命中', hMZ.some(h => h.word === '祛斑') && hMZ.some(h => h.word === '美白') && !hMZ.some(h => h.word === '保本'));

// ---- 用例 5：自定义词 ----
console.log('\n【用例5】自定义词');
const s5 = '这是我们家的王牌产品，认准我们品牌';
const h5 = detectOne(s5, allPlats, [], ['王牌', '品牌']);
assert('自定义词命中', h5.some(h => h.type === '自定义词' && h.word === '王牌'));

// ---- 用例 6：批量拆分（与页面 split 逻辑一致）----
console.log('\n【用例6】批量拆分');
const batch = '第一篇说最便宜\n---\n第二篇说包过\n---\n第三篇正常内容';
const parts = batch.split(/\n\s*-{3,}\s*\n/).map(s => s.trim()).filter(Boolean);
assert('拆出 3 篇', parts.length === 3, `实际 ${parts.length}`);
const r1 = detectOne(parts[0], allPlats, []);
const r2 = detectOne(parts[1], allPlats, []);
const r3 = detectOne(parts[2], allPlats, []);
assert('第1篇命中「最」', r1.some(h => h.word === '最'));
assert('第2篇命中「包过」', r2.some(h => h.word === '包过'));
assert('第3篇 0 命中', r3.length === 0);

// ---- 用例 7：异常输入 ----
console.log('\n【用例7】异常输入');
assert('空文本 0 命中', detectOne('', allPlats, []).length === 0);
assert('emoji 堆叠 0 命中', detectOne('✨❤️💰'.repeat(20), allPlats, []).length === 0);
assert('2 万字长文本不抛错', detectOne('正常内容'.repeat(6000), allPlats, []).length === 0);

// ---- 用例 8：词库完整性（v0.2：industry 覆盖）----
console.log('\n【用例8】词库完整性');
assert('meta/words/industries 结构齐全', !!dict.meta && Array.isArray(dict.words) && Array.isArray(dict.industries));
const lvSet = new Set(dict.words.map(w => w.level));
assert('三级分级齐全', ['hard', 'soft', 'context'].every(l => lvSet.has(l)));
assert('全词条有替换建议', dict.words.every(w => !!w.replace));
assert('全词条有行业分类', dict.words.every(w => !!w.industry && dict.industries.includes(w.industry)));
assert('词条数 >= 30', dict.words.length >= 30, `实际 ${dict.words.length}`);

console.log(`\n==== 冒烟测试 v0.2 结果：${pass} 通过 / ${fail} 失败 ====`);
process.exit(fail ? 1 : 0);
