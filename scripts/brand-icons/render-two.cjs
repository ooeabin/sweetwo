// 워드마크(logo-cherry.svg)에서 ‘Two’(뒤 세 글자)만 흰색으로 투명 바탕 PNG로 그림(앱 아이콘 원본). node scripts/brand-icons/render-two.cjs <out.png> [--wordmark <out2.png>]
// --wordmark: 워드마크 전체(브랜드 오렌지)도 같이 그림(공유 이미지용)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const svg = fs.readFileSync(path.join(__dirname, '../../packages/ui/src/assets/brand/logo-cherry.svg'), 'utf8');
const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]).slice(4, 7); // T, w, o
const W = 2400, VB = [3150, -1500, 2850, 1620];
const H = Math.round((W * VB[3]) / VB[2]);
const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${VB.join(' ')}"><g fill="#fff" stroke="#fff" stroke-width="18" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${doc}</body></html>`);
  await p.screenshot({ path: process.argv[2], omitBackground: true });
  const i = process.argv.indexOf('--wordmark');
  if (i > 0) {
    const ww = 2400, wh = Math.round((ww * 1633) / 6074);
    const q = await b.newPage({ viewport: { width: ww, height: wh } });
    await q.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${ww}" height="${wh}" `)}</body></html>`);
    await q.screenshot({ path: process.argv[i + 1], omitBackground: true });
  }
  await b.close();
})();
