import { fetchPhotoUrls, qk } from '@sweetwo/api';
import { useQuery } from '@tanstack/react-query';

// 사진 올리기 공통(25 S-11e, 22 목표 사진, 24 Y-08c): 형식·크기 검사, 기기에서 줄여 JPEG로 다시 그림(EXIF 위치 정보 없음), 서명 주소.
const TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** 고른 파일 검사: 지원하지 않는 형식이면 'type', 10MB 초과면 'size' */
export function checkPhoto(f: Pick<File, 'type' | 'size' | 'name'>): 'type' | 'size' | null {
  const heic = /\.(heic|heif)$/i.test(f.name);
  if (!TYPES.includes(f.type) && !heic) return 'type';
  if (f.size > PHOTO_MAX_BYTES) return 'size';
  return null;
}

/** 긴 변을 longEdge 이하로 줄인 JPEG(작으면 크기 그대로 다시 그림) */
export async function shrinkPhoto(file: Blob, longEdge = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, longEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, no) =>
      c.toBlob((b) => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 사진 경로들 → 서명 주소(1시간, 50분마다 새로) */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))].sort();
  return (
    useQuery({
      queryKey: qk.photoUrls(list),
      queryFn: () => fetchPhotoUrls(list),
      enabled: list.length > 0,
      staleTime: 50 * 60_000,
    }).data ?? {}
  );
}
