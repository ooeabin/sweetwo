import {
  addDays,
  formatManWon,
  formatMonthDay,
  splitPercent,
  todayKst,
  unlinkShare,
} from '@sweetwo/core';
import { AmountInput, QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { UnlinkTotals, useJointAssets, useUnlinkDraft } from '../unlink';

// S-12b 자산 정리 안 작성: 기본안 = 분담 비율로 공동 명의 자산·부채마다 내 몫(1만 원 단위 반올림). 내 몫 0 ~ 금액,
// 상대 몫 = 금액 − 내 몫(자동), 합계 바로 갱신(자산, 부채 따로). 기한 = 오늘 + 14일. 다음 → S-12c
export function S12bUnlinkPlan() {
  const nav = useNavigate();
  const d = useSettingsData();
  const joint = useJointAssets();
  const draft = useUnlinkDraft();
  if (d.loading || !d.c || !d.space || joint.loading) return null;
  const c = d.c;
  const pct = splitPercent(d.space.split_mode, c.myIncome, c.partnerIncome, c.myRatio);
  const items = joint.rows.map((a) => {
    const v = draft.shares[a.id];
    return {
      id: a.id,
      name: a.name,
      side: a.side,
      amount: a.amount,
      mine: v === undefined ? unlinkShare(a.amount, pct) : v,
    };
  });
  const bad = items.some((i) => i.mine === null || i.mine > i.amount);
  const sum = (side: 'asset' | 'debt') => {
    const rows = items.filter((i) => i.side === side);
    const mine = rows.reduce((t, i) => t + Math.min(i.mine ?? 0, i.amount), 0);
    return [mine, rows.reduce((t, i) => t + i.amount, 0) - mine] as [number, number];
  };
  const hasDebt = items.some((i) => i.side === 'debt');
  return (
    <QuestionLayout
      steps={{ total: 3, now: 1 }}
      title={copy.planTitle(pct, 100 - pct)}
      help={copy.deadline(formatMonthDay(addDays(todayKst(), 14)))}
      onBack={() => nav('/settings/couple/unlink')}
      primary={{ label: copy.next, disabled: bad }}
      onSubmit={() => !bad && nav('/settings/couple/unlink/confirm')}
    >
      <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
        {items.map((i) => (
          <div key={i.id} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
            <p>
              <strong>{i.name}</strong>{' '}
              <span className="hg-q__help">
                {i.side === 'debt'
                  ? copy.debtAmount(formatManWon(i.amount))
                  : formatManWon(i.amount)}
              </span>
            </p>
            <AmountInput
              label={copy.myShare(i.name)}
              value={i.mine}
              onChange={(v) => draft.set(i.id, v)}
              allowZero
              embedded
            />
            {i.mine !== null && i.mine > i.amount ? (
              <p className="hg-help is-error" role="alert">
                {copy.shareOver}
              </p>
            ) : (
              <p className="hg-q__help">
                {copy.theirShare(c.partnerName, formatManWon(i.amount - (i.mine ?? 0)))}
              </p>
            )}
          </div>
        ))}
        <UnlinkTotals
          title={hasDebt ? copy.assetsTotal : undefined}
          names={[c.myName, c.partnerName]}
          totals={sum('asset')}
        />
        {hasDebt && (
          <UnlinkTotals
            title={copy.debtsTotal}
            names={[c.myName, c.partnerName]}
            totals={sum('debt')}
          />
        )}
      </div>
    </QuestionLayout>
  );
}
