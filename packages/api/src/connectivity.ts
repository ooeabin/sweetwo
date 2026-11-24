// 인터넷 연결 판정(13 공통 상태 9번, 30 동기화 4장): navigator.onLine 하나만 믿지 않는다.
// 브라우저가 거짓 ‘오프라인’을 알리는 일이 있어서(macOS Chrome 등), onLine이 거짓이거나 offline 이벤트가 오면
// 설정된 Supabase 주소의 공개 확인(auth/v1/health, no-store, 짧은 타임아웃)을 해서 닿으면 온라인으로 본다.
// 오프라인이면 10초마다(화면이 보일 때만)·online 이벤트·화면 복귀 때 다시 확인. 실제 요청이 성공하면 바로 온라인.
const PROBE_TIMEOUT_MS = 4000;
const RETRY_MS = 10_000;

const hasNav = () => typeof navigator !== 'undefined';
let online = !hasNav() || navigator.onLine !== false;
const listeners = new Set<() => void>();
let started = false;
let inflight: Promise<boolean> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const emit = () => listeners.forEach((f) => f());
function set(next: boolean) {
  if (next === online) return;
  online = next;
  syncTimer();
  emit();
}

/** 지금 온라인으로 보는지(판정 한 곳) */
export const isOnline = () => online;
export function subscribeOnline(f: () => void) {
  start();
  listeners.add(f);
  return () => void listeners.delete(f);
}
/** 실제 요청이 성공했으면 바로 온라인으로 */
export const reportReachable = () => set(true);

type Probe = () => Promise<boolean>;
function defaultProbe(): Promise<boolean> {
  const base = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
  if (!base) return Promise.resolve(hasNav() ? navigator.onLine !== false : true);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
  // 응답 코드는 보지 않음(401이어도 서버에 닿은 것). 네트워크 오류·시간 초과만 실패
  return fetch(`${base}/auth/v1/health`, { cache: 'no-store', signal: ctl.signal })
    .then(() => true)
    .catch(() => false)
    .finally(() => clearTimeout(t));
}
let probeImpl: Probe = defaultProbe;
/** 테스트용: 확인 함수 바꾸기 */
export function __setProbe(p: Probe | null) {
  probeImpl = p ?? defaultProbe;
}
/** 테스트용: 상태 되돌리기 */
export function __resetOnline(initial: boolean) {
  online = initial;
  inflight = null;
}

/** 실제 확인을 한 번 하고 결과를 상태에 반영. 동시에 여러 번 불러도 요청은 하나 */
export function probeOnline(): Promise<boolean> {
  inflight ??= probeImpl()
    .catch(() => false)
    .then((ok) => {
      set(ok);
      return ok;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** 시작할 때처럼 바로 답이 필요할 때: onLine이 참이면 그대로, 거짓이면 실제 확인 */
export async function checkOnline(): Promise<boolean> {
  if (!hasNav() || navigator.onLine !== false) return true;
  return probeOnline();
}

const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
function syncTimer() {
  if (!online && !timer) {
    timer = setInterval(() => {
      if (visible()) void probeOnline();
    }, RETRY_MS);
  } else if (online && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void probeOnline());
  window.addEventListener('offline', () => void probeOnline());
  document.addEventListener('visibilitychange', () => {
    if (visible() && !online) void probeOnline();
  });
  if (navigator.onLine === false) void probeOnline();
  syncTimer();
}
start();
