// 사이트맵(28 ‘검색·공유 정보’). 검색에 내보내는 페이지만: 초대(/i/), 알림 메일 링크(/n), 로그인 복귀(/auth), 404는 뺌.
// 이용약관·개인정보처리방침은 현행 판 하나의 주소(/terms, /privacy)만(이전 판은 같은 페이지 안).
import type { APIRoute } from 'astro';

const PAGES = ['/', '/download', '/help', '/releases', '/terms', '/privacy'];

export const GET: APIRoute = ({ site }) => {
  const urls = PAGES.map((p) => `  <url><loc>${new URL(p, site).toString()}</loc></url>`).join(
    '\n',
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
