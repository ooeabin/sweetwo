// 웹사이트 원본 글(apps/site/src/content)을 앱(packages/app/src/content)으로 복사한다.
// 앱 S-20 도움말이 같은 FAQ를 씀. 복사본은 손으로 고치지 않는다. 원본을 고친 뒤 `pnpm content:sync`.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// 2026-11-10 A-05 동의 문서(개인정보 수집·이용, 공간 공유, 마케팅)도 앱 시트가 같은 원본을 씀
for (const name of [
  'faq.md',
  'consents/privacy.md',
  'consents/space-sharing.md',
  'consents/marketing.md',
]) {
  const src = `apps/site/src/content/${name}`;
  const dst = `packages/app/src/content/${name}`;
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  const body = readFileSync(dst, 'utf8');
  writeFileSync(
    dst,
    `<!-- ${src}에서 복사. 손으로 고치지 말고 원본을 고친 뒤 pnpm content:sync -->\n${body}`,
  );
  console.log(`synced ${dst}`);
}
