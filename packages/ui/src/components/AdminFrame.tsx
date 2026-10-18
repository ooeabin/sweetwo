import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Wordmark } from './Wordmark';

// 어드민 틀(docs/design/components/AdminFrame.md). 왼쪽 메뉴(hg-nav) + 떠 있는 흰 본문 패널(hg-admin__main).
// 기준 1440, 최소 1280(더 좁으면 가로 스크롤). 본문은 글자 선택을 막음(개인정보 화면 복사 방지).
export interface AdminMenu {
  key: string;
  label: string;
  icon: IconName;
  href: string;
  count?: number;
}

export function AdminFrame({
  menus,
  current,
  onMenu,
  who,
  title,
  actions,
  children,
}: {
  menus: AdminMenu[];
  current: string | null;
  onMenu: (m: AdminMenu) => void;
  /** 보는 관리자(이름, 역할과 접속 시각) */
  who: { name: string; sub: string; action?: ReactNode };
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hg-admin">
      <nav className="hg-admin__side" aria-label="어드민 메뉴">
        <div className="hg-admin__brand">
          <Wordmark />
          <span className="hg-tag">어드민</span>
        </div>
        {menus.map((m) => {
          const on = m.key === current;
          return (
            <a
              key={m.key}
              className={cx('hg-nav', on && 'is-active')}
              href={m.href}
              aria-current={on ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onMenu(m);
              }}
            >
              <Icon name={m.icon} />
              <span>{m.label}</span>
              {m.count ? <span className="hg-nav__count">{m.count}</span> : null}
            </a>
          );
        })}
        <div className="hg-admin__who">
          <b>{who.name}</b>
          <span>{who.sub}</span>
          {who.action}
        </div>
      </nav>
      <main className="hg-admin__main">
        <div className="hg-admin__head">
          <h1 className="hg-admin__title">{title}</h1>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
