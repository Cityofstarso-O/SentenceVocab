/**
 * scene.spec.js — E2E：场景语库（kitchen，一张图一个场景）
 * 物品三态：1 原图（隐藏）/ 2 圆圈 / 3 圆圈+英文caption
 * 单击 2↔3 自由切换；双击/长按 → 1；整体切换按钮强制覆盖所有物品（1→2→3→1）；「下一张」= 记会出队
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

const LIB = 'kitchen';
const ITEM_COUNT = 12;

async function enterSceneStudy(page) {
  await page.goto('/');
  await page.locator('.lib-section-header').click();
  await page.locator(`.lib-card[data-lib-id="${LIB}"]`).dblclick();
  await expect(page.locator('.scene-stage img')).toBeVisible();
}

test('主页显示场景语库，量词为「张」', async ({ page }) => {
  await page.goto('/');
  await page.locator('.lib-section-header').click();
  const card = page.locator(`.lib-card[data-lib-id="${LIB}"]`);
  await expect(card).toBeVisible();
  await expect(card.locator('.lib-meta')).toHaveText(/^0\/1 张 \| 0%$/);
});

test('物品从状态 2 开始，单击 2↔3 自由切换', async ({ page }) => {
  await enterSceneStudy(page);
  await expect(page.locator('.scene-pin')).toHaveCount(ITEM_COUNT);
  await expect(page.locator('.scene-pin.s2')).toHaveCount(ITEM_COUNT); // 初始全部为圆圈态
  await expect(page.locator('.scene-pin.s3')).toHaveCount(0);
  await expect(page.locator('.scene-prompt')).toHaveCount(0); // 无目标词机制
  await expect(page.locator('.scene-count')).toHaveCount(0);  // 无计数机制

  const idx = await page.evaluate(() => Object.keys(App.sceneState.states)[0]);
  await page.locator(`.scene-pin[data-idx="${idx}"]`).click();
  await expect(page.locator(`.scene-pin[data-idx="${idx}"]`)).toHaveClass(/s3/);
  const word = await page.evaluate(
    (i) => App.studyQueue[App.currentIndex].card.items[i].word, +idx
  );
  await expect(page.locator(`.scene-pin-label[data-idx="${idx}"]`)).toHaveText(word);

  await page.locator(`.scene-pin[data-idx="${idx}"]`).click(); // 再单击 3→2
  await expect(page.locator(`.scene-pin[data-idx="${idx}"]`)).toHaveClass(/s2/);
});

test('双击物品 → 状态 1 隐藏；整体切换按钮按 1→2→3→1 强制覆盖所有物品', async ({ page }) => {
  await enterSceneStudy(page);

  // 双击（首个 click 2→3，第二个 click 3→2，dblclick → 1）→ 隐藏
  const idx = await page.evaluate(() => Object.keys(App.sceneState.states)[2]);
  await page.locator(`.scene-pin[data-idx="${idx}"]`).dblclick();
  await expect(page.locator(`.scene-pin[data-idx="${idx}"]`)).toHaveClass(/s1/);

  // 整体切换第 1 次 → 全部状态 1（强制覆盖，包括已隐藏的）
  await page.locator('.scene-mode-btn').click();
  await expect(page.locator('.scene-pin.s1')).toHaveCount(ITEM_COUNT);
  await expect(page.locator('.scene-pin.s2')).toHaveCount(0);

  // 状态 1 不响应单击：直接调 tapItem 验证守卫
  const after = await page.evaluate(() => {
    App.tapItem(0);
    return App.sceneState.states[0];
  });
  expect(after).toBe(1);

  // 第 2、3 次 → 全部 2 → 全部 3（全部 caption 显示时互不重叠）
  await page.locator('.scene-mode-btn').click();
  await expect(page.locator('.scene-pin.s2')).toHaveCount(ITEM_COUNT);
  await page.locator('.scene-mode-btn').click();
  await expect(page.locator('.scene-pin.s3')).toHaveCount(ITEM_COUNT);
  const overlaps = await page.evaluate(() => {
    const ls = [...document.querySelectorAll('.scene-pin-label')].map(l => l.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < ls.length; i++)
      for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i], b = ls[j];
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0) n++;
      }
    return n;
  });
  expect(overlaps).toBe(0);

  // 第 4 次 → 全部 1
  await page.locator('.scene-mode-btn').click();
  await expect(page.locator('.scene-pin.s1')).toHaveCount(ITEM_COUNT);
});

test('「下一张」= 记会出队：mastered 写入，学完显示完成页', async ({ page }) => {
  await enterSceneStudy(page);
  await expect(page.locator('.rate-btn')).toHaveCount(1);
  await expect(page.locator('.rate-btn.rate-good')).toHaveText('下一张');

  await page.locator('.rate-btn').click(); // rate(GOOD)
  await expect(page.locator('.empty-state')).toContainText('语库已学完');
  const mastered = await page.evaluate(() => JSON.parse(localStorage.getItem('sv_mastered')));
  expect(mastered[LIB]).toContain(1);

  // 刷新后进度保留
  await page.reload();
  await page.locator('.lib-section-header').click();
  await expect(page.locator('.lib-card[data-lib-id="kitchen"] .lib-meta')).toHaveText(/^1\/1 张 \| 100%$/);
});
