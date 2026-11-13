import {
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  resetOnboardingPlan,
  saveSplit,
} from '@sweetwo/api';
import { sharedAccountSeed } from '@sweetwo/core';
import { recommendedDraft } from '../salary';

/**
 * 온보딩 끝(O-32 다음, ‘지금은 월급이 없어요’, ADR 0005): 월급 계획을 추천값으로 만든다.
 * 사용자는 W-01에서 고친다. 2026-11-13 v2.2: 첫 확인 목록은 만들지 않음(소급 없음, 다음 월급날 0시에 서버가 만듦, 07 3-1).
 * 2026-11-10 QA 2구간 S2-01: 온보딩 중에는 늘 처음부터 다시 만듦(뒤로 가서 월급·월급날·관리 형태를 바꿔도 맞게).
 * 서버(onboarding_reset_plan)가 내 것과 공동 것을 지우고(체크한 기록이 있으면 그대로) 다시 저장.
 * 2026-11-08 ADR 0007: 비상금 기본 항목 없음. 저금 항목이 없으면 저금 줄 없이(남은 금액은 여유 자금).
 * 한 사람 관리형의 보내기 줄은 서버가 만듦(save_split → recalc_send_line), 줄 설정 기본값도 서버(06 3-1)
 */
export async function saveRecommendedSplit() {
  const [me, space, goals, partner] = await Promise.all([
    fetchMe(),
    fetchSpace(),
    fetchGoals(),
    fetchPartner(),
  ]);
  if (!me) return;
  const joint = space?.salary_mode === 'joint';
  await resetOnboardingPlan();
  const lines = [
    ...recommendedDraft(me, goals, {
      partner: joint ? partner : null,
      joint,
      equalAllowance: joint,
    }),
    ...sharedAccountSeed(space?.salary_mode ?? 'separate', space?.shared_living),
  ];
  await saveSplit(lines, joint ? undefined : me.id);
}
