import type { ReactNode } from 'react';
import { Illustration } from './Illustration';

// 내용이 없을 때. 무엇이 생길지와 첫 행동 1개만(docs/design/components/EmptyState.md)
export function EmptyState({
  title,
  body,
  action,
  list,
}: {
  /** 없으면 그림 자리 + 행동만(2026-11-11 Y-01 경조사 빈 상태) */
  title?: string;
  body?: string;
  action?: ReactNode;
  /** 목록 자리의 빈 안내(공지·알림·내역 …): 한 줄 글자를 slate로(2026-11-20). 큰 그림 있는 상태 화면은 쓰지 않음 */
  list?: boolean;
}) {
  return (
    <div className={list ? 'hg-empty hg-empty--list' : 'hg-empty'}>
      <Illustration name="empty-plate" className="hg-empty__art" />
      {title && <p className="hg-empty__title">{title}</p>}
      {body && <p className="hg-empty__body">{body}</p>}
      {action}
    </div>
  );
}
