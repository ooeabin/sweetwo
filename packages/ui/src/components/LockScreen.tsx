import { useCallback, useEffect, useId, type ReactNode } from 'react';
import { Icon } from './Icon';

// 앱 잠금 화면, PIN 정하기(docs/design/components/LockScreen.md). 숫자는 보여 주지 않는다.
// 키보드 숫자 입력 + 키패드. 값과 검사는 소비자가 맡는다(6자리가 차면 onComplete).
export function LockScreen({
  title,
  sub,
  value,
  onChange,
  onComplete,
  error,
  notice,
  touchId,
  footer,
}: {
  title: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
  onComplete: (pin: string) => void;
  error?: string;
  notice?: string;
  touchId?: { label: string; onClick: () => void };
  footer?: ReactNode;
}) {
  const errId = useId();
  const press = useCallback(
    (d: string) => {
      if (value.length >= 6) return;
      const next = value + d;
      onChange(next);
      if (next.length === 6) onComplete(next);
    },
    [value, onChange, onComplete],
  );
  const back = useCallback(() => onChange(value.slice(0, -1)), [value, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back]);

  return (
    <div
      className="hg-lock"
      role="group"
      aria-label={title}
      aria-describedby={error ? errId : undefined}
    >
      <div className="hg-lock__head">
        <h1 className="hg-lock__title">{title}</h1>
        {sub && <p className="hg-lock__sub">{sub}</p>}
      </div>
      <div className="hg-pin" aria-label={`${value.length}자리 입력함`} role="img">
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} className={i < value.length ? 'is-on' : undefined} />
        ))}
      </div>
      {error && (
        <p id={errId} className="hg-lock__error" role="alert">
          <Icon name="circle-alert" size={16} />
          {error}
        </p>
      )}
      {notice && <p className="hg-lock__sub">{notice}</p>}
      <div className="hg-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="hg-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className="hg-key" onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="hg-key hg-key--fn" aria-label="지우기" onClick={back}>
          <Icon name="delete" size={24} />
        </button>
      </div>
      {touchId && (
        <button type="button" className="hg-btn hg-btn--link" onClick={touchId.onClick}>
          <Icon name="fingerprint" size={20} />
          {touchId.label}
        </button>
      )}
      {footer}
    </div>
  );
}
