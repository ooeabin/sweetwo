import { object, parsePaidCount, parseRate } from '@sweetwo/core';
import type { HeroPart } from '@sweetwo/ui';

// 자산·부채 한 화면 입력(F-03, F-04b 팔았어요, F-04a 만기 정리, FormScreen 2026-11-24) 순수 규칙: 요약 문장, 필수 검사

/**
 * F-03 요약 문장: 이름 자리는 ink, 금액 자리만 accent. 아직 안 고른 자리는 자리표시.
 * 둘 다 비면 “무엇을 / 얼마 적을까요?”, 이름만 있으면 “여행 적금 / 얼마 적을까요?”, 금액까지 있으면 “여행 적금 / 1,200만 원 적을까요?”
 */
export function assetHero(o: {
  name: string;
  amount: number | null;
  /** 금액을 글자로(만 원 단위, 가리기면 •••) */
  money: (v: number) => string;
  /** 이름이 없을 때 자리표시(“무엇을”) */
  what: string;
  /** 금액이 없을 때(“얼마 적을까요?”) */
  ask: string;
  /** 금액 뒤 말(“적을까요?”) */
  verb: string;
}): HeroPart[][] {
  const name = o.name.trim();
  return [
    [{ text: name || o.what }],
    o.amount === null
      ? [{ text: o.ask }]
      : [{ text: o.money(o.amount), tone: 'accent' }, { text: ` ${o.verb}` }],
  ];
}

/** F-04b 요약 문장: “미국 ETF를 팔고 / 840만 원 받았어요”. 받은 금액이 없으면 “얼마 받았어요?” */
export function soldHero(o: {
  name: string;
  received: number | null;
  money: (v: number) => string;
  ask: string;
  verb: string;
  /** “{을를} 팔고” 꼴 */
  sellTail: string;
}): HeroPart[][] {
  return [
    [{ text: `${object(o.name)} ${o.sellTail}` }],
    o.received === null || o.received <= 0
      ? [{ text: o.ask }]
      : [{ text: o.money(o.received), tone: 'accent' }, { text: ` ${o.verb}` }],
  ];
}

/** 만기 정리 요약 문장: “청년 적금 960만 원을 / 어디로 옮길까요?” 꼴은 화면이 문구로 만든다. 여기서는 필수만 */
export interface AssetFormState {
  grp: string | null;
  kind: string | null;
  name: string;
  amount: number | null;
  /** 연결된 두 사람이고 명의가 ‘나’라서 공개 범위를 물음 */
  askVisibility: boolean;
  visibility: 'all' | 'sum' | 'private' | null;
  rateText: string;
  countText: string;
}

/** 필수 검사: 묶음·세부 종류·이름·금액, 공개 범위(물을 때, 미리 고른 값 없음). 금리·회차는 적었으면 규칙 안이어야 함(나중에 해도 됨) */
export function assetFormReady(s: AssetFormState): boolean {
  if (!s.grp || !s.kind || !s.name.trim() || s.amount === null) return false;
  if (s.askVisibility && s.visibility === null) return false;
  if (s.rateText.trim() !== '' && parseRate(s.rateText) === 'bad') return false;
  if (s.countText.trim() !== '' && parsePaidCount(s.countText) === 'bad') return false;
  return true;
}

/** F-04b 필수: 받은 금액(0원 초과), 일부면 남은 평가금액 */
export function soldFormReady(o: {
  received: number | null;
  part: boolean;
  remain: number | null;
}): boolean {
  if (o.received === null || o.received <= 0) return false;
  return !o.part || o.remain !== null;
}

/** 종류별 선택 항목(접힌 줄): 만기일, 납입 회차, 월 납입·상환액, 금리(F-03f~h를 한 화면 줄로) */
export type AssetFold = 'maturity' | 'count' | 'payment' | 'rate';
const SAVINGS = ['saving', 'policy_saving'];
export function assetFolds(o: {
  side: 'asset' | 'debt';
  grp: string | null;
  kind: string | null;
}): AssetFold[] {
  const k = o.kind ?? '';
  const saving = SAVINGS.includes(k);
  const sub = k === 'housing_subscription';
  const out: AssetFold[] = [];
  if (saving || k === 'deposit_money') out.push('maturity');
  if (sub) out.push('count');
  // 부채는 매달 갚는 금액 → 금리 순(주택 대출도 월 상환액이 먼저, 23 F-03g)
  if (saving || sub || o.side === 'debt') out.push('payment');
  if (o.side === 'debt') out.push('rate');
  return out;
}
