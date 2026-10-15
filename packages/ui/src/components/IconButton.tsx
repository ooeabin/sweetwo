import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

// 아이콘만 있는 둥근 버튼. aria-label 필수(docs/design/components/IconButton.md)
export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  icon: IconName;
  label: string;
  ghost?: boolean;
  dot?: boolean;
  small?: boolean;
  on?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, ghost, dot, small, on, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={on}
      className={cx(
        'hg-iconbtn',
        ghost && 'hg-iconbtn--ghost',
        dot && 'hg-iconbtn--dot',
        small && 'hg-iconbtn--sm',
        on && 'is-on',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
});
