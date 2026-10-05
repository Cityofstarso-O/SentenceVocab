/**
 * fetch-feedback.js — 从 Gist 拉取反馈数据
 * 用法: node scripts/fetch-feedback.js ghp_your_token
 * 输出: data/feedback.json（临时文件）
 */
const fs = require('fs');
const path = require('path');

const token = process.argv[2];
if (!token) {
  console.error('用法: node scripts/fetch-feedback.js <gist_token>');
  process.exit(1);
}

const API = 'https://api.github.com/gists';
const OUTPUT = path.join(__dirname, '..', 'data', 'feedback.json');

async function main() {
  console.log('正在查找 Gist...');
  const listRes = await fetch(`${API}?per_page=100`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!listRes.ok) { console.error(`查找失败: ${listRes.status}`); process.exit(1); }
  const gists = await listRes.json();
  const found = gists.find(g => g.files && g.files['progress.json']);
  if (!found) { console.error('未找到含 progress.json 的 Gist'); process.exit(1); }
  console.log(`找到 Gist: ${found.id}`);

  const gistRes = await fetch(`${API}/${found.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const gist = await gistRes.json();
  const data = JSON.parse(gist.files['progress.json'].content);

  // 提取 sv_overrides_* 数据
  const overrides = {};
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('sv_overrides_')) {
      overrides[key.replace('sv_overrides_', '')] = JSON.parse(val);
    }
  }

  const libCount = Object.keys(overrides).length;
  let cardCount = 0;
  for (const lib of Object.values(overrides)) cardCount += Object.keys(lib).length;

  if (libCount === 0) { console.log('没有反馈数据'); return; }

  fs.writeFileSync(OUTPUT, JSON.stringify(overrides, null, 2), 'utf-8');
  console.log(`\n✅ 拉取完成: ${libCount} 个语库, ${cardCount} 张卡片有反馈`);
  console.log(`   输出: ${OUTPUT}`);
  console.log('\n反馈概览:');
  for (const [libId, cards] of Object.entries(overrides)) {
    console.log(`  ${libId}: ${Object.keys(cards).length} 张卡片`);
    for (const [cardId, d] of Object.entries(cards)) {
      const parts = [];
      if (d.keyWords) parts.push(`keyWords(${d.keyWords.length})`);
      if (d.issues) parts.push(`issues(${d.issues.length})`);
      console.log(`    卡片 ${cardId}: ${parts.join(', ')}`);
    }
  }
  console.log('\n下一步: node scripts/apply-feedback.js');
}

main().catch(e => { console.error(e.message); process.exit(1); });
