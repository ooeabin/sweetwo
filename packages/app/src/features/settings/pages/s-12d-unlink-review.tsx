import { agreeUnlink, fetchUnlink, qk } from '@sweetwo/api';
import { formatMonthDay, readUnlinkPlan, unlinkTotals } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { UnlinkPlanList, UnlinkTotals } from '../unlink';

// S-12d 자산 정리 안 확인: 기본안 문구, 항목별 두 사람 몫, 합계, 기한.
// 받은 사람은 ‘동의해요’ → 바로 해제 확정 → S-12h. 요청한 사람(이번 달 띠에서)은 보기만.
// ‘다르게 정리하기’(S-12e, S-12f)는 다음 단계.
export function S12dUnlinkReview() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const u = useQuery({ queryKey: qk.unlink, queryFn: fetchUnlink });
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.c || !d.me || u.isLoading) return null;
  const req = u.data;
  if (!req) return <Navigate to="/settings/couple" replace />;
  const c = d.c;
  const items = readUnlinkPlan(req.plan);
  const mineIsRequester = req.requested_by === d.me.id;
  // 요청한 사람 몫(mine)을 먼저: 받은 사람에게는 상대 이름이 먼저
  const names: [string, string] = mineIsRequester
    ? [c.myName, c.partnerName]
    : [c.partnerName, c.myName];
  const a = unlinkTotals(items, 'asset');
  const debt = items.some((i) => i.side === 'debt') ? unlinkTotals(items, 'debt') : null;
  const agree = async () => {
    if (busy || mineIsRequester) return;
    setBusy(true);
    try {
      await agreeUnlink();
      // 공간이 바뀜: 먼저 S-12h로 옮기고(이 화면은 대기 요청이 없으면 S-12로 돌려보냄) 전부 다시 읽음
      nav('/settings/couple/unlinked', { replace: true });
      void qc.invalidateQueries();
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.planTitle(req.ratio, 100 - req.ratio)}
      help={copy.deadline(formatMonthDay(req.deadline))}
      onBack={() => nav('/settings/couple')}
      primary={mineIsRequester ? undefined : { label: copy.agree, loading: busy }}
      onSubmit={mineIsRequester ? undefined : () => void agree()}
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
