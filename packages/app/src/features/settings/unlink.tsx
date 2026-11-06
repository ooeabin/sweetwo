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
