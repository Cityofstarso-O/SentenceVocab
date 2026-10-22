/**
 * nav.spec.js — E2E：底部导航切换与未选语库的空状态
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

test('底部导航在主页与学习之间切换，标题同步变化', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-title')).toHaveText('SentenceVocab');

  await page.locator('.nav-btn[data-route="study"]').click();
  await expect(page.locator('#page-title')).toHaveText('学习');
  await expect(page.locator('.nav-btn[data-route="study"]')).toHaveClass(/active/);

  await page.locator('.nav-btn[data-route="home"]').click();
  await expect(page.locator('#page-title')).toHaveText('SentenceVocab');
  await expect(page.locator('.nav-btn[data-route="home"]')).toHaveClass(/active/);
});

test('未选择语库时学习页显示空状态提示', async ({ page }) => {
  await page.goto('/'); // 全新 context，localStorage 为空，currentLib 为 null
  await page.locator('.nav-btn[data-route="study"]').click();
  await expect(page.locator('#page-title')).toHaveText('学习');
  await expect(page.locator('.empty-state')).toContainText('未选择语库');
  await expect(page.locator('.empty-state')).toContainText('请先在主页选择一个语库');
});
