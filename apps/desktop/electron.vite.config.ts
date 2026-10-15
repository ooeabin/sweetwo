import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

// main은 VITE_로 시작하는 공개 값(Supabase URL, publishable 키, 웹 주소)만 읽는다. 비밀 값은 넣지 않는다.
// 워크스페이스 패키지(@sweetwo/core)는 TS 소스라 번들에 넣는다.
const deps = externalizeDepsPlugin({ exclude: ['@sweetwo/core', 'zod'] });

export default defineConfig({
  main: { plugins: [deps], envPrefix: ['MAIN_VITE_', 'VITE_'] },
  preload: { plugins: [deps] },
  renderer: { plugins: [react()] },
});
