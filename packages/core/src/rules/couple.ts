import type { Won } from '../money';
import type { BaseDay } from '../onboarding/cycle';
import { defaultBaseDay } from '../onboarding/cycle';

// 두 사람 기준(docs/spec/18-partner-join.md, 06 3·4장). 화면은 항상 ‘나’와 ‘배우자’로 본다.
// 합류 전: 배우자 이름 = 시작한 사람이 적은 호칭(couple_space.partner_nickname), 배우자 수입은 모름(추정 없음, 08 9장).
// 합류 뒤: 배우자 값 = 배우자 본인 값(partner_profile).

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
}

export interface Couple {
  joined: boolean;
  solo: boolean;
  /** 내가 공간을 시작한 사람인지 */
  starter: boolean;
  myName: string;
  partnerName: string;
  myIncome: Won | null;
  /** 합류 전이면 null(모름) */
  partnerIncome: Won | null;
  myAllowance: Won | null;
  partnerAllowance: Won | null;
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
  // 합류 중(아직 연결 전)인 사람도 배우자는 프로필로 본다
  const real = joined || !starter ? partner : null;
  return {
    joined,
    solo: sp.couple_state === 'solo',
    starter,
    myName: me.nickname ?? '',
    partnerName: real ? (real.nickname ?? '') : (sp.partner_nickname ?? ''),
    myIncome: incomeOf(me),
    partnerIncome: real ? incomeOf(real) : null,
    myAllowance: me.allowance,
    partnerAllowance: real ? real.allowance : null,
    myPayday: payday(me),
    partnerPayday: payday(real),
  };
}

/** 기본 기준일 = 두 월급날 중 늦은 날(합류 전은 내 월급날) */
export const coupleBaseDay = (c: Couple): BaseDay | null =>
  defaultBaseDay(c.joined ? [c.myPayday, c.partnerPayday] : [c.myPayday]);
