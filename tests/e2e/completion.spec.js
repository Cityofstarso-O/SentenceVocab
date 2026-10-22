/**
 * completion.spec.js — E2E：学完语库的完成状态与「重置进度」按钮（confirm 弹窗接受/取消）
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

async function enterStudy(page) {
  await page.goto('/');
  await page.locator('.lib-section-header').click();
  await page.locator('.lib-card').first().dblclick();
  await expect(page.locator('.card-text').first()).toBeVisible();
}

test('学完语库显示完成状态；重置进度 confirm 取消则保留，接受则清零', async ({ page }) => {
  await enterStudy(page);
  const libId = await page.evaluate(() => {
    // 预置：全部已会 → 渲染学习页进入完成状态
    const lib = App.currentLib;
    const all = JSON.parse(localStorage.getItem('sv_mastered') || '{}');
    all[lib] = App.allCards.map(c => c.id);
    localStorage.setItem('sv_mastered', JSON.stringify(all));
    App.renderStudy();
    return lib;
  });

  await expect(page.locator('.empty-state h3')).toHaveText('语库已学完！');
  await expect(page.locator('.empty-state p')).toContainText('已会');

  // confirm 取消 → 完成状态保留，进度不清
  page.once('dialog', d => d.dismiss());
  await page.locator('.rate-btn.rate-good').click(); // 完成状态中的「重置进度」按钮
  await expect(page.locator('.empty-state h3')).toHaveText('语库已学完！');
  let mastered = await page.evaluate(
    lib => (JSON.parse(localStorage.getItem('sv_mastered') || '{}')[lib] || []).length,
    libId
  );
  expect(mastered).toBeGreaterThan(0);

  // confirm 接受 → mastered 清空，回到学习队列（进度 0）
  page.once('dialog', d => d.accept());
  await page.locator('.rate-btn.rate-good').click();
  await expect(page.locator('.progress-text')).toHaveText(/已会 0 \/ \d+/);
  mastered = await page.evaluate(
    lib => (JSON.parse(localStorage.getItem('sv_mastered') || '{}')[lib] || []).length,
    libId
  );
  expect(mastered).toBe(0);
});
