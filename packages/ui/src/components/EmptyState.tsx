import type { ReactNode } from 'react';
import { Illustration } from './Illustration';

// 내용이 없을 때. 무엇이 생길지와 첫 행동 1개만(docs/design/components/EmptyState.md)
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="hg-empty">
      <Illustration name="empty-plate" className="hg-empty__art" />
      <p className="hg-empty__title">{title}</p>
      {body && <p className="hg-empty__body">{body}</p>}
      {action}
    </div>
  );
}
