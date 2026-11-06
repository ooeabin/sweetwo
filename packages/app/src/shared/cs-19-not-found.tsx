import { Button, EmptyState } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { sharedCopy as copy } from './copy';

// 13 공통 상태 19번(2026-11-04): 없는 주소(알림·위젯 링크가 지워진 항목을 가리킬 때 포함) → “찾는 화면이 없어요” + 홈으로 가기.
// 7번: 화면을 그리다 오류가 나면 → “잠시 문제가 생겼어요” + 다시 시도. 개발자용 기본 오류 화면을 보이지 않음
function StatePage({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <main className="hg-state-page">
      <h1 className="hg-sr">{title}</h1>
      <EmptyState title={title} body={body} action={action} />
    </main>
  );
}

export function CS19NotFound() {
  const nav = useNavigate();
  return (
    <StatePage
      title={copy.notFoundTitle}
      body={copy.notFoundBody}
      action={
        <Button variant="primary" onClick={() => nav('/', { replace: true })}>
          {copy.goHome}
        </Button>
      }
    />
  );
}

export function RouteError() {
  const err = useRouteError();
  if (isRouteErrorResponse(err) && err.status === 404) return <CS19NotFound />;
  return (
    <StatePage
      title={copy.errorTitle}
      body={copy.errorBody}
      action={
        <Button variant="primary" onClick={() => window.location.reload()}>
          {copy.retry}
        </Button>
      }
    />
  );
}
