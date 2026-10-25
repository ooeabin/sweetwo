import { readWon } from '@sweetwo/core';
import { DoneMark, InfoPlate, QuestionLayout } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { myChecklist, useChecklists, useGoals, useMe } from '../data';

// W-02 끝 다 보냈어요(20, Q7): 큰 체크 + “이번 달 월급을 다 나눴어요” + 이번 달 목표에 모은 돈(목표별 줄) → 확인 → 홈
export function W02Done() {
  const nav = useNavigate();
  const me = useMe();
  const goals = useGoals();
  const lists = useChecklists();
  if (!me.data || !goals.data || !lists.data) return null;
  const list = myChecklist(lists.data, me.data.id);
  const saved = (list?.pay_check_line ?? []).filter(
    (l) => l.kind === 'saving' && l.state === 'checked',
  );
  const total = saved.reduce((s, l) => s + (l.actual ?? l.planned), 0);
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
    </QuestionLayout>
  );
}
