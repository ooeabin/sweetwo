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
}

/** 보내고 MessageId를 돌려줌. 실패하면 오류(메시지에 상태 코드와 SES 오류 이름) */
export async function sendSes(
  cfg: SesConfig,
  m: Mail,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const url = `https://email.${cfg.region}.amazonaws.com/v2/email/outbound-emails`;
  const body = JSON.stringify({
    FromEmailAddress: cfg.from,
    Destination: { ToAddresses: [m.to] },
    Content: {
      Simple: {
        Subject: { Data: m.subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: m.text, Charset: 'UTF-8' },
          Html: { Data: m.html, Charset: 'UTF-8' },
        },
      },
    },
    ...(cfg.configurationSet ? { ConfigurationSetName: cfg.configurationSet } : {}),
  });
  const headers = await signRequest({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    body,
    region: cfg.region,
    service: 'ses',
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  });
  delete headers['host'];
  const res = await fetchFn(url, { method: 'POST', headers, body });
  const text = await res.text();
  if (!res.ok)
    throw new Error(
      `ses ${res.status} ${res.headers.get('x-amzn-errortype') ?? ''} ${text.slice(0, 200)}`,
    );
  const id = (JSON.parse(text) as { MessageId?: string }).MessageId;
  if (!id) throw new Error('ses no MessageId');
  return id;
}
