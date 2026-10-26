import { fetchUnlinkPartnerName, qk } from '@sweetwo/api';
import { formatDateWeekday, homeTodo, homeUpcoming, todayKst } from '@sweetwo/core';
import { Button } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  H06NetWorth,
  MainFrame,
  todoText,
  upcomingName,
  useHomeInput,
  useNetWorth,
  useNoticeBand,
} from '../../frame';
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
  // 할 일 한 줄·다가오는 일정은 트레이 위젯과 같은 계산(core homeTodo·homeUpcoming)
  const h = useHomeInput();
  const solo = space.data?.couple_state === 'solo';
  const exName = useQuery({
    queryKey: qk.unlinkPartner,
    queryFn: fetchUnlinkPartnerName,
    enabled: solo && !!h.input?.reconnectFrom,
  });
  // 공지 띠(AD-10): 필독이 먼저, 할 일 한 줄 위
  const notice = useNoticeBand();
  if (!me.data || !space.data || !goals.data || lists.isLoading) return null;

  // 연결 해제 확정 뒤 처음 열면 해제 안내(25 S-12h)
  if (me.data.onboarding_step === 'S-12H')
    return <Navigate to="/settings/couple/unlinked" replace />;
  // 합류했는데 시작한 사람이 아직 온보딩 중(18 ‘시작한 사람이 아직 온보딩 중’): 분배표가 생기면 P-04 → P-06, 그 전엔 홈 대기(상태 변형 4)
  if (me.data.onboarding_step === 'P-WAIT') {
    if (splits.isLoading) return null;
    if (splits.data?.length) return <Navigate to="/join/p-04" replace />;
    const starter = partner.data?.nickname ?? space.data.partner_nickname ?? '';
    return (
      <MainFrame
        current="month"
        columns={[
          <section key="w" className="hg-card hg-stack" aria-label={copy.waitTitle(starter)}>
            <b>{copy.waitTitle(starter)}</b>
            <span className="hg-card__meta">{copy.waitCard(starter)}</span>
          </section>,
        ]}
      />
    );
  }

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

  // H-06 할 일 한 줄(맨 앞 하나, 19 ‘할 일 한 줄 순서’). 초대는 7일, 만기·챙길 날은 그 항목·날짜만 닫힘
  const t = h.input ? homeTodo(h.input) : null;
  const todo = t
    ? {
        text: todoText(t, { partner: partner.data?.nickname ?? '', exPartner: exName.data ?? '' }),
        to: t.to,
        close:
          t.kind === 'invite'
            ? h.closeInvite
            : t.kind === 'matured' || t.kind === 'care'
              ? () => h.closeTodo(t.key)
              : undefined,
      }
    : null;
  const todoBand = todo ? (
    <div className="hg-banner hg-banner--info hg-body__banner" role="status">
      <span>{todo.text}</span>
      <Button variant="secondary" size="sm" onClick={() => nav(todo.to)}>
        {copy.open}
      </Button>
      {todo.close && (
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

  // H-05 다가오는 일정(30일 안, 날짜순 최대 3개)
  const items: UpcomingItem[] = (h.input ? homeUpcoming(h.input) : []).map((u) => ({
    key: u.key,
    date: u.date,
    label: upcomingName(u, myName),
    dday: u.dday,
    to: u.to,
  }));

  const go = (to: string) => nav(to);
  const assetsCard =
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
          {assetsCard}
          <UpcomingCard items={items.slice(0, 3)} go={go} />
        </div>,
      ]}
    />
  );
}
