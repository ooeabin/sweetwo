import type { ReactNode } from 'react';
import { Icon } from './Icon';

// 결과 요약 카드(docs/design/components/ResultCard.md). 흰 카드 안에 큰 금액 하나 + 체크 목록.
// 온보딩 결과(O-62), 합류 완료(P-11)의 결론 숫자. 버튼은 카드 밖 틀 아래 주 버튼 하나.
export function ResultCard({
  label,
  value,
  tag,
  meta,
  items,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  /** 오른쪽 위 작은 표시(‘추정’ 등) */
  tag?: ReactNode;
  /** 금액 아래 한 줄(취소선 이전 값 등) */
  meta?: ReactNode;
  /** 체크 목록: 이 돈이 어디로 가는지 */
  items?: { label: ReactNode; value: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <div className="hg-card hg-resultcard">
      <div className="hg-card__top">
        <span className="hg-card__label">{label}</span>
        {tag}
      </div>
      <p className="hg-resultcard__value">{value}</p>
      {meta && <p className="hg-card__meta">{meta}</p>}
      {items && items.length > 0 && (
        <ul className="hg-resultcard__checks">
          {items.map((it, i) => (
            <li key={i}>
              <span className="hg-resultcard__check" aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
              <span className="hg-resultcard__name">{it.label}</span>
              <b className="hg-resultcard__val">{it.value}</b>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}
