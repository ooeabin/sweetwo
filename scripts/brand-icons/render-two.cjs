// 워드마크(logo-cherry.svg)에서 ‘Two’(뒤 세 글자)만 흰색으로 투명 바탕 PNG로 그림(앱 아이콘 원본). node scripts/brand-icons/render-two.cjs <out.png>
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
  await b.close();
})();
