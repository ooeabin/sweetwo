import { execSync } from 'node:child_process';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 어드민(ops.sweetwo.kr). ‘문서’ 메뉴(AD-20)는 빌드할 때 저장소 docs/ md를 그대로 읽어 들이고, docs/ 마지막 커밋을 같이 넣는다.
const docsCommit = (() => {
  try {
    return execSync('git log -1 --format="%h %cs" -- ../../docs', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();

// 문서마다 마지막 수정(27 AD-20): git log 한 번으로 파일별 가장 최근 커밋(짧은 해시, 날짜)
const docsDates = (() => {
  try {
    // 얕은 복제면 첫 커밋에 모든 파일이 있는 것처럼 보여서 쓰지 않음(문서 전체 마지막 커밋만)
    if (execSync('git rev-parse --is-shallow-repository', { encoding: 'utf8' }).trim() === 'true')
      return {};
    const out = execSync('git log --format="@%h %cs" --name-only -- ../../docs', {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const map: Record<string, string> = {};
    let cur = '';
    for (const line of out.split('\n')) {
      if (line.startsWith('@')) cur = line.slice(1);
      else if (line.startsWith('docs/') && !(line.slice(5) in map)) map[line.slice(5)] = cur;
    }
    return map;
  } catch {
    return {};
  }
})();

/**
 * 보안 헤더(2026-11-12, DEV_GUIDE ‘어드민 인증’). Cloudflare Workers 정적 자산은 dist/_headers를 응답 헤더로 붙임.
 * Supabase 주소가 빌드 값(VITE_SUPABASE_URL)이라 public/에 두지 않고 빌드 때 만듦.
 * 허용: 어드민 자신, Supabase(REST, Auth, Realtime wss), 인증 앱 QR(data:), 내려받기(blob:). 인라인 스크립트·eval 금지.
 * style-src 'unsafe-inline'은 React style 속성 때문. 다른 사이트 안에 넣지 못하게(frame-ancestors 'none', X-Frame-Options).
 */
export function adminHeaders(supabaseUrl: string | undefined): string {
  const sb = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const ws = sb.replace(/^http/, 'ws');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${sb} ${ws}`.trim(),
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  return [
    '# 빌드가 만든 파일(apps/admin/vite.config.ts adminHeaders). 손으로 고치지 않음',
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Frame-Options: DENY',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '  Cross-Origin-Opener-Policy: same-origin',
    '  X-Robots-Tag: noindex, nofollow',
    '',
  ].join('\n');
}

const headers = (supabaseUrl: string | undefined): Plugin => ({
  name: 'sweetwo-admin-headers',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: adminHeaders(supabaseUrl) });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), headers(env.VITE_SUPABASE_URL)],
    define: {
      __DOCS_COMMIT__: JSON.stringify(docsCommit),
      __DOCS_DATES__: JSON.stringify(docsDates),
    },
    server: { port: 5174, fs: { allow: ['../..'] } },
  };
});
