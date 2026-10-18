// 그림 크기 상한 검사(docs/DEV_GUIDE.md ‘에셋’). CI에서 돈다.
// 그림(webp) 150KB. 넘으면 실패.
import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const LIMITS = { '.webp': 150 * 1024, '.png': 150 * 1024 };
const DIRS = ['packages/ui/src/assets/illustrations'];

const bad = [];
let count = 0;
for (const dir of DIRS) {
  for (const name of readdirSync(dir)) {
    const limit = LIMITS[extname(name)];
    if (!limit) continue;
    count++;
    const size = statSync(join(dir, name)).size;
    if (size > limit)
      bad.push(`${dir}/${name}: ${(size / 1024).toFixed(0)}KB (상한 ${limit / 1024}KB)`);
  }
}
if (bad.length) {
  console.error(`에셋 크기 초과 ${bad.length}개\n${bad.join('\n')}`);
  process.exit(1);
}
console.log(`에셋 ${count}개 크기 확인 완료`);
