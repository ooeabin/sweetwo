import { MAX_WON, readWon } from '@sweetwo/core';
import { useEffect, useId, useRef, useState } from 'react';
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

export function AmountInput({
  label,
  value,
  onChange,
  quick,
  bands,
  unsureLabel = '잘 모르겠어요',
  onBand,
  zeroLink,
  monthly,
  placeholder = '0',
  allowZero = false,
  embedded = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  quick?: readonly { label: string; value: number }[];
  /** ‘잘 모르겠어요’ 구간 칩. 고르면 onBand(중간값) */
  bands?: readonly AmountBand[];
  unsureLabel?: string;
  onBand?: (b: AmountBand) => void;
  /** ‘없어요’ 같은 0원 링크 */
  zeroLink?: { label: string; onClick: () => void };
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
  const [showBands, setShowBands] = useState(false);
  const [pasteError, setPasteError] = useState<string>();

  useEffect(() => {
    if (!narrow && !embedded) ref.current?.focus();
  }, [narrow, embedded]);

  const over = value !== null && value > MAX_WON;
  const zero = value === 0 && !allowZero;
  const error =
    pasteError ??
    (over ? '999억 원까지 넣을 수 있어요' : zero ? '0원보다 큰 금액을 넣어 주세요' : undefined);
  const set = (v: number | null) => {
    setPasteError(undefined);
    onChange(v);
  };
  // 키패드: 누른 숫자는 끝에 붙음. 빈 값에서 0, 00은 무시(맨 앞 0 지움)
  const append = (d: string) => {
    const n = Number(digitsOnly(`${value ?? ''}${d}`));
    if (value === null && n === 0) return;
    set(n);
  };

  return (
    <div className="hg-amountin">
      <label htmlFor={id} className="hg-sr">
        {label}
      </label>
      <div className="hg-amount" style={error ? { borderColor: 'var(--danger)' } : undefined}>
        <input
          ref={ref}
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
          onChange={(e) => {
            const d = digitsOnly(e.target.value);
            set(d === '' ? null : Number(d));
          }}
          onPaste={(e) => {
            e.preventDefault();
            const v = parseKoreanAmount(e.clipboardData.getData('text'));
            if (v === null) setPasteError('숫자만 붙여넣을 수 있어요');
            else set(v);
          }}
        />
        <span className="hg-amount__unit">원</span>
      </div>
      <span id={`${id}-read`} className={error ? 'hg-help is-error' : 'hg-help'} aria-live="polite">
        {error ?? (value ? readWon(value) : ' ')}
      </span>
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
              onClick={() => set(Math.min((value ?? 0) + q.value, MAX_WON))}
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
              const s = String(value ?? '').slice(0, -1);
              set(s === '' ? null : Number(s));
            }}
          >
            <Icon name="delete" size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
