import { daysBetween, todayKst } from '@sweetwo/core';
import { copy } from './copy';

// 연결 해제 공통(25 S-12a·d): 같이 쓰던 데이터는 나누지 않고 모두 지움(2026-10-26 결정).

/** 지워지는 것(S-12a 2번, S-12d 2번) */
export function UnlinkDeleted() {
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-2)' }}>
      <b>{copy.unlinkAll}</b>
      <ul
        className="hg-stack"
        style={{ gap: 'var(--space-1)', paddingLeft: 'var(--space-5)', margin: 0 }}
      >
        {copy.unlinkList.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

/** 요청부터 오늘까지 날 수(분석 days_pending). 값이 깨졌으면 0 */
export function daysPending(requestedAt: string): number {
  const t = Date.parse(requestedAt);
  return Number.isNaN(t) ? 0 : Math.max(0, daysBetween(todayKst(new Date(t)), todayKst()));
}

// 내보내기를 했는지(32 unlink_resolved exported_data, 2026-11-11 S3-07: 늘 false이던 것). 이 기기에서 S-18 내보내기를 끝낸 시각
const EXPORTED = 'sweetwo.exportedAt';
/** S-18 내보내기 끝(파일 저장)에서 부름 */
export function markExported() {
  try {
    localStorage.setItem(EXPORTED, String(Date.now()));
  } catch {
    /* 기억 못 하면 exported_data는 false로 보냄 */
  }
}
/** 이 연결 해제 요청 뒤(요청 시각 이후) 이 기기에서 내보낸 적이 있는지 */
export function exportedSince(requestedAt: string): boolean {
  try {
    const t = Number(localStorage.getItem(EXPORTED));
    const from = Date.parse(requestedAt);
    return !!t && !Number.isNaN(from) && t >= from;
  } catch {
    return false;
  }
}

/** 최근(기본 24시간) 이 기기에서 내보낸 적이 있는지(분석 unlink_requested exported_data, account_delete_requested exported_before) */
export function exportedRecently(ms = 24 * 60 * 60 * 1000): boolean {
  try {
    const t = Number(localStorage.getItem(EXPORTED));
    return !!t && Date.now() - t <= ms;
  } catch {
    return false;
  }
}

/** S-18로 갔다가 돌아올 곳(S-12a, S-12d, P-02a ‘먼저 내보내기’·‘사본 내려받기’) */
export type DataBack = { back: string; backLabel: string };
