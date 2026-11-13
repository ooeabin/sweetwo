// Amazon SES API v2 SendEmail(POST /v2/email/outbound-emails, Simple 메일). 서울 리전 ap-northeast-2.
import { signRequest } from './sigv4.ts';

export interface SesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  from: string; // 보내는 주소(SES에서 확인된 도메인), 예: 'sweeTwo <noti@sweetwo.kr>'
  configurationSet?: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** 보내는 주소를 바꿀 때(예: 문의 답장 'sweeTwo <help@sweetwo.kr>'). 없으면 cfg.from */
  from?: string | null;
  /** 덧붙일 머리글(In-Reply-To, References, X-Sweetwo-Copy). SES가 막는 이름(From, Subject 등)은 넣지 않음 */
  headers?: Record<string, string> | null;
}

// SES Simple 메일에 넣을 수 없는 머리글(공식 문서 ‘Amazon SES header fields’)
const BLOCKED = new Set([
  'bcc',
  'cc',
  'content-disposition',
  'content-type',
  'date',
  'from',
  'message-id',
  'mime-version',
  'reply-to',
  'return-path',
  'subject',
  'to',
]);
export function sesHeaders(h?: Record<string, string> | null): { Name: string; Value: string }[] {
  return Object.entries(h ?? {})
    .filter(
      ([k, v]) =>
        /^[A-Za-z0-9-]{1,60}$/.test(k) && !BLOCKED.has(k.toLowerCase()) && typeof v === 'string',
    )
    .map(([Name, v]) => ({ Name, Value: v.replace(/[\r\n]+/g, ' ').slice(0, 900) }))
    .slice(0, 15);
}

/** 보내고 MessageId를 돌려줌. 실패하면 오류(메시지에 상태 코드와 SES 오류 이름) */
export async function sendSes(
  cfg: SesConfig,
  m: Mail,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const url = `https://email.${cfg.region}.amazonaws.com/v2/email/outbound-emails`;
  const headers = sesHeaders(m.headers);
  const body = JSON.stringify({
    FromEmailAddress: m.from || cfg.from,
    Destination: { ToAddresses: [m.to] },
    Content: {
      Simple: {
        Subject: { Data: m.subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: m.text, Charset: 'UTF-8' },
          Html: { Data: m.html, Charset: 'UTF-8' },
        },
        ...(headers.length ? { Headers: headers } : {}),
      },
    },
    ...(cfg.configurationSet ? { ConfigurationSetName: cfg.configurationSet } : {}),
  });
  const signed = await signRequest({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    body,
    region: cfg.region,
    service: 'ses',
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  });
  delete signed['host'];
  const res = await fetchFn(url, { method: 'POST', headers: signed, body });
  const text = await res.text();
  if (!res.ok)
    throw new Error(
      `ses ${res.status} ${res.headers.get('x-amzn-errortype') ?? ''} ${text.slice(0, 200)}`,
    );
  const id = (JSON.parse(text) as { MessageId?: string }).MessageId;
  if (!id) throw new Error('ses no MessageId');
  return id;
}
