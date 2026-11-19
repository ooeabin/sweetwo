import { daysBetween } from '../date';
import { isManual, type ConfirmLine } from './pay-confirm';

// W-02 이번 달 월급 체크 새 구조(docs/spec/20-salary-plan.md W-02, 2026-11-19 사용자 결정): 큰 숫자 문구, 칸 막대, 한 목록 정렬.

/** 칸 막대 칸 수의 한계: 줄이 이보다 많으면 칸 대신 이어진 막대(2026-11-19) */
export const MAX_CELLS = 12;

/** 칸 막대: 칸 수 = 손 줄 + 자동 줄 수, 채운 칸 = 확인했거나 건너뛴 줄(대기가 아닌 줄). 12개를 넘으면 이어진 막대 */
export function checkCells(lines: readonly ConfirmLine[]): {
  total: number;
  filled: number;
  segmented: boolean;
} {
  const total = lines.length;
  return {
    total,
    filled: lines.filter((l) => l.state !== 'wait').length,
    segmented: total > 0 && total <= MAX_CELLS,
  };
}

/**
 * 한 목록 정렬: 남은 줄(대기, 손 줄·자동 줄) 먼저, 확인한 줄(체크, 건너뜀) 아래. 각 안에서는 템플릿 순서(sort) 그대로.
 * sort가 없으면 들어온 순서
 */
export function splitCheckLines<T extends ConfirmLine & { sort?: number }>(
  lines: readonly T[],
): { open: T[]; done: T[] } {
  const ordered = lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.sort ?? 0) - (b.l.sort ?? 0) || a.i - b.i)
    .map((x) => x.l);
  return {
    open: ordered.filter((l) => l.state === 'wait'),
    done: ordered.filter((l) => l.state !== 'wait'),
  };
}

/** 큰 숫자 문구 한 줄(W-02, 홈 월급 상자 “n개 남음”과 같은 말) */
export type CheckHeadline = { kind: 'dday' | 'left' | 'done'; text: string };

/**
 * 큰 숫자 고르기: 월급날 전(미리 보기)은 “D-6”, 확인 중은 “3개 남음”(남은 손 줄 수), 손 줄을 다 끝냈으면 “확인 끝”(07 7장과 같은 기준).
 * 월급날 당일(0일 이하)은 목록이 생기므로 미리 보기에서는 “D-day”
 */
export function checkHeadline(
  o: { preview: { today: string; payday: string } } | { lines: readonly ConfirmLine[] },
): CheckHeadline {
  if ('preview' in o) {
    const days = daysBetween(o.preview.today, o.preview.payday);
    return { kind: 'dday', text: days > 0 ? `D-${days}` : 'D-day' };
  }
  const left = o.lines.filter((l) => isManual(l) && l.state === 'wait').length;
  return left > 0 ? { kind: 'left', text: `${left}개 남음` } : { kind: 'done', text: '확인 끝' };
}
