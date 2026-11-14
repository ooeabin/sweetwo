import type { Won } from '../money';
import { savingPct } from './saving-item';

// 같이 모으기 묶음(docs/spec/06 5-6, 20 W-15, ADR 0009 결정 4, G1).
// 서버 bundle_view·bundle_refresh·bundle_set_visibility(마이그레이션 20261203090000_v22_saving_together 계약 4)와 같은 결과.
// 구성원 a = 만든 사람, b = 상대. 합계는 늘 둘 다, 각자 금액은 show_each_a and show_each_b일 때만,
// percent_only_a or percent_only_b면 둘 모두에게 합계·목표 금액·각자 금액 없이 %만.
// 2026-11-13(마이그레이션 20261208090000 계약 1): 구성원 중 한 사람이라도 공개 ‘했어요만’이면 각자 금액은 둘 다 꺼진 것처럼,
// 그 사람의 묶인 저금 이름은 상대에게 null.

export interface BundleRow {
  id: string;
  name: string;
  status: 'active' | 'achieved' | 'closed';
  target_amount: Won | null;
  deadline: string | null;
  member_a: string;
  member_b: string | null;
  show_each_a: boolean;
  show_each_b: boolean;
  percent_only_a: boolean;
  percent_only_b: boolean;
}

export interface BundleGoal {
  id: string;
  name: string;
  owner_user_id: string | null;
  saved: Won;
}

/** 서버 bundle_view 원소와 같은 모양(앱은 서버 응답을 그대로 쓰고, 이 함수는 미리 보기·테스트용) */
export interface BundleView {
  id: string;
  name: string;
  status: BundleRow['status'];
  deadline: string | null;
  /** 해제 대기: 상대 몫을 빼고 멈춤 */
  paused: boolean;
  percent_only: boolean;
  show_each: boolean;
  my_show_each: boolean;
  my_percent_only: boolean;
  /** 진행률(목표 금액이 있을 때만) */
  pct: number | null;
  total: Won | null;
  target: Won | null;
  mine: Won | null;
  partner: Won | null;
  /** 이번 달 +(서버 bundle_month_gain, 06 5-6). 퍼센트만·해제 대기면 null, 옛 응답은 없음 */
  month_gain?: Won | null;
  /** 상대가 ‘했어요만’이면 상대 저금 이름은 null */
  goals: { id: string; mine: boolean; name: string | null }[];
}

/** 묶음 진행률: 내림(합계 × 100 ÷ 목표 금액), 최대 100. 목표 금액이 없거나 0이면 null(06 5-1과 같음) */
export const bundlePct = (total: Won, target: Won | null) =>
  target !== null && target > 0 ? savingPct(total, target) : null;

/** 묶음 응답(서버 bundle_view): 보는 사람(meId) 기준으로 자름 */
export function bundleView(
  b: BundleRow,
  goals: readonly BundleGoal[],
  meId: string,
  paused = false,
  /** 공개 ‘했어요만’인 구성원 id(각자 계열) */
  doneOnly: readonly string[] = [],
): BundleView {
  const mine = goals.filter((g) => g.owner_user_id === meId).reduce((t, g) => t + g.saved, 0);
  const theirs = paused
    ? 0
    : goals.filter((g) => g.owner_user_id !== meId).reduce((t, g) => t + g.saved, 0);
  const total = mine + theirs;
  const pctOnly = b.percent_only_a || b.percent_only_b;
  const each =
    b.show_each_a && b.show_each_b && !doneOnly.some((u) => u === b.member_a || u === b.member_b);
  // 상대 개인 저금을 가림(서버 saving_owner_hidden): 해제 대기이거나 주인이 ‘했어요만’
  const hiddenOwner = (o: string | null) =>
    o !== null && o !== meId && (paused || doneOnly.includes(o));
  const isA = meId === b.member_a;
  return {
    id: b.id,
    name: b.name,
    status: b.status,
    deadline: b.deadline,
    paused,
    percent_only: pctOnly,
    show_each: each,
    my_show_each: isA ? b.show_each_a : b.show_each_b,
    my_percent_only: isA ? b.percent_only_a : b.percent_only_b,
    pct: bundlePct(total, b.target_amount),
    total: pctOnly ? null : total,
    target: pctOnly ? null : b.target_amount,
    mine: pctOnly ? null : mine,
    partner: pctOnly || !each ? null : theirs,
    goals: goals.map((g) => ({
      id: g.id,
      mine: g.owner_user_id === meId,
      name: hiddenOwner(g.owner_user_id) ? null : g.name,
    })),
  };
}

/** ‘퍼센트만 보여 주기’를 켤 수 있나(목표 금액이 있을 때만, 서버 'no_target') */
export const canPercentOnly = (target: Won | null) => target !== null && target > 0;

/** 묶음 목표 금액 처음 값(Q11): 두 저금 목표 금액이 모두 있으면 합, 아니면 null(빈 칸) */
export const bundleTargetDefault = (a: Won | null, b: Won | null): Won | null =>
  a !== null && b !== null ? a + b : null;

/**
 * 달성 상태 다음 값(서버 bundle_refresh): 목표 금액이 있고 닫히지 않았을 때 합계 ≥ 목표 금액이면 achieved,
 * 달성이었는데 내려가면 active로 되돌림. 그 밖은 그대로
 */
export function bundleNextStatus(
  status: BundleRow['status'],
  total: Won,
  target: Won | null,
): BundleRow['status'] {
  if (status === 'closed' || target === null || target === 0) return status;
  if (status === 'active' && total >= target) return 'achieved';
  if (status === 'achieved' && total < target) return 'active';
  return status;
}

/** 묶음 예상 달성일의 매달 금액(06 5-6): 묶인 저금 줄 금액 합 */
export const bundleMonthly = (lines: readonly { amount: Won }[]) =>
  lines.reduce((t, l) => t + Math.max(l.amount, 0), 0);

/**
 * 묶음은 한 쌍에 하나씩(20 W-15 ‘묶음 하나씩’, 서버 bundle_create 'bundle_open', 2026-11-14 H1).
 * 들어갈 묶음 = 상대 저금만 든 열린 묶음(내가 아직 안 들어감), 기다리는 묶음 = 내 저금만 든 열린 묶음.
 * 이런 묶음이 있으면 새로 만들기 전에 들어가기(또는 사용자가 ‘따로 모을게요’를 고름)
 */
export const joinableBundle = <B extends Pick<BundleView, 'status' | 'goals'>>(
  bundles: readonly B[],
): B | undefined =>
  bundles.find((b) => b.status !== 'closed' && b.goals.length > 0 && !b.goals.some((g) => g.mine));
export const waitingBundle = <B extends Pick<BundleView, 'status' | 'goals'>>(
  bundles: readonly B[],
): B | undefined =>
  bundles.find((b) => b.status !== 'closed' && b.goals.length > 0 && b.goals.every((g) => g.mine));

/**
 * 홈 H-09 ‘저금’ 합(19, 2026-11-14 M1): H-10 같이 모으기와 같은 숫자가 되게 묶인 저금은 묶음 합계로 한 번만 셈.
 * 묶이지 않은 저금 모은 금액 합 + 묶음마다 합계(퍼센트만이라 합계가 없으면 내 저금 모은 금액만).
 * 개수도 묶음을 하나로(묶이지 않은 저금 수 + 묶음 수)
 */
export function savingsTotal(
  items: readonly { id: string; saved: Won; bundle_id: string | null }[],
  bundles: readonly Pick<BundleView, 'id' | 'status' | 'total' | 'goals'>[],
): { count: number; total: Won } {
  const open = bundles.filter((b) => b.status !== 'closed');
  const inOpen = new Set(open.map((b) => b.id));
  const loose = items.filter((i) => !i.bundle_id || !inOpen.has(i.bundle_id));
  const savedOf = new Map(items.map((i) => [i.id, i.saved]));
  const bundleSum = open.reduce(
    (t, b) =>
      t +
      (b.total ?? b.goals.filter((g) => g.mine).reduce((s, g) => s + (savedOf.get(g.id) ?? 0), 0)),
    0,
  );
  return {
    count: loose.length + open.length,
    total: loose.reduce((t, i) => t + i.saved, 0) + bundleSum,
  };
}
