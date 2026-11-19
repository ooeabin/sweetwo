import { Icon } from './Icon';

// + 아이콘 규칙(2026-11-19): ‘+ … 추가’류 글자 앞 +는 문자가 아니라 이 아이콘 하나로 그린다.
// 크기 16px(글자 14~15px 옆), 선 굵기 bold(600 글자), 색 currentColor, 글자와 4px 간격(--space-1), 세로 가운데.
// docs/design/components/Button.md ‘+ 아이콘 규칙’

/** + 아이콘만(장식, aria-hidden). 글자 앞에 바로 붙일 때는 AddText */
export function PlusIcon() {
  return <Icon name="plus" size={16} className="hg-plusic" />;
}

/**
 * 아이콘 + 글자 한 묶음(inline-flex, gap 4px). “+ 추가”처럼 앞에 +가 붙은 글자는 +를 떼고 아이콘으로 바꾼다.
 * 화면 읽기 이름이 보이는 글자와 달라지면 안 되는 곳(“+ 지출 추가”)은 부르는 쪽이 aria-label에 원래 글자를 준다.
 */
export function AddText({ children }: { children: string }) {
  return (
    <span className="hg-addtext">
      <PlusIcon />
      {children.replace(/^\+\s*/, '')}
    </span>
  );
}
