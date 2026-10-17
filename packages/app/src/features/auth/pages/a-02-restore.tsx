import { cancelAccountDeletion } from '@sweetwo/api';
import { AuthLayout, Button } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths, routeAfterLogin } from '../flow';
import { session } from '../session';

// A-02 예외(docs/spec/15-login-signup.md): 삭제 요청 30일 안 계정이 다시 로그인하면 “계정 삭제를 취소할까요?”
// ‘취소하고 계속 쓰기’ → 혼자 쓰기로 복구(연결돼 있던 배우자에게 ‘계정 복구’ 알림, 30일 안 다시 연결 가능),
// ‘그대로 두기’ → 로그아웃
export function A02Restore() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout
      title={copy.restoreTitle}
      help={copy.restoreHelp}
      actions={
        <>
          <Button
            variant="primary"
            block
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void cancelAccountDeletion()
                .then(() => routeAfterLogin())
                .then((r) => nav(r.to, { replace: true, state: r.state }))
                .catch(() => setBusy(false));
            }}
          >
            {copy.restoreYes}
          </Button>
          <Button
            variant="secondary"
            block
            disabled={busy}
            onClick={() => void session.signOut().then(() => nav(paths.login, { replace: true }))}
          >
            {copy.restoreNo}
          </Button>
        </>
      }
    />
  );
}
