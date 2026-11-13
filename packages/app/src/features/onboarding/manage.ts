import { requestModeChange } from '@sweetwo/api';
import { managerEventValue, resolveManageStyle, type ManagerAnswer } from '@sweetwo/core';
import { track } from '../../shared/analytics';
import type { Space } from './data';

// O-30·O-30b·O-30c 관리 형태 세 질문(17 v2.2, 08 2장 표). 서버 request_mode_change 한 곳으로 저장(직접 salary_mode를 바꾸지 않음).
// 화면마다 저장(16 ‘답은 화면마다 저장’): 생활비 ‘네’인데 아직 O-30c 전이면 관리 답은 지금 값(없으면 ‘둘이 같이’)으로 잠시 둠.

/** 지금 공간에서 고른 관리 답(‘나’ 기준). 생활비 ‘아니요’거나 아직 안 골랐으면 null */
export function managerAnswerOf(
  space: Pick<
    Space,
    'salary_mode' | 'manager_user_id' | 'manager_pending_partner' | 'shared_living'
  >,
  meId: string | undefined,
): ManagerAnswer | null {
  if (space.shared_living !== true) return null;
  if (space.salary_mode === 'separate') return 'each';
  if (space.manager_pending_partner) return 'partner';
  if (!space.manager_user_id) return 'together';
  return space.manager_user_id === meId ? 'me' : 'partner';
}

/**
 * 세 답 저장. final = 마지막 질문(생활비 ‘아니요’면 O-30b, ‘네’면 O-30c)이라 분석 manage_answers_saved를 남김.
 * 엔진 값은 core resolveManageStyle과 서버가 같은 결과(합류 전 ‘파트너가 주로 해요’는 서버가 합류 때 정함)
 */
export async function saveManage(o: {
  living: boolean;
  saving: boolean | null;
  manager: ManagerAnswer | null;
  screenId: string;
  final: boolean;
}) {
  const manager = o.living ? (o.manager ?? 'together') : null;
  await requestModeChange({ sharedLiving: o.living, sharedSaving: o.saving ?? false, manager });
  if (!o.final) return;
  track('manage_answers_saved', {
    shared_living: o.living,
    shared_saving: o.saving ?? false,
    manager: managerEventValue(manager),
    salary_mode: resolveManageStyle(o.living, o.saving, manager).salaryMode,
    screen_id: o.screenId,
  });
}
