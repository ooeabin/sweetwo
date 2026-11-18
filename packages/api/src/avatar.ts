import { AuthCallError } from './auth';
import { supabase } from './client';

// 프로필 사진(25 S-11e). 저장소 avatars/{space_id}/{user_id}.jpg, 같은 공간 두 사람만 읽음. 보여 줄 때는 1시간짜리 서명 주소.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};
const BUCKET = 'avatars';

// 사진으로 인정하는 경로는 우리 저장소의 avatars/{space_id}/{user_id}.jpg 하나뿐(2026-11-18). 소셜 계정(구글, 카카오) 사진 주소나 다른 값은 무시
const AVATAR_PATH = /^[\w-]+\/[\w-]+\.jpg$/;
export const isAvatarPath = (path: unknown): path is string =>
  typeof path === 'string' && AVATAR_PATH.test(path);

/** 같은 공간 사람이 직접 올린 프로필 사진: 사람 id → 서명 주소(없으면 목록에 없음 → 닉네임 글자) */
export async function fetchAvatars(): Promise<{ photos: Record<string, string> }> {
  const { data, error } = await supabase().rpc('space_avatars');
  fail(error);
  const rows = (data ?? []).filter((r): r is typeof r & { path: string } => isAvatarPath(r.path));
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
 * 소셜 계정(카카오·구글)에서 사용자가 직접 지정한 프로필 사진만 받기(2026-11-05, 25 S-11e ‘처음 사진’, 2026-11-18 기본 이미지 제외).
 * 함수 social-avatar가 로그인 직후 받은 제공자 토큰으로 제공자 API를 불러 기본 이미지인지 확인하고, 직접 지정한 사진만 받아 줌.
 * 기본 이미지, 사진 없음, 이미 사진을 바꾼 사람이면 null. 함수 호출 자체가 실패하면 throw(다음에 다시)
 */
export async function fetchSocialAvatar(
  provider: 'google' | 'kakao',
  token: string,
): Promise<Blob | null> {
  const { data, error } = await supabase().functions.invoke('social-avatar', {
    method: 'POST',
    body: { provider, token },
  });
  if (error) throw new AuthCallError('network');
  return data instanceof Blob && data.size > 0 ? data : null;
}

/** 소셜 사진 가져오기를 시도했다고 남김(한 번만). 앱에서 사진을 올리거나 지워도 남겨 덮어쓰지 않음 */
export async function markSocialAvatarChecked() {
  const { error } = await supabase().rpc('mark_social_avatar_checked');
  fail(error);
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

/** 정사각 512px JPEG 올리기 → 경로 저장 */
export async function uploadAvatar(spaceId: string, userId: string, jpeg: Blob) {
  const path = `${spaceId}/${userId}.jpg`;
  const up = await supabase()
    .storage.from(BUCKET)
    .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' });
  fail(up.error);
  const { error } = await supabase().rpc('set_avatar', { p_path: path });
  fail(error);
  // 직접 올렸으면 소셜 사진으로 덮어쓰지 않음
  await markSocialAvatarChecked().catch(() => undefined);
}

/** 사진 지우기 → 닉네임 글자 아바타 */
export async function removeAvatar(spaceId: string, userId: string) {
  const { error } = await supabase().rpc('set_avatar', {});
  fail(error);
  // 지웠으면 소셜 사진을 다시 가져오지 않음
  await markSocialAvatarChecked().catch(() => undefined);
  await supabase()
    .storage.from(BUCKET)
    .remove([`${spaceId}/${userId}.jpg`]);
}

/** S-11 ‘로그인’ 줄: 가입한 소셜 계정 이메일(없으면 null, 25 S-11 3번, 2026-11-12 QA 11구간 S11-11) */
export async function fetchLoginEmail(): Promise<string | null> {
  const { data, error } = await supabase().rpc('my_login_email');
  fail(error);
  return typeof data === 'string' && data ? data : null;
}
