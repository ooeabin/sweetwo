import type { Won } from '../money';

// W-01 저축·투자 줄 보조 줄(docs/spec/20-salary-plan.md W-01 5c, 2026-11-19 사용자 결정: 짧게).
// - 모은 금액이 0원이면 “모은 금액 0원”을 뺌
// - 목표 금액이 있고 모은 금액이 0원이면 “목표 금액 300만 원”
// - 모은 금액이 있으면 “모은 금액 220만 원”, 목표 금액이 있으면 뒤에 “, 목표 금액의 22%”(달성이면 “, 달성”)
// - 같이 모으기에 든 저금은 내 몫만(“내 몫 220만 원”, 0원이면 뺌)
// 자동 줄의 “25일 자동”은 앞에 두고 이 글자는 뒤에 이음(한 줄을 넘으면 뒤가 말줄임): `joinLineNote`

export interface SavingNoteInput {
  /** 모은 금액(같이 모으기면 내 몫) */
  saved: Won;
  /** 목표 금액(없으면 null) */
  target: Won | null;
  /** 목표 금액 대비 % (정수, 목표가 있을 때) */
  pct: number | null;
  achieved: boolean;
  /** 같이 모으기 묶음에 든 저금: 내 몫만 보이고 목표 비율은 없음 */
  bundled: boolean;
}

/**
 * 저축·투자 줄 보조 줄 조각(W-01 시안 2026-11-23): 모은 게 없으면 “목표 금액 300만 원”, 모은 게 있으면 진행만 “목표 금액의 14%”
 * (모은 금액 문구는 없앰, 목표 금액이 없으면 보일 말 없음, 다 모았으면 “달성”). 보일 말이 없으면 undefined. won = 금액 글자(가리기 포함)
 */
export function savingLineNote(o: SavingNoteInput, won: (n: Won) => string): string | undefined {
  if (o.bundled) return o.saved > 0 ? `내 몫 ${won(o.saved)}` : undefined;
  if (o.saved <= 0)
    return o.target !== null && o.target > 0 ? `목표 금액 ${won(o.target)}` : undefined;
  if (o.target === null) return undefined;
  return o.achieved ? '달성' : `목표 금액의 ${o.pct ?? 0}%`;
}

/** 나가는 날 짧은 글자 “25일 자동”(day = “25일”, “말일”, “월급날”) */
export const autoShort = (day: string) => `${day} 자동`;

/** 줄 보조 줄 이음: 자동 정보를 맨 앞에 두고 나머지를 뒤에(화면은 한 줄, 넘치면 뒤쪽 말줄임) */
export function joinLineNote(
  auto: string | undefined,
  rest: (string | undefined)[],
): string | undefined {
  const parts = [auto, ...rest].filter((x): x is string => !!x);
  return parts.length ? parts.join(', ') : undefined;
}
