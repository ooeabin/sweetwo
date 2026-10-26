import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { initSession } from './features/auth';
import { restoreCache, startCacheSaver } from './shared/offline-cache';
import type { Platform } from './platform';
import { routes } from './routes';

// 다크 모드는 토큰이 처리한다([data-theme="dark"]). 여기서 시스템 설정을 따라 붙이기만 한다(설정 S 탭의 화면 모드가 생기면 그 값 우선).
function useSystemTheme() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => (document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
}

export function App({ platform }: { platform: Platform }) {
  // 세션 방식(데스크톱 브리지 / 웹 브라우저 저장소)을 Supabase를 처음 쓰기 전에 정한다
  const [queryClient] = useState(() => {
    initSession(platform);
    return new QueryClient();
  });
  // 데스크톱(file://)은 해시 라우터, 웹은 브라우저 라우터
  const [router] = useState(() =>
    platform === 'desktop' ? createHashRouter(routes) : createBrowserRouter(routes),
  );
  useSystemTheme();
  // 앱: 기기에 둔 마지막 데이터를 먼저 채우고(오프라인 조회) 그린 뒤, 받은 데이터를 계속 기기에 둠
  const [restored, setRestored] = useState(() => !window.sweetwo?.cache);
  useEffect(() => {
    const bridge = window.sweetwo;
    if (!bridge?.cache) return;
    let stop: () => void = () => undefined;
    void restoreCache(queryClient, bridge).finally(() => {
      setRestored(true);
      stop = startCacheSaver(queryClient, bridge);
    });
    return () => stop();
  }, [queryClient]);
  // 데스크톱: 트레이 위젯·트레이 메뉴가 고른 화면으로(main → 앱 창)
  useEffect(() => window.sweetwo?.onNavigate?.((path) => void router.navigate(path)), [router]);
  if (!restored) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <div className="hg-root" data-platform={platform}>
        <RouterProvider router={router} />
      </div>
    </QueryClientProvider>
  );
}
