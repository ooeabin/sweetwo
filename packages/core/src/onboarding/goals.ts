import { todayKst } from '../date';
import { ceilTo10k, type Won } from '../money';
import type { BandKind, QuickKind } from './bands';
import { addYears, monthsBetween, nextOccurrence, thisMonth, type YearMonth } from './month';

// 목표 템플릿(docs/spec/06-calc-allocation.md 5-1)과 온보딩 O-23 질문 순서(docs/spec/16-onboarding-1.md 목표별 표)

export type GoalKind = 'once' | 'yearly' | 'monthly';
export type GoalTab = 'repay' | 'housing' | 'family' | 'fun' | 'life' | 'future';

export type GoalQuestion =
  | {
      id: string;
      type: 'amount';
      title: string;
      quick: QuickKind;
      band?: BandKind;
      help?: string;
      /** 0원으로 답하는 글자 링크(결혼 비용 ‘없어요’) */
      zero?: string;
    }
  | { id: string; type: 'percent'; title: string; initial: number }
  | { id: string; type: 'text'; title: string; max: 20 }
  | { id: string; type: 'choice'; title: string; options: { value: string; label: string }[] }
  | { id: string; type: 'yearMonth'; title: string }
  | { id: string; type: 'month'; title: string }
  | { id: string; type: 'list'; title: string };

export type Answers = Record<string, string | number | boolean | AnnualItem[] | undefined>;
export interface AnnualItem {
  name: string;
  amount: Won;
  month: number;
}

export interface GoalContext {
  now?: Date;
  childPlan?: 'within_1y' | 'in_1_3y' | 'after_3y' | 'none' | 'unsure' | null;
  /** O-12 결혼한 날(또는 예정일) 'YYYY-MM-DD' */
  weddingDate?: string | null;
}

/** 기본 기한. null = 빈 칸(사용자 입력) */
export interface DefaultDeadline {
  value: YearMonth | null;
  estimated: boolean;
}

export interface GoalTemplate {
  key: string;
  name: string;
  tab: GoalTab | null; // null = 자동 생성(비상금, 결혼 비용, 양가 비용)
  illustration: string | null; // packages/ui illustrations 키
  questions: GoalQuestion[];
  /** O-24(기한)를 묻는지 */
  asksDeadline: (a: Answers) => boolean;
  /** O-24가 연·월 피커인지(양가 큰 행사) */
  deadlineYearMonth?: boolean;
  kind: (a: Answers) => GoalKind;
  /** 목표 금액(매달형은 월 납입액). 답이 모자라면 null */
  target: (a: Answers) => Won | null;
  /** 이미 모은 돈(goal.other_held). 없으면 묻지 않음 */
  held?: (a: Answers) => Won | null;
  defaultDeadline: (a: Answers, c: GoalContext) => DefaultDeadline;
}

const num = (a: Answers, k: string): number | null =>
  typeof a[k] === 'number' ? (a[k] as number) : null;
const sum = (...xs: (number | null)[]) =>
  xs.every((x) => x !== null) ? xs.reduce<number>((s, x) => s + (x ?? 0), 0) : null;
const amountQ = (
  id: string,
  title: string,
  quick: QuickKind = 'small',
  band: BandKind = 'goalAmount',
): GoalQuestion => ({
  id,
  type: 'amount',
  title,
  quick,
  band,
});
const textQ = (id: string, title: string): GoalQuestion => ({ id, type: 'text', title, max: 20 });
const yearsLater =
  (n: number) =>
  (_a: Answers, c: GoalContext): DefaultDeadline => ({
    value: addYears(thisMonth(c.now), n),
    estimated: false,
  });
const blank = (): DefaultDeadline => ({ value: null, estimated: false });
const none = (): DefaultDeadline => ({ value: null, estimated: false });
const always = () => true;
const never = () => false;
const once = (): GoalKind => 'once';

/** O-18 아이 계획 → 출산 준비 기한(06 5-3) */
export function babyDeadline(c: GoalContext): DefaultDeadline {
  const now = thisMonth(c.now);
  switch (c.childPlan) {
    case 'within_1y':
      return { value: addYears(now, 1), estimated: false };
    case 'in_1_3y':
      return { value: addYears(now, 2), estimated: false };
    case 'after_3y':
      return { value: addYears(now, 4), estimated: false };
    default:
      return { value: addYears(now, 3), estimated: true };
  }
}

export const goalTemplates: GoalTemplate[] = [
  {
    key: 'emergency',
    name: '비상금',
    tab: null,
    illustration: 'goal-01-emergency',
    questions: [],
    asksDeadline: never,
    kind: once,
    target: () => 10_000_000,
    defaultDeadline: yearsLater(1),
  },
  {
    // 16 O-23: “갚을 대출이 얼마 남았어요?” 기한은 빈 칸(O-24)
    key: 'high_interest_loan',
    name: '고금리 대출 갚기',
    tab: 'repay',
    illustration: 'goal-02-high-interest-loan',
    questions: [amountQ('amount', '갚을 대출이 얼마 남았어요?')],
    asksDeadline: always,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: blank,
  },
  {
    key: 'prepay_mortgage',
    name: '전세·주택대출 중도상환',
    tab: 'repay',
    illustration: 'goal-03-prepay-mortgage',
    questions: [amountQ('amount', '얼마를 먼저 갚고 싶어요?')],
    asksDeadline: always,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: blank,
  },
  {
    key: 'home',
    name: '내 집 마련',
    tab: 'housing',
    illustration: 'goal-04-home',
    questions: [
      amountQ('price', '어느 정도 집을 생각하세요?', 'big'),
      { id: 'ratio', type: 'percent', title: '그중 얼마를 모아서 낼까요?', initial: 30 },
    ],
    asksDeadline: always,
    kind: once,
    target: (a) => {
      const p = num(a, 'price');
      const r = num(a, 'ratio') ?? 30;
      return p === null ? null : Math.round((p * r) / 100);
    },
    defaultDeadline: yearsLater(5),
  },
  {
    key: 'moving',
    name: '전세 만기·이사 대비',
    tab: 'housing',
    illustration: 'goal-05-moving',
    questions: [
      amountQ('deposit', '보증금이 얼마나 오를 것 같아요?'),
      amountQ('moving', '이사비는요?'),
    ],
    asksDeadline: always,
    kind: once,
    target: (a) => sum(num(a, 'deposit'), num(a, 'moving')),
    defaultDeadline: blank, // 보증금 계약 만기일(자산 입력 전이면 빈 칸)
  },
  {
    key: 'furniture',
    name: '가전·가구·인테리어',
    tab: 'housing',
    illustration: 'goal-06-furniture',
    questions: [textQ('what', '무엇을 살 계획이에요?'), amountQ('amount', '얼마가 필요해요?')],
    asksDeadline: always,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: yearsLater(1),
  },
  {
    key: 'baby',
    name: '출산 준비',
    tab: 'family',
    illustration: 'goal-07-baby',
    questions: [amountQ('amount', '아이를 위해 얼마를 준비할까요?')],
    asksDeadline: always,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: (_a, c) => babyDeadline(c),
  },
  {
    key: 'education',
    name: '아이 교육·양육',
    tab: 'family',
    illustration: 'goal-08-education',
    questions: [
      { id: 'amount', type: 'amount', title: '한 달에 얼마씩 넣을까요?', quick: 'small' },
    ],
    asksDeadline: never,
    kind: () => 'monthly',
    target: (a) => num(a, 'amount'),
    defaultDeadline: none,
  },
  {
    key: 'family_event',
    name: '양가 큰 행사',
    tab: 'family',
    illustration: 'goal-09-family-event',
    questions: [textQ('what', '누구의 어떤 행사예요?'), amountQ('amount', '얼마를 준비할까요?')],
    asksDeadline: always,
    deadlineYearMonth: true,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: blank,
  },
  {
    key: 'pet',
    name: '반려동물',
    tab: 'family',
    illustration: 'goal-10-pet',
    questions: [
      amountQ('adopt', '입양·준비에 얼마가 들까요?'),
      amountQ('vet', '병원비로 따로 모아둘 돈은요?'),
    ],
    asksDeadline: always,
    kind: once,
    target: (a) => sum(num(a, 'adopt'), num(a, 'vet')),
    defaultDeadline: blank,
  },
  {
    key: 'travel',
    name: '여행',
    tab: 'fun',
    illustration: 'goal-12-travel',
    questions: [
      {
        id: 'where',
        type: 'choice',
        title: '국내예요, 해외예요?',
        options: [
          { value: 'domestic', label: '국내' },
          { value: 'abroad', label: '해외' },
        ],
      },
      { id: 'when', type: 'yearMonth', title: '언제 가요?' },
      amountQ('amount', '경비는 얼마쯤이에요?', 'small', 'travelPerPerson'),
      {
        id: 'yearly',
        type: 'choice',
        title: '매년 가는 여행인가요?',
        options: [
          { value: 'yes', label: '네' },
          { value: 'no', label: '아니요' },
        ],
      },
    ],
    asksDeadline: never,
    kind: (a) => (a.yearly === 'yes' ? 'yearly' : 'once'),
    target: (a) => num(a, 'amount'),
    defaultDeadline: (a) => ({
      value: typeof a.when === 'string' ? (a.when as YearMonth) : null,
      estimated: false,
    }),
  },
  {
    key: 'anniversary',
    name: '결혼기념일',
    tab: 'fun',
    illustration: 'goal-13-anniversary',
    questions: [amountQ('amount', '기념일에 매년 얼마쯤 쓸까요?')],
    asksDeadline: never,
    kind: () => 'yearly',
    target: (a) => num(a, 'amount'),
    defaultDeadline: (_a, c) => ({
      value: c.weddingDate ? nextOccurrence(Number(c.weddingDate.slice(5, 7)), c.now) : null,
      estimated: false,
    }),
  },
  {
    key: 'big_purchase',
    name: '명품·큰 물건 구입',
    tab: 'fun',
    illustration: 'goal-14-big-purchase',
    questions: [textQ('what', '무엇을 사고 싶어요?'), amountQ('amount', '얼마예요?')],
    asksDeadline: always,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: blank,
  },
  {
    key: 'hobby',
    name: '취미·자기계발',
    tab: 'fun',
    illustration: 'goal-15-hobby',
    questions: [textQ('what', '무엇을 위한 돈인가요?'), amountQ('amount', '얼마가 필요해요?')],
    asksDeadline: always,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: blank,
  },
  {
    key: 'car',
    name: '자동차 구입·교체',
    tab: 'life',
    illustration: 'goal-16-car',
    questions: [
      amountQ('price', '차 가격은 얼마쯤 생각하세요?', 'big'),
      { id: 'ratio', type: 'percent', title: '그중 얼마를 현금으로 낼까요?', initial: 50 },
    ],
    asksDeadline: always,
    kind: once,
    target: (a) => {
      const p = num(a, 'price');
      const r = num(a, 'ratio') ?? 50;
      return p === null ? null : Math.round((p * r) / 100);
    },
    defaultDeadline: blank,
  },
  {
    key: 'car_upkeep',
    name: '자동차 유지비',
    tab: 'life',
    illustration: 'goal-17-car-upkeep',
    questions: [
      amountQ('amount', '보험료·자동차세·정비로 1년에 얼마쯤 나가요?'),
      { id: 'month', type: 'month', title: '주로 몇 월에 나가요?' },
    ],
    asksDeadline: never,
    kind: () => 'yearly',
    target: (a) => num(a, 'amount'),
    defaultDeadline: (a, c) => ({
      value: num(a, 'month') ? nextOccurrence(num(a, 'month') ?? 1, c.now) : null,
      estimated: false,
    }),
  },
  {
    key: 'annual_fixed',
    name: '연간 고정 지출',
    tab: 'life',
    illustration: 'goal-18-annual-fixed',
    questions: [{ id: 'items', type: 'list', title: '1년에 한 번 나가는 돈을 알려주세요' }],
    asksDeadline: never,
    kind: () => 'yearly',
    target: (a) =>
      Array.isArray(a.items) && a.items.length
        ? (a.items as AnnualItem[]).reduce((s, i) => s + i.amount, 0)
        : null,
    defaultDeadline: (a, c) => {
      const items = Array.isArray(a.items) ? (a.items as AnnualItem[]) : [];
      const next = items.map((i) => nextOccurrence(i.month, c.now)).sort()[0];
      return { value: next ?? null, estimated: false };
    },
  },
  {
    key: 'retirement',
    name: '노후·연금',
    tab: 'future',
    illustration: 'goal-19-retirement',
    questions: [
      { id: 'amount', type: 'amount', title: '한 달에 얼마씩 넣을까요?', quick: 'small' },
    ],
    asksDeadline: never,
    kind: () => 'monthly',
    target: (a) => num(a, 'amount'),
    defaultDeadline: none,
  },
  {
    key: 'invest_seed',
    name: '투자 종잣돈',
    tab: 'future',
    illustration: 'goal-20-invest',
    questions: [amountQ('amount', '얼마를 모아서 시작할까요?')],
    asksDeadline: always,
    kind: once,
    target: (a) => num(a, 'amount'),
    defaultDeadline: blank,
  },
  {
    key: 'custom',
    name: '직접 만들기',
    tab: null,
    illustration: null,
    questions: [
      textQ('name', '무엇을 위한 돈인가요?'),
      amountQ('amount', '얼마가 필요해요?'),
      {
        id: 'repeat',
        type: 'choice',
        title: '한 번인가요, 매년인가요?',
        options: [
          { value: 'once', label: '한 번이에요' },
          { value: 'yearly', label: '매년이에요' },
        ],
      },
    ],
    asksDeadline: (a) => a.repeat !== 'yearly',
    kind: (a) => (a.repeat === 'yearly' ? 'yearly' : 'once'),
    target: (a) => num(a, 'amount'),
    defaultDeadline: blank,
  },
  {
    // 16 O-23 목표별 표: ① 총 얼마(둘이 합한 금액) → ② 모아둔 돈(‘없어요’ = 0). 기한 = O-12 예정일의 연·월
    key: 'wedding',
    name: '결혼 비용',
    tab: 'family',
    illustration: 'goal-21-wedding',
    questions: [
      { ...amountQ('total', '결혼 준비에 총 얼마를 생각하세요?', 'big'), help: '둘이 합한 금액이에요' },
      { ...amountQ('saved', '지금까지 모아둔 돈이 있나요?'), zero: '없어요' },
    ],
    asksDeadline: always,
    deadlineYearMonth: true,
    kind: once,
    target: (a) => num(a, 'total'),
    held: (a) => num(a, 'saved'),
    defaultDeadline: (_a, c) =>
      c.weddingDate
        ? { value: c.weddingDate.slice(0, 7) as YearMonth, estimated: false }
        : { value: addYears(thisMonth(c.now), 1), estimated: true },
  },
  {
    // 캘린더 처음 등록(24 Y-02e)에서 자동 생성. 회차 = 결혼기념일 기준 1년, 목표 금액 = 이번 회차 챙길 날 예산 합계
    key: 'family_cost',
    name: '양가 비용',
    tab: null,
    illustration: null,
    questions: [],
    asksDeadline: never,
    kind: () => 'yearly',
    target: () => null,
    defaultDeadline: blank,
  },
];

export const templateByKey = (key: string) => goalTemplates.find((t) => t.key === key);

/** O-21 분류 탭(맨 앞 ‘자주 고르는’) */
export const goalTabs: { key: GoalTab | 'popular'; label: string }[] = [
  { key: 'popular', label: '자주 고르는' },
  { key: 'repay', label: '갚기' },
  { key: 'housing', label: '주거' },
  { key: 'family', label: '가족' },
  { key: 'fun', label: '즐거움' },
  { key: 'life', label: '생활' },
  { key: 'future', label: '미래' },
];
export const popularGoals = ['home', 'travel', 'baby', 'car', 'high_interest_loan', 'retirement'];
/** 결혼 준비 중이면 결혼 비용이 ‘자주 고르는’과 가족 탭 맨 앞(16 O-21) */
export const pickableGoals = (tab: GoalTab | 'popular', engaged = false) => {
  const list =
    tab === 'popular'
      ? (engaged ? ['wedding', ...popularGoals] : popularGoals)
          .map((k) => templateByKey(k))
          .filter((t): t is GoalTemplate => !!t)
      : goalTemplates.filter((t) => t.tab === tab);
  return tab === 'family'
    ? [...list.filter((t) => t.key === 'wedding'), ...list.filter((t) => t.key !== 'wedding')]
    : list;
};

/** O-21 추천 배지: 결혼 준비 중 → 결혼 비용(미리 선택 안 함) */
export const recommendedGoals = (engaged: boolean) => (engaged ? ['wedding'] : []);

/** O-23·O-24를 묻지 않는 경우: 고른 목표가 없음(비상금만) */
export const skipsTopGoalQuestions = (top: string | undefined) => !top;

/**
 * 월 필요액(06 5-3): (목표 금액 − 보유액) ÷ 남은 개월, 1만 원 단위 올림.
 * 남은 개월 = 이번 달부터 기한 달 전까지(같은 달 기한이면 1). 기한 없음이면 null.
 */
export function monthlyNeed(o: {
  target: Won;
  held?: Won;
  deadline: YearMonth | null;
  now?: Date;
}): { need: Won; months: number } | null {
  if (!o.deadline) return null;
  const months = Math.max(monthsBetween(thisMonth(o.now), o.deadline), 1);
  const left = Math.max(o.target - (o.held ?? 0), 0);
  return { need: ceilTo10k(left / months > 0 ? Math.ceil(left / months) : 0), months };
}

/** ‘잘 모르겠어요’(기한) 또는 빈 기본 기한: 3년 뒤 + ‘추정’ */
export const unsureDeadline = (now?: Date): DefaultDeadline => ({
  value: addYears(thisMonth(now), 3),
  estimated: true,
});

/** 결혼 비용 목표(O-19a~c, 06 11장): 목표 = 총예산 − 양가 지원, 보유액 = 모아둔 돈 */
export function weddingGoal(o: { budget: Won; support: Won; saved: Won }) {
  return {
    target: Math.max(o.budget - o.support, 0),
    held: o.saved,
    surplus: Math.max(o.support + o.saved - o.budget, 0),
  };
}

/** O-13 만 18세 미만인지(KST 올해 기준) */
export const isMinorBirthYear = (birthYear: number, now = new Date()) =>
  birthYear > Number(thisMonth(now).slice(0, 4)) - 18;

/** 만 나이(KST 오늘 기준). 생일이 아직 안 지났으면 한 살 적게 */
export function manAge(b: { y: number; m: number; d: number }, now = new Date()): number {
  const [ty = 0, tm = 1, td = 1] = todayKst(now).split('-').map(Number);
  return ty - b.y - (tm < b.m || (tm === b.m && td < b.d) ? 1 : 0);
}
/** 생년월일 휠 범위: 1950년 ~ (올해 − 18)년(O-13, P-04) */
export const birthYearRange = (now = new Date()) => ({
  min: 1950,
  max: Number(todayKst(now).slice(0, 4)) - 18,
});
/** {y,m,d} → 'YYYY-MM-DD' */
export const ymdText = (b: { y: number; m: number; d: number }) =>
  `${b.y}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;
/** 만 18세 미만(O-13, P-04 생년월일). 서버 delete_underage_account와 같은 기준 */
export const isUnderage = (b: { y: number; m: number; d: number }, now = new Date()) =>
  manAge(b, now) < 18;

/** 첫 주 5일째(16 O-22~25) 남은 화면 하나 */
export type RestGoalScreen =
  | { goalId: string; screen: 'q'; index: number }
  | { goalId: string; screen: 'deadline' }
  | { goalId: string; screen: 'held' };

export interface RestGoal {
  id: string;
  template: string;
  priority: number;
  status: string;
  deadline: string | null;
  details: unknown;
}

const RESTING = ['paused', 'achieved', 'used'];
/** O-22 순서 정하기 대상: 비상금·결혼 비용·양가 비용(자동 목표) 빼고 진행 중인 목표, 우선순위 순 */
export const orderableGoals = <G extends RestGoal>(goals: G[]) =>
  goals
    .filter(
      (g) =>
        !['emergency', 'wedding', 'family_cost'].includes(g.template) &&
        !RESTING.includes(g.status),
    )
    .sort((a, b) => a.priority - b.priority);

/**
 * 아직 묻지 않은 O-23(질문마다) → O-24(기한을 묻는 목표인데 비어 있으면) → O-25(모아둔 돈, 매달 목표 빼고) 화면, 우선순위 순.
 * 고금리 대출 갚기는 묻지 않음, 각자 관리 예비부부는 결혼일 전환에서 물어 비움. O-25를 물었으면 details._held = true
 */
export function restGoalScreens(goals: RestGoal[], separate: boolean): RestGoalScreen[] {
  if (separate) return [];
  const out: RestGoalScreen[] = [];
  for (const g of orderableGoals(goals)) {
    const t = templateByKey(g.template);
    if (!t || g.template === 'high_interest_loan') continue;
    const a = (g.details ?? {}) as Answers;
    t.questions.forEach((q, i) => {
      if (a[q.id] === undefined) out.push({ goalId: g.id, screen: 'q', index: i + 1 });
    });
    const answered = t.questions.every((q) => a[q.id] !== undefined);
    if (answered && t.asksDeadline(a) && !g.deadline)
      out.push({ goalId: g.id, screen: 'deadline' });
    if (answered && t.kind(a) !== 'monthly' && a._held !== true)
      out.push({ goalId: g.id, screen: 'held' });
  }
  return out;
}
