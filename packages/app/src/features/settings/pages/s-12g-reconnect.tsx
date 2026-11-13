import {
  answerReconnect,
  fetchReconnectRequests,
  fetchUnlinkPartnerName,
  qk,
  ReconnectBlocked,
} from '@sweetwo/api';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { useOnline } from '../../../shared/online';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-12g 다시 연결 요청(받은 사람, Q7, 25 ‘S-12 계열 문구’ v2.2, 08 8장): 복구 없는 새 연결(D10).
// Avatar 2개 + “찬우님이 다시 연결하자고 해요” / “연결하면 새로 같이 시작해요”.
// ‘연결할게요’ → 서버가 요청한 사람 공간의 초대 코드를 돌려줌 → 합류 흐름(/i/{코드}, 공개 범위는 합류에서 한 번 확인).
// ‘괜찮아요’ → 혼자 쓰기 유지. “다시 받지 않을게요” → 그 뒤 요청은 서버가 조용히 거절(요청한 사람에게 알리지 않음).
// 받은 열린 요청이 없으면 S-12로. 오프라인이면 버튼 비활성 + 이유 한 줄.
export function S12gReconnect() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const online = useOnline();
  const reqs = useQuery({ queryKey: qk.reconnectRequests, queryFn: fetchReconnectRequests });
  const name = useQuery({ queryKey: qk.unlinkPartner, queryFn: fetchUnlinkPartnerName });
  const [busy, setBusy] = useState<'yes' | 'no' | 'block' | null>(null);
  if (d.loading || !d.me || !d.c || reqs.isLoading || name.isLoading) return <QuestionSkeleton />;
  const me = d.me;
  const open = (reqs.data ?? []).find((r) => r.to_user === me.id && r.status === 'open');
  // 기기에 남은 예전 목록으로 바로 나가지 않게, 새로 받는 중이면 기다림
  if (!open && reqs.isFetching) return <QuestionSkeleton />;
  if (!open) return <Navigate to="/settings/couple" replace />;
  const partner = name.data ?? '';
  const answer = async (kind: 'yes' | 'no' | 'block') => {
    if (busy || !online) return;
    setBusy(kind);
    try {
      const code = await answerReconnect(kind === 'yes', kind === 'block');
      track('rejoin_responded', {
        response: kind === 'yes' ? 'accept' : kind === 'block' ? 'block' : 'decline',
        hours_since_request: Math.max(
          0,
          Math.floor((Date.now() - Date.parse(open.created_at)) / 3_600_000),
        ),
      });
      // 먼저 옮기고 다시 읽음(다시 읽은 목록에 열린 요청이 없어 이 화면이 S-12로 먼저 나가지 않게)
      if (kind === 'yes' && code) nav(`/i/${code}`, { replace: true });
      else nav('/settings/couple', { replace: true });
      void qc.invalidateQueries({ queryKey: ['couple_unlink'] });
    } catch (e) {
      toast(e instanceof ReconnectBlocked ? copy.reconnectClosed : copy.failed);
      setBusy(null);
    }
  };
  const avatars = (
    <span className="hg-avatars" aria-hidden="true">
      <span className="hg-avatar hg-avatar--p1">{[...partner][0] ?? ''}</span>
      <span className="hg-avatar hg-avatar--p2">{[...d.c.myName][0] ?? ''}</span>
    </span>
  );
  return (
    <QuestionLayout
      hero={avatars}
      title={copy.reconnectAsked(partner)}
      help={copy.reconnectFresh}
      onBack={() => nav('/settings/couple')}
      primary={{ label: copy.reconnectYes, loading: busy === 'yes', disabled: !online }}
      note={online ? undefined : copy.needOnline}
      onSubmit={() => void answer('yes')}
      secondary={{
        label: copy.reconnectNo,
        loading: busy === 'no',
        disabled: !online,
        onClick: () => void answer('no'),
      }}
      later={{
        label: copy.reconnectBlock,
        loading: busy === 'block',
        onClick: () => void answer('block'),
      }}
      center
    />
  );
}
