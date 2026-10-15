import { addDays } from '../date';

// 이번 달 할 일(docs/spec/19-this-month.md H-04)과 첫 주 할 일(17-onboarding-2.md O-67 표).
// 순서: 지출 점검 > 배우자 초대 > 정확한 값 입력 > 첫 주 할 일(하루 하나씩 열림). 받은 제안, 만기 등은 그 기능을 만들 때 추가.

export type TodoKind =
  | 'spend_check'
  | 'invite'
  | 'exact_values'
  | 'wedding_date'
  | 'split_rule'
  | 'assets'
  | 'loans'
  | 'fixed_card'
  | 'rest'
  | 'invest';

export interface TodoDef {
  kind: TodoKind;
  /** 여는 화면 ID */
  screen: string;
  /** 열리는 날 'YYYY-MM-DD' */
  openOn: string;
  sort: number;
  /** 걸리는 시간(분). 첫 주 할 일만 */
  minutes?: number;
  /** 첫 주 n일째 */
  day?: number;
}

export interface TodoState {
  /** 온보딩을 마친 날(KST) */
  startedOn: string;
  joined: boolean;
  solo: boolean;
  /** 각자 관리 예비부부 */
  separate: boolean;
  engaged: boolean;
  weddingDateUnknown: boolean;
  /** O-39 ‘없어요’ */
  noLoan: boolean;
  /** 저축 가능 금액 0 이하 */
  noSaving: boolean;
  /** 추정값 개수 */
  estimates: number;
  splitDeferred: boolean;
}

const FIRST_WEEK: { kind: TodoKind; day: number; screen: string; minutes: number }[] = [
  { kind: 'assets', day: 2, screen: 'O-41', minutes: 3 },
  { kind: 'loans', day: 3, screen: 'O-44', minutes: 2 },
  { kind: 'fixed_card', day: 4, screen: 'O-37', minutes: 2 },
  { kind: 'rest', day: 5, screen: 'O-34', minutes: 3 },
  { kind: 'invest', day: 7, screen: 'O-53', minutes: 1 },
];

/** 지금 있어야 할 할 일(조건이 바뀌면 빠짐). 저장된 상태(미룸, 끝냄)는 화면이 합친다 */
export function todoDefs(s: TodoState): TodoDef[] {
  const out: TodoDef[] = [];
  if (s.noSaving) out.push({ kind: 'spend_check', screen: 'F-05', openOn: s.startedOn, sort: 10 });
  if (!s.joined && !s.solo)
    out.push({ kind: 'invite', screen: 'O-07', openOn: s.startedOn, sort: 20, minutes: 1, day: 1 });
  if (s.estimates >= 3)
    out.push({ kind: 'exact_values', screen: 'F-05', openOn: s.startedOn, sort: 30 });
  if (s.engaged && s.weddingDateUnknown)
    out.push({ kind: 'wedding_date', screen: 'H-P1', openOn: s.startedOn, sort: 31 });
  if (s.splitDeferred)
    out.push({ kind: 'split_rule', screen: 'O-52', openOn: s.startedOn, sort: 32 });
  for (const w of FIRST_WEEK) {
    if (w.kind === 'loans' && s.noLoan) continue;
    if (w.kind === 'fixed_card' && s.separate) continue;
    out.push({
      kind: w.kind,
      screen: w.screen,
      openOn: addDays(s.startedOn, w.day - 1),
      sort: 40 + w.day,
      minutes: w.minutes,
      day: w.day,
    });
  }
  return out;
}

export interface TodoRow {
  kind: string;
  status: 'pending' | 'snoozed' | 'done';
  snoozed_until: string | null;
}

/** 오늘 보일 할 일: 열렸고, 끝내지 않았고, 미룬 날이 지난 것. 순서대로 */
export function visibleTodos(defs: TodoDef[], rows: TodoRow[], today: string) {
  return defs
    .filter((d) => d.openOn <= today)
    .filter((d) => {
      const r = rows.find((x) => x.kind === d.kind);
      if (!r) return true;
      if (r.status === 'done') return false;
      return !(r.status === 'snoozed' && r.snoozed_until && r.snoozed_until > today);
    })
    .sort((a, b) => a.sort - b.sort);
}
