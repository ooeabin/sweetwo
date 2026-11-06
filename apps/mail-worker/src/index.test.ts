import { describe, expect, it } from 'vitest';
import { handleEmail, MAX_BYTES, type EmailMessage, type Env } from './index';

const env: Env = {
  INBOUND_URL: 'https://db.test/functions/v1/inbound-mail',
  INBOUND_MAIL_SECRET: 's3cret',
};
function msg(text: string, size?: number) {
  const bytes = new TextEncoder().encode(text);
  const m = {
    rejected: null as string | null,
    raw: new Response(bytes).body as ReadableStream<Uint8Array>,
    rawSize: size ?? bytes.byteLength,
    setReject(r: string) {
      m.rejected = r;
    },
  };
  return m satisfies EmailMessage;
}

describe('메일 Worker', () => {
  it('원본 MIME을 비밀 값과 함께 함수로 보냄', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const m = msg('From: a@b.kr\r\n\r\n본문');
    await handleEmail(m, env, (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}');
    }) as unknown as typeof fetch);
    expect(m.rejected).toBeNull();
    expect(calls[0]?.url).toBe(env.INBOUND_URL);
    expect(calls[0]?.init.headers).toEqual({
      'content-type': 'message/rfc822',
      'x-inbound-secret': 's3cret',
    });
    expect(new TextDecoder().decode(calls[0]?.init.body as ArrayBuffer)).toBe(
      'From: a@b.kr\r\n\r\n본문',
    );
  });

  it('1MB 넘으면 보내지 않고 거절', async () => {
    const m = msg('x', MAX_BYTES + 1);
    let called = false;
    await handleEmail(m, env, (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch);
    expect(called).toBe(false);
    expect(m.rejected).toBe('Message too large');
  });

  it('4xx면 거절, 5xx면 오류(throw)', async () => {
    const m = msg('x');
    await handleEmail(
      m,
      env,
      (async () => new Response('', { status: 403 })) as unknown as typeof fetch,
    );
    expect(m.rejected).toBe('Message not accepted');
    await expect(
      handleEmail(
        msg('x'),
        env,
        (async () => new Response('', { status: 502 })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow('inbound-mail 502');
  });
});
