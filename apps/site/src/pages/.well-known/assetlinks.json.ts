// Android 앱 링크 확인 파일(DEV_GUIDE ‘모바일 세션’). 서명 인증서 SHA-256은 공개 값
// (빌드 환경 변수 PUBLIC_ANDROID_CERT_SHA256, 여러 개면 쉼표로: Play 앱 서명 키, 업로드 키). 없으면 빈 목록.
import type { APIRoute } from 'astro';

const certs = ((import.meta.env.PUBLIC_ANDROID_CERT_SHA256 as string | undefined) ?? '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      certs.length
        ? [
            {
              relation: ['delegate_permission/common.handle_all_urls'],
              target: {
                namespace: 'android_app',
                package_name: 'kr.sweetwo.app',
                sha256_cert_fingerprints: certs,
              },
            },
          ]
        : [],
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
