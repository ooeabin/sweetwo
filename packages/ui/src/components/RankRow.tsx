import type { ReactNode } from 'react';

// 우리 자산 순위 줄(docs/design/components/RankRow.md, 2026-11-04 토스 혜택 줄처럼): 40px 원(“?%”, “38%”) + 제목 + 오렌지 글자(2026-11-09).
// 광고가 나오면 오렌지 글자 앞에 작은 ‘광고’ 표시(AdMob 보상형 광고 정책: 누르기 전 알림). 누를 수 없으면 onClick 없이
export function RankRow({
  badge,
  title,
  action,
  ad,
  adLabel,
  onClick,
}: {
  badge: string;
  title: ReactNode;
  action?: ReactNode;
  ad?: boolean;
  adLabel?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="hg-rankrow__badge" aria-hidden="true">
        {badge}
      </span>
      <span className="hg-rankrow__text">
        <span className="hg-rankrow__title">{title}</span>
        {action && (
          <span className="hg-rankrow__action">
            {ad && <span className="hg-rankrow__ad">{adLabel}</span>}
            {action}
          </span>
        )}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="hg-rankrow" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="hg-rankrow">{body}</div>
  );
}
