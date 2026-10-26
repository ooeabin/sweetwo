import { readWon } from '@sweetwo/core';
import { DoneMark, InfoPlate, QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import {
  doneCount,
  myChecklist,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
} from '../data';

// W-02 끝 다 보냈어요(20, Q7): 큰 체크 + “이번 달 월급을 다 나눴어요” + 이번 달 목표에 모은 돈(목표별 줄)
// + 배우자 진행 “예빈님 3개 중 1개”(각자 모드 + 배우자 합류만, 누르면 W-02 그 사람 탭) → 확인 → 홈
export function W02Done() {
  const nav = useNavigate();
  const me = useMe();
  const goals = useGoals();
  const lists = useChecklists();
  const space = useSpace();
  const partner = usePartner();
  if (!me.data || !goals.data || !lists.data) return null;
  const list = myChecklist(lists.data, me.data.id);
  const saved = (list?.pay_check_line ?? []).filter(
    (l) => l.kind === 'saving' && l.state === 'checked',
  );
  const total = saved.reduce((s, l) => s + (l.actual ?? l.planned), 0);
  const p = partner.data;
  const partnerList =
    space.data?.salary_mode !== 'joint' && space.data?.couple_state === 'connected' && p
      ? lists.data.find((c) => c.owner_user_id === p.id)
      : undefined;
  const name = (id: string | null) => goals.data.find((g) => g.id === id)?.name ?? '';
  return (
    <QuestionLayout
      title={copy.doneTitle}
      primary={{ label: copy.ok }}
      onSubmit={() => nav('/', { replace: true })}
      center
    >
      <DoneMark />
      {total > 0 && (
        <InfoPlate
          title={copy.doneSaved(readWon(total))}
          rows={saved.map((l) => ({
            label: name(l.goal_id),
            value: readWon(l.actual ?? l.planned),
          }))}
        />
      )}
      {partnerList && p && (
        <button
          type="button"
          className="hg-btn hg-btn--link"
          onClick={() => nav(`/salary?who=${p.id}`)}
        >
          {copy.partnerProgress(
            p.nickname ?? '',
            partnerList.pay_check_line.length,
            doneCount(partnerList),
          )}
        </button>
      )}
    </QuestionLayout>
  );
}
