import { type Won } from '../money';
import { type YearMonth } from '../onboarding/month';
import { savingNeed } from './saving-item';

// 월급 계획 추천값(docs/spec/17-onboarding-2.md O-50, 06-calc-allocation.md 3장, 18 P-06).
// 2026-11-08 ADR 0007: 비상금 기본 항목 없음, 저금 줄 = 저금 항목(목표 금액·기한이 있으면 월 필요액까지).

// v2.2(ADR 0009) 줄 종류 'send'(한 사람 관리형 ‘보내기’, 서버 recalc_send_line만 계산), 'shared_account'(같이 쓰는 통장,
// 분담 도우미 answer_split이 만듦). 추천값(recommendSplit)은 이 둘을 만들지 않음. 줄 설정 기본값·보내기 금액은 아래.
export type SplitKind =
  'saving' | 'fixed' | 'living' | 'allowance' | 'custom' | 'send' | 'shared_account';

export interface SplitLineDraft {
  kind: SplitKind;
  amount: Won;
  /** 저금 줄의 저금 항목 id(DB goal_id) */
  goalId?: string;
  /** 용돈 줄(합쳐서면 사람마다 1줄) */
  userId?: string;
  /** 직접 추가 줄 */
  name?: string;
  /** 저금 줄: 월 필요액(목표 금액과 기한이 있는 저금 항목만) */
  need?: Won | null;
}

/** 1만 원 단위 반올림 */
export const round10k = (v: number): Won => Math.round(v / 10_000) * 10_000;
const floor10k = (v: number): Won => Math.floor(v / 10_000) * 10_000;

export const FIXED_RATE = 0.25;
export const LIVING_RATE = 0.25;
export const ALLOWANCE_RATE = 0.1;

/** 저금 항목(추천값 재료). 목표 금액·기한이 있으면 월 필요액까지 채움 */
export interface SavingPlanItem {
  id: string;
  target: Won | null;
  saved: Won;
  deadline: YearMonth | null;
}

export interface RecommendInput {
  /** 월급 계획 수입(합쳐서면 두 사람 합) */
  income: Won;
  /** 용돈 줄을 받을 사람과 그 사람 실수령 */
  people: { userId: string; income: Won }[];
  /** 저금 줄 순서대로(저금 묶음 순서 = 만든 순서) */
  items: SavingPlanItem[];
  /** 지금 저금 줄 금액. 월 필요액이 없는 항목(목표 금액·기한 없음)은 이 금액 그대로(06 3-2) */
  current?: Record<string, Won>;
  /** 금액을 그대로 두는 저금 줄(파트너 탭의 파트너 저금 줄, 20 W-01 6번) */
  keep?: Record<string, Won>;
  /**
   * 직접 추가한 지출 줄(W-01 ‘추천값으로 다시 채우기’, 2026-11-12 QA 5구간 D1). 금액 그대로 두고 지출 줄 맨 뒤에 그대로 돌려줌.
   * 고정지출·생활비는 수입에서 이 줄들을 뺀 금액의 25%, 저금은 그 뒤 남은 금액에서(06 3-2)
   */
  custom?: { name: string; amount: Won }[];
  /**
   * 합쳐서(2026-11-13, 06 3-2): 용돈을 사람마다 같은 금액 = 두 사람 실수령 합 × 10% ÷ 사람 수(1만 원 반올림).
   * 없거나 false면 사람마다 그 사람 실수령 × 10%(각자, 예전)
   */
  equalAllowance?: boolean;
  now?: Date;
}

/**
 * 처음 채우는 값(O-50, W-01 ‘추천값으로 다시 채우기’).
 * 직접 추가한 지출 줄(custom)은 금액 그대로 두고 먼저 뗌. 고정지출·생활비 = (수입 − 직접 추가 줄 합) × 25%,
 * 용돈 = 사람마다 실수령 × 10%. 그대로 두는 저금 줄(keep, 월 필요액이 없는 항목의 지금 금액)을
 * 먼저 떼고, 남은 금액을 저금 묶음 순서대로 월 필요액만큼(모자라면 남은 만큼, 그다음은 0원). 저금 항목이 없으면 여유 자금.
 */
export function recommendSplit(o: RecommendInput): SplitLineDraft[] {
  const income = Math.max(o.income, 0);
  const custom = (o.custom ?? []).map((c) => ({
    kind: 'custom' as const,
    name: c.name,
    amount: Math.max(c.amount, 0),
  }));
  const customSum = custom.reduce((t, c) => t + c.amount, 0);
  const base = Math.max(income - customSum, 0);
  const fixed = round10k(base * FIXED_RATE);
  const living = round10k(base * LIVING_RATE);
  const same = o.equalAllowance ? equalAllowance(o.people.map((p) => p.income)) : null;
  const allowances = o.people.map((p) => ({
    kind: 'allowance' as const,
    userId: p.userId,
    amount: same ?? round10k(Math.max(p.income, 0) * ALLOWANCE_RATE),
  }));
  const plan = o.items.map((it) => {
    const need = savingNeed(it, o.now);
    const fixedAmount = o.keep?.[it.id] ?? (need === null ? (o.current?.[it.id] ?? 0) : undefined);
    return { it, need, fixedAmount };
  });
  const kept = plan.reduce((t, p) => t + (p.fixedAmount ?? 0), 0);
  let left =
    income - customSum - fixed - living - allowances.reduce((s, a) => s + a.amount, 0) - kept;
  const savings: SplitLineDraft[] = plan.map(({ it, need, fixedAmount }) => {
    if (fixedAmount !== undefined)
      return { kind: 'saving', goalId: it.id, amount: fixedAmount, need };
    const amount = Math.max(Math.min(need ?? 0, floor10k(left)), 0);
    left -= amount;
    return { kind: 'saving', goalId: it.id, amount, need };
  });
  return [
    ...savings,
    { kind: 'fixed', amount: fixed },
    { kind: 'living', amount: living },
    ...allowances,
    ...custom,
  ];
}

/**
 * 여유 자금 = 수입 − 모든 줄 합계. 음수면 모자람.
 * 보내기 줄(kind send)은 셈하지 않음(06 3-2 [확인 필요], 추천 기본값: 공동 수입 안의 이동이라 넣지 않음)
 */
export const leftover = (
  income: Won,
  lines: (Pick<SplitLineDraft, 'amount'> & { kind?: SplitKind })[],
): Won => income - lines.reduce((s, l) => s + (l.kind === 'send' ? 0 : l.amount), 0);

/**
 * 합쳐서 같은 용돈(06 3-2, 2026-11-13): 두 사람 실수령 합 × 10% ÷ 사람 수, 1만 원 단위 반올림.
 * 예: 350만 + 280만 = 630만 × 10% = 63만 ÷ 2 = 31.5만 → 32만 원씩. 사람이 없으면 0
 */
export function equalAllowance(incomes: readonly Won[]): Won {
  if (incomes.length === 0) return 0;
  const total = incomes.reduce((t, v) => t + Math.max(v, 0), 0);
  // 정수로: total × 10 ÷ 100 ÷ n = total ÷ (10n)
  return round10k(total / (10 * incomes.length));
}

/**
 * 보내기(06 3-2, G9, 서버 recalc_send_line): 1만 원 단위 내림(max(0, 실수령 − 용돈)).
 * 예: 280만 − 40만 = 240만 원. 육아휴직 150만이면 110만 원
 */
export const sendAmount = (income: Won | null, allowance: Won): Won =>
  floor10k(Math.max(0, (income ?? 0) - Math.max(allowance, 0)));

/**
 * 줄 설정 기본값(06 3-1, 서버 split_line_defaults 트리거): ‘체크리스트에 넣기’ = 생활비·용돈이 아니면 켬,
 * ‘은행에서 자동으로 나가요’ = 보내기·같이 쓰는 통장만 켬. 나가는 날 기본 null(= 월급날, 날짜 없음은 1일).
 * 한 사람 관리형 용돈 자동은 P-05c가 직접 켬. 직접 추가 줄은 만들 때 고름(06 [확인 필요]), 서버 기본은 켬
 */
export const splitLineDefaults = (kind: SplitKind) => ({
  inChecklist: kind !== 'living' && kind !== 'allowance',
  autoPay: kind === 'send' || kind === 'shared_account',
  autoDay: null as number | null,
});

/**
 * 생활비 ‘네’ + 각자 관리(각자 엔진, 06 3-1·17 O-50 고친 점, Q9): 처음 월급 계획에 ‘같이 쓰는 통장’ 0원 줄
 * (체크리스트에 넣기 켬, 자동 줄 켬). 분담 도우미(W-01b)가 정하면 서버 apply_shared_account가 이 줄을 채움. 그 밖은 없음
 */
export function sharedAccountSeed(
  salaryMode: 'separate' | 'joint',
  sharedLiving: boolean | null | undefined,
): (SplitLineDraft & { inChecklist: boolean; autoPay: boolean })[] {
  return salaryMode === 'separate' && sharedLiving === true
    ? [{ kind: 'shared_account', amount: 0, inChecklist: true, autoPay: true }]
    : [];
}

export interface JoinerSplitInput {
  /** 합류한 사람 실수령과 id */
  income: Won;
  userId: string;
}

/**
 * 각자: 합류한 사람 월급 계획 추천값(18 P-06 각자). 고정지출·생활비 = 실수령 × 25%, 용돈 = × 10%.
 * 저금 줄은 없음(저금 항목은 각자 자기 월급 계획에만, 합류한 사람이 직접 추가, ADR 0007). 나머지는 여유 자금
 */
export function joinerSplit(o: JoinerSplitInput): SplitLineDraft[] {
  const income = Math.max(o.income, 0);
  return [
    { kind: 'fixed', amount: round10k(income * FIXED_RATE) },
    { kind: 'living', amount: round10k(income * LIVING_RATE) },
    { kind: 'allowance', userId: o.userId, amount: round10k(income * ALLOWANCE_RATE) },
  ];
}

export interface JointRefillInput {
  /** 지금 공동 월급 계획 줄(시작한 사람이 정한 값) */
  lines: SplitLineDraft[];
  /** 합류한 사람 실수령과 id */
  income: Won;
  userId: string;
  /** 저금 줄의 저금 항목(월 필요액 계산) */
  items: SavingPlanItem[];
  now?: Date;
}

/**
 * 합쳐서: 공동 월급 계획 다시 채우기(18 P-06 합쳐서). 있던 줄은 줄이지 않음. 합류한 사람 용돈 줄(실수령 × 10%)을 더하고,
 * 늘어난 수입 − 그 용돈을 저금 묶음 순서대로 목표 금액·기한이 있는 항목의 월 필요액까지 더함. 남으면 여유 자금.
 */
export function jointRefill(o: JointRefillInput): SplitLineDraft[] {
  const income = Math.max(o.income, 0);
  const allowance = round10k(income * ALLOWANCE_RATE);
  let extra = income - allowance;
  const lines = o.lines.map((l) => {
    if (l.kind !== 'saving') return l;
    const it = o.items.find((x) => x.id === l.goalId);
    const need = it ? savingNeed(it, o.now) : null;
    const add = need === null ? 0 : Math.max(Math.min(need - l.amount, floor10k(extra)), 0);
    extra -= add;
    return { ...l, amount: l.amount + add };
  });
  const has = lines.some((l) => l.kind === 'allowance' && l.userId === o.userId);
  return has
    ? lines
    : [...lines, { kind: 'allowance' as const, userId: o.userId, amount: allowance }];
}
