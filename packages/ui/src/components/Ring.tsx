import type { CSSProperties } from 'react';

// 묶음 진행 원(docs/design/components/Ring.md). 카카오뱅크 체크리스트처럼 “2/4”를 원 안에, 둘레를 한 만큼 채움.
export function Ring({ done, total, label }: { done: number; total: number; label: string }) {
  const p = total > 0 ? Math.round((Math.min(done, total) * 100) / total) : 0;
  return (
    <span className="hg-ring" role="img" aria-label={label} style={{ '--p': p } as CSSProperties}>
      <span aria-hidden="true">
        {done}/{total}
      </span>
    </span>
  );
}
