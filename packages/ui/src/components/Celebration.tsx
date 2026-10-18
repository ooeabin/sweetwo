import type { ReactNode } from 'react';

// Celebration(docs/design/components/Celebration.md): 목표 달성 한 번. 위 큰 그림(hero), 아래 머리글 → 제목 → 큰 금액 → 한 문장 → 버튼.
// 그림 움직임과 ‘동작 줄이기’는 CSS(hg-celebrate__hero img). 브랜드 색은 머리글 글자에만.
export function Celebration({
  art,
  eyebrow,
  title,
  value,
  story,
  children,
}: {
  /** 그림(Illustration img) 또는 회색 기본 그림 */
  art: ReactNode;
  eyebrow: string;
  title: string;
  value: string;
  /** 한 문장(숫자만 <b>) */
  story?: ReactNode;
  /** 주 버튼 + 글자 링크 */
  children: ReactNode;
}) {
  return (
    <section className="hg-celebrate" aria-labelledby="hg-celebrate-title">
      <div className="hg-celebrate__hero" aria-hidden="true">
        {art}
      </div>
      <div className="hg-celebrate__body">
        <p className="hg-celebrate__eyebrow">{eyebrow}</p>
        <h1 id="hg-celebrate-title" className="hg-celebrate__title">
          {title}
        </h1>
        <p className="hg-celebrate__value">{value}</p>
        {story && <p className="hg-celebrate__story">{story}</p>}
        <div className="hg-celebrate__actions">{children}</div>
      </div>
    </section>
  );
}
