// AWS Signature Version 4(서명 v4). SES 등 AWS API를 SDK 없이 부를 때 씀. 비밀 값은 함수 비밀 값에서만 받음.
// 시험: sigv4.test.ts(AWS 서명 시험 모음 get-vanilla와 같은 값)

const enc = new TextEncoder();

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(data: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(data)));
}

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

const encodePath = (path: string) =>
  path
    .split('/')
    .map((s) => encodeURIComponent(decodeURIComponent(s)))
    .join('/') || '/';

const encodeQuery = (url: URL) =>
  [...url.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

/** 20150830T123600Z */
export const amzDate = (d: Date) => d.toISOString().replace(/[:-]|\.\d{3}/g, '');

export interface SignInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  now?: Date;
}

/** 서명한 헤더(host, x-amz-date, authorization …)를 돌려줌 */
export async function signRequest(i: SignInput): Promise<Record<string, string>> {
  const url = new URL(i.url);
  const date = amzDate(i.now ?? new Date());
  const day = date.slice(0, 8);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(i.headers)) headers[k.toLowerCase()] = v.trim();
  headers['host'] = url.host;
  headers['x-amz-date'] = date;
  if (i.sessionToken) headers['x-amz-security-token'] = i.sessionToken;
  const names = Object.keys(headers).sort();
  const signed = names.join(';');
  const canonical = [
    i.method.toUpperCase(),
    encodePath(url.pathname),
    encodeQuery(url),
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    signed,
    await sha256(i.body),
  ].join('\n');
  const scope = `${day}/${i.region}/${i.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', date, scope, await sha256(canonical)].join('\n');
  let key = await hmac(enc.encode(`AWS4${i.secretAccessKey}`).buffer as ArrayBuffer, day);
  key = await hmac(key, i.region);
  key = await hmac(key, i.service);
  key = await hmac(key, 'aws4_request');
  const signature = hex(await hmac(key, toSign));
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
  };
}
