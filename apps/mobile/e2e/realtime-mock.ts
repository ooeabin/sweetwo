import type { Page, WebSocketRoute } from '@playwright/test';

// 가짜 Supabase Realtime(웹소켓, Phoenix vsn 2.0.0 배열 메시지). 앱이 구독한 postgres_changes 채널에
// 테스트가 바뀐 행 신호를 보냄(2026-11-11 QA 4구간 S4-02: 합류, P-WAIT, 합쳐서 상대 체크).
// 메시지 꼴: [join_ref, ref, topic, event, payload]

type Binding = { id: number; event: string; schema: string; table?: string; filter?: string };
type Channel = { ws: WebSocketRoute; joinRef: string; topic: string; bindings: Binding[] };

export async function mockRealtime(page: Page) {
  const channels = new Map<string, Channel>();
  let nextId = 1;
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage((raw) => {
      if (typeof raw !== 'string') return;
      const [joinRef, ref, topic, event, payload] = JSON.parse(raw) as [
        string,
        string,
        string,
        string,
        { config?: { postgres_changes?: Omit<Binding, 'id'>[] } },
      ];
      const reply = (response: unknown) =>
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]));
      if (event === 'phx_join') {
        const bindings = (payload.config?.postgres_changes ?? []).map((b) => ({
          ...b,
          id: nextId++,
        }));
        channels.set(topic, { ws, joinRef, topic, bindings });
        reply({ postgres_changes: bindings });
      } else if (event === 'phx_leave') {
        channels.delete(topic);
        reply({});
      } else {
        // heartbeat, access_token 등은 그냥 ok
        reply({});
      }
    });
  });
  return {
    /** 이 표에 구독한 채널 수(구독이 붙을 때까지 기다리기용) */
    subscribed: (table: string) =>
      [...channels.values()].filter((c) => c.bindings.some((b) => b.table === table)).length,
    /** 표 하나의 바뀐 행 신호를 그 표를 구독한 모든 채널에 보냄 */
    emit(table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', record: Record<string, unknown>) {
      for (const c of channels.values()) {
        const ids = c.bindings.filter((b) => b.table === table).map((b) => b.id);
        if (!ids.length) continue;
        c.ws.send(
          JSON.stringify([
            c.joinRef,
            null,
            c.topic,
            'postgres_changes',
            {
              ids,
              data: {
                schema: 'public',
                table,
                commit_timestamp: new Date().toISOString(),
                type,
                record,
                old_record: type === 'INSERT' ? undefined : { id: record.id },
                columns: [],
                errors: null,
              },
            },
          ]),
        );
      }
    },
  };
}
