import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon';
import { Illustration, hasIllustration } from '../Illustration';

// Q1 단일 선택(docs/spec/12-question-pattern.md Q1, 디자인 Selection ‘hg-option--card’).
// 고르면 0.3초 뒤 onPick(그 사이 바꾸면 다시 셈). 1~9 키로 n번째 선택.
export interface Choice<T extends string> {
  value: T;
  label: string;
  sub?: string;
  /** 라벨 아래 미리보기(분담액 등). sub보다 진하게 */
  detail?: ReactNode;
  /** 라벨 옆 이름표(‘추정’) */
  tag?: string;
  /** 고를 수 없음(is-disabled) */
  disabled?: boolean;
  /** 선택지 그림 주제(2D 플랫 그림 파일 이름, Illustrations ‘선택지 그림’ 표). 문구 앞 36px. 파일이 없으면 자리도 없음(2026-11-15) */
  icon?: ChoiceArt;
}

/** 선택지 그림 주제 = 그림 파일 이름(`packages/ui/src/assets/illustrations/{이름}.webp`). 표는 docs/design/assets/Illustrations.md ‘선택지 그림’ */
export type ChoiceArt =
  | 'choice-married'
  | 'choice-engaged'
  | 'choice-dating'
  | 'choice-living-together'
  | 'choice-living-shared'
  | 'choice-living-own'
  | 'choice-saving-shared'
  | 'choice-saving-own'
  | 'choice-manager-me'
  | 'choice-manager-partner'
  | 'choice-manager-together'
  | 'choice-manager-each'
  | 'choice-style-ok'
  | 'choice-style-send'
  | 'choice-share-all'
  | 'choice-share-saving'
  | 'choice-share-done'
  | 'choice-vis-all'
  | 'choice-vis-sum'
  | 'choice-vis-private'
  | 'choice-export-mine'
  | 'choice-export-joint'
  | 'choice-export-csv'
  | 'choice-export-pdf';

export function ChoiceCards<T extends string>({
  label,
  options,
  value,
  onChange,
  onPick,
  autoAdvance = true,
  autoFocus = true,
  shortcuts = true,
}: {
  label: string;
  options: Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
  /** 고르고 0.3초 뒤(자동 다음) */
  onPick?: (v: T) => void;
  autoAdvance?: boolean;
  /** 처음에 첫 카드에 포커스(한 화면에 묶음이 여럿이면 하나만) */
  autoFocus?: boolean;
  /** 1~9 키로 고르기(한 화면에 묶음이 여럿이면 하나만) */
  shortcuts?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const first = useRef<HTMLButtonElement>(null);

  const pick = (v: T) => {
    if (options.find((o) => o.value === v)?.disabled) return;
    onChange(v);
    if (!autoAdvance || !onPick) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onPick(v), 300);
  };

  // 최신 pick을 키보드 처리에서 쓰도록
  const pickRef = useRef(pick);
  pickRef.current = pick;

  useEffect(() => {
    // 처음 포커스는 넓은 창(키보드)에서만. 좁은 창은 손가락이라 첫 카드에 포커스 테두리가 남아 고른 것처럼 보임(2026-11-03)
    // 2026-11-04: 넓은 창도 처음 포커스는 테두리 없이(들어오자마자 고른 것처럼 보여서). 키를 누르면 테두리가 나옴
    const el = first.current;
    if (autoFocus && el && window.matchMedia?.('(min-width: 768px)').matches) {
      el.dataset.autofocus = '';
      el.focus();
      const clear = () => {
        delete el.dataset.autofocus;
        el.removeEventListener('keydown', clear);
        el.removeEventListener('blur', clear);
      };
      el.addEventListener('keydown', clear);
      el.addEventListener('blur', clear);
    }
    return () => clearTimeout(timer.current); // 화면을 떠날 때만 자동 다음 취소
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 처음 한 번만

  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const n = Number(e.key);
      const o = Number.isInteger(n) && n >= 1 ? options[n - 1] : undefined;
      if (o) pickRef.current(o.value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, shortcuts]);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="hg-stack"
      style={{ gap: 'var(--space-3)' }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={i === 0 ? first : undefined}
            type="button"
            role="radio"
            aria-checked={on}
            className={cx(
              'hg-option',
              'hg-option--card',
              on && 'is-on',
              o.disabled && 'is-disabled',
            )}
            aria-disabled={o.disabled || undefined}
            onClick={() => pick(o.value)}
          >
            {/* 선택지 그림(o.icon): 파일이 있을 때만 문구 앞 36px. 없으면 자리도 비우지 않음(2026-11-15 3차 검토) */}
            {hasIllustration(o.icon) && (
              <span className="hg-option__icon" aria-hidden="true">
                <Illustration name={o.icon} />
              </span>
            )}
            <span className="hg-option__body">
              <span className="hg-option__label">
                {o.label}
                {o.tag && (
                  <span className="hg-tag" style={{ marginLeft: 'var(--space-2)' }}>
                    {o.tag}
                  </span>
                )}
              </span>
              {o.sub && <span className="hg-help">{o.sub}</span>}
              {o.detail}
            </span>
            {/* 오른쪽 끝 원: 안 고른 카드는 빈 원, 고르면 오렌지 체크 원(바로 넘어가는 카드도 같음, 2026-11-25 구역 6) */}
            <span className="hg-option__mark" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
