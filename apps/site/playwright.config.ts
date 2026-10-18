import { defineConfig, devices } from '@playwright/test';

// 웹사이트 e2e: 정적 빌드를 미리보기로 띄워 넓은 창(라이트·다크)과 좁은 창. SITE_E2E_PORT로 포트를 바꿀 수 있음
const port = process.env.SITE_E2E_PORT ?? '5177';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    {
      name: 'narrow',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 800 } },
    },
  ],
  webServer: {
    command: `pnpm exec astro build && pnpm exec astro preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
