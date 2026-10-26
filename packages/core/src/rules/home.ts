import { addDays, daysBetween } from '../date';
import { nextCareDate, type CareRule } from './care';

// 홈(19)과 트레이 위젯(26)이 같이 쓰는 계산: 할 일 한 줄(H-06), 다가오는 일정(H-05·WG-03), 이번 달 월급 상태(WG-01).
// 문구는 앱 copy가 만들고, 여기서는 종류와 값, 갈 화면만 정함.

export interface HomeChecklist {
  owner_user_id: string | null;
  label: string;
  cycle_end: string;
  lines: { state: string }[];
}
export interface HomeGoal {
  id: string;
  name: string;
  template: string;
  status: string;
  target_amount: number | null;
  deadline: string | null;
  owner_user_id: string | null;
}
export interface HomeCare extends CareRule {
  id: string;
  name: string;
}
export interface HomeAsset {
  id: string;
  name: string;
  side: string;
  kind: string;
  owner: string;
  owner_user_id: string | null;
  maturity_date: string | null;
}
export interface HomeInput {
  today: string;
  meId: string;
  /** 각자면 내 체크리스트, 합쳐서면 공동 체크리스트 */
  joint: boolean;
  coupleState: string;
  checklists: HomeChecklist[];
  goals: HomeGoal[];
  cares: HomeCare[];
  assets: HomeAsset[];
  /** 진행 중인 연결 해제 요청(받은 사람이면 할 일) */
  unlinkRequestedBy: string | null;
  /** 해제 뒤 다시 연결 요청(상대가 보냈고 아직 답 안 함) */
  reconnectFrom: string | null;
  /** 초대 할 일을 닫은 날(7일 동안 안 보임) */
  inviteClosedOn: string | null;
  /** 닫은 만기·챙길 날 할 일(‘matured:{id}:{날짜}’, ‘care:{id}:{날짜}’) */
  closed: string[];
}

export type HomeTodo =
  | { kind: 'unlink'; to: string }
  | { kind: 'reconnect'; to: string }
  | { kind: 'review'; label: string; left: number; to: string }
  | { kind: 'invite'; to: string }
  | { kind: 'amount'; goal: string; to: string }
  | { kind: 'matured'; asset: string; key: string; to: string }
  | { kind: 'care'; name: string; date: string; key: string; to: string };

export type HomeUpcoming = {
  key: string;
  kind: 'payday' | 'review' | 'care' | 'goal' | 'maturity';
  date: string;
  name: string;
  dday: number;
  to: string;
};

export type SalaryState =
  | { state: 'none' }
  | {
      state: 'progress' | 'review' | 'done';
      label: string;
      done: number;
      total: number;
      left: number;
      nextPayday: string;
    };

const PATHS = {
  review: '/salary/review',
  checklist: '/salary',
};

/** 내 이번 달 체크리스트(각자 = 내 것, 합쳐서 = 공동) */
export function myList(i: Pick<HomeInput, 'checklists' | 'meId' | 'joint'>) {
  return i.checklists.find((c) =>
    i.joint ? c.owner_user_id === null : c.owner_user_id === i.meId,
  );
}

/** 이번 달 월급 상태(WG-01, 홈 H-03): 진행 중 / 월말 확인 기간(다음 기준일 3일 전 ~, 체크 안 한 줄 있음) / 다 했어요 */
export function salaryState(
  i: Pick<HomeInput, 'checklists' | 'meId' | 'joint' | 'today'>,
): SalaryState {
  const c = myList(i);
  if (!c) return { state: 'none' };
  const total = c.lines.length;
  const left = c.lines.filter((l) => l.state === 'wait').length;
  const done = c.lines.filter((l) => l.state === 'checked').length;
  const nextPayday = addDays(c.cycle_end, 1);
  const state = left === 0 ? 'done' : i.today >= addDays(c.cycle_end, -2) ? 'review' : 'progress';
  return { state, label: c.label, done, total, left, nextPayday };
}

/** 할 일 한 줄(19 ‘할 일 한 줄 순서’, 맨 앞 하나) */
export function homeTodo(i: HomeInput): HomeTodo | null {
  if (i.unlinkRequestedBy && i.unlinkRequestedBy !== i.meId)
    return { kind: 'unlink', to: '/settings/couple/unlink/review' };
  if (i.reconnectFrom && i.reconnectFrom !== i.meId)
    return { kind: 'reconnect', to: '/settings/couple/reconnect' };
  const s = salaryState(i);
  if (s.state === 'review')
    return { kind: 'review', label: s.label, left: s.left, to: PATHS.review };
  if (
    i.coupleState === 'not_joined' &&
    (!i.inviteClosedOn || daysBetween(i.inviteClosedOn, i.today) >= 7)
  )
    return { kind: 'invite', to: '/settings/couple' };
  const noAmount =
    i.goals.find(
      (g) =>
        g.template !== 'emergency' &&
        g.status === 'active' &&
        g.target_amount === null &&
        !g.owner_user_id,
    ) ??
    i.goals.find(
      (g) =>
        g.template !== 'emergency' &&
        g.status === 'active' &&
        g.target_amount === null &&
        g.owner_user_id === i.meId,
    );
  if (noAmount)
    return { kind: 'amount', goal: noAmount.name, to: `/goals/${noAmount.id}/edit/amount` };
  const matured = i.assets.find(
    (a) =>
      a.side === 'asset' &&
      a.kind !== 'deposit_money' &&
      !!a.maturity_date &&
      a.maturity_date <= i.today &&
      (a.owner === 'joint' || a.owner_user_id === i.meId) &&
      !i.closed.includes(`matured:${a.id}:${a.maturity_date}`),
  );
  if (matured)
    return {
      kind: 'matured',
      asset: matured.name,
      key: `matured:${matured.id}:${matured.maturity_date ?? ''}`,
      to: `/assets/${matured.id}/matured`,
    };
  const care = i.cares
    .map((c) => ({ c, d: nextCareDate(c, i.today) }))
    .filter((x): x is { c: HomeCare; d: string } => {
      if (!x.d) return false;
      const n = daysBetween(i.today, x.d);
      return n >= 0 && n <= 7 && !i.closed.includes(`care:${x.c.id}:${x.d}`);
    })
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))[0];
  if (care)
    return {
      kind: 'care',
      name: care.c.name,
      date: care.d,
      key: `care:${care.c.id}:${care.d}`,
      to: `/calendar/day/${care.c.id}`,
    };
  return null;
}

/** 다가오는 일정(H-05 30일 안, WG-03 가까운 3개): 월급날, 월말 확인, 챙길 날, 목표 기한, 만기. 같은 날이면 챙길 날 먼저 */
export function homeUpcoming(i: HomeInput, days = 30): HomeUpcoming[] {
  const within = (d: string | null): d is string =>
    !!d && daysBetween(i.today, d) >= 0 && daysBetween(i.today, d) <= days;
  const out: HomeUpcoming[] = [];
  const add = (u: Omit<HomeUpcoming, 'dday'>) => out.push({ ...u, dday: daysBetween(i.today, u.date) });
  const s = salaryState(i);
  if (s.state !== 'none') {
    if (within(s.nextPayday))
      add({ key: 'payday', kind: 'payday', date: s.nextPayday, name: '', to: PATHS.checklist });
    const review = addDays(s.nextPayday, -3);
    if (s.left > 0 && within(review))
      add({ key: 'review', kind: 'review', date: review, name: '', to: PATHS.review });
  }
  for (const c of i.cares) {
    const d = nextCareDate(c, i.today);
    if (within(d))
      add({
        key: `care-${c.id}`,
        kind: 'care',
        date: d,
        name: c.name,
        to: `/calendar/day/${c.id}`,
      });
  }
  for (const g of i.goals)
    if (g.status === 'active' && within(g.deadline))
      add({
        key: `goal-${g.id}`,
        kind: 'goal',
        date: g.deadline,
        name: g.name,
        to: `/goals/${g.id}`,
      });
  for (const a of i.assets)
    if (a.side === 'asset' && within(a.maturity_date))
      add({
        key: `asset-${a.id}`,
        kind: 'maturity',
        date: a.maturity_date,
        name: a.name,
        to: `/assets/${a.id}`,
      });
  const rank = (k: HomeUpcoming['kind']) => (k === 'care' ? 0 : 1);
  return out.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : rank(a.kind) - rank(b.kind),
  );
}
