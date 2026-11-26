import {
  fetchAvatars,
  fetchSocialAvatar,
  markSocialAvatarChecked,
  needsSocialAvatar,
  qk,
  uploadAvatar,
} from '@sweetwo/api';
import { Avatar } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { session } from '../features/auth';
import { track } from './analytics';
import { squarePhoto } from './photo';
import { onSessionReset } from './session-reset';

/** 같은 공간 사람 프로필 사진(직접 올린 것만): 사람 id → 사진 주소(없으면 없음 → 닉네임 글자). 소셜 계정 사진은 쓰지 않음(2026-11-18) */
export function usePeopleArt(): (userId: string | null | undefined) => string | undefined {
  const q = useQuery({ queryKey: qk.avatars, queryFn: fetchAvatars, staleTime: 30 * 60_000 });
  return (id) => (id && q.data ? q.data.photos[id] : undefined);
}

/**
 * 소셜 계정 프로필 사진 한 번 가져오기(2026-11-05, 25 S-11e ‘처음 사진’, 2026-11-18 직접 지정한 사진만). 앱 틀이 부름.
 * 로그인 직후 받은 제공자 토큰(구글, 카카오)이 있고, 우리 둘 공간이 있고, 사진이 없고, 아직 시도하지 않았을 때만:
 * 함수 social-avatar가 제공자 API로 ‘직접 지정한 사진’인지 확인해 받아 줌 → 가운데 정사각 512px JPEG → 내 사진으로 저장 → 시도 남김.
 * 기본 이미지(구글 글자 원, 카카오 기본 이미지)면 저장하지 않고 닉네임 글자 아바타 그대로. 토큰이 없거나(다시 실행, 애플) 호출이 실패해도
 * 글자 아바타 그대로, 알림·Toast 없음. 소셜 계정 사진 주소(user_metadata)는 읽지 않음
 */
// 앱을 켤 때마다 한 번만 확인(화면마다 앱 틀이 새로 그려져도)
let socialChecked = false;
// 같은 실행에서 다른 계정으로 로그인하면 그 계정도 한 번 확인(2026-11-12 QA 11구간 S11-08)
onSessionReset(() => {
  socialChecked = false;
});
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
        const login = await session.providerToken();
        if (!login) return;
        const pic = await fetchSocialAvatar(login.provider, login.token);
        let saved = false;
        if (pic) {
          try {
            await uploadAvatar(spaceId, userId, await squarePhoto(pic));
            saved = true;
          } catch {
            /* 그림을 못 읽으면 닉네임 글자 그대로 */
          }
        }
        await markSocialAvatarChecked();
        if (saved) {
          track('profile_photo_changed', { action: 'imported' });
          await qc.invalidateQueries({ queryKey: qk.avatars });
        }
      } catch {
        /* 글자 아바타 그대로 */
      }
    })();
  }, [userId, spaceId, qc]);
}

// 사람 원(Avatar). 직접 올린 사진이 있으면 사진, 없으면 사람 색 원 + 닉네임 앞 최대 3자. 시작한 사람 1, 합류한 사람 2(누가 보든 같음)
export function PersonDot({
  name,
  starter,
  userId,
  className,
  size,
}: {
  name: string;
  starter: boolean;
  userId?: string | null;
  className?: string;
  /** Avatar 크기 단계(홈 H-10 머리는 sm 24, 2026-11-26) */
  size?: 'sm' | 'md' | 'lg';
}) {
  const src = usePeopleArt()(userId);
  return <Avatar name={name} no={starter ? 1 : 2} src={src} size={size} className={className} />;
}
