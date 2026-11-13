import {
  answerReconnect,
  fetchMyUnlink,
  fetchUnlinkPartnerName,
  qk,
  startNewInvite,
} from '@sweetwo/api';
import { Icon, Modal, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { useOnline } from '../../../shared/online';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-12g 다시 연결 수락(받은 사람, Q7): Avatar 2개 + “찬우님이 다시 연결하자고 해요”,
// “연결을 끊기 전 같이 쓰던 월급 계획과 저금이 돌아와요” + 따로 경고 띠 “해제 뒤 새로 적은 내용은 지워져요”(2026-11-11 S3-19),
// ‘다시 연결할게요’ → 확인 Modal → 연결 복구 → 공개 범위(S-13) 한 번 → 홈, ‘괜찮아요’ → 혼자 쓰기 유지.
// 30일이 지났으면 “다시 연결할 수 있는 기간이 지났어요” + ‘새로 초대하기’(막다른 화면 없이). 오프라인이면 버튼 비활성 + 이유 한 줄.
export function S12gReconnect() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const online = useOnline();
  const u = useQuery({ queryKey: qk.myUnlink, queryFn: fetchMyUnlink });
  const name = useQuery({ queryKey: qk.unlinkPartner, queryFn: fetchUnlinkPartnerName });
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  if (d.loading || !d.me || !d.c || u.isLoading || name.isLoading) return <QuestionSkeleton />;
  const done = u.data;
  const open = done && done.reconnect_by && !done.reconnect_answer && done.reconnect_by !== d.me.id;
  if (!done || (!open && done.reconnect_until && Date.parse(done.reconnect_until) > Date.now()))
    return <Navigate to="/settings/couple" replace />;
  const partner = name.data ?? '';
  const expired = !done.reconnect_until || Date.parse(done.reconnect_until) <= Date.now();
  const answer = async (accept: boolean) => {
    if (busy || !online) return;
    setBusy(true);
    try {
      await answerReconnect(accept);
      const at = done.reconnect_at ? Date.parse(done.reconnect_at) : NaN;
      track('rejoin_responded', {
        response: accept ? 'accept' : 'decline',
        hours_since_request: Number.isNaN(at)
          ? 0
          : Math.max(0, Math.floor((Date.now() - at) / 3_600_000)),
      });
      if (accept) {
        // 다시 연결 뒤 공개 범위 한 번 확인(S-13) → 홈
        nav('/settings/visibility?next=/', { replace: true });
        void qc.invalidateQueries();
      } else {
        await qc.invalidateQueries({ queryKey: qk.myUnlink });
        nav('/settings/couple', { replace: true });
      }
    } catch {
      toast(copy.failed);
      setBusy(false);
      setAsk(false);
    }
  };
  const newInvite = async () => {
    if (busy || !online) return;
    setBusy(true);
    try {
      if (d.space?.couple_state === 'solo') await startNewInvite();
      await qc.invalidateQueries({ queryKey: qk.space });
      nav('/settings/couple?invite=1', { replace: true });
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
      <QuestionLayout
        hero={avatars}
        title={copy.reconnectExpired}
        onBack={() => nav('/settings/couple')}
        primary={{ label: copy.newInvite, loading: busy, disabled: !online }}
        note={online ? undefined : copy.needOnline}
        onSubmit={() => void newInvite()}
        center
      />
    );
  return (
    <>
      <QuestionLayout
        hero={avatars}
        title={copy.reconnectAsked(partner)}
        help={copy.reconnectBack}
        onBack={() => nav('/settings/couple')}
        primary={{ label: copy.reconnectYes, loading: busy, disabled: !online }}
        note={online ? undefined : copy.needOnline}
        onSubmit={() => setAsk(true)}
        later={{ label: copy.reconnectNo, onClick: () => void answer(false) }}
        center
      >
        <div className="hg-banner hg-banner--check" role="note">
          <Icon name="circle-alert" />
          <span>{copy.reconnectDiscard}</span>
        </div>
      </QuestionLayout>
      {ask && (
        <Modal
          tone="primary"
          title={copy.reconnectQ}
          body={copy.reconnectQBody}
          confirmLabel={copy.reconnectOk}
          cancelLabel={copy.reconnectKeep}
          busy={busy}
          onCancel={() => setAsk(false)}
          onConfirm={() => void answer(true)}
        />
      )}
    </>
  );
}
