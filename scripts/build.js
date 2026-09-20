/**
 * build.js — 批量构建：扫描 data/*.txt → 生成对应 .json + index.json
 * 用法: node scripts/build.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TXT_DIR = path.join(DATA_DIR, 'txt');
const JSON_DIR = path.join(DATA_DIR, 'json');
const ANNOTATION_RE = /([\w'-]+)\((\/[^)]+\/);([^)]+)\)/g;

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
  let match;
  ANNOTATION_RE.lastIndex = 0;
  while ((match = ANNOTATION_RE.exec(workLine)) !== null) {
    keyWords.push({
      word: match[1].toLowerCase(),
      phonetic: match[2],
      meaning_cn: match[3],
      fullMatch: match[0],
    });
  }

  // 去除标注得到干净句子
  let cleanText = workLine;
  for (const kw of keyWords) {
    cleanText = cleanText.replace(kw.fullMatch, kw.word);
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
    const output = { version: '1.0', generatedAt: new Date().toISOString(), ...data };
    fs.writeFileSync(path.join(JSON_DIR, id + '.json'), JSON.stringify(output, null, 2), 'utf-8');

    const name = id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    index.libraries.push({ id, name, cardCount: data.cardCount });
    console.log(`✅ ${id}: ${data.cardCount} 句`);
  }
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`\n📦 共 ${index.libraries.length} 个语库`);
}

build();
