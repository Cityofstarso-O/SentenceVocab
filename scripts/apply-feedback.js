/**
 * apply-feedback.js — 将反馈应用到 txt 文件
 * 用法: node scripts/apply-feedback.js
 * 输入: data/feedback.json（由 fetch-feedback.js 生成）
 * 输出: 修改 data/txt/*.txt
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TXT_DIR = path.join(DATA_DIR, 'txt');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const ANNOTATION_RE = /([\w'-]+)\((\/[^)]+\/);([^)]+)\)/g;

if (!fs.existsSync(FEEDBACK_FILE)) {
  console.error('未找到 data/feedback.json，请先运行 fetch-feedback.js');
  process.exit(1);
}

const overrides = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));

function applyKeyWordsToLine(line, keyWords) {
  // 去除所有标注得到干净句子
  let cleanLine = line;
  ANNOTATION_RE.lastIndex = 0;
  let match;
  while ((match = ANNOTATION_RE.exec(line)) !== null) {
    cleanLine = cleanLine.replace(match[0], match[1]);
  }

  let sentence = cleanLine;
  let translation = '';
  const transMatch = cleanLine.match(/\s\|\s(.+)$/);
  if (transMatch) {
    sentence = cleanLine.replace(/\s\|\s.+$/, '').trim();
    translation = ' | ' + transMatch[1];
  }

  // 在句子上重新标注目标 keyWords
  const words = sentence.split(/\s+/);
  const annotated = words.map(w => {
    const clean = w.replace(/[.,;:!?"'()]/g, '').toLowerCase();
    const kw = keyWords.find(k => k.word.toLowerCase() === clean);
    if (kw) {
      if (kw.phonetic && kw.meaning_cn) {
        return `${w}(${kw.phonetic};${kw.meaning_cn})`;
      } else {
        return `${w}(TODO;待补充)`;
      }
    }
    return w;
  }).join(' ');

  return annotated + translation;
}

function applyIssuesToLine(line, issues) {
  if (!issues || issues.length === 0) return line;
  return line + ' [ISSUE:' + issues.join('|') + ']';
}

function processLibrary(libId, cards) {
  const txtPath = path.join(TXT_DIR, libId + '.txt');
  if (!fs.existsSync(txtPath)) {
    console.log(`  ⚠️ 跳过 ${libId}: txt 不存在`);
    return;
  }

  const lines = fs.readFileSync(txtPath, 'utf-8').split(/\r?\n/);
  let changed = 0;
  let todoCount = 0;

  for (const [cardIdStr, data] of Object.entries(cards)) {
    const lineIdx = parseInt(cardIdStr) - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) {
      console.log(`  ⚠️ 卡片 ${cardIdStr} 超出行范围`);
      continue;
    }

    let line = lines[lineIdx];
    const original = line;

    if (data.keyWords) {
      line = applyKeyWordsToLine(line, data.keyWords);
      if (line.includes('(TODO;待补充)')) todoCount++;
    }
    if (data.issues) {
      line = applyIssuesToLine(line, data.issues);
    }

    if (line !== original) {
      lines[lineIdx] = line;
      changed++;
      console.log(`  卡片 ${cardIdStr} (第 ${lineIdx+1} 行): 已修改`);
      if (data.keyWords) {
        const newKw = data.keyWords.filter(k => !k.phonetic).map(k => k.word);
        if (newKw.length) console.log(`    新增生词(待补): ${newKw.join(', ')}`);
      }
      if (data.issues) console.log(`    问题: ${data.issues.join(', ')}`);
    }
  }

  fs.writeFileSync(txtPath, lines.join('\n'), 'utf-8');
  console.log(`  ✅ ${libId}: 修改 ${changed} 行${todoCount ? `, ${todoCount} 行有 TODO` : ''}`);
}

console.log('=== 应用反馈到 txt ===\n');
for (const [libId, cards] of Object.entries(overrides)) {
  console.log(`\n${libId}:`);
  processLibrary(libId, cards);
}

// 清理临时文件
fs.unlinkSync(FEEDBACK_FILE);
console.log('\n已清理 data/feedback.json');
console.log('\n下一步:');
console.log('  1. 检查 txt 中标记 TODO 的行，手动补充音标释义');
console.log('  2. 检查 [ISSUE:...] 标记的行，手动处理问题');
console.log('  3. node scripts/build.js 重新生成 JSON');
console.log('  4. git add . && git commit -m "fix: apply feedback" && git push');
