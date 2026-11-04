import { formatYm } from '@sweetwo/core';
import { Badge } from '@sweetwo/ui';
import { money } from '../../shared/mask';
import { copy } from './copy';
import { GoalArt } from './goal-art';
import type { GoalItem } from './model';

/** Meter 아래 “2,700만 / 1억 5,000만 원”의 금액(0원은 “0”) */
export const heldMan = (v: number, masked: boolean) => money(v, masked).replace(/\s?원$/, '');

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
  // 달성: “400만 원 모았어요”(접힌 목록 3번)
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
  /** 4a ‘월급 계획에서 저금 늘리기’ → W-01(카드 아래 글자 링크) */
  onLate?: () => void;
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
  // 2026-11-03 시안 B 타일: 위 사진(배지는 사진 위 왼쪽) → 이름 → 금액 → 막대(또는 “아직 모은 돈이 없어요”) → 한 줄.
  // 한 줄은 늦어요 > 이번 달 > 매달·예상 순서로 하나만(타일이 빽빽해서). 링크·배우자 변경 안내는 타일 안 아래 칸
  const line =
    late && i.lateMonths !== null
      ? copy.lateLine(lateText(i.lateMonths))
      : (month ?? (g.kind === 'monthly' ? null : planText(i, fmt)));
  const lateLink = late && onLate;
  return (
    <div className="hg-goaltile">
      <button type="button" className="hg-goaltile__main" onClick={onOpen}>
        <span className="hg-goaltile__top">
          <GoalArt g={i} tile />
          {(late || g.kind !== 'once' || i.state === 'achieved' || i.state === 'paused') && (
            <span className="hg-goaltile__badges">
              {/* 접힌 목록 상태 배지: 달성은 연한 파랑, 보류는 회색(2026-11-04 사용 완료 없앰) */}
              {i.state === 'achieved' && <Badge kind="achieved">{copy.status.achieved}</Badge>}
              {i.state === 'paused' && <Badge kind="temp">{copy.status.paused}</Badge>}
              {late && <Badge kind="warn">{copy.status.delayed}</Badge>}
              {g.kind === 'yearly' && <Badge kind="brand">{copy.yearly}</Badge>}
              {g.kind === 'monthly' && <Badge kind="brand">{copy.monthly}</Badge>}
            </span>
          )}
        </span>
        <span className="hg-goaltile__body">
          <b className="hg-goaltile__name">{g.name}</b>
          <span className="hg-goaltile__amount">
            {g.target_amount && !bare
              ? copy.heldOf(heldMan(i.saved, masked), heldMan(g.target_amount, masked))
              : g.kind === 'monthly'
                ? copy.monthlyHeld(fmt(i.saved))
                : fmt(i.saved)}
          </span>
          {!bare && i.saved <= 0 && <span className="hg-card__meta">{copy.noSavedYet}</span>}
          {!bare && i.saved > 0 && (
            <span className={'hg-goaltile__bar'} aria-hidden="true">
              <i style={{ width: `${Math.min(Math.max(i.pct, 2), 100)}%` }} />
            </span>
          )}
          {line && <span className="hg-card__meta hg-goaltile__line">{line}</span>}
        </span>
      </button>
      {(changed || lateLink) && (
        <span className="hg-goaltile__foot">
          {changed && <span className="hg-help">{changed}</span>}
          {lateLink && (
            <button type="button" className="hg-btn hg-btn--link" onClick={onLate}>
              {copy.lateLink}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
