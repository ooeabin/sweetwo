import { useEffect, useId, useState, type ReactNode } from 'react';
import { cx } from './cx';

// 디자인 Selection의 Toggle(docs/design/components/Selection.md). button role="switch" + aria-checked, 라벨로 감쌈.
// 바뀌면 바로 적용(저장 버튼 없음). onChange가 Promise를 돌려주면(서버 저장) 끝날 때까지 누른 쪽으로 바로 보여 주고
// 두 번 누르기를 막음(aria-busy, 2026-11-06). 실패해서 checked가 그대로면 원래대로 돌아감.
export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  help,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => unknown;
  disabled?: boolean;
  /** 라벨 아래 작은 글자 */
  help?: ReactNode;
}) {
  const [pending, setPending] = useState<boolean | null>(null);
  // 스위치 이름은 라벨 글자, 설명은 보조 글(2026-11-15 3차 검토: 감싼 label만으로는 이름이 안 잡히는 화면 읽기가 있었음)
  const id = useId();
  // 서버 값이 바뀌어 들어오면 그 값을 그대로
  useEffect(() => setPending(null), [checked]);
  const shown = pending ?? checked;
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
      {/* 보조 글이 길어도 토글은 오른쪽 그대로(2026-11-04) */}
      <span className="hg-stack" style={{ gap: 'var(--space-1)', flex: 1, minWidth: 0 }}>
        <span id={`${id}-l`} className="hg-toggle__label">
          {label}
        </span>
        {help && (
          <span id={`${id}-h`} className="hg-help">
            {help}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!!shown}
        aria-labelledby={`${id}-l`}
        aria-describedby={help ? `${id}-h` : undefined}
        aria-busy={pending !== null || undefined}
        disabled={disabled}
        className={cx('hg-toggle', shown && 'is-on')}
        style={{ flex: 'none' }}
        onClick={() => {
          if (pending !== null) return;
          const r = onChange(!checked);
          if (r instanceof Promise) {
            setPending(!checked);
            void r.catch(() => undefined).finally(() => setPending(null));
          }
        }}
      />
    </label>
  );
}
