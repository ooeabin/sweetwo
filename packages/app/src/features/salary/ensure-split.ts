import { qk, saveSplit, type Goal, type Me } from '@sweetwo/api';
import { sharedAccountSeed } from '@sweetwo/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { recommendedDraft } from './split-draft';

/**
 * 월급 계획 템플릿이 아직 없는 사람이 W-01·W-11을 열면 그 자리에서 하나 만듦(2026-11-19 사용자 결정:
 * 월급이 0원이어도 막는 카드 없이 템플릿을 그대로 씀). 월급 0원이면 추천값은 용돈 0원 같은 빈 줄뿐.
 * 온보딩이 끝에 만드는 것과 같은 추천값(온보딩 auto-split), 다만 지우고 다시 만들지 않고 없을 때만 한 번.
 * 파트너 탭(각자, 보기만)과 연결 해제 대기에서는 만들지 않음(서버도 막음)
 */
export function useEnsureSplit(o: {
  enabled: boolean;
  me: Me | null | undefined;
  partner: Pick<Me, 'id' | 'monthly_income'> | null | undefined;
  goals: Goal[] | undefined;
  salaryMode: 'separate' | 'joint' | undefined;
  sharedLiving: boolean | null | undefined;
}) {
  const qc = useQueryClient();
  const tried = useRef(false);
  const { enabled, me, partner, goals, salaryMode, sharedLiving } = o;
  useEffect(() => {
    if (!enabled || tried.current || !me || !goals || !salaryMode) return;
    tried.current = true;
    const joint = salaryMode === 'joint';
    void (async () => {
      try {
        await saveSplit(
          [
            ...recommendedDraft(me, goals, {
              partner: joint ? (partner ?? null) : null,
              joint,
              equalAllowance: joint,
            }),
            ...sharedAccountSeed(salaryMode, sharedLiving),
          ],
          joint ? undefined : me.id,
        );
        await qc.invalidateQueries({ queryKey: qk.splits });
      } catch {
        /* 못 만들면 읽기 전용 템플릿으로 보임(다시 열면 한 번 더) */
      }
    })();
  }, [enabled, me, partner, goals, salaryMode, sharedLiving, qc]);
}
