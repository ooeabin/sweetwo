import type { ReactNode } from 'react';

// 토스형 구역 머리(docs/design/components/StatBlock.md, 2026-11-04 F-08).
// 숫자형: 작은 라벨 + 큰 숫자 문장 + 보조 한 줄. 제목형: 20px 제목 + 보조 한 줄(<b>로 숫자 강조)
export function StatBlock({
  label,
  big,
  title,
  sub,
  as: Tag = 'section',
  ariaLabel,
}: {
  label?: ReactNode;
  big?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  as?: 'section' | 'div';
  ariaLabel?: string;
}) {
  return (
    <Tag className="hg-statblock" aria-label={ariaLabel}>
      {label && <p className="hg-statblock__label">{label}</p>}
      {big && <p className="hg-statblock__big">{big}</p>}
      {title && <h2 className="hg-statblock__title">{title}</h2>}
      {sub && <p className="hg-statblock__sub">{sub}</p>}
    </Tag>
  );
}
