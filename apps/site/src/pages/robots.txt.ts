// robots.txt(28 ‘검색·공유 정보’): 초대(/i/), 로그인 복귀(/auth/), 알림 메일 링크(/n)는 막고 사이트맵 주소를 알림
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const body = `User-agent: *\nAllow: /\nDisallow: /i/\nDisallow: /auth/\nDisallow: /n/\n\nSitemap: ${new URL('/sitemap.xml', site).toString()}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
