// 디자인 원본(docs/design)의 토큰과 컴포넌트 CSS를 packages/ui로 복사한다.
// 복사본은 손으로 고치지 않는다. 원본을 고친 뒤 `pnpm ds:sync`.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let commit = 'uncommitted';
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // git이 없으면 uncommitted로 남긴다
}
for (const name of ['tokens.css', 'bundle.css']) {
  const src = `docs/design/${name}`;
  const dst = `packages/ui/src/styles/${name}`;
  copyFileSync(src, dst);
  const body = readFileSync(dst, 'utf8');
  writeFileSync(dst, `/* ${src}에서 복사 (${commit}). 손으로 고치지 말고 원본을 고친 뒤 pnpm ds:sync */\n${body}`);
  console.log(`synced ${dst}`);
}
copyFileSync('docs/design/fonts/SUIT-Variable.woff2', 'packages/ui/src/styles/fonts/SUIT-Variable.woff2');
console.log('synced fonts');
