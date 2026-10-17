import type { Won } from '../money';

// 재정 진단 5개(docs/spec/06-calc-allocation.md 8장, O-65). 판단할 값이 없으면 ‘아직 몰라요’.

export type Signal = 'good' | 'caution' | 'danger' | 'unknown';
export type IndicatorKey =
  'savingRate' | 'emergency' | 'loanBurden' | 'fixedRatio' | 'investPrinciple';

export interface Indicator {
  key: IndicatorKey;
  signal: Signal;
  /** 비율(%, 소수 첫째 자리). 없으면 null */
  pct: number | null;
}

const pct1 = (a: number, b: number) => Math.round((a * 1000) / b) / 10;

export function diagnose(o: {
  /** 월 수입 */
  income: Won;
  /** 저축(온보딩은 계획, 이후 W-04k 실제) */
  saving: Won;
  /** 비상금 통장 잔액. 자산 미입력이면 null */
  emergencyBalance: Won | null;
  emergencyBase: Won;
  /** 월 원리금 합계 */
  loanRepayment: Won;
  /** 고정지출(대출 상환 포함) */
  fixed: Won;
  /** 투자 원칙: null = 아직 묻지 않음, none = 미설정, one = 한 명만, both = 둘 다 동의 */
  invest: 'none' | 'one' | 'both' | null;
}): Indicator[] {
  const byIncome = (v: Won) => (o.income > 0 ? pct1(v, o.income) : null);

  const saving = byIncome(Math.max(o.saving, 0));
  const loan = byIncome(o.loanRepayment);
  const fixed = byIncome(o.fixed);
  const emergency =
    o.emergencyBalance === null || o.emergencyBase <= 0
      ? null
      : pct1(o.emergencyBalance, o.emergencyBase);

  return [
    {
      key: 'savingRate',
      pct: saving,
      signal:
        saving === null ? 'unknown' : saving >= 20 ? 'good' : saving >= 10 ? 'caution' : 'danger',
    },
    {
      key: 'emergency',
      pct: emergency,
      signal:
        emergency === null
          ? 'unknown'
          : emergency >= 100
            ? 'good'
            : emergency >= 50
              ? 'caution'
              : 'danger',
    },
    {
      key: 'loanBurden',
      pct: loan,
      signal: loan === null ? 'unknown' : loan <= 20 ? 'good' : loan <= 35 ? 'caution' : 'danger',
    },
    {
      key: 'fixedRatio',
      pct: fixed,
      signal:
        fixed === null ? 'unknown' : fixed <= 50 ? 'good' : fixed <= 60 ? 'caution' : 'danger',
    },
    {
      key: 'investPrinciple',
      pct: null,
      // 아직 묻지 않음(O-53 첫 주 7일째) = 아직 몰라요, 미설정 = 위험
      signal:
        o.invest === null
          ? 'unknown'
          : o.invest === 'both'
            ? 'good'
            : o.invest === 'one'
              ? 'caution'
              : 'danger',
    },
  ];
}

/** 살펴볼 지표(주의·위험). ‘아직 몰라요’는 빼고 판단 */
export const needsLook = (xs: Indicator[]) =>
  xs.filter((x) => x.signal === 'caution' || x.signal === 'danger');

/** 비상금으로 몇 개월 생활(잔액 ÷ (고정지출 + 생활비 예산)), 소수 첫째 자리. 계산할 수 없으면 null */
export function emergencyMonths(balance: Won | null, monthly: Won): number | null {
  if (balance === null || monthly <= 0) return null;
  return Math.floor((balance * 10) / monthly) / 10;
}

/** 진단 요약: 양호 개수, 위험 → 주의 → 양호 → 아직 몰라요 순서 */
export function diagnosisSummary(list: Indicator[]) {
  const rank: Record<Signal, number> = { danger: 0, caution: 1, good: 2, unknown: 3 };
  return {
    good: list.filter((x) => x.signal === 'good').length,
    total: list.length,
    ordered: [...list].sort((a, b) => rank[a.signal] - rank[b.signal]),
  };
}
