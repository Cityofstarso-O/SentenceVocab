/**
 * feedback-reset.spec.js — E2E：反馈模式的复原功能（重点：多词词组）
 * 运行: npm run test:e2e
 *
 * 场景：反馈模式中点击词组任一词会 toggle 掉整个词组，
 *       点「复原」应恢复卡片原始 keyWords（不刷新页面）。
 */
const { test, expect } = require('@playwright/test');

test('反馈模式：toggle 掉词组后点「复原」，词组应恢复高亮', async ({ page }) => {
  await page.goto('/');
  await page.locator('.lib-section-header').click();
  await page.locator('.lib-card').first().dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();

  // 定位到一张含多词 keyWord 的卡片（词组仅含字母和空格，便于选择器定位）
  const phrase = await page.evaluate(() => {
    const card = App.allCards.find(c =>
      (c.keyWords || []).some(kw => /^[a-z ]+$/.test(kw.word) && kw.word.includes(' '))
    );
    if (!card) return null;
    App.studyQueue = [{ card }];
    App.currentIndex = 0;
    App.revealed = true;
    App.editMode = true;
    App.renderCurrentCard();
    return card.keyWords.find(kw => /^[a-z ]+$/.test(kw.word) && kw.word.includes(' ')).word;
  });
  expect(phrase).toBeTruthy();

  // 词组的词在反馈模式中应处于选中（高亮）状态
  const phraseWord = page.locator(`.edit-word[onclick*="toggleWord('${phrase}')"]`).first();
  await expect(phraseWord).toHaveClass(/selected/);

  // 点击词组任一词 → 整个词组被 toggle 掉，取消高亮
  // （toggle 后 DOM 重渲染，词组 onclick 退化为单词：App.toggleWord('amp')）
  await phraseWord.click();
  const firstWordSpan = page.locator(`.edit-word[onclick*="toggleWord('${phrase.split(' ')[0]}')"]`).first();
  await expect(firstWordSpan).not.toHaveClass(/selected/);

  // 点「复原」→ 应恢复原始 keyWords，词组重新高亮
  await page.locator('.rate-btn.rate-fail').click(); // editMode 下此按钮是「复原」
  const phraseWordAfter = page.locator(`.edit-word[onclick*="toggleWord('${phrase}')"]`).first();
  await expect(phraseWordAfter).toHaveClass(/selected/);  // ← 当前代码此处会失败（原始数组被污染）
});

test('反馈模式：toggle 单个词后点「复原」，单词应恢复高亮', async ({ page }) => {
  await page.goto('/');
  await page.locator('.lib-section-header').click();
  await page.locator('.lib-card').first().dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();

  const word = await page.evaluate(() => {
    const card = App.allCards.find(c =>
      (c.keyWords || []).some(kw => /^[a-z]+$/.test(kw.word))
    );
    if (!card) return null;
    App.studyQueue = [{ card }];
    App.currentIndex = 0;
    App.revealed = true;
    App.editMode = true;
    App.renderCurrentCard();
    return card.keyWords.find(kw => /^[a-z]+$/.test(kw.word)).word;
  });
  expect(word).toBeTruthy();

  const wordSpan = page.locator(`.edit-word[onclick*="toggleWord('${word}')"]`).first();
  await expect(wordSpan).toHaveClass(/selected/);

  await wordSpan.click();
  await expect(wordSpan).not.toHaveClass(/selected/);

  await page.locator('.rate-btn.rate-fail').click();
  await expect(wordSpan).toHaveClass(/selected/);
});

test('反馈模式：toggle 问题标签写入 issues，「复原」后取消选中', async ({ page }) => {
  await page.goto('/');
  await page.locator('.lib-section-header').click();
  await page.locator('.lib-card').first().dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();

  await page.evaluate(() => {
    const card = App.allCards.find(c => (c.keyWords || []).length > 0);
    App.studyQueue = [{ card }];
    App.currentIndex = 0;
    App.revealed = true;
    App.editMode = true;
    App.renderCurrentCard();
  });

  const tag = '单词大小写或标点存在错误';
  const tagBtn = page.locator(`.issue-tag:has-text("${tag}")`);
  await expect(tagBtn).toBeVisible();

  // toggle 问题标签 → 高亮并写入 sv_overrides.issues
  await tagBtn.click();
  await expect(tagBtn).toHaveClass(/active/);
  const hasIssue = await page.evaluate(tag => {
    const all = JSON.parse(localStorage.getItem('sv_overrides') || '{}');
    return Object.values(all).flatMap(lib => Object.values(lib)).some(o => (o.issues || []).includes(tag));
  }, tag);
  expect(hasIssue).toBe(true);

  // 点「复原」→ override 清空，标签取消选中
  await page.locator('.rate-btn.rate-fail').click(); // editMode 下是「复原」
  await expect(tagBtn).not.toHaveClass(/active/);
});
