// iOS 앱 링크(유니버설 링크) 확인 파일(DEV_GUIDE ‘모바일 세션’). 앱이 받을 경로는 초대(/i/*)와 알림 메일 링크(/n, /n/settings)만.
// 로그인 콜백은 sweetwo://로 받아 여기 넣지 않음. Apple 팀 ID는 공개 값(빌드 환경 변수 PUBLIC_APPLE_TEAM_ID), 없으면 빈 목록.
import type { APIRoute } from 'astro';

const team = (import.meta.env.PUBLIC_APPLE_TEAM_ID as string | undefined) ?? '';
const appId = 'kr.sweetwo.app';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      applinks: {
        details: team
          ? [
              {
                appIDs: [`${team}.${appId}`],
                components: [{ '/': '/i/*' }, { '/': '/n' }, { '/': '/n/settings' }],
              },
            ]
          : [],
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
