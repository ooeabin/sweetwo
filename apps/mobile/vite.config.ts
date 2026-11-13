import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 앱 화면 CSP(31 보안 2장 ‘강한 CSP’, DEV_GUIDE ‘CSP’). 빌드(앱에 넣는 dist)에만 meta로 넣음.
 * 개발 서버는 Vite가 인라인 스크립트(HMR)를 쓰므로 넣지 않음. 허용: 앱 자신(capacitor://localhost, https://localhost),
 * Supabase(REST, Auth, Realtime wss, Storage 사진), 그림·사진(data:, blob:). 인라인 스크립트·eval 금지.
 * 보상형 광고(AdMob, 2026-11-13 PR 13)는 네이티브 SDK 화면이라 웹뷰 CSP에 출처를 더하지 않음.
 * style-src 'unsafe-inline'은 React style 속성 때문(스크립트가 아니라 글자 모양만).
 */
function csp(supabaseUrl: string | undefined): Plugin {
  const sb = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const ws = sb.replace(/^http/, 'ws');
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${sb}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${sb} ${ws}`.trim(),
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'sweetwo-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      ),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return { plugins: [react(), csp(env.VITE_SUPABASE_URL)], server: { port: 5173 } };
});
