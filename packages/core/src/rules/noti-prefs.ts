// 알림 설정(docs/spec/25-settings.md S-14, 14 알림). 센터 기록은 늘 남고, 이 설정은 OS 알림·메일을 보낼지에만 씀.

/** 묶음(25 S-14): plan = 월급 체크리스트(월급날, 월말 확인), partner_change = 배우자가 바꾼 값 … (제안은 재기획으로 없앰) */
export type NotiTopic =
  | 'plan'
  | 'partner_change'
  | 'care_30'
  | 'care_14'
  | 'care_7'
  | 'care_0'
  | 'money'
  | 'goal'
  | 'invite';
export const NOTI_TOPICS: NotiTopic[] = [
  'plan',
  'partner_change',
  'care_30',
  'care_14',
  'care_7',
  'care_0',
  'money',
  'goal',
  'invite',
];
export interface Channels {
  push: boolean;
  email: boolean;
}
export interface NotiPrefs extends Channels {
  topics: Record<NotiTopic, Channels>;
}

/** 기본: 모두 켜짐, 챙길 날 D-14·당일만 꺼짐(S-14 종류별 토글 표) */
const DEFAULT_OFF: NotiTopic[] = ['care_14', 'care_0'];

/** 저장된 값(빈 객체일 수 있음)을 기본값으로 채움 */
export function notiPrefs(raw: unknown): NotiPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const t = o.topics && typeof o.topics === 'object' ? (o.topics as Record<string, unknown>) : {};
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const topics = Object.fromEntries(
    NOTI_TOPICS.map((k) => {
      const v = (t[k] && typeof t[k] === 'object' ? t[k] : {}) as Record<string, unknown>;
      const d = !DEFAULT_OFF.includes(k);
      return [k, { push: bool(v.push, d), email: bool(v.email, d) }];
    }),
  ) as Record<NotiTopic, Channels>;
  return { push: bool(o.push, true), email: bool(o.email, true), topics };
}

/** 한국 시간 시(0~23)가 방해 금지 안인지. 시작 > 끝이면 밤을 넘김(22 ~ 8) */
export function inQuiet(hour: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** OS 알림을 띄울지: 받는 방법 OS 알림 켜짐 + 그 묶음 켜짐 + 방해 금지 밖. 설정에 없는 묶음(끌 수 없는 것)은 켜짐.
 *  silent(인앱만, 예: 배우자 체크 다 함)는 늘 띄우지 않음 */
export function pushAllowed(
  prefs: NotiPrefs,
  topic: string | null,
  quiet: { hour: number; start: number; end: number },
) {
  if (topic === 'silent' || !prefs.push || inQuiet(quiet.hour, quiet.start, quiet.end)) return false;
  const t = prefs.topics[topic as NotiTopic];
  return t ? t.push : true;
}
