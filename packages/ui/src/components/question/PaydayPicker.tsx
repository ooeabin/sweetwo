import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '../cx';
import type { PayDay } from '../PickSheet';

// 월급날 고르기(O-32, P-05b, S-11c, W-01 월급 금액 시트, 2026-11-25 사용자 결정 A안 ‘자주 쓰는 날 칩 + 직접 입력’).
// 칩 10·15·20·21·25일 + 말일, 아래 ‘다른 날 직접 적기’ 숫자 칸(1~31, 뒤에 ‘일’). 칩과 직접 적기는 서로 하나만 골라짐.
// 값이 칩 날짜가 아니면(예: 31일) 직접 적기 칸에 숫자로 보임. 값이 없으면 initial(25일)을 바로 알려 줌.

export const PAYDAY_CHIPS: readonly PayDay[] = [10, 15, 20, 21, 25, 'last'];

export function PaydayPicker({
  label,
  value,
  onChange,
  lastLabel,
  customLabel,
  rangeError,
  hint,
  initial = 25,
  disabled = false,
}: {
  /** 묶음 이름(화면 읽기, 질문 문장) */
  label: string;
  value: PayDay | null;
  /** 직접 적은 숫자가 1~31 밖이거나 비면 null */
  onChange: (v: PayDay | null) => void;
  lastLabel: string;
  /** 직접 적기 칸 이름이자 자리표시(“다른 날 직접 적기”) */
  customLabel: string;
  /** 범위 밖 숫자 오류 문장(“1~31 사이로 적어 주세요”) */
  rangeError: string;
  /** 29~31일을 고르면 칸 아래 한 줄(“그날이 없는 달은 말일로 계산해요”) */
  hint?: ReactNode;
  initial?: PayDay;
  /** 끔(‘날짜가 정해져 있지 않아요’): 흐리게 + 누르기·키보드·화면 읽기에서 빠짐(inert) */
  disabled?: boolean;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // 직접 적기 글자: 처음 값이 칩 날짜가 아닌 숫자면 그 숫자
  const [text, setText] = useState(() =>
    typeof value === 'number' && !PAYDAY_CHIPS.includes(value) ? String(value) : '',
  );
  useEffect(() => {
    if (value === null && text === '') onChange(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 처음 한 번만
  useEffect(() => {
    if (box.current) box.current.inert = disabled;
  }, [disabled]);

  const custom = text !== '';
  const n = Number(text);
  // 꺼진 동안(‘날짜가 정해져 있지 않아요’)은 고른 표시·오류를 보이지 않음(모두 같은 꺼진 회색). 값은 그대로라 체크를 풀면 이전 선택이 돌아옴(2026-11-25)
  const bad = !disabled && custom && !(Number.isInteger(n) && n >= 1 && n <= 31);
  const at = custom || disabled ? -1 : PAYDAY_CHIPS.indexOf(value as PayDay);

  const pick = (i: number) => {
    const d = PAYDAY_CHIPS[i];
    if (d === undefined) return;
    setText('');
    onChange(d);
    refs.current[i]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? Math.min(i + 1, PAYDAY_CHIPS.length - 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? Math.max(i - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? PAYDAY_CHIPS.length - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    pick(to);
  };

  const shown = !disabled && !bad && typeof value === 'number' && value >= 29;
  return (
    <div
      ref={box}
      className={cx('hg-payday', disabled && 'is-disabled')}
      aria-disabled={disabled || undefined}
    >
      <div className="hg-payday__chips" role="radiogroup" aria-label={label}>
        {PAYDAY_CHIPS.map((d, i) => (
          <button
            key={d}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={i === at}
            tabIndex={i === at || (at === -1 && i === 0) ? 0 : -1}
            className={cx('hg-payday__chip', i === at && 'is-on')}
            onClick={() => pick(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {d === 'last' ? lastLabel : `${d}일`}
          </button>
        ))}
      </div>
      <label
        className={cx(
          'hg-payday__custom',
          custom && !bad && !disabled && 'is-on',
          bad && 'is-error',
        )}
      >
        <input
          className="hg-payday__input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          aria-label={customLabel}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-e` : undefined}
          placeholder={customLabel}
          value={text}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 2);
            setText(v);
            const num = Number(v);
            onChange(v !== '' && num >= 1 && num <= 31 ? num : null);
          }}
        />
        <span className="hg-payday__unit" aria-hidden="true">
          일
        </span>
      </label>
      {bad && (
        <p id={`${id}-e`} className="hg-help is-error" role="alert">
          {rangeError}
        </p>
      )}
      {shown && hint && <p className="hg-payday__hint">{hint}</p>}
    </div>
  );
}
