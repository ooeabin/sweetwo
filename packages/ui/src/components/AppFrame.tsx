import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Wordmark } from './Wordmark';

// 앱 화면 틀(docs/design/components/AppFrame.md). 넓은 창: 왼쪽 사이드바 + 본문(홈·자산 관리는 회색 바탕, tone="alt").
// 좁은 창(768px 미만, 2026-11-09 GCOO 홈처럼): 하단 탭 막대와 + 버튼 없음. 홈 머리 = 워드마크 + 알림 + ☰(메뉴 서랍),
// 다른 메뉴 첫 화면 머리 = ‹(홈으로) + 굵은 제목. 서랍(Drawer)은 소비자가 onMenu로 엶.

// 2026-11-08 ADR 0007: 목표 탭 자리에 월급 탭(손 위 동전 hand-coins)
export type AppTab = 'month' | 'salary' | 'assets' | 'calendar';
const TAB_ICON: Record<AppTab, IconName> = {
  month: 'house',
  salary: 'hand-coins',
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
  /** 올린 사진이나 지정 아바타 그림 주소(없으면 첫 글자) */
  src?: string;
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
    /** 인사 카드 없이(2026-11-03 홈): 다른 메뉴처럼 제목 줄(넓은 창 “홈” + ‘추가’), 좁은 창은 화면 읽기용 제목만 */
    plain?: boolean;
  };
  /** 다른 메뉴 첫 화면의 제목 줄(제목 24px + 오른쪽 동작). 좁은 창은 머리가 홈과 같아(메뉴 이름은 화면 읽기용) 동작만 */
  page?: { title: ReactNode; actions?: ReactNode };
  /** 좁은 창 머리 왼쪽 제목(메뉴 이름, 홈은 워드마크라 화면 읽기용). 탭 막대 이름표로도 씀 */
  narrowTitle: string;
  date: string;
  labels: {
    search: string;
    mask: string;
    noti: string;
    settings: string;
    /** ☰ 버튼 이름(“메뉴”) */
    menu: string;
    /** ‹ 버튼 이름(“홈으로”) */
    home: string;
    me: string;
    /** 숫자 타일 묶음(좁은 창에서 가로로 넘김) */
    stats: string;
  };
  masked: boolean;
  onMask: () => void;
  onSearch?: () => void;
  onNoti?: () => void;
  onSettings?: () => void;
  /** 좁은 창 홈 머리 ☰(메뉴 서랍 열기) */
  onMenu?: () => void;
  /** ☰가 연 서랍이 열려 있음(aria-expanded) */
  menuOpen?: boolean;
  /** 좁은 창 홈 밖 메뉴 첫 화면 머리 ‹ = 홈으로 */
  onHome?: () => void;
  hasNewNoti?: boolean;
  people: AppFramePerson[];
  saveState?: string;
  /** 본문 단(두 단이면 두 개) */
  columns: ReactNode[];
  /** 본문 맨 위 띠(해제 대기 등) */
  banner?: ReactNode;
  /** 하위 화면(설정 안쪽 등): 좁은 창에서 앱 머리를 숨기고 본문의 ‘‹ 제목’ 한 줄만(2026-11-03) */
  sub?: boolean;
  /** 바탕(2026-11-09): alt = 회색(surface-alt) 바탕 + 테두리·그림자 없는 흰 상자(홈, 자산 관리). 기본은 흰 바탕 */
  tone?: 'alt';
}

function Person({ p }: { p: AppFramePerson }) {
  // 파트너 빈 자리: 기본 그림(사람 아이콘, 2026-11-03). 연결을 계속 권하려고 비워 두지 않음(2026-11-05 그림 파일은 만들지 않음)
  if (p.empty)
    return (
      <span className="hg-avatar hg-avatar--empty" aria-hidden="true">
        <Icon name="user" size={16} />
      </span>
    );
  // 프로필 사진, 없으면 이름 첫 글자
  return p.src ? (
    <span className="hg-avatar hg-avatar--photo" aria-hidden="true">
      <img src={p.src} alt="" />
    </span>
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
      // 하단 탭 막대는 아이콘만(2026-11-09): 이름은 화면 읽기용(aria-label)
      aria-label={showLabel ? undefined : t.label}
      onClick={(e) => {
        e.preventDefault();
        if (!t.disabled) onTab?.(t.key);
      }}
    >
      <Icon name={TAB_ICON[t.key]} size={showLabel ? 20 : 24} />
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
  const home = p.current === 'month';
  return (
    <div className={cx('hg-frame', p.sub && 'hg-frame--sub', p.tone === 'alt' && 'hg-frame--alt')}>
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
        {/* 좁은 창 머리(2026-11-09 GCOO 홈처럼). 홈: 왼쪽 워드마크, 오른쪽 알림 + ☰(메뉴 서랍, 설정은 서랍 안).
            홈 밖 메뉴 첫 화면(월급, 자산 관리, 캘린더, 설정 홈): ‹(홈으로) + 메뉴 이름 굵은 제목(h1), 오른쪽 버튼 없음 */}
        <div className={cx('hg-frame__mhead', p.today && 'is-today')}>
          <div className="hg-mhead__place">
            {home ? (
              <>
                <span className="hg-mhead__logo">
                  <Wordmark height={24} />
                </span>
                {/* 홈 제목은 제목 줄(today)이 h1. 그것이 없는 홈(합류 대기, 불러오는 중)만 여기서 화면 읽기용 h1 */}
                {!p.today && <h1 className="hg-sr">{p.narrowTitle}</h1>}
              </>
            ) : (
              <>
                {p.onHome && (
                  <IconButton
                    icon="chevron-left"
                    label={p.labels.home}
                    ghost
                    className="hg-mhead__back hg-back"
                    onClick={p.onHome}
                  />
                )}
                {p.today ? (
                  <span className="hg-mhead__title">{p.narrowTitle}</span>
                ) : (
                  <h1 className="hg-mhead__title">{p.narrowTitle}</h1>
                )}
              </>
            )}
          </div>
          {home && (
            <>
              <IconButton
                icon="bell"
                label={p.labels.noti}
                ghost
                dot={p.hasNewNoti}
                disabled={!p.onNoti}
                onClick={p.onNoti}
              />
              <IconButton
                icon="list"
                label={p.labels.menu}
                ghost
                aria-haspopup="dialog"
                aria-expanded={!!p.menuOpen}
                disabled={!p.onMenu}
                onClick={p.onMenu}
              />
            </>
          )}
        </div>

        {p.today?.plain ? (
          // 다른 메뉴와 같은 제목 줄(넓은 창: “홈” + 오른쪽 ‘추가’). 좁은 창은 화면 읽기용 제목만
          <section className="hg-pagetitle hg-today--plain">
            <div className="hg-pagetitle__in">
              <h1 className="hg-pagetitle__title">{p.today.title}</h1>
              {p.today.actions && <div className="hg-row hg-frame__actions">{p.today.actions}</div>}
            </div>
          </section>
        ) : p.today ? (
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
          {/* 띠 묶음(2026-11-03): 띠 사이를 좁게 하나로 */}
          {p.banner && <div className="hg-body__banners">{p.banner}</div>}
          {p.columns.map((c, i) => (
            <div key={i} className="hg-body__col">
              {c}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
