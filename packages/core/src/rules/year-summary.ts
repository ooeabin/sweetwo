import type { Won } from '../money';

// PDF 연간 요약(25 S-18 ‘내보내기 명세’ ②): 올해 1~12월 목표에 넣은 돈.
// 넣은 돈 = 그달 월급 체크리스트에서 체크한 저금 줄(실제로 넣은 돈, 없으면 계획 금액). 못 함·체크 안 함은 0.
// 달은 체크리스트가 시작한 달(‘10월 월급’ = 10월).

export interface SavingLine {
  /** 체크리스트 시작일(YYYY-MM-DD) */
  cycleStart: string;
  state: string;
  planned: Won;
  actual: Won | null;
}

/** 1~12월 넣은 돈(인덱스 0 = 1월) */
export function yearlySavings(lines: SavingLine[], year: number): Won[] {
  const out: Won[] = Array.from({ length: 12 }, () => 0);
  for (const l of lines) {
    if (l.state !== 'checked' || Number(l.cycleStart.slice(0, 4)) !== year) continue;
    const m = Number(l.cycleStart.slice(5, 7)) - 1;
    out[m] = (out[m] ?? 0) + (l.actual ?? l.planned);
  }
  return out;
}
