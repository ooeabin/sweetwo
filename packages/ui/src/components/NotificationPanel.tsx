import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';
import { Button } from './Button';
import type { IconName } from './Icon';
import { IconButton } from './IconButton';
import type { LeadTone } from './lead-kinds';

// 알림 패널(docs/design/components/NotificationPanel.md, 기획서 14 N-01~N-03). 넓은 창은 오른쪽 시트, 좁은 창은 전체 화면.
// 묶음(오늘·이번 주·이전) → 줄(사람 Avatar 또는 아이콘, 문구, 시간, 새 알림 점). 열리면 첫 줄 포커스, ↑↓ 이동, Enter 열기.
export interface NotiItem {
  id: string;
  msg: string;
  time: string;
  read: boolean;
  /** 앱 안내 아이콘. 2026-11-20부터 줄 앞 칸은 모든 줄에서 비움(사람 원 포함, 종류별 2D 그림이 생기면 그때 다시 채움) */
  icon?: IconName;
  /** 아이콘 원 영역 색(lead-kinds.ts noti) */
  tone?: LeadTone;
  /** 줄 아래 회색 글자 버튼 하나(2026-11-13 R-08 ‘이전 값으로 돌리기’). 줄 버튼 밖 형제라 겹친 버튼이 아님 */
  action?: { label: string; onClick: () => void; busy?: boolean };
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
  /** 목록 아래 다음 행동 하나(알림이 거의 없을 때 ‘알림 종류 고르기’, 2026-11-25). 목록이 있을 때만 그림 */
  after?: ReactNode;
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

  // 열리면 첫 줄 포커스(목록이 처음 올 때 한 번). 좁은 창(손가락)에서는 포커스 테두리가 고른 것처럼 보여 목록 칸에만(2026-11-03)
  const focused = useRef(false);
  useEffect(() => {
    if (p.loading || !hasItems || focused.current) return;
    focused.current = true;
    if (window.matchMedia?.('(min-width: 768px)').matches) {
      // 2026-11-04 처음 포커스는 테두리 없이(열자마자 고른 것처럼 보여서). 키를 누르거나 떠나면 보통대로
      const el = body.current?.querySelector<HTMLButtonElement>('button.hg-noti__item');
      if (!el) return;
      el.dataset.autofocus = '';
      el.focus({ preventScroll: true });
      const clear = () => {
        delete el.dataset.autofocus;
        el.removeEventListener('keydown', clear);
        el.removeEventListener('blur', clear);
      };
      el.addEventListener('keydown', clear);
      el.addEventListener('blur', clear);
    } else body.current?.focus({ preventScroll: true });
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
          <IconButton
            icon="chevron-left"
            label={p.labels.back}
            ghost
            className="hg-back"
            onClick={p.onClose}
          />
        )}
        {/* 알림 화면(page)은 제목이 그 화면의 h1, 넓은 창 시트는 화면 위에 뜨는 패널이라 h2(2026-11-16) */}
        {p.variant === 'page' ? (
          <h1 className="hg-noti__title">{p.labels.title}</h1>
        ) : (
          <h2 className="hg-noti__title">{p.labels.title}</h2>
        )}
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
      <div className="hg-noti__body" ref={body} tabIndex={-1} onKeyDown={move}>
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
            {/* 빈 상태 그림 자리(120px)는 2D 그림이 들어올 때까지 그리지 않음(2026-11-15 3차 검토, 회색 빈 자리 숨김) */}
            <b>{p.labels.emptyTitle}</b>
            {p.labels.emptySub && <span>{p.labels.emptySub}</span>}
          </div>
        ) : (
          <>
            {p.groups
              .filter((g) => g.items.length)
              .map((g) => (
                <section key={g.key} aria-label={g.label}>
                  {p.variant === 'page' ? (
                    <h2 className="hg-noti__group">{g.label}</h2>
                  ) : (
                    <h3 className="hg-noti__group">{g.label}</h3>
                  )}
                  {g.items.map((x) => {
                    const row = (
                      <button
                        key={x.id}
                        type="button"
                        className={cx('hg-noti__item', 'hg-noti__item--plain', x.read && 'is-read')}
                        title={x.msg}
                        onClick={() => p.onItem(x.id)}
                      >
                        {/* 줄 앞 칸 없음(2026-11-20): 사람 원도 그리지 않아 글자 시작 위치를 통일. 알림 종류 그림(lead-kinds.ts noti)은 2D 그림이 들어올 때 */}
                        <span className="hg-noti__text">
                          <span className="hg-noti__msg">{x.msg}</span>
                          <span className="hg-noti__time">{x.time}</span>
                        </span>
                        {!x.read && <span className="hg-noti__dot" aria-label={p.labels.unread} />}
                      </button>
                    );
                    return x.action ? (
                      <div key={x.id}>
                        {row}
                        <div className="hg-noti__undo">
                          <Button
                            variant="link"
                            size="sm"
                            loading={x.action.busy}
                            onClick={x.action.onClick}
                          >
                            {x.action.label}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      row
                    );
                  })}
                </section>
              ))}
            {p.more && skeleton(2)}
            {p.after && <div className="hg-noti__after">{p.after}</div>}
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
