/**
 * playwright.config.js — E2E 测试配置
 * 浏览器使用本地 E:\pw-browsers（chromium-1243），无需 playwright install
 */
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'E:\\pw-browsers';

module.exports = {
  testDir: 'tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:8766',
  },
  webServer: {
    command: 'node tests/e2e/static-server.js',
    port: 8766,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
};
