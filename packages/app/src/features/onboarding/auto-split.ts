import {
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  fetchSplits,
  saveSplit,
  startChecklist,
  updateGoal,
} from '@sweetwo/api';
import { addMonths, thisMonth, ymToDate } from '@sweetwo/core';
import { emergencyGoalTarget, recommendedDraft } from '../salary';

/**
 * 온보딩 끝(O-31 다음, ADR 0005): 분배표를 추천값으로 바로 만들고 첫 체크리스트를 연다.
 * 사용자는 홈 할 일 ‘분배표 확인’에서 W-01로 고친다. 이미 분배표가 있으면(다시 온보딩) 그대로 둔다.
 * 비상금 목표 금액 = (고정지출 + 생활비) × 3, 기한 1년 뒤(17 O-50과 같음).
 */
export async function saveRecommendedSplit() {
  const [me, space, goals, partner, splits] = await Promise.all([
    fetchMe(),
    fetchSpace(),
    fetchGoals(),
    fetchPartner(),
    fetchSplits(),
  ]);
  if (!me) return;
  const joint = space?.salary_mode === 'joint';
  const mine = splits.find((x) => (joint ? x.owner_user_id === null : x.owner_user_id === me.id));
  if (mine?.split_line.length) return;
  const lines = recommendedDraft(me, goals, { partner: joint ? partner : null, joint });
  await saveSplit(lines, joint ? undefined : me.id);
  const emergency = goals.find((g) => g.template === 'emergency');
  if (emergency) {
    await updateGoal(emergency.id, {
      target_amount: emergencyGoalTarget(lines),
      amount_estimated: false,
      deadline: ymToDate(addMonths(thisMonth(), 12)),
      deadline_estimated: false,
    });
  }
  // 월급날이 있어야 체크리스트가 생김(월급이 없으면 홈 할 일만)
  if (me.payday || me.payday_last) await startChecklist(joint ? undefined : me.id);
}
