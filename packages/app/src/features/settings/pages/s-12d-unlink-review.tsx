import { agreeUnlink, fetchUnlink, qk } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { Modal, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { useOnline } from '../../../shared/online';
import { PersonDot } from '../../../shared/person';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { daysPending, exportedSince, UnlinkDeleted, type DataBack } from '../unlink';

// S-12d 연결 해제 요청 확인(받은 사람): Avatar 2개 + “찬우님이 연결 해제를 요청했어요”, 남는 것·지워지는 것, 기한 “11월 7일에 해제돼요”.
// 2026-11-13 v2.2(R-09): 주 버튼 ‘먼저 내보내기’(→ S-18, 뒤로 = 이 화면), 보조 ‘해제할게요’ → 확인 Modal → 바로 확정 → S-12h.
// 거절 없음, 닫으면 대기 유지. 오프라인이면 주 버튼 비활성 + 이유 한 줄(S3-08). 요청한 사람은 S-12로.
export function S12dUnlinkReview() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const online = useOnline();
  const u = useQuery({ queryKey: qk.unlink, queryFn: fetchUnlink });
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  if (d.loading || !d.c || !d.me || !d.space || u.isLoading) return <QuestionSkeleton />;
  const req = u.data;
  if (!req || req.requested_by === d.me.id) return <Navigate to="/settings/couple" replace />;
  const c = d.c;
  const me = d.me;
  const md = formatMonthDay(req.deadline);
  const agree = async () => {
    if (busy || !online) return;
    setBusy(true);
    try {
      await agreeUnlink();
      track('unlink_resolved', {
        path: 'acknowledged',
        days_pending: daysPending(req.requested_at),
        exported_data: exportedSince(req.requested_at),
      });
      // 공간이 바뀜: 먼저 S-12h로 옮기고 전부 다시 읽음
      nav('/settings/couple/unlinked', { replace: true });
      void qc.invalidateQueries();
    } catch {
      toast(copy.failed);
      setBusy(false);
      setAsk(false);
    }
  };
  // 요청한 사람(파트너) 먼저, 시작한 사람 색은 그대로(S3-22)
  const starterId = d.space.created_by;
  const avatars = (
    <span className="hg-avatars" aria-hidden="true">
      <PersonDot
        name={c.partnerName}
        starter={starterId === req.requested_by}
        userId={req.requested_by}
      />
      <PersonDot name={me.nickname ?? ''} starter={starterId === me.id} userId={me.id} />
    </span>
  );
  return (
    <>
      <QuestionLayout
        hero={avatars}
        title={copy.requestedBy(c.partnerName)}
        help={copy.unlinkOn(md)}
        onBack={() => nav('/settings/couple')}
        primary={{ label: copy.exportFirst }}
        onSubmit={() =>
          nav('/settings/data', {
            state: {
              back: '/settings/couple/unlink/review',
              backLabel: copy.unlink,
            } satisfies DataBack,
          })
        }
        note={online ? undefined : copy.needOnline}
        secondary={{
          label: copy.unlinkYes,
          onClick: () => online && setAsk(true),
          loading: busy,
          disabled: !online,
        }}
      >
        <UnlinkDeleted />
      </QuestionLayout>
      {ask && (
        <Modal
          title={copy.unlinkNowQ}
          body={copy.unlinkNowBody(md)}
          confirmLabel={copy.unlinkNowOk}
          cancelLabel={copy.unlinkNowKeep}
          busy={busy}
          onCancel={() => setAsk(false)}
          onConfirm={() => void agree()}
        />
      )}
    </>
  );
}
