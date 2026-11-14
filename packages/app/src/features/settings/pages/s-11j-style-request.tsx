import { answerModeChange, fetchModeRequest, manageKeys, ModeChangeBlocked } from '@sweetwo/api';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { salaryModeCode, track } from '../../../shared/analytics';
import { useOnline } from '../../../shared/online';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-11j 관리 형태 요청 확인(받은 사람, 25 ‘S-11j’, 08 4-1 (가)): 요청한 사람이 고른 말 그대로
// (P-04 “{이름}님이 월급은 대부분 {나}님에게 보낸다고 했어요” / “{나}님이 관리하는 걸로 바꿀까요?”,
// S-11f “{이름}님이 월급을 합쳐서 관리하자고 해요”) + 바뀌는 것 3줄 + ‘좋아요’ / ‘지금처럼 할게요’(answer_mode_change).
// 거절·7일 만료면 원래 형태 그대로, 요청한 사람 인앱은 서버. 진입: 홈 띠 3번, 알림(/settings/couple/style/request/:id).
export function S11jStyleRequest() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const d = useSettingsData();
  const online = useOnline();
  const q = useQuery({
    queryKey: ['mode_change_request', id],
    queryFn: () => fetchModeRequest(id),
    enabled: !!id,
  });
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  if (d.loading || !d.me || !d.c || q.isLoading) return <QuestionSkeleton />;
  const me = d.me;
  const c = d.c;
  const r = q.data;
  const name = c.partnerName;
  const myName = c.myName;
  const open =
    !!r && r.status === 'open' && r.from_user !== me.id && Date.parse(r.expires_at) > Date.now();
  if (!open && q.isFetching) return <QuestionSkeleton />;
  if (!r || !open)
    return (
      <QuestionLayout
        title={r && r.status === 'open' ? copy.styleExpired : copy.styleGone}
        onBack={() => nav('/')}
        primary={{ label: copy.ok }}
        onSubmit={() => nav('/', { replace: true })}
        center
      />
    );
  const iManage = r.to_manager === me.id;
  const title =
    r.phrase === 'p04_send'
      ? copy.styleReqSend(name, myName)
      : r.phrase === 's11f_combine'
        ? copy.styleReqCombine(name)
        : copy.styleReqManager(name, myName);
  const help = r.phrase === 'p04_send' ? copy.styleReqSendSub(myName) : undefined;
  // 바뀌는 것(3줄 안): 합치기면 하나로, 한 사람 관리형이면 보내기·용돈, 묶음은 공동 저금
  const lines = [
    r.phrase === 's11f_manager' ? copy.styleChangeMine(myName) : copy.styleChangeOne,
    iManage ? copy.styleChangeSend(name) : r.to_manager ? null : copy.styleChangeAllowance,
    r.phrase !== 's11f_manager' ? copy.styleChangeBundle : null,
  ]
    .filter((x): x is string => !!x)
    .slice(0, 3);
  const answer = async (accept: boolean) => {
    if (busy || !online) return;
    setBusy(accept ? 'yes' : 'no');
    try {
      const result = await answerModeChange(r.id, accept);
      track('mode_change_answered', {
        phrase: r.phrase,
        to_mode: salaryModeCode(r.to_mode),
        result,
      });
      await Promise.all(manageKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      if (result === 'expired') {
        carryToast(copy.styleExpired);
        return nav('/', { replace: true });
      }
      if (result === 'accepted') {
        carryToast(copy.styleSaved);
        return nav('/salary?view=plan', { replace: true });
      }
      nav('/', { replace: true });
    } catch (e) {
      toast(
        e instanceof ModeChangeBlocked && e.reason === 'unlink_pending'
          ? copy.unlinkPendingLocked
          : copy.failed,
      );
      setBusy(null);
    }
  };
  return (
    <QuestionLayout
      title={title}
      help={help}
      onBack={() => nav('/')}
      primary={{ label: copy.styleYes, loading: busy === 'yes', disabled: !online }}
      onSubmit={() => void answer(true)}
      secondary={{
        label: copy.styleNo,
        loading: busy === 'no',
        disabled: !online,
        onClick: () => void answer(false),
      }}
      note={online ? undefined : copy.needOnline}
    >
      <section
        className="hg-stack"
        style={{ gap: 'var(--space-2)' }}
        aria-label={copy.styleChangesTitle}
      >
        <b>{copy.styleChangesTitle}</b>
        <ul
          className="hg-stack"
          style={{ gap: 'var(--space-1)', paddingLeft: 'var(--space-5)', margin: 0 }}
        >
          {lines.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    </QuestionLayout>
  );
}
