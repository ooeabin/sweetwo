import { isWeakPin, pinRemainingNotice } from '@sweetwo/core';
import { AuthLayout, Button, LockScreen, Modal } from '@sweetwo/ui';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { copy } from '../copy';
import { paths } from '../flow';
import { prefs } from '../prefs';
import { session } from '../session';
import { signOut } from '../sign-out';

// Face ID는 얼굴 스캔, Touch ID와 지문은 지문 아이콘
const bioIcon = (kind: 'touch' | 'face' | 'fingerprint') =>
  kind === 'face' ? ('scan-smiley' as const) : ('fingerprint' as const);

const Center = ({ children }: { children: ReactNode }) => (
  <main className="hg-auth">{children}</main>
);

// A-06 앱 잠금 설정(모바일 앱). 2026-11-13 v2.2(ADR 0009 결정 12, R1): 권장하되 건너뛸 수 있음.
// 먼저 “앱 잠금을 켤까요?” + ‘켜기’ / ‘나중에 할게요’(분석 app_lock_answered) → ‘켜기’면 PIN 정하기(1~3번).
// 신규 가입은 온보딩 O-60 흐름(첫 저금, 초대) 뒤·합류 P-10/P-11 뒤, 재로그인·새 기기는 로그인 직후 한 번.
// S-15에서 켜려고 열면(?next=/settings/security) 묻지 않고 바로 PIN 정하기
export function A06LockSetup() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const bridge = session.bridge;
  const [step, setStep] = useState<'ask' | 'enter' | 'confirm' | 'touch'>(next ? 'enter' : 'ask');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [bioKind, setBioKind] = useState<'touch' | 'face' | 'fingerprint'>('touch');

  const finish = () => {
    prefs.setPinAsked(true);
    if (next?.startsWith('/')) return nav(next, { replace: true });
    // 로그인 전에 열려던 화면(초대 링크 P-01, 만료 전 화면)이 있으면 그리로
    const back = prefs.returnTo();
    prefs.setReturnTo(null);
    nav(back ?? paths.home, { replace: true });
  };
  if (!bridge) return null;

  if (step === 'ask') {
    return (
      <AuthLayout
        art="status-lock"
        title={copy.lockAsk}
        help={copy.lockAskHelp}
        actionsRow
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                track('app_lock_answered', { result: 'later' });
                finish();
              }}
            >
              {copy.later}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                track('app_lock_answered', { result: 'on' });
                setStep('enter');
              }}
            >
              {copy.lockOn}
            </Button>
          </>
        }
      />
    );
  }

  if (step === 'touch') {
    return (
      <AuthLayout
        art={bioKind === 'face' ? 'status-faceid' : 'status-fingerprint'}
        title={copy.touchIdAsk(bioKind)}
        help={copy.touchIdHelp(bioKind)}
        actionsRow
        actions={
          <>
            <Button variant="secondary" onClick={finish}>
              {copy.later}
            </Button>
            <Button
              variant="primary"
              onClick={() => void bridge.lock.setTouchId(true).then(finish)}
            >
              {copy.touchIdYes(bioKind)}
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
    // 저장 실패(Keychain·Keystore 오류): 생체 질문으로 넘어가지 않고 안내 + 처음부터(2026-11-10 S1-04)
    const saved = await bridge.lock.setPin(pin).catch(() => false);
    if (!saved) {
      setError(copy.pinSaveFailed);
      setFirst('');
      setValue('');
      setStep('enter');
      return;
    }
    const s = await bridge.lock.status();
    setBioKind(s.bioKind ?? 'touch');
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
          // ‘나중에 할게요’: 잠금 꺼진 채 시작. 홈 할 일에는 남기지 않음(15 A-06 3번), 나중에 S-15에서 켬
          <button type="button" className="hg-btn hg-btn--link hg-btn--quiet" onClick={finish}>
            {copy.later}
          </button>
        }
      />
    </Center>
  );
}

/**
 * A-06 해제. 잠겨 있으면 화면 전체를 덮고(금액, 이름 모두 가림), 뒤 화면은 그리지 않는 것처럼 숨김:
 * 보이지 않게(visibility), 화면 읽기·Tab이 닿지 않게(inert, aria-hidden). 잠금 상태를 읽는 동안에도 숨김(2026-11-10 S1-05).
 * Ctrl(⌘)+L로 잠금. ‘PIN을 잊었어요’는 확인 Modal 뒤 PIN 지우고 로그아웃 → A-02 안내 띠 → 로그인 뒤 PIN 새로 정하기.
 */
export function LockGate({ active, children }: { active: boolean; children: ReactNode }) {
  const nav = useNavigate();
  const bridge = session.bridge;
  // null = 아직 모름(앱에서 로그인 상태일 때 처음 읽는 중)
  const [locked, setLocked] = useState<boolean | null>(bridge && active ? null : false);
  const [touchId, setTouchId] = useState(false);
  const [bioKind, setBioKind] = useState<'touch' | 'face' | 'fingerprint'>('touch');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const behind = useRef<HTMLDivElement>(null);

  const tryTouchId = useCallback(async () => {
    if (!bridge) return;
    if (await bridge.lock.unlockWithTouchId()) setLocked(false);
  }, [bridge]);

  useEffect(() => {
    if (!bridge || !active) {
      setLocked(false);
      return;
    }
    let alive = true;
    void bridge.lock
      .status()
      .then((s) => {
        if (!alive) return;
        setLocked(s.locked);
        setTouchId(s.touchIdEnabled);
        setBioKind(s.bioKind ?? 'touch');
        if (s.locked && s.touchIdEnabled) void tryTouchId();
      })
      .catch(() => alive && setLocked(false));
    const off = bridge.lock.onLock(() => {
      setLocked(true);
      setValue('');
      setError(undefined);
      setNotice(undefined);
      setAsking(false);
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
      alive = false;
      off();
      window.removeEventListener('keydown', onKey);
    };
  }, [bridge, active, tryTouchId]);

  const hide = locked !== false;
  // 뒤 화면: Tab·화면 읽기가 닿지 않게(inert는 React 18 속성 목록에 없어 직접)
  useEffect(() => {
    const el = behind.current;
    if (!el) return;
    if (hide) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [hide]);

  const verify = async (pin: string) => {
    if (!bridge) return;
    let r: Awaited<ReturnType<typeof bridge.lock.verify>>;
    try {
      r = await bridge.lock.verify(pin);
    } catch (e) {
      // 확인이 막히면(IPC 오류 등) 멈춘 듯 보이지 않게 비우고 알린다
      if (import.meta.env.DEV) console.error('[A-06] verify', e);
      setValue('');
      setError(copy.pinWrong);
      return;
    }
    setValue('');
    if (r.ok) {
      setLocked(false);
      setError(undefined);
      setNotice(undefined);
      return;
    }
    if (r.signedOut) {
      // 5회 실패: 브리지가 로그아웃하고 PIN을 지웠다 → 이 기기 데이터 비우고 A-02, 로그인 뒤 PIN 새로 만들기
      await signOut({ forgetPin: true });
      setLocked(false);
      nav(paths.login, { replace: true, state: { notice: copy.pinLockedOut } });
      return;
    }
    setError(copy.pinWrong);
    const n = pinRemainingNotice(r.failed);
    setNotice(n === null ? undefined : copy.pinRemaining(n));
  };

  const forgot = async () => {
    setLeaving(true);
    track('pin_forgot_confirmed', {});
    await signOut({ forgetPin: true });
    setAsking(false);
    setLeaving(false);
    setLocked(false);
    nav(paths.login, { replace: true, state: { notice: copy.forgotPinNotice } });
  };

  return (
    <>
      <div
        ref={behind}
        style={{ display: 'contents', visibility: hide ? 'hidden' : undefined }}
        aria-hidden={hide || undefined}
      >
        {children}
      </div>
      {bridge && active && locked && (
        <div
          className="hg-auth"
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--surface)' }}
          aria-modal="true"
          role="dialog"
          aria-label={copy.pinUnlockTitle.replace(/\n/g, ' ')}
        >
          <LockScreen
            title={copy.pinUnlockTitle}
            value={value}
            onChange={(v) => {
              if (asking) return;
              setValue(v);
              if (v.length > 0) setError(undefined);
            }}
            onComplete={(p) => !asking && void verify(p)}
            error={error}
            notice={notice}
            touchId={
              touchId
                ? {
                    label: copy.touchIdUnlock(bioKind),
                    icon: bioIcon(bioKind),
                    onClick: () => void tryTouchId(),
                  }
                : undefined
            }
            assist={
              <button type="button" className="hg-btn hg-btn--link" onClick={() => setAsking(true)}>
                {copy.forgotPin}
              </button>
            }
          />
          {asking && (
            <Modal
              title={copy.forgotTitle}
              body={copy.forgotBody}
              confirmLabel={copy.forgotYes}
              cancelLabel={copy.forgotNo}
              tone="primary"
              busy={leaving}
              onConfirm={() => void forgot()}
              onCancel={() => !leaving && setAsking(false)}
            />
          )}
        </div>
      )}
    </>
  );
}
