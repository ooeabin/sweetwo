import { cx } from './cx';

// 아이콘은 Phosphor, CSS mask(hg-ico--이름)로 글자 색을 따른다. docs/design/assets/Icons.md
export type IconName =
  | 'apple-logo'
  | 'arrow-left'
  | 'arrow-right'
  | 'bell'
  | 'calendar'
  | 'camera'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'circle-alert'
  | 'circle-help'
  | 'copy'
  | 'delete'
  | 'dots-six-vertical'
  | 'download'
  | 'ellipsis'
  | 'envelope'
  | 'eye'
  | 'eye-off'
  | 'fingerprint'
  | 'flag-pennant'
  | 'gift'
  | 'house'
  | 'image'
  | 'info'
  | 'link'
  | 'list-filter'
  | 'loader-circle'
  | 'lock'
  | 'minus'
  | 'moon'
  | 'paperclip'
  | 'pencil'
  | 'piggy-bank'
  | 'plus'
  | 'search'
  | 'settings'
  | 'shield-check'
  | 'sun'
  | 'target'
  | 'trash-2'
  | 'trending-up'
  | 'undo-2'
  | 'user'
  | 'wallet'
  | 'windows-logo'
  | 'x';

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: 16 | 20 | 24;
  className?: string;
}) {
  return (
    <span
      className={cx('hg-ico', `hg-ico--${name}`, size !== 20 && `hg-ico--${size}`, className)}
      aria-hidden="true"
    />
  );
}
