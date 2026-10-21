import { readWon } from '@sweetwo/core';
import { Button, Illustration, Lead, Meter } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { money, useMask } from '../../shared/mask';
import { copy } from './copy';
import { useDiagnosis } from './diagnosis';

// 비상금 카드(23 F-01 비상금, 19 H-01). 목표가 아니라 언제든 넣고 빼는 돈.
// 잔액 + “n개월 생활할 수 있어요” + 기준까지 막대 + ‘+ 넣기 / - 꺼내기’(→ F-09, 바로 반영)
export function EmergencyCard({ compact }: { compact?: boolean }) {
  const nav = useNavigate();
  const diag = useDiagnosis();
  const { masked } = useMask();
  const r = diag.result;
  if (!r) return null;
  const e = r.emergency;
  const pct = e.base > 0 ? Math.round((e.balance * 100) / e.base) : 0;
  return (
    <section className="hg-card hg-stack" aria-label={copy.emergencyTitle}>
      <Meter
        name={copy.emergencyTitle}
        tone="safety"
        pct={pct}
        lead={<Lead art={<Illustration name="goal-01-emergency" />} />}
        sub={
          e.base > 0
            ? copy.emergencyOf(money(e.balance, masked), readWon(e.base))
            : money(e.balance, masked)
        }
      />
      {!compact && (
        <p className="hg-card__meta">
          {r.months !== null ? copy.diagEmergency(r.months) : copy.diagEmergencyUnknown}
          {r.months !== null &&
            r.months < r.baseMonths &&
            ` ${copy.diagEmergencyMore(r.baseMonths)}`}
        </p>
      )}
      <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
        <Button variant="secondary" size="sm" onClick={() => nav('/assets/emergency/in')}>
          {copy.emergencyIn}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => nav('/assets/emergency/out')}>
          {copy.emergencyOut}
        </Button>
      </div>
    </section>
  );
}
