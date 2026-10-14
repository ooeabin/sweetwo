import { useId } from 'react';
import { AmountCell } from './SpendItems';
import { Chip } from './Chip';

// 이번 달 큰 지출(docs/design/components/BigExpense.md)
export type BigHow = 'from_goal' | 'exception';
export interface BigItem {
  key: string;
  name: string;
  amount: number | null;
  how: BigHow;
  goalName?: string;
}

export function BigExpense({
  options,
  items,
  none,
  onToggle,
  onNone,
  onChange,
}: {
  options: { key: string; name: string; goalName?: string }[];
  items: BigItem[];
  none: boolean;
  onToggle: (key: string) => void;
  onNone: () => void;
  onChange: (key: string, patch: Partial<Pick<BigItem, 'amount' | 'how'>>) => void;
}) {
  const qid = useId();
  const picked = new Set(items.map((i) => i.key));
  return (
    <div className="hg-big">
      <p className="hg-big__q" id={qid}>
        이번 달 큰 지출이 있었나요?
      </p>
      <div className="hg-big__chips" role="group" aria-labelledby={qid}>
        {options.map((o) => (
          <Chip key={o.key} selected={picked.has(o.key)} onClick={() => onToggle(o.key)}>
            {o.name}
          </Chip>
        ))}
        <Chip selected={none} onClick={onNone}>
          없어요
        </Chip>
      </div>
      {items.map((it) => (
        <div key={it.key} className="hg-big__item">
          <div className="hg-big__top">
            <label htmlFor={`${qid}-${it.key}`}>{it.name}</label>
            <AmountCell
              id={`${qid}-${it.key}`}
              value={it.amount}
              onChange={(a) => onChange(it.key, { amount: a })}
            />
          </div>
          <div className="hg-big__how">
            <div className="hg-seg" role="radiogroup" aria-label="이 돈을 어떻게 볼까요">
              {it.goalName && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={it.how === 'from_goal'}
                  className={`hg-seg__item${it.how === 'from_goal' ? ' is-active' : ''}`}
                  onClick={() => onChange(it.key, { how: 'from_goal' })}
                >
                  모아 둔 돈에서 냈어요
                </button>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={it.how === 'exception'}
                className={`hg-seg__item${it.how === 'exception' ? ' is-active' : ''}`}
                onClick={() => onChange(it.key, { how: 'exception' })}
              >
                이번 달만 예외예요
              </button>
            </div>
            {it.how === 'from_goal' && it.goalName && (
              <p>
                <b>{it.goalName}</b> 목표에서 꺼내 썼다고 기록해요. 생활비 평균에는 넣지 않아요.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
