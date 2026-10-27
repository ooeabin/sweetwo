import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Wordmark } from './Wordmark';

// 앱 화면 틀(docs/design/components/AppFrame.md). 넓은 창: 왼쪽 사이드바 + 회색 바탕 위 (홈만) 인사 카드 + 두 단 본문.
// 좁은 창(768px 미만): 머리(홈은 워드마크, 다른 메뉴는 큰 제목 + 아이콘 4개) + 인사 카드 + 하단 탭 막대와 + 버튼.

export type AppTab = 'month' | 'goals' | 'assets' | 'calendar';
const TAB_ICON: Record<AppTab, IconName> = {
  month: 'house',
  goals: 'target',
  assets: 'wallet',
  calendar: 'calendar',
};

export interface AppFrameTab {
  key: AppTab;
  label: string;
  href?: string;
  /** 아직 열 수 없는 메뉴 */
  disabled?: boolean;
  /** 받은 제안 수(이번 달 탭) */
  badge?: number;
  /** 숫자 알약 화면 읽기용 */
  badgeLabel?: string;
}

export interface AppFramePerson {
  name: string;
  /** 1 = 먼저 시작한 사람, 2 = 합류한 사람 */
  no: 1 | 2;
  /** 미합류면 빈 원 */
  empty?: boolean;
}

export interface AppFrameStat {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
}

export interface AppFrameProps {
  /** 메뉴가 아닌 화면(설정)은 null */
  current: AppTab | null;
  tabs: AppFrameTab[];
  onTab?: (key: AppTab) => void;
  /** 홈 인사 카드(이번 달만) */
  today?: {
    date: string;
    title: ReactNode;
    actions?: ReactNode;
    stats?: AppFrameStat[];
    /** 큰 숫자 하나 + 진행 막대(0~100) */
    focus?: { value: ReactNode; percent: number };
  };
  /** 다른 메뉴 첫 화면의 제목 줄(제목 24px + 오른쪽 동작). 좁은 창은 머리에 메뉴 이름이 있어 동작만 */
  page?: { title: ReactNode; actions?: ReactNode };
  /** 좁은 창 머리의 큰 제목(메뉴 이름) */
  narrowTitle: string;
  date: string;
  labels: {
    search: string;
    mask: string;
    noti: string;
    settings: string;
    add: string;
    me: string;
    /** 숫자 타일 묶음(좁은 창에서 가로로 넘김) */
    stats: string;
  };
  masked: boolean;
  onMask: () => void;
  onSearch?: () => void;
  onNoti?: () => void;
  onSettings?: () => void;
  onAdd?: () => void;
  hasNewNoti?: boolean;
  people: AppFramePerson[];
  saveState?: string;
  /** 본문 단(두 단이면 두 개) */
  columns: ReactNode[];
  /** 본문 맨 위 띠(해제 대기 등) */
  banner?: ReactNode;
}

function Person({ p }: { p: AppFramePerson }) {
  return p.empty ? (
    <span
      className="hg-avatar"
      aria-hidden="true"
      style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}
    />
  ) : (
    <span
      className={cx('hg-avatar', p.no === 1 ? 'hg-avatar--p1' : 'hg-avatar--p2')}
      aria-hidden="true"
    >
      {[...p.name][0] ?? ''}
    </span>
  );
}

function TabLink({
  t,
  current,
  onTab,
  className,
  activeClass,
  showLabel,
}: {
  t: AppFrameTab;
  current: AppTab | null;
  onTab?: (key: AppTab) => void;
  className: string;
  activeClass: string;
  showLabel: boolean;
}) {
  const on = t.key === current;
  return (
    <a
      className={cx(className, on && activeClass)}
      href={t.disabled ? undefined : (t.href ?? '#')}
      role="link" // href 없는(아직 없는) 메뉴도 링크로 읽히게
      aria-current={on ? 'page' : undefined}
      aria-disabled={t.disabled || undefined}
      aria-label={showLabel ? undefined : t.label}
      onClick={(e) => {
        e.preventDefault();
        if (!t.disabled) onTab?.(t.key);
      }}
    >
      <Icon name={TAB_ICON[t.key]} size={className === 'hg-dock__item' ? 24 : 20} />
      {showLabel && t.label}
      {t.badge ? (
        <span className="hg-nav__count" aria-label={t.badgeLabel ?? `${t.badge}`}>
          {t.badge}
        </span>
      ) : null}
    </a>
  );
}

export function AppFrame(p: AppFrameProps) {
  const tools = (
    <>
      <IconButton icon="eye" label={p.labels.mask} ghost on={p.masked} onClick={p.onMask} />
      <IconButton
        icon="bell"
        label={p.labels.noti}
        ghost
        dot={p.hasNewNoti}
        disabled={!p.onNoti}
        onClick={p.onNoti}
      />
    </>
  );
  const focus = p.today?.focus;
  return (
    <div className="hg-frame">
      <aside className="hg-appside">
        <div className="hg-appside__in">
          <span className="hg-appside__logo">
            <Wordmark height={24} />
          </span>
          <button
            type="button"
            className="hg-appside__search"
            onClick={p.onSearch}
            disabled={!p.onSearch}
            aria-label={p.labels.search}
          >
            <Icon name="search" size={16} />
            <span>{p.labels.search}</span>
            <span className="hg-kbd">⌘K</span>
          </button>
          <nav className="hg-appside__nav" aria-label={p.narrowTitle}>
            {p.tabs.map((t) => (
              <TabLink
                key={t.key}
                t={t}
                current={p.current}
                onTab={p.onTab}
                className="hg-nav"
                activeClass="is-active"
                showLabel
              />
            ))}
          </nav>
          <div className="hg-appside__foot">
            <button
              type="button"
              className="hg-appside__me"
              aria-label={p.labels.me}
              title={p.saveState}
              disabled={!p.onSettings}
              onClick={p.onSettings}
            >
              <span className="hg-avatars">
                {p.people.map((x) => (
                  <Person key={x.no} p={x} />
                ))}
              </span>
              <span>{p.labels.settings}</span>
            </button>
            {tools}
          </div>
        </div>
      </aside>

      <div className="hg-frame__main">
        {/* 좁은 창 머리: 홈은 워드마크, 다른 메뉴는 메뉴 이름 */}
        <div className={cx('hg-frame__mhead', p.today && 'is-today')}>
          {p.today ? (
            <Wordmark height={24} />
          ) : (
            <div className="hg-topbar__text">
              <h1 className="hg-topbar__title">{p.narrowTitle}</h1>
            </div>
          )}
          <IconButton
            icon="search"
            label={p.labels.search}
            ghost
            disabled={!p.onSearch}
            onClick={p.onSearch}
          />
          {tools}
          <IconButton
            icon="settings"
            label={p.labels.settings}
            ghost
            disabled={!p.onSettings}
            onClick={p.onSettings}
          />
        </div>

        {p.today ? (
          <section className="hg-today">
            <div className="hg-today__in">
              <div className="hg-today__row">
                <div className="hg-today__text">
                  <span className="hg-today__date">{p.today.date}</span>
                  <h1 className="hg-today__title">{p.today.title}</h1>
                </div>
                {focus && <span className="hg-today__value">{focus.value}</span>}
              </div>
              {focus && (
                <div
                  className="hg-today__bar"
                  aria-hidden="true"
                  style={
                    { '--p': Math.max(0, Math.min(100, focus.percent)) } as React.CSSProperties
                  }
                >
                  <i />
                </div>
              )}
              {p.today.stats && p.today.stats.length > 0 && (
                <div
                  className="hg-today__stats"
                  role="region"
                  aria-label={p.labels.stats}
                  tabIndex={0}
                >
                  {p.today.stats.map((s, i) => (
                    <div key={i} className="hg-stat">
                      <span className="hg-stat__label">{s.label}</span>
                      <span className="hg-stat__value">{s.value}</span>
                      {s.sub && <span className="hg-stat__sub">{s.sub}</span>}
                    </div>
                  ))}
                </div>
              )}
              {p.today.actions && (
                <div className="hg-row hg-frame__actions hg-today__foot">{p.today.actions}</div>
              )}
            </div>
          </section>
        ) : p.page ? (
          <section className="hg-pagetitle">
            <div className="hg-pagetitle__in">
              <h1 className="hg-pagetitle__title">{p.page.title}</h1>
              {p.page.actions && <div className="hg-row hg-frame__actions">{p.page.actions}</div>}
            </div>
          </section>
        ) : null}

        <main className="hg-body" style={{ '--cols': p.columns.length } as React.CSSProperties}>
          {p.banner}
          {p.columns.map((c, i) => (
            <div key={i} className="hg-body__col">
              {c}
            </div>
          ))}
        </main>
      </div>

      {/* 좁은 창 하단 탭 막대 + 추가 */}
      <nav className="hg-dock" aria-label={p.narrowTitle}>
        {p.tabs.map((t) => (
          <TabLink
            key={t.key}
            t={t}
            current={p.current}
            onTab={p.onTab}
            className="hg-dock__item"
            activeClass="is-active"
            showLabel
          />
        ))}
      </nav>
      {p.onAdd !== undefined && (
        <button type="button" className="hg-fab" aria-label={p.labels.add} onClick={p.onAdd}>
          <Icon name="plus" size={24} />
        </button>
      )}
    </div>
  );
}
