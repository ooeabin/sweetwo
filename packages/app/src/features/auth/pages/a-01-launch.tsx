import {
  fetchLaunchConfig,
  fetchPendingTerms,
  qk,
  setReadOnly as setApiReadOnly,
} from '@sweetwo/api';
import { formatKstDateTime, isBelowMin } from '@sweetwo/core';
import { AuthLayout, Button, Icon, Wordmark } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { SignOutReason } from '../../../platform';
import { track } from '../../../shared/analytics';
import { ToastHost } from '../../../shared/toast';
import { copy } from '../copy';
import { isWaitScreenOpen, paths, routeAfterLogin } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';
import { clearLocalSession } from '../sign-out';
import { useAuthStore } from '../store';
import { LockGate } from './a-06-lock';

// 로그인 없이 볼 수 있는 화면
const PUBLIC = new Set<string>([
  paths.start,
  paths.login,
  paths.wait,
  paths.expired,
  paths.callback,
]);
// 세션은 있지만 계정(app_user)이 아직 없어도 되는 화면
const SIGNUP = new Set<string>([paths.email, paths.terms, paths.pinSetup]);
const isInvitePath = (p: string) => p === '/i' || p.startsWith('/i/');

type Phase = 'checking' | 'update' | 'maintenance' | 'offline' | 'error' | 'ready';

/** 설정 확인(최소 버전, 점검)은 3초까지만 기다림. 넘으면 막지 않고 다음 판단으로(2026-11-10 S1-08) */
const CONFIG_TIMEOUT_MS = 3000;
/** 판단이 이만큼 넘게 걸리면 13 공통 상태 5번 “연결이 느려요” Banner + 다시 시도 */
const SLOW_BANNER_MS = 10_000;

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

const appVersion = () =>
  session.bridge?.appVersion ?? (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0';

// A-01 실행, 자동 로그인 판단: 최소 지원 버전 → 세션 → 앱 잠금. 판단이 끝나면 바로 다음 화면.
export function A01Launch() {
  const nav = useNavigate();
  const loc = useLocation();
  const [phase, setPhase] = useState<Phase>('checking');
  const [slow, setSlow] = useState(false);
  const [verySlow, setVerySlow] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);
  const [maintenanceEnds, setMaintenanceEnds] = useState<string | null>(null);
  const setReadOnly = useAuthStore((s) => s.setReadOnly);
  const ran = useRef(false);
  const signedInRef = useRef(false);
  signedInRef.current = signedIn;
  // 다시 시도하면 앞선 판단의 늦은 결과는 버림
  const run = useRef(0);

  const decide = async (skipVersion = false) => {
    const id = ++run.current;
    const stale = () => id !== run.current;
    setPhase('checking');
    setVerySlow(false);
    const slowTimer = setTimeout(() => !stale() && setVerySlow(true), SLOW_BANNER_MS);
    try {
      const here = loc.pathname;
      if (here === paths.callback) return setPhase('ready'); // 콜백 페이지가 스스로 처리
      const online = navigator.onLine;
      if (online && !skipVersion) {
        try {
          const cfg = await withTimeout(fetchLaunchConfig(session.platform), CONFIG_TIMEOUT_MS);
          if (stale()) return;
          if (isBelowMin(appVersion(), cfg.min)) return setPhase('update');
          // 점검 중(AD-16): 13 공통 상태 13번
          const now = Date.now();
          const m = cfg.maintenance;
          if (m && Date.parse(m.starts) <= now && now < Date.parse(m.ends)) {
            setMaintenanceEnds(m.ends);
            return setPhase('maintenance');
          }
        } catch {
          /* 설정을 못 읽거나 3초 넘으면 막지 않는다 */
        }
      }
      const has = await session.has();
      if (stale()) return;
      setSignedIn(has);
      if (!has) {
        if (!online) return setPhase('offline');
        setPhase('ready');
        if (PUBLIC.has(here) || isInvitePath(here)) return; // 초대 코드 입력, 초대 링크(P-01)는 로그인 전에도
        if (here !== paths.home) prefs.setReturnTo(here + loc.search);
        return nav(prefs.started() ? paths.login : paths.start, { replace: true }); // O-01은 첫 실행에만
      }
      if (!online) return setPhase('ready'); // 오프라인 + 세션 있음: 마지막 데이터로
      try {
        const r = await routeAfterLogin();
        if (stale()) return;
        setPhase('ready');
        if (PUBLIC.has(here) || r.to !== paths.home || SIGNUP.has(here))
          nav(r.to, { replace: true, state: r.state });
      } catch {
        if (!stale()) setPhase('ready'); // 서버 오류: 지금 화면 그대로(화면이 각자 오류를 보여 준다)
      }
    } finally {
      clearTimeout(slowTimer);
    }
  };

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const t = setTimeout(() => setSlow(true), 300);
    // 판단 중 예상 못 한 오류(설정 누락 등)가 나도 빈 화면으로 멈추지 않게
    void decide()
      .catch((e: unknown) => {
        if (import.meta.env.DEV) console.error('[A-01]', e);
        setPhase('error');
      })
      .finally(() => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 실행할 때 한 번
  }, []);

  // 오프라인 화면: 다시 연결되면 저절로 다시 판단(2026-11-10 S1-33)
  useEffect(() => {
    if (phase !== 'offline') return;
    const on = () => void decide();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- decide는 매번 새로 만들어짐
  }, [phase]);

  // 로그인 이벤트로 바뀐 세션 상태 반영(앱)
  useEffect(() => {
    const b = session.bridge;
    if (!b) return;
    return b.auth.onEvent((ev) => {
      if (ev.type === 'signed_in') {
        setSignedIn(true);
        // A-03을 떠난 사이(Android 뒤로) 로그인이 끝났으면 여기서 이어 감(2026-11-10 S1-15)
        if (!isWaitScreenOpen())
          void routeAfterLogin(ev.provider)
            .then((r) => nav(r.to, { replace: true, state: r.state }))
            .catch(() => undefined);
      }
      if (ev.type === 'signed_out') {
        setSignedIn(false);
        onForcedSignOut(ev.reason);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 실행할 때 한 번
  }, [nav]);

  /** 브리지가 스스로 로그아웃함(만료, 다른 기기, PIN 5번 틀림): 이 기기 데이터를 비우고 안내(직접 로그아웃은 sign-out.ts가 이미 비움) */
  const onForcedSignOut = (reason: SignOutReason) => {
    if (reason === 'user') return;
    if (reason === 'pin_failed') {
      clearLocalSession({ forgetPin: true }); // 잠금 화면이 A-02로 보냄
      return;
    }
    // 만료: 같은 계정으로 다시 로그인하면 하던 화면으로(15 A-08 2번, S1-13)
    const here = window.location.pathname;
    if (!PUBLIC.has(here) && !SIGNUP.has(here) && here !== paths.home)
      prefs.setReturnTo(here + window.location.search);
    clearLocalSession({ keepReturnTo: true });
    nav(paths.expired, {
      replace: true,
      state: { reason: reason === 'other_device' ? 'otherDevice' : 'expired' },
    });
  };

  // 초대 링크(앱 링크, sweetwo://i/코드)로 앱이 열리면 A-07(/i/코드)로(2026-11-10 S1-01).
  // 판단이 끝난 뒤 구독(처음 실행 때 들어온 링크는 브리지가 구독할 때 넘김). 잠겨 있으면 LockGate가 가리고 풀면 보임.
  // 가입·로그인 대기 중이면 끝난 뒤 돌아갈 곳으로만 기억
  useEffect(() => {
    if (phase !== 'ready') return;
    return session.bridge?.onInvite((code) => {
      const to = `/i/${encodeURIComponent(code)}`;
      track('invite_link_opened', { signed_in: signedInRef.current });
      const here = window.location.pathname;
      if (SIGNUP.has(here) || here === paths.wait) prefs.setReturnTo(to);
      else nav(to);
    });
  }, [phase, nav]);

  const retryButton = (
    <Button variant="primary" block onClick={() => void decide()}>
      {copy.retry}
    </Button>
  );

  if (phase === 'maintenance') {
    return (
      <AuthLayout
        icon="wrench"
        art="status-maintenance"
        title={copy.maintenanceTitle}
        help={
          maintenanceEnds
            ? copy.maintenanceEnds(formatKstDateTime(maintenanceEnds).slice(11))
            : undefined
        }
        actions={retryButton}
      />
    );
  }

  if (phase === 'update') {
    return (
      <AuthLayout
        icon="download"
        art="status-update"
        title={copy.updateTitle}
        help={copy.updateSub}
        actions={
          <>
            {/* 스토어로(웹사이트 앱 받기 페이지가 기기에 맞는 스토어 버튼을 보여 줌). 못 열면 버튼이 ‘다시 시도’(15 A-01 예외) */}
            <Button
              variant="primary"
              block
              onClick={() =>
                session.bridge?.openUrl
                  ? void session.bridge
                      .openUrl(copy.downloadUrl)
                      .then(() => setUpdateFailed(false))
                      .catch(() => setUpdateFailed(true))
                  : setUpdateFailed(true)
              }
            >
              {updateFailed ? copy.retry : copy.updateNow}
            </Button>
            <button
              type="button"
              className="hg-btn hg-btn--link"
              onClick={() => {
                // 보기만(13 공통 상태 12번): 서버로 가는 쓰기를 보내지 않고, 저장하려 하면 토스트(api client)
                setReadOnly(true);
                setApiReadOnly(true);
                track('update_view_only', { app_version: appVersion() });
                void decide(true);
              }}
            >
              {copy.viewOnly}
            </button>
          </>
        }
      />
    );
  }
  if (phase === 'error') {
    return (
      <AuthLayout
        icon="circle-alert"
        art="status-error"
        title={copy.errorTitle}
        help={copy.errorHelp}
        actions={
          <Button variant="primary" block onClick={() => window.location.reload()}>
            {copy.retry}
          </Button>
        }
      />
    );
  }
  if (phase === 'offline') {
    return (
      <AuthLayout
        icon="link"
        art="status-offline"
        title={copy.offlineNoSession}
        actions={retryButton}
      />
    );
  }
  if (phase === 'checking') {
    // 앱: 워드마크 + (0.3초 넘으면) 진행 막대. 웹: 스플래시 없이 스켈레톤. 10초 넘으면 “연결이 느려요” + 다시 시도
    const banner = verySlow && (
      <div className="hg-banner hg-banner--info hg-auth__alert" role="status">
        <Icon name="info" size={16} />
        <span>{copy.slow}</span>
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ marginLeft: 'auto' }}
          onClick={() => void decide()}
        >
          {copy.retry}
        </button>
      </div>
    );
    return session.bridge ? (
      <main className="hg-auth" aria-busy="true">
        <Wordmark height={40} />
        {slow && (
          <span
            className="hg-skel"
            style={{ width: 'var(--space-22)', height: 'var(--space-1)' }}
          />
        )}
        {banner}
      </main>
    ) : (
      <main className="hg-auth" aria-busy="true">
        {slow && (
          <span
            className="hg-skel"
            style={{ width: '100%', maxWidth: 360, height: 'var(--space-14)' }}
          />
        )}
        {banner}
      </main>
    );
  }
  return (
    <>
      <LockGate active={signedIn}>
        <Outlet />
      </LockGate>
      <ToastHost />
    </>
  );
}

/** 세션과 계정이 있어야 하는 화면 */
export function RequireAccount({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const loc = useLocation();
  useEffect(() => {
    void session.has().then(setOk);
  }, [loc.pathname]);
  // 약관 개정 재동의·마케팅 재확인(A-05r): 남은 게 있으면 먼저. 못 읽으면 막지 않음
  const pending = useQuery({
    queryKey: qk.pendingTerms,
    queryFn: fetchPendingTerms,
    enabled: ok === true,
    retry: false,
    staleTime: 10 * 60_000,
  });
  if (ok === null) return null;
  if (!ok) return <Navigate to={paths.login} replace />;
  if (pending.data?.length && loc.pathname !== paths.reconsent)
    return <Navigate to={paths.reconsent} replace state={{ back: loc.pathname + loc.search }} />;
  return <>{children}</>;
}
