import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 어드민(ops.sweetwo.kr). ‘문서’ 메뉴(AD-20)는 빌드할 때 저장소 docs/ md를 그대로 읽어 들인다.
export default defineConfig({ plugins: [react()], server: { port: 5174, fs: { allow: ['../..'] } } });
