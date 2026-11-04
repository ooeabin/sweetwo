// 지정 그림(2026-11-03, 25 S-11e 지정 아바타, 22 G-02 ‘목표 사진’). 그림 파일은 packages/ui assets(avatars, goal-photos),
// 힉스필드로 만들어 넣기 전까지는 비어 있고 화면은 빈 자리(첫 글자, 목표 아이콘)를 보여 줌.

/** 지정 아바타 개수 [확인 필요]. DB 가입 기본값(a01~a07 무작위)과 같아야 함 */
export const AVATAR_PRESET_COUNT = 7;
/** 목표 종류마다 지정 사진 1장(2026-11-04 실사 21장, 바꾸고 싶으면 사용자가 직접 올림) */
export const GOAL_PHOTO_COUNT = 1;

const two = (n: number) => String(n).padStart(2, '0');

/** a01, a02, … */
export const avatarPresets: string[] = Array.from(
  { length: AVATAR_PRESET_COUNT },
  (_, i) => `a${two(i + 1)}`,
);

/** 그 종류의 지정 사진(travel-01). 직접 만든 목표는 지정 사진 없음(회색 기본 자리, 올리면 그 사진) */
export const goalPhotoPresets = (template: string): string[] =>
  template === 'custom'
    ? []
    : Array.from({ length: GOAL_PHOTO_COUNT }, (_, i) => `${template}-${two(i + 1)}`);

/** 그 종류의 기본 사진(1번). 직접 만든 목표는 없음 */
export const defaultGoalPreset = (template: string): string | null =>
  template === 'custom' ? null : `${template}-01`;

/** 지금 보여 줄 지정 사진 이름(예전에 고른 2·3번처럼 없는 사진이면 기본으로) */
export const goalPreset = (g: { template: string; photo_preset?: string | null }): string | null =>
  g.photo_preset && goalPhotoPresets(g.template).includes(g.photo_preset)
    ? g.photo_preset
    : defaultGoalPreset(g.template);

/** 고르기 화면(G-02p)에 보여 줄 지정 사진: 그 종류 기본 1장(직접 만든 목표는 없음, 올리기만) */
export const goalPhotoChoices = (template: string): string[] => goalPhotoPresets(template);
