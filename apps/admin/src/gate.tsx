import {
  AdminError,
  adminBootstrap,
  adminMfaEnroll,
  adminMfaState,
  adminMfaVerify,
  adminSendLink,
  adminSession,
  adminSignOut,
  fetchAdminMe,
} from '@sweetwo/api';
import type { AdminMe } from '@sweetwo/core';
import { AuthLayout, Button, Field } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { copy } from './copy';
import { clearSessionClock, useSessionGuard } from './session';

// 어드민 들어가기: 회사 이메일 매직 링크 → 인증 앱(OTP) 등록·확인(aal2) → admin_me(관리자 연결·역할).
// IP 허용 목록은 WAF가 로그인 화면 전에 막음.
type Step = 'login' | 'enroll' | 'verify' | 'denied' | 'ready';
const MeContext = createContext<AdminMe | null>(null);
export const useAdmin = () => {
  const me = useContext(MeContext);
  if (!me) throw new Error('AdminGate 안에서만');
  return me;
};

async function resolve(): Promise<{ step: Step; me: AdminMe | null }> {
  const s = await adminSession();
  if (!s) return { step: 'login', me: null };
  const mfa = await adminMfaState();
  if (!mfa.factorId) return { step: 'enroll', me: null };
  if (mfa.current !== 'aal2') return { step: 'verify', me: null };
  try {
    return { step: 'ready', me: await fetchAdminMe() };
  } catch (e) {
    if (!(e instanceof AdminError && e.code === 'not_admin')) throw e;
    // 관리자가 아무도 없으면 회사 도메인 첫 로그인이 최고 관리자(서버가 확인)
    if (await adminBootstrap().catch(() => false))
      return { step: 'ready', me: await fetchAdminMe() };
    return { step: 'denied', me: null };
  }
}

export function AdminGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'gate'], queryFn: resolve, retry: false });
  const [expired, setExpired] = useState(false);
  const again = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['admin', 'gate'] });
  }, [qc]);
  const onExpire = useCallback(() => {
    setExpired(true);
    qc.clear();
    again();
  }, [qc, again]);

  if (q.isLoading) return null;
  if (q.isError)
    return (
      <AuthLayout title={copy.failed}>
        <Button variant="primary" onClick={again}>
          {copy.retry}
        </Button>
      </AuthLayout>
    );
  const step = q.data?.step ?? 'login';
  if (step === 'login') return <Login note={expired ? copy.expired : undefined} />;
  if (step === 'enroll') return <Enroll onDone={again} />;
  if (step === 'verify') return <Verify onDone={again} />;
  if (step === 'denied')
    return (
      <AuthLayout title={copy.notAdmin}>
        <Button variant="secondary" onClick={() => void adminSignOut().then(again)}>
          {copy.signOut}
        </Button>
      </AuthLayout>
    );
  return (
    <MeContext.Provider value={q.data?.me ?? null}>
      <Guard onExpire={onExpire}>{children}</Guard>
    </MeContext.Provider>
  );
}

function Guard({ onExpire, children }: { onExpire: () => void; children: ReactNode }) {
  useSessionGuard(onExpire);
  return <>{children}</>;
}

const RESEND_S = 60; // 같은 주소로 다시 보내기까지(Supabase 기본 메일 제한과 두 번 누르기 막기)

function Login({ note }: { note?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);
  const send = async () => {
    if (busy || wait > 0 || !email.includes('@')) return;
    setBusy(true);
    setErr(null);
    try {
      clearSessionClock();
      await adminSendLink(email.trim().toLowerCase(), window.location.origin);
      setSent(true);
      setWait(RESEND_S);
    } catch (e) {
      const code = e instanceof AdminError ? e.code : '';
      if (code === 'over_email_send_rate_limit') {
        setErr(copy.tooSoon);
        setWait(RESEND_S);
      } else setErr(code === 'email_address_not_authorized' ? copy.notAllowedEmail : copy.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title={copy.loginTitle}>
      <form
        className="hg-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {note && <p className="hg-help">{note}</p>}
        <p className="hg-help">{sent ? copy.linkSent : copy.loginHelp}</p>
        {wait > 0 && <p className="hg-help">{copy.resendIn(wait)}</p>}
        <Field
          label={copy.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          error={err ?? undefined}
        />
        <Button
          variant="primary"
          type="submit"
          aria-busy={busy}
          disabled={!email.includes('@') || wait > 0}
        >
          {copy.sendLink}
        </Button>
      </form>
    </AuthLayout>
  );
}

function CodeForm({ onSubmit }: { onSubmit: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="hg-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !/^\d{6}$/.test(code)) return;
        setBusy(true);
        setErr(null);
        onSubmit(code)
          .catch(() => setErr(copy.wrongCode))
          .finally(() => setBusy(false));
      }}
    >
      <Field
        label={copy.code}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        error={err ?? undefined}
      />
      <Button variant="primary" type="submit" aria-busy={busy} disabled={!/^\d{6}$/.test(code)}>
        {copy.verify}
      </Button>
    </form>
  );
}

function Enroll({ onDone }: { onDone: () => void }) {
  const f = useQuery({ queryKey: ['admin', 'enroll'], queryFn: adminMfaEnroll, retry: false });
  if (f.isLoading) return null;
  return (
    <AuthLayout title={copy.mfaEnrollTitle}>
      <p className="hg-help">{copy.mfaEnrollHelp}</p>
      {f.data?.qr && <img src={f.data.qr} alt="QR" width={180} height={180} />}
      {f.data?.secret && <code className="hg-mask-text">{f.data.secret}</code>}
      <CodeForm
        onSubmit={async (code) => {
          if (!f.data) return;
          await adminMfaVerify(f.data.factorId, code);
          onDone();
        }}
      />
    </AuthLayout>
  );
}

function Verify({ onDone }: { onDone: () => void }) {
  return (
    <AuthLayout title={copy.mfaTitle}>
      <CodeForm
        onSubmit={async (code) => {
          const m = await adminMfaState();
          if (!m.factorId) return;
          await adminMfaVerify(m.factorId, code);
          onDone();
        }}
      />
    </AuthLayout>
  );
}
