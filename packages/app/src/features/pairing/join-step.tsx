import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { saveMe, useJoinData, type JoinData } from './data';
import { finishJoin } from './join-split';

export const joinPath = (id: string) => `/join/${id}`;

/**
 * 진행 막대(18): P-03, P-04, P-05, P-05b. 월급 계획(P-06)는 안 보여 줌(2026-11-03, 온보딩 ADR 0005처럼).
 * 2026-11-11 P-03a 출생연도를 뺌(시작한 사람처럼 자산 순위 F-08 ‘출생연도 알려 주기’ → S-11i에서 물음)
 */
const BAR = ['p-03', 'p-04', 'p-05', 'p-05b'];

/**
 * 합류 화면 순서(18 흐름 요약). 기본 P-03 → P-04 → P-05 → P-05b(마지막 저장 = 추천 월급 계획으로 합류 완료 → 홈).
 * 시작한 사람이 아직 온보딩 중이면 P-03 → P-05 → P-05b(저장 = 합류, 홈 대기), 대기 뒤 이어서 P-04(저장 = 월급 계획 만들기).
 * 월급이 없으면 P-05b 없이 끝. 예전에 P-06에서 멈춘 사람만 P-06.
 */
export function joinScreens(d: Pick<JoinData, 'waiting' | 'resumed' | 'me'>): string[] {
  if (d.me?.onboarding_step === 'P-06') return ['p-06'];
  if (d.resumed) return ['p-04'];
  if (d.waiting) return ['p-03', 'p-05', 'p-05b'];
  return BAR;
}
/**
 * 합류 흐름에서 뺀 화면 → 그 화면 바로 앞 화면(이어하기). P-03a 출생연도(2026-11-11 뺌, 출생연도는 자산 순위 F-08 → S-11i에서)
 */
export const JOIN_REMOVED: Readonly<Record<string, string>> = { 'p-03a': 'p-03' };

/** 뺀 화면에 멈춘 사람이 갈 곳: 지금 흐름(기본 / 시작한 사람이 온보딩 중)에서 앞 화면의 다음 화면. 뺀 화면이 아니면 null */
export function movedJoinScreen(
  id: string,
  d: Pick<JoinData, 'waiting' | 'resumed' | 'me'>,
): string | null {
  const after = JOIN_REMOVED[id];
  if (!after) return null;
  const list = joinScreens(d);
  const i = list.indexOf(after);
  return (i >= 0 ? list[i + 1] : undefined) ?? list[0] ?? 'p-03';
}
/**
 * 온보딩과 같은 얇은 주황 막대(ChapterBar, 2026-11-03). 칸 수는 지금 흐름의 화면 수(2026-11-11 S3-24:
 * 시작한 사람이 아직 온보딩 중이면 P-03, P-05, P-05b 세 칸). 예전 P-06은 끝까지(S3-23)
 */
export const joinChapter = (id: string, list: readonly string[] = BAR) => {
  const bar = list.includes(id) ? list : BAR;
  const total = Math.max(bar.length, 1);
  const done = id === 'p-06' ? total : Math.max(bar.indexOf(id), 0) + 1;
  return {
    index: 1,
    total: 1,
    name: '',
    label: '합류',
    fill: (done / total) * 100,
    steps: { total, done },
  };
};

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

  /** next: 다음 화면(기본 순서대로). null이면 여기서 합류를 마침(월급 없음 → P-05b 건너뜀) */
  const done = async (save?: () => Promise<unknown>, next?: string | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await save?.();
      const to = next === null ? undefined : (next ?? list[i + 1]);
      // 마지막 화면: 추천 월급 계획으로 합류 완료(월급 계획 화면 없이, 홈 할 일 ‘월급 계획 확인’)
      if (!to && id !== 'p-06') {
        const r = await finishJoin(d);
        if (r === 'split_changed') throw new Error('split_changed');
        // 그 사이 시작한 사람이 초대를 취소했거나 잡아 둔 24시간이 지남: 합류가 끝난 초대 안내(JoinRoute)
        if (r === 'ended') {
          setSaving(false);
          return;
        }
      }
      await d.refetch().catch(() => undefined);
      setSaving(false);
      // 합류를 마치면 짧은 축하(P-10) → 푸시 허용을 아직 안 물었으면 P-11 → 홈(2026-11-11 D7)
      // 대기 뒤 이어서(P-04)는 이미 합류를 마친 사람이라 축하 없이 홈
      if (!to) nav(d.resumed ? '/' : joinPath('p-10'), { replace: true });
      else nav(joinPath(to));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void done(save, next) });
    }
  };

  return {
    d,
    saving,
    chapter: joinChapter(id, list),
    /** 이 흐름의 마지막 화면(저장 = 합류 완료) */
    last: i === list.length - 1,
    done,
    onBack: i > 0 ? () => nav(joinPath(list[i - 1] ?? 'p-03')) : undefined,
  };
}
