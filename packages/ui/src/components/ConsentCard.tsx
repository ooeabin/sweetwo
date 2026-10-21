import { useState } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// 동의 묶음(docs/design/components/ConsentCard.md ‘동의 묶음’). 전체 동의 + 줄마다 체크 + ‘보기’.
export interface ConsentItem {
  key: string;
  label: string;
  required: boolean;
  onView?: () => void;
}

export function ConsentGroup({
  allLabel,
  items,
  checked,
  onChange,
  viewLabel = '보기',
  requiredLabel,
  foldLabel = '필수 약관 펼치기',
}: {
  allLabel: string;
  items: ConsentItem[];
  checked: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  viewLabel?: string;
  /** 있으면 필수 항목을 한 묶음(묶음 체크 + 펼치기)으로, 하위 약관은 작은 체크 표시 */
  requiredLabel?: string;
  foldLabel?: string;
}) {
  const [open, setOpen] = useState(true);
  const all = items.every((i) => checked[i.key]);
  const setAll = (on: boolean) => onChange(Object.fromEntries(items.map((i) => [i.key, on])));
  const required = items.filter((i) => i.required);
  const grouped = !!requiredLabel && required.length > 1;
  const reqAll = required.every((i) => checked[i.key]);
  const row = (i: ConsentItem) => {
    const on = !!checked[i.key];
    return (
      <div key={i.key} className="hg-consent__row">
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          className="hg-consent__check"
          onClick={() => onChange({ ...checked, [i.key]: !on })}
        >
          <span className={cx('hg-checkbox', on && 'is-on')} aria-hidden="true" />
          <span className="hg-consent__label">{i.label}</span>
        </button>
        {i.onView && (
          <button
            type="button"
            className="hg-btn hg-btn--link"
            onClick={i.onView}
            aria-label={`${i.label} ${viewLabel}`}
          >
            {viewLabel}
          </button>
        )}
      </div>
    );
  };
  return (
    <div className="hg-consent">
      <div className="hg-consent__row hg-consent__row--all">
        <button
          type="button"
          role="checkbox"
          aria-checked={all}
          className="hg-consent__check"
          onClick={() => setAll(!all)}
        >
          <span className={cx('hg-checkbox', all && 'is-on')} aria-hidden="true" />
          <span className="hg-consent__label">{allLabel}</span>
        </button>
      </div>
      {grouped ? (
        <>
          <div className="hg-consent__group">
            <div className="hg-consent__row">
              <button
                type="button"
                role="checkbox"
                aria-checked={reqAll}
                className="hg-consent__check"
                onClick={() =>
                  onChange({
                    ...checked,
                    ...Object.fromEntries(required.map((i) => [i.key, !reqAll])),
                  })
                }
              >
                <span className={cx('hg-checkbox', reqAll && 'is-on')} aria-hidden="true" />
                <span className="hg-consent__label">
                  <b>{requiredLabel}</b>
                </span>
              </button>
              <button
                type="button"
                className="hg-consent__fold"
                aria-expanded={open}
                aria-label={foldLabel}
                onClick={() => setOpen(!open)}
              >
                <Icon name="chevron-down" size={20} />
              </button>
            </div>
            {open && <div className="hg-consent__sub">{required.map(row)}</div>}
          </div>
          {items.filter((i) => !i.required).map(row)}
        </>
      ) : (
        items.map(row)
      )}
    </div>
  );
}
