import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../cx';
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
}) {
  return (
    <input
      ref={inputRef}
      className={cx('hg-input', invalid && 'is-error')}
      style={{ width: len === 4 ? '6.5em' : '4.5em', textAlign: 'center' }}
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
          placeholder="YYYY"
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
      <div className="hg-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
        <Box
          inputRef={yRef}
          label="년"
          len={4}
          placeholder="YYYY"
          value={y}
          invalid={!!error}
          onPasteAll={pasteAll}
          onChange={(v) => {
            setY(v);
            emit(v, m, d);
          }}
          next={() => mRef.current?.focus()}
        />
        <span>년</span>
        <Box
          inputRef={mRef}
          label="월"
          len={2}
          placeholder="MM"
          value={m}
          invalid={!!error}
          onPasteAll={pasteAll}
          onChange={(v) => {
            setM(v);
            emit(y, v, d);
          }}
          next={() => dRef.current?.focus()}
        />
        <span>월</span>
        <Box
          inputRef={dRef}
          label="일"
          len={2}
          placeholder="DD"
          value={d}
          invalid={!!error}
          onPasteAll={pasteAll}
          onChange={(v) => {
            setD(v);
            emit(y, m, v);
          }}
        />
        <span>일</span>
      </div>
      {error && (
        <span className="hg-help is-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** 연·월(예정 연·월, 여행 가는 달, 신혼집 시기). 연도 칸 + 월 12칸 */
export function YearMonthInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string | null; // 'YYYY-MM'
  onChange: (v: string | null) => void;
  error?: string;
}) {
  const [y, setY] = useState(value?.slice(0, 4) ?? '');
  const month = value ? Number(value.slice(5, 7)) : null;
  const yRef = useRef<HTMLInputElement>(null);
  useEffect(() => yRef.current?.focus(), []);
  return (
    <div className="hg-field" role="group" aria-label={label}>
      <div className="hg-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
        <Box
          inputRef={yRef}
          label="년"
          len={4}
          placeholder="YYYY"
          value={y}
          invalid={!!error}
          onChange={(v) => {
            setY(v);
            onChange(v.length === 4 && month ? `${v}-${pad(month)}` : null);
          }}
        />
        <span>년</span>
      </div>
      <MonthChips
        value={month}
        onChange={(mm) => onChange(y.length === 4 ? `${y}-${pad(mm)}` : null)}
        label="월"
        disabled={y.length !== 4}
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

/** 날짜 칩 1~31 + ‘말일’(월급날 O-32). 말일이면 onChange('last') */
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
  return (
    <div className="hg-quick" role="radiogroup" aria-label={label}>
      {days.map((d) => (
        <Chip
          key={d}
          small
          role="radio"
          aria-pressed={undefined} // radio는 aria-checked만
          aria-checked={d === value}
          selected={d === value}
          onClick={() => onChange(d)}
        >
          {d === 'last' ? lastLabel : `${d}일`}
        </Chip>
      ))}
    </div>
  );
}
