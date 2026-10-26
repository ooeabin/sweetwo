import { AuthCallError } from './auth';
import { supabase } from './client';

// 사진(22 G-02 목표 사진, 24 Y-08c·Y-09 기록 사진). 저장소 photos/{g|r}/{무작위}.jpg, photo 행을 볼 수 있는 사람만 읽음.
// 올리기 → 붙이기(set_goal_photo, add_care_photo). 보여 줄 때는 1시간짜리 서명 주소. 지우기는 서버가(purge-storage).
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};
const BUCKET = 'photos';

/** 줄인 JPEG 올리기 → 경로(아직 아무 데도 안 붙음, 하루 안에 붙이지 않으면 서버가 지움) */
export async function uploadPhoto(
  kind: 'g' | 'r',
  jpeg: Blob,
): Promise<{ path: string; size: number }> {
  const path = `${kind}/${crypto.randomUUID()}.jpg`;
  const up = await supabase()
    .storage.from(BUCKET)
    .upload(path, jpeg, { contentType: 'image/jpeg', cacheControl: '3600' });
  fail(up.error);
  return { path, size: jpeg.size };
}

/** 목표 사진 바꾸기(경로) / 지우기(null) */
export async function setGoalPhoto(goalId: string, photo: { path: string; size: number } | null) {
  const { error } = await supabase().rpc(
    'set_goal_photo',
    photo ? { p_goal: goalId, p_path: photo.path, p_size: photo.size } : { p_goal: goalId },
  );
  fail(error);
}

/** 기록에 사진 붙이기(한 기록 10장까지) */
export async function addCarePhoto(recordId: string, photo: { path: string; size: number }) {
  const { error } = await supabase().rpc('add_care_photo', {
    p_record: recordId,
    p_path: photo.path,
    p_size: photo.size,
  });
  fail(error);
}

export interface CarePhoto {
  care_record_id: string;
  path: string;
  sort: number;
}
/** 볼 수 있는 기록 사진 전부(Y-09) */
export async function fetchCarePhotos(): Promise<CarePhoto[]> {
  const { data, error } = await supabase()
    .from('photo')
    .select('care_record_id, path, sort')
    .not('care_record_id', 'is', null)
    .order('sort');
  fail(error);
  return (data ?? []).flatMap((r) =>
    r.care_record_id ? [{ care_record_id: r.care_record_id, path: r.path, sort: r.sort }] : [],
  );
}

/** 경로 → 서명 주소(1시간). 볼 수 없는 경로는 빠짐 */
export async function fetchPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrls(paths, 3600);
  fail(error);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  return out;
}

/** 사진(챙길 날) 동의를 했는지(31 동의 8종, 처음 사진 추가 시). 가장 최근 기록 */
export async function fetchPhotoConsent(): Promise<boolean> {
  const { data, error } = await supabase()
    .from('consent')
    .select('agreed')
    .eq('kind', 'photo')
    .order('created_at', { ascending: false })
    .limit(1);
  fail(error);
  return data?.[0]?.agreed === true;
}

/** 사진(챙길 날) 동의 기록(추가만) */
export async function agreePhotoConsent(userId: string, version: string) {
  const { error } = await supabase().from('consent').insert({
    user_id: userId,
    kind: 'photo',
    terms_version: version,
    agreed: true,
    source: 'care_day_first',
  });
  fail(error);
}
