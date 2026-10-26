import { fetchCareDays, qk } from '@sweetwo/api';
import {
  addDays,
  daysBetween,
  formatDateWeekday,
  nextCareDate,
  todayKst,
  type CareRule,
} from '@sweetwo/core';
import { Button } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { H06NetWorth, MainFrame, useNetWorth, useNoticeBand } from '../../month';
import {
  myChecklist,
  savedOf,
  salaryPaths,
  useChecklists,
  useGoalSaved,
  useSplits,
  waiting,
} from '../../salary';
import { copy } from '../copy';
import { useGoals, useMe, usePartner, useSpace } from '../data';
import { GoalsCard, SalaryCard, UpcomingCard, type UpcomingItem } from '../parts';

const INVITE_KEY = 'sweetwo:home:invite-closed'; // 초대 할 일 닫은 날(7일 동안 안 보임)
const readClosed = () => {
  try {
    return localStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
};

// 홈(19): 오늘 띠(인사 H-01 + ‘월급 체크하기’) → 할 일 한 줄(H-06) → 왼쪽 목표(H-02)·이번 달 월급(H-03),
// 오른쪽 우리 자산(H-04)·다가오는 일정(H-05). 좁은 창은 한 단. 배우자 활동은 알림 센터.
export function H01Home() {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const goals = useGoals();
  const lists = useChecklists();
  const splits = useSplits();
  const sums = useGoalSaved();
  const nw = useNetWorth(true);
  const cares = useQuery({ queryKey: qk.careDays, queryFn: fetchCareDays });
  const [inviteClosed, setInviteClosed] = useState(readClosed);
  // 공지 띠(AD-10): 필독이 먼저, 할 일 한 줄 위
  const notice = useNoticeBand();
  if (!me.data || !space.data || !goals.data || lists.isLoading) return null;

  const today = todayKst();
  const meId = me.data.id;
  const myName = me.data.nickname ?? '';
  const joined = space.data.couple_state === 'connected';
  const joint = space.data.salary_mode === 'joint';
  const list = myChecklist(lists.data, meId);
  const partnerList =
    !joint && joined ? lists.data?.find((c) => c.owner_user_id === partner.data?.id) : undefined;
  const left = list ? waiting(list).length : 0;
  const goalName = (id: string | null) => goals.data.find((g) => g.id === id)?.name ?? '';
  const personName = (id: string | null) =>
    id === meId ? myName : (partner.data?.nickname ?? null);
  const saved = (g: (typeof goals.data)[number]) => savedOf(g, sums.data);
  const split = splits.data?.find((x) => x.owner_user_id === (joint ? null : meId));
  const monthly = (g: { id: string }) =>
    split?.split_line.find((l) => l.kind === 'saving' && l.goal_id === g.id)?.amount ?? 0;

  // H-01 인사: 체크 안 한 줄이 있으면 남은 개수, 다 했으면 1순위 목표까지 몇 %
  const top =
    goals.data.find(
      (g) => g.template !== 'emergency' && g.owner_user_id === null && g.status === 'active',
    ) ?? goals.data.find((g) => g.template === 'emergency');
  const pct = top?.target_amount
    ? Math.min(Math.floor((saved(top) * 100) / top.target_amount), 100)
    : null;
  const title =
    left > 0
      ? copy.hiLeft(myName, left)
      : top && pct !== null
        ? copy.hiGoal(myName, top.name, pct)
        : copy.hi(myName);

  // H-06 할 일 한 줄(맨 앞 하나): 월말 확인 → 초대 → 목표 금액 정하기
  const reviewOpen = list && left > 0 && today >= addDays(list.cycle_end, -2);
  const noAmount = goals.data.find(
    (g) => g.template !== 'emergency' && g.status === 'active' && g.target_amount === null,
  );
  const inviteVisible =
    space.data.couple_state === 'not_joined' &&
    (!inviteClosed || daysBetween(inviteClosed, today) >= 7);
  const todo = reviewOpen
    ? { text: copy.todoReview(list.label, left), to: salaryPaths.review }
    : inviteVisible
      ? {
          text: copy.todoInvite,
          to: '/settings/couple',
          close: () => {
            try {
              localStorage.setItem(INVITE_KEY, today);
            } catch {
              /* 저장소를 못 쓰면 이번 실행에서만 닫음 */
            }
            setInviteClosed(today);
          },
        }
      : noAmount
        ? { text: copy.todoAmount(noAmount.name), to: `/goals/${noAmount.id}/edit/amount` }
        : null;
  const todoBand = todo ? (
    <div className="hg-banner hg-banner--info hg-body__banner" role="status">
      <span>{todo.text}</span>
      <Button variant="secondary" size="sm" onClick={() => nav(todo.to)}>
        {copy.open}
      </Button>
      {'close' in todo && todo.close && (
        <Button variant="ghost" size="sm" onClick={todo.close}>
          {copy.close}
        </Button>
      )}
    </div>
  ) : undefined;
  const banner =
    notice || todoBand ? (
      <>
        {notice}
        {todoBand}
      </>
    ) : undefined;

  // H-05 다가오는 일정
  const within = (d: string | null) =>
    !!d && daysBetween(today, d) >= 0 && daysBetween(today, d) <= 30;
  const items: UpcomingItem[] = [];
  if (list && within(addDays(list.cycle_end, 1)))
    items.push({
      key: 'payday',
      date: addDays(list.cycle_end, 1),
      label: copy.payday(myName),
      dday: daysBetween(today, addDays(list.cycle_end, 1)),
      to: salaryPaths.checklist,
    });
  if (list && left > 0 && within(addDays(list.cycle_end, -2)))
    items.push({
      key: 'review',
      date: addDays(list.cycle_end, -2),
      label: copy.review,
      dday: daysBetween(today, addDays(list.cycle_end, -2)),
      to: salaryPaths.review,
    });
  for (const c of cares.data ?? []) {
    const d = nextCareDate(c as unknown as CareRule, today);
    if (d && within(d))
      items.push({
        key: `care-${c.id}`,
        date: d,
        label: c.name,
        dday: daysBetween(today, d),
        to: '/calendar',
      });
  }
  for (const g of goals.data) {
    if (g.deadline && g.status === 'active' && within(g.deadline))
      items.push({
        key: `goal-${g.id}`,
        date: g.deadline,
        label: copy.deadline(g.name),
        dday: daysBetween(today, g.deadline),
        to: `/goals/${g.id}`,
      });
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const go = (to: string) => nav(to);
  const assets =
    nw && !nw.empty ? (
      <H06NetWorth n={nw} onOpen={() => nav('/assets')} />
    ) : (
      <section className="hg-card hg-card--fill hg-stack" aria-label={copy.assets}>
        <p className="hg-card__meta">{copy.assetsEmpty}</p>
        <button type="button" className="hg-btn hg-btn--link" onClick={() => nav('/assets/new')}>
          {copy.addAsset}
        </button>
      </section>
    );
  return (
    <MainFrame
      current="month"
      today={{
        date: formatDateWeekday(today),
        title,
        actions: (
          <>
            <Button variant="secondary" onClick={() => nav('/goals/new')}>
              {copy.add}
            </Button>
            {left > 0 && (
              <Button variant="primary" onClick={() => nav(salaryPaths.checklist)}>
                {copy.check}
              </Button>
            )}
          </>
        ),
      }}
      banner={banner}
      columns={[
        <div key="l" className="hg-stack" style={{ gap: 'var(--space-8)' }}>
          <GoalsCard
            goals={goals.data}
            savedOf={saved}
            monthly={monthly}
            list={list}
            personName={personName}
            meId={meId}
            go={go}
          />
          <SalaryCard
            list={list}
            partnerList={partnerList}
            partnerName={partner.data?.nickname ?? ''}
            goalName={goalName}
            personName={personName}
            meId={meId}
            joint={joint}
            go={go}
          />
        </div>,
        <div key="r" className="hg-stack" style={{ gap: 'var(--space-8)' }}>
          {assets}
          <UpcomingCard items={items.slice(0, 3)} go={go} />
        </div>,
      ]}
    />
  );
}
