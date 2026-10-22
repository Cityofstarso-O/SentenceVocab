/**
 * build.js — 批量构建：扫描 data/*.txt → 生成对应 .json + index.json
 * 用法: node scripts/build.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TXT_DIR = path.join(DATA_DIR, 'txt');
const JSON_DIR = path.join(DATA_DIR, 'json');
// 标注格式两种（均紧跟在关键词最后一个词后面，半角括号、无空格）：
//   单词:  word(/ˈwɜːd/;释义)
//   词组:  some words(2;/fɜːz/;释义)   ← 音标前的数字 = 关键词由几个词组成，缺省视为 1
const ANNOTATION_RE = /\((\d+;)?(\/[^)]+\/);([^)]+)\)/g;

/** 从标注左边界向前取 count 个词，返回 { text, start }；词不够时回退到 1 个词；找不到词返回空 */
function takeWordsBefore(workLine, openIdx, count) {
  for (let n = count; n >= 1; n--) {
    const re = new RegExp('(?:[\\p{L}\\p{N}_\'-]+\\s+){' + (n - 1) + '}[\\p{L}\\p{N}_\'-]+\\s*$', 'u');
    const m = workLine.slice(0, openIdx).match(re);
    if (m) {
      return { text: m[0].trim(), start: openIdx - m[0].length };
    }
  }
  return { text: '', start: openIdx };
}

function parseLine(line) {
  // 提取翻译
  let translation = null;
  let workLine = line;
  const transMatch = line.match(/\s\|\s(.+)$/);
  if (transMatch) {
    translation = transMatch[1];
    workLine = line.replace(/\s\|\s.+$/, '');
  }

  // 提取标注
  const keyWords = [];
  const orphans = []; // 括号前找不到关键词的标注（如挂在标点后），仅从展示文本中剔除
  let match;
  ANNOTATION_RE.lastIndex = 0;
  while ((match = ANNOTATION_RE.exec(workLine)) !== null) {
    const count = match[1] ? parseInt(match[1], 10) : 1;
    const { text, start } = takeWordsBefore(workLine, match.index, count);
    const fullMatch = workLine.slice(start, match.index + match[0].length);
    if (!text) {
      orphans.push(fullMatch);
      continue;
    }
    keyWords.push({
      word: text.toLowerCase(),
      phonetic: match[2],
      meaning_cn: match[3],
      fullMatch,
    });
  }

  // 去除标注得到干净句子
  let cleanText = workLine;
  for (const kw of keyWords) {
    cleanText = cleanText.replace(kw.fullMatch, kw.word);
  }
  for (const o of orphans) {
    cleanText = cleanText.replace(o, '');
  }
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  // 首字母大写
  if (cleanText.length > 0) {
    cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
  }

  // keyWords 只保留 word/phonetic/meaning_cn
  const cleanKeyWords = keyWords.map(k => ({
    word: k.word,
    phonetic: k.phonetic,
    meaning_cn: k.meaning_cn,
  }));

  return { text: cleanText, keyWords: cleanKeyWords, translation };
}

function buildFile(txtPath) {
  const raw = fs.readFileSync(txtPath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const cards = [];
  let id = 0;

  for (const line of lines) {
    id++;
    const parsed = parseLine(line);
    cards.push({ id, ...parsed });
  }
  return { cards, cardCount: cards.length };
}

function build() {
  const files = fs.readdirSync(TXT_DIR).filter(f => f.endsWith('.txt'));
  const index = { libraries: [] };

  for (const file of files) {
    const id = file.replace('.txt', '');
    const data = buildFile(path.join(TXT_DIR, file));
    const output = { version: '1.0', ...data };
    fs.writeFileSync(path.join(JSON_DIR, id + '.json'), JSON.stringify(output, null, 2), 'utf-8');

    const name = id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    index.libraries.push({ id, name, cardCount: data.cardCount });
    console.log(`✅ ${id}: ${data.cardCount} 句`);
  }
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`\n📦 共 ${index.libraries.length} 个语库`);
}

module.exports = { parseLine, buildFile };

if (require.main === module) {
  build();
}
