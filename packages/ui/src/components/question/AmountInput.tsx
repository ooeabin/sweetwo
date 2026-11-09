import { MAX_WON, readWon } from '@sweetwo/core';
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Chip } from '../Chip';
import { Icon } from '../Icon';
import { useNarrow } from './useNarrow';

// Q3 금액 입력(docs/spec/12-question-pattern.md Q3, 디자인 AmountInput).
// 값은 정수 원(null = 빈 값). 좁은 창은 앱 숫자 키패드.
export interface AmountBand {
  label: string;
  value: number;
}

const digitsOnly = (s: string) => s.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

/** 붙여넣기 “320만”, “1억 2천만” 단위 환산. 해석 못 하면 null */
export function parseKoreanAmount(text: string): number | null {
  const t = text.replace(/[\s,원]/g, '');
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)억)?(?:(\d+)천)?(?:(\d+)백)?(?:(\d+)만)?(\d+)?$/.exec(
    t.replace(/천만/, '천').replace(/백만/, '백'),
  );
  if (!m || !t) return null;
  const [, eok, cheon, baek, man, rest] = m;
  const v =
    Number(eok ?? 0) * 100_000_000 +
    Number(cheon ?? 0) * 10_000_000 +
    Number(baek ?? 0) * 1_000_000 +
    Number(man ?? 0) * 10_000 +
    Number(rest ?? 0);
  return v > 0 ? v : null;
}

/** 한 화면 두 번째 금액 칸(W-11c ‘이미 모은 금액’, 2026-11-09). 첫 칸과 같은 키패드를 씀 */
export interface SecondAmount {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowZero?: boolean;
  /** 칸 아래 오류(목표 금액보다 큼 등). 있으면 만 원 읽기 대신 */
  error?: string;
}

/** 금액 칸 하나(큰 숫자 + 원 + 아래 만 원 읽기). 붙여넣기 단위 환산 */
function AmountBox({
  id,
  label,
  showLabel,
  value,
  set,
  allowZero,
  narrow,
  placeholder,
  idle,
  error: outerError,
  inputRef,
  onFocus,
}: {
  id: string;
  label: string;
  /** 칸 위에 이름을 보임(두 번째 칸) */
  showLabel?: boolean;
  value: number | null;
  set: (v: number | null) => void;
  allowZero: boolean;
  narrow: boolean;
  placeholder: string;
  /** 키패드가 이 칸에 쓰지 않음(두 칸일 때 다른 칸이 활성): 밑줄을 옅게 */
  idle?: boolean;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onFocus?: () => void;
}) {
  const [pasteError, setPasteError] = useState<string>();
  // 칩·키패드로 값이 바뀌면 붙여넣기 오류는 지움
  useEffect(() => setPasteError(undefined), [value]);
  const over = value !== null && value > MAX_WON;
  const zero = value === 0 && !allowZero;
  const error =
    pasteError ??
    (over ? '999억 원까지 넣을 수 있어요' : zero ? '0원보다 큰 금액을 넣어 주세요' : outerError);
  const put = (v: number | null) => {
    setPasteError(undefined);
    set(v);
  };
  return (
    <>
      <label htmlFor={id} className={showLabel ? 'hg-field__label' : 'hg-sr'}>
        {label}
      </label>
      <div
        className={idle ? 'hg-amount is-idle' : 'hg-amount'}
        style={error ? { borderColor: 'var(--danger)' } : undefined}
      >
        <input
          ref={inputRef}
          id={id}
          className="hg-amount__value"
          style={{
            border: 0,
            outline: 0,
            background: 'transparent',
            width: '100%',
            minWidth: 0,
            color: 'var(--ink)',
            padding: 0,
          }}
          // 좁은 창은 앱 키패드를 쓰므로 OS 키보드만 숨긴다(물리 키보드 입력은 그대로)
          inputMode={narrow ? 'none' : 'numeric'}
          autoComplete="off"
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          aria-describedby={`${id}-read`}
          value={value === null ? '' : value.toLocaleString('ko-KR')}
          onFocus={onFocus}
          onChange={(e) => {
            const d = digitsOnly(e.target.value);
            put(d === '' ? null : Number(d));
          }}
          onPaste={(e) => {
            e.preventDefault();
            const v = parseKoreanAmount(e.clipboardData.getData('text'));
            if (v === null) setPasteError('숫자만 붙여넣을 수 있어요');
            else put(v);
          }}
        />
        <span className="hg-amount__unit">원</span>
      </div>
      <span
        id={`${id}-read`}
        className={error ? 'hg-help is-error' : 'hg-help'}
        aria-live="polite"
        role={outerError && error === outerError ? 'alert' : undefined}
      >
        {error ?? (value ? readWon(value) : ' ')}
      </span>
    </>
  );
}

export function AmountInput({
  label,
  value,
  onChange,
  quick,
  quickSet = false,
  bands,
  unsureLabel = '잘 모르겠어요',
  onBand,
  zeroLink,
  extra,
  second,
  monthly,
  placeholder = '0',
  allowZero = false,
  embedded = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  quick?: readonly { label: string; value: number }[];
  /** 빠른 칩이 더하기 대신 그 금액으로 바꾸기(W-11b ‘10만 원’, 2026-11-09). 지금 값과 같은 칩은 고른 표시 */
  quickSet?: boolean;
  /** ‘잘 모르겠어요’ 구간 칩. 고르면 onBand(중간값) */
  bands?: readonly AmountBand[];
  unsureLabel?: string;
  onBand?: (b: AmountBand) => void;
  /** ‘없어요’ 같은 0원 링크 */
  zeroLink?: { label: string; onClick: () => void };
  /** 빠른 금액·링크 바로 아래(키패드 위)에 둘 것(O-31 ‘매달 금액이 달라요’) */
  extra?: ReactNode;
  /**
   * 두 번째 금액 칸(W-11c ‘이미 모은 금액’, 2026-11-09 round 3): extra 아래, 키패드 위.
   * 키패드는 하나로 화면 아래에 두고 마지막으로 누른 칸에 씀. 칸이 생기면 그 칸이 활성
   */
  second?: SecondAmount;
  /** 월 금액이면 1~9,999원에 “{n}만 원인가요?” */
  monthly?: boolean;
  placeholder?: string;
  allowZero?: boolean;
  /** 한 화면에 입력이 여럿일 때(O-63 통장 잔액): 처음 포커스와 좁은 창 앱 키패드 없이 기기 숫자 자판 */
  embedded?: boolean;
}) {
  const id = useId();
  const narrow = useNarrow() && !embedded;
  const ref = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);
  const [showBands, setShowBands] = useState(false);
  // 키패드가 쓰는 칸: 0 = 첫 칸, 1 = 두 번째 칸
  const [active, setActive] = useState<0 | 1>(0);
  const hasSecond = !!second;

  useEffect(() => {
    if (!narrow && !embedded) ref.current?.focus();
  }, [narrow, embedded]);
  // 두 번째 칸이 생기면 그 칸으로, 없어지면 첫 칸으로
  const prevSecond = useRef(hasSecond);
  useEffect(() => {
    if (hasSecond && !prevSecond.current) {
      setActive(1);
      if (!narrow) secondRef.current?.focus();
    }
    if (!hasSecond) setActive(0);
    prevSecond.current = hasSecond;
  }, [hasSecond, narrow]);

  const set = (v: number | null) => onChange(v);
  const target =
    active === 1 && second ? { value: second.value, set: second.onChange } : { value, set };
  // 키패드: 누른 숫자는 끝에 붙음. 빈 값에서 0, 00은 무시(맨 앞 0 지움)
  const append = (d: string) => {
    const n = Number(digitsOnly(`${target.value ?? ''}${d}`));
    if (target.value === null && n === 0) return;
    target.set(n);
  };

  return (
    <div className="hg-amountin">
      <AmountBox
        id={id}
        label={label}
        value={value}
        set={set}
        allowZero={allowZero}
        narrow={narrow}
        placeholder={placeholder}
        idle={hasSecond && active !== 0}
        inputRef={ref}
        onFocus={() => setActive(0)}
      />
      {monthly && value !== null && value >= 1 && value <= 9_999 && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => set(value * 10_000)}
        >
          {value.toLocaleString('ko-KR')}만 원인가요?
        </button>
      )}
      {quick && (
        <div className="hg-quick">
          {quick.map((q) => (
            <Chip
              key={q.label}
              small
              selected={quickSet && value === q.value}
              onClick={() => set(quickSet ? q.value : Math.min((value ?? 0) + q.value, MAX_WON))}
            >
              {q.label}
            </Chip>
          ))}
        </div>
      )}
      {(bands || zeroLink) && (
        <div className="hg-stack" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          {bands && (
            <button
              type="button"
              className="hg-btn hg-btn--link"
              aria-expanded={showBands}
              onClick={() => setShowBands(!showBands)}
            >
              {unsureLabel}
            </button>
          )}
          {zeroLink && (
            <button type="button" className="hg-btn hg-btn--link" onClick={zeroLink.onClick}>
              {zeroLink.label}
            </button>
          )}
          {showBands && bands && (
            <div className="hg-quick" role="group" aria-label={unsureLabel}>
              {bands.map((b) => (
                <Chip key={b.label} small onClick={() => onBand?.(b)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
      {extra}
      {second && (
        <AmountBox
          id={`${id}-2`}
          label={second.label}
          showLabel
          value={second.value}
          set={second.onChange}
          allowZero={!!second.allowZero}
          narrow={narrow}
          placeholder={placeholder}
          idle={active !== 1}
          error={second.error}
          inputRef={secondRef}
          onFocus={() => setActive(1)}
        />
      )}
      {narrow && (
        <div className="hg-keypad" aria-label="숫자 키패드">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((k) => (
            <button key={k} type="button" className="hg-key" onClick={() => append(k)}>
              {k}
            </button>
          ))}
          <button
            type="button"
            className="hg-key hg-key--fn"
            aria-label="지우기"
            onClick={() => {
              const s = String(target.value ?? '').slice(0, -1);
              target.set(s === '' ? null : Number(s));
            }}
          >
            <Icon name="delete" size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
