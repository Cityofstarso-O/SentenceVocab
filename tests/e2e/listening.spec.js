/**
 * listening.spec.js — E2E：听力模式（先听后看）
 * 默认关闭时行为与普通模式一致；开启后未揭示隐藏句子、进新卡自动播放、揭示态不变
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

async function enterStudy(page, { listening = false } = {}) {
  await page.goto('/');
  if (listening) {
    await page.evaluate(() => Storage.setSettings({ listeningMode: true }));
  }
  await page.locator('.lib-section-header').click();
  await page.locator('.lib-card').first().dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();
}

test('默认关闭：未揭示显示原句，不出现听力占位（行为与普通模式一致）', async ({ page }) => {
  await enterStudy(page);
  const text = await page.locator('.card-text').first().textContent();
  expect(text).not.toContain('听力模式');
  expect(text.trim().length).toBeGreaterThan(0);
  await expect(page.locator('.listening-placeholder')).toHaveCount(0);
});

test('开启后：未揭示不显示句子，设置持久化；点「不会」揭示态与普通模式完全一致', async ({ page }) => {
  await enterStudy(page, { listening: true });
  const sentence = await page.evaluate(() => App.studyQueue[0].card.text);

  // 句子被隐藏，只显示占位
  await expect(page.locator('.listening-placeholder')).toBeVisible();
  expect(await page.locator('.card-text').first().textContent()).not.toContain(sentence);
  // 设置写入 localStorage
  expect(await page.evaluate(() => Storage.getSettings().listeningMode)).toBe(true);

  // 点「不会」→ 揭示态：原句、朗读按钮、按钮齐全（与普通模式同一渲染路径）
  await page.locator('.rate-btn.rate-fail').first().click();
  await expect(page.locator('.card-text').first()).toHaveText(sentence);
  await expect(page.locator('.audio-btn')).toBeVisible();
  await expect(page.locator('.rate-btn.rate-good')).toHaveCount(0); // 揭示态没有「会」
});

test('开启后：点「下一张」进入新卡自动加载对应音频', async ({ page }) => {
  await enterStudy(page, { listening: true });
  await page.locator('.rate-btn.rate-fail').first().click(); // 不会 → 揭示
  await page.locator('.rate-btn.rate-fail').click();         // 下一张 → 新卡未揭示
  await expect(page.locator('.listening-placeholder')).toBeVisible();

  await page.waitForTimeout(300);
  const matched = await page.evaluate(() => {
    const id = App.studyQueue[0].card.id;
    return !!CardAudio.current && CardAudio.current.src.endsWith(`data/audios/${App.currentLib}/${id}.mp3`);
  });
  expect(matched).toBe(true);
});
