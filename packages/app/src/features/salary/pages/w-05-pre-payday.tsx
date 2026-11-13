import type { PayChecklist, PayCheckLine } from '@sweetwo/api';
import { inReviewWindow, todayKst } from '@sweetwo/core';
import { QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { quietly, toast } from '../../../shared/toast';
import { CheckLine, checkToast, goalLineName, LineLead, lineName } from '../check-line';
import { copy } from '../copy';
import {
  myChecklist,
  useChangedLines,
  useCheck,
  useCheckRealtime,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
} from '../data';
import { savingPaths } from '../paths';
import { useSavingItems } from '../saving';
import { AchieveWatch } from '../saving-parts';
import { W02aOtherAmount } from './w-02a-other-amount';

/**
 * 어느 체크리스트를 볼지(2026-11-12 D3): `?checklist=id`(알림·홈 띠)면 그것만, 없으면(예전 알림 /salary/review) 지금 내 것.
 * 지금 사이클에 없으면(끝난 사이클) 'ended', 월급 전 확인 기간(다음 기준일 3일 전 ~ 전날)이 아니면 'outside'
 */
function pick(
  lists: PayChecklist[],
  meId: string,
  id: string | null,
  today: string,
): { list: PayChecklist } | { go: 'ended' | 'outside' | 'none' } {
  const list = id ? lists.find((c) => c.id === id) : myChecklist(lists, meId);
  if (!list) return { go: id ? 'ended' : 'none' };
  if (!inReviewWindow(today, list.cycle_end)) return { go: 'outside' };
  return { list };
}

// W-05 월급 전 확인(20, 2026-11-13 v2.2: 남은 손 줄만, 자동 줄은 나가는 날 앱이 확인해 여기 없음). 다음 월급날 3일 전 ~ 전날, 처음 열 때 체크 안 한 손 줄만(2026-11-12 D6: 체크한 줄은 체크 모양으로 남고
// 다시 누르면 풀림). 줄 시트는 W-02와 같고(‘보냈어요’, ‘다른 금액으로 보냈어요’, ‘저금 보기’) + ‘이번 달은 못 했어요’
// = 그 줄을 ‘못 함’으로 닫고 목록에서 뺌(저금이면 모은 금액에 더하지 않음). 확인 = 남은 줄은 그대로 닫힘.
// 기간 밖이거나 끝난 사이클이면 W-02(끝난 사이클은 그 지난 달, 읽기 전용). 상대 체크는 Realtime으로 바로 + 2초 강조(S6-06)
export function W05PrePayday() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const partner = usePartner();
  const lists = useChecklists();
  const saving = useSavingItems();
  const check = useCheck('w05');
  useCheckRealtime(space.data?.id);
  const [params] = useSearchParams();
  const loc = useLocation();
  const id = params.get('checklist');
  const today = todayKst();
  const ready = !!(me.data && lists.data);
  const picked = ready ? pick(lists.data ?? [], me.data?.id ?? '', id, today) : null;
  const list = picked && 'list' in picked ? picked.list : undefined;
  // 처음 열 때 체크 안 한 줄(이 줄들만 보임, 체크해도 남음). ‘못 함’으로 닫은 줄은 빠짐
  const first = useRef<string[] | null>(null);
  if (list && first.current === null)
    first.current = list.pay_check_line
      .filter((l) => l.state === 'wait' && !l.auto)
      .map((l) => l.id);
  const shown = (list?.pay_check_line ?? [])
    .filter((l) => first.current?.includes(l.id) && l.state !== 'skipped')
    .sort((a, b) => a.sort - b.sort);
  const changed = useChangedLines(list?.pay_check_line);
  // 열림 분석(32 month_check_viewed, 2026-11-11 QA 4구간 S4-08): 홈 할 일 띠는 ?from=home, 알림은 state.from
  const viewed = useRef(false);
  useEffect(() => {
    if (!list || viewed.current) return;
    viewed.current = true;
    const from = (loc.state as { from?: string } | null)?.from;
    track('month_check_viewed', {
      entry:
        params.get('from') === 'home' ? 'home' : from === 'notification' ? 'notification' : 'other',
      open_lines_count: first.current?.length ?? 0,
    });
  }, [list, params, loc.state]);

  // 못 불러오면 오류 + 다시 시도(13 공통 상태 7번, 2026-11-12 S6-08)
  const loads = [me, space, goals, lists];
  if (loads.some((q) => q.isError && !q.data))
    return (
      <QuestionLayout
        title={sharedCopy.errorTitle}
        help={sharedCopy.errorBody}
        onBack={() => nav('/')}
        primary={{ label: sharedCopy.retry }}
        onSubmit={() => {
          for (const q of loads) if (!q.data) void q.refetch();
        }}
      />
    );
  if (!me.data || !space.data || !goals.data || !lists.data || !picked)
    return <QuestionSkeleton onBack={() => nav('/')} fields={3} />;
  // 기간 밖·끝난 사이클·처음 열 때 체크 안 한 줄이 없음 → W-02(24 캘린더, 홈도 같음)
  if ('go' in picked)
    return (
      <Navigate
        to={picked.go === 'ended' && id ? `/salary?cycle=${encodeURIComponent(id)}` : '/salary'}
        replace
      />
    );
  if (!list || !first.current?.length) return <Navigate to="/salary" replace />;
  const meId = me.data.id;
  const personName = (x: string | null) =>
    x === meId ? (me.data?.nickname ?? '') : (partner.data?.nickname ?? null);
  const joint = space.data.salary_mode === 'joint';
  const goalName = goalLineName(goals.data, personName, joint);
  const nameOf = (l: PayCheckLine) => lineName(l, goalName, personName, joint);

  // W-02a 다른 금액(W-02와 같은 화면, 기록 상태 other, 2026-11-12 D6)
  const otherId = (loc.state as { other?: string } | null)?.other;
  const other = otherId
    ? list.pay_check_line.find((l) => l.id === otherId && l.state !== 'checked')
    : undefined;
  if (other)
    return (
      <W02aOtherAmount
        line={other}
        name={nameOf(other)}
        goalName={other.kind === 'saving' ? goalName(other.goal_id) : undefined}
        personName={personName}
        entry="w05"
        onClose={() => nav(-1)}
      />
    );

  // ‘이번 달은 못 했어요’: 줄이 목록에서 빠지니 Toast로 알리고 되돌리기(2026-11-03). 마지막 줄이면 “…체크를 마쳤어요”
  const skip = (l: PayCheckLine) =>
    void check(l, 'skipped')
      .then((res) =>
        checkToast(res, {
          line: l,
          name: nameOf(l),
          amount: '',
          to: 'skipped',
          personName,
          undo: () => quietly(check(l, 'wait', undefined, 'toast')),
        }),
      )
      .catch(() => toast(copy.failed));
  const itemOf = (gid: string | null) => (saving.ready && gid ? saving.byId(gid) : undefined);
  return (
    <QuestionLayout
      title={copy.reviewTitle(list.cycle_start)}
      onBack={() => nav('/')}
      primary={{ label: copy.ok }}
      onSubmit={() => nav('/', { replace: true })}
    >
      <AchieveWatch from="checklist" />
      {shown.length ? (
        <div className="hg-checklist__list">
          {shown.map((l) => (
            <CheckLine
              key={l.id}
              line={l}
              name={nameOf(l)}
              goalName={l.kind === 'saving' ? goalName(l.goal_id) : undefined}
              personName={personName}
              meId={meId}
              lead={<LineLead line={l} />}
              entry="w05"
              changed={changed.has(l.id)}
              onOther={() => nav(`${loc.pathname}${loc.search}`, { state: { other: l.id } })}
              onSkip={() => skip(l)}
              onItem={
                l.kind === 'saving' && l.goal_id && itemOf(l.goal_id)
                  ? () => nav(savingPaths.item(l.goal_id ?? ''))
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="hg-help">{copy.reviewNone}</p>
      )}
    </QuestionLayout>
  );
}
