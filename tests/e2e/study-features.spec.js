/**
 * study-features.spec.js — E2E：语库区折叠、揭示态内容（翻译/生词详情）、点「不会」的插队行为
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

async function enterStudy(page) {
  await page.goto('/');
  await page.locator('.lib-section-header').click();
  await page.locator('.lib-card').first().dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();
}

test('语库区默认折叠，点击 header 可展开/再折叠', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('.lib-section');
  const header = page.locator('.lib-section-header');
  const list = page.locator('.lib-list');

  // 注意：max-height:0 + overflow:hidden 裁剪下的卡片 Playwright 仍视为 visible，
  // 故用 .lib-list 的实际高度断言（poll 等待 0.3s 过渡动画）
  const listHeight = async () => (await list.boundingBox())?.height ?? 0;

  expect(await listHeight()).toBe(0); // 默认折叠（.lib-list max-height:0）

  await header.click(); // 展开
  await expect(section).toHaveClass(/expanded/);
  await expect.poll(listHeight, { timeout: 2000 }).toBeGreaterThan(50);

  await header.click(); // 再折叠
  await expect(section).not.toHaveClass(/expanded/);
  await expect.poll(listHeight, { timeout: 2000 }).toBe(0);
});

test('揭示后显示整句翻译与生词详情（词/音标/释义一一对应）', async ({ page }) => {
  await enterStudy(page);
  const info = await page.evaluate(() => {
    const card = App.allCards.find(c => c.translation && (c.keyWords || []).length > 0);
    App.studyQueue = [{ card }];
    App.currentIndex = 0;
    App.revealed = true;
    App.renderCurrentCard();
    return { translation: card.translation, kw: card.keyWords[0], kwCount: card.keyWords.length };
  });

  await expect(page.locator('.card-translation')).toHaveText(info.translation);
  await expect(page.locator('.word-detail')).toHaveCount(info.kwCount);
  const first = page.locator('.word-detail').first();
  await expect(first.locator('.wd-word')).toHaveText(info.kw.word);
  await expect(first.locator('.wd-phonetic')).toHaveText(info.kw.phonetic);
  await expect(first.locator('.wd-meaning')).toHaveText(info.kw.meaning_cn);
});

test('点「下一张」后当前卡片插回队列第 10~20 位（而非丢弃）', async ({ page }) => {
  await enterStudy(page);
  const cardId = await page.evaluate(() => App.studyQueue[0].card.id);

  await page.locator('.rate-btn.rate-fail').click(); // reveal
  await page.locator('.rate-btn.rate-fail').click(); // 下一张（不会，插队）

  const pos = await page.evaluate(id => App.studyQueue.findIndex(i => i.card.id === id), cardId);
  expect(pos).toBeGreaterThanOrEqual(10);
  expect(pos).toBeLessThanOrEqual(20);
});
