import { defineConfig, devices } from '@playwright/test';

// 어드민 e2e. 데스크톱 웹만(기준 1440), 라이트와 다크. 같은 기계에서 두 번 돌릴 때 ADMIN_E2E_PORT로 포트를 바꾼다
const port = process.env.ADMIN_E2E_PORT ?? '5176';
const viewport = { width: 1440, height: 900 };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], viewport, colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], viewport, colorScheme: 'dark' } },
  ],
  webServer: {
    command: `pnpm exec vite --mode e2e --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
