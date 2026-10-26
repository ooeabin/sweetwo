import { formatManWon, formatYm } from '@sweetwo/core';
import { Badge, Meter } from '@sweetwo/ui';
import { money } from '../../shared/mask';
import { copy } from './copy';
import { GoalArt } from './goal-art';
import type { GoalItem } from './model';

/** Meter 아래 “2,700만 / 1억 5,000만 원”의 금액(0원은 “0”) */
export const heldMan = (v: number, masked: boolean) => money(v, masked).replace(/\s?원$/, '');

const tone = (t: string) => (t === 'emergency' ? 'safety' : t === 'invest' ? 'invest' : 'goal');

/** 늦은 기간 “n년 m개월” */
export const lateText = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return copy.months(m);
  return m ? `${copy.years(y)} ${copy.months(m)}` : copy.years(y);
};

/** 매달·예상 줄(G-01 4·5번) */
export function planText(i: GoalItem, m: (v: number) => string) {
  const g = i.goal;
  if (g.kind === 'monthly') return copy.monthlyHeld(m(i.saved));
  if (g.target_amount === null) return copy.setAmount;
  if (g.kind === 'yearly') return i.nextUse ? copy.yearlyUse(formatYm(i.nextUse)) : '';
  if (i.state === 'paused') return copy.paused;
  return i.monthly > 0 && i.expected
    ? copy.planNew(m(i.monthly), formatYm(i.expected))
    : copy.planUnknown;
}

/** 이번 달 줄(G-01 6번, 홈 H-02와 같음) */
export function thisMonthText(i: GoalItem, m: (v: number) => string) {
  const ls = i.thisMonth;
  if (!ls.length) return null;
  const amount = ls.reduce((t, l) => t + (l.actual ?? l.planned), 0);
  if (ls.every((l) => l.state === 'checked')) return copy.thisMonthDone(m(amount));
  if (ls.every((l) => l.state === 'skipped')) return copy.thisMonthSkipped;
  return copy.thisMonthTodo(
    m(ls.filter((l) => l.state === 'wait').reduce((t, l) => t + l.planned, 0)),
  );
}

/** G-01 목표 카드: 그림 + Meter(모은 돈 / 목표 금액) + 매달·예상 + 기한보다 늦어요 + 이번 달. 누르면 G-02 */
export function GoalItemCard({
  i,
  masked,
  onOpen,
  onLate,
  changed,
}: {
  i: GoalItem;
  masked: boolean;
  onOpen: () => void;
  /** 4a ‘분배표에서 저금 늘리기’ → W-01(카드 아래 글자 링크) */
  onLate?: () => void;
  /** 배우자가 방금 고친 것(카드 아래 회색 “예빈님이 기한을 바꿨어요”) */
  changed?: string;
}) {
  const g = i.goal;
  const late = i.lateMonths !== null && i.lateMonths > 0;
  const month = thisMonthText(i, (v) => (masked ? '•••' : `${formatManWon(v)} 원`));
  const card = (
    <button
      type="button"
      className="hg-card hg-card--art hg-card--raised hg-stack"
      onClick={onOpen}
    >
      <span className="hg-card__top">
        <span className="hg-row" style={{ gap: 'var(--space-1)' }}>
          {late && <Badge kind="warn">{copy.status.delayed}</Badge>}
          {g.kind === 'yearly' && <Badge kind="goal">{copy.yearly}</Badge>}
          {g.kind === 'monthly' && <Badge kind="goal">{copy.monthly}</Badge>}
        </span>
      </span>
      <GoalArt g={i} />
      <Meter
        name={g.name}
        sub={
          g.target_amount
            ? copy.heldOf(heldMan(i.saved, masked), heldMan(g.target_amount, masked))
            : undefined
        }
        pct={g.kind === 'monthly' ? 0 : i.pct}
        tone={tone(g.template)}
      />
      <span className="hg-card__meta">
        {planText(i, (v) => (masked ? '•••' : `${formatManWon(v)} 원`))}
      </span>
      {late && i.lateMonths !== null && (
        <span className="hg-card__meta">{copy.lateLine(lateText(i.lateMonths))}</span>
      )}
      {month && <span className="hg-card__meta">{month}</span>}
    </button>
  );
  const lateLink = late && onLate;
  if (!lateLink && !changed) return card;
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-1)' }}>
      {card}
      {changed && <span className="hg-help">{changed}</span>}
      {lateLink && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={onLate}
        >
          {copy.lateLink}
        </button>
      )}
    </div>
  );
}
