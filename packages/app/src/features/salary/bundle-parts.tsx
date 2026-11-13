import { formatYm, MAX_WON, savingBar, savingRemain, type BundleViewResponse } from '@sweetwo/core';
import { Badge, Field, Icon, Lead, leadOf, SaveTogetherSlide } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { money } from '../../shared/mask';
import { copy } from './copy';

/**
 * 묶음 카드 보조 줄(SaveTogether.md 순서): 기한까지 남은 금액(퍼센트만이면 기한만) → 각자 금액(둘 다 켰을 때만) → 멈춤.
 * 다 모았으면 기한 줄 없음
 */
export function bundleLines(
  b: BundleViewResponse,
  o: { masked: boolean; myName: string; partnerName: string },
): string[] {
  const m = (v: number) => money(v, o.masked);
  const out: string[] = [];
  if (b.status !== 'achieved' && b.deadline) {
    if (b.percent_only) out.push(copy.remainUntilPct(formatYm(b.deadline)));
    else {
      const r = savingRemain({ target: b.target, saved: b.total ?? 0, deadline: b.deadline });
      if (r) out.push(copy.remainUntil(formatYm(r.deadline), m(r.remain)));
    }
  }
  if (b.show_each && !b.percent_only && b.mine !== null && b.partner !== null)
    out.push(copy.bundleEach(o.myName, m(b.mine), o.partnerName, m(b.partner)));
  if (b.paused) out.push(copy.bundlePaused);
  return out;
}

/** 묶음 진행 막대 채움(목표 금액이 없으면 null). 퍼센트만이면 서버 pct로 */
export const bundleBar = (b: BundleViewResponse): number | null =>
  b.pct === null ? null : b.total !== null ? savingBar(b.total, b.target) : b.pct;

/**
 * W-10 맨 위 묶음 카드(20 W-10 0번, SaveTogether.md ‘W-10 묶음 카드(머리 없이)’): ui SaveTogetherSlide(홈 H-10과 같은 칸) 하나.
 * 사람 + 묶음 이름 → 합계(퍼센트만이면 %) → 막대 → “목표 금액 5,000만 원의 62%” → 기한 → 각자 금액(둘 다 켰을 때) → 멈춤.
 * 누르면 W-15a(묶음에 든 사람만, onClick이 없으면 누를 곳 없음). 화면 읽기는 한 문장. W-10 다른 카드처럼 hg-goalbox 테두리
 */
export function BundleCard({
  bundle: b,
  masked,
  myName,
  partnerName,
  people,
  onClick,
}: {
  bundle: BundleViewResponse;
  masked: boolean;
  myName: string;
  partnerName: string;
  people?: ReactNode;
  onClick?: () => void;
}) {
  const m = (v: number) => money(v, masked);
  const lines = bundleLines(b, { masked, myName, partnerName });
  const bar = bundleBar(b);
  const done = b.status === 'achieved';
  const big = b.percent_only ? `${b.pct ?? 0}%` : m(b.total ?? 0);
  const ofTarget =
    !b.percent_only && b.target !== null && b.pct !== null && !done
      ? copy.bundleTotalOf(m(b.target), b.pct)
      : null;
  const all = [ofTarget, ...lines].filter((x): x is string => !!x);
  return (
    <section className="hg-goalbox hg-together" aria-label={copy.together}>
      <SaveTogetherSlide
        people={people}
        name={b.name}
        amount={big}
        bar={bar === null ? null : done ? 100 : bar}
        lines={all}
        done={done ? copy.bundleDone : undefined}
        paused={b.paused}
        percentOnly={b.percent_only}
        label={copy.bundleLabel(b.name, big, all.join(', '))}
        onClick={onClick ?? (() => undefined)}
      />
    </section>
  );
}

/** 목록 안 금액 칸(W-10c, W-20a): 정수 원, 999억 상한. 빈 칸 = null */
export function MoneyField({
  label,
  value,
  onChange,
  help,
  error,
  placeholder,
}: {
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  help?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
}) {
  return (
    <Field
      label={label}
      help={help}
      error={error}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      value={value === null ? '' : value.toLocaleString('ko-KR')}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '');
        onChange(d === '' ? null : Math.min(Number(d), MAX_WON));
      }}
    />
  );
}

/**
 * W-13 묶음 한 줄(20 W-13 고친 점, SaveTogether.md ‘W-13 묶음 줄(막대와 합계만)’): GoalRow와 같은 줄에 이름 + ‘같이 모으기’ 이름표
 * + 오른쪽 % + “합계 / 목표 금액”(퍼센트만이면 % 문장 없이) + 막대. 누르면 펼쳐 각자 줄(aria-expanded)
 */
export function BundleRow({
  bundle: b,
  masked,
  open,
  onToggle,
}: {
  bundle: BundleViewResponse;
  masked: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const m = (v: number) => money(v, masked);
  const bar = bundleBar(b);
  const sub = b.percent_only
    ? null
    : b.target !== null
      ? copy.itemProgress(m(b.total ?? 0), m(b.target))
      : copy.listSaved(m(b.total ?? 0));
  return (
    <button
      type="button"
      className="hg-goalrow"
      aria-expanded={open}
      aria-label={copy.bundleOpen(b.name)}
      onClick={onToggle}
    >
      <Lead {...leadOf('line', 'saving')} />
      <span className="hg-goalrow__name">
        {b.name}
        <Badge kind="temp">{copy.together}</Badge>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </span>
      <span className="hg-goalrow__pct">
        {b.status === 'achieved' ? (
          <Badge kind="achieved">{copy.achieved}</Badge>
        ) : b.pct !== null ? (
          <>
            {b.pct}
            <small>%</small>
          </>
        ) : null}
      </span>
      {sub && <span className="hg-goalrow__sub">{sub}</span>}
      {bar !== null && b.status !== 'achieved' && (
        <span className="hg-goalrow__bar" aria-hidden="true">
          <i style={{ width: `${bar}%` }} />
        </span>
      )}
    </button>
  );
}
