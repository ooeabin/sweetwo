import { isWeakPin, pinRemainingNotice } from '@sweetwo/core';
import { AuthLayout, Button, LockScreen } from '@sweetwo/ui';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';

const Center = ({ children }: { children: ReactNode }) => (
  <main className="hg-auth">{children}</main>
);

// A-06 앱 잠금 설정(데스크톱, 이 기기에 PIN이 없을 때 첫 로그인 직후 1회)
export function A06LockSetup() {
  const nav = useNavigate();
  const bridge = session.bridge;
  const [step, setStep] = useState<'enter' | 'confirm' | 'touch'>('enter');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();

  const finish = () => {
    prefs.setPinAsked(true);
    nav(paths.home, { replace: true });
  };
  if (!bridge) return null;

  if (step === 'touch') {
    return (
      <AuthLayout
        title={copy.touchIdAsk}
        actions={
          <>
            <Button
              variant="primary"
              block
              onClick={() => void bridge.lock.setTouchId(true).then(finish)}
            >
              {copy.touchIdYes}
            </Button>
            <Button variant="ghost" block onClick={finish}>
              {copy.later}
            </Button>
          </>
        }
      />
    );
  }

  const complete = async (pin: string) => {
    if (step === 'enter') {
      if (isWeakPin(pin)) {
        setError(copy.pinWeak);
        setValue('');
        return;
      }
      setFirst(pin);
      setValue('');
      setError(undefined);
      setStep('confirm');
      return;
    }
    if (pin !== first) {
      // 확인 PIN 불일치: 처음부터 다시
      setError(copy.pinMismatch);
      setFirst('');
      setValue('');
      setStep('enter');
      return;
    }
    await bridge.lock.setPin(pin);
    const s = await bridge.lock.status();
    if (s.touchIdAvailable) setStep('touch');
    else finish();
  };

  return (
    <Center>
      <LockScreen
        title={step === 'enter' ? copy.pinSetTitle : copy.pinConfirm}
        sub={step === 'enter' ? copy.pinSetSub : undefined}
        value={value}
        onChange={(v) => {
          setValue(v);
          if (v.length > 0) setError(undefined);
        }}
        onComplete={(p) => void complete(p)}
        error={error}
        footer={
          // ‘나중에 할게요’: 잠금 꺼진 채 시작(이번 달 ‘할 일’에 남기는 건 할 일 기능에서)
          <button type="button" className="hg-btn hg-btn--link" onClick={finish}>
            {copy.later}
          </button>
        }
      />
    </Center>
  );
}

/** A-06 해제. 잠겨 있으면 화면 전체를 덮는다(금액, 이름 모두 가림). Ctrl(⌘)+L로 잠금. */
export function LockGate({ active }: { active: boolean }) {
  const nav = useNavigate();
  const bridge = session.bridge;
  const [locked, setLocked] = useState(false);
  const [touchId, setTouchId] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const tryTouchId = useCallback(async () => {
    if (!bridge) return;
    if (await bridge.lock.unlockWithTouchId()) setLocked(false);
  }, [bridge]);

  useEffect(() => {
    if (!bridge || !active) return;
    void bridge.lock.status().then((s) => {
      setLocked(s.locked);
      setTouchId(s.touchIdEnabled);
      if (s.locked && s.touchIdEnabled) void tryTouchId();
    });
    const off = bridge.lock.onLock(() => {
      setLocked(true);
      setValue('');
      setError(undefined);
      setNotice(undefined);
      void bridge.lock.status().then((s) => {
        setTouchId(s.touchIdEnabled);
        if (s.touchIdEnabled) void tryTouchId();
      });
    });
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        void bridge.lock.lockNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
    };
  }, [bridge, active, tryTouchId]);

  if (!bridge || !active || !locked) return null;

  const verify = async (pin: string) => {
    const r = await bridge.lock.verify(pin);
    setValue('');
    if (r.ok) {
      setLocked(false);
      setError(undefined);
      setNotice(undefined);
      return;
    }
    if (r.signedOut) {
      // 5회 실패: main이 로그아웃하고 PIN을 지웠다 → A-02, 로그인 뒤 PIN 새로 만들기
      prefs.setPinAsked(false);
      setLocked(false);
      nav(paths.login, { replace: true, state: { notice: copy.pinLockedOut } });
      return;
    }
    setError(copy.pinWrong);
    const n = pinRemainingNotice(r.failed);
    setNotice(n === null ? undefined : copy.pinRemaining(n));
  };

  const forgot = async () => {
    prefs.setPinAsked(false);
    await session.signOut();
    setLocked(false);
    nav(paths.login, { replace: true });
  };

  return (
    <div
      className="hg-auth"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--surface)' }}
      aria-modal="true"
      role="dialog"
      aria-label={copy.pinUnlockTitle}
    >
      <LockScreen
        title={copy.pinUnlockTitle}
        value={value}
        onChange={(v) => {
          setValue(v);
          if (v.length > 0) setError(undefined);
        }}
        onComplete={(p) => void verify(p)}
        error={error}
        notice={notice}
        touchId={
          touchId ? { label: copy.touchIdUnlock, onClick: () => void tryTouchId() } : undefined
        }
        footer={
          <button type="button" className="hg-btn hg-btn--link" onClick={() => void forgot()}>
            {copy.forgotPin}
          </button>
        }
      />
    </div>
  );
}
