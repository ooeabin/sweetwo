import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { saveMe, useGoals, useMe, useOnboardingLocal, useSpace } from './data';
import { nextOf, prevOf, progress, screens, type FlowState } from './flow';

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
    // 다른 화면에서 고치러 온 길(?return=)은 기록하지 않는다(이어하기는 원래 화면부터)
    if (!ready || !me.data || marked.current === id || ret) return;
    marked.current = id;
    if (me.data.onboarding_step !== id.toUpperCase())
      void saveMe({ onboarding_step: id.toUpperCase() }).catch(() => undefined);
  }, [ready, id, me.data, ret]);

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
      nav(onboardingPath(to));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void done(save, next) });
    }
  };

  /** 온보딩을 마치고 이번 달로(O-67). 완료 시각을 남기고 이어하기가 옛 값을 보지 않게 다시 읽는다 */
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveMe({
        onboarding_step: id.toUpperCase(),
        onboarding_done_at: new Date().toISOString(),
      });
      await me.refetch();
      setSaving(false);
      nav('/', { replace: true });
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void finish() });
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
    finish,
    onBack: back ? () => nav(ret ? onboardingPath(ret) : onboardingPath(back)) : undefined,
  };
}
