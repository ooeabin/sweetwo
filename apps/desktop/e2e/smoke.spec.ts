import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

// 데스크톱 앱이 뜨고, 브리지가 정해진 모양만 노출하는지(빌드 결과 out/로 실행).
test('데스크톱 실행', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '..'), '--no-sandbox'],
  });
  const win = await app.firstWindow();
  await expect(win.locator('.hg-root')).toBeVisible();
  const bridge = await win.evaluate(() => Object.keys(window.sweetwo ?? {}).sort());
  expect(bridge).toEqual(['onInvite', 'version']);
  const nodeLeak = await win.evaluate(() => typeof (globalThis as { require?: unknown }).require);
  expect(nodeLeak).toBe('undefined');
  await app.close();
});
