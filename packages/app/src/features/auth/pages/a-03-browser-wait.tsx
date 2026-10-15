import type { AuthProvider } from '@sweetwo/core';
import { AuthLayout, Button } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import type { LoginFailReason } from '../../../platform';
import { copy } from '../copy';
import { paths, routeAfterLogin } from '../flow';
import { session } from '../session';

const failNotice = (reason: LoginFailReason, p: AuthProvider) =>
  reason === 'timeout'
    ? copy.timeout
    : reason === 'cancelled'
      ? copy.cancelled
      : reason === 'request_mismatch'
        ? copy.relogin
        : copy.providerError(p);

// A-03 브라우저 로그인 대기(데스크톱만). 결과는 main이 딥링크로 받아 알려 준다.
export function A03BrowserWait() {
  const nav = useNavigate();
  const st = (useLocation().state ?? {}) as { provider?: AuthProvider; failed?: boolean };
  const [openFailed, setOpenFailed] = useState(!!st.failed);
  const bridge = session.bridge;
  const p = st.provider;

  useEffect(() => {
    if (!bridge || !p) return;
    const off = bridge.auth.onEvent((ev) => {
      if (ev.type === 'signed_in') {
        void routeAfterLogin(p)
          .then((r) => nav(r.to, { replace: true, state: r.state }))
          .catch(() =>
            nav(paths.login, { replace: true, state: { notice: copy.providerError(p) } }),
          );
      } else if (ev.type === 'login_failed') {
        const reason = ev.reason === 'network' ? 'provider_error' : ev.reason;
        track('login_failed', { method: p, reason });
        nav(paths.login, { replace: true, state: { notice: failNotice(ev.reason, p) } });
      }
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 화면에 들어올 때 한 번
  }, []);

  if (!bridge || !p) return <Navigate to={paths.login} replace />;

  async function cancel() {
    await bridge?.auth.cancel();
    if (p) track('login_failed', { method: p, reason: 'cancelled' });
    nav(paths.login, { replace: true });
  }
  const retry = async () => {
    const r = await (openFailed ? bridge.auth.start(p) : bridge.auth.reopen());
    setOpenFailed(!r.ok);
  };

  return (
    <AuthLayout
      title={copy.waitTitle}
      help={copy.waitHelp}
      actions={
        <>
          <p className="hg-auth__help">{copy.loginWith[p]}</p>
          <Button variant="secondary" block onClick={() => void retry()}>
            {openFailed ? copy.retry : copy.reopen}
          </Button>
          <Button variant="ghost" block onClick={() => void cancel()}>
            {copy.cancel}
          </Button>
        </>
      }
      note={openFailed ? copy.browserFailed : undefined}
    />
  );
}
