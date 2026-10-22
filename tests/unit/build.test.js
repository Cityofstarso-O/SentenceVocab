/**
 * build.test.js — build.js 解析逻辑单元测试（node --test，零依赖）
 * 运行: npm run test:unit
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseLine, buildFile } = require('../../scripts/build.js');

test('提取单个生词标注，还原干净句子', () => {
  const r = parseLine('sit in the vacant(/ˈveɪkənt/;空的) rear seat');
  assert.deepStrictEqual(r.keyWords, [
    { word: 'vacant', phonetic: '/ˈveɪkənt/', meaning_cn: '空的' },
  ]);
  assert.strictEqual(r.text, 'Sit in the vacant rear seat');
  assert.strictEqual(r.translation, null);
});

test('提取多个生词标注', () => {
  const r = parseLine('the vacant(/v1/;空的) house stood on the hill(/h1/;山)');
  assert.strictEqual(r.keyWords.length, 2);
  assert.strictEqual(r.keyWords[0].word, 'vacant');
  assert.strictEqual(r.keyWords[1].word, 'hill');
  assert.strictEqual(r.text, 'The vacant house stood on the hill');
});

test('无标注行：keyWords 为空数组', () => {
  const r = parseLine('one of a kind');
  assert.deepStrictEqual(r.keyWords, []);
  assert.strictEqual(r.text, 'One of a kind');
});

test('翻译分割：| 后为 translation', () => {
  const r = parseLine('one of a kind | 独一无二');
  assert.strictEqual(r.translation, '独一无二');
  assert.strictEqual(r.text, 'One of a kind');
});

test('标注 + 翻译组合', () => {
  const r = parseLine('the vacant(/v1/;空的) seat | 空着的座位');
  assert.strictEqual(r.keyWords.length, 1);
  assert.strictEqual(r.translation, '空着的座位');
  assert.strictEqual(r.text, 'The vacant seat');
});

test('带连字符的词可标注（nerve-wracking）', () => {
  const r = parseLine('the exam was nerve-wracking(/nw/;紧张的)');
  assert.strictEqual(r.keyWords[0].word, 'nerve-wracking');
  assert.strictEqual(r.text, 'The exam was nerve-wracking');
});

test('带撇号的词可标注（don\'t）', () => {
  const r = parseLine("don't(/d1/;不要) give up");
  assert.strictEqual(r.keyWords[0].word, "don't");
  assert.strictEqual(r.text, "Don't give up");
});

test('生词词形保留原句形态，keyWords 记录小写', () => {
  const r = parseLine('she exclaimed(/ɪk/;惊呼) in surprise');
  assert.strictEqual(r.keyWords[0].word, 'exclaimed');
  assert.strictEqual(r.text, 'She exclaimed in surprise');
});

test('多空格规范化 + 首字母大写', () => {
  const r = parseLine('the   vacant(/v1/;空的)  seat');
  assert.strictEqual(r.text, 'The vacant seat');
});

test('括号内无斜杠的普通括号不误判为标注', () => {
  const r = parseLine('he said (twice) nothing');
  assert.deepStrictEqual(r.keyWords, []);
});

test('buildFile：id 递增且跳过空行', () => {
  const tmp = path.join(os.tmpdir(), `sv-test-${Date.now()}.txt`);
  fs.writeFileSync(tmp, 'line one\n\nline two(/w1/;词二)\n   \nline three | 翻译三\n', 'utf-8');
  try {
    const { cards, cardCount } = buildFile(tmp);
    assert.strictEqual(cardCount, 3);
    assert.deepStrictEqual(cards.map(c => c.id), [1, 2, 3]);
    assert.strictEqual(cards[0].text, 'Line one');
    assert.strictEqual(cards[1].keyWords.length, 1);
    assert.strictEqual(cards[2].translation, '翻译三');
  } finally {
    fs.unlinkSync(tmp);
  }
});

// ===== 词组标注格式 (N;/音标;释义)：括号跟最后一个词，向前取 N 个词 =====

test('三词词组：rue the day(3;/…/;…) 向前取 3 个词', () => {
  const r = parseLine('i rue the day(3;/ruː ðə deɪ/;悔不当初) i met him');
  assert.deepStrictEqual(r.keyWords, [
    { word: 'rue the day', phonetic: '/ruː ðə deɪ/', meaning_cn: '悔不当初' },
  ]);
  assert.strictEqual(r.text, 'I rue the day i met him');
});

test('两词词组：stumbled on(2;/…/;…)', () => {
  const r = parseLine('she stumbled on(2;/ˈstʌmbld ɑːn/;偶然发现) the answer');
  assert.strictEqual(r.keyWords[0].word, 'stumbled on');
  assert.strictEqual(r.text, 'She stumbled on the answer');
});

test('显式 1; 的单词标注与缺省写法兼容', () => {
  const explicit = parseLine('the vacant(1;/v1/;空的) seat');
  const implicit = parseLine('the vacant(/v1/;空的) seat');
  assert.deepStrictEqual(explicit.keyWords, implicit.keyWords);
  assert.strictEqual(explicit.keyWords[0].word, 'vacant');
});

test('N 大于可用词数时回退取到句首', () => {
  const r = parseLine('word(3;/w/;词) after');
  assert.strictEqual(r.keyWords[0].word, 'word');
  assert.strictEqual(r.text, 'Word after');
});

test('词组标注 + 翻译组合', () => {
  const r = parseLine('i rue the day(3;/rd/;悔不当初) i met her | 我后悔遇见她');
  assert.strictEqual(r.keyWords[0].word, 'rue the day');
  assert.strictEqual(r.translation, '我后悔遇见她');
  assert.strictEqual(r.text, 'I rue the day i met her');
});

test('一行同时含单词标注与词组标注', () => {
  const r = parseLine('the vacant(/v1/;空的) lot made me rue the day(3;/rd/;悔不当初) i moved here');
  assert.strictEqual(r.keyWords.length, 2);
  assert.strictEqual(r.keyWords[0].word, 'vacant');
  assert.strictEqual(r.keyWords[1].word, 'rue the day');
  assert.strictEqual(r.text, 'The vacant lot made me rue the day i moved here');
});
