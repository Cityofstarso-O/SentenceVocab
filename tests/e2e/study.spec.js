/**
 * study.spec.js — E2E：学习流程（会/不会、持久化、反馈模式）
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

async function enterStudy(page) {
  // 每个测试独立 BrowserContext，localStorage 天然干净，无需手动清空
  await page.goto('/');
  // 语库区默认折叠，先展开再双击进入学习
  await page.locator('.lib-section-header').click();
  const firstLib = page.locator('.lib-card').first();
  await firstLib.dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();
}

test('进入学习：卡片渲染，进度与按钮齐全', async ({ page }) => {
  await enterStudy(page);
  await expect(page.locator('.progress-text')).toHaveText(/已会 0 \/ \d+/);
  await expect(page.locator('.card-text').first()).not.toBeEmpty();
  await expect(page.locator('.rate-btn.rate-fail')).toHaveText('不会');
  await expect(page.locator('.rate-btn.rate-good')).toHaveText('会');
});

test('点「会」→ sv_mastered 记录数字 id，刷新后进度保留', async ({ page }) => {
  await enterStudy(page);
  const libId = await page.evaluate(() => App.currentLib);
  const cardId = await page.evaluate(() => App.studyQueue[0].card.id);

  await page.locator('.rate-btn.rate-good').click();
  await expect(page.locator('.progress-text')).toHaveText(/已会 1 \/ \d+/);

  const mastered = await page.evaluate(() => JSON.parse(localStorage.getItem('sv_mastered')));
  expect(Array.isArray(mastered[libId])).toBe(true);
  expect(mastered[libId]).toContain(cardId);

  // 刷新回到主页，选中语库的进度应为 1 句
  await page.reload();
  await expect(page.locator('.lib-card.active .lib-meta')).toHaveText(/^1\/\d+ 句 \| \d+%$/);
});

test('点「不会」揭示翻译与生词详情，队列不减少', async ({ page }) => {
  await enterStudy(page);
  const before = await page.locator('.progress-text').innerText();

  await page.locator('.rate-btn.rate-fail').click(); // reveal
  await expect(page.locator('.feedback-btn')).toBeVisible();
  await expect(page.locator('.rate-btn.rate-fail')).toHaveText('下一张');
  // 揭示后卡片文本仍在（同一条）
  await expect(page.locator('.card-text').first()).not.toBeEmpty();

  await page.locator('.rate-btn.rate-fail').click(); // rate(0)：下一张（插回队列）
  await expect(page.locator('.progress-text')).toHaveText(before);
});

test('刷新页面后学习进度不丢失', async ({ page }) => {
  await enterStudy(page);
  await page.locator('.rate-btn.rate-good').click();
  await expect(page.locator('.progress-text')).toHaveText(/已会 1 \/ \d+/);
  await page.reload();
  // 刷新后停在主页，展开折叠区后双击当前选中（active）语库进入学习
  await page.locator('.lib-section-header').click();
  await page.locator('.lib-card.active').dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();
  await expect(page.locator('.progress-text')).toHaveText(/已会 1 \/ \d+/);
});

test('反馈模式：点击词语 toggle 写入 sv_overrides，完成后回到揭示态', async ({ page }) => {
  await enterStudy(page);
  await page.locator('.rate-btn.rate-fail').click(); // reveal
  await page.locator('.feedback-btn').click();
  await expect(page.locator('.edit-word').first()).toBeVisible();

  const before = await page.evaluate(() => localStorage.getItem('sv_overrides'));
  await page.locator('.edit-word').first().click();
  const after = await page.evaluate(() => localStorage.getItem('sv_overrides'));
  expect(before).toBeNull();
  expect(after).not.toBeNull();

  await page.locator('.rate-btn.rate-good').click(); // 完成
  await expect(page.locator('.feedback-btn')).toBeVisible();
});
