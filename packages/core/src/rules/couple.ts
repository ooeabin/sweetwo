import type { Won } from '../money';
import type { BaseDay } from '../onboarding/cycle';
import { defaultBaseDay } from '../onboarding/cycle';
import { splitShares, type SplitMode } from '../onboarding/plan';

// 두 사람 기준(docs/spec/18-partner-join.md, 06 3·4장). 화면은 항상 ‘나’와 ‘배우자’로 본다.
// 합류 전: 배우자 값 = 시작한 사람이 공간에 적은 추정(couple_space.partner_*), 배우자 용돈 = 내 용돈 가정.
// 합류 뒤: 배우자 값 = 배우자 본인 값(partner_profile). 분담 비율(split_ratio)은 시작한 사람 몫 %.

export interface CoupleUser {
  id: string;
  nickname: string | null;
  monthly_income: Won | null;
  payday: number | null;
  payday_last: boolean;
  allowance: Won | null;
  /** 다른 수입 월 합계(O-35b, 서버 트리거). 월 수입에 더함 */
  other_income?: Won;
}
export interface CoupleSpace {
  created_by: string | null;
  couple_state: 'not_joined' | 'connected' | 'unlink_pending' | 'solo';
  partner_nickname: string | null;
  partner_income: Won | null;
  partner_income_estimated: boolean;
  partner_income_unknown: boolean;
  split_ratio: number | null;
}

export interface Couple {
  joined: boolean;
  solo: boolean;
  /** 내가 공간을 시작한 사람인지 */
  starter: boolean;
  myName: string;
  partnerName: string;
  myIncome: Won | null;
  partnerIncome: Won | null;
  partnerUnknown: boolean;
  partnerEstimated: boolean;
  myAllowance: Won | null;
  /** null = 내 용돈과 같다고 가정 */
  partnerAllowance: Won | null;
  /** 직접 정한 분담에서 내 몫 % */
  myRatio: number;
  myPayday: BaseDay | null;
  partnerPayday: BaseDay | null;
}

/** 월 수입 = 월급(실수령) + 다른 수입(09 6-1 부업·월세·지원금). 월급을 모르면 다른 수입만, 둘 다 없으면 null */
const incomeOf = (u: Pick<CoupleUser, 'monthly_income' | 'other_income'>): Won | null => {
  const other = u.other_income ?? 0;
  return u.monthly_income === null ? (other > 0 ? other : null) : u.monthly_income + other;
};

const payday = (u: Pick<CoupleUser, 'payday' | 'payday_last'> | null): BaseDay | null =>
  !u ? null : u.payday_last ? 'last' : (u.payday ?? null);

export function coupleOf(me: CoupleUser, sp: CoupleSpace, partner: CoupleUser | null): Couple {
  const joined = sp.couple_state === 'connected' || sp.couple_state === 'unlink_pending';
  const starter = !sp.created_by || sp.created_by === me.id;
  const ratio = sp.split_ratio ?? 50;
  // 합류 중(아직 연결 전)인 사람도 배우자는 프로필로 본다
  const real = joined || !starter ? partner : null;
  return {
    joined,
    solo: sp.couple_state === 'solo',
    starter,
    myName: me.nickname ?? '',
    partnerName: real ? (real.nickname ?? '') : (sp.partner_nickname ?? ''),
    myIncome: incomeOf(me),
    partnerIncome: real ? incomeOf(real) : sp.partner_income_unknown ? null : sp.partner_income,
    partnerUnknown: real ? real.monthly_income === null : sp.partner_income_unknown,
    partnerEstimated: real ? false : sp.partner_income_estimated,
    myAllowance: me.allowance,
    partnerAllowance: real ? real.allowance : null,
    myRatio: starter ? ratio : 100 - ratio,
    myPayday: payday(me),
    partnerPayday: payday(real),
  };
}

/** 기본 기준일 = 두 월급날 중 늦은 날(합류 전은 내 월급날) */
export const coupleBaseDay = (c: Couple): BaseDay | null =>
  defaultBaseDay(c.joined ? [c.myPayday, c.partnerPayday] : [c.myPayday]);

/** 공간 기준일: 정해 둔 값, 없으면 두 월급날 중 늦은 날(아는 것만) */
export const spaceBaseDay = (
  sp: { base_day: number | null; base_day_last: boolean },
  c: Couple,
): BaseDay | null =>
  sp.base_day_last ? 'last' : (sp.base_day ?? defaultBaseDay([c.myPayday, c.partnerPayday]));

/** 안 나눈 통장 줄의 새 분담액(금액은 그대로, 줄마다 06 4장 분담). 합류 완료, 분담 제안 적용 뒤 */
export function pendingShares(
  lines: { target: string; state: string; account_role: string | null; amount: Won }[],
  o: { mode: SplitMode; myRatio: number; myIncome: Won; partnerIncome: Won; iAmGroom: boolean },
) {
  return lines
    .filter((l) => l.target === 'account' && l.state === 'pending' && l.account_role)
    .map((l) => {
      const x = splitShares({
        total: l.amount,
        mode: o.mode,
        myRatio: o.myRatio,
        myIncome: o.myIncome,
        partnerIncome: o.partnerIncome,
      });
      return {
        account_role: l.account_role as string,
        amount_groom: o.iAmGroom ? x.me : x.partner,
        amount_bride: o.iAmGroom ? x.partner : x.me,
      };
    });
}
