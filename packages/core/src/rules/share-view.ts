import type { Won } from '../money';
import type { SplitKind } from './salary-split';

// 공개 단계(docs/spec/08 v2.2, 25 S-13·S-13p, ADR 0009 결정 7, F10).
// 서버 필터 하나 partner_plan_view·plan_row_visible(마이그레이션 20261202090000_v22_manage_share 계약 3)와 같은 규칙.
// 각자 계열에서만 뜻이 있음(같이 계열 = 모두 보임). 해제 대기면 상대 것은 모두 가림.

export type PlanShare = 'all' | 'saving_only' | 'done_only';
export const PLAN_SHARES: readonly PlanShare[] = ['all', 'saving_only', 'done_only'];
/** 기본값(S-13 ①, 서버 app_user.plan_share 기본) */
export const DEFAULT_PLAN_SHARE: PlanShare = 'saving_only';

export interface ShareContext {
  share: PlanShare;
  /** 엔진 합쳐서(같이 계열) */
  joint: boolean;
  /** 연결 해제 대기 */
  unlinkPending?: boolean;
}

/** 그 줄이 상대에게 보이나(서버 plan_row_visible + partner_plan_view 줄 고르기) */
export function partnerLineVisible(kind: SplitKind, c: ShareContext): boolean {
  if (c.unlinkPending) return false;
  if (c.joint || c.share === 'all') return true;
  if (c.share === 'saving_only') return kind === 'saving' || kind === 'shared_account';
  return kind === 'saving';
}

/** 줄 금액이 보이나(done_only는 확인 여부만) */
export const partnerAmountVisible = (c: ShareContext) =>
  !c.unlinkPending && (c.joint || c.share !== 'done_only');

/** 수입·월급날이 보이나(같이 계열 또는 ‘모두’) */
export const partnerIncomeVisible = (c: ShareContext) =>
  !c.unlinkPending && (c.joint || c.share === 'all');

export interface PlanViewLine {
  id: string;
  kind: SplitKind;
  goal_id: string | null;
  name: string | null;
  user_id: string | null;
  amount: Won;
  in_checklist: boolean;
  auto_pay: boolean;
  state: string | null;
}

/** 서버 partner_plan_view 응답 모양(Zod는 schemas/v22.ts PartnerPlanViewSchema) */
export interface PartnerPlanView {
  owner: string;
  nickname: string | null;
  share: PlanShare;
  mode: 'separate' | 'joint';
  hidden: boolean;
  income: Won | null;
  payday: number | null;
  lines: (Omit<PlanViewLine, 'amount'> & { amount: Won | null })[];
}

/**
 * 상대에게 보이는 월급 계획(서버 partner_plan_view와 같은 자르기, S-13p 미리 보기 비교·테스트용).
 * payday는 1~31(말일 = 31)
 */
export function partnerPlanView(o: {
  owner: string;
  nickname: string | null;
  share: PlanShare;
  joint: boolean;
  unlinkPending: boolean;
  income: Won | null;
  payday: number | null;
  lines: readonly PlanViewLine[];
}): PartnerPlanView {
  const c: ShareContext = { share: o.share, joint: o.joint, unlinkPending: o.unlinkPending };
  const base = {
    owner: o.owner,
    nickname: o.nickname,
    share: o.share,
    mode: o.joint ? ('joint' as const) : ('separate' as const),
  };
  if (o.unlinkPending) return { ...base, hidden: true, income: null, payday: null, lines: [] };
  const showAmount = partnerAmountVisible(c);
  return {
    ...base,
    hidden: false,
    income: partnerIncomeVisible(c) ? o.income : null,
    payday: partnerIncomeVisible(c) ? o.payday : null,
    lines: o.lines
      .filter((l) => partnerLineVisible(l.kind, c))
      // done_only는 저금 이름도 주지 않음(2026-11-13 P1 = A, 서버 20261208090000 계약 1)
      .map((l) => ({
        ...l,
        name: showAmount ? l.name : null,
        amount: showAmount ? l.amount : null,
      })),
  };
}

/** 좁혔나(가드레일 ‘공개 좁히기’, 32 8-3): all > saving_only > done_only 순서에서 뒤로 감 */
export const shareNarrowed = (from: PlanShare, to: PlanShare) =>
  PLAN_SHARES.indexOf(to) > PLAN_SHARES.indexOf(from);

/**
 * 분담 ‘월급 비율’을 고를 수 있나(서버 propose_split 'not_allowed', 06 3-7): 두 사람 모두 ‘모두’ 공개이고 월급이 있음
 */
export const incomeRatioAllowed = (
  a: { share: PlanShare; income: Won | null },
  b: { share: PlanShare; income: Won | null },
) => a.share === 'all' && b.share === 'all' && (a.income ?? 0) > 0 && (b.income ?? 0) > 0;
