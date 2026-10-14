import { defineConfig } from '@playwright/test';

// 데스크톱 e2e: pnpm build 뒤 out/를 실제 Electron으로 실행. Linux CI는 xvfb-run으로.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  reporter: process.env.CI ? 'github' : 'list',
});
