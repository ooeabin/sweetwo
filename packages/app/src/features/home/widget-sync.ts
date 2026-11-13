import {
  addDays,
  savingPct,
  type BundleViewResponse,
  type HeroItem,
  type HomeUpcoming,
  type SavingNoteRow,
} from '@sweetwo/core';
import { useEffect } from 'react';
import type { WidgetData } from '../../platform';
import { onSessionReset } from '../../shared/session-reset';
import { savingPaths, togetherPaths } from '../salary';
import { copy } from './copy';

// 홈 화면 위젯(26 ‘위젯 v2.2’ WG-01 같이 모으기, WG-04 다가오는 날). 홈이 받은 값으로 위젯 글을 만들어 브리지에 넘김.
// 금액은 넣지 않음(26 ‘금액 표시’ 기본 가림, S-22 ‘위젯에 금액 보이기’는 아직 없음). 묶음 ‘퍼센트만’도 같은 %.
// 이름은 H-10·H-08과 같은 것(보는 사람이 앱에서 볼 수 있는 값만, 공개 필터는 서버가 이미 적용).

type SaveIn = { hero: HeroItem | undefined; savedOf: (id: string) => number };
type NextIn = { today: string; care: HomeUpcoming | undefined; note: SavingNoteRow | undefined };

const bundleDone = (b: BundleViewResponse) =>
  b.status === 'achieved' || (b.pct !== null && b.pct >= 100);

/** WG-01: 대표 저금(H-10 첫 칸) → 이름 + 큰 % (목표 금액이 없으면 “모으는 중”) + 기한 달 */
export function widgetSave({ hero, savedOf }: SaveIn): WidgetData['save'] {
  if (!hero) return null;
  if (hero.kind === 'bundle') {
    const b = hero.bundle as BundleViewResponse;
    const pct = b.target !== null || b.percent_only ? (b.pct ?? 0) : null;
    const done = bundleDone(b);
    const goal = b.goals.find((x) => x.mine) ?? b.goals[0];
    return {
      name: b.name,
      big: pct === null ? copy.widgetSaving : `${pct}%`,
      pct: pct === null ? null : Math.min(pct, 100),
      line: b.deadline && !done ? copy.remainPercent(b.deadline) : null,
      done: done ? copy.doneBadge : null,
      to: goal ? savingPaths.item(goal.id) : '/',
    };
  }
  const g = hero.goal;
  const pct = savingPct(savedOf(g.id), g.target_amount);
  const done = pct !== null && pct >= 100;
  return {
    name: g.name,
    big: pct === null ? copy.widgetSaving : `${pct}%`,
    pct: pct === null ? null : Math.min(pct, 100),
    line: g.deadline && !done ? copy.remainPercent(g.deadline) : null,
    done: done ? copy.doneBadge : null,
    to: savingPaths.item(g.id),
  };
}

/** WG-04: 가장 가까운 경조사 또는 쓸 곳 메모(H-08과 같은 고르기). 금액 없음. 경조사 → Y-05, 메모 → W-14 */
export function widgetNext({ today, care, note }: NextIn): WidgetData['next'] {
  const careDate = care ? addDays(today, care.dday) : null;
  if (note?.due_on && (!careDate || note.due_on < careDate)) {
    const to = note.bundle_id
      ? togetherPaths.bundleNotes(note.bundle_id)
      : note.goal_id
        ? togetherPaths.notes(note.goal_id)
        : '/calendar';
    return { name: note.name, date: note.due_on, to };
  }
  return care && careDate ? { name: care.name, date: careDate, to: care.to } : null;
}

/** 값이 바뀔 때만 브리지로(같은 글이면 넘기지 않음). 준비가 안 됐으면(ready false) 넘기지 않음 */
let last = '';
// 로그아웃하면 네이티브가 위젯 값을 지우므로, 다음 계정은 같은 글이어도 다시 넘김
onSessionReset(() => {
  last = '';
});
export function useWidgetSync(ready: boolean, data: WidgetData) {
  const text = JSON.stringify(data);
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.sweetwo?.widget : undefined;
    if (!ready || !w || text === last) return;
    last = text;
    void w.update(JSON.parse(text) as WidgetData).catch(() => {
      last = '';
    });
  }, [ready, text]);
}
