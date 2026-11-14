import { addDays, daysBetween } from '../date';
import { nextCareDate, type CareRule } from './care';
import { deadlineDay } from './saving-item';
import { inReviewWindow } from './review-window';
import type { BaseDay } from '../onboarding/cycle';
import { periodDisplay, periodFillPct, periodFull, type MoneyInPeriod } from './money-in-period';
import {
  canLateCheck,
  confirmFinish,
  isManual,
  manualCount,
  manualLeft,
  nextAutoDue,
  reviewDue,
  type ConfirmLine,
} from './pay-confirm';
import type { BundleView } from './saving-bundle';
import { salaryChangedTaskOpen } from './salary-change';
import { nextSavingTaskOpen, type NextSavingGoal } from './next-saving';

// 홈(19)이 쓰는 계산(위젯 26도 같은 규칙): 할 일 한 줄(H-06), 일정(WG-03, 캘린더 타일 H-08), 이번 달 월급 상태(H-03, WG-01),
// 내 체크리스트 고르기(홈·월급 탭이 같이 씀), 맨 위 띠 하나 고르기(2026-11-11 QA 4구간 D3).
// 문구는 앱 copy가 만들고, 여기서는 종류와 값, 갈 화면만 정함.

/** 만기 할 일 띠를 띄우는 날 수(만기일 = 0일째부터 30일째까지, 2026-11-11) */
export const MATURED_TODO_DAYS = 30;

export interface HomeChecklist {
  /** 체크리스트 id(월급 전 확인 할 일 링크 `?checklist=`, 2026-11-12 D3). 없으면 링크에 넣지 않음 */
  id?: string;
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

/**
 * 내 이번 달 체크리스트(홈 H-03·H-06, 월급 탭 W-02·W-05, 설정 S-11f가 모두 이것 하나로, 2026-11-11 QA 4구간 S4-12):
 * 내가 주인인 것(각자) → 없으면 공동(합쳐서). 월급 관리 방식을 바꿔도 이번 달 체크리스트는 그대로라(25 S-11f)
 * 지금 방식이 아니라 이번 사이클에 실제로 있는 체크리스트로 고름. meId가 없으면 공동만
 */
export function pickMyChecklist<T extends { owner_user_id: string | null }>(
  lists: readonly T[] | undefined,
  meId: string | null | undefined,
): T | undefined {
  if (!lists) return undefined;
  return (
    (meId ? lists.find((c) => c.owner_user_id === meId) : undefined) ??
    lists.find((c) => c.owner_user_id === null)
  );
}

/** 내 이번 달 체크리스트(pickMyChecklist) */
export function myList(i: Pick<HomeInput, 'checklists' | 'meId'>) {
  return pickMyChecklist(i.checklists, i.meId);
}

/** 맨 위 띠 종류(19 홈 상태 변형, 13 공통 상태 9번) */
export type TopBanner = 'offline' | 'unlink' | 'must_notice' | 'mail_bounced' | 'notice';
/** 맨 위 띠 순서(앞이 먼저, 2026-11-11 QA 4구간 D3) */
export const TOP_BANNER_ORDER: readonly TopBanner[] = [
  'offline',
  'unlink',
  'must_notice',
  'mail_bounced',
  'notice',
];

/**
 * 본문 맨 위 띠는 하나만(2026-11-11 QA 4구간 D3, Banner ‘화면당 1개’): 오프라인 > 연결 해제 대기 > 필독 공지 > 알림 메일 반송 > 일반 공지.
 * 지금 해당하는 띠 종류를 받아 하나를 고름. 없으면 null. 할 일·초대 띠(H-06)는 큰 상자 아래라 따로
 */
export function pickTopBanner(on: Partial<Record<TopBanner, boolean>>): TopBanner | null {
  return TOP_BANNER_ORDER.find((k) => on[k]) ?? null;
}

export { inReviewWindow };

/** 월급 전 확인(W-05) 주소: 그 체크리스트만(2026-11-12 D3) */
export const reviewPath = (checklistId?: string | null) =>
  checklistId ? `${PATHS.review}?checklist=${encodeURIComponent(checklistId)}` : PATHS.review;

/** 이번 달 월급 상태(WG-01, 홈 H-03): 진행 중 / 월급 전 확인 기간(다음 기준일 3일 전 ~, 체크 안 한 줄 있음) / 다 했어요 */
export function salaryState(i: Pick<HomeInput, 'checklists' | 'meId' | 'today'>): SalaryState {
  const c = myList(i);
  if (!c) return { state: 'none' };
  const total = c.lines.length;
  const left = c.lines.filter((l) => l.state === 'wait').length;
  const done = c.lines.filter((l) => l.state === 'checked').length;
  const nextPayday = addDays(c.cycle_end, 1);
  const state = left === 0 ? 'done' : inReviewWindow(i.today, c.cycle_end) ? 'review' : 'progress';
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
      to: reviewPath(myList(i)?.id),
    };
  // 월급날 체크(2026-11-09, 월급 전 확인 다음): 월급날부터 7일 안, 체크 안 한 줄이 있을 때
  const check = checkTodo(i);
  if (check) return check;
  // 첫 주 ‘첫 저금 추가’(2026-11-09 round 3): 온보딩 뒤 7일 안, 내 저금이 없을 때(월급 탭 ‘첫 저금’과 같은 조건)
  if (firstSavingTodo(i))
    return { kind: 'saving', key: SAVING_TODO_KEY, to: '/salary/items/new/a?from=home' };
  // 2026-11-08 ‘목표 금액 정하기’ 할 일은 없앰(ADR 0007, 첫 저금은 위 ‘첫 저금 추가’와 W-02 첫 저금 빈 줄)
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

/** 일정(캘린더 타일 H-08 가장 가까운 경조사, WG-03 가까운 3개. 예전 H-05 일정 카드는 2026-11-09 없앰): 월급날, 월급 전 확인, 경조사, 저금 항목 목표 기한, 만기. 같은 날이면 경조사 먼저 */
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

// ─────────────────────────── 홈 v2.2 (docs/spec/19 ‘홈 v2.2’, ADR 0009 결정 1) ───────────────────────────
// H-10 대표 저금 pickHero, H-11 이번 달 한 줄 pickMonthLine, H-06 할 일 띠 16순서 pickTopTask.
// 예전 homeTodo·salaryState·checkTodo·firstSavingTodo는 v2.2 홈 화면 PR(PR 9)이 바꿀 때까지 남김.

export interface HeroGoal {
  id: string;
  name: string;
  status: string;
  closed_at: string | null;
  deleted_at?: string | null;
  owner_user_id: string | null;
  bundle_id?: string | null;
  target_amount: number | null;
  deadline: string | null;
  saved: number;
}

export type HeroItem = { kind: 'bundle'; bundle: BundleView } | { kind: 'goal'; goal: HeroGoal };

/** H-10 가로 넘김 최대 칸 수(+ ‘저금 모두 보기’) */
export const HERO_MAX = 3;

const goalPct = (g: HeroGoal) =>
  g.target_amount && g.target_amount > 0 ? (Math.max(g.saved, 0) * 10_000) / g.target_amount : 0;
/** 목표 금액에 가장 가까운 것 먼저(진행률 큰 순, 같으면 남은 금액 적은 순, 그다음 이름) */
const closest = (a: HeroGoal, b: HeroGoal) =>
  goalPct(b) - goalPct(a) ||
  (a.target_amount ?? 0) - a.saved - ((b.target_amount ?? 0) - b.saved) ||
  a.name.localeCompare(b.name);

/**
 * 대표 저금 순서(19 H-10 ‘pickHero’ [확인 필요]): 묶음(달성 전) → 같이 계열 공동 저금 중 목표 금액에 가장 가까운 것
 * → 내 저금 중 가장 가까운 것 → 목표 금액 없는 저금 중 모은 금액이 가장 큰 것. 모으는 중(닫히지 않고 달성 전)만,
 * 묶음에 든 저금은 묶음으로만. 각자 계열에서 상대 개인 저금은 대표가 되지 않음. 최대 HERO_MAX개
 */
export function pickHeroes(
  i: { meId: string; joint: boolean; goals: readonly HeroGoal[]; bundles: readonly BundleView[] },
  max = HERO_MAX,
): HeroItem[] {
  const live = i.goals.filter(
    (g) => !g.deleted_at && !g.closed_at && g.status !== 'achieved' && !g.bundle_id,
  );
  const mineOrShared = live.filter(
    (g) => i.joint || g.owner_user_id === i.meId || g.owner_user_id === null,
  );
  const withTarget = mineOrShared.filter((g) => g.target_amount !== null && g.target_amount > 0);
  const shared = withTarget.filter((g) => i.joint || g.owner_user_id === null).sort(closest);
  const mine = withTarget.filter((g) => !shared.includes(g)).sort(closest);
  const rest = mineOrShared
    .filter((g) => !withTarget.includes(g))
    .sort((a, b) => b.saved - a.saved || a.name.localeCompare(b.name));
  return [
    ...i.bundles
      .filter((b) => b.status === 'active')
      .map((b) => ({ kind: 'bundle' as const, bundle: b })),
    ...[...shared, ...mine, ...rest].map((g) => ({ kind: 'goal' as const, goal: g })),
  ].slice(0, max);
}

/** 대표 저금 하나(위젯 WG-01, 진행 소식도 같은 순서). 없으면 null */
export const pickHero = (i: Parameters<typeof pickHeroes>[0]): HeroItem | null =>
  pickHeroes(i, 1)[0] ?? null;

export interface MonthChecklist {
  id: string;
  cycle_start: string;
  cycle_end: string;
  lines: ConfirmLine[];
}

export interface MonthLineInput {
  today: string;
  /** 확인 목록을 못 불러옴(공통 상태 7번) */
  error?: boolean;
  /** 월급 없음(‘지금은 월급이 없어요’) */
  noSalary: boolean;
  /** 날짜 없음(O-32, payday_none): H-13 기간 */
  paydayNone: boolean;
  /** 한 사람 관리형의 관리하지 않는 쪽 */
  nonManager: boolean;
  /** 날짜 없는 사람의 기간(moneyInPeriod) */
  period?: MoneyInPeriod | null;
  /** 내 이번 사이클 확인 목록(pickMyChecklist) */
  current?: MonthChecklist | null;
  /** 내 지난 사이클 확인 목록(늦은 확인) */
  previous?: MonthChecklist | null;
  /** 기준일(늦은 확인 마지막 날 계산) */
  base: BaseDay | null;
  /** 아직 확인 목록이 없을 때 첫 월급날(firstChecklistStart) */
  firstPayday?: string | null;
  /** 월급날 앞당기기(07 1장, 앱 useShownPayday). 늦은 확인 마지막 날 계산에 씀 */
  shift?: (d: string) => string;
}

export type HomeMonthLine =
  | { kind: 'error' }
  | { kind: 'no_salary'; to: string }
  | {
      kind: 'period';
      display: MoneyInPeriod['status'];
      period: MoneyInPeriod;
      fillPct: number | null;
      full: boolean;
      to: string;
    }
  | { kind: 'non_manager'; to: string }
  | { kind: 'first'; date: string | null; to: string }
  | { kind: 'review'; cycleStart: string; left: number; late: number; to: string }
  | { kind: 'payday'; cycleStart: string; left: number; late: number; to: string }
  /** 월급날이 지났고 월급 전 확인 기간 전, 손 줄이 남음(“10월 25일 월급에서 확인할 게 n개 남았어요” → W-02) */
  | { kind: 'left'; cycleStart: string; left: number; late: number; to: string }
  | {
      kind: 'auto_only';
      cycleStart: string;
      next: { date: string; count: number } | null;
      late: number;
      to: string;
    }
  | {
      kind: 'done';
      cycleStart: string;
      finish: 'all' | 'mixed';
      nextPayday: string;
      daysLeft: number;
      late: number;
      to: string;
    };

/** 지난 달 늦게 확인할 수 있는 손 줄 수(07 4장): 사이클이 끝났고 늦은 확인 기간 안, 건너뜀으로 닫힌 손 줄 */
export function lateLeft(
  prev: MonthChecklist | null | undefined,
  today: string,
  base: BaseDay | null,
  shift?: (d: string) => string,
) {
  if (!prev || !canLateCheck(today, prev.cycle_end, base, shift)) return 0;
  return prev.lines.filter((l) => isManual(l) && l.state === 'skipped').length;
}

const SALARY_PATHS = {
  checklist: '/salary',
  last: '/salary?cycle=last',
  plan: '/salary?view=plan',
  moneyIn: '/salary/money-in',
  salary: '/settings/me/salary',
};

/**
 * H-11 이번 달 한 줄(19 ‘H-11 상태’): 못 불러옴 → 월급 없음 → 날짜 없음(H-13 기간) → 관리하지 않는 쪽 →
 * 첫 월급날 전 → 월급 전 확인(손 줄 남음) → 월급날 당일(손 줄 남음) → 월급날 뒤(손 줄 남음) → 자동 줄뿐 → 지난 달 끝.
 * 손 줄 수(left)는 내가 확인을 맡은 줄만 셀 수 있게 앱이 lines를 걸러 넘김(한 사람 관리형, lineIsMine).
 * 늦은 확인 수(late)는 모든 확인 목록 상태에 붙고, 있으면 이동이 지난 달
 */
export function pickMonthLine(i: MonthLineInput): HomeMonthLine {
  if (i.error) return { kind: 'error' };
  if (i.noSalary) return { kind: 'no_salary', to: SALARY_PATHS.salary };
  if (i.paydayNone) {
    const period: MoneyInPeriod = i.period ?? {
      status: 'none',
      start: null,
      end: null,
      day: null,
      received: 0,
      needed: null,
      gapDays: null,
    };
    return {
      kind: 'period',
      display: periodDisplay(period),
      period,
      fillPct: period.status === 'bar' ? periodFillPct(period.received, period.needed) : null,
      full: periodFull(period),
      to: SALARY_PATHS.moneyIn,
    };
  }
  if (i.nonManager) return { kind: 'non_manager', to: SALARY_PATHS.checklist };
  const c = i.current;
  if (!c) return { kind: 'first', date: i.firstPayday ?? null, to: SALARY_PATHS.plan };
  const late = lateLeft(i.previous, i.today, i.base, i.shift);
  const left = manualLeft(c.lines);
  if (reviewDue(i.today, c.cycle_end, c.lines))
    return { kind: 'review', cycleStart: c.cycle_start, left, late, to: reviewPath(c.id) };
  // “월급날이에요”는 월급날(사이클 첫날) 하루만. 다음 날부터는 날짜를 넣은 문장(2026-11-13 UX B M2)
  if (left > 0)
    return {
      kind: i.today <= c.cycle_start ? 'payday' : 'left',
      cycleStart: c.cycle_start,
      left,
      late,
      to: SALARY_PATHS.checklist,
    };
  const lateTo = late > 0 ? SALARY_PATHS.last : SALARY_PATHS.checklist;
  if (manualCount(c.lines) === 0)
    return {
      kind: 'auto_only',
      cycleStart: c.cycle_start,
      next: nextAutoDue(c.lines),
      late,
      to: lateTo,
    };
  const nextPayday = addDays(c.cycle_end, 1);
  return {
    kind: 'done',
    cycleStart: c.cycle_start,
    finish: confirmFinish(c.lines) ?? 'all',
    nextPayday,
    daysLeft: daysBetween(i.today, nextPayday),
    late,
    to: lateTo,
  };
}

/** 잔액 맞추기 주기와 띠 날 수(H-06 12번, G7) */
export const RECONCILE_EVERY_DAYS = 90;
export const RECONCILE_TASK_DAYS = 14;

/**
 * 잔액 맞추기 띠(H-06 12번): 저금이 있고 마지막 맞추기(없으면 첫 저금 만든 날)부터 90일마다, 그날부터 14일 동안.
 * 열려 있으면 그 회차 띠 키(`reconcile:YYYY-MM-DD`, 닫으면 dismiss_home_task)와 날짜, 아니면 null
 */
export function reconcileTask(o: {
  today: string;
  hasSaving: boolean;
  /** 마지막 잔액 맞추기 날(KST) */
  lastReconciledOn: string | null;
  /** 첫 저금 만든 날(KST) */
  firstSavingOn: string | null;
}): { key: string; due: string } | null {
  const base = o.lastReconciledOn ?? o.firstSavingOn;
  if (!o.hasSaving || !base) return null;
  const d = daysBetween(base, o.today);
  if (d < RECONCILE_EVERY_DAYS) return null;
  const k = Math.floor(d / RECONCILE_EVERY_DAYS);
  const due = addDays(base, k * RECONCILE_EVERY_DAYS);
  if (daysBetween(due, o.today) >= RECONCILE_TASK_DAYS) return null;
  return { key: `reconcile:${due}`, due };
}

/** 첫 저금·생활비 나누기 띠가 뜨는 날 수(H-06 7·8번, 온보딩 끝부터) */
export const FIRST_TASK_DAYS = 30;
/** 요청 띠(3·4·5번)와 파트너 저금 띠(13번)가 뜨는 날 수 */
export const REQUEST_TASK_DAYS = 7;
/** 홈 할 일 띠 키(home_task_state.task_key) */
export const TASK_KEYS = { splitSuggest: 'split_suggest', autoPick: 'auto_pick' } as const;

interface OpenRequest {
  id: string;
  from: string;
  status: string;
  expires_at: string;
}

export interface TopTaskInput {
  today: string;
  /** 지금 시각 ISO(요청 만료 비교). 없으면 만료일(KST 날짜)만 비교 */
  now?: string;
  meId: string;
  coupleState: string;
  joint: boolean;
  unlinkRequestedBy: string | null;
  reconnectFrom: string | null;
  /** 관리 형태 요청(mode_change_request, from = from_user) */
  modeRequest?: (OpenRequest & { phrase: string }) | null;
  /** 분담 제안(shared_account, from = proposed_by) */
  splitProposal?: (OpenRequest & { name: string }) | null;
  /** 순위 같이 보기 요청(rank_consent_request) */
  rankRequest?: OpenRequest | null;
  /** 월급이 바뀐 사이클 시작일(내 salary_change 마지막 적용·되돌림의 적용일)과 W-01을 열었나 */
  salaryChanged?: { appliedDay: string | null; done: boolean } | null;
  /** 온보딩을 마친 날(KST) */
  onboardedOn?: string | null;
  /** 내가 볼 수 있는 모으는 중 저금(각자 = 내 것과 묶음, 합쳐서 = 공동) 개수 */
  savingCount: number;
  /** 생활비 ‘네’(couple_space.shared_living) */
  sharedLiving?: boolean | null;
  /** 정한(accepted) 분담이 있음 */
  hasSplit?: boolean;
  /** 닫았거나 끝낸 띠 키(home_task_state) */
  closedKeys?: readonly string[];
  /** 자동 줄 고르기 띠(autoPickTaskOpen 결과) */
  autoPickOpen?: boolean;
  /** 알림 다시 묻기(O-55를 거절했고 아직 다시 묻지 않음) */
  pushReask?: boolean;
  paydayNone?: boolean;
  /** 다음 저금 띠 후보(기한이 있는 내 저금·공동 저금) */
  deadlineGoals?: readonly (NextSavingGoal & { id: string; name: string })[];
  /** 잔액 맞추기(reconcileTask 결과) */
  reconcile?: { key: string; due: string } | null;
  /** 상대 개인 저금(각자 계열, 묶음에 안 든 것) */
  partnerGoals?: readonly {
    id: string;
    name: string;
    created_at: string;
    bundle_id: string | null;
  }[];
  /** 만기(예전 homeTodo와 같은 입력), 경조사, 쓸 곳 메모 */
  assets?: readonly HomeAsset[];
  cares?: readonly HomeCare[];
  notes?: readonly {
    id: string;
    name: string;
    due_on: string | null;
    paid: boolean;
    goal_id: string | null;
    bundle_id: string | null;
  }[];
  /** 기다리는 합류자(같이 계열 합류자가 시작한 사람을 기다림, 시작한 사람 쪽) */
  waitingJoiner?: { name: string | null } | null;
}

export type TopTask =
  | { kind: 'unlink'; key: string; to: string }
  | { kind: 'reconnect'; key: string; to: string }
  | { kind: 'mode_request'; id: string; phrase: string; key: string; to: string }
  | { kind: 'split_request'; id: string; name: string; key: string; to: string }
  | { kind: 'rank_request'; id: string; key: string; to: string }
  | { kind: 'salary_changed'; key: string; to: string }
  | { kind: 'first_saving'; key: string; to: string }
  | { kind: 'split_suggest'; key: string; to: string }
  | { kind: 'auto_pick'; key: string; to: string }
  | { kind: 'push_reask'; paydayNone: boolean; key: string; to: null }
  | { kind: 'next_saving'; goalId: string; name: string; key: string; to: string }
  | { kind: 'reconcile'; key: string; to: string }
  | { kind: 'bundle_invite'; goalId: string; name: string; key: string; to: string }
  | { kind: 'matured'; asset: string; key: string; to: string }
  | { kind: 'care'; name: string; date: string; key: string; to: string }
  | { kind: 'note'; name: string; date: string; key: string; to: string }
  | { kind: 'invite'; key: string; to: string }
  | { kind: 'waiting_joiner'; name: string | null; key: string; to: string };

const openReq = (r: OpenRequest | null | undefined, i: TopTaskInput): r is OpenRequest => {
  if (!r || r.status !== 'open' || r.from === i.meId) return false;
  if (i.now) return Date.parse(r.expires_at) > Date.parse(i.now);
  return r.expires_at.slice(0, 10) >= i.today;
};

/** 할 일 띠에서 고를 수 있는 날짜 할 일(14번): 만기(만기일부터 30일, 예전 규칙) → 경조사·쓸 곳 메모(7일 안, 이른 순) */
function datedTask(i: TopTaskInput): TopTask | null {
  const matured = (i.assets ?? []).find(
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
  const soon = (d: string | null | undefined): d is string =>
    !!d && daysBetween(i.today, d) >= 0 && daysBetween(i.today, d) <= 7;
  const dated: { date: string; t: TopTask }[] = [];
  for (const c of i.cares ?? []) {
    const d = nextCareDate(c, i.today);
    if (soon(d))
      dated.push({
        date: d,
        t: {
          kind: 'care',
          name: c.name,
          date: d,
          key: `care:${c.id}:${d}`,
          to: `/calendar/day/${c.id}`,
        },
      });
  }
  for (const n of i.notes ?? []) {
    if (n.paid || !soon(n.due_on)) continue;
    const to = n.bundle_id
      ? `/salary/bundles/${n.bundle_id}/notes`
      : `/salary/items/${n.goal_id ?? ''}/notes`;
    dated.push({
      date: n.due_on,
      t: { kind: 'note', name: n.name, date: n.due_on, key: `note:${n.id}:${n.due_on}`, to },
    });
  }
  // 같은 날이면 경조사 먼저(일정 규칙과 같음)
  dated.sort((a, b) =>
    a.date < b.date
      ? -1
      : a.date > b.date
        ? 1
        : (a.t.kind === 'care' ? 0 : 1) - (b.t.kind === 'care' ? 0 : 1),
  );
  return dated[0]?.t ?? null;
}

/**
 * 파트너 저금에 같이 모으기 권유(띠 13, H-10): 각자 계열 + 연결, 상대가 만든 지 7일 안, 묶음에 안 든 상대 저금 중 가장 최근.
 * 내 저금이 0개면 H-10 빈 상태가 이 권유를 대신 보여 주고 띠는 내지 않음(2026-11-14 재테스트 R4: 한 화면에 세 번 겹침)
 */
export function bundleInviteGoal(
  i: Pick<TopTaskInput, 'joint' | 'coupleState' | 'partnerGoals' | 'today'>,
): { id: string; name: string; to: string } | null {
  if (i.joint || i.coupleState !== 'connected') return null;
  const g = (i.partnerGoals ?? [])
    .filter((x) => !x.bundle_id)
    .filter((x) => {
      const d = daysBetween(x.created_at.slice(0, 10), i.today);
      return d >= 0 && d < REQUEST_TASK_DAYS;
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return g
    ? { id: g.id, name: g.name, to: `/salary/bundles/new?goal=${encodeURIComponent(g.id)}` }
    : null;
}

/** 열린 할 일 띠 모두(순서대로). 닫거나 끝낸 띠는 closedKeys(home_task_state)로 거름 */
function openTopTasks(i: TopTaskInput): TopTask[] {
  const invite = bundleInviteGoal(i);
  const closed = new Set(i.closedKeys ?? []);
  const ok = (t: TopTask | null): t is TopTask => !!t && !closed.has(t.key);
  const separate = !i.joint;
  const connected = i.coupleState === 'connected';
  const inFirst = (days: number) => {
    if (!i.onboardedOn) return false;
    const d = daysBetween(i.onboardedOn, i.today);
    return d >= 0 && d < days;
  };
  const steps: (() => TopTask | null)[] = [
    // 1 해제 요청 받음(맨 위 띠가 대신 보여 주지만 순서는 첫째)
    () =>
      i.unlinkRequestedBy && i.unlinkRequestedBy !== i.meId
        ? { kind: 'unlink', key: 'unlink', to: '/settings/couple/unlink/review' }
        : null,
    // 2 다시 연결 요청 받음
    () =>
      i.reconnectFrom && i.reconnectFrom !== i.meId
        ? { kind: 'reconnect', key: 'reconnect', to: '/settings/couple/reconnect' }
        : null,
    // 3 관리 형태 바꾸기 요청 받음(7일)
    () => {
      const r = i.modeRequest;
      return openReq(r, i) && r
        ? {
            kind: 'mode_request',
            id: r.id,
            phrase: r.phrase,
            key: `mode_request:${r.id}`,
            to: `/settings/couple/style/request/${r.id}`,
          }
        : null;
    },
    // 4 분담 제안 받음(7일)
    () => {
      const r = i.splitProposal;
      return openReq(r, i) && r
        ? {
            kind: 'split_request',
            id: r.id,
            name: r.name,
            key: `split_request:${r.id}`,
            to: `/salary/split/${r.id}`,
          }
        : null;
    },
    // 5 순위 같이 보기 요청 받음(7일)
    () =>
      openReq(i.rankRequest, i) && i.rankRequest
        ? {
            kind: 'rank_request',
            id: i.rankRequest.id,
            key: `rank_request:${i.rankRequest.id}`,
            to: `/assets/rank/consent/${i.rankRequest.id}`,
          }
        : null,
    // 6 월급이 바뀐 달(적용된 사이클 첫 7일, W-01을 열 때까지)
    () =>
      i.salaryChanged && salaryChangedTaskOpen({ ...i.salaryChanged, today: i.today })
        ? {
            kind: 'salary_changed',
            key: `salary_changed:${i.salaryChanged.appliedDay ?? ''}`,
            to: SALARY_PATHS.plan,
          }
        : null,
    // 7 첫 저금(저금 0개, 첫 30일, 해제 대기 아님)
    () =>
      // 상대 저금 권유가 있으면 첫 저금 띠는 내지 않음(H-10이 권유 하나만, R4)
      i.savingCount === 0 &&
      !invite &&
      inFirst(FIRST_TASK_DAYS) &&
      i.coupleState !== 'unlink_pending'
        ? { kind: 'first_saving', key: SAVING_TODO_KEY, to: '/salary/items/new/a?from=home' }
        : null,
    // 8 생활비 나누기(각자 계열 + 생활비 ‘네’ + 연결 + 분담 없음, 첫 30일, ‘이미 정했어요’로 영구히 닫음)
    () =>
      separate && connected && i.sharedLiving && !i.hasSplit && inFirst(FIRST_TASK_DAYS)
        ? { kind: 'split_suggest', key: TASK_KEYS.splitSuggest, to: '/salary/split/new' }
        : null,
    // 9 자동으로 나가는 것 고르기(autoPickTaskOpen)
    () =>
      i.autoPickOpen
        ? { kind: 'auto_pick', key: TASK_KEYS.autoPick, to: '/salary/auto-lines' }
        : null,
    // 10 알림 다시 묻기(O-55 거절, 1회)
    () =>
      i.pushReask
        ? { kind: 'push_reask', paydayNone: !!i.paydayNone, key: 'push_reask', to: null }
        : null,
    // 11 다음 저금(기한 지난 달 다음 달 1일부터 14일)
    () => {
      const g = (i.deadlineGoals ?? []).find((x) => nextSavingTaskOpen(x, i.today));
      return g
        ? {
            kind: 'next_saving',
            goalId: g.id,
            name: g.name,
            key: `next_saving:${g.id}`,
            to: `/salary/items/${g.id}/next`,
          }
        : null;
    },
    // 12 실제 잔액 맞추기(90일마다 14일 동안)
    () =>
      i.reconcile ? { kind: 'reconcile', key: i.reconcile.key, to: '/salary/reconcile' } : null,
    // 13 파트너 저금에 같이 모으기(각자 계열, 상대가 만든 지 7일 안, 묶음에 안 듦)
    // 내 저금이 0개면 H-10 빈 상태가 대신 보여 줌(R4)
    () =>
      invite && i.savingCount > 0
        ? {
            kind: 'bundle_invite',
            goalId: invite.id,
            name: invite.name,
            key: `bundle_invite:${invite.id}`,
            to: invite.to,
          }
        : null,
    // 14 만기·경조사·쓸 곳 메모 날짜
    () => datedTask(i),
    // 15 초대(미합류)
    () =>
      i.coupleState === 'not_joined'
        ? { kind: 'invite', key: 'invite', to: '/settings/couple?invite=1' }
        : null,
    // 16 기다리는 합류자
    () =>
      i.waitingJoiner
        ? {
            kind: 'waiting_joiner',
            name: i.waitingJoiner.name,
            key: 'waiting_joiner',
            to: '/onboarding/resume',
          }
        : null,
  ];
  return steps.map((step) => step()).filter(ok);
}

/**
 * 할 일 띠 하나(19 ‘할 일 띠 순서 v2.2’ 1~16번, 정본). 월급날 확인·월급 전 확인은 띠가 아니라 H-11(pickMonthLine).
 * 닫거나 끝낸 띠는 closedKeys(home_task_state)로 거름. 없으면 null
 */
export function pickTopTask(i: TopTaskInput): TopTask | null {
  return openTopTasks(i)[0] ?? null;
}

/** 사람이 보낸 요청·초대(19 ‘띠 두 칸’): 다른 할 일에 가려지면 안 되는 것 */
const PERSON_TASKS: readonly TopTask['kind'][] = [
  'reconnect',
  'mode_request',
  'split_request',
  'rank_request',
  'bundle_invite',
  'invite',
  'waiting_joiner',
];
/** 홈 할 일 띠 최대 칸 수(2026-11-13 UX B M5) */
export const TOP_TASK_MAX = 2;

/**
 * 홈 할 일 띠 두 칸까지(19 ‘할 일 띠 순서 v2.2’, 2026-11-13 UX B M5) [확인 필요]:
 * 첫 칸 = 순서상 첫 할 일. 둘째 칸 = 남은 것 중 사람이 보낸 요청·초대(2·3·4·5·13·15·16번) 중 첫째,
 * 없으면 순서상 다음 할 일. 그래서 첫 저금·잔액 맞추기 같은 내 할 일이 상대 요청·같이 모으기 권유·초대를 가리지 않음
 */
export function pickTopTasks(i: TopTaskInput, max = TOP_TASK_MAX): TopTask[] {
  const all = openTopTasks(i);
  const out: TopTask[] = [];
  const first = all[0];
  if (!first) return out;
  out.push(first);
  const rest = all.slice(1);
  while (out.length < max && rest.length) {
    const k = rest.findIndex((t) => PERSON_TASKS.includes(t.kind));
    const [t] = rest.splice(k >= 0 ? k : 0, 1);
    if (t) out.push(t);
  }
  return out;
}

/** 알림 다시 묻기 띠가 뜨는 기간(19 띠 10번, 2026-11-13 UX B M5): 다가오는 월급날 3일 전 ~ 당일. 날짜 없음은 온보딩 7일 뒤부터 */
export const PUSH_REASK_DAYS_BEFORE = 3;
export const PUSH_REASK_NO_DATE_AFTER = 7;
export function pushReaskOpen(o: {
  today: string;
  /** 다가오는 월급날(첫 확인 목록 전이면 첫 월급날, 아니면 이번 사이클 첫날이나 다음 사이클 첫날) */
  nextPayday: string | null;
  paydayNone: boolean;
  onboardedOn: string | null;
}): boolean {
  if (o.paydayNone)
    return !!o.onboardedOn && daysBetween(o.onboardedOn, o.today) >= PUSH_REASK_NO_DATE_AFTER;
  if (!o.nextPayday) return false;
  const d = daysBetween(o.today, o.nextPayday);
  return d >= 0 && d <= PUSH_REASK_DAYS_BEFORE;
}
