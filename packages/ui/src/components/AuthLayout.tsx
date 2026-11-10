import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Illustration } from './Illustration';

// 로그인, 가입 화면 틀(docs/design/components/AuthLayout.md)
export function AuthLayout({
  media,
  art,
  alert,
  toast,
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
  /**
   * 상태 그림(Illustrations 이름, 96px). 그림 파일이 아직 없으면(2D 그림 ‘나중 과제’) 같은 크기의 회색 빈 자리(hg-artslot).
   * 2026-11-10 아이콘 원(hg-auth__icon)을 없애고 빈 자리로 되돌림(사용자 결정, 그림은 나중에 만듦)
   */
  art?: string;
  /** 버튼 묶음 바로 위 안내 띠(취소, 충돌, 오프라인, 실패) */
  alert?: ReactNode;
  /** 버튼 묶음 바로 위에 잠깐 뜨는 알약(소비자가 시간이 지나면 지움) */
  toast?: ReactNode;
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
          <IconButton icon="chevron-left" label="뒤로" ghost className="hg-back" onClick={onBack} />
          <button type="button" className="hg-btn hg-btn--ghost hg-auth__backtext" onClick={onBack}>
            <Icon name="chevron-left" size={16} />
            {backLabel}
          </button>
        </div>
      )}
      {art && <Illustration name={art} className="hg-auth__art" />}
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
          {toast && (
            <div className="hg-toast hg-auth__toast" role="status">
              {toast}
            </div>
          )}
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
