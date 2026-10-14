// 금액은 정수 원 단위만 다룬다(부동소수점 금지). 입력 상한 999억 원.
export const MAX_WON = 99_999_999_999;

export type Won = number;

export function assertWon(value: number): Won {
  if (!Number.isSafeInteger(value) || value < -MAX_WON || value > MAX_WON) {
    throw new RangeError(`금액은 ±${MAX_WON}원 안의 정수여야 해요: ${value}`);
  }
  return value;
}

/** 1,234,567원 → "1,234,567원" */
export function formatWon(value: Won): string {
  return `${assertWon(value).toLocaleString('ko-KR')}원`;
}

/** 만 원 단위 반올림 표시: 4,534,929 → "453만" (디자인 ‘금액 표기’) */
export function formatManWon(value: Won): string {
  const man = Math.round(assertWon(value) / 10_000);
  return `${man.toLocaleString('ko-KR')}만`;
}
