import { qk, setPlanShare, type Me } from '@sweetwo/api';
import { PLAN_SHARES, type PlanShare } from '@sweetwo/core';
import { BottomSheet, ChoiceCards } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { track } from '../../shared/analytics';
import { toast } from '../../shared/toast';
import { copy } from './copy';

// S-13 ① ‘내 월급 계획’ 공개 단계 시트(08 6장): 모두 / 저금만(기본) / 했어요만.
// S-11c(O-31·P-05와 같은 공개 고지 ‘바꾸기’)와 S-13이 같이 씀. 고르면 바로 저장 + 분석 plan_share_changed.
export function PlanShareSheet({
  me,
  screenId,
  onClose,
}: {
  me: Me;
  screenId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const from = me.plan_share as PlanShare;
  return (
    <BottomSheet title={copy.planShareTitle} onClose={onClose}>
      <ChoiceCards<PlanShare>
        label={copy.planShareTitle}
        value={from}
        autoAdvance={false}
        options={PLAN_SHARES.map((v) => ({ value: v, label: copy.planShares[v] ?? v }))}
        onChange={(to) => {
          onClose();
          if (to === from) return;
          void savePlanShare(me.id, from, to, screenId)
            .then(() => qc.invalidateQueries({ queryKey: qk.me }))
            .then(() => qc.invalidateQueries({ queryKey: ['partner_plan_view'] }))
            .then(() => toast(copy.saved))
            .catch(() => toast(copy.failed));
        }}
      />
    </BottomSheet>
  );
}

/** 공개 단계 저장 + 분석(S-13 줄, 시트) */
export async function savePlanShare(
  userId: string,
  from: PlanShare,
  to: PlanShare,
  screenId: string,
) {
  await setPlanShare(userId, to);
  track('plan_share_changed', { from, to, screen_id: screenId });
}

/** 공개 고지 한 줄(O-31 5번, S-11c 1번): 같이 계열이면 금액도 보인다는 말, 각자 계열이면 지금 공개 단계 */
export const shareNoteOf = (joint: boolean, share: string) =>
  joint
    ? copy.shareNote.joint
    : (copy.shareNote[share as keyof typeof copy.shareNote] ?? copy.shareNote.saving_only);
