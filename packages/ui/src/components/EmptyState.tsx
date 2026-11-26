import type { ReactNode } from 'react';
import { Illustration } from './Illustration';
import { StickyBar } from './StickyBar';

// 내용이 없을 때. 무엇이 생길지와 첫 행동 1개만(docs/design/components/EmptyState.md)
export function EmptyState({
  title,
  body,
  action,
  list,
  page,
  actionPlacement = 'inline',
}: {
  /** 없으면 그림 자리 + 행동만(2026-11-11 Y-01 경조사 빈 상태) */
  title?: string;
  body?: string;
  action?: ReactNode;
  /** 목록 자리의 빈 안내(공지·알림·내역 …): 한 줄 글자를 slate로(2026-11-20). 큰 그림 있는 상태 화면은 쓰지 않음 */
  list?: boolean;
  /** 화면 전체가 빈 목록이면 가운데쯤에 둠(2026-11-23 W-21, W-14) */
  page?: boolean;
  /**
   * 다음 행동 자리(2026-11-26 ‘빈 상태 A안’).
   * - 'bottom': 화면 전체가 빈 상태 → 아래 고정 주 버튼(StickyBar, `action`은 `variant="primary" block` 버튼). W-02와 같음
   * - 'inline'(기본): 화면 일부(묶음·구역)만 빈 상태 → 제목 바로 아래 회색 보조 버튼(`variant="secondary"`, 보통 크기)
   */
  actionPlacement?: 'bottom' | 'inline';
}) {
  const bottom = actionPlacement === 'bottom' && !!action;
  return (
    <>
      <div
        className={`hg-empty${list ? ' hg-empty--list' : ''}${page ? ' hg-empty--page' : ''}${bottom ? ' hg-empty--fill' : ''}`}
      >
        <Illustration name="empty-plate" className="hg-empty__art" />
        {title && <p className="hg-empty__title">{title}</p>}
        {body && <p className="hg-empty__body">{body}</p>}
        {!bottom && action}
      </div>
      {bottom && <StickyBar>{action}</StickyBar>}
    </>
  );
}
