// 동시에 같은 칸을 바꿨을 때(30 동기화 2장, 13 공통 상태 11번 ‘충돌 선택’).
// 저장은 ‘화면을 열 때의 값’이 그대로일 때만 바뀜. 안 바뀌었으면 서버 지금 값을 보고:
// - same: 이미 내가 넣으려던 값(할 일 없음)
// - choose: 배우자가 1분 안에 바꿈 → 나중 저장한 사람(나)에게 “어느 쪽으로 할까요?”
// - overwrite: 그 밖(1분 넘었거나 내가 다른 기기에서 바꿈) → 마지막 저장 우선, 내 값으로 덮음
export type ConflictDecision = 'same' | 'choose' | 'overwrite';
export const CONFLICT_WINDOW_MS = 60_000;

export function conflictDecision(
  current: { updated_by: string | null; updated_at: string } & Record<string, unknown>,
  patch: Record<string, unknown>,
  meId: string,
  now: Date = new Date(),
): ConflictDecision {
  const same = Object.entries(patch).every(([k, v]) => sameValue(current[k], v));
  if (same) return 'same';
  const by = current.updated_by;
  const age = now.getTime() - new Date(current.updated_at).getTime();
  return by && by !== meId && age <= CONFLICT_WINDOW_MS ? 'choose' : 'overwrite';
}

/** 날짜 칸은 ‘2027-12-01’과 ‘2027-12-01T00:00:00’을 같게 봄 */
function sameValue(a: unknown, b: unknown) {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string')
    return a.slice(0, 10) === b.slice(0, 10) && /^\d{4}-\d{2}-\d{2}/.test(a);
  return (a ?? null) === (b ?? null);
}
