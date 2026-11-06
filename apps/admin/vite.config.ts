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

export default defineConfig({
  plugins: [react()],
  define: {
    __DOCS_COMMIT__: JSON.stringify(docsCommit),
    __DOCS_DATES__: JSON.stringify(docsDates),
  },
  server: { port: 5174, fs: { allow: ['../..'] } },
});
