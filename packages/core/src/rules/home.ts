import { addDays, daysBetween } from '../date';

/** 만기 할 일 띠를 띄우는 날 수(만기일 = 0일째부터 30일째까지, 2026-11-11) */
export const MATURED_TODO_DAYS = 30;
import { nextCareDate, type CareRule } from './care';
import { deadlineDay } from './saving-item';

// 홈(19)이 쓰는 계산(위젯 26도 같은 규칙): 할 일 한 줄(H-06), 일정(H-05·WG-03), 이번 달 월급 상태(WG-01).
// 문구는 앱 copy가 만들고, 여기서는 종류와 값, 갈 화면만 정함.

export interface HomeChecklist {
  owner_user_id: string | null;
  label: string;
  /** 기간 첫날(= 월급날, 체크리스트가 생긴 날). 없으면 ‘월급날 체크’ 할 일 없음 */
  cycle_start?: string;
  cycle_end: string;
  lines: { state: string }[];
}
/** 저금 항목(예전 목표 행, ADR 0007) */
export interface HomeGoal {
  id: string;
  name: string;
  status: string;
  target_amount: number | null;
  deadline: string | null;
  owner_user_id: string | null;
  closed_at: string | null;
  deleted_at?: string | null;
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
  /** 온보딩을 마친 날(KST). 첫 주(7일 안) 할 일 ‘첫 저금 추가’에 씀(2026-11-09 round 3). 없으면 그 할 일 없음 */
  onboardedOn?: string | null;
}

export type HomeTodo =
  | { kind: 'unlink'; to: string }
  | { kind: 'reconnect'; to: string }
  | { kind: 'review'; label: string; left: number; key: string; to: string }
  | { kind: 'check'; label: string; left: number; key: string; to: string }
  | { kind: 'invite'; to: string }
  | { kind: 'saving'; key: string; to: string }
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

/** 이번 달 월급 상태(WG-01, 홈 H-03): 진행 중 / 월급 전 확인 기간(다음 기준일 3일 전 ~, 체크 안 한 줄 있음) / 다 했어요 */
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

export const SAVING_TODO_KEY = 'saving-first';
/** 월급날 체크 할 일이 보이는 날 수(월급날 포함, 19 H-06 3a, 2026-11-09) */
export const CHECK_TODO_DAYS = 7;

/**
 * 월급날 체크 할 일(19 H-06 3a, 2026-11-09 홈 허브): 내(합쳐서면 공동) 이번 달 체크리스트에 체크 안 한 줄이 있고
 * 오늘이 월급날(기간 첫날)부터 7일 안. 닫기 없음(2026-11-11): 다 체크하거나 7일이 지나면 사라짐.
 * 그 뒤 체크는 홈 큰 상자 → W-02, 월급 전 확인(W-05)
 */
export function checkTodo(i: HomeInput): Extract<HomeTodo, { kind: 'check' }> | null {
  const c = myList(i);
  if (!c?.cycle_start) return null;
  const left = c.lines.filter((l) => l.state === 'wait').length;
  const d = daysBetween(c.cycle_start, i.today);
  const key = `check:${c.label}:${c.cycle_start}`;
  if (!left || d < 0 || d >= CHECK_TODO_DAYS) return null;
  return { kind: 'check', label: c.label, left, key, to: PATHS.checklist };
}

/**
 * 첫 저금 추가 할 일(19 H-06 4b): 온보딩을 마친 날부터 7일 안 + 내 월급 계획(이번 달 체크리스트)이 있고 연결 해제 대기가 아님
 * + 내 저금이 없음(각자 = 내가 주인인 저금, 합쳐서 = 공동 저금. 그만 모은 것·휴지통 빼고). 닫기 없음(2026-11-11)
 */
export function firstSavingTodo(i: HomeInput): boolean {
  if (!i.onboardedOn) return false;
  const d = daysBetween(i.onboardedOn, i.today);
  if (d < 0 || d >= 7) return false;
  if (!myList(i) || i.coupleState === 'unlink_pending') return false;
  return !i.goals.some(
    (g) => !g.deleted_at && !g.closed_at && (i.joint || g.owner_user_id === i.meId),
  );
}

/**
 * 할 일 한 줄(19 ‘할 일 한 줄 순서’, 맨 앞 하나): 해제 요청 → 다시 연결 → 월급 전 확인 → 월급날 체크 → 첫 저금 → 만기 → 경조사 → 초대.
 * 2026-11-11 띠 닫기(✕)를 없앰: 할 일은 끝내거나 그 기간이 지나야 사라짐. 그래서 닫을 수 없는 초대는 맨 끝(다른 할 일을 막지 않게)
 */
export function homeTodo(i: HomeInput): HomeTodo | null {
  if (i.unlinkRequestedBy && i.unlinkRequestedBy !== i.meId)
    return { kind: 'unlink', to: '/settings/couple/unlink/review' };
  if (i.reconnectFrom && i.reconnectFrom !== i.meId)
    return { kind: 'reconnect', to: '/settings/couple/reconnect' };
  const s = salaryState(i);
  if (s.state === 'review')
    return {
      kind: 'review',
      label: s.label,
      left: s.left,
      key: `review:${s.label}:${s.nextPayday}`,
      to: PATHS.review,
    };
  // 월급날 체크(2026-11-09, 월급 전 확인 다음): 월급날부터 7일 안, 체크 안 한 줄이 있을 때
  const check = checkTodo(i);
  if (check) return check;
  // 첫 주 ‘첫 저금 추가’(2026-11-09 round 3): 온보딩 뒤 7일 안, 내 저금이 없을 때(월급 탭 ‘첫 저금’과 같은 조건)
  if (firstSavingTodo(i))
    return { kind: 'saving', key: SAVING_TODO_KEY, to: '/salary/items/new/a?from=home' };
  // 2026-11-08 ‘목표 금액 정하기’ 할 일은 없앰(ADR 0007, 대신 홈 H-02 저금 항목 제안 줄)
  // 만기 띠는 만기일부터 30일 안만(2026-11-11 사용자 결정). 그 뒤에도 자산 관리 그 항목에는 ‘만기됨’이 남음
  const matured = i.assets.find(
    (a) =>
      a.side === 'asset' &&
      a.kind !== 'deposit_money' &&
      !!a.maturity_date &&
      a.maturity_date <= i.today &&
      daysBetween(a.maturity_date, i.today) <= MATURED_TODO_DAYS &&
      (a.owner === 'joint' || a.owner_user_id === i.meId),
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
      return n >= 0 && n <= 7;
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
  // 파트너 초대(2026-11-11 맨 끝): 다른 할 일이 없을 때만, 파트너가 합류할 때까지
  // 2026-11-11 D6: S-12에서 코드를 바로 만들어 보여 줌(?invite=1)
  if (i.coupleState === 'not_joined') return { kind: 'invite', to: '/settings/couple?invite=1' };
  return null;
}

/** 일정(H-05 30일 안, WG-03 가까운 3개): 월급날, 월급 전 확인, 경조사, 저금 항목 목표 기한, 만기. 같은 날이면 경조사 먼저 */
export function homeUpcoming(i: HomeInput, days = 30): HomeUpcoming[] {
  const within = (d: string | null): d is string =>
    !!d && daysBetween(i.today, d) >= 0 && daysBetween(i.today, d) <= days;
  const out: HomeUpcoming[] = [];
  const add = (u: Omit<HomeUpcoming, 'dday'>) =>
    out.push({ ...u, dday: daysBetween(i.today, u.date) });
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
  // 목표 기한: 목표 금액과 기한이 있는, 모으는 중인 저금 항목만(24, ADR 0007). 기한 = 그 달 말일(2026-11-09)
  for (const g of i.goals) {
    const due = g.deadline ? deadlineDay(g.deadline) : null;
    if (g.status === 'active' && !g.closed_at && g.target_amount !== null && within(due))
      add({
        key: `goal-${g.id}`,
        kind: 'goal',
        date: due,
        name: g.name,
        to: `/salary/items/${g.id}`,
      });
  }
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
