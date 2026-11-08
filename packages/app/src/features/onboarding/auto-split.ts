import {
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  fetchSplits,
  saveSplit,
  startChecklist,
} from '@sweetwo/api';
import { recommendedDraft } from '../salary';

/**
 * 온보딩 끝(O-32 다음, ADR 0005): 월급 계획을 추천값으로 바로 만들고 첫 체크리스트를 연다.
 * 사용자는 홈 H-03 ‘월급 계획 고치기’ → W-01에서 고친다. 이미 월급 계획이 있으면(다시 온보딩) 그대로 둔다.
 * 2026-11-08 ADR 0007: 비상금 기본 항목 없음. 저금 항목이 없으면 저금 줄 없이(남은 금액은 남는 돈)
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
  // 월급날이 있어야 체크리스트가 생김(월급이 없으면 홈 할 일만)
  if (me.payday || me.payday_last) await startChecklist(joint ? undefined : me.id);
}
