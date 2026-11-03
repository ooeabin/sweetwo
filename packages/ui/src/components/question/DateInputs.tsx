import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../cx';
import { DateWheel } from './DateWheel';
import { Chip } from '../Chip';

// Q4 날짜·월 선택(docs/spec/12-question-pattern.md Q4). 칸이 차면 다음 칸으로.
// 달력 팝업(디자인 DatePicker)은 아직 없음: 연·월·일 칸 직접 입력 + 붙여넣기 해석.

/** “2027-05-15”, “2027.5.15”, “20270515” → {y,m,d} */
export function parseDateText(t: string): { y: number; m: number; d: number } | null {
  const s = t.trim();
  const m1 = /^(\d{4})[-./\s]?(\d{1,2})[-./\s]?(\d{1,2})$/.exec(s);
  if (!m1) return null;
  return { y: Number(m1[1]), m: Number(m1[2]), d: Number(m1[3]) };
}
export const isRealDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const pad = (n: number) => String(n).padStart(2, '0');

function Box({
  value,
  onChange,
  len,
  placeholder,
  label,
  next,
  inputRef,
  invalid,
  onPasteAll,
  seg,
}: {
  value: string;
  onChange: (v: string) => void;
  len: number;
  placeholder: string;
  label: string;
  next?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  invalid?: boolean;
  onPasteAll?: (t: string) => boolean;
  /** 한 칸처럼 보이는 날짜 칸 안의 조각(테두리 없음) */
  seg?: boolean;
}) {
  return (
    <input
      ref={inputRef}
      className={seg ? 'hg-datefield__seg' : cx('hg-input', invalid && 'is-error')}
      style={seg ? { width: len === 4 ? '3.2em' : '1.8em' } : { width: len === 4 ? '6.5em' : '4.5em', textAlign: 'center' }}
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      maxLength={len}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, len);
        onChange(v);
        if (v.length === len) next?.();
      }}
      onPaste={(e) => {
        if (onPasteAll?.(e.clipboardData.getData('text'))) e.preventDefault();
      }}
    />
  );
}

/** 연도만(O-13, O-24). 4자리가 유효하면 onComplete(자동 다음) */
export function YearInput({
  label,
  value,
  onChange,
  error,
  onComplete,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  error?: string;
  onComplete?: (v: number) => void;
  suffix?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="hg-field">
      <div className="hg-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
        <Box
          inputRef={ref}
          label={label}
          len={4}
          placeholder="0000"
          value={text}
          invalid={!!error}
          onChange={(v) => {
            setText(v);
            const n = v.length === 4 ? Number(v) : null;
            onChange(n);
            if (n !== null) onComplete?.(n);
          }}
        />
        <span>년</span>
        {suffix && <span className="hg-help">{suffix}</span>}
      </div>
      {error && (
        <span id={`${id}-e`} className="hg-help is-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** 연·월·일(O-12) */
export function DateInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string | null; // 'YYYY-MM-DD'
  onChange: (v: string | null, parts: { y: string; m: string; d: string }) => void;
  error?: string;
}) {
  const [y, setY] = useState(value?.slice(0, 4) ?? '');
  const [m, setM] = useState(value ? String(Number(value.slice(5, 7))) : '');
  const [d, setD] = useState(value ? String(Number(value.slice(8, 10))) : '');
  const yRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const dRef = useRef<HTMLInputElement>(null);
  useEffect(() => yRef.current?.focus(), []);
  const emit = (ny: string, nm: string, nd: string) => {
    const ok = ny.length === 4 && nm && nd && isRealDate(Number(ny), Number(nm), Number(nd));
    onChange(ok ? `${ny}-${pad(Number(nm))}-${pad(Number(nd))}` : null, { y: ny, m: nm, d: nd });
  };
  const pasteAll = (t: string) => {
    const p = parseDateText(t);
    if (!p) return false;
    const [ny, nm, nd] = [String(p.y), String(p.m), String(p.d)];
    setY(ny);
    setM(nm);
    setD(nd);
    emit(ny, nm, nd);
    return true;
  };
  return (
    <div className="hg-field" role="group" aria-label={label}>
      {/* 한 칸(2026-11-02): 연, 월, 일 조각을 글자 칸 하나 안에. 칸 단위는 조각 뒤 작은 글자 */}
      <div className={cx('hg-input hg-datefield', error && 'is-error')}>
        <Box
          inputRef={yRef}
          label="년"
          len={4}
          placeholder="0000"
          value={y}
          seg
          onPasteAll={pasteAll}
          onChange={(v) => {
            setY(v);
            emit(v, m, d);
          }}
          next={() => mRef.current?.focus()}
        />
        <span className="hg-datefield__unit">년</span>
        <Box
          inputRef={mRef}
          label="월"
          len={2}
          placeholder="00"
          value={m}
          seg
          onPasteAll={pasteAll}
          onChange={(v) => {
            setM(v);
            emit(y, v, d);
          }}
          next={() => dRef.current?.focus()}
        />
        <span className="hg-datefield__unit">월</span>
        <Box
          inputRef={dRef}
          label="일"
          len={2}
          placeholder="00"
          value={d}
          seg
          onPasteAll={pasteAll}
          onChange={(v) => {
            setD(v);
            emit(y, m, v);
          }}
        />
        <span className="hg-datefield__unit">일</span>
      </div>
      {error && (
        <span className="hg-help is-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** 연·월(예정 연·월, 여행 가는 달, 기한). 연·월 2열 휠(2026-11-02, 카카오페이 월 고르기처럼).
 * 값이 없으면 다음 달에서 시작하고 그 값을 바로 알려 줌. 범위 밖은 소비자가 error로 알림 */
export function YearMonthInput({
  label,
  value,
  onChange,
  error,
  minYear,
  maxYear,
}: {
  label: string;
  value: string | null; // 'YYYY-MM'
  onChange: (v: string | null) => void;
  error?: string;
  minYear?: number;
  maxYear?: number;
}) {
  const now = new Date();
  const y0 = now.getFullYear();
  const nextM = now.getMonth() + 2; // 다음 달(1~13)
  const start = nextM > 12 ? { y: y0 + 1, m: 1, d: 1 } : { y: y0, m: nextM, d: 1 };
  const v = value ? { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)), d: 1 } : null;
  return (
    <div className="hg-field">
      <DateWheel
        label={label}
        value={v}
        initial={start}
        minYear={minYear ?? y0 - 50}
        maxYear={maxYear ?? y0 + 40}
        yearMonth
        onChange={(n) => onChange(`${n.y}-${pad(n.m)}`)}
      />
      {error && (
        <span className="hg-help is-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** 월 칩 12개(자동차 유지비 ‘주로 몇 월에 나가요?’) */
export function MonthChips({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number | null;
  onChange: (m: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="hg-quick" role="radiogroup" aria-label={label}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
        <Chip
          key={mm}
          small
          role="radio"
          aria-pressed={undefined} // radio는 aria-checked만
          aria-checked={mm === value}
          selected={mm === value}
          disabled={disabled}
          onClick={() => onChange(mm)}
        >
          {mm}월
        </Chip>
      ))}
    </div>
  );
}

/** 월급날(O-32, P-05d, F-05): 회색 판 위 1~31 7칸 숫자 판, 31 옆 두 칸에 ‘말일’. 하나만 고름(radiogroup).
 * 화살표 ←→ 하루, ↑↓ 일주일, Home/End 처음/끝(말일). 고른 칸만 탭 순서에 들어감 */
export function DayChips({
  value,
  onChange,
  label,
  lastLabel = '말일',
}: {
  value: number | 'last' | null;
  onChange: (d: number | 'last') => void;
  label: string;
  lastLabel?: string;
}) {
  const days: (number | 'last')[] = [...Array.from({ length: 31 }, (_, i) => i + 1), 'last'];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = value === null ? -1 : days.indexOf(value);
  const move = (from: number, step: number) => {
    const to = Math.min(Math.max(from + step, 0), days.length - 1);
    const d = days[to];
    if (d === undefined) return;
    onChange(d);
    refs.current[to]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step =
      e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowLeft'
          ? -1
          : e.key === 'ArrowDown'
            ? i === 31
              ? 0
              : Math.min(7, 31 - i)
            : e.key === 'ArrowUp'
              ? i === 31
                ? -4
                : -7
              : e.key === 'Home'
                ? -i
                : e.key === 'End'
                  ? days.length - 1 - i
                  : null;
    if (step === null) return;
    e.preventDefault();
    move(i, step);
  };
  const cell = (d: number | 'last', i: number) => (
    <button
      key={d}
      ref={(el) => {
        refs.current[i] = el;
      }}
      type="button"
      role="radio"
      aria-checked={d === value}
      aria-label={d === 'last' ? lastLabel : `${d}일`}
      tabIndex={d === value || (at === -1 && i === 0) ? 0 : -1}
      className={cx(d === 'last' ? 'hg-daygrid__last' : 'hg-daygrid__day', d === value && 'is-on')}
      onClick={() => onChange(d)}
      onKeyDown={(e) => onKey(e, i)}
    >
      {d === 'last' ? lastLabel : d}
    </button>
  );
  return (
    <div className="hg-daygrid" role="radiogroup" aria-label={label}>
      <div className="hg-daygrid__days">{days.map((d, i) => cell(d, i))}</div>
    </div>
  );
}
