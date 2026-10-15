import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { saveMe, useGoals, useMe, useOnboardingLocal, useSpace } from './data';
import { nextOf, PART6_START, prevOf, progress, screens, type FlowState } from './flow';

export const onboardingPath = (id: string) => `/onboarding/${id}`;

/** 화면 하나의 흐름: 진행 막대, 뒤로, 저장 뒤 다음(또는 O-20 ‘수정’에서 왔으면 O-20으로) */
export function useStep(id: string) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const ret = params.get('return');
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const inviteNow = useOnboardingLocal((s) => s.inviteNow);
  const [saving, setSaving] = useState(false);

  const state: FlowState = { me: me.data, space: space.data, goals: goals.data, inviteNow };
  const ready = !me.isLoading && !space.isLoading && !goals.isLoading;
  const list = useMemo(() => screens(state), [state.me, state.space, state.goals, state.inviteNow]); // eslint-disable-line react-hooks/exhaustive-deps

  // 멈춘 화면 기록(이어하기). 화면마다 들어올 때 한 번만.
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !me.data || marked.current === id) return;
    marked.current = id;
    if (me.data.onboarding_step !== id.toUpperCase())
      void saveMe({ onboarding_step: id.toUpperCase() }).catch(() => undefined);
  }, [ready, id, me.data]);

  /** save를 마치고 다음 화면으로. next를 주면 그 화면으로(분기). 실패하면 토스트 + 다시 시도 */
  const done = async (
    save?: () => Promise<unknown>,
    next?: (fresh: FlowState) => string | undefined,
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      await save?.();
      const [m, s, g] = await Promise.all([me.refetch(), space.refetch(), goals.refetch()]);
      const fresh: FlowState = {
        me: m.data,
        space: s.data,
        goals: g.data,
        inviteNow: useOnboardingLocal.getState().inviteNow,
      };
      const to = ret ?? next?.(fresh) ?? nextOf(id, screens(fresh));
      setSaving(false);
      if (to === PART6_START) {
        // 파트 6(결과)은 다음 단계에서. 지금은 멈춘 화면만 남기고 이번 달로.
        await saveMe({ onboarding_step: 'O-61' }).catch(() => undefined);
        await me.refetch(); // 이어하기 판단(OnboardingGate)이 옛 값을 보지 않게
        nav('/', { replace: true });
        return;
      }
      nav(onboardingPath(to));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void done(save, next) });
    }
  };

  const back = prevOf(id, list);
  return {
    state,
    ready,
    saving,
    list,
    steps: progress(id, list),
    done,
    onBack: back ? () => nav(ret ? onboardingPath(ret) : onboardingPath(back)) : undefined,
  };
}
