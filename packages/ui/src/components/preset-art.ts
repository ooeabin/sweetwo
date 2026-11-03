// 지정 그림 파일(2026-11-03). 프로필 지정 아바타 assets/avatars/a01.webp…, 목표 지정 사진 assets/goal-photos/travel-01.webp….
// 힉스필드로 만들어 넣기 전까지는 비어 있음. 파일이 없으면 undefined → 소비자가 빈 자리(첫 글자, 목표 아이콘)를 그림.
const avatarFiles = import.meta.glob('../assets/avatars/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const goalFiles = import.meta.glob('../assets/goal-photos/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const byName = (files: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [
      (path.split('/').pop() ?? '').replace('.webp', ''),
      url,
    ]),
  ) as Record<string, string>;

const avatars = byName(avatarFiles);
const goals = byName(goalFiles);

/** 지정 아바타 그림 주소(파일이 없으면 undefined) */
export const avatarArt = (preset: string | null | undefined): string | undefined =>
  preset ? avatars[preset] : undefined;

/** 목표 지정 사진 주소(파일이 없으면 undefined) */
export const goalPhotoArt = (preset: string | null | undefined): string | undefined =>
  preset ? goals[preset] : undefined;
