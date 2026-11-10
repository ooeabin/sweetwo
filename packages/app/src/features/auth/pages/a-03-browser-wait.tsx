import type { AuthProvider } from '@sweetwo/core';
import { AuthLayout, Button, ProviderMark } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import type { LoginFailReason } from '../../../platform';
import { useHardwareBack } from '../back';
import { copy } from '../copy';
import {
  paths,
  routeAfterLogin,
  setWaitScreenOpen,
  type LoginEntryState,
  type LoginNotice,
} from '../flow';
import { session } from '../session';
import { signOut } from '../sign-out';

/** A-02로 돌아갈 때 안내. 요청 불일치만 남는 띠, 나머지(취소, 시간 초과, 제공자 오류)는 4초 알약(15 A-03 예외, AuthLayout.md) */
const failNotice = (reason: LoginFailReason, p: AuthProvider): LoginNotice =>
  reason === 'request_mismatch'
    ? { notice: copy.relogin }
    : {
        notice:
          reason === 'timeout'
            ? copy.timeout
            : reason === 'cancelled'
              ? copy.cancelled
              : copy.providerError(p),
        toast: true,
      };

// A-03 로그인 창 대기(모바일 앱). 결과는 네이티브 브리지가 앱 링크로 받아 알려 준다.
// 취소·실패면 A-02가 넘긴 상태(초대 문구 등)를 그대로 돌려줌. Android 하드웨어 뒤로·Esc = 취소(2026-11-10).
export function A03BrowserWait() {
  const nav = useNavigate();
  const st = (useLocation().state ?? {}) as {
    provider?: AuthProvider;
    failed?: boolean;
    back?: LoginEntryState;
  };
  const [openFailed, setOpenFailed] = useState(!!st.failed);
  const bridge = session.bridge;
  const p = st.provider;
  const toLogin = (n?: LoginNotice) =>
    nav(paths.login, { replace: true, state: { ...st.back, ...n } });

  async function cancel() {
    await bridge?.auth.cancel();
    if (p) track('login_failed', { method: p, reason: 'cancelled' });
    toLogin();
  }
  useHardwareBack(() => void cancel(), !!bridge && !!p);

  useEffect(() => {
    if (!bridge || !p) return;
    setWaitScreenOpen(true);
    // 새로 고침·다시 실행으로 기다리던 요청이 없어졌으면 A-02로(끝없이 기다리지 않게, S1-34)
    if (!st.failed && bridge.auth.pending)
      void bridge.auth.pending().then((on) => {
        if (!on) toLogin();
      });
    const off = bridge.auth.onEvent((ev) => {
      if (ev.type === 'signed_in') {
        void routeAfterLogin(p)
          .then((r) => nav(r.to, { replace: true, state: r.state }))
          // 로그인 상태를 못 읽으면 세션을 남기지 않고 A-02(S1-16)
          .catch(() =>
            signOut().finally(() => toLogin({ notice: copy.providerError(p), toast: true })),
          );
      } else if (ev.type === 'login_failed') {
        const reason = ev.reason === 'network' ? 'provider_error' : ev.reason;
        track('login_failed', { method: p, reason });
        toLogin(failNotice(ev.reason, p));
      }
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      setWaitScreenOpen(false);
      off();
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 화면에 들어올 때 한 번
  }, []);

  if (!bridge || !p) return <Navigate to={paths.login} replace />;

  const retry = async () => {
    const r = await (openFailed ? bridge.auth.start(p) : bridge.auth.reopen());
    setOpenFailed(!r.ok);
  };

  return (
    <AuthLayout
      // 상태 그림 자리(2026-11-10 아이콘 원 대신 회색 빈 자리, 그림은 나중에): 기다리는 중 = 브라우저 대기, 실패 = 오류
      art={openFailed ? 'status-error' : 'status-wait'}
      // 로그인 중인 방법: 제공자 마크 + “카카오로 로그인”(15 A-03 1번)
      media={
        <p className="hg-auth__provider">
          <ProviderMark provider={p} />
          {copy.loginWith[p]}
        </p>
      }
      title={openFailed ? copy.browserFailed : copy.waitTitle}
      help={openFailed ? undefined : copy.waitHelp}
      actions={
        <>
          <Button variant="secondary" block onClick={() => void retry()}>
            {openFailed ? copy.retry : copy.reopen}
          </Button>
          <Button variant="ghost" block onClick={() => void cancel()}>
            {copy.cancel}
          </Button>
        </>
      }
    />
  );
}
