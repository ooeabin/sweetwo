// 이메일 문의 받기 Worker(Cloudflare Email Routing → Email Worker). 27 AD-06, 29 고객 메일 수신, DEV_GUIDE ‘메일 4단계’.
// help@sweetwo.kr(네이버웍스) 자동 전달 → inbound@in.sweetwo.kr(Email Routing 규칙) → 이 Worker
// → 원본 MIME 그대로 Supabase Edge Function inbound-mail(INBOUND_URL)로 POST(x-inbound-secret).
// - 1MB 넘는 메일은 받지 않음(setReject = 영구 오류, 원본은 네이버웍스 받은편지함에 남음)
// - 함수가 4xx(비밀 값 틀림, 너무 큼 등 고쳐야 하는 오류)면 setReject, 5xx·네트워크 오류면 throw
//   (Cloudflare 문서에 throw 뒤 동작은 적혀 있지 않음. 실패가 Workers 로그에 남게 throw)
// - 본문과 주소는 로그에 남기지 않음

/** Email Routing이 넘기는 메일(필요한 것만, @cloudflare/workers-types의 ForwardableEmailMessage와 같은 이름) */
export interface EmailMessage {
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
}

export interface Env {
  /** Supabase 함수 주소(공개 값, wrangler.jsonc vars) */
  INBOUND_URL: string;
  /** Worker 비밀 값. Supabase 함수 비밀 값 INBOUND_MAIL_SECRET과 같은 값 */
  INBOUND_MAIL_SECRET: string;
}

export const MAX_BYTES = 1024 * 1024;

export async function handleEmail(
  message: EmailMessage,
  env: Env,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (message.rawSize > MAX_BYTES) {
    message.setReject('Message too large');
    return;
  }
  const raw = await new Response(message.raw).arrayBuffer();
  if (raw.byteLength > MAX_BYTES) {
    message.setReject('Message too large');
    return;
  }
  const res = await fetchFn(env.INBOUND_URL, {
    method: 'POST',
    headers: { 'content-type': 'message/rfc822', 'x-inbound-secret': env.INBOUND_MAIL_SECRET },
    body: raw,
  });
  if (res.ok) return;
  if (res.status >= 400 && res.status < 500 && res.status !== 429) {
    message.setReject('Message not accepted');
    return;
  }
  throw new Error(`inbound-mail ${res.status}`);
}

export default {
  email(message: EmailMessage, env: Env): Promise<void> {
    return handleEmail(message, env);
  },
};
