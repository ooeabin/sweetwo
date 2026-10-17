import { acceptCounterUnlink, fetchUnlink, qk } from '@sweetwo/api';
import { formatMonthDay, readUnlinkPlan, unlinkTotals } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { daysPending, UnlinkPlanList, UnlinkTotals } from '../unlink';

// S-12f 다르게 정리한 안 확인(요청한 사람, Q7): 항목별 두 사람 몫, 합계. ‘동의해요’ → 그 안으로 해제 확정 → S-12h.
// 거절 버튼은 없음(답하지 않으면 기한에 기본안)
export function S12fUnlinkCounter() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const u = useQuery({ queryKey: qk.unlink, queryFn: fetchUnlink });
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.c || !d.me || u.isLoading) return null;
  const req = u.data;
  if (!req || req.requested_by !== d.me.id || !req.counter)
    return <Navigate to="/settings/couple" replace />;
  const c = d.c;
  const items = readUnlinkPlan(req.counter);
  const names: [string, string] = [c.myName, c.partnerName];
  const a = unlinkTotals(items, 'asset');
  const debt = items.some((i) => i.side === 'debt') ? unlinkTotals(items, 'debt') : null;
  const accept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await acceptCounterUnlink();
      track('unlink_resolved', {
        path: 'counter_agreed',
        days_pending: daysPending(req.requested_at),
        exported_data: false,
      });
      // 공간이 바뀜: 먼저 S-12h로 옮기고 전부 다시 읽음
      nav('/settings/couple/unlinked', { replace: true });
      void qc.invalidateQueries();
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.counterReceived(c.partnerName)}
      help={copy.counterHelp(formatMonthDay(req.deadline))}
      onBack={() => nav('/settings/couple')}
      primary={{ label: copy.agree, loading: busy }}
      onSubmit={() => void accept()}
    >
      <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
        <UnlinkPlanList items={items} names={names} />
        <UnlinkTotals
          title={debt ? copy.assetsTotal : undefined}
          names={names}
          totals={[a.mine, a.theirs]}
        />
        {debt && (
          <UnlinkTotals title={copy.debtsTotal} names={names} totals={[debt.mine, debt.theirs]} />
        )}
      </div>
    </QuestionLayout>
  );
}
