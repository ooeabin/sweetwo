import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

// 알림 패널(docs/design/components/NotificationPanel.md, 기획서 14 N-01~N-03). 넓은 창은 오른쪽 시트, 좁은 창은 전체 화면.
// 묶음(오늘·이번 주·이전) → 줄(사람 Avatar 또는 아이콘, 문구, 시간, 새 알림 점). 열리면 첫 줄 포커스, ↑↓ 이동, Enter 열기.
export interface NotiItem {
  id: string;
  msg: string;
  time: string;
  read: boolean;
  /** 사람이 한 일: 이름 첫 글자 + 사람 색(1 = 시작한 사람, 2 = 합류한 사람) */
  person?: { name: string; no: 1 | 2 };
  /** 앱 안내 아이콘(사람이 없을 때) */
  icon?: IconName;
}

export function NotificationPanel(p: {
  variant: 'sheet' | 'page';
  labels: {
    title: string;
    readAll: string;
    settings: string;
    close: string;
    back: string;
    emptyTitle: string;
    /** N-03 빈 상태는 제목 한 줄(13 공통 상태): 없으면 보조 문구 없음 */
    emptySub?: string;
    /** 새 알림 점(화면 읽기) */
    unread: string;
  };
  groups: { key: string; label: string; items: NotiItem[] }[];
  loading?: boolean;
  /** 불러오기 실패: 문구 + 다시 시도 */
  error?: { text: string; retry: string; onRetry: () => void };
  /** 맨 위 회색 안내 띠(오프라인 등) */
  notice?: ReactNode;
  onItem: (id: string) => void;
  onReadAll: () => void;
  onSettings?: () => void;
  onClose: () => void;
  /** 목록 끝에 닿으면(더 불러오기) */
  onEnd?: () => void;
  /** 더 불러오는 중(줄 모양 Skeleton) */
  more?: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const items = p.groups.flatMap((g) => g.items);
  const unread = items.some((x) => !x.read);
  const hasItems = items.length > 0;

  // 열리면 첫 줄 포커스(목록이 처음 올 때 한 번)
  const focused = useRef(false);
  useEffect(() => {
    if (p.loading || !hasItems || focused.current) return;
    focused.current = true;
    body.current?.querySelector<HTMLButtonElement>('button.hg-noti__item')?.focus();
  }, [p.loading, hasItems]);

  // Esc 닫기(시트)
  const { variant, onClose, onEnd } = p;
  useEffect(() => {
    if (variant !== 'sheet') return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, onClose]);

  // 끝에 닿으면 더 불러오기
  useEffect(() => {
    const el = end.current;
    if (!el || !onEnd || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting)) onEnd();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [onEnd, items.length]);

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const all = [...(body.current?.querySelectorAll<HTMLButtonElement>('.hg-noti__item') ?? [])];
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const next = all[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), all.length - 1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const skeleton = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} className="hg-noti__item" aria-hidden="true">
        <span
          className="hg-skel"
          style={{
            width: 'var(--space-8)',
            height: 'var(--space-8)',
            borderRadius: 'var(--radius-full)',
          }}
        />
        <span className="hg-noti__text">
          <span className="hg-skel" style={{ height: 'var(--space-3)' }} />
          <span className="hg-skel" style={{ height: 'var(--space-3)', width: '40%' }} />
        </span>
      </div>
    ));

  return (
    <aside
      className={cx('hg-noti', p.variant === 'sheet' ? 'hg-noti--sheet' : 'hg-noti--page')}
      aria-label={p.labels.title}
    >
      <div className="hg-noti__head">
        {p.variant === 'page' && (
          <IconButton icon="chevron-left" label={p.labels.back} ghost small onClick={p.onClose} />
        )}
        <h2 className="hg-noti__title">{p.labels.title}</h2>
        <Button variant="ghost" size="sm" disabled={!unread} onClick={p.onReadAll}>
          {p.labels.readAll}
        </Button>
        {p.variant === 'sheet' && (
          <>
            <IconButton
              icon="settings"
              label={p.labels.settings}
              ghost
              small
              disabled={!p.onSettings}
              onClick={p.onSettings}
            />
            <IconButton icon="x" label={p.labels.close} ghost small onClick={p.onClose} />
          </>
        )}
      </div>
      {p.notice}
      <div className="hg-noti__body" ref={body} onKeyDown={move}>
        {p.loading ? (
          skeleton(3)
        ) : p.error ? (
          <div className="hg-noti__empty" role="alert">
            <span>{p.error.text}</span>
            <Button variant="secondary" size="sm" onClick={p.error.onRetry}>
              {p.error.retry}
            </Button>
          </div>
        ) : !hasItems ? (
          <div className="hg-noti__empty">
            <Icon name="bell" />
            <b>{p.labels.emptyTitle}</b>
            {p.labels.emptySub && <span>{p.labels.emptySub}</span>}
          </div>
        ) : (
          <>
            {p.groups
              .filter((g) => g.items.length)
              .map((g) => (
                <section key={g.key} aria-label={g.label}>
                  <h3 className="hg-noti__group">{g.label}</h3>
                  {g.items.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className={cx('hg-noti__item', x.read && 'is-read')}
                      title={x.msg}
                      onClick={() => p.onItem(x.id)}
                    >
                      {x.person ? (
                        <span
                          className={cx(
                            'hg-avatar',
                            x.person.no === 1 ? 'hg-avatar--p1' : 'hg-avatar--p2',
                          )}
                          aria-hidden="true"
                        >
                          {[...x.person.name][0] ?? ''}
                        </span>
                      ) : (
                        <span className="hg-noti__icon" aria-hidden="true">
                          <Icon name={x.icon ?? 'bell'} size={16} />
                        </span>
                      )}
                      <span className="hg-noti__text">
                        <span className="hg-noti__msg">{x.msg}</span>
                        <span className="hg-noti__time">{x.time}</span>
                      </span>
                      {!x.read && <span className="hg-noti__dot" aria-label={p.labels.unread} />}
                    </button>
                  ))}
                </section>
              ))}
            {p.more && skeleton(2)}
            <div ref={end} aria-hidden="true" style={{ height: 1 }} />
          </>
        )}
      </div>
      {p.variant === 'page' && p.onSettings && (
        <div className="hg-noti__foot">
          <Button variant="ghost" size="sm" onClick={p.onSettings}>
            {p.labels.settings}
          </Button>
        </div>
      )}
    </aside>
  );
}
