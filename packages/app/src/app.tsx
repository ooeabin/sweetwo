import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useState } from 'react';
import type { Platform } from './platform';
import { routes } from './routes';

export function App({ platform }: { platform: Platform }) {
  const [queryClient] = useState(() => new QueryClient());
  // 데스크톱(file://)은 해시 라우터, 웹은 브라우저 라우터
  const [router] = useState(() => (platform === 'desktop' ? createHashRouter(routes) : createBrowserRouter(routes)));
  return (
    <QueryClientProvider client={queryClient}>
      <div className="hg-root" data-platform={platform}>
        <RouterProvider router={router} />
      </div>
    </QueryClientProvider>
  );
}
