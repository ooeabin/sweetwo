import { keepLogin, webAuth } from '@sweetwo/api';
import { AuthLayout } from '@sweetwo/ui';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';
import { paths, routeAfterLogin } from '../flow';
import { prefs } from '../prefs';

// /auth/callback: 소셜 로그인에서 돌아오는 웹 페이지(https://app.sweetwo.kr/auth/callback)
// - from=desktop: code(또는 error)와 state를 sweetwo:// 딥링크로 넘긴다(A-03 5번 ‘복귀 페이지’)
// - 웹: code를 세션으로 바꾸고 다음 화면으로
function readParams() {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const pick = (k: string) => q.get(k) ?? h.get(k);
  return { from: pick('from'), state: pick('state'), code: pick('code'), error: pick('error') };
}

export function AuthCallback() {
  const nav = useNavigate();
  const p = useMemo(readParams, []);
  const done = useRef(false);

  const deepLink = useMemo(() => {
    if (p.from !== 'desktop' || !p.state) return null;
    const u = new URL('sweetwo://auth/callback');
    u.searchParams.set('state', p.state);
    if (p.error) u.searchParams.set('error', p.error);
    else if (p.code) u.searchParams.set('code', p.code);
    return u.toString();
  }, [p]);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (deepLink) {
      window.location.href = deepLink;
      return;
    }
    const provider = prefs.pendingProvider();
    prefs.setPendingProvider(null);
    if (!provider) {
      nav(paths.login, { replace: true, state: { notice: copy.relogin } });
      return;
    }
    if (p.error || !p.code) {
      const cancelled = p.error === 'access_denied';
      track('login_failed', {
        method: provider,
        reason: cancelled ? 'cancelled' : 'provider_error',
      });
      nav(paths.login, {
        replace: true,
        state: { notice: cancelled ? copy.cancelled : copy.providerError(provider) },
      });
      return;
    }
    void webAuth
      .exchange(p.code)
      .then(() => {
        if (keepLogin.get()) prefs.setLoginAt(Date.now());
        return routeAfterLogin(provider);
      })
      .then((r) => nav(r.to, { replace: true, state: r.state }))
      .catch(() => {
        track('login_failed', { method: provider, reason: 'request_mismatch' });
        nav(paths.login, { replace: true, state: { notice: copy.relogin } });
      });
  }, [deepLink, nav, p]);

  if (!deepLink) return null;
  return (
    <AuthLayout
      title={copy.doneTitle}
      help={copy.doneHelp}
      actions={
        <a className="hg-btn hg-btn--primary hg-btn--block" href={deepLink}>
          {copy.openApp}
        </a>
      }
    />
  );
}
