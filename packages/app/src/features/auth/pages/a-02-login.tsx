import { keepLogin, webAuth } from '@sweetwo/api';
import { authProviders, type AuthProvider } from '@sweetwo/core';
import { AuthLayout, ProviderButton, Wordmark } from '@sweetwo/ui';
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
  const st = (loc.state ?? {}) as LoginNotice & {
    fromStart?: boolean;
    entry?: Entry;
    inviter?: string;
  };
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
      className={st.inviter ? 'hg-auth--login' : 'hg-auth--hero hg-auth--login'}
      media={
        st.inviter ? (
          // 초대한 사람 아바타(사진 없음: 찬우 = person-1). 글자는 제목이 읽어 주니 화면 읽기에서 숨김
          <span className="hg-avatar hg-avatar--p1 hg-avatar--xl" aria-hidden="true">
            {st.inviter.slice(0, 1)}
          </span>
        ) : (
          <Wordmark height={56} />
        )
      }
      title={st.inviter ? copy.joinTitle(st.inviter) : copy.catchphrase}
      onBack={st.fromStart ? () => nav(-1) : undefined}
      backLabel={st.inviter ? undefined : copy.toStart}
      actions={
        <>
          {authProviders.map((p) => (
            <ProviderButton
              key={p}
              provider={p}
              variant={st.conflict === p ? 'primary' : undefined}
              recent={recent === p}
              recentLabel={copy.recent}
              disabled={!online || busy !== null}
              className={busy === p ? 'is-loading' : undefined}
              onClick={() => void start(p)}
            >
              {copy.continueWith[p]}
            </ProviderButton>
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
