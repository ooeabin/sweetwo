import { defineConfig, devices } from '@playwright/test';

// 웹 e2e. 넓은 창과 좁은 창(768px 미만), 라이트와 다크를 같이 돈다.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:5175', trace: 'retain-on-failure' },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    {
      name: 'narrow',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 800 } },
    },
  ],
  // Supabase는 가짜 주소(.env.e2e)로 띄우고 테스트가 응답을 흉내 낸다(e2e/supabase-mock.ts)
  webServer: {
    command: 'pnpm exec vite --mode e2e --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  },
});
