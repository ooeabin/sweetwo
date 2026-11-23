import type { HeroPart } from '@sweetwo/ui';

// 한 화면 입력(FormScreen, 2026-11-23) 순수 규칙: 맨 위 요약 문장, ‘어떻게 챙겨요?’ 구간 값, 필수 검사

/** 어떻게 챙겨요?: check = 월급날 확인 목록에 넣음, auto = 은행에서 자동으로 나가요(나가는 날 앱이 확인), off = 목록에 안 넣음(지출 줄만) */
export type LineMode = 'check' | 'auto' | 'off';

/** 줄 설정(in_checklist, auto_pay) → 구간 값. 자동 줄은 늘 목록에 들어가므로 auto가 먼저 */
export const lineMode = (s: { inChecklist: boolean; autoPay: boolean }): LineMode =>
  s.autoPay ? 'auto' : s.inChecklist ? 'check' : 'off';

/** 구간 값 → 줄 설정(나가는 날은 자동일 때만, null = 월급날) */
export const modeSettings = (mode: LineMode, autoDay: number | null) => ({
  inChecklist: mode !== 'off',
  autoPay: mode === 'auto',
  autoDay: mode === 'auto' ? autoDay : null,
});

/**
 * 요약 문장: 이름 자리는 ink, 금액 자리만 accent. 아직 안 고른 자리는 자리표시.
 * 둘 다 비면 한 줄 “무엇을 매달 얼마씩 모을까요?”, 이름이 있으면 “여행에 / 매달 30만 원씩 모을까요?”
 */
export function formHero(o: {
  name: string;
  amount: number | null;
  /** 동사(“모을까요?” / “쓸까요?”) */
  verb: string;
  /** 이름이 없을 때 자리표시 대명사(“무엇”) */
  what: string;
  /** 금액을 글자로(만 원 단위, 가리기면 •••) */
  money: (v: number) => string;
}): HeroPart[][] {
  const name = o.name.trim();
  if (!name && o.amount === null)
    return [[{ text: `${o.what}을 매달 얼마씩` }], [{ text: o.verb }]];
  const first: HeroPart[] = [{ text: `${name || o.what}에` }];
  const second: HeroPart[] =
    o.amount === null
      ? [{ text: `매달 얼마씩 ${o.verb}` }]
      : [{ text: '매달 ' }, { text: o.money(o.amount), tone: 'accent' }, { text: `씩 ${o.verb}` }];
  return [first, second];
}

/** 저축·투자 추가 필수: 이름 1자 이상, 매달 금액(1만 원 단위, 0원 가능) */
export const savingFormReady = (name: string, monthly: number | null) =>
  name.trim().length > 0 && monthly !== null && monthly % 10_000 === 0;
