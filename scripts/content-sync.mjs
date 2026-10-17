// 웹사이트 원본 글(apps/site/src/content)을 앱(packages/app/src/content)으로 복사한다.
// 앱 S-20 도움말이 같은 FAQ를 씀. 복사본은 손으로 고치지 않는다. 원본을 고친 뒤 `pnpm content:sync`.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

for (const name of ['faq.md']) {
  const src = `apps/site/src/content/${name}`;
  const dst = `packages/app/src/content/${name}`;
  copyFileSync(src, dst);
  const body = readFileSync(dst, 'utf8');
  writeFileSync(dst, `<!-- ${src}에서 복사. 손으로 고치지 말고 원본을 고친 뒤 pnpm content:sync -->\n${body}`);
  console.log(`synced ${dst}`);
}
