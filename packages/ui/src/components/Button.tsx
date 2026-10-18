import type { ButtonHTMLAttributes } from 'react';

// 디자인 Button(docs/design/components/Button.md). 클래스 이름은 디자인 시스템 그대로.
type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger' | 'kakao';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  className,
  ...rest
}: ButtonProps) {
  const cls = [
    'hg-btn',
    `hg-btn--${variant}`,
    size === 'sm' && 'hg-btn--sm',
    block && 'hg-btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} {...rest} />;
}
