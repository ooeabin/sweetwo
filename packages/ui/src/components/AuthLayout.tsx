import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

// 로그인, 가입 화면 틀(docs/design/components/AuthLayout.md)
export function AuthLayout({
  media,
  title,
  help,
  actions,
  note,
  onBack,
  backLabel = '이전',
  children,
  className,
}: {
  media?: ReactNode;
  title: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  onBack?: () => void;
  /** 넓은 창에 보이는 뒤로 글자(꺾쇠 아이콘 대신) */
  backLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <main className={className ? `hg-auth ${className}` : 'hg-auth'}>
      {onBack && (
        <div className="hg-auth__back">
          <IconButton icon="chevron-left" label="뒤로" ghost onClick={onBack} />
          <button type="button" className="hg-btn hg-btn--ghost hg-auth__backtext" onClick={onBack}>
            <Icon name="chevron-left" size={16} />
            {backLabel}
          </button>
        </div>
      )}
      {media}
      <div className="hg-auth__head">
        <h1 className="hg-auth__title">{title}</h1>
        {help && <p className="hg-auth__help">{help}</p>}
      </div>
      {children}
      {actions && <div className="hg-auth__actions">{actions}</div>}
      {note && (
        <p className="hg-auth__note" role="status">
          {note}
        </p>
      )}
    </main>
  );
}
