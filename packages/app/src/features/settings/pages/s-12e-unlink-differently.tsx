import { counterUnlink, fetchUnlink, qk } from '@sweetwo/api';
import { formatMonthDay, readUnlinkPlan } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { ShareEditor, sharesBad, sharesOf, useUnlinkDraft } from '../unlink';

// S-12e 다르게 정리하기(받은 사람, 1회): S-12b와 같은 편집 화면. 같은 항목·금액으로 내 몫만 바꿈.
// 보내기 → 요청한 사람 S-12f. 답이 없으면 기한에 기본안
export function S12eUnlinkDifferently() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const u = useQuery({ queryKey: qk.unlink, queryFn: fetchUnlink });
  const draft = useUnlinkDraft();
  const reset = draft.reset;
  const [busy, setBusy] = useState(false);
  useEffect(() => reset(), [reset]);
  if (d.loading || !d.c || !d.me || u.isLoading) return null;
  const req = u.data;
  if (!req || req.requested_by === d.me.id || req.counter)
    return <Navigate to="/settings/couple" replace />;
  const c = d.c;
  // plan의 mine = 요청한 사람 몫 → 내(받은 사람) 몫 = 금액 − mine
  const rows = sharesOf(
    readUnlinkPlan(req.plan).map((i) => ({
      id: i.assetId,
      name: i.name,
      side: i.side,
      amount: i.amount,
      base: i.amount - i.mine,
    })),
    draft.shares,
  );
  const bad = sharesBad(rows);
  const send = async () => {
    if (bad || busy) return;
    setBusy(true);
    try {
      const shares: Record<string, number> = {};
      for (const r of rows) if (r.mine !== null && r.mine !== r.base) shares[r.id] = r.mine;
      await counterUnlink(shares);
      track('unlink_countered', {});
      reset();
      await qc.invalidateQueries({ queryKey: qk.unlink });
      toast(copy.counterSent(c.partnerName));
      nav('/settings/couple', { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  return (
    <QuestionLayout
      title={copy.counterQ}
      help={copy.deadline(formatMonthDay(req.deadline))}
      onBack={() => nav('/settings/couple/unlink/review')}
      primary={{ label: copy.send, disabled: bad, loading: busy }}
      onSubmit={() => void send()}
    >
      <ShareEditor rows={rows} names={[c.myName, c.partnerName]} onChange={draft.set} />
    </QuestionLayout>
  );
}
