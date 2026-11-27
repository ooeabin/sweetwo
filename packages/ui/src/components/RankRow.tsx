import type { ReactNode } from 'react';

// 자산 순위 줄(docs/design/components/RankRow.md): 제목(17/700) + 보조 줄(13) + 오른쪽 ›(2026-11-24 원 그래픽 “?%”·“중간” 없앰).
// 보조 줄 없이 제목만이면 이동만 하는 줄(2026-11-27 강약 기준): 15/400 ink-2 + ›, `hg-rankrow--link`
// 광고가 나오면 보조 줄 앞에 작은 ‘광고’ 표시(AdMob 보상형 광고 정책: 누르기 전 알림). 누를 수 없으면 onClick 없이
export function RankRow({
  title,
  action,
  ad,
  adLabel,
  onClick,
}: {
  title: ReactNode;
  action?: ReactNode;
  ad?: boolean;
  adLabel?: string;
  onClick?: () => void;
}) {
  const cls = action ? 'hg-rankrow' : 'hg-rankrow hg-rankrow--link';
  const body = (
    <>
      <span className="hg-rankrow__text">
        <span className="hg-rankrow__title">{title}</span>
        {action && (
          <span className="hg-rankrow__action">
            {ad && <span className="hg-rankrow__ad">{adLabel}</span>}
            {action}
          </span>
        )}
      </span>
      {onClick && <span className="hg-chevron" aria-hidden="true" />}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
