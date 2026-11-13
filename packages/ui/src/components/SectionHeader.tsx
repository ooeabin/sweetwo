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
  variant,
  countLabel,
  meta,
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
  /** 카드 안 묶음 머리(2026-11-09 밀도, `hg-sechead--group`): 제목 15px + 개수(count)를 제목 바로 뒤 조용한 글자로 */
  variant?: 'group';
  /** group 개수의 화면 읽기 문장(“2개 중 0개 완료”). 보이는 “0/2”는 화면 읽기에서 숨김 */
  countLabel?: string;
  /** 제목 아래 조용한 한 줄(W-02 기간과 진행, 2026-11-09). 오른쪽 action과 같은 줄 */
  meta?: ReactNode;
}) {
  const group = variant === 'group';
  const inlineCount =
    group && count !== undefined ? (
      <span className="hg-sechead__count" aria-hidden={countLabel ? true : undefined}>
        {count}
      </span>
    ) : null;
  const heading = (
    <h2 className="hg-sechead__title">
      {onTitle ? (
        <button
          type="button"
          className="hg-sechead__link"
          aria-label={titleLabel}
          onClick={onTitle}
        >
          {title}
          {inlineCount}
          <Icon name="chevron-right" size={16} />
        </button>
      ) : (
        <>
          {title}
          {inlineCount}
        </>
      )}
    </h2>
  );
  return (
    <div className={group ? 'hg-sechead hg-sechead--group' : 'hg-sechead'}>
      {lead}
      {meta ? (
        <span className="hg-sechead__titles">
          {heading}
          <span className="hg-sechead__meta">{meta}</span>
        </span>
      ) : (
        heading
      )}
      {group && countLabel && <span className="hg-sr">{countLabel}</span>}
      {!group && count !== undefined && <span className="hg-sechead__count">{count}</span>}
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
