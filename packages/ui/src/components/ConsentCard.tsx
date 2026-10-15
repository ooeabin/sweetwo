import { cx } from './cx';

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
}: {
  allLabel: string;
  items: ConsentItem[];
  checked: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  viewLabel?: string;
}) {
  const all = items.every((i) => checked[i.key]);
  const setAll = (on: boolean) => onChange(Object.fromEntries(items.map((i) => [i.key, on])));
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
      {items.map((i) => {
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
      })}
    </div>
  );
}
