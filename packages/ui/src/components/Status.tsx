import type { ReactNode } from 'react';

// 어드민 표의 상태 값: 작은 점 + 글자(docs/design/components/Status.md, 2026-11-06).
// 색은 점에만, 글자는 본문 색 그대로라 표가 단정하게 보임.
export type StatusTone = 'ok' | 'warn' | 'bad' | 'info' | 'off';

export function Status({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`hg-status hg-status--${tone}`}>{children}</span>;
}
