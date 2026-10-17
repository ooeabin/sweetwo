import { checkSplit, uncheckSplit } from '@sweetwo/api';
import type { Side } from '@sweetwo/core';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../../shared/toast';
import { copy } from './copy';

/** 옮겼어요·취소. 먼저 체크한 사람이 있으면 알림(20 W-02 예외) */
export function useSplitActions(partnerName: string) {
  const qc = useQueryClient();
  // qk.currentPlan(today) = ['monthly_plan', today]. 앞부분으로 무효화
  const refresh = () => qc.invalidateQueries({ queryKey: ['monthly_plan'] });
  return {
    check: async (lineId: string, side: Side, amount?: number) => {
      try {
        const r = await checkSplit(lineId, side, amount);
        if (r === 'already') toast(copy.already(partnerName));
        await refresh();
        return r;
      } catch {
        toast(copy.loadFailed);
        return null;
      }
    },
    uncheck: async (lineId: string, side: Side) => {
      try {
        await uncheckSplit(lineId, side);
        await refresh();
      } catch {
        toast(copy.loadFailed);
      }
    },
  };
}
