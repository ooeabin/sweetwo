import type { ReactNode } from 'react';
import { IconButton } from './IconButton';

// 로그인, 가입 화면 틀(docs/design/components/AuthLayout.md)
export function AuthLayout({
  media,
  title,
  help,
  actions,
  note,
  onBack,
  children,
}: {
  media?: ReactNode;
  title: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  onBack?: () => void;
  children?: ReactNode;
}) {
  return (
    <main className="hg-auth">
      {onBack && (
        <div className="hg-auth__back">
          <IconButton icon="arrow-left" label="뒤로" ghost onClick={onBack} />
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
