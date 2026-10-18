import { duePayments, formatDateFull, formatYm, thisMonth } from '@sweetwo/core';
import { Badge, Button, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { GoalBadges } from '../goal-card';
import { useWedding, weddingItemPath, weddingPayPath } from '../wedding/data';

/** '2026-09-14' → "9/14"(결제 표시 5번) */
const slashDate = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

// G-07 결혼 비용 상세(22 G-07): 헤더(이름 + 상태 + D-day + 예식일) → 요약(총예산, 결제 완료, 남은 결제, 모아둔 돈, 양가 지원)
// → 부족·여유(+ 조정하기 G-04) → 항목 표(행 누르면 G-07a~d, 결제한 부분 진하게 + “9/14 ✓”) → 이번 달 결제했어요 → 항목 추가 → 월별.
// 총예산 누르면 Q3(연결된 부부는 제안).
export function G07Wedding() {
  const nav = useNavigate();
  const w = useWedding();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  const sp = w.d.space;
  const c = w.d.couple;
  let body = <div />;
  if (!w.loading && sp && c) {
    const payerName = (p: string) =>
      p === 'groom' || p === 'bride'
        ? w.d.me?.side === p
          ? c.myName
          : c.partnerName
        : copy.payers[p as 'us' | 'family'];
    const paid = (id: string, part: 'deposit' | 'balance') =>
      w.payments.find((p) => p.item_id === id && p.part === part);
    const cell = (id: string, part: 'deposit' | 'balance', planned: number | null) => {
      const p = paid(id, part);
      if (p)
        return (
          <>
            <b>{m(p.amount)}</b>
            <br />
            <small className="hg-card__meta">{copy.paidMark(slashDate(p.paid_on))}</small>
          </>
        );
      return planned === null ? '—' : m(planned);
    };
    const due = duePayments(w.items, w.payments, thisMonth());
    const s = w.summary;
    const date = sp.wedding_date
      ? formatDateFull(sp.wedding_date)
      : sp.wedding_month
        ? copy.weddingPlanned(formatYm(sp.wedding_month))
        : null;
    body = (
      <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
        <PageHeader title={copy.wedding} backLabel={copy.back} onBack={() => nav('/goals')} />
        <div className="hg-row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {w.goal && <GoalBadges g={w.goal} />}
          {w.dday !== null && w.dday >= 0 && <Badge kind="goal">{`D-${w.dday}`}</Badge>}
          {date && <span className="hg-card__meta">{date}</span>}
          {!sp.wedding_date && sp.wedding_month && <Badge kind="temp">{copy.estimated}</Badge>}
        </div>
        <section className="hg-card" aria-label={copy.wedding}>
          <div className="hg-list">
            <ListRow
              label={copy.weddingSummary.budget}
              value={m(w.budget)}
              onClick={() => nav('/goals/wedding/budget')}
            />
            <ListRow label={copy.weddingSummary.paid} value={m(s.paid)} />
            <ListRow label={copy.weddingSummary.remaining} value={m(s.remaining)} />
            <ListRow label={copy.weddingSummary.saved} value={m(w.saved)} />
            <ListRow label={copy.weddingSummary.support} value={m(w.support)} />
          </div>
        </section>
        {s.shortfall > 0 ? (
          <div className="hg-banner hg-banner--info">
            <span>{copy.weddingShort(m(s.shortfall))}</span>
            <Button variant="secondary" size="sm" onClick={() => nav('/goals/adjust')}>
              {copy.adjust}
            </Button>
          </div>
        ) : (
          <p className="hg-card__meta">{copy.weddingSurplus(m(s.surplus))}</p>
        )}
        {due.length > 0 && (
          <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            {due.map((x) => {
              const it = w.items.find((i) => i.id === x.id);
              return (
                <div key={`${x.id}-${x.part}`} className="hg-banner hg-banner--info">
                  <span>{`${it?.name ?? ''} ${copy.weddingCols[x.part]} ${m(x.amount)}`}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => nav(weddingPayPath(x.id, x.part))}
                  >
                    {copy.paidNow}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <section className="hg-stack">
          {w.items.length === 0 ? (
            <p className="hg-card__meta">{copy.noItems}</p>
          ) : (
            <table className="hg-table" aria-label={copy.weddingTable}>
              <thead>
                <tr>
                  {(['name', 'budget', 'deposit', 'balance', 'payer'] as const).map((k) => (
                    <th key={k} scope="col">
                      {copy.weddingCols[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {w.items.map((i) => (
                  <tr key={i.id}>
                    <th scope="row">
                      <button
                        type="button"
                        className="hg-btn hg-btn--link"
                        onClick={() => nav(weddingItemPath(i.id))}
                      >
                        {i.name}
                      </button>
                    </th>
                    <td>{m(i.budget)}</td>
                    <td>{cell(i.id, 'deposit', i.deposit_amount)}</td>
                    <td>{cell(i.id, 'balance', i.balance_amount)}</td>
                    <td>{payerName(i.payer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            type="button"
            className="hg-btn hg-btn--link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => nav(weddingItemPath('new'))}
          >
            {copy.addItem}
          </button>
        </section>
        {w.months.months.length > 0 && (
          <section className="hg-stack">
            <SectionHeader
              title={copy.weddingMonths}
              count={w.months.total > 0 ? copy.monthShort(m(w.months.total)) : undefined}
            />
            <div className="hg-list">
              {w.months.months.map((x) => (
                <ListRow
                  key={x.month}
                  label={formatYm(x.month)}
                  sub={x.short > 0 ? copy.monthShort(m(x.short)) : undefined}
                  value={`${copy.monthOut(m(x.out))}, ${copy.monthIn(m(x.income))}`}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }
  return <MainFrame current="goals" columns={[<div key="l">{body}</div>]} />;
}
