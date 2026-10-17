import { propose, qk, saveFamilyBudget } from '@sweetwo/api';
import {
  formatDateFull,
  formatMonthDay,
  familyCostSummary,
  proposalApplyOn,
  readWon,
  rowsTotal,
  spaceBaseDay,
  type FamilyRowKey,
} from '@sweetwo/core';
import { Button, Field, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../month';
import { recalcPendingShares } from '../../proposals';
import { copy } from '../copy';
import { useCalendarData } from '../data';

// Y-06 이번 회차 양가 비용(docs/spec/24-calendar.md Y-06, 06 10장): 1 회차 기간, 2 쓴 돈 + 모아둔 돈이 다음 챙길 날까지 충분한지,
// 3 회차 남은 달마다 나갈 돈, 4 매달 모을 돈과 계산, 5 항목 4행(단가 × 횟수) + ‘수정’.
// 예비부부: 쓴 돈과 항목만(모아둔 돈·3·4번 없음). 열린 제안이 있으면 ‘수정’ 대신 G-08.
// 3번 ‘막대’는 맞는 DS 컴포넌트가 없어 달마다 한 줄 목록으로.
export function Y06FamilyCost() {
  const nav = useNavigate();
  const c = useCalendarData();
  const { masked } = useMask();
  const m = (x: number) => money(x, masked);
  if (c.loading) return <MainFrame current="calendar" columns={[null]} />;
  const f = c.familyCost;
  const s = f.summary;

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.fcTitle} backLabel={copy.back} onBack={() => nav(-1)} />
      <section className="hg-card hg-stack" aria-label={copy.fcTitle}>
        <span className="hg-card__label">
          {copy.fcRange(formatDateFull(f.round.start), formatDateFull(f.round.end))}
        </span>
        <b>
          {f.engaged
            ? copy.fcSpentEngaged(m(f.total), m(f.spent))
            : copy.fcSpent(m(f.total), m(f.spent))}
        </b>
        {!f.engaged && (
          <span className="hg-card__meta">
            {s.enough ? copy.fcEnough(m(f.held)) : copy.fcShort(m(s.extra))}
          </span>
        )}
      </section>
      {!f.engaged && (
        <>
          <section className="hg-stack" aria-label={copy.fcMonthly(m(s.monthly))}>
            <b>{copy.fcMonthly(m(s.monthly))}</b>
            <span className="hg-help">{copy.fcLeft(m(s.left), s.monthsLeft)}</span>
          </section>
          <section className="hg-stack" aria-label={copy.fcMonths}>
            <SectionHeader title={copy.fcMonths} />
            <div className="hg-list">
              {f.months.map((x) => (
                <ListRow
                  key={x.month}
                  label={copy.monthLabel(Number(x.month.slice(5, 7)))}
                  value={m(x.amount)}
                />
              ))}
            </div>
          </section>
        </>
      )}
      <section className="hg-stack" aria-label={copy.fcItems}>
        <div className="hg-row" style={{ justifyContent: 'space-between' }}>
          <SectionHeader title={copy.fcItems} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              nav(f.proposal ? `/proposals/${f.proposal.id}` : '/calendar/family-cost/edit')
            }
          >
            {f.proposal ? copy.fcSeeProposal : copy.edit}
          </Button>
        </div>
        {f.proposal && <span className="hg-help">{copy.fcOpen}</span>}
        <div className="hg-list">
          {f.rows.map((r) => (
            <ListRow
              key={r.key}
              label={copy.fcRows[r.key]}
              sub={copy.fcTimes(m(r.unit), r.count)}
              value={m(r.total)}
            />
          ))}
        </div>
      </section>
    </div>
  );
  return <MainFrame current="calendar" columns={[body]} />;
}

/** Y-06 6~9번: 단가 4행 수정, 바뀐 값, 합계 즉시 재계산, 제안(혼자면 저장) */
export function Y06Edit() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const c = useCalendarData();
  const [units, setUnits] = useState<Partial<Record<FamilyRowKey, number | null>>>({});
  const [busy, setBusy] = useState(false);
  if (c.loading) return <MainFrame current="calendar" columns={[null]} />;
  const f = c.familyCost;
  const sp = c.space;
  const couple = c.couple;
  // 두 사람이 있으면 제안(합류 중 포함), 아니면 바로 저장
  const proposing = !!couple?.joined;
  const differently = params.get('differently') === '1';
  const set = (k: FamilyRowKey, v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    setUnits((u) => ({ ...u, [k]: d ? Number(d) : null }));
  };
  const valueOf = (k: FamilyRowKey) => {
    const u = units[k];
    return u === undefined ? (f.rows.find((r) => r.key === k)?.unit ?? 0) : u;
  };
  const filled = Object.fromEntries(f.rows.map((r) => [r.key, valueOf(r.key) ?? 0])) as Record<
    FamilyRowKey,
    number
  >;
  const total = rowsTotal(f.rows, filled);
  const after = familyCostSummary({
    total,
    spent: f.spent,
    held: f.held,
    round: f.round,
    today: c.today,
    next: null,
  });
  const changed = f.rows.some((r) => filled[r.key] !== r.unit);
  const empty = f.rows.some((r) => valueOf(r.key) === null);
  const base = couple && sp ? spaceBaseDay(sp, couple) : null;
  const applyOn = base !== null ? proposalApplyOn(base) : null;
  // 열린 제안이 있으면 G-08 ‘다르게 해볼래요’로만(24 Y-06 예외)
  const blocked = !!f.proposal && !differently;

  const submit = async () => {
    if (busy || !changed || empty || blocked) return;
    setBusy(true);
    try {
      // 횟수가 있는 행만 단가를 보냄
      const payload: Record<string, number> = { target_amount: total };
      for (const r of f.rows) if (r.count > 0) payload[r.key] = filled[r.key];
      if (proposing) {
        if (!applyOn) throw new Error('no base day');
        await propose('family_budget', payload, applyOn);
        toast(copy.fcProposed(couple?.partnerName ?? ''));
      } else {
        await saveFamilyBudget(payload);
        await recalcPendingShares();
        toast(copy.fcSaved);
      }
      await Promise.all(
        [qk.careDays, qk.goals, qk.proposals].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      nav('/calendar/family-cost', { replace: true });
    } catch {
      toast(copy.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <form
      className="hg-stack"
      style={{ gap: 'var(--space-6)' }}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <PageHeader title={copy.fcEditTitle} backLabel={copy.back} onBack={() => nav(-1)} />
      {blocked && <p className="hg-help">{copy.fcOpen}</p>}
      <div className="hg-stack" style={{ gap: 'var(--space-4)' }}>
        {f.rows.map((r) => {
          const v = valueOf(r.key);
          return (
            <Field
              key={r.key}
              label={copy.fcRows[r.key]}
              inputMode="numeric"
              value={v ?? ''}
              disabled={blocked}
              onChange={(e) => set(r.key, e.target.value)}
              help={
                v !== null && v !== r.unit
                  ? copy.fcChanged(readWon(r.unit), readWon(v))
                  : `${readWon(v ?? 0)}, ${r.count}번`
              }
            />
          );
        })}
      </div>
      <section
        className="hg-card hg-stack"
        aria-live="polite"
        aria-label={copy.fcYear(readWon(total))}
      >
        <b>{copy.fcYear(readWon(total))}</b>
        {!f.engaged && (
          <span className="hg-card__meta">
            {copy.fcMonthlyChange(readWon(f.summary.monthly), readWon(after.monthly))}
          </span>
        )}
      </section>
      <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
        <Button type="submit" variant="primary" disabled={!changed || empty || blocked || busy}>
          {proposing ? copy.fcPropose(couple?.partnerName ?? '') : copy.save}
        </Button>
        {proposing && applyOn && (
          <span className="hg-help">{copy.fcApplyNote(formatMonthDay(applyOn))}</span>
        )}
      </div>
    </form>
  );
  return <MainFrame current="calendar" columns={[body]} />;
}
