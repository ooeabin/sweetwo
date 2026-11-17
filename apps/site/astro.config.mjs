import { defineConfig } from 'astro/config';
// CSS는 페이지에 바로 넣어 첫 화면을 막는 별도 파일 요청을 없앰(성능, 28 ‘검색·공유 정보’)
export default defineConfig({ site: 'https://sweetwo.kr', build: { inlineStylesheets: 'always' } });
