import type { PayCheckLine } from '@sweetwo/api';
import { QuestionLayout } from '@sweetwo/ui';
import { useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { CheckLine, goalLineName, lineName } from '../check-line';
import { copy } from '../copy';
import {
  myChecklist,
  useCheck,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
  waiting,
} from '../data';

// W-05 월말 확인(20). 다음 월급날 3일 전 ~ 전날, 체크 안 한 줄만. 체크하면 W-02와 같음,
// 줄마다 ‘이번 달은 못 했어요’ = 그 줄을 못 함으로 닫음(저금이면 목표에 더하지 않음). 확인 = 남은 줄은 그대로 닫힘.
export function W05Review() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const partner = usePartner();
  const lists = useChecklists();
  const check = useCheck();
  // 처음 열 때 체크 안 한 줄이 없으면 W-02로(24 캘린더 ‘월말 확인’, 홈·트레이도 같음)
  const empty = useRef<boolean | null>(null);
  if (!me.data || !space.data || !goals.data || !lists.data) return null;
  const list = myChecklist(lists.data, me.data.id);
  const meId = me.data.id;
  const personName = (id: string | null) =>
    id === meId ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? null);
  const joint = space.data.salary_mode === 'joint';
  const goalName = goalLineName(goals.data, personName, joint);
  const left = list ? waiting(list) : [];
  if (empty.current === null) empty.current = !!list && left.length === 0;
  if (empty.current) return <Navigate to="/salary" replace />;
  const skip = (l: PayCheckLine) => void check(l, 'skipped').catch(() => toast(copy.failed));
  return (
    <QuestionLayout
      title={list ? copy.reviewTitle(list.label) : copy.reviewNone}
      onBack={() => nav('/')}
      primary={{ label: copy.ok }}
      onSubmit={() => nav('/', { replace: true })}
    >
      {left.length ? (
        <div className="hg-checklist__list">
          {left.map((l) => (
            <CheckLine
              key={l.id}
              line={l}
              name={lineName(l, goalName, personName, joint)}
              personName={personName}
              meId={meId}
              onSkip={() => skip(l)}
            />
          ))}
        </div>
      ) : (
        <p className="hg-help">{copy.reviewNone}</p>
      )}
    </QuestionLayout>
  );
}
