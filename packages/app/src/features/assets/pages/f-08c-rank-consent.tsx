import {
  answerRankConsent,
  fetchOpenRankRequest,
  qk,
  rankKeys,
  requestRankConsent,
} from '@sweetwo/api';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { RANK_PATH } from '../../frame';
import { copy } from '../copy';
import { useAssetsData } from '../data';

/**
 * F-08c 순위 같이 보기 동의(23 ‘F-08c’, 2026-11-13). 개인정보 사용 동의(고치기 승인이 아님, 08 4-1).
 * /assets/rank/consent = 보내는 쪽: request_rank_consent(내 동의 켬 + 상대에게 요청, 열린 요청은 새 것으로 바뀜).
 * /assets/rank/consent/:id = 받는 쪽(알림·홈 띠 5번): ‘좋아요’ = 내 동의 켬 → 둘 다 (가), ‘괜찮아요’ = 그대로.
 * 이미 답했거나 7일이 지난 요청은 안내 + 자산 순위로
 */
export function F08cRankConsent() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useAssetsData();
  const req = useQuery({ queryKey: qk.rankRequest, queryFn: fetchOpenRankRequest });
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  if (d.loading || req.isLoading || !d.couple || !d.me) return <QuestionSkeleton />;
  const partner = d.couple.partnerName;
  const back = () => nav(RANK_PATH, { replace: true });
  const refresh = () => Promise.all(rankKeys.map((k) => qc.invalidateQueries({ queryKey: k })));

  if (!id) {
    // 보내는 쪽(연결 전이면 서버가 거절)
    return (
      <QuestionLayout
        title={copy.consentSendTitle}
        help={copy.consentSendHelp(partner)}
        onBack={() => nav(-1)}
        primary={{ label: copy.consentSend, loading: busy === 'yes', disabled: !d.couple.joined }}
        onSubmit={async () => {
          if (busy) return;
          setBusy('yes');
          try {
            await requestRankConsent();
            track('rank_consent_requested', { result: 'sent' });
            await refresh();
            carryToast(copy.consentSent(partner));
            back();
          } catch {
            track('rank_consent_requested', { result: 'failed' });
            toast(copy.consentFailed);
          } finally {
            setBusy(null);
          }
        }}
      />
    );
  }

  const open = req.data && req.data.id === id && req.data.from_user !== d.me.id ? req.data : null;
  if (!open)
    return (
      <QuestionLayout
        title={copy.consentGone}
        onBack={back}
        primary={{ label: copy.rankTitle }}
        onSubmit={back}
      />
    );
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? 'yes' : 'no');
    try {
      const res = await answerRankConsent(open.id, accept);
      track('rank_consent_answered', { result: res });
      await refresh();
      if (res === 'accepted') carryToast(copy.consentAccepted);
      else if (res === 'expired') carryToast(copy.consentGone);
      back();
    } catch {
      toast(copy.consentFailed);
    } finally {
      setBusy(null);
    }
  };
  return (
    <QuestionLayout
      title={copy.consentAskTitle(partner)}
      help={copy.consentAskHelp}
      onBack={() => nav(-1)}
      primary={{ label: copy.consentYes, loading: busy === 'yes' }}
      secondary={{
        label: copy.consentNo,
        loading: busy === 'no',
        onClick: () => void answer(false),
      }}
      onSubmit={() => void answer(true)}
    />
  );
}
