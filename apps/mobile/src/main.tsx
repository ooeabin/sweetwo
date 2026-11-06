import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App, detectPlatform, type Platform } from '@sweetwo/app';
import '@sweetwo/ui/styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root가 없어요');
const root = rootEl;

// 휴대폰·에뮬레이터(Capacitor)면 네이티브 브리지(로그인, 보안 저장소, 잠금)를 먼저 붙이고, 브라우저(개발·e2e)면 웹.
// e2e는 흉내 모바일 브리지(window.sweetwo, platform ios/android)를 미리 넣어 앱 쪽 흐름을 확인함
async function start() {
  const injected = detectPlatform();
  let platform: Platform = injected === 'ios' || injected === 'android' ? injected : 'web';
  if (Capacitor.isNativePlatform()) {
    const { installBridge } = await import('./native/bridge');
    platform = await installBridge();
  }
  createRoot(root).render(
    <StrictMode>
      <App platform={platform} />
    </StrictMode>,
  );
}
void start();
