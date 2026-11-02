import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

// 로그인, 가입 화면 틀(docs/design/components/AuthLayout.md)
export function AuthLayout({
  media,
  icon,
  busy,
  alert,
  actionsRow,
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
  /** 상태 화면 제목 위 아이콘 원(72px) */
  icon?: IconName;
  /** 아이콘을 천천히 돌림(기다리는 중). ‘동작 줄이기’면 멈춤 */
  busy?: boolean;
  /** 버튼 묶음 바로 위 안내 띠(취소, 충돌, 오프라인, 실패) */
  alert?: ReactNode;
  /** 버튼 두 개를 가로로(보조 1 : 주 2) */
  actionsRow?: boolean;
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
      {icon && (
        <span className={busy ? 'hg-auth__icon is-busy' : 'hg-auth__icon'} aria-hidden="true">
          <Icon name={icon} />
        </span>
      )}
      {media}
      <div className="hg-auth__head">
        <h1 className="hg-auth__title">{title}</h1>
        {help && <p className="hg-auth__help">{help}</p>}
      </div>
      {children}
      {alert && (
        <div className="hg-banner hg-banner--info hg-auth__alert" role="status">
          <Icon name="info" size={16} />
          <span>{alert}</span>
        </div>
      )}
      {actions && (
        <div className={actionsRow ? 'hg-auth__actions hg-auth__actions--row' : 'hg-auth__actions'}>
          {actions}
        </div>
      )}
      {note && (
        <p className="hg-auth__note" role="status">
          {note}
        </p>
      )}
    </main>
  );
}
