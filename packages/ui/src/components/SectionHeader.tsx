import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function SectionHeader({
  title,
  count,
  more,
}: {
  title: ReactNode;
  count?: ReactNode;
  more?: { label: string; href: string };
}) {
  return (
    <div className="hg-sechead">
      <h2 className="hg-sechead__title">{title}</h2>
      {count !== undefined && <span className="hg-sechead__count">{count}</span>}
      {more && (
        <a className="hg-sechead__more" href={more.href}>
          {more.label}
          <Icon name="chevron-right" size={16} />
        </a>
      )}
    </div>
  );
}
