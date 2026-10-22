/**
 * sync.spec.js — E2E：Gist 时间戳比较（「本地已是最新」检测的回归测试）
 * 回归背景：sv_updated_at 在 localStorage/云端均为 JSON 字符串（带引号），
 * 旧代码 parseInt('"169..."') 返回 NaN，导致比较恒为 false，永远显示「本地已是最新」，
 * push 的防覆盖确认也永不触发。
 * 运行: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');

test('parseTs 兼容带引号字符串/纯字符串/数字/缺省/非法值', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => ({
    quoted: Gist.parseTs('"1698012345678"'),   // localStorage/云端实际存储形式
    plain: Gist.parseTs('1698012345678'),
    num: Gist.parseTs(1698012345678),
    missing: Gist.parseTs(undefined),
    empty: Gist.parseTs(''),
    bad: Gist.parseTs('"abc"'),
  }));
  expect(r.quoted).toBe(1698012345678);
  expect(r.plain).toBe(1698012345678);
  expect(r.num).toBe(1698012345678);
  expect(r.missing).toBe(0);
  expect(r.empty).toBe(0);
  expect(r.bad).toBe(0);
});

test('checkRemoteUpdated：云端带引号时间戳也能正确判出「远程有更新」', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    Storage.setSettings({ gistToken: 'fake-token', gistId: 'fake-id' });
    Storage.set('updated_at', String(1000)); // 本地时间戳 1000
    // mock fetch：云端 progress.json 的 sv_updated_at 为带引号的 '2000'（真实存储形式）
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        files: { 'progress.json': { content: JSON.stringify({ sv_updated_at: JSON.stringify('2000') }) } },
      }),
    });
  });
  expect(await page.evaluate(() => Gist.checkRemoteUpdated())).toBe(true);
});

test('checkRemoteUpdated：云端更旧时返回 false（显示本地已是最新）', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    Storage.setSettings({ gistToken: 'fake-token', gistId: 'fake-id' });
    Storage.set('updated_at', String(5000)); // 本地 5000
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        files: { 'progress.json': { content: JSON.stringify({ sv_updated_at: JSON.stringify('2000') }) } },
      }),
    });
  });
  expect(await page.evaluate(() => Gist.checkRemoteUpdated())).toBe(false);
});
