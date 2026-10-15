import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../cx';
import { IconButton } from '../IconButton';

// Q5 짧은 텍스트(docs/spec/12-question-pattern.md Q5). 앞뒤 공백, 연속 공백, 줄바꿈은 정리. 한도에서 입력 멈춤.
export const normalizeShortText = (s: string) =>
  s.replace(/[\t\r\n]+/g, ' ').replace(/ {2,}/g, ' ');

export function ShortText({
  label,
  value,
  onChange,
  max,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  error?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string>();
  useEffect(() => ref.current?.focus(), []);
  const chars = [...value];
  return (
    <div className="hg-field">
      <label htmlFor={id} className="hg-sr">
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          id={id}
          className={cx('hg-input', error && 'is-error')}
          style={{ paddingRight: 'var(--space-14)' }}
          placeholder={placeholder}
          value={value}
          aria-invalid={!!error || undefined}
          aria-describedby={`${id}-count`}
          onChange={(e) => {
            const v = [...normalizeShortText(e.target.value)];
            if (v.length > max) setNotice(`${max}자까지만 넣었어요`);
            else setNotice(undefined);
            onChange(v.slice(0, max).join(''));
          }}
        />
        {value && (
          <span
            style={{
              position: 'absolute',
              right: 'var(--space-1)',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <IconButton icon="x" label="지우기" ghost small onClick={() => onChange('')} />
          </span>
        )}
      </div>
      <span id={`${id}-count`} className={error ? 'hg-help is-error' : 'hg-help'}>
        {error ?? notice ?? `${chars.length}/${max}`}
      </span>
    </div>
  );
}
