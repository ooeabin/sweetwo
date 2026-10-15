import { keepLogin, webAuth } from '@sweetwo/api';
import { authProviders, type AuthProvider } from '@sweetwo/core';
import { AuthLayout, Button, SceneMedia } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';
import { paths, type LoginNotice } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';

type Entry = 'first_run' | 'revisit' | 'invite' | 'session_expired';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// A-02 로그인 방법 선택(로그인과 가입 한 화면)
export function A02Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const st = (loc.state ?? {}) as LoginNotice & { fromStart?: boolean; entry?: Entry };
  const online = useOnline();
  const recent = prefs.lastProvider();
  const [keep, setKeep] = useState(() => keepLogin.get());
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [notice, setNotice] = useState(st.notice);
  const entry: Entry = st.entry ?? (recent ? 'revisit' : 'first_run');
  const desktop = session.platform === 'desktop';

  const start = async (p: AuthProvider) => {
    setBusy(p);
    setNotice(undefined);
    if (desktop && session.bridge) {
      track('login_started', { method: p, entry, flow: 'browser' });
      const r = await session.bridge.auth.start(p);
      if (!r.ok) track('login_failed', { method: p, reason: 'browser_open_failed' });
      nav(paths.wait, { state: { provider: p, failed: !r.ok } });
      return;
    }
    // 웹: 지금은 리다이렉트만(넓은 창 팝업은 아직)
    track('login_started', { method: p, entry, flow: 'redirect' });
    keepLogin.set(keep);
    prefs.setPendingProvider(p);
    try {
      await webAuth.start(p, `${window.location.origin}${paths.callback}`);
    } catch {
      setBusy(null);
      setNotice(copy.providerError(p));
      track('login_failed', { method: p, reason: 'provider_error' });
    }
  };

  return (
    <AuthLayout
      media={<SceneMedia scene="A-02" width={240} />}
      title={copy.loginTitle}
      help={copy.loginHelp}
      onBack={st.fromStart ? () => nav(-1) : undefined}
      actions={
        <>
          {authProviders.map((p) => (
            <Button
              key={p}
              variant={st.conflict === p ? 'primary' : 'secondary'}
              block
              disabled={!online || busy !== null}
              className={busy === p ? 'is-loading' : undefined}
              onClick={() => void start(p)}
            >
              {copy.continueWith[p]}
              {recent === p && <span className="hg-tag">{copy.recent}</span>}
            </Button>
          ))}
          {!desktop && (
            <button
              type="button"
              role="checkbox"
              aria-checked={keep}
              className="hg-consent__check"
              style={{ justifyContent: 'center' }}
              onClick={() => setKeep(!keep)}
            >
              <span className={keep ? 'hg-checkbox is-on' : 'hg-checkbox'} aria-hidden="true" />
              <span className="hg-consent__label">{copy.keepLogin}</span>
            </button>
          )}
        </>
      }
      note={!online ? copy.offline : notice}
    />
  );
}
