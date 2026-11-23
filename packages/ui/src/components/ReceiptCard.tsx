import { useRef, useState } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

// 월급 계획 템플릿 줄 목록(docs/design/components/ReceiptCard.md, 2026-11-09 영수증 줄, 2026-11-19 카드 틀은 PlanTemplate.tsx로).
// 이 파일은 줄(ReceiptRows)과 줄 모양(ReceiptLine)만: 카드·요약·블록 버튼은 PlanTemplate.tsx(PlanStage, PlanSummary, PlanCard, PlanAdd).
// 숫자·문구·금액 가리기·공개 범위는 쓰는 쪽이 줌.

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
  /** 이름 아래 회색 한 줄(“모은 금액 1,140만 원, 목표 금액의 23%”, 2026-11-19 시안: 자동이면 “자동으로 나가요”도 이 줄) */
  note?: string;
  /** note 아래 진행 막대(4px, 140px, 그래픽이라 뜻은 note 글자로도. 2026-11-19 시안에서 글자는 note로 합침) */
  progress?: { percent: number };
  /** 새로 만든 줄 잠깐 강조(2026-11-18, ‘동작 줄이기’면 없음) */
  fresh?: boolean;
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
 * 줄 목록(카드 안). 두 칸(왼쪽 이름 16px 600 + 회색 보조 줄, 오른쪽 금액 16px 700). 줄 앞 아이콘·줄 사이 선 없음.
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
          const main = (
            <>
              <span className="hg-receipt__name">
                {l.name}
                {l.note && <span className="hg-receipt__note">{l.note}</span>}
                {l.progress && (
                  <span className="hg-receipt__prog" aria-hidden="true">
                    <span className="hg-receipt__progbar">
                      <i style={{ width: `${l.progress.percent}%` }} />
                    </span>
                  </span>
                )}
              </span>
              <span className="hg-receipt__amt">{l.amount}</span>
            </>
          );
          return (
            <li
              key={l.id}
              data-row-id={l.id}
              className={cx(
                'hg-receipt__row',
                dragging && 'is-dragging',
                open === l.id && 'is-open',
                l.fresh && 'is-new',
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
                  className="hg-btn hg-btn--link hg-receipt__del"
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
