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

/**
 * 만 원 단위로 읽어 주기(docs/spec/12-question-pattern.md Q3 ‘읽기 형식’)
 * 5,000 → "5,000원", 3,200,000 → "320만 원", 3,205,000 → "320만 5,000원",
 * 120,000,000 → "1억 2,000만 원", 200,000,000 → "2억 원"
 */
export function readWon(value: Won): string {
  const v = assertWon(value);
  if (v < 0) return `−${readWon(-v)}`;
  if (v === 0) return '0원';
  const eok = Math.floor(v / 100_000_000);
  const man = Math.floor((v % 100_000_000) / 10_000);
  const won = v % 10_000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (won) parts.push(`${won.toLocaleString('ko-KR')}원`);
  return won ? parts.join(' ') : `${parts.join(' ')} 원`;
}

/**
 * 합계 표기(docs/spec/11-common.md 6장 ‘음수·큰 금액’, 2026-11-12 QA 8구간 S8-02): 999억 원 안이면 readWon,
 * 넘으면 “999억+”(음수는 “−999억+”). 항목 하나는 999억까지라 여러 항목의 합계(순자산, 자산·부채 합계)에 씀
 */
export function readWonCap(value: number): string {
  if (Number.isFinite(value) && Math.abs(value) > MAX_WON) return `${value < 0 ? '−' : ''}999억+`;
  return readWon(value);
}

/** 1만 원 단위 올림(월 필요액, docs/spec/06-calc-allocation.md 5-3) */
export const ceilTo10k = (v: Won): Won => Math.ceil(assertWon(v) / 10_000) * 10_000;
