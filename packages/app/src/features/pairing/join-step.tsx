import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { saveMe, useJoinData, type JoinData } from './data';

export const joinPath = (id: string) => `/join/${id}`;

/** 합류 화면 순서(18 흐름 요약). P-06 추가 질문 뒤 쿼리 ?more=1. 각자 관리 예비부부는 용돈(P-07), 분담(P-08) 없음.
 * 시작한 사람이 첫 플랜 전(waiting)이면 내 정보(P-03~07)와 투자 성향(P-09)까지만 답하고 P-11 대기로. 분담, 바뀐 것, 다시 보기 없음 */
export function joinScreens(d: Pick<JoinData, 'space' | 'waiting'>): string[] {
  const separate =
    d.space?.marriage_status === 'engaged' && d.space?.prep_money_mode === 'separate';
  if (d.waiting)
    return ['p-03', 'p-04', 'p-05', 'p-05d', 'p-06', ...(separate ? [] : ['p-07']), 'p-09', 'p-11'];
  return [
    'p-03',
    'p-04',
    'p-05',
    'p-05d',
    'p-06',
    ...(separate ? [] : ['p-07', 'p-08']),
    'p-09',
    'p-10',
    'p-11',
    ...REVISIT,
  ];
}

/** 합류 완료 뒤 다시 보는 온보딩 ② 결과(바뀐 값 강조) */
export const REVISIT = ['o-63', 'o-64', 'o-65'];

/** 4칸 진행 막대: P-03·04 / P-05 / P-06·07 / P-08~10. P-11과 다시 보기는 모두 채움 */
const PART: Record<string, number> = {
  'p-03': 0,
  'p-04': 0,
  'p-05': 1,
  'p-05d': 1,
  'p-06': 2,
  'p-07': 2,
  'p-08': 3,
  'p-09': 3,
  'p-10': 3,
};
export const joinProgress = (id: string) =>
  id === 'p-11' || REVISIT.includes(id)
    ? { total: 4, now: 4 }
    : { total: 4, now: PART[id] ?? 0, fill: 50 };

/** 합류 화면 하나: 멈춘 화면 기록, 저장 뒤 다음, 뒤로 */
export function useJoinStep(id: string) {
  const nav = useNavigate();
  const d = useJoinData();
  const [saving, setSaving] = useState(false);
  const list = joinScreens(d);
  const i = list.indexOf(id);

  const marked = useRef(false);
  useEffect(() => {
    // 합류 완료 뒤(P-11, 다시 보기)는 기록하지 않음
    if (!d.ready || !d.me || marked.current || id === 'p-11' || REVISIT.includes(id)) return;
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
      nav(joinPath(next ?? list[i + 1] ?? 'p-11'));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void done(save, next) });
    }
  };

  return {
    d,
    saving,
    steps: joinProgress(id),
    done,
    onBack: i > 0 && id !== 'p-11' ? () => nav(joinPath(list[i - 1] ?? 'p-03')) : undefined,
  };
}
