import {
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  resetOnboardingPlan,
  saveSplit,
  startChecklist,
} from '@sweetwo/api';
import { recommendedDraft } from '../salary';

/**
 * 온보딩 끝(O-32 다음, ‘지금은 월급이 없어요’, ADR 0005): 월급 계획을 추천값으로 만들고 첫 체크리스트를 연다.
 * 사용자는 홈 H-03 ‘월급 계획 고치기’ → W-01에서 고친다.
 * 2026-11-10 QA 2구간 S2-01: 온보딩 중에는 늘 처음부터 다시 만듦(뒤로 가서 월급·월급날·관리 방식을 바꿔도 맞게).
 * 서버(onboarding_reset_plan)가 내 것과 공동 것을 지우고(체크한 기록이 있으면 그대로), 다시 저장한 뒤 체크리스트를 연다.
 * 2026-11-08 ADR 0007: 비상금 기본 항목 없음. 저금 항목이 없으면 저금 줄 없이(남은 금액은 여유 자금)
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
  const lines = recommendedDraft(me, goals, { partner: joint ? partner : null, joint });
  await saveSplit(lines, joint ? undefined : me.id);
  // 월급날이 있어야 체크리스트가 생김(월급이 없으면 홈 할 일만)
  if (me.payday || me.payday_last) await startChecklist(joint ? undefined : me.id);
}
