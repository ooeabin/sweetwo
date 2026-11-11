import type { PayCheckLine } from '@sweetwo/api';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { quietly, toast } from '../../../shared/toast';
import { CheckLine, goalLineName, LineLead, lineName } from '../check-line';
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

// W-05 월급 전 확인(20). 다음 월급날 3일 전 ~ 전날, 체크 안 한 줄만. 체크하면 W-02와 같음,
// 줄마다 ‘이번 달은 못 했어요’ = 그 줄을 못 함으로 닫음(저금이면 모은 금액에 더하지 않음). 확인 = 남은 줄은 그대로 닫힘.
export function W05Review() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const partner = usePartner();
  const lists = useChecklists();
  const check = useCheck();
  // 처음 열 때 체크 안 한 줄이 없으면 W-02로(24 캘린더 ‘월급 전 확인’, 홈도 같음)
  const empty = useRef<boolean | null>(null);
  // 열림 분석(32 month_check_viewed, 2026-11-11 QA 4구간 S4-08): 홈 할 일 띠는 ?from=home, 알림은 state.from
  const [params] = useSearchParams();
  const loc = useLocation();
  const viewed = useRef(false);
  const ready = !!(me.data && lists.data);
  const openLines = ready ? (myChecklist(lists.data, me.data?.id)?.pay_check_line ?? []) : [];
  const openCount = openLines.filter((l) => l.state === 'wait').length;
  useEffect(() => {
    if (!ready || viewed.current) return;
    viewed.current = true;
    const from = (loc.state as { from?: string } | null)?.from;
    track('month_check_viewed', {
      entry:
        params.get('from') === 'home' ? 'home' : from === 'notification' ? 'notification' : 'other',
      open_lines_count: openCount,
    });
  }, [ready, openCount, params, loc.state]);
  if (!me.data || !space.data || !goals.data || !lists.data)
    return <QuestionSkeleton onBack={() => nav('/')} fields={3} />;
  const list = myChecklist(lists.data, me.data.id);
  const meId = me.data.id;
  const personName = (id: string | null) =>
    id === meId ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? null);
  const joint = space.data.salary_mode === 'joint';
  const goalName = goalLineName(goals.data, personName, joint);
  const left = list ? waiting(list) : [];
  if (empty.current === null) empty.current = !!list && left.length === 0;
  if (empty.current) return <Navigate to="/salary" replace />;
  // ‘이번 달은 못 했어요’: 줄이 목록에서 빠지니 Toast로 알리고 되돌리기(2026-11-03)
  const skip = (l: PayCheckLine) =>
    void check(l, 'skipped')
      .then(() =>
        toast(copy.skippedDone(lineName(l, goalName, personName, joint)), {
          label: copy.undo,
          onClick: () => quietly(check(l, 'wait')),
        }),
      )
      .catch(() => toast(copy.failed));
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
              lead={<LineLead line={l} />}
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
