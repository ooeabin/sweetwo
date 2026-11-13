import { answerSplit, fetchSharedAccounts, qk, splitAccountKeys } from '@sweetwo/api';
import { coupleOf, readWon } from '@sweetwo/core';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { useOnline } from '../../../shared/online';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useMe, usePartner, useSpace } from '../data';

const t = copy.splitShare;
const nameCodeOf = (name: string): 'living' | 'date' | 'custom' =>
  name === t.nameChips.living ? 'living' : name === t.nameChips.date ? 'date' : 'custom';

// W-01c 분담 제안 확인(받은 사람, 20 ‘W-01c’, 08 4-1 (나)): “{이름}님이 ‘생활비 통장’ 나누기를 제안했어요”
// + “한 달 100만 원, {나} 40만 원, {이름} 60만 원” + 나누는 법(월급 비율이면 결과 비율만, 월급 원값 없음)
// + ‘좋아요’(answer_split: 두 사람 월급 계획에 각자 몫 ‘같이 쓰는 통장’ 줄, 합쳐서면 공동 한 줄) / ‘지금처럼 할게요’.
// 7일 지나면 제안 없어짐. 제안한 사람이 열면 “{이름}님 답을 기다려요”. 진입: 홈 띠 4번, 알림(/salary/split/:id).
export function W01cSplitAnswer() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const online = useOnline();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const rows = useQuery({ queryKey: qk.sharedAccounts, queryFn: fetchSharedAccounts });
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  if (
    me.isLoading ||
    space.isLoading ||
    partner.isLoading ||
    rows.isLoading ||
    !me.data ||
    !space.data
  )
    return <QuestionSkeleton />;
  const c = coupleOf(me.data, space.data, partner.data ?? null);
  const a = (rows.data ?? []).find((r) => r.id === id);
  const open = !!a && a.status === 'proposed' && Date.parse(a.expires_at) > Date.now();
  const home = () => nav('/', { replace: true });
  // 기기에 남은 예전 목록이면 새로 받을 때까지 기다림
  if (!open && rows.isFetching) return <QuestionSkeleton />;
  if (!a || !open)
    return (
      <QuestionLayout
        title={a && a.status === 'proposed' ? t.expired : t.gone}
        onBack={() => nav('/')}
        primary={{ label: t.ok }}
        onSubmit={home}
        center
      />
    );
  if (a.proposed_by === me.data.id)
    return (
      <QuestionLayout
        title={t.waiting(c.partnerName)}
        onBack={() => nav('/salary?view=plan')}
        primary={{ label: t.ok }}
        onSubmit={() => nav('/salary?view=plan', { replace: true })}
        center
      />
    );
  // 받은 사람 = member_b
  const myShare = a.member_b === me.data.id ? a.share_b : a.share_a;
  const theirShare = a.member_b === me.data.id ? a.share_a : a.share_b;
  const theirTen = Math.round((theirShare * 10) / a.monthly_total);
  const ruleLine =
    a.rule === 'income_ratio'
      ? t.ruleLine.income_ratio(10 - theirTen, theirTen)
      : t.ruleLine[a.rule];
  const answer = async (accept: boolean) => {
    if (busy || !online) return;
    setBusy(accept ? 'yes' : 'no');
    try {
      const result = await answerSplit(a.id, accept);
      track('split_answered', { name_code: nameCodeOf(a.name), rule: a.rule, result });
      await Promise.all(splitAccountKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      if (result === 'expired') {
        carryToast(t.expired);
        return home();
      }
      if (result === 'accepted') {
        carryToast(t.accepted);
        return nav('/salary?view=plan', { replace: true });
      }
      home();
    } catch {
      toast(copy.failed);
      setBusy(null);
    }
  };
  return (
    <QuestionLayout
      title={t.title(c.partnerName, a.name)}
      onBack={() => nav('/')}
      primary={{ label: t.yes, loading: busy === 'yes', disabled: !online }}
      onSubmit={() => void answer(true)}
      secondary={{
        label: t.no,
        loading: busy === 'no',
        disabled: !online,
        onClick: () => void answer(false),
      }}
    >
      <div className="hg-card hg-stack" style={{ gap: 'var(--space-2)' }}>
        <p style={{ margin: 0 }}>
          {t.body(
            readWon(a.monthly_total),
            c.myName,
            readWon(myShare),
            c.partnerName,
            readWon(theirShare),
          )}
        </p>
        <p className="hg-help" style={{ margin: 0 }}>
          {ruleLine}
        </p>
      </div>
    </QuestionLayout>
  );
}
