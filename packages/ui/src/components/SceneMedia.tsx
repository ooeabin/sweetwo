import { useEffect, useState } from 'react';
import { illustrations } from './Illustration';
import { cx } from './cx';

// 장면 영상 칸. 다크 모드, 동작 줄이기, 로딩 실패 때는 정지 그림(docs/design/components/SceneMedia.md)
const videos = import.meta.glob('../assets/motion/*.mp4', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const videoOf = (name: string) =>
  Object.entries(videos).find(([p]) => p.endsWith(`/${name}.mp4`))?.[1];

export type Scene = {
  still: 'scene-pie' | 'scene-cherries' | 'scene-box' | 'scene-cake-candle' | 'scene-tart';
  motion: string;
};

export const SCENES = {
  'W-04': { still: 'scene-pie', motion: 'motion-w04-pie' },
  'P-11': { still: 'scene-cherries', motion: 'motion-p11-cherries' },
  'P-01': { still: 'scene-box', motion: 'motion-p01-box' },
  'H-T1': { still: 'scene-cake-candle', motion: 'motion-ht1-cake' },
  'A-02': { still: 'scene-tart', motion: 'motion-a02-tart' },
} as const satisfies Record<string, Scene>;

function useMedia(query: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

export function SceneMedia({
  scene,
  tall,
  width,
}: {
  scene: keyof typeof SCENES;
  tall?: boolean;
  width?: number;
}) {
  const { still, motion } = SCENES[scene];
  const reduce = useMedia('(prefers-reduced-motion: reduce)');
  const dark = useMedia('(prefers-color-scheme: dark)');
  const [failed, setFailed] = useState(false);
  const stillSrc = illustrations[still];
  const src = videoOf(motion);
  const showVideo = Boolean(src) && !reduce && !dark && !failed;
  return (
    <figure
      className={cx('hg-scene', tall && 'hg-scene--tall', !showVideo && 'is-still')}
      style={width ? { width } : undefined}
    >
      {showVideo ? (
        <video
          muted
          playsInline
          autoPlay
          poster={stillSrc}
          src={src}
          onError={() => setFailed(true)}
          aria-hidden="true"
        />
      ) : (
        <img className="hg-scene__still" src={stillSrc} alt="" />
      )}
    </figure>
  );
}
