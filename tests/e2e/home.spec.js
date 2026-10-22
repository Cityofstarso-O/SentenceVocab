/**
 * home.spec.js — E2E：主页（语库列表、进度、选中）
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // 每个测试独立 BrowserContext，localStorage 天然干净，无需手动清空
  await page.goto('/');
  // 语库区默认折叠（.lib-list max-height:0），先展开
  await page.locator('.lib-section-header').click();
  await expect(page.locator('.lib-card').first()).toBeVisible();
});

test('页面加载：标题与底部导航渲染', async ({ page }) => {
  await expect(page).toHaveTitle('SentenceVocab');
  await expect(page.locator('#page-title')).toHaveText('SentenceVocab');
  await expect(page.locator('.nav-btn[data-route="home"]')).toBeVisible();
  await expect(page.locator('.nav-btn[data-route="study"]')).toBeVisible();
});

test('语库列表数量与 index.json 一致', async ({ page }) => {
  const res = await page.request.get('/data/index.json');
  const index = await res.json();
  await expect(page.locator('.lib-card')).toHaveCount(index.libraries.length);
});

test('空进度时语库显示 0 句 0%', async ({ page }) => {
  await expect(page.locator('.lib-card').first().locator('.lib-meta'))
    .toHaveText(/^0\/\d+ 句 \| 0%$/);
});

test('语库显示总句数与 index.json 的 cardCount 一致', async ({ page }) => {
  const index = await (await page.request.get('/data/index.json')).json();
  const metas = await page.locator('.lib-card .lib-meta').allInnerTexts();
  const totals = index.libraries.map(l => l.cardCount).sort((a, b) => b - a);
  const shown = metas.map(m => parseInt(m.match(/^0\/(\d+)/)[1], 10)).sort((a, b) => b - a);
  expect(shown).toEqual(totals);
});

test('单击选中语库（active 高亮切换）', async ({ page }) => {
  const second = page.locator('.lib-card').nth(1);
  await second.click();
  await expect(second).toHaveClass(/active/);
  await expect(page.locator('.lib-card').first()).not.toHaveClass(/active/);
});
