import type { Me, Space } from './data';

// 온보딩 화면 순서(docs/spec/16-onboarding-1.md 흐름 요약 v2.2, 17 ‘온보딩 ② v2.2’, ADR 0009). 답에 따라 목록이 바뀐다.
// 화면 id는 경로에 그대로: /onboarding/o-03
// 2026-11-10 QA 2구간: O-10 첫 화면, O-12 결혼한 날·예정일, O-13 출생연도를 뺌(쓰는 자리에서 물음).
// 2026-11-13 v2.2: O-06 초대 화면을 뺌(초대는 첫 저금 직후 O-07 시트), O-30 세 질문(O-30·O-30b·O-30c), O-55 알림 허용.

export interface FlowState {
  me: Me | null | undefined;
  space: Space | null | undefined;
  /** 합류한 파트너(합류 전 null) */
  partner?: {
    id: string;
    nickname: string | null;
    monthly_income: number | null;
    allowance: number | null;
  } | null;
}

/** 모든 화면의 순서(답에 따라 빠지는 화면 포함). 이어하기의 ‘가장 멀리 간 화면’과 목록에 없는 화면의 앞뒤를 이 순서로 셈 */
export const ORDER = [
  'o-03',
  'o-11',
  'o-30',
  'o-30b',
  'o-30c',
  'o-31',
  'o-32',
  'o-55',
  'o-60',
] as const;

/** 마지막 화면(O-60 준비 끝). 여기서 온보딩을 마친다 */
export const LAST = 'o-60';

/** 처음 화면(진행 막대 첫 칸, 뒤로 없음) */
export const FIRST = 'o-03';

const rank = (id: string) => (ORDER as readonly string[]).indexOf(id);

/**
 * 온보딩에서 뺀 화면에 멈춰 있던 사람을 옮길 곳: O-10 → O-03(2026-11-10), O-06·O-07 → O-11(2026-11-13 초대 화면 없앰),
 * O-12·O-13(2026-11-10)과 O-21·O-23·O-24(ADR 0007) → O-30, O-50(ADR 0005) → O-31. 그 밖은 그대로
 */
export function current(id: string): string {
  const x = id.toLowerCase();
  if (x === 'o-10') return FIRST;
  if (x === 'o-06' || x === 'o-07') return 'o-11';
  if (x === 'o-50') return 'o-31';
  if (/^o-1[23]$|^o-21$|^o-23-\d+$|^o-24$/.test(x)) return 'o-30';
  return x;
}

/**
 * O-03 → O-11 → O-30 → O-30b → (O-30c: 생활비 ‘네’일 때만) → O-31 → (O-32: 월급이 있을 때) → O-55 → O-60.
 * 연결 해제 뒤 다시(16 흐름 요약, S-12h): O-30부터(이름·두 사람 사이는 건너뜀)
 */
export function screens(s: FlowState): string[] {
  const afterUnlink = !!s.space?.unlinked_from;
  const list: string[] = afterUnlink ? [] : ['o-03', 'o-11'];
  list.push('o-30', 'o-30b');
  if (s.space?.shared_living === true) list.push('o-30c');
  list.push('o-31');
  // ‘지금은 월급이 없어요’(0원)면 월급날을 묻지 않음
  if (s.me?.monthly_income !== 0) list.push('o-32');
  list.push('o-55', LAST);
  return list;
}

/** 목록에 지금 화면이 없으면(이어하기 등) 전체 순서대로 끼워 넣음 */
function withCurrent(list: string[], id: string) {
  if (list.includes(id) || rank(id) < 0) return list;
  const out = [...list];
  const at = out.findIndex((x) => rank(x) > rank(id));
  out.splice(at < 0 ? out.length : at, 0, id);
  return out;
}

/** 진행 막대 하나(챕터 없음): O-03~O-55 질문 중 지금까지. O-60은 없음 */
export function progressOf(id: string, list: string[]) {
  if (id === LAST) return undefined;
  const qs = withCurrent(list, id).filter((x) => x !== LAST);
  const done = Math.max(qs.indexOf(id), 0) + 1;
  return {
    index: 1,
    total: 1,
    name: '',
    fill: (done / qs.length) * 100,
    steps: { total: qs.length, done },
  };
}

export const nextOf = (id: string, list: string[]) => {
  const l = withCurrent(list, id);
  return l[l.indexOf(id) + 1] ?? LAST;
};

/** 뒤로. 목록 첫 화면(O-03, 연결 해제 뒤 O-30)과 O-60은 뒤로 없음 */
export const prevOf = (id: string, list: string[]) => {
  if (id === LAST) return undefined;
  const l = withCurrent(list, id);
  const i = l.indexOf(id);
  return i <= 0 ? undefined : l[i - 1];
};

/** a가 b보다 뒤 화면인지(가장 멀리 간 화면 기록). 모르는 화면(합류 P-, 연결 해제 S-12H 등)보다는 늘 뒤가 아님 */
export const isAhead = (a: string, b: string | null | undefined) => {
  if (!b) return true;
  const r = rank(current(b));
  return r >= 0 && rank(a) > r;
};

/** 파트너가 합류했는지 */
export const partnerJoined = (s: FlowState) => s.space?.couple_state === 'connected';

/**
 * 이 화면을 이미 지나갔는지(가장 멀리 간 화면이 더 뒤). 질문은 처음에는 미리 고른 값 없이 열고(17 v2.2 ‘미리 고른 값 없음’),
 * 지나간 뒤 돌아오면 고른 값을 보여 준다
 */
export const passed = (id: string, step: string | null | undefined) => {
  if (!step) return false;
  const r = rank(current(step));
  return r >= 0 && r > rank(id);
};
