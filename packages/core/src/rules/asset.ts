import type { Won } from '../money';

// 자산·부채 분류(docs/spec/09-data-items.md 6-5·6-6, 23 F-02 묶음 표). 그룹 칩 → 세부 항목, 모든 그룹에 기타(직접 입력).
export type AssetSide = 'asset' | 'debt';

export interface AssetKind {
  key: string;
  name: string;
  /** 어드민이 더한 칩(AD-19)만. key는 따르는 기본 항목 */
  id?: string;
}
export interface AssetGroup {
  key: string;
  side: AssetSide;
  name: string;
  kinds: AssetKind[];
  /** 빠른 칩 종류(보증금은 큰 단위) */
  big?: boolean;
}

const other: AssetKind = { key: 'other', name: '기타(직접 입력)' };
const k = (key: string, name: string): AssetKind => ({ key, name });

export const assetGroups: AssetGroup[] = [
  {
    key: 'cash',
    side: 'asset',
    name: '현금성',
    kinds: [
      k('bank', '입출금 통장'),
      k('role_account', '목표자금·비상금 통장'),
      k('parking', '파킹통장·CMA'),
      k('cash', '현금'),
      k('foreign', '외화 예금'),
      other,
    ],
  },
  {
    key: 'deposit',
    side: 'asset',
    name: '예금·적금',
    kinds: [
      k('term_deposit', '정기예금'),
      k('saving', '적금'),
      k('policy_saving', '정책형 적금'),
      other,
    ],
  },
  {
    key: 'subscription',
    side: 'asset',
    name: '청약',
    kinds: [k('housing_subscription', '주택청약종합저축'), other],
  },
  {
    key: 'invest',
    side: 'asset',
    name: '투자',
    kinds: [
      k('stock_kr', '국내 주식'),
      k('stock_us', '해외 주식'),
      k('etf', 'ETF'),
      k('fund', '펀드'),
      k('bond', '채권'),
      k('isa', 'ISA 계좌'),
      k('gold', '금·실물'),
      k('crypto', '가상자산'),
      other,
    ],
  },
  {
    key: 'pension',
    side: 'asset',
    name: '연금',
    kinds: [
      k('pension_saving', '연금저축'),
      k('irp', 'IRP'),
      k('dc', '퇴직연금(DC형)'),
      k('pension_insurance', '개인연금보험'),
      other,
    ],
  },
  {
    key: 'insurance',
    side: 'asset',
    name: '저축성 보험',
    kinds: [k('saving_insurance', '저축보험'), k('variable_insurance', '변액보험'), other],
  },
  {
    key: 'real_estate',
    side: 'asset',
    name: '부동산',
    big: true,
    kinds: [
      k('deposit_money', '전·월세 보증금'),
      k('house', '보유 주택'),
      k('presale', '분양권'),
      other,
    ],
  },
  {
    key: 'etc',
    side: 'asset',
    name: '기타',
    kinds: [k('car', '자동차'), k('lent', '빌려준 돈'), other],
  },
  {
    key: 'housing_loan',
    side: 'debt',
    name: '주택',
    big: true,
    kinds: [
      k('jeonse_loan', '전세자금대출'),
      k('mortgage', '주택담보대출'),
      k('interim_loan', '중도금·잔금 대출'),
      other,
    ],
  },
  {
    key: 'credit',
    side: 'debt',
    name: '신용',
    kinds: [
      k('credit_loan', '신용대출'),
      k('overdraft', '마이너스통장'),
      k('card_loan', '카드론·현금서비스'),
      k('revolving', '리볼빙'),
      other,
    ],
  },
  {
    key: 'installment',
    side: 'debt',
    name: '할부',
    kinds: [k('car_installment', '자동차 할부'), k('card_installment', '큰 금액 카드 할부'), other],
  },
  {
    key: 'student',
    side: 'debt',
    name: '학자금',
    kinds: [k('student_loan', '학자금 대출'), other],
  },
  {
    key: 'other_loan',
    side: 'debt',
    name: '기타 대출',
    kinds: [k('policy_loan', '보험계약대출'), k('secured_loan', '예적금담보대출'), other],
  },
  {
    key: 'personal',
    side: 'debt',
    name: '개인 간',
    kinds: [k('family_loan', '양가·가족·지인에게 빌린 돈'), other],
  },
];

export const assetGroupsOf = (side: AssetSide) => assetGroups.filter((g) => g.side === side);

/** AD-19 항목 이름 목록으로 고칠 수 있는 묶음 */
export const KIND_NAME_GROUPS = ['deposit', 'subscription', 'invest', 'pension'];
export interface KindNameRow {
  id: string;
  grp: string;
  base: string;
  name: string;
  added: boolean;
  hidden: boolean;
}
/**
 * AD-19 항목 이름 목록을 기본 칩에 입힘(09 6-2): 기본 항목은 이름 바꾸기·숨기기, 새 칩은
 * 기본 항목들 다음에(들어온 순서), ‘기타(직접 입력)’는 늘 마지막. 그룹에 없는 항목을 따르는 줄은 버림.
 */
export function withKindNames(groups: AssetGroup[], rows: KindNameRow[]): AssetGroup[] {
  return groups.map((g) => {
    if (!KIND_NAME_GROUPS.includes(g.key)) return g;
    const mine = rows.filter((r) => r.grp === g.key);
    if (!mine.length) return g;
    const base = g.kinds.filter((x) => x.key !== 'other');
    const kinds = base.flatMap((x) => {
      const o = mine.find((r) => !r.added && r.base === x.key);
      if (o?.hidden) return [];
      return [o ? { ...x, name: o.name } : x];
    });
    const extra = mine
      .filter((r) => r.added && !r.hidden && base.some((x) => x.key === r.base))
      .map((r) => ({ key: r.base, name: r.name, id: r.id }));
    return { ...g, kinds: [...kinds, ...extra, ...g.kinds.filter((x) => x.key === 'other')] };
  });
}
export const assetGroup = (key: string) => assetGroups.find((g) => g.key === key);
/** 원금을 넣을 수 있는 묶음(투자·부동산) */
export const hasPrincipal = (grp: string) => grp === 'invest' || grp === 'real_estate';
/** 금리가 높은 대출(카드론·현금서비스·리볼빙) → 고금리 대출 갚기 목표 제안(09 6-6) */
export const isHighInterestKind = (kind: string) => kind === 'card_loan' || kind === 'revolving';

export interface NetWorthItem {
  side: AssetSide;
  amount: Won;
  principal?: Won | null;
  visibility?: 'all' | 'sum' | 'private';
  status?: 'held' | 'sold' | 'matured';
}

/**
 * 순자산(06 9장): 자산 − 부채, 원금이 있으면 원금(없으면 평가금액). 예상 순자산 = 평가금액 기준.
 * 안 판 수익 = 예상 − 순자산. 비공개·판 항목·만기 완료 항목은 빼고, 배우자 ‘합계만’ 묶음 합계는 더한다.
 */
export function netWorth(
  items: NetWorthItem[],
  partnerSums: { side: AssetSide; total: Won; principal_total: Won }[] = [],
) {
  const live = items.filter((i) => i.visibility !== 'private' && (i.status ?? 'held') === 'held');
  const sum = (side: AssetSide, f: (i: NetWorthItem) => Won) =>
    live.filter((i) => i.side === side).reduce((t, i) => t + f(i), 0) +
    partnerSums
      .filter((p) => p.side === side)
      .reduce((t, p) => t + (f === byAmount ? p.total : p.principal_total), 0);
  const byAmount = (i: NetWorthItem) => i.amount;
  const byPrincipal = (i: NetWorthItem) => i.principal ?? i.amount;
  const assets = sum('asset', byPrincipal);
  const debts = sum('debt', byPrincipal);
  const net = assets - debts;
  const expected = sum('asset', byAmount) - sum('debt', byAmount);
  return {
    /** 자산 합계(평가금액, 목록 표시용) */
    assets: sum('asset', byAmount),
    debts: sum('debt', byAmount),
    net,
    expected,
    gain: expected - net,
  };
}

export interface NetWorthPoint {
  /** 그달 1일(YYYY-MM-01) */
  month: string;
  net: Won;
  expected: Won;
}

/**
 * 순자산 그래프 값(23 F-01 6번). 서버 월말 기록에서 이번 달은 지금 값으로 바꾸고,
 * 아무것도 없던 앞쪽 달(둘 다 0)은 뺀다. 이번 달 하나는 늘 남음.
 */
export function netWorthSeries(
  history: NetWorthPoint[],
  now: { net: Won; expected: Won },
  thisMonth: string,
): NetWorthPoint[] {
  const rows = history
    .filter((h) => h.month < thisMonth)
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map(({ month, net, expected }) => ({ month, net, expected }));
  rows.push({ month: thisMonth, net: now.net, expected: now.expected });
  const first = rows.findIndex((r) => r.net !== 0 || r.expected !== 0);
  return rows.slice(first < 0 ? rows.length - 1 : first);
}

/** 기간 탭 “6개월” “1년” “3년” “전체”(null) */
export const NET_WORTH_PERIODS = [6, 12, 36, null] as const;
export type NetWorthPeriod = (typeof NET_WORTH_PERIODS)[number];

/** 데이터보다 긴 기간은 비활성(전체는 늘 가능) */
export const periodEnabled = (p: NetWorthPeriod, points: number) => p === null || p <= points;

/** 처음 고를 기간: 기억한 탭이 쓸 수 있으면 그것, 아니면 1년(쓴 지 1년 미만이면 전체) */
export function startPeriod(points: number, remembered?: NetWorthPeriod): NetWorthPeriod {
  if (remembered !== undefined && periodEnabled(remembered, points)) return remembered;
  return periodEnabled(12, points) ? 12 : null;
}

export const periodSlice = <T>(rows: T[], p: NetWorthPeriod) =>
  p === null ? rows : rows.slice(-p);

/**
 * 투자 묶음 줄(23 F-02 12번, 06 8장). 투자 비중 = 투자 자산 합계 ÷ 총자산(부채 빼기 전, 평가금액, 반올림 %).
 * 손익 = 원금 있는 투자 항목의 평가금액 − 원금 합(원금 있는 항목이 없으면 null). 비공개·판 항목 제외,
 * 배우자 ‘합계만’은 비중에만 더함(원금을 따로 알 수 없음).
 */
export function investSummary(
  items: (NetWorthItem & { grp: string })[],
  partnerSums: { side: AssetSide; grp: string; total: Won }[] = [],
) {
  const live = items.filter(
    (i) => i.side === 'asset' && i.visibility !== 'private' && (i.status ?? 'held') === 'held',
  );
  const partner = partnerSums.filter((p) => p.side === 'asset');
  const total = live.reduce((t, i) => t + i.amount, 0) + partner.reduce((t, p) => t + p.total, 0);
  const inv = live.filter((i) => i.grp === 'invest');
  const invest =
    inv.reduce((t, i) => t + i.amount, 0) +
    partner.filter((p) => p.grp === 'invest').reduce((t, p) => t + p.total, 0);
  const withP = inv.filter((i) => i.principal !== null && i.principal !== undefined);
  const principal = withP.reduce((t, i) => t + (i.principal ?? 0), 0);
  const gain = withP.length ? withP.reduce((t, i) => t + i.amount, 0) - principal : null;
  return {
    sharePct: total > 0 ? Math.round((invest * 100) / total) : null,
    gain,
    gainPct: gain !== null && principal > 0 ? Math.round((gain * 100) / principal) : null,
  };
}

/**
 * 금리를 모를 때 쓰는 유형별 평균 금리(06 4장 초기값, 나중에 어드민 설정값).
 * 주택담보·전세 4%, 신용 6%, 학자금 2%, 카드론·현금서비스 15%. 없는 유형은 null(금리 비움)
 */
export const AVG_RATE: Record<string, number> = {
  jeonse_loan: 4,
  mortgage: 4,
  credit_loan: 6,
  student_loan: 2,
  card_loan: 15,
};
export const avgRate = (kind: string): number | null => AVG_RATE[kind] ?? null;

/** 첫 주 자산·대출 정리(17 O-41, O-44) 칩 하나 = 묶음 + 기본 세부 항목. 이름은 칩 이름(F-04에서 고침) */
export interface QuickPick {
  key: string;
  grp: string;
  kind: string;
  name: string;
}
export const QUICK_ASSETS: QuickPick[] = [
  { key: 'cash', grp: 'cash', kind: 'bank', name: '현금성' },
  { key: 'deposit', grp: 'deposit', kind: 'term_deposit', name: '예금·적금' },
  { key: 'subscription', grp: 'subscription', kind: 'housing_subscription', name: '청약' },
  { key: 'invest', grp: 'invest', kind: 'other', name: '투자' },
  { key: 'pension', grp: 'pension', kind: 'other', name: '연금' },
  { key: 'insurance', grp: 'insurance', kind: 'saving_insurance', name: '저축성 보험' },
  { key: 'real_estate', grp: 'real_estate', kind: 'deposit_money', name: '부동산' },
  { key: 'wedding_left', grp: 'cash', kind: 'other', name: '결혼 후 남은 목돈' },
  { key: 'etc', grp: 'etc', kind: 'other', name: '기타' },
];
export const QUICK_LOANS: QuickPick[] = [
  { key: 'housing_loan', grp: 'housing_loan', kind: 'jeonse_loan', name: '주택' },
  { key: 'credit', grp: 'credit', kind: 'credit_loan', name: '신용' },
  { key: 'installment', grp: 'installment', kind: 'other', name: '할부' },
  { key: 'student', grp: 'student', kind: 'student_loan', name: '학자금' },
  { key: 'other_loan', grp: 'other_loan', kind: 'other', name: '기타 대출' },
  { key: 'personal', grp: 'personal', kind: 'family_loan', name: '가족·지인에게 빌린 돈' },
];
