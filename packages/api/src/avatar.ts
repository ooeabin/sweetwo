import { AuthCallError } from './auth';
import { supabase } from './client';

// 프로필 사진(25 S-11e). 저장소 avatars/{space_id}/{user_id}.jpg, 같은 공간 두 사람만 읽음. 보여 줄 때는 1시간짜리 서명 주소.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};
const BUCKET = 'avatars';

/** 같은 공간 사람 id → 사진 주소(없으면 목록에 없음) */
export async function fetchAvatars(): Promise<Record<string, string>> {
  const { data, error } = await supabase().rpc('space_avatars');
  fail(error);
  const rows = (data ?? []).filter((r): r is typeof r & { path: string } => !!r.path);
  if (!rows.length) return {};
  const signed = await supabase()
    .storage.from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.path),
      3600,
    );
  fail(signed.error);
  const out: Record<string, string> = {};
  rows.forEach((r, i) => {
    const url = signed.data?.[i]?.signedUrl;
    // 바뀐 사진을 바로 보이게 시각을 붙임
    if (url) out[r.user_id] = `${url}&v=${encodeURIComponent(r.updated_at ?? '')}`;
  });
  return out;
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

/** 사진 지우기 → 이름 첫 글자 */
export async function removeAvatar(spaceId: string, userId: string) {
  const { error } = await supabase().rpc('set_avatar', {});
  fail(error);
  await supabase()
    .storage.from(BUCKET)
    .remove([`${spaceId}/${userId}.jpg`]);
}
