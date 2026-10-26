import type { ReactNode } from 'react';
import { cx } from './cx';

// 월급 체크리스트 줄(docs/design/components/TransferRow.md). 은행 앱에서 보낸 뒤 체크하면 한 것으로 기록.
// 체크 = button role="checkbox" + aria-checked, aria-label “{줄 이름} 체크”. 체크한 줄은 글자를 stone으로.
export function TransferRow({
  label,
  meta,
  amount,
  done,
  checkLabel,
  onToggle,
  disabled,
  badge,
  actions,
}: {
  label: ReactNode;
  /** 담당·월급일, 자동 줄이면 꺼내는 통장 */
  meta?: ReactNode;
  amount: ReactNode;
  done: boolean;
  checkLabel: string;
  onToggle?: () => void;
  /** 볼 수만(배우자 탭) */
  disabled?: boolean;
  /** 자동 줄 영역 배지 */
  badge?: ReactNode;
  /** 줄 아래 글자 링크(취소, 다른 금액) */
  actions?: ReactNode;
}) {
  return (
    <div className={cx('hg-transfer', done && 'is-done')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={checkLabel}
        className={cx('hg-check', done && 'is-on')}
        disabled={disabled}
        onClick={onToggle}
      />
      <div className="hg-stack" style={{ gap: 0 }}>
        <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
          <span className="hg-transfer__label">{label}</span>
          {badge}
        </span>
        {meta && <span className="hg-transfer__meta">{meta}</span>}
        {actions && (
          <span className="hg-row" style={{ gap: 'var(--space-3)' }}>
            {actions}
          </span>
        )}
      </div>
      <span className="hg-transfer__amount">{amount}</span>
    </div>
  );
}
