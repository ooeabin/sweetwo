import { qk, setPlanShare } from '@sweetwo/api';
import type { PlanShare } from '@sweetwo/core';
import { BottomSheet, ChoiceCards } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { track } from './analytics';
import { sharedCopy } from './copy';
import { toast } from './toast';

const OPTIONS: readonly PlanShare[] = ['all', 'saving_only', 'done_only'];

/**
 * 월급 입력의 공개 고지 한 줄(17 O-31 5번, 18 P-05, 08 6장). note는 QuestionLayout `note`(주 버튼 위 가운데 회색 한 줄)에,
 * sheet는 화면 안 아무 곳(note가 p 안이라 시트는 따로)에 넣는다.
 * 각자 계열: 내 공개 단계(app_user.plan_share) 문장 + 글자 버튼 ‘바꾸기’ → S-13 ① ‘내 월급 계획’ 시트(모두 / 저금만 / 했어요만).
 * 같이 계열: “같이 관리하면 파트너도 이 금액을 봐요” 한 줄(같이 계열은 모두 보임).
 */
export function usePlanShareNote({
  joint,
  userId,
  share,
  screenId,
}: {
  joint: boolean;
  userId: string;
  share: PlanShare;
  screenId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const c = sharedCopy.shareNote;
  if (joint) return { note: <>{c.joint}</>, sheet: null };
  const pick = async (to: PlanShare) => {
    setOpen(false);
    if (to === share) return;
    try {
      await setPlanShare(userId, to);
      track('plan_share_changed', { from: share, to, screen_id: screenId });
      await qc.invalidateQueries({ queryKey: qk.me });
    } catch {
      toast(sharedCopy.saveFailed);
    }
  };
  return {
    note: (
      <>
        {c[share]}{' '}
        <button type="button" className="hg-btn hg-btn--link" onClick={() => setOpen(true)}>
          {c.change}
        </button>
      </>
    ),
    sheet: open && (
      <BottomSheet title={c.sheet} onClose={() => setOpen(false)}>
        <ChoiceCards<PlanShare>
          label={c.sheet}
          value={share}
          onChange={(v) => void pick(v)}
          options={OPTIONS.map((v) => ({ value: v, label: c.options[v], sub: c.subs[v] }))}
        />
      </BottomSheet>
    ),
  };
}
