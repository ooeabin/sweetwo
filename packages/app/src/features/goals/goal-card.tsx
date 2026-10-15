import { formatManWon, formatYm } from '@sweetwo/core';
import { Badge, Meter } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { copy } from './copy';
import { GoalArt } from './goal-art';
import type { GoalLine } from './view';

const tone = (t: string) => (t === 'emergency' ? 'safety' : t === 'invest' ? 'invest' : 'goal');

/** 상태 배지 + 표시(결혼 후 목표, 매년, 매달) */
export function GoalBadges({ g, proposing }: { g: GoalLine; proposing?: boolean }) {
  return (
    <span className="hg-row" style={{ gap: 'var(--space-1)' }}>
      {proposing && <Badge kind="warn">{copy.proposing}</Badge>}
      {g.status && (
        <Badge
          kind={g.status === 'achieved' ? 'achieved' : g.status === 'delayed' ? 'warn' : 'temp'}
        >
          {copy.status[g.status]}
        </Badge>
      )}
      {g.afterMarriage && <Badge kind="temp">{copy.afterMarriage}</Badge>}
      {g.kind === 'yearly' && <Badge kind="goal">{copy.yearly}</Badge>}
      {g.kind === 'monthly' && <Badge kind="goal">{copy.monthly}</Badge>}
    </span>
  );
}

/** 월 배분·예상(G-01 4·5번) */
export function planLine(g: GoalLine, m: (v: number) => string): string {
  if (g.kind === 'monthly') return copy.monthlyHeld(m(g.held));
  if (g.target === null) return copy.noAmount;
  if (g.kind === 'yearly') return g.nextUse ? copy.yearlyUse(formatYm(g.nextUse)) : '';
  if (g.status === 'achieved' || g.status === 'used' || g.status === 'paused') return '';
  return g.alloc > 0 && g.expected ? copy.plan(m(g.alloc), formatYm(g.expected)) : copy.planUnknown;
}

export function chipText(g: GoalLine) {
  if (!g.chip) return undefined;
  return g.chip.kind === 'ahead' ? copy.ahead(g.chip.pct) : copy.late(g.chip.months);
}

export function GoalMeter({ g, masked }: { g: GoalLine; masked: boolean }) {
  const sub = g.target
    ? copy.heldOf(masked ? '•••' : formatManWon(g.held), masked ? '•••' : formatManWon(g.target))
    : undefined;
  return (
    <Meter
      name={g.name}
      sub={sub}
      pct={g.kind === 'monthly' ? 0 : g.pct}
      tone={tone(g.template)}
      pace={g.pace ?? undefined}
      paceLabel={copy.now}
      chip={chipText(g)}
    />
  );
}

/** 사람 원(담당). 같이 = 둘 */
export function Owners({ g, names }: { g: GoalLine; names: Record<1 | 2, string> }) {
  return (
    <span
      className="hg-avatars"
      role="img"
      aria-label={copy.owner(g.owners.map((n) => names[n]).join(', '))}
    >
      {g.owners.map((n) => (
        <span key={n} className={`hg-avatar hg-avatar--sm hg-avatar--p${n}`} aria-hidden="true">
          {[...names[n]][0] ?? ''}
        </span>
      ))}
    </span>
  );
}

/** G-01 목표 카드: 상단 줄 배지 + 그림 + Meter + 보조 줄(담당, 월 배분·예상). 누르면 G-02 */
export function GoalCard({
  g,
  names,
  masked,
  m,
  onOpen,
  proposing,
}: {
  g: GoalLine;
  proposing?: boolean;
  names: Record<1 | 2, string>;
  masked: boolean;
  m: (v: number) => string;
  onOpen: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      className="hg-card hg-card--art hg-card--raised hg-stack"
      onClick={onOpen}
    >
      <span className="hg-card__top">
        <GoalBadges g={g} proposing={proposing} />
      </span>
      <GoalArt g={g} />
      <GoalMeter g={g} masked={masked} />
      <span className="hg-row hg-card__meta" style={{ gap: 'var(--space-2)' }}>
        <Owners g={g} names={names} />
        <span>{planLine(g, m)}</span>
      </span>
    </button>
  );
}
