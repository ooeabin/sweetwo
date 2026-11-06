import { AdminError, adminMfaState, adminMfaVerify } from '@sweetwo/api';
import { Button, Field } from '@sweetwo/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { copy } from './copy';

// 재인증(33 3장 ‘재인증’, 27 AD-04 5번): L2 동의 요청, 승인·거절, 관리자 잠금 직전에 서버가 ‘reauth_required’를 주면
// 인증 앱 숫자를 다시 받고(5분 안 확인한 세션만 통과) 같은 일을 한 번 더 함.
type Guard = <T>(fn: () => Promise<T>) => Promise<T>;
const Ctx = createContext<Guard>((fn) => fn());
export const useReauth = () => useContext(Ctx);

export function ReauthProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<{ done: (ok: boolean) => void } | null>(null);
  const guard = useCallback<Guard>(async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof AdminError && e.code === 'reauth_required')) throw e;
      const ok = await new Promise<boolean>((done) => setAsk({ done }));
      if (!ok) throw new AdminError('reauth_cancelled');
      return fn();
    }
  }, []);
  return (
    <Ctx.Provider value={guard}>
      {children}
      {ask && (
        <ReauthDialog
          onDone={(ok) => {
            ask.done(ok);
            setAsk(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function ReauthDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const id = useId();
  const box = useRef<HTMLFormElement>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onDone]);
  return (
    <div className="hg-scrim" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <form
        ref={box}
        className="hg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !/^\d{6}$/.test(code)) return;
          setBusy(true);
          setErr(null);
          adminMfaState()
            .then((m) => {
              if (!m.factorId) throw new AdminError('mfa_required');
              return adminMfaVerify(m.factorId, code);
            })
            .then(() => onDone(true))
            .catch(() => setErr(copy.wrongCode))
            .finally(() => setBusy(false));
        }}
      >
        <h2 id={`${id}-t`} className="hg-modal__title">
          {copy.reauthTitle}
        </h2>
        <p className="hg-modal__body">{copy.reauthBody}</p>
        <Field
          label={copy.code}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          error={err ?? undefined}
        />
        <div className="hg-modal__actions">
          <Button variant="secondary" type="button" onClick={() => onDone(false)}>
            {copy.cancel}
          </Button>
          <Button variant="primary" type="submit" aria-busy={busy} disabled={code.length !== 6}>
            {copy.reauthGo}
          </Button>
        </div>
      </form>
    </div>
  );
}
