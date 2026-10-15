import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { initSession } from './features/auth';
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
  return (
    <QueryClientProvider client={queryClient}>
      <div className="hg-root" data-platform={platform}>
        <RouterProvider router={router} />
      </div>
    </QueryClientProvider>
  );
}
