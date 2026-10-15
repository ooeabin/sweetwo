import { AuthLayout, Button } from '@sweetwo/ui';
import { useLocation, useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';

export type ExpiredReason = keyof typeof copy.expiredReason;

// A-08 세션 만료. 같은 계정으로 다시 로그인하면 하던 화면으로(returnTo).
export function A08SessionExpired() {
  const nav = useNavigate();
  const reason = (useLocation().state as { reason?: ExpiredReason } | null)?.reason;
  return (
    <AuthLayout
      title={copy.expiredTitle}
      help={reason ? copy.expiredReason[reason] : undefined}
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
            onClick={() => {
              // 다른 계정: 이 기기 로컬 데이터 삭제 후 A-02(오프라인 캐시가 생기면 여기서 같이 지운다)
              prefs.setReturnTo(null);
              prefs.setPinAsked(false);
              nav(paths.login, { replace: true, state: { entry: 'session_expired' } });
            }}
          >
            {copy.otherAccount}
          </Button>
        </>
      }
    />
  );
}
