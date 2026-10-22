import type { ReactNode } from 'react';
import { IconButton } from './IconButton';

// 상세 화면 머리(docs/design/components/PageHeader.md): 뒤로 + 제목(h1) + 보조 줄 + 동작 1개
export function PageHeader({
  title,
  sub,
  backLabel,
  onBack,
  action,
}: {
  title: ReactNode;
  sub?: ReactNode;
  backLabel: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="hg-pagehead">
      <IconButton icon="chevron-left" label={backLabel} ghost onClick={onBack} />
      <div className="hg-pagehead__text">
        <h1 className="hg-pagehead__title">{title}</h1>
        {sub && <span className="hg-pagehead__sub">{sub}</span>}
      </div>
      {action}
    </header>
  );
}
