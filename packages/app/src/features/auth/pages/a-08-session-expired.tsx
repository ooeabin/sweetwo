import { AuthLayout, Button } from '@sweetwo/ui';
import { useLocation, useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths } from '../flow';
import { signOut } from '../sign-out';

export type ExpiredReason = keyof typeof copy.expiredReason;

// A-08 세션 만료. 보조 = 사유(출시는 “로그인이 만료됐어요” 한 줄, 2026-11-10).
// ‘로그인하기’ → A-02 → 같은 계정이면 하던 화면으로(만료 때 A-01이 returnTo를 남김).
// ‘다른 계정으로 로그인’ → 이 기기 데이터(캐시, 최근 사용 방법, PIN, 돌아갈 화면)를 지우고 A-02.
export function A08SessionExpired() {
  const nav = useNavigate();
  const reason = (useLocation().state as { reason?: ExpiredReason } | null)?.reason ?? 'expired';
  return (
    <AuthLayout
      art="status-lock"
      title={copy.expiredTitle}
      help={copy.expiredReason[reason]}
      actions={
        <>
          <Button
            variant="primary"
            block
            onClick={() => nav(paths.login, { replace: true, state: { entry: 'session_expired' } })}
          >
            {copy.loginAgain}
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() =>
              void signOut({ accountChange: true }).finally(() =>
                nav(paths.login, { replace: true, state: { entry: 'session_expired' } }),
              )
            }
          >
            {copy.otherAccount}
          </Button>
        </>
      }
    />
  );
}
