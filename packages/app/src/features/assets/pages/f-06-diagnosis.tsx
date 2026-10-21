import { Badge, Button } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { onboardingCopy as oc } from '../../onboarding';
import { AssetsFrame } from '../assets-frame';
import { copy } from '../copy';
import { useDiagnosis, type Diagnosis } from '../diagnosis';
import type { Indicator, Signal } from '@sweetwo/core';

const badgeKind = (s: Signal) => (s === 'good' ? 'done' : s === 'unknown' ? 'temp' : 'warn');

/** 지표 한 줄 문장(23 F-06 지표 표) */
export function indicatorText(x: Indicator, r: Diagnosis): string {
  switch (x.key) {
    case 'savingRate':
      return x.pct === null ? copy.diagSavingUnknown : copy.diagSaving(x.pct);
    case 'emergency':
      return r.months === null ? copy.diagEmergencyUnknown : copy.diagEmergency(r.months);
    case 'loanBurden':
      return r.noLoan
        ? copy.diagNoLoan
        : x.pct === null
          ? copy.diagIncomeUnknown
          : copy.diagLoan(x.pct);
    case 'fixedRatio':
      return x.pct === null ? copy.diagIncomeUnknown : copy.diagFixed(x.pct);
    case 'investPrinciple':
      return r.invest.state === 'both'
        ? copy.diagInvestBoth(r.invest.limit ?? 0)
        : r.invest.state === 'one'
          ? r.investMine
            ? copy.diagInvestWait(r.partnerName)
            : copy.diagInvestMine
          : copy.diagInvestNone;
  }
}

// F-06 재정 진단(23 F-06): 요약 “5개 중 n개 양호” + 지표 카드(위험 → 주의 → 양호 순) + 바로가기, 비공개 안내.
// 추정값으로 계산한 지표는 ‘추정’. 분기 비교(2번)는 다음 단계.
export function F06Diagnosis() {
  const nav = useNavigate();
  const { result: r } = useDiagnosis();
  if (!r) return <AssetsFrame tab="diagnosis">{null}</AssetsFrame>;

  const go: Partial<Record<Indicator['key'], { label: string; to: string | null }>> = {
    emergency: {
      label: copy.diagGoEmergency,
      to: '/assets', // 비상금 카드(목표가 아님)
    },
    loanBurden: { label: copy.diagGoDebt, to: '/assets/items?side=debt' },
    fixedRatio: { label: copy.diagGoMoney, to: '/assets/money' },
    // 내 답이 없을 때만 ‘지금 정하기’ → O-53
    ...(r.investMine
      ? {}
      : { investPrinciple: { label: copy.diagGoInvest, to: '/assets/principle' } }),
  };
  const est = (k: Indicator['key']) =>
    (k === 'savingRate' && r.estimated.savingRate) ||
    ((k === 'loanBurden' || k === 'fixedRatio' || k === 'savingRate') && r.estimated.income) ||
    ((k === 'fixedRatio' || k === 'emergency') && r.estimated.fixed);

  return (
    <AssetsFrame tab="diagnosis">
      <p style={{ margin: 0 }}>
        <b>{copy.diagSummary(r.summary.good, r.summary.total)}</b>
      </p>
      <div className="hg-cards">
        {r.summary.ordered.map((x) => {
          const btn = go[x.key];
          const below =
            x.key === 'emergency' && r.months !== null && r.months < r.baseMonths
              ? copy.diagEmergencyMore(r.baseMonths)
              : null;
          return (
            <section key={x.key} className="hg-card hg-stack" aria-label={oc.indicators[x.key]}>
              <div className="hg-card__top">
                <span className="hg-card__label">{oc.indicators[x.key]}</span>
                <span className="hg-row" style={{ gap: 'var(--space-1)' }}>
                  {est(x.key) && <Badge kind="temp">{copy.estimatedTag}</Badge>}
                  <Badge kind={badgeKind(x.signal)}>{oc.signals[x.signal]}</Badge>
                </span>
              </div>
              <span>{indicatorText(x, r)}</span>
              {below && <span className="hg-card__meta">{below}</span>}
              {btn && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!btn.to}
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => btn.to && nav(btn.to)}
                >
                  {btn.label}
                </Button>
              )}
            </section>
          );
        })}
      </div>
      {r.hasPrivate && <p className="hg-help">{copy.diagPrivate}</p>}
    </AssetsFrame>
  );
}
