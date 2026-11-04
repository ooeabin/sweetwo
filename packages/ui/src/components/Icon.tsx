import { cx } from './cx';

// 아이콘은 Phosphor, CSS mask(hg-ico--이름)로 글자 색을 따른다. docs/design/assets/Icons.md
export type IconName =
  | 'airplane-tilt'
  | 'apple-logo'
  | 'arrow-left'
  | 'arrow-right'
  | 'baby'
  | 'bank'
  | 'bell'
  | 'buildings'
  | 'calendar'
  | 'calendar-check'
  | 'camera'
  | 'car'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'circle-alert'
  | 'circle-help'
  | 'coins'
  | 'copy'
  | 'couch'
  | 'delete'
  | 'diamond'
  | 'dots-six-vertical'
  | 'download'
  | 'ellipsis'
  | 'envelope'
  | 'eye'
  | 'eye-off'
  | 'fingerprint'
  | 'first-aid-kit'
  | 'flag-pennant'
  | 'gift'
  | 'graduation-cap'
  | 'hand-coins'
  | 'heart'
  | 'house'
  | 'image'
  | 'info'
  | 'link'
  | 'list-filter'
  | 'loader-circle'
  | 'lock'
  | 'minus'
  | 'moon'
  | 'palette'
  | 'paperclip'
  | 'paw-print'
  | 'pencil'
  | 'piggy-bank'
  | 'plant'
  | 'plus'
  | 'scan-smiley'
  | 'search'
  | 'settings'
  | 'shield-check'
  | 'shopping-bag'
  | 'sun'
  | 'target'
  | 'trash-2'
  | 'trending-up'
  | 'truck'
  | 'undo-2'
  | 'user'
  | 'users-three'
  | 'wallet'
  | 'windows-logo'
  | 'wrench'
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
