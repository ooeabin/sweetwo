import { Fragment, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Wordmark } from './Wordmark';

// 어드민 틀(docs/design/components/AdminFrame.md). 2026-11-06 업무 도구답게:
// 연회색 사이드바(메뉴 묶음) + 흰 본문 한 판. 본문 위 상단 바에 전역 검색(왼쪽)과 보는 관리자(오른쪽).
// 기준 1440, 최소 1280(더 좁으면 가로 스크롤). 본문은 글자 선택을 막음(개인정보 화면 복사 방지).
export interface AdminMenu {
  key: string;
  label: string;
  icon: IconName;
  href: string;
  count?: number;
  /** 사이드바 묶음 이름(같은 이름끼리 연달아 둠) */
  group?: string;
}

export function AdminFrame({
  menus,
  current,
  onMenu,
  who,
  search,
  title,
  actions,
  children,
}: {
  menus: AdminMenu[];
  current: string | null;
  onMenu: (m: AdminMenu) => void;
  /** 보는 관리자: 이름 + 역할 이름표 + 작은 글(접속 시각) + 로그아웃 */
  who: { name: string; role?: string; sub?: string; action?: ReactNode };
  /** 상단 바 전역 검색(hg-search) */
  search?: ReactNode;
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
        {menus.map((m, i) => {
          const on = m.key === current;
          const head = m.group && m.group !== menus[i - 1]?.group;
          return (
            <Fragment key={m.key}>
              {head && <span className="hg-admin__group">{m.group}</span>}
              <a
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
            </Fragment>
          );
        })}
      </nav>
      <div className="hg-admin__main">
        <header className="hg-admin__bar">
          {search}
          <div className="hg-admin__me">
            <span>{who.name}</span>
            {who.role && <span className="hg-tag">{who.role}</span>}
            {who.sub && <small>{who.sub}</small>}
            {who.action}
          </div>
        </header>
        <main className="hg-admin__body">
          <div className="hg-admin__head">
            <h1 className="hg-admin__title">{title}</h1>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
