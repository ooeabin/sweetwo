import { AuthCallError } from './auth';
import { supabase } from './client';

// 프로필 사진(25 S-11e). 저장소 avatars/{space_id}/{user_id}.jpg, 같은 공간 두 사람만 읽음. 보여 줄 때는 1시간짜리 서명 주소.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};
const BUCKET = 'avatars';

/** 같은 공간 사람 프로필 사진: 사람 id → 서명 주소(없으면 목록에 없음 → 이름 첫 글자). 2026-11-05 지정 아바타 없앰 */
export async function fetchAvatars(): Promise<{ photos: Record<string, string> }> {
  const { data, error } = await supabase().rpc('space_avatars');
  fail(error);
  const rows = (data ?? []).filter((r): r is typeof r & { path: string } => !!r.path);
  const photos: Record<string, string> = {};
  if (!rows.length) return { photos };
  const signed = await supabase()
    .storage.from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.path),
      3600,
    );
  fail(signed.error);
  rows.forEach((r, i) => {
    const url = signed.data?.[i]?.signedUrl;
    // 바뀐 사진을 바로 보이게 시각을 붙임
    if (url) photos[r.user_id] = `${url}&v=${encodeURIComponent(r.updated_at ?? '')}`;
  });
  return { photos };
}

/**
 * 소셜 계정(카카오·구글) 프로필 사진 받기(2026-11-05, 25 S-11e ‘처음 사진’). 함수 social-avatar가 내 로그인 정보의 사진을 받아 줌.
 * 사진이 없으면 null. 함수 호출 자체가 실패하면 throw(다음에 다시)
 */
export async function fetchSocialAvatar(): Promise<Blob | null> {
  const { data, error } = await supabase().functions.invoke('social-avatar', { method: 'POST' });
  if (error) throw new AuthCallError('network');
  return data instanceof Blob && data.size > 0 ? data : null;
}

/** 소셜 사진 가져오기를 시도했다고 남김(한 번만) */
export async function markSocialAvatarChecked() {
  const { error } = await supabase().rpc('mark_social_avatar_checked');
  fail(error);
}

/** 정사각 512px JPEG 올리기 → 경로 저장 */
export async function uploadAvatar(spaceId: string, userId: string, jpeg: Blob) {
  const path = `${spaceId}/${userId}.jpg`;
  const up = await supabase()
    .storage.from(BUCKET)
    .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' });
  fail(up.error);
  const { error } = await supabase().rpc('set_avatar', { p_path: path });
  fail(error);
}

/** 사진 지우기 → 이름 첫 글자(소셜 사진을 다시 가져오지 않음) */
export async function removeAvatar(spaceId: string, userId: string) {
  const { error } = await supabase().rpc('set_avatar', {});
  fail(error);
  await supabase()
    .storage.from(BUCKET)
    .remove([`${spaceId}/${userId}.jpg`]);
}

/** 소셜 사진을 가져올 차례인지: 우리 둘 공간이 있고, 사진이 없고, 아직 시도하지 않았을 때(25 S-11e) */
export async function needsSocialAvatar(): Promise<boolean> {
  const { data, error } = await supabase()
    .from('app_user')
    .select('space_id, avatar_path, avatar_social_checked_at')
    .maybeSingle();
  fail(error);
  return !!data?.space_id && !data.avatar_path && !data.avatar_social_checked_at;
}
