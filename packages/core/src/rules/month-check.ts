import { daysBetween } from '../date';
import { confirmFinish, type ConfirmLine } from './pay-confirm';

// W-02 이번 달 월급 체크 새 구조(docs/spec/20-salary-plan.md W-02, 2026-11-19 사용자 결정): 계획 합 큰 금액, 보조 한 줄,
// 필터 칩 개수, 한 목록 정렬, 다 확인 상태(제목, 저축·투자 합).

export interface CheckLineLike extends ConfirmLine {
  sort?: number;
  planned?: number;
  actual?: number | null;
}

/** 큰 금액 = 이번 사이클 계획 합(손 줄 + 자동 줄, 건너뛴 줄도 계획 금액 그대로) */
export const plannedSum = (lines: readonly CheckLineLike[]) =>
  lines.reduce((s, l) => s + (l.planned ?? 0), 0);

/** 칩 숫자: 전체 / 남음(대기) / 완료(체크 + 건너뜀). checked·skipped는 글자용(건너뜀은 ‘확인’ 개수에 안 넣음, 2026-11-19) */
export function chipCounts(lines: readonly ConfirmLine[]) {
  const left = lines.filter((l) => l.state === 'wait').length;
  const skipped = lines.filter((l) => l.state === 'skipped').length;
  return {
    all: lines.length,
    left,
    done: lines.length - left,
    skipped,
    checked: lines.length - left - skipped,
  };
}

export type CheckChip = 'all' | 'left' | 'done';

/**
 * 한 목록 정렬: 남은 줄(대기, 손 줄·자동 줄) 먼저, 확인한 줄(체크, 건너뜀) 아래. 각 안에서는 템플릿 순서(sort) 그대로
 * (sort가 없으면 들어온 순서). 칩이 ‘남음’이면 남은 줄만, ‘완료’면 확인한 줄만, ‘전체’면 둘 다(남은 줄 먼저)
 */
export function splitCheckLines<T extends CheckLineLike>(
  lines: readonly T[],
  chip: CheckChip = 'all',
): { open: T[]; done: T[] } {
  const ordered = lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.sort ?? 0) - (b.l.sort ?? 0) || a.i - b.i)
    .map((x) => x.l);
  return {
    open: chip === 'done' ? [] : ordered.filter((l) => l.state === 'wait'),
    done: chip === 'left' ? [] : ordered.filter((l) => l.state !== 'wait'),
  };
}

/**
 * 보조 한 줄(큰 금액 아래): 월급날 전은 “D-6, 5개”(당일 이하는 “D-day, 5개”), 그 뒤는 “5개 중 2개 확인”(지난 달 읽기 전용도 같음).
 * 확인 개수에는 건너뛴 줄을 넣지 않고, 건너뜀이 있으면 “, 1개 건너뜀”을 붙임(2026-11-19)
 */
export function heroMeta(
  o:
    | { preview: { today: string; payday: string; count: number } }
    | { lines: readonly ConfirmLine[] },
): string {
  if ('preview' in o) {
    const days = daysBetween(o.preview.today, o.preview.payday);
    return `${days > 0 ? `D-${days}` : 'D-day'}, ${o.preview.count}개`;
  }
  const c = chipCounts(o.lines);
  return `${c.all}개 중 ${c.checked}개 확인${c.skipped > 0 ? `, ${c.skipped}개 건너뜀` : ''}`;
}

/**
 * 다 확인 상태에서 접힌 줄 글자(2026-11-19): 건너뜀이 없으면 “5개 모두 확인했어요”(자동 줄이 남았으면 “5개 확인했어요”),
 * 있으면 “5개 확인, 1개 건너뜀”
 */
export function foldText(lines: readonly ConfirmLine[]): string {
  const c = chipCounts(lines);
  if (c.skipped > 0) return `${c.checked}개 확인, ${c.skipped}개 건너뜀`;
  return c.left === 0 ? `${c.all}개 모두 확인했어요` : `${c.checked}개 확인했어요`;
}

/**
 * 다 확인 상태(손 줄을 모두 체크 또는 건너뜀, 07 7장): 손 줄을 모두 계획대로 했으면 'all'(“이번 달도 계획대로!”),
 * 건너뜀이나 다른 금액이 섞였으면 'mixed'(“이번 달 확인 끝”). 아직이면 null.
 * 손 줄이 하나도 없으면(자동 줄뿐, 2026-11-25 사용자 확정 첫 사용 화면) 자동 줄이 모두 확인됐어도 null: 아무것도 안 한 첫날에
 * 축하 화면이 뜨던 것(합쳐서 엔진) → 다 확인 축하는 사용자가 손 줄을 확인했을 때만(이 달은 평소 목록 + “자동으로 나가요” 안내).
 * 줄이 하나도 없어도 null
 */
export function doneState(lines: readonly CheckLineLike[]): 'all' | 'mixed' | null {
  if (!lines.some((l) => !l.auto)) return null;
  const f = confirmFinish(lines);
  if (!f) return null;
  const changed = lines.some(
    (l) => !l.auto && l.state === 'checked' && l.actual != null && l.actual !== l.planned,
  );
  return f === 'all' && !changed ? 'all' : 'mixed';
}

/** 이번 사이클에 확인한 저축·투자 합(다른 금액이면 그 금액, 건너뜀은 0). 0이면 알약을 숨김 */
export const savedSum = (lines: readonly (CheckLineLike & { kind?: string })[]) =>
  lines
    .filter((l) => l.kind === 'saving' && l.state === 'checked')
    .reduce((s, l) => s + (l.actual ?? l.planned ?? 0), 0);
