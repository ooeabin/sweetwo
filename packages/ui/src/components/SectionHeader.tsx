import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function SectionHeader({
  title,
  count,
  more,
  lead,
  action,
  onTitle,
  titleLabel,
}: {
  title: ReactNode;
  /** 제목 앞(묶음 진행 Ring 등) */
  lead?: ReactNode;
  count?: ReactNode;
  more?: { label: string; href: string };
  /** 오른쪽 끝 글자 버튼(W-02 묶음 ‘모두 보냈어요’, 2026-11-09 round 3). more와 같이 쓰지 않음 */
  action?: ReactNode;
  /** 제목을 누르면 이동(W-02·W-01 저금 묶음 → 저금 목록 W-13). 제목 뒤에 작은 꺾쇠 */
  onTitle?: () => void;
  /** 제목 버튼의 화면 읽기 이름(제목 글자만으로 갈 곳을 알기 어려울 때) */
  titleLabel?: string;
}) {
  return (
    <div className="hg-sechead">
      {lead}
      <h2 className="hg-sechead__title">
        {onTitle ? (
          <button
            type="button"
            className="hg-sechead__link"
            aria-label={titleLabel}
            onClick={onTitle}
          >
            {title}
            <Icon name="chevron-right" size={16} />
          </button>
        ) : (
          title
        )}
      </h2>
      {count !== undefined && <span className="hg-sechead__count">{count}</span>}
      {more && (
        <a className="hg-sechead__more" href={more.href}>
          {more.label}
          <Icon name="chevron-right" size={16} />
        </a>
      )}
      {action && <span className="hg-sechead__action">{action}</span>}
    </div>
  );
}
