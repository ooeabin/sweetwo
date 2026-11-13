import { cx } from './cx';
import { Icon } from './Icon';

// + 추가 줄(docs/design/components/AddRow.md, 2026-11-09 + 버튼(FAB) 대신): 목록 끝이나 묶음 머리 오른쪽의
// 회색 글자 버튼(hg-btn--link와 같은 ink-2 600) + Phosphor plus. block이면 한 줄 꽉 차게(목록 끝)
export function AddRow({
  label,
  onClick,
  block,
  className,
}: {
  /** “저금 추가”처럼 + 없이(아이콘이 +) */
  label: string;
  onClick: () => void;
  block?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx('hg-addrow', block && 'hg-addrow--block', className)}
      onClick={onClick}
    >
      <Icon name="plus" size={16} />
      {label}
    </button>
  );
}
