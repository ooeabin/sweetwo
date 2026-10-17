import { answerReconnect, fetchMyUnlink, fetchUnlinkPartnerName, qk } from '@sweetwo/api';
import { QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-12g 다시 연결 수락(받은 사람, Q7): Avatar 2개 + “찬우님이 다시 연결하자고 해요”,
// “연결을 끊기 전 공동 목표·통장이 돌아와요”, ‘다시 연결할게요’ → 연결 복구 → 이번 달, ‘괜찮아요’ → 혼자 쓰기 유지.
// 30일이 지났으면 “다시 연결할 수 있는 기간이 지났어요”, 버튼 숨김. 다시 연결하면 공개 범위(S-13)를 한 번 확인하고 이번 달로.
export function S12gReconnect() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const u = useQuery({ queryKey: qk.myUnlink, queryFn: fetchMyUnlink });
  const name = useQuery({ queryKey: qk.unlinkPartner, queryFn: fetchUnlinkPartnerName });
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.me || !d.c || u.isLoading || name.isLoading) return null;
  const done = u.data;
  const open = done && done.reconnect_by && !done.reconnect_answer && done.reconnect_by !== d.me.id;
  if (!done || (!open && done.reconnect_until && Date.parse(done.reconnect_until) > Date.now()))
    return <Navigate to="/settings/couple" replace />;
  const partner = name.data ?? '';
  const expired = !done.reconnect_until || Date.parse(done.reconnect_until) <= Date.now();
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await answerReconnect(accept);
      if (accept) {
        // 다시 연결 뒤 공개 범위 한 번 확인(S-13) → 이번 달
        nav('/settings/visibility?next=/', { replace: true });
        void qc.invalidateQueries();
      } else {
        await qc.invalidateQueries({ queryKey: qk.myUnlink });
        nav('/settings/couple', { replace: true });
      }
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  const avatars = (
    <span className="hg-avatars" aria-hidden="true">
      <span className="hg-avatar hg-avatar--p1">{[...partner][0] ?? ''}</span>
      <span className="hg-avatar hg-avatar--p2">{[...d.c.myName][0] ?? ''}</span>
    </span>
  );
  if (expired)
    return (
      <QuestionLayout title={copy.reconnectExpired} onBack={() => nav('/settings/couple')}>
        {avatars}
      </QuestionLayout>
    );
  return (
    <QuestionLayout
      title={copy.reconnectAsked(partner)}
      help={copy.reconnectBack}
      onBack={() => nav('/settings/couple')}
      primary={{ label: copy.reconnectYes, loading: busy }}
      onSubmit={() => void answer(true)}
      later={{ label: copy.reconnectNo, onClick: () => void answer(false) }}
    >
      {avatars}
    </QuestionLayout>
  );
}
