import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 어드민(ops.sweetwo.kr). ‘문서’ 메뉴(AD-20)는 빌드할 때 저장소 docs/ md를 그대로 읽어 들이고, docs/ 마지막 커밋을 같이 넣는다.
const docsCommit = (() => {
  try {
    return execSync('git log -1 --format="%h %cs" -- ../../docs', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();

export default defineConfig({
  plugins: [react()],
  define: { __DOCS_COMMIT__: JSON.stringify(docsCommit) },
  server: { port: 5174, fs: { allow: ['../..'] } },
});
