// 지정 그림 파일(2026-11-03). 목표 지정 사진 assets/goal-photos/travel-01.webp….
// 힉스필드로 만들어 넣기 전까지는 비어 있음. 파일이 없으면 undefined → 소비자가 빈 자리(목표 아이콘)를 그림.
// 2026-11-05 프로필 지정 아바타(avatars/) 없앰.
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

const goals = byName(goalFiles);

/** 목표 지정 사진 주소(파일이 없으면 undefined) */
export const goalPhotoArt = (preset: string | null | undefined): string | undefined =>
  preset ? goals[preset] : undefined;
