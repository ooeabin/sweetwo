import type { ReactNode } from 'react';
import { cx } from './cx';

// 디자인 Selection의 Toggle(docs/design/components/Selection.md). button role="switch" + aria-checked, 라벨로 감쌈.
// 바뀌면 바로 적용(저장 버튼 없음).
export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  help,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  /** 라벨 아래 작은 글자 */
  help?: ReactNode;
}) {
  return (
    <label
      className="hg-row"
      style={{
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        minHeight: 44,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span className="hg-stack" style={{ gap: 'var(--space-1)' }}>
        <span>{label}</span>
        {help && <span className="hg-help">{help}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        className={cx('hg-toggle', checked && 'is-on')}
        onClick={() => onChange(!checked)}
      />
    </label>
  );
}
