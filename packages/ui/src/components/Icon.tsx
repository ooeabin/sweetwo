import { cx } from './cx';

// 아이콘은 Phosphor, CSS mask(hg-ico--이름)로 글자 색을 따른다. docs/design/assets/Icons.md
export type IconName =
  | 'airplane-tilt'
  | 'apple-logo'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrows-clockwise'
  | 'baby'
  | 'bank'
  | 'bell'
  | 'buildings'
  | 'cake'
  | 'calendar'
  | 'calendar-check'
  | 'camera'
  | 'car'
  | 'chart-line-up'
  | 'chat-circle-text'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'circle-alert'
  | 'circle-help'
  | 'coins'
  | 'confetti'
  | 'copy'
  | 'couch'
  | 'credit-card'
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
  | 'flower-tulip'
  | 'gift'
  | 'graduation-cap'
  | 'hand-coins'
  | 'handshake'
  | 'heart'
  | 'hourglass'
  | 'house'
  | 'image'
  | 'info'
  | 'link'
  | 'list'
  | 'list-filter'
  | 'loader-circle'
  | 'lock'
  | 'megaphone'
  | 'minus'
  | 'money'
  | 'moon'
  | 'moon-stars'
  | 'palette'
  | 'paperclip'
  | 'paw-print'
  | 'pencil'
  | 'piggy-bank'
  | 'plant'
  | 'plus'
  | 'receipt'
  | 'scan-smiley'
  | 'search'
  | 'settings'
  | 'shield-check'
  | 'shield-warning'
  | 'shopping-bag'
  | 'shopping-cart'
  | 'sun'
  | 'target'
  | 'trash-2'
  | 'trending-up'
  | 'trophy'
  | 'truck'
  | 'umbrella'
  | 'undo-2'
  | 'user'
  | 'user-minus'
  | 'user-plus'
  | 'users-three'
  | 'vault'
  | 'wallet'
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
