import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../shared/analytics';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { saveMe, useMe, useOnboardingLocal, usePartner, useSpace } from './data';
import { FIRST, isAhead, nextOf, prevOf, progressOf, screens, type FlowState } from './flow';

export const onboardingPath = (id: string) => `/onboarding/${id}`;

// 온보딩 시작 시각(분석 onboarding_completed duration_sec). 이 기기에만
const STARTED_KEY = 'sweetwo.onboardingStartedAt';
const startedAt = () => {
  try {
    return Number(localStorage.getItem(STARTED_KEY)) || 0;
  } catch {
    return 0;
  }
};
const markStarted = () => {
  try {
    localStorage.setItem(STARTED_KEY, String(Date.now()));
  } catch {
    /* 기억 못 해도 됨 */
  }
};
/** 온보딩을 시작한 뒤 지난 초(모르면 0) */
export const secondsSinceStart = () => {
  const t = startedAt();
  return t ? Math.max(0, Math.round((Date.now() - t) / 1000)) : 0;
};

// 이번 실행에서 ‘다음’을 누른 화면(changed_after_back: 뒤로 와서 다시 답함)
const completedThisRun = new Set<string>();

/** O-07 시트만 선택 화면(32 required) */
const REQUIRED = (id: string) => id !== 'o-07';

/** 화면 하나의 흐름: 진행 막대, 뒤로, 저장 뒤 다음, 분석 이벤트(32 4-3) */
export function useStep(id: string) {
  const nav = useNavigate();
  const me = useMe();
  const space = useSpace();
  const inviteNow = useOnboardingLocal((s) => s.inviteNow);
  const [saving, setSaving] = useState(false);
  const shownAt = useRef(Date.now());

  const partner = usePartner(space.data?.couple_state === 'connected');
  const state: FlowState = {
    me: me.data,
    space: space.data,
    partner: partner.data,
    inviteNow,
  };
  const ready = !me.isLoading && !space.isLoading && !partner.isLoading;
  const list = screens(state);

  // 화면마다 들어올 때 한 번: 본 화면 이벤트, 가장 멀리 간 화면 기록(이어하기, 2026-11-10 S2-23 뒤로 가도 앞 화면으로 되돌리지 않음)
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !me.data || marked.current === id) return;
    marked.current = id;
    shownAt.current = Date.now();
    const step = me.data.onboarding_step;
    if (id === FIRST && !step) {
      markStarted();
      track('onboarding_started', { entry: 'direct' });
    }
    track('onboarding_step_viewed', {
      screen_id: id.toUpperCase(),
      flow: 'starter',
      required: REQUIRED(id),
      marriage_state: space.data?.marriage_status ?? null,
    });
    if (isAhead(id, step))
      void saveMe({ onboarding_step: id.toUpperCase() }).catch(() => undefined);
  }, [ready, id, me.data, space.data]);

  const completed = (answer: 'input' | 'none') => {
    track('onboarding_step_completed', {
      screen_id: id.toUpperCase(),
      answer,
      duration_sec: Math.round((Date.now() - shownAt.current) / 1000),
      changed_after_back: completedThisRun.has(id),
    });
    completedThisRun.add(id);
  };

  /**
   * save를 마치고 다음 화면으로. next를 주면 그 화면으로(분기). 실패하면 토스트 + 다시 시도.
   * o.replan: 월급 계획에 쓰는 답(관리 방식, 월급)을 바꿈 → 이어하기 기록을 다음 화면으로 되돌려 O-32에서 다시 만들게 함(S2-01)
   */
  const done = async (
    save?: () => Promise<unknown>,
    next?: (fresh: FlowState) => string | undefined,
    o: { answer?: 'input' | 'none'; replan?: boolean } = {},
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      await save?.();
      const [m, s] = await Promise.all([me.refetch(), space.refetch()]);
      const fresh: FlowState = {
        me: m.data,
        space: s.data,
        partner: partner.data,
        inviteNow: useOnboardingLocal.getState().inviteNow,
      };
      const to = next?.(fresh) ?? nextOf(id, screens(fresh));
      if (o.replan && m.data && !isAhead(to, m.data.onboarding_step))
        await saveMe({ onboarding_step: to.toUpperCase() });
      completed(o.answer ?? 'input');
      setSaving(false);
      nav(onboardingPath(to));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void done(save, next, o) });
    }
  };

  /** 온보딩을 마치고 홈으로(O-60). before를 먼저. 완료 시각을 남기고 다시 읽는다 */
  const finish = async (before?: () => Promise<unknown>, after?: () => void) => {
    if (saving) return;
    setSaving(true);
    try {
      await before?.();
      await saveMe({
        onboarding_step: id.toUpperCase(),
        onboarding_done_at: new Date().toISOString(),
      });
      await me.refetch();
      after?.();
      setSaving(false);
      nav('/', { replace: true });
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void finish(before, after) });
    }
  };

  const back = prevOf(id, list);
  return {
    state,
    ready,
    saving,
    list,
    chapter: progressOf(id, list),
    done,
    finish,
    onBack: back ? () => nav(onboardingPath(back)) : undefined,
  };
}
