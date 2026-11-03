import { fetchAvatars, qk } from '@sweetwo/api';
import { avatarArt } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';

/** 같은 공간 사람 그림(2026-11-03): 사람 id → 올린 사진 → 지정 아바타 그림 주소(둘 다 없으면 없음 → 첫 글자) */
export function usePeopleArt(): (userId: string | null | undefined) => string | undefined {
  const q = useQuery({ queryKey: qk.avatars, queryFn: fetchAvatars, staleTime: 30 * 60_000 });
  return (id) => {
    if (!id || !q.data) return undefined;
    return q.data.photos[id] ?? avatarArt(q.data.presets[id]);
  };
}

// 사람 원(Avatar). 사진·지정 아바타 그림이 있으면 그림, 없으면 첫 글자. 시작한 사람 1, 합류한 사람 2(누가 보든 같음)
export function PersonDot({
  name,
  starter,
  userId,
  className,
}: {
  name: string;
  starter: boolean;
  userId?: string | null;
  className?: string;
}) {
  const src = usePeopleArt()(userId);
  const extra = className ? ` ${className}` : '';
  return src ? (
    <span className={`hg-avatar hg-avatar--photo${extra}`} aria-hidden="true">
      <img src={src} alt="" />
    </span>
  ) : (
    <span
      className={`hg-avatar ${starter ? 'hg-avatar--p1' : 'hg-avatar--p2'}${extra}`}
      aria-hidden="true"
    >
      {[...name][0] ?? ''}
    </span>
  );
}
