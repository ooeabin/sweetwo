import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { cx } from './cx';

// 초대 코드 칸(2026-11-11 QA 3구간 디자인): 6자를 한 글자씩 회색 칸에.
// 보여 주기(CodeCells, O-07·S-12 코드 상자, P-01 합류 시작)와 넣기(CodeInput, P-01 코드 입력)가 같은 칸이라
// 받은 코드를 그대로 옮겨 적는 모양. 참고: Shop·Family 인증 코드 칸, Places 초대 코드 칸.

/** 보여 주기만. 읽는 사람용 글은 소비자가 따로 준다(칸은 aria-hidden). */
export function CodeCells({
  value,
  length = 6,
  active,
  className,
}: {
  value: string;
  length?: number;
  /** 넣는 중인 칸(CodeInput) */
  active?: number;
  className?: string;
}) {
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');
  return (
    <span className={cx('hg-codecells', className)} aria-hidden="true">
      {chars.map((c, i) => (
        <span
          // 칸 자리는 바뀌지 않는다
          key={i}
          className={cx('hg-codecell', c && 'is-filled', active === i && 'is-active')}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

type CodeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'maxLength' | 'className'
> & {
  value: string;
  onValue: (v: string) => void;
  length?: number;
  error?: boolean;
};

/**
 * 코드 넣기. 진짜 입력 칸 하나(붙여넣기, 자동 채우기, 라벨, 화면 읽기)를 칸 위에 투명하게 겹친다.
 * 커서는 늘 끝(중간 칸을 눌러도 이어서 적음), 지우기는 뒤에서부터.
 */
export function CodeInput({ value, onValue, length = 6, error, ...rest }: CodeInputProps) {
  // 넣을 칸. 다 채우면 표시 없음(마지막 칸만 테두리가 남지 않게)
  const active = value.length < length ? value.length : undefined;
  const toEnd = (el: HTMLInputElement) => {
    const n = el.value.length;
    if (el.selectionStart !== n || el.selectionEnd !== n) el.setSelectionRange(n, n);
  };
  return (
    <span className={cx('hg-codeinput', error && 'is-error')}>
      <input
        {...rest}
        className="hg-codeinput__field"
        value={value}
        maxLength={length}
        aria-invalid={error || undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onValue(e.target.value)}
        onSelect={(e) => toEnd(e.currentTarget)}
      />
      <CodeCells value={value} length={length} active={active} />
    </span>
  );
}
