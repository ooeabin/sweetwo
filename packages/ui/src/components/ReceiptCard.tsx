import { useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { AutoPill } from './TransferRow';

// 영수증 카드(docs/design/components/ReceiptCard.md, 2026-11-09 W-01 월급 계획).
// 바탕(ReceiptStage, surface-alt) 위 카드(ReceiptCard, 위 xl 모서리 + 아래 톱니) 안에 머리, 비율 막대, 묶음, 합계.
// 숫자·문구·퍼센트는 쓰는 쪽이 줌(금액 가리기, 공개 범위도 쓰는 쪽에서).

/** 카드 뒤 바탕(surface-alt) + 카드 아래 버튼 줄까지 같은 너비로 */
export function ReceiptStage({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section className="hg-receipt-stage" aria-label={label}>
      {children}
    </section>
  );
}

export function ReceiptCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cx('hg-receipt', className)}>{children}</article>;
}

/** 머리: Avatar(40px, 둘이면 겹쳐서) + 큰 금액 + 아래 stone 한 줄. onAmount가 있으면 금액이 버튼 */
export function ReceiptHead({
  lead,
  title,
  amount,
  sub,
  onAmount,
  amountLabel,
  extra,
}: {
  lead?: ReactNode;
  /** 금액 위 제목(달 결과 카드 “11월 월급”, 2026-11-09) */
  title?: string;
  /** 금액 글자(금액 가리기면 앱이 화면 읽기 글자를 붙인 노드로, 2026-11-12) */
  amount: ReactNode;
  sub?: string;
  onAmount?: () => void;
  /** 금액 버튼 화면 읽기 이름(“월급 350만 원, 내 월급 고치기”) */
  amountLabel?: string;
  /** 아래 한 줄 다음(W-01 ‘이번 달 3/5 체크했어요 ›’ 링크) */
  extra?: ReactNode;
}) {
  return (
    <header className="hg-receipt__head">
      {lead}
      {title && <p className="hg-receipt__headtitle">{title}</p>}
      {onAmount ? (
        <button
          type="button"
          className="hg-receipt__amount"
          aria-label={amountLabel}
          onClick={onAmount}
        >
          {amount}
        </button>
      ) : (
        <p className="hg-receipt__amount">{amount}</p>
      )}
      {sub && <p className="hg-receipt__sub">{sub}</p>}
      {extra}
    </header>
  );
}

export type ReceiptPartKind = 'saving' | 'spend' | 'free';

/**
 * 비율 막대 PlanBar(12px, 칸 사이 3px) + 가운데 범례(W-01 영수증, W-02 진행, 달 결과 카드 같은 마크업).
 * 칸 너비는 percent, 0이면 칸 없음. progress 모드(2026-11-09 W-02): 칸마다 fill(0~100)만큼 채우고
 * 나머지는 조용한 칸(저금 accent-app-soft, 지출 hairline 테두리). fill이 모두 100이면 계획 막대와 똑같음.
 * legend가 비면 범례 없음, caption은 막대 아래 한 줄(“체크한 금액 142만 원 / 342만 원”).
 * title·action(2026-11-12 W-02 다 끝난 달): 막대 아래 왼쪽 굵은 한 줄 + caption, 오른쪽 글자 버튼(‘공유하기’)
 */
export function PlanBar({
  label,
  parts,
  legend = [],
  progress,
  caption,
  flat,
  title,
  action,
}: {
  label: string;
  parts: { kind: ReceiptPartKind; percent: number; fill?: number }[];
  legend?: { kind: ReceiptPartKind; text: string; short?: boolean }[];
  /** 진행 모드: 저금·지출 칸 안을 fill만큼 채움(여유 자금은 늘 stone) */
  progress?: boolean;
  caption?: ReactNode;
  /** 카드 밖(W-02 머리 아래): 막대 위 여백을 좁게 */
  flat?: boolean;
  /** 막대 아래 굵은 한 줄(W-02 다 끝난 달 “10월 월급 체크를 다 했어요”, 2026-11-12). caption 위 */
  title?: ReactNode;
  /** 막대 아래 오른쪽 글자 버튼(W-02 ‘공유하기’, 2026-11-12) */
  action?: ReactNode;
}) {
  return (
    <div className={cx('hg-planbar', flat && 'hg-planbar--flat')}>
      <div className="hg-receipt__bar" role="img" aria-label={label}>
        {parts
          .filter((p) => p.percent > 0)
          .map((p) => {
            const partial = progress && p.kind !== 'free';
            const fill = Math.max(0, Math.min(100, p.fill ?? 0));
            return (
              <i
                key={p.kind}
                className={cx(
                  'hg-receipt__seg',
                  `hg-receipt__seg--${p.kind}`,
                  partial && 'is-progress',
                )}
                style={{ flexGrow: p.percent, flexBasis: 0 }}
              >
                {partial && fill > 0 && (
                  <b className="hg-receipt__fill" style={{ width: `${fill}%` }} />
                )}
              </i>
            );
          })}
      </div>
      {legend.length > 0 && (
        <ul className="hg-receipt__legend" aria-hidden="true">
          {legend.map((l) => (
            <li key={l.kind} className={cx(l.short && 'is-short')}>
              <i className={`hg-receipt__sw hg-receipt__seg--${l.kind}`} />
              {l.text}
            </li>
          ))}
        </ul>
      )}
      {title || action ? (
        <div className="hg-planbar__foot">
          <div className="hg-planbar__text">
            {title && <p className="hg-planbar__title">{title}</p>}
            {caption && <p className="hg-receipt__caption">{caption}</p>}
          </div>
          {action}
        </div>
      ) : (
        caption && <p className="hg-receipt__caption">{caption}</p>
      )}
    </div>
  );
}

/** 묶음: 제목(15px 600) + 오른쪽 stone 소계, 아래 줄들과 끝 글자 버튼 */
export function ReceiptSection({
  title,
  subtotal,
  children,
  label,
}: {
  title?: string;
  subtotal?: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  return (
    <section className="hg-receipt__sec" aria-label={label ?? title}>
      {title && (
        <div className="hg-receipt__sechead">
          <h3 className="hg-receipt__title">{title}</h3>
          {subtotal && <span className="hg-receipt__subtotal">{subtotal}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** 묶음 끝 stone 글자 버튼(“+ 저금 추가”) */
export function ReceiptAdd({
  children,
  onClick,
  expanded,
}: {
  children: ReactNode;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button type="button" className="hg-receipt__add" aria-expanded={expanded} onClick={onClick}>
      {children}
    </button>
  );
}

export interface ReceiptLine {
  id: string;
  name: string;
  amount: string;
  /** 줄을 누르면(금액 시트). 없으면 누를 수 없음 */
  onOpen?: () => void;
  /** 보기만(자물쇠) */
  locked?: boolean;
  /** 편집 모드 ‘지우기’(없으면 지울 수 없는 줄) */
  onDelete?: () => void;
  /** 화면 읽기 이름(없으면 “이름 금액”) */
  label?: string;
  /** 금액 아래 조용한 한 줄(달 결과 카드 “계획 80만 원”) */
  sub?: string;
  /** 금액 자리를 stone으로(달 결과 카드 ‘못 함’) */
  muted?: boolean;
  /** 자동 줄 알약(2026-11-13 hg-autopill “자동 26일”), 금액 왼쪽 */
  auto?: string;
  /** 이름 아래 회색 한 줄(2026-11-13 보내기 줄 “월급 − 용돈”) */
  note?: string;
}

export interface ReceiptEditLabels {
  handle: (name: string) => string;
  up: (name: string) => string;
  down: (name: string) => string;
  moved: (name: string, pos: number) => string;
  remove: string;
  removeLabel: (name: string) => string;
  locked: string;
}

/**
 * 줄 목록. 두 칸(왼쪽 이름 slate, 오른쪽 금액 ink). 줄 앞 아이콘·줄 사이 선 없음.
 * edit: 손잡이(끌기, 같은 목록 안), 포커스가 오면 보이는 위·아래 버튼, 지우기(마우스 = 늘, 터치 = 왼쪽으로 밀면)
 */
export function ReceiptRows({
  label,
  lines,
  edit,
  onMove,
  labels,
}: {
  label: string;
  lines: ReceiptLine[];
  edit?: boolean;
  /** 순서 바꾸기(편집 모드). from → to 자리 */
  onMove?: (from: number, to: number) => void;
  labels: ReceiptEditLabels;
}) {
  const list = useRef<HTMLUListElement>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const [drag, setDrag] = useState<{
    id: string;
    from: number;
    y: number;
    dy: number;
    to: number;
  } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const touch = useRef<{ id: string; x: number; y: number } | null>(null);

  const move = (from: number, to: number, focus?: 'up' | 'down') => {
    if (!onMove || to < 0 || to >= lines.length || from === to) return;
    const line = lines[from];
    if (!line) return;
    onMove(from, to);
    setSaid(labels.moved(line.name, to + 1));
    if (focus)
      requestAnimationFrame(() => {
        const same = buttons.current[`${line.id}-${focus}`];
        const other = buttons.current[`${line.id}-${focus === 'up' ? 'down' : 'up'}`];
        (same && !same.disabled ? same : other)?.focus();
      });
  };

  // 끌기: 손잡이 pointer capture, 다른 줄 가운데를 지나면 그 자리
  const target = (y: number, from: number) => {
    const rows = [...(list.current?.children ?? [])] as HTMLElement[];
    let to = from;
    rows.forEach((r, i) => {
      if (i === from) return;
      const b = r.getBoundingClientRect();
      const mid = b.top + b.height / 2;
      if (i < from && y < mid) to = Math.min(to, i);
      if (i > from && y > mid) to = Math.max(to, i);
    });
    return to;
  };

  return (
    <>
      <ul ref={list} className="hg-receipt__rows" aria-label={label}>
        {lines.map((l, i) => {
          const dragging = drag?.id === l.id;
          const shift =
            drag && !dragging && drag.from !== drag.to
              ? drag.from < drag.to && i > drag.from && i <= drag.to
                ? -1
                : drag.from > drag.to && i >= drag.to && i < drag.from
                  ? 1
                  : 0
              : 0;
          const amt = l.sub ? (
            <span className="hg-receipt__amtcol">
              <span className={cx('hg-receipt__amt', l.muted && 'is-muted')}>{l.amount}</span>
              <span className="hg-receipt__plan">{l.sub}</span>
            </span>
          ) : (
            <span className={cx('hg-receipt__amt', l.muted && 'is-muted')}>{l.amount}</span>
          );
          const main = (
            <>
              <span className="hg-receipt__name">
                {l.name}
                {l.note && <span className="hg-receipt__note">{l.note}</span>}
              </span>
              {l.auto ? (
                <span className="hg-receipt__autocol">
                  <AutoPill text={l.auto} />
                  {amt}
                </span>
              ) : (
                amt
              )}
            </>
          );
          return (
            <li
              key={l.id}
              className={cx(
                'hg-receipt__row',
                dragging && 'is-dragging',
                open === l.id && 'is-open',
              )}
              style={
                dragging
                  ? { transform: `translateY(${drag.dy}px)` }
                  : shift
                    ? { transform: `translateY(${shift * 100}%)` }
                    : undefined
              }
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (edit && t) touch.current = { id: l.id, x: t.clientX, y: t.clientY };
              }}
              onTouchEnd={(e) => {
                const t = e.changedTouches[0];
                const s = touch.current;
                touch.current = null;
                if (!edit || !t || !s || s.id !== l.id || drag) return;
                const dx = t.clientX - s.x;
                if (Math.abs(dx) < 40 || Math.abs(t.clientY - s.y) > 30) return;
                setOpen(dx < 0 && l.onDelete ? l.id : null);
              }}
            >
              {edit && onMove && lines.length > 1 && (
                <span
                  className="hg-receipt__handle"
                  role="presentation"
                  title={labels.handle(l.name)}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setOpen(null);
                    setDrag({ id: l.id, from: i, y: e.clientY, dy: 0, to: i });
                  }}
                  onPointerMove={(e) => {
                    if (!drag || drag.id !== l.id) return;
                    setDrag({ ...drag, dy: e.clientY - drag.y, to: target(e.clientY, drag.from) });
                  }}
                  onPointerUp={() => {
                    if (drag && drag.id === l.id) move(drag.from, drag.to);
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}
                >
                  <Icon name="dots-six-vertical" size={20} />
                </span>
              )}
              {l.onOpen ? (
                <button
                  type="button"
                  className="hg-receipt__main"
                  aria-label={l.label}
                  onClick={l.onOpen}
                >
                  {main}
                </button>
              ) : (
                <span className="hg-receipt__main" aria-label={l.label}>
                  {main}
                </span>
              )}
              {l.locked && (
                <span className="hg-receipt__lock" title={labels.locked}>
                  <Icon name="lock" size={16} />
                  <span className="hg-sr">{labels.locked}</span>
                </span>
              )}
              {edit && onMove && lines.length > 1 && (
                <span className="hg-receipt__moves">
                  <IconButton
                    ref={(el) => {
                      buttons.current[`${l.id}-up`] = el;
                    }}
                    icon="chevron-up"
                    label={labels.up(l.name)}
                    ghost
                    small
                    disabled={i === 0}
                    onClick={() => move(i, i - 1, 'up')}
                  />
                  <IconButton
                    ref={(el) => {
                      buttons.current[`${l.id}-down`] = el;
                    }}
                    icon="chevron-down"
                    label={labels.down(l.name)}
                    ghost
                    small
                    disabled={i === lines.length - 1}
                    onClick={() => move(i, i + 1, 'down')}
                  />
                </span>
              )}
              {edit && l.onDelete && (
                <button
                  type="button"
                  className="hg-btn hg-btn--link hg-btn--danger-text hg-receipt__del"
                  aria-label={labels.removeLabel(l.name)}
                  onClick={() => {
                    setOpen(null);
                    l.onDelete?.();
                  }}
                >
                  {labels.remove}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <span className="hg-sr" aria-live="polite">
        {said}
      </span>
    </>
  );
}

/** 합계 줄(“배분 342만 원”, “여유 자금 8만 원” 굵게, 모자라면 danger) */
export function ReceiptTotal({
  rows,
}: {
  rows: { label: string; amount: ReactNode; strong?: boolean; short?: boolean }[];
}) {
  return (
    <section className="hg-receipt__sec">
      <dl className="hg-receipt__rows" style={{ margin: 0 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            className={cx(
              'hg-receipt__row',
              'hg-receipt__main',
              r.strong && 'hg-receipt__row--strong',
              r.short && 'is-short',
            )}
          >
            <dt className="hg-receipt__name">{r.label}</dt>
            <dd className="hg-receipt__amt" style={{ margin: 0 }}>
              {r.amount}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
