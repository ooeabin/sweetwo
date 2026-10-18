import { cx } from './cx';

// 장면 자리. 지금은 그림 없이 영역만 잡아 비워 둠(docs/design/components/SceneMedia.md)
export function SceneMedia({
  tall,
  width,
}: {
  /** 3:4 비율(P-01). 없으면 1:1 */
  tall?: boolean;
  /** 너비(px). 화면이 정함 */
  width?: number;
}) {
  return (
    <figure
      className={cx('hg-scene', tall && 'hg-scene--tall')}
      style={width ? { width } : undefined}
      aria-hidden="true"
    />
  );
}
