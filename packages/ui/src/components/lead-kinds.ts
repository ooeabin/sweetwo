import type { IconName } from './Icon';

// 줄 앞 칸(Lead) 종류 → Phosphor 아이콘 + 영역 색(2026-11-09, docs/design/components/ListRow.md ‘Lead 종류 표’).
// 한 종류 = 아이콘 하나. 표는 여기 하나만 두고, 화면은 leadOf(묶음, 종류)로만 부른다.
// 영역 색이 없으면(tone 없음) 회색 원(surface-alt) + ink-2 아이콘. 부채와 앱 안내는 회색.

export type LeadTone = 'together' | 'family' | 'goal' | 'safety' | 'invest';
export interface LeadSpec {
  icon: IconName;
  tone?: LeadTone;
}

const LEADS = {
  /** 월급 체크리스트 줄(W-02, H-03, W-05). PayCheckLine.kind */
  line: {
    saving: { icon: 'piggy-bank', tone: 'goal' },
    fixed: { icon: 'receipt', tone: 'safety' },
    living: { icon: 'shopping-cart', tone: 'together' },
    allowance: { icon: 'coins' },
    custom: { icon: 'wallet' },
  },
  /** 자산·부채 묶음(core asset.ts 그룹 key): F-03a 묶음 타일, F-01 빈 상태 타일. 부채는 회색 */
  asset: {
    cash: { icon: 'wallet', tone: 'safety' },
    deposit: { icon: 'vault', tone: 'safety' },
    subscription: { icon: 'house', tone: 'invest' },
    invest: { icon: 'chart-line-up', tone: 'invest' },
    pension: { icon: 'umbrella', tone: 'safety' },
    insurance: { icon: 'shield-check', tone: 'safety' },
    real_estate: { icon: 'buildings', tone: 'invest' },
    etc: { icon: 'car' },
    housing_loan: { icon: 'house' },
    credit: { icon: 'credit-card' },
    installment: { icon: 'shopping-bag' },
    student: { icon: 'graduation-cap' },
    other_loan: { icon: 'hand-coins' },
    personal: { icon: 'handshake' },
  },
  /** F-01 한눈에 아래 줄(자산 합계, 부채 합계, 예상 순자산) */
  summary: {
    assets: { icon: 'wallet', tone: 'invest' },
    debts: { icon: 'bank' },
    expected: { icon: 'chart-line-up', tone: 'invest' },
  },
  /** 캘린더 돈 일정(core MoneyKind) + 공휴일. 영역 색은 홈 H-05 날짜 칸과 같음 */
  money: {
    payday: { icon: 'money', tone: 'invest' },
    review: { icon: 'calendar-check', tone: 'safety' },
    deadline: { icon: 'target', tone: 'goal' },
    goal: { icon: 'target', tone: 'goal' },
    maturity: { icon: 'hourglass', tone: 'family' },
    holiday: { icon: 'flag-pennant' },
  },
  /** 챙길 날(care_day.kind). 챙길 날은 한 종류라 영역 색은 모두 together, 아이콘만 이름 칩에 따라 */
  care: {
    birthday: { icon: 'cake', tone: 'together' },
    anniversary: { icon: 'heart', tone: 'together' },
    seollal: { icon: 'moon-stars', tone: 'together' },
    chuseok: { icon: 'moon-stars', tone: 'together' },
    parents_day: { icon: 'flower-tulip', tone: 'together' },
    event: { icon: 'confetti', tone: 'together' },
    custom: { icon: 'gift', tone: 'together' },
  },
  /** 알림(notification.icon, 기획서 14 ‘센터 표시’ Phosphor 이름) */
  noti: {
    gift: { icon: 'gift', tone: 'together' },
    heart: { icon: 'heart', tone: 'together' },
    'calendar-check': { icon: 'calendar-check', tone: 'safety' },
    'clipboard-text': { icon: 'calendar-check', tone: 'safety' },
    receipt: { icon: 'receipt', tone: 'safety' },
    wallet: { icon: 'money', tone: 'invest' },
    'piggy-bank': { icon: 'piggy-bank', tone: 'goal' },
    trophy: { icon: 'trophy', tone: 'goal' },
    house: { icon: 'house', tone: 'invest' },
    'shield-check': { icon: 'shield-check' },
    'shield-warning': { icon: 'shield-warning' },
    'user-plus': { icon: 'user-plus' },
    'user-minus': { icon: 'user-minus' },
    'envelope-simple': { icon: 'envelope' },
    'chat-circle-text': { icon: 'chat-circle-text' },
    megaphone: { icon: 'megaphone' },
    bell: { icon: 'bell' },
  },
} as const satisfies Record<string, Record<string, LeadSpec>>;

export type LeadGroup = keyof typeof LEADS;
export type LeadKind<G extends LeadGroup> = keyof (typeof LEADS)[G];

/** 모르는 종류일 때(새 종류가 서버에서 먼저 올 때) */
const FALLBACK: Record<LeadGroup, LeadSpec> = {
  line: LEADS.line.custom,
  asset: LEADS.asset.etc,
  summary: LEADS.summary.assets,
  money: LEADS.money.holiday,
  care: LEADS.care.custom,
  noti: LEADS.noti.bell,
};

/** 묶음과 종류로 줄 앞 아이콘과 영역 색 */
export function leadOf<G extends LeadGroup>(
  group: G,
  kind: LeadKind<G> | string | null | undefined,
): LeadSpec {
  const table: Record<string, LeadSpec> = LEADS[group];
  return (kind != null && table[String(kind)]) || FALLBACK[group];
}

/** 표 전체(문서·검사용) */
export const leadTable: Readonly<Record<LeadGroup, Readonly<Record<string, LeadSpec>>>> = LEADS;
