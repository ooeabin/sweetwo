import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface AccordionItem {
  id: string;
  q: string;
  a: ReactNode;
  /** 질문 아래 작은 보조 줄(공지 날짜 등, 2026-11-16) */
  sub?: string;
  /** 안 읽음(새 알림 점 `hg-acc__dot` + 화면 읽기용 글자). 문구는 `unreadLabel` */
  unread?: boolean;
}

// 가이드·자주 묻는 질문 접기(docs/design/components/Accordion.md). 여러 개를 함께 열 수 있음.
export function Accordion({
  items,
  onOpen,
  initialOpen,
  unreadLabel,
}: {
  items: AccordionItem[];
  /** 처음부터 펼쳐 둘 항목 id(공지 띠에서 들어온 공지, 2026-11-16). onOpen은 부르지 않음 */
  initialOpen?: string;
  /** 안 읽음 점의 화면 읽기 글자(“새 공지”) */
  unreadLabel?: string;
  /** 펼칠 때(분석 등) */
  onOpen?: (id: string) => void;
}) {
  const base = useId();
  const [open, setOpen] = useState<Set<string>>(new Set(initialOpen ? [initialOpen] : []));
  return (
    <div className="hg-acc">
      {items.map((it) => {
        const on = open.has(it.id);
        const aid = `${base}-${it.id}`;
        return (
          <div key={it.id} className={on ? 'hg-acc__item is-open' : 'hg-acc__item'}>
            <button
              type="button"
              className="hg-acc__q"
              aria-expanded={on}
              aria-controls={aid}
              onClick={() => {
                const next = new Set(open);
                if (on) next.delete(it.id);
                else {
                  next.add(it.id);
                  onOpen?.(it.id);
                }
                setOpen(next);
              }}
            >
              {it.sub || it.unread ? (
                <span className="hg-acc__text">
                  <span className="hg-acc__title">
                    {it.q}
                    {it.unread && (
                      <>
                        <span className="hg-acc__dot" aria-hidden="true" />
                        {unreadLabel && <span className="hg-sr"> {unreadLabel}</span>}
                      </>
                    )}
                  </span>
                  {it.sub && <span className="hg-acc__sub">{it.sub}</span>}
                </span>
              ) : (
                <span>{it.q}</span>
              )}
              <Icon name="chevron-right" />
            </button>
            <p id={aid} className="hg-acc__a" hidden={!on}>
              {it.a}
            </p>
          </div>
        );
      })}
    </div>
  );
}
