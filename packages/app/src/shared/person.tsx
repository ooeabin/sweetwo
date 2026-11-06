import {
  fetchAvatars,
  fetchSocialAvatar,
  markSocialAvatarChecked,
  needsSocialAvatar,
  qk,
  uploadAvatar,
} from '@sweetwo/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { track } from './analytics';
import { squarePhoto } from './photo';

/** 같은 공간 사람 프로필 사진: 사람 id → 사진 주소(없으면 없음 → 첫 글자). 2026-11-05 지정 아바타 없앰 */
export function usePeopleArt(): (userId: string | null | undefined) => string | undefined {
  const q = useQuery({ queryKey: qk.avatars, queryFn: fetchAvatars, staleTime: 30 * 60_000 });
  return (id) => (id && q.data ? q.data.photos[id] : undefined);
}

/**
 * 소셜 계정 프로필 사진 한 번 가져오기(2026-11-05, 25 S-11e ‘처음 사진’). 앱 틀이 부름.
 * 우리 둘 공간이 있고 사진이 없고 아직 시도하지 않았으면: 함수로 받아 → 가운데 정사각 512px JPEG → 내 사진으로 저장 → 시도 남김.
 * 사진이 없거나 그림을 못 읽어도 시도 남김(다시 안 함). 함수 호출이 실패하면 남기지 않음(다음에 다시). 알림, Toast 없음
 */
// 앱을 켤 때마다 한 번만 확인(화면마다 앱 틀이 새로 그려져도)
let socialChecked = false;
export function useSocialAvatar(
  userId: string | null | undefined,
  spaceId: string | null | undefined,
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId || !spaceId || socialChecked) return;
    socialChecked = true;
    void (async () => {
      try {
        if (!(await needsSocialAvatar())) return;
        const pic = await fetchSocialAvatar();
        let saved = false;
        if (pic) {
          try {
            await uploadAvatar(spaceId, userId, await squarePhoto(pic));
            saved = true;
          } catch {
            /* 그림을 못 읽으면 이름 첫 글자 그대로 */
          }
        }
        await markSocialAvatarChecked();
        if (saved) {
          track('profile_photo_changed', { action: 'imported' });
          await qc.invalidateQueries({ queryKey: qk.avatars });
        }
      } catch {
        /* 다음에 다시 */
      }
    })();
  }, [userId, spaceId, qc]);
}

// 사람 원(Avatar). 사진이 있으면 사진, 없으면 첫 글자. 시작한 사람 1, 합류한 사람 2(누가 보든 같음)
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
