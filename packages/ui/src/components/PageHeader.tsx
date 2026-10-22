import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

// 상세 화면 머리(docs/design/components/PageHeader.md): 뒤로 + 제목(h1) + 보조 줄 + 동작 1개.
// 좁은 창은 꺾쇠 아이콘, 넓은 창은 제목 위에 돌아갈 화면 이름(“‹ 설정”)
export function PageHeader({
  title,
  sub,
  backLabel,
  backTo,
  onBack,
  action,
}: {
  title: ReactNode;
  sub?: ReactNode;
  /** 꺾쇠 아이콘의 화면 읽기 이름(“뒤로”) */
  backLabel: string;
  /** 넓은 창에 보이는 돌아갈 화면 이름. 없으면 “이전” */
  backTo?: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="hg-pagehead">
      <IconButton
        icon="chevron-left"
        label={backLabel}
        ghost
        onClick={onBack}
        className="hg-pagehead__icon"
      />
      <div className="hg-pagehead__text">
        <button
          type="button"
          className="hg-pagehead__crumb"
          aria-label={`${backLabel}, ${backTo ?? '이전'}`}
          onClick={onBack}
        >
          <Icon name="chevron-left" size={16} />
          {backTo ?? '이전'}
        </button>
        <h1 className="hg-pagehead__title">{title}</h1>
        {sub && <span className="hg-pagehead__sub">{sub}</span>}
      </div>
      {action}
    </header>
  );
}
