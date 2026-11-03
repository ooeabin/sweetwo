import { fetchGoalMoves, qk } from '@sweetwo/api';
import { formatYm } from '@sweetwo/core';
import { Badge, Meter } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
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
  // 달성: “400만 원 모았어요”(접힌 목록 3번, 2026-11-03. ‘이 돈을 썼나요?’는 카드 아래 링크)
  if (i.state === 'achieved') return copy.savedAll(m(i.saved));
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

/** 사용 완료 카드 줄: “380만 원 썼어요”(꺼내 쓰기 기록 합, 접힌 목록 4번) */
function UsedLine({ goalId, masked }: { goalId: string; masked: boolean }) {
  const moves = useQuery({ queryKey: qk.goalMoves(goalId), queryFn: () => fetchGoalMoves(goalId) });
  if (!moves.data) return null;
  const spent = moves.data.filter((x) => x.kind === 'use').reduce((t, x) => t + x.amount, 0);
  return <span className="hg-card__meta">{copy.spentAll(money(spent, masked))}</span>;
}

/** G-01 목표 카드: 그림 + Meter(모은 돈 / 목표 금액) + 매달·예상 + 기한보다 늦어요 + 이번 달. 누르면 G-02 */
export function GoalItemCard({
  i,
  masked,
  onOpen,
  onLate,
  onUse,
  changed,
}: {
  i: GoalItem;
  masked: boolean;
  onOpen: () => void;
  /** 4a ‘월급 계획에서 저금 늘리기’ → W-01(카드 아래 글자 링크) */
  onLate?: () => void;
  /** 달성 카드 ‘이 돈을 썼나요?’ → G-05 사용(카드 아래 글자 링크) */
  onUse?: () => void;
  /** 배우자가 방금 고친 것(카드 아래 회색 “예빈님이 기한을 바꿨어요”) */
  changed?: string;
}) {
  const g = i.goal;
  // 아직 모은 돈이 없으면 지연으로 보지 않음(배지, 늦어요 줄 모두, 2026-11-03)
  const late = i.lateMonths !== null && i.lateMonths > 0 && i.saved > 0;
  // 금액은 readWon(0원은 “0원”, 2026-11-03 “0만 원”이던 것)
  const fmt = (v: number) => money(v, masked);
  const month = thisMonthText(i, fmt);
  // 매달 목표·금액 미정 목표는 진행률과 칸 없이(22 G-01 5번, 2026-11-03)
  const bare = g.kind === 'monthly' || g.target_amount === null;
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
        pct={bare ? 0 : i.pct}
        bare={bare}
        tone={tone(g.template)}
        empty={bare || i.saved > 0 ? undefined : copy.noSavedYet}
        started={!bare && i.saved > 0}
      />
      {i.state === 'used' ? (
        <UsedLine goalId={g.id} masked={masked} />
      ) : (
        <span className="hg-card__meta">{planText(i, fmt)}</span>
      )}
      {late && i.lateMonths !== null && (
        <span className="hg-card__meta">{copy.lateLine(lateText(i.lateMonths))}</span>
      )}
      {month && <span className="hg-card__meta">{month}</span>}
    </button>
  );
  const lateLink = late && onLate;
  const useLink = i.state === 'achieved' && onUse;
  if (!lateLink && !changed && !useLink) return card;
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
      {useLink && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          style={{ alignSelf: 'flex-start' }}
          onClick={onUse}
        >
          {copy.usedQ}
        </button>
      )}
    </div>
  );
}
