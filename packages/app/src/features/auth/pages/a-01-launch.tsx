import { fetchLaunchConfig } from '@sweetwo/api';
import { formatKstDateTime, isBelowMin, WEB_IDLE_LOCK_MS } from '@sweetwo/core';
import { AuthLayout, Button, Wordmark } from '@sweetwo/ui';
import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ToastHost } from '../../../shared/toast';
import { copy } from '../copy';
import { paths, routeAfterLogin } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';
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

type Phase = 'checking' | 'update' | 'maintenance' | 'offline' | 'error' | 'ready';

const appVersion = () =>
  session.bridge?.appVersion ?? (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0';

// A-01 실행, 자동 로그인 판단: 최소 지원 버전 → 세션 → 앱 잠금. 판단이 끝나면 바로 다음 화면.
export function A01Launch() {
  const nav = useNavigate();
  const loc = useLocation();
  const [phase, setPhase] = useState<Phase>('checking');
  const [slow, setSlow] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);
  const [maintenanceEnds, setMaintenanceEnds] = useState<string | null>(null);
  const setReadOnly = useAuthStore((s) => s.setReadOnly);
  const ran = useRef(false);

  const decide = async (skipVersion = false) => {
    setPhase('checking');
    const here = loc.pathname;
    if (here === paths.callback) return setPhase('ready'); // 콜백 페이지가 스스로 처리
    const online = navigator.onLine;
    if (online && !skipVersion) {
      try {
        const cfg = await fetchLaunchConfig(session.platform);
        if (isBelowMin(appVersion(), cfg.min)) return setPhase('update');
        // 점검 중(AD-16): 13 공통 상태 13번
        const now = Date.now();
        const m = cfg.maintenance;
        if (m && Date.parse(m.starts) <= now && now < Date.parse(m.ends)) {
          setMaintenanceEnds(m.ends);
          return setPhase('maintenance');
        }
      } catch {
        /* 설정을 못 읽으면 막지 않는다 */
      }
    }
    if (session.webKeepExpired()) {
      await session.signOut();
      setPhase('ready');
      return nav(paths.expired, { replace: true, state: { reason: 'days14' } });
    }
    const has = await session.has();
    setSignedIn(has);
    if (!has) {
      if (!online) return setPhase('offline');
      setPhase('ready');
      if (PUBLIC.has(here) || here === '/i' || here.startsWith('/i/')) return; // 초대 코드 입력, 초대 링크(P-01)는 로그인 전에도
      if (here !== paths.home) prefs.setReturnTo(here + loc.search);
      return nav(prefs.started() ? paths.login : paths.start, { replace: true }); // O-01은 첫 실행에만
    }
    if (!online) return setPhase('ready'); // 오프라인 + 세션 있음: 마지막 데이터로
    try {
      const r = await routeAfterLogin();
      setPhase('ready');
      if (PUBLIC.has(here) || r.to !== paths.home || SIGNUP.has(here))
        nav(r.to, { replace: true, state: r.state });
    } catch {
      setPhase('ready'); // 서버 오류: 지금 화면 그대로(화면이 각자 오류를 보여 준다)
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

  // 로그인 이벤트로 바뀐 세션 상태 반영(데스크톱)
  useEffect(() => {
    const b = session.bridge;
    if (!b) return;
    return b.auth.onEvent((ev) => {
      if (ev.type === 'signed_in') setSignedIn(true);
      if (ev.type === 'signed_out') {
        setSignedIn(false);
        if (ev.reason === 'expired') nav(paths.expired, { replace: true });
      }
    });
  }, [nav]);

  useWebIdleLock(signedIn && phase === 'ready');

  if (phase === 'maintenance') {
    return (
      <AuthLayout
        media={<Wordmark />}
        title={copy.maintenanceTitle}
        help={
          maintenanceEnds
            ? copy.maintenanceEnds(formatKstDateTime(maintenanceEnds).slice(11))
            : undefined
        }
        actions={
          <Button variant="primary" block onClick={() => void decide()}>
            {copy.retry}
          </Button>
        }
      />
    );
  }

  if (phase === 'update') {
    return (
      <AuthLayout
        media={<Wordmark />}
        title={copy.updateTitle}
        help={copy.updateSub}
        actions={
          <>
            {/* 다운로드, 서명 검증, 설치는 배포 단계(자동 업데이트)에서 붙인다. 그 전까지는 실패 안내. */}
            <Button variant="primary" block onClick={() => setUpdateFailed(true)}>
              {updateFailed ? copy.retry : copy.updateNow}
            </Button>
            <button
              type="button"
              className="hg-btn hg-btn--link"
              onClick={() => {
                setReadOnly(true);
                void decide(true);
              }}
            >
              {copy.viewOnly}
            </button>
          </>
        }
        note={updateFailed ? copy.updateFailed : undefined}
      />
    );
  }
  if (phase === 'error') {
    return (
      <AuthLayout
        media={<Wordmark />}
        title={copy.signupFailed}
        actions={
          <Button variant="secondary" block onClick={() => window.location.reload()}>
            {copy.retry}
          </Button>
        }
      />
    );
  }
  if (phase === 'offline') {
    return (
      <AuthLayout
        media={<Wordmark />}
        title={copy.offlineNoSession}
        actions={
          <Button variant="secondary" block onClick={() => void decide()}>
            {copy.retry}
          </Button>
        }
      />
    );
  }
  if (phase === 'checking') {
    // 데스크톱: 워드마크 + (0.3초 넘으면) 진행 막대. 웹: 스플래시 없이 스켈레톤.
    return session.platform === 'desktop' ? (
      <main className="hg-auth" aria-busy="true">
        <Wordmark height={40} />
        {slow && (
          <span
            className="hg-skel"
            style={{ width: 'var(--space-22)', height: 'var(--space-1)' }}
          />
        )}
      </main>
    ) : (
      <main className="hg-auth" aria-busy="true">
        {slow && (
          <span
            className="hg-skel"
            style={{ width: '100%', maxWidth: 360, height: 'var(--space-14)' }}
          />
        )}
      </main>
    );
  }
  return (
    <>
      <Outlet />
      <LockGate active={signedIn} />
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
  if (ok === null) return null;
  return ok ? <>{children}</> : <Navigate to={paths.login} replace />;
}

/** 웹: 30분 동안 아무 입력이 없으면 A-08(‘오래 자리를 비워서 잠갔어요’) */
function useWebIdleLock(active: boolean) {
  const nav = useNavigate();
  const loc = useLocation();
  const here = useRef(loc.pathname);
  here.current = loc.pathname + loc.search;
  useEffect(() => {
    if (!active || session.platform !== 'web') return;
    let last = Date.now();
    const bump = () => (last = Date.now());
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      if (Date.now() - last < WEB_IDLE_LOCK_MS) return;
      prefs.setReturnTo(here.current);
      void session
        .signOut()
        .then(() => nav(paths.expired, { replace: true, state: { reason: 'idle' } }));
    }, 30_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [active, nav]);
}
