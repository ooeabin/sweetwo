import { AuthCallError } from './auth';
import { supabase } from './client';

// 프로필 사진(25 S-11e). 저장소 avatars/{space_id}/{user_id}.jpg, 같은 공간 두 사람만 읽음. 보여 줄 때는 1시간짜리 서명 주소.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};
const BUCKET = 'avatars';

/**
 * 같은 공간 사람 그림(2026-11-03). photos: 사람 id → 올린 사진 주소(없으면 목록에 없음),
 * presets: 사람 id → 지정 아바타 이름(a01…). 화면은 올린 사진 → 지정 아바타 그림 → 첫 글자 순서로 보여 줌
 */
export async function fetchAvatars(): Promise<{
  photos: Record<string, string>;
  presets: Record<string, string>;
}> {
  const { data, error } = await supabase().rpc('space_people_art');
  fail(error);
  const all = data ?? [];
  const presets: Record<string, string> = {};
  for (const r of all) if (r.preset) presets[r.user_id] = r.preset;
  const rows = all.filter((r): r is typeof r & { path: string } => !!r.path);
  const photos: Record<string, string> = {};
  if (!rows.length) return { photos, presets };
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
  return { photos, presets };
}

/** 지정 아바타 고르기(S-11e). 올린 사진이 있었으면 서버가 경로를 비우고 파일은 여기서 지움 */
export async function setAvatarPreset(spaceId: string | null, userId: string, preset: string) {
  const { error } = await supabase().rpc('set_avatar_preset', { p_preset: preset });
  fail(error);
  if (spaceId)
    await supabase()
      .storage.from(BUCKET)
      .remove([`${spaceId}/${userId}.jpg`]);
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
