import { formatManWon, monthSummary, type MonthSummaryInput } from '@sweetwo/core';
import type { ReactNode } from 'react';

// 월 정산 요약(docs/design/components/MonthSummary.md). 계산은 core의 monthSummary 하나로.
export interface MonthSummaryProps extends MonthSummaryInput {
  monthLabel: string; // "10월 정산"
  allowanceNote?: string; // "각 30만"
  bigExpenseNote?: string; // "자동차보험"
  savedNote?: ReactNode; // "저축: 주택청약 20만, …"
  changes?: { name: string; diff: number }[]; // 지난달보다, 최대 4개
  fix?: { text: string; onApply: () => void; onKeep: () => void };
  note?: string; // 미합류 등 예외 문구
}

const man = (n: number) => formatManWon(n).replace('만', '');
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatManWon(Math.abs(n))}`;

export function MonthSummary(p: MonthSummaryProps) {
  const r = monthSummary(p);
  const noIncome = r.usedPct === null;
  return (
    <section className="hg-sum" aria-label={p.monthLabel}>
      <div className="hg-sum__head">
        <span className="hg-sum__month">{p.monthLabel}</span>
        <h2 className="hg-sum__title">
          {noIncome ? (
            <>
              이번 달 <b>{man(r.spent)}만 원</b>을 썼어요
            </>
          ) : (
            <>
              소득의 <b>{r.usedPct}%</b>를 썼어요
            </>
          )}
        </h2>
      </div>
      {!noIncome && r.left !== null && (
        <div
          className="hg-sum__bar"
          role="img"
          aria-label={`소득 ${man(p.income)}만 원 중 쓴 돈 ${man(r.spent)}만 원, 저축 ${man(r.saved)}만 원, 남은 돈 ${man(r.left)}만 원`}
        >
          <span className="is-spent" style={{ flex: r.spent }} />
          <span className="is-saved" style={{ flex: r.saved }} />
          <span className="is-left" style={{ flex: Math.max(r.left, 0) }} />
        </div>
      )}
      <div className="hg-sum__kpis">
        <Kpi label="소득" value={noIncome ? null : p.income} />
        <Kpi label="쓴 돈" dot="var(--ink)" value={r.spent} />
        <Kpi label="저축" dot="var(--chart-goal)" value={r.saved} />
        <Kpi label="남은 돈" dot="var(--hairline)" value={r.left} />
      </div>
      <div className="hg-sum__rows" aria-label="쓴 돈 나눠 보기">
        <Row name="고정지출" value={p.fixed} />
        <Row name="변동 지출" value={p.variable} />
        <Row name="용돈" value={p.allowance} note={p.allowanceNote} />
        {p.bigExpense > 0 && <Row name="큰 지출" value={p.bigExpense} note={p.bigExpenseNote} />}
        {p.savedNote && <Row sub name={p.savedNote} value={p.saved} />}
      </div>
      {p.changes && p.changes.length > 0 && (
        <div className="hg-stack" style={{ gap: 8 }}>
          <span className="hg-sum__month">지난달보다</span>
          <div className="hg-sum__changes">
            {p.changes.slice(0, 4).map((c) => (
              <span key={c.name} className="hg-sum__chg">
                {c.name}
                <b>{signed(c.diff)}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      {p.fix && (
        <div className="hg-sum__fix">
          <p>{p.fix.text}</p>
          <button type="button" className="hg-btn hg-btn--link" onClick={p.fix.onKeep}>
            그대로 두기
          </button>
          <button
            type="button"
            className="hg-btn hg-btn--secondary hg-btn--sm"
            onClick={p.fix.onApply}
          >
            맞추기
          </button>
        </div>
      )}
      {p.note && <p className="hg-sum__note">{p.note}</p>}
    </section>
  );
}

function Kpi({ label, value, dot }: { label: string; value: number | null; dot?: string }) {
  return (
    <div className="hg-sum__kpi">
      <span>
        {dot && <i style={{ background: dot }} />}
        {label}
      </span>
      <b>
        {value === null ? (
          '—'
        ) : (
          <>
            {man(value)}
            <span className="hg-unit">만 원</span>
          </>
        )}
      </b>
    </div>
  );
}

function Row({
  name,
  value,
  note,
  sub,
}: {
  name: ReactNode;
  value: number;
  note?: string;
  sub?: boolean;
}) {
  return (
    <div className={sub ? 'hg-sum__row is-sub' : 'hg-sum__row'}>
      <span>{name}</span>
      <b>
        {man(value)}
        <span className="hg-unit">만 원</span>
      </b>
      <em>{note ?? ''}</em>
    </div>
  );
}
