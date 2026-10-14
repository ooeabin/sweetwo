import type { ReactNode } from 'react';

// 상태, 영역 알약. 글자 1~4자(docs/design/components/Badge.md)
export type BadgeKind =
  'temp' | 'done' | 'achieved' | 'warn' | 'together' | 'family' | 'goal' | 'safety' | 'invest';

export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  return <span className={`hg-badge hg-badge--${kind}`}>{children}</span>;
}
