import { Badge, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../../shared/mask';
import { MainFrame } from '../../month';
import { onboardingCopy } from '../../onboarding';
import { copy } from '../copy';
import { useAssetsData } from '../data';
import { moneyPlan } from '../money';

const editPath = (f: string) => `/assets/money/${f}`;

// F-05 월 수입·지출(23 F-05 1·2·4·5번): 내 수입·월급날(→ F-05a·b, 사실값 바로), 배우자 수입(보기만),
// 지출 줄 용돈(→ F-05d), 고정지출·대출 상환(→ F-05c, 바로), 생활비(→ F-05d), 저축 가능 금액.
// 연결된 부부의 용돈·생활비 예산은 제안. 기간 정해서 바꾸기(F-05f), 들어오는 돈(W-07), 고정지출 항목별·변동 항목 예산은 다음 단계.
export function F05Money() {
  const nav = useNavigate();
  const d = useAssetsData();
  const { masked } = useMask();
  const m = (v: number) => money(v, masked);
  if (d.loading || !d.me || !d.space) return null;
  const sp = d.space;
  const p = moneyPlan(d.me, sp, d.partnerProfile);
  const c = p.couple;
  const day = (pd: number | 'last' | null) =>
    pd === null ? '' : copy.payday(onboardingCopy.dayText(pd));
  const saveable = p.sum.saveable;

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader title={copy.moneyTitle} backLabel={copy.back} onBack={() => nav('/assets')} />
      <section className="hg-stack" aria-label={copy.incomeSection}>
        <SectionHeader title={copy.incomeSection} count={m(p.sum.income)} />
        <div className="hg-list">
          <ListRow
            label={c.myName}
            sub={[
              d.me.income_variable ? copy.baseIncome : '',
              day(c.myPayday),
              d.me.other_income ? copy.otherIncomeIn(m(d.me.other_income)) : '',
            ]
              .filter(Boolean)
              .join(', ')}
            value={m(c.myIncome ?? 0)}
            onClick={() => nav(editPath('income'))}
          />
          {sp.couple_state !== 'solo' && (
            <ListRow
              label={
                <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
                  {c.partnerName}
                  {c.partnerEstimated && <Badge kind="temp">{copy.estimatedTag}</Badge>}
                </span>
              }
              sub={day(c.partnerPayday)}
              value={c.partnerUnknown ? '' : m(c.partnerIncome ?? 0)}
            />
          )}
        </div>
      </section>
      <section className="hg-stack" aria-label={copy.spendSection}>
        <SectionHeader title={copy.spendSection} count={m(p.sum.allowances + p.sum.sharedLiving)} />
        <div className="hg-list">
          <ListRow
            label={copy.allowance}
            sub={
              sp.couple_state === 'solo'
                ? undefined
                : copy.allowanceEach(
                    copy.person(c.myName, m(p.myAllowance ?? 0)),
                    copy.person(c.partnerName, m(p.partnerAllowance ?? 0)),
                  )
            }
            value={m(p.sum.allowances)}
            onClick={() => nav(editPath('allowance'))}
          />
          <ListRow
            label={copy.fixed}
            value={m(sp.fixed_total ?? 0)}
            onClick={() => nav(editPath('fixed'))}
          />
          <ListRow
            label={copy.loan}
            value={m(sp.loan_repayment ?? 0)}
            onClick={() => nav(editPath('loan'))}
          />
          <ListRow
            label={copy.living}
            value={m(sp.living_budget ?? 0)}
            onClick={() => nav(editPath('living'))}
          />
        </div>
      </section>
      <section className="hg-card" aria-label={copy.saveable}>
        <span className="hg-card__label">{copy.saveable}</span>
        {saveable > 0 ? (
          <span className="hg-card__value">{m(saveable)}</span>
        ) : (
          <>
            <span className="hg-card__value">{copy.short(m(Math.abs(saveable)))}</span>
            <span className="hg-card__meta">{copy.shortAsk}</span>
          </>
        )}
      </section>
    </div>
  );
  return <MainFrame current="assets" columns={[body]} />;
}
