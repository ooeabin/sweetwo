import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface AccordionItem {
  id: string;
  q: string;
  a: ReactNode;
}

// 가이드·자주 묻는 질문 접기(docs/design/components/Accordion.md). 여러 개를 함께 열 수 있음.
export function Accordion({
  items,
  onOpen,
}: {
  items: AccordionItem[];
  /** 펼칠 때(분석 등) */
  onOpen?: (id: string) => void;
}) {
  const base = useId();
  const [open, setOpen] = useState<Set<string>>(new Set());
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
              <span>{it.q}</span>
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
