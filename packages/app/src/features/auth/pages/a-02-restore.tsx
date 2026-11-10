import { cancelAccountDeletion } from '@sweetwo/api';
import { AuthLayout, Button } from '@sweetwo/ui';
import { TOAST_MS } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths, routeAfterLogin } from '../flow';
import { signOut } from '../sign-out';

// A-02 예외(docs/spec/15-login-signup.md): 삭제 요청 30일 안 계정이 다시 로그인하면 “계정 삭제를 취소할까요?”
// ‘취소하고 계속 쓰기’ → 혼자 쓰기로 복구(연결돼 있던 파트너에게 ‘계정 복구’ 알림, 30일 안 다시 연결 가능),
// ‘그대로 두기’ → 로그아웃
export function A02Restore() {
  const nav = useNavigate();
  // 누른 버튼(yes 복구, no 그대로 두기)만 도는 원
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  // 실패하면 로그인 화면 알림 자리(hg-auth__toast)에 4초(2026-11-06, 조용히 멈추던 것)
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!failed) return;
    const t = window.setTimeout(() => setFailed(false), TOAST_MS.plain);
    return () => window.clearTimeout(t);
  }, [failed]);
  return (
    <AuthLayout
      icon="user"
      art="status-restore"
      title={copy.restoreTitle}
      help={copy.restoreHelp}
      toast={failed ? copy.restoreFailed : undefined}
      actions={
        <>
          <Button
            variant="primary"
            block
            loading={busy === 'yes'}
            onClick={() => {
              if (busy) return;
              setBusy('yes');
              void cancelAccountDeletion()
                .then(() => routeAfterLogin())
                .then((r) => nav(r.to, { replace: true, state: r.state }))
                .catch(() => {
                  setBusy(null);
                  setFailed(true);
                });
            }}
          >
            {copy.restoreYes}
          </Button>
          <Button
            variant="secondary"
            block
            loading={busy === 'no'}
            onClick={() => {
              if (busy) return;
              setBusy('no');
              void signOut()
                .then(() => nav(paths.login, { replace: true }))
                .catch(() => {
                  setBusy(null);
                  setFailed(true);
                });
            }}
          >
            {copy.restoreNo}
          </Button>
        </>
      }
    />
  );
}
