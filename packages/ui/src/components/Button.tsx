import { useEffect, useState, type ButtonHTMLAttributes, type MouseEvent } from 'react';

// 디자인 Button(docs/design/components/Button.md). 클래스 이름은 디자인 시스템 그대로.
type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger' | 'kakao';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  block?: boolean;
  /**
   * 처리 중(2026-11-06): 누르기를 바로 막고(aria-busy, 두 번 누르기 막음),
   * 0.3초가 넘으면 글자 자리에 도는 원(`is-loading`). 너비는 그대로.
   */
  loading?: boolean;
}

/** 처리 중 표시를 0.3초 늦게 켬(빨리 끝나면 깜빡이지 않게). 끄는 것은 바로 */
export function useLoadingShown(loading: boolean | undefined, ms = 300) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!loading) return setShown(false);
    const t = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(t);
  }, [loading, ms]);
  return !!loading && shown;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  loading,
  className,
  onClick,
  'aria-busy': ariaBusy,
  ...rest
}: ButtonProps) {
  const shown = useLoadingShown(loading);
  const cls = [
    'hg-btn',
    `hg-btn--${variant}`,
    size === 'sm' && 'hg-btn--sm',
    block && 'hg-btn--block',
    shown && 'is-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      {...rest}
      aria-busy={loading || ariaBusy || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        // 처리 중에는 누르기(제출 포함)를 막음
        if (loading) return e.preventDefault();
        onClick?.(e);
      }}
    />
  );
}
