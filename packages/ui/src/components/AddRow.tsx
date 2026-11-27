import { cx } from './cx';
import { PlusIcon } from './AddText';

// + 추가 줄(docs/design/components/AddRow.md). 2026-11-27 ‘버튼·색 정리’ 사용자 결정 4: 앱의 ‘+ … 추가’는 이 한 모양 —
// 회색 원 32 안 + 16 slate, 원과 글자 사이 12, 글자 15/400 ink-2, 줄 높이 48. block이면 한 줄 꽉 차게(목록·묶음 끝).
// 예전 PlanAdd(W-01·W-20b)와 Y-04 점선 원 ListRow를 이 컴포넌트로 합침.
export function AddRow({
  label,
  onClick,
  block,
  className,
  ariaLabel,
  expanded,
}: {
  /** “저금 추가”처럼. 앞의 ‘+’는 떼고 원 안 아이콘이 대신함 */
  label: string;
  onClick: () => void;
  block?: boolean;
  className?: string;
  /** 보이는 글자보다 긴 화면 읽기 이름(W-02 수입 줄 “+ 입력하기” → “수입 입력하기”) */
  ariaLabel?: string;
  /** 펼침 상태가 있는 추가(W-01 묶음 끝에서 이름 칩을 펼칠 때) */
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx('hg-addrow', block && 'hg-addrow--block', className)}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span className="hg-addrow__icon" aria-hidden="true">
        <PlusIcon />
      </span>
      <span>{label.replace(/^\+\s*/, '')}</span>
    </button>
  );
}
