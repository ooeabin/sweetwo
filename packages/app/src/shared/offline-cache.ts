import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import type { DesktopBridge } from '../platform';
import { outboxSnapshot, restoreOutbox, useOutbox, type OutboxSaved } from './outbox';

// 오프라인 조회(30 동기화 1·4장): 데스크톱·모바일 앱은 마지막으로 받은 화면 데이터를 기기에 암호화해 두고(브리지 cache),
// 켤 때 먼저 채워서 인터넷이 없어도 볼 수 있게 함. 서버가 원본이라 연결되면 늘 새로 받음.
// - 저장: 받은 데이터가 바뀌면 3초 모아서 한 번. 성공한 조회만, 서명 주소(사진)처럼 곧 만료되는 것은 뺌
// - 버전이 다르면(앱 업데이트로 모양이 바뀜) 버리고 서버에서 다시 받음
// - 로그아웃하면 기기(main·네이티브)가 지움
// - 오프라인 입력 대기열(outbox)도 같은 파일에 둠(화면 데이터 버전과 상관없이 되살림). 바뀌면 곧바로 저장
const VERSION = 1;
const SKIP = new Set(['photo_urls', 'avatars', 'sessions']);

/** 마지막으로 서버에서 받아 둔 시각(오프라인 띠 “마지막 저장 {시각}”) */
export const useCacheInfo = create<{ savedAt: string | null; set: (at: string | null) => void }>(
  (set) => ({ savedAt: null, set: (savedAt) => set({ savedAt }) }),
);

export async function restoreCache(qc: QueryClient, bridge: DesktopBridge | undefined) {
  if (!bridge?.cache) return;
  try {
    const text = await bridge.cache.load();
    if (!text) return;
    const c = JSON.parse(text) as { v: number; at: string; state: unknown; outbox?: OutboxSaved };
    restoreOutbox(c.outbox);
    if (c.v !== VERSION || !c.state) return;
    hydrate(qc, c.state as Parameters<typeof hydrate>[1]);
    useCacheInfo.getState().set(c.at);
  } catch {
    /* 못 읽으면 서버에서 받음 */
  }
}

export function startCacheSaver(qc: QueryClient, bridge: DesktopBridge | undefined) {
  const cache = bridge?.cache;
  if (!cache) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // 로그아웃 뒤에는 남은 화면 데이터를 다시 쓰지 않음(다음 로그인부터 다시)
  let paused = false;
  const offAuth = bridge.auth.onEvent((ev) => {
    paused = ev.type === 'signed_out';
    if (!paused) return;
    if (timer) clearTimeout(timer);
    timer = null;
    useCacheInfo.getState().set(null);
    useOutbox.getState().set({ ops: [], rejected: [], conflicts: [] });
  });
  const save = () => {
    timer = null;
    if (paused) return;
    const state = dehydrate(qc, {
      shouldDehydrateQuery: (q) =>
        q.state.status === 'success' &&
        !SKIP.has(String(q.queryKey[0])) &&
        q.state.data !== undefined,
    });
    const outbox = outboxSnapshot();
    const queued = outbox.ops.length + outbox.rejected.length + outbox.conflicts.length;
    if (!state.queries.length && !queued) return;
    const at = new Date().toISOString();
    void cache.save(JSON.stringify({ v: VERSION, at, state, outbox })).then((ok) => {
      if (ok) useCacheInfo.getState().set(at);
    });
  };
  const off = qc.getQueryCache().subscribe((e) => {
    if (e.type !== 'updated' || e.action.type !== 'success') return;
    timer ??= setTimeout(save, 3000);
  });
  // 대기열은 앱이 곧 꺼질 수 있어 바로(0.5초 모아서) 저장
  const offOutbox = useOutbox.subscribe((n, o) => {
    if (n.ops === o.ops && n.rejected === o.rejected && n.conflicts === o.conflicts) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 500);
  });
  return () => {
    off();
    offAuth();
    offOutbox();
    if (timer) clearTimeout(timer);
  };
}
