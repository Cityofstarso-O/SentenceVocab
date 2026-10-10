/**
 * clear-gist-overrides.js — 清理 Gist 中的反馈覆盖数据
 * 用法: node scripts/clear-gist-overrides.js ghp_your_token
 * 作用: 把所有 sv_overrides_* 键设为空对象 {}，手机端下次拉取后自动清除本地反馈
 *       无需在手机上手动点「清除已处理的反馈」
 */
const token = process.argv[2];
if (!token) {
  console.error('用法: node scripts/clear-gist-overrides.js <gist_token>');
  process.exit(1);
}

const API = 'https://api.github.com/gists';

async function findGistId() {
  const res = await fetch(`${API}?per_page=100`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error(`查找 Gist 失败: ${res.status}`);
  const gists = await res.json();
  const found = gists.find(g => g.files && g.files['progress.json']);
  return found ? found.id : null;
}

async function main() {
  console.log('正在查找 Gist...');
  const gistId = await findGistId();
  if (!gistId) { console.error('未找到含 progress.json 的 Gist'); process.exit(1); }
  console.log(`找到 Gist: ${gistId}`);

  // 拉取当前内容
  const gistRes = await fetch(`${API}/${gistId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const gist = await gistRes.json();
  const data = JSON.parse(gist.files['progress.json'].content);

  // 把所有 sv_overrides_* 键设为空对象
  let clearedCount = 0;
  for (const key of Object.keys(data)) {
    if (key.startsWith('sv_overrides_')) {
      data[key] = '{}';
      clearedCount++;
    }
  }

  if (clearedCount === 0) {
    console.log('Gist 中没有反馈覆盖数据，无需清理');
    return;
  }

  // 推送回 Gist
  const patchRes = await fetch(`${API}/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: { 'progress.json': { content: JSON.stringify(data, null, 2) } },
    }),
  });
  if (!patchRes.ok) throw new Error(`推送失败: ${patchRes.status}`);

  console.log(`✅ 已清理 ${clearedCount} 个语库的反馈覆盖`);
  console.log('手机端下次「从云端拉取」后，本地反馈将自动清除');
}

main().catch(e => { console.error(e.message); process.exit(1); });
