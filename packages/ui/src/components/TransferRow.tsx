import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

/** 자동 줄 알약(hg-autopill, ListRow ‘자동 표시’, 2026-11-13): 회색 판 + arrows-clockwise 12px + 글자 */
export function AutoPill({ text }: { text: string }) {
  return (
    <span className="hg-autopill">
      <Icon name="arrows-clockwise" size={16} />
      {text}
    </span>
  );
}

// 월급 체크리스트 줄(docs/design/components/TransferRow.md). 은행 앱에서 보낸 뒤 체크하면 한 것으로 기록.
// 체크 = button role="checkbox" + aria-checked, aria-label “{줄 이름} 체크”. 체크한 줄은 글자를 stone으로.
// ‘못 함’ 줄은 부르는 쪽이 done=false(빈 원, 취소선 없음) + 보조 줄 “이번 달은 못 했어요”, 이름 “{줄 이름} 못 함”(2026-11-12 D2)
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
  onOpen,
  lead,
  viewOnly = false,
  busy = false,
  changed = false,
  auto,
}: {
  label: ReactNode;
  /** 담당·월급일, 자동 줄이면 꺼내는 통장 */
  meta?: ReactNode;
  amount: ReactNode;
  done: boolean;
  checkLabel: string;
  onToggle?: () => void;
  /** 볼 수만(파트너 탭) */
  disabled?: boolean;
  /** 자동 줄 영역 배지 */
  badge?: ReactNode;
  /** 줄 아래 글자 링크(취소, 다른 금액) */
  actions?: ReactNode;
  /** 줄(이름·금액)을 누르면 여는 선택 시트(W-02 ‘다른 금액’, W-05 ‘못 했어요’, 2026-11-03) */
  onOpen?: () => void;
  /** 줄 앞 아이콘 칸(홈 이번 달 체크리스트, 2026-11-03) */
  lead?: ReactNode;
  /** 남의 줄 보기만(2026-11-03 대신 체크 없앰): 체크 칸 대신 상태 표시(한 줄은 작은 체크, 안 한 줄은 비움) */
  viewOnly?: boolean;
  /** 체크를 서버에 저장하는 중(2026-11-06): 두 번 누르기 막음, aria-busy. 체크 모양은 부르는 쪽이 바로 바꿔 보여 줌 */
  busy?: boolean;
  /** 상대가 방금 바꾼 줄(30 동기화 ‘바뀐 칸 2초 강조’, 2026-11-12): 2초 옅은 판. 부르는 쪽이 2초 뒤 끔 */
  changed?: boolean;
  /** 자동 줄 알약(2026-11-13 ListRow ‘자동 표시’, hg-autopill): “26일 자동”, “자동 확인”. 이름 아래 보조 줄 자리 */
  auto?: string;
}) {
  const body = (
    <>
      <span className="hg-stack" style={{ gap: 0 }}>
        <span className="hg-row" style={{ gap: 'var(--space-2)' }}>
          <span className="hg-transfer__label">{label}</span>
          {badge}
        </span>
        {auto && (
          <span className="hg-transfer__meta">
            <AutoPill text={auto} />
          </span>
        )}
        {meta && <span className="hg-transfer__meta">{meta}</span>}
        {actions && (
          <span className="hg-row" style={{ gap: 'var(--space-3)' }}>
            {actions}
          </span>
        )}
      </span>
      <span className="hg-transfer__amount">{amount}</span>
    </>
  );
  return (
    <div
      className={cx(
        'hg-transfer',
        done && 'is-done',
        viewOnly && 'is-view',
        changed && 'is-changed',
        !!lead && 'hg-transfer--lead',
      )}
    >
      {lead}
      {viewOnly ? (
        <span className="hg-transfer__state" role="img" aria-label={checkLabel}>
          {done && <Icon name="check" size={20} />}
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={checkLabel}
          className={cx('hg-check', done && 'is-on')}
          disabled={disabled}
          aria-busy={busy || undefined}
          onClick={busy ? undefined : onToggle}
        />
      )}
      {onOpen ? (
        <button type="button" className="hg-transfer__open" aria-haspopup="dialog" onClick={onOpen}>
          {body}
        </button>
      ) : (
        body
      )}
    </div>
  );
}
