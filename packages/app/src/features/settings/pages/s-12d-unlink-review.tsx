import { agreeUnlink, fetchUnlink, qk } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { daysPending, UnlinkDeleted } from '../unlink';

// S-12d 연결 해제 요청 확인(받은 사람): “찬우님이 연결 해제를 요청했어요”, 지워지는 것, 기한 “11월 7일에 해제돼요”,
// ‘먼저 내보내기’(→ S-18), ‘확인했어요’ = 바로 확정 → S-12h. 거절 없음, 닫으면 대기 유지. 요청한 사람은 S-12로.
export function S12dUnlinkReview() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const u = useQuery({ queryKey: qk.unlink, queryFn: fetchUnlink });
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.c || !d.me || u.isLoading) return null;
  const req = u.data;
  if (!req || req.requested_by === d.me.id) return <Navigate to="/settings/couple" replace />;
  const agree = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await agreeUnlink();
      track('unlink_resolved', {
        path: 'agreed',
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
      title={copy.requestedBy(d.c.partnerName)}
      help={copy.unlinkOn(formatMonthDay(req.deadline))}
      onBack={() => nav('/settings/couple')}
      primary={{ label: copy.acknowledge, loading: busy }}
      onSubmit={() => void agree()}
      later={{ label: copy.exportFirst, onClick: () => nav('/settings/data') }}
    >
      <UnlinkDeleted />
    </QuestionLayout>
  );
}
