import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { saveMe, useJoinData, type JoinData } from './data';
import { shouldAskPush } from './pages/p-11-push';

export const joinPath = (id: string) => `/join/${id}`;

/** 진행 막대 5칸(18): P-03, P-03a, P-04, P-05, P-06 */
const BAR = ['p-03', 'p-03a', 'p-04', 'p-05', 'p-06'];

/**
 * 합류 화면 순서(18 흐름 요약). 기본 P-03 → P-03a → P-04 → P-05 → P-06.
 * 시작한 사람이 아직 온보딩 중이면 P-03 → P-03a → P-05(저장 = 합류, 홈 대기), 대기 뒤 이어서 P-04 → P-06.
 */
export function joinScreens(d: Pick<JoinData, 'waiting' | 'resumed'>): string[] {
  if (d.resumed) return ['p-04', 'p-06'];
  if (d.waiting) return ['p-03', 'p-03a', 'p-05'];
  return BAR;
}
export const joinProgress = (id: string) => ({
  total: BAR.length,
  now: Math.max(BAR.indexOf(id), 0),
  fill: 50,
});

/** 합류 화면 하나: 멈춘 화면 기록, 저장 뒤 다음(마지막이면 홈), 뒤로 */
export function useJoinStep(id: string) {
  const nav = useNavigate();
  const d = useJoinData();
  const [saving, setSaving] = useState(false);
  const list = joinScreens(d);
  const i = list.indexOf(id);

  const marked = useRef(false);
  useEffect(() => {
    // 합류를 마치기 전에만 멈춘 화면 기록(대기 뒤 이어서는 P-WAIT 그대로)
    if (!d.ready || !d.me || marked.current || d.me.onboarding_done_at) return;
    marked.current = true;
    if (d.me.onboarding_step !== id.toUpperCase())
      void saveMe({ onboarding_step: id.toUpperCase() }).catch(() => undefined);
  }, [d.ready, d.me, id]);

  const done = async (save?: () => Promise<unknown>, next?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await save?.();
      await d.refetch();
      setSaving(false);
      const to = next ?? list[i + 1];
      // 합류를 마치면 홈(모바일 앱이고 처음이면 푸시 허용을 한 번 묻고, P-11)
      if (!to && (await shouldAskPush())) nav(joinPath('p-11'), { replace: true });
      else nav(to ? joinPath(to) : '/', { replace: !to });
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void done(save, next) });
    }
  };

  return {
    d,
    saving,
    steps: joinProgress(id),
    /** 이 흐름의 마지막 화면(저장 = 합류 완료) */
    last: i === list.length - 1,
    done,
    onBack: i > 0 ? () => nav(joinPath(list[i - 1] ?? 'p-03')) : undefined,
  };
}
