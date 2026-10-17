import { fetchUnlink, qk } from '@sweetwo/api';
import { formatMonthDay, readUnlinkPlan, unlinkTotals } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { UnlinkPlanList, UnlinkTotals } from '../unlink';

// S-12d 자산 정리 안 확인(받은 사람). 지금은 보기만: 기본안 문구, 항목별 두 사람 몫, 합계, 기한.
// ‘동의해요’, ‘다르게 정리하기’(S-12e, S-12f)는 다음 단계.
export function S12dUnlinkReview() {
  const nav = useNavigate();
  const d = useSettingsData();
  const u = useQuery({ queryKey: qk.unlink, queryFn: fetchUnlink });
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
  const t = unlinkTotals(items);
  return (
    <QuestionLayout
      title={copy.planTitle(req.ratio, 100 - req.ratio)}
      help={copy.deadline(formatMonthDay(req.deadline))}
      onBack={() => nav('/settings/couple')}
    >
      <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
        <UnlinkPlanList items={items} names={names} />
        <UnlinkTotals names={names} totals={[t.mine, t.theirs]} />
      </div>
    </QuestionLayout>
  );
}
