// 이메일 문의 받기(27 AD-06 예외 ‘이메일 문의’, 29 고객 메일 수신). help@sweetwo.kr(네이버웍스) → 자동 전달 →
// Amazon SES 받기 → 수신 규칙 SNS 동작(인코딩 UTF-8, 150KB 넘는 메일은 SES가 되돌려 보냄) → SNS 주제 → 이 함수(HTTPS 구독).
// 1) 주소의 ?token=이 함수 비밀 값 INBOUND_MAIL_SECRET과 같은지 2) TopicArn이 INBOUND_MAIL_TOPIC_ARN과 같은지
// 3) 구독 확인은 SubscribeURL(sns.<지역>.amazonaws.com만)을 열어 확인 4) 바이러스·스팸 FAIL, SPF와 DKIM 둘 다 FAIL이면 버림
//    (네이버웍스가 전달하면 SPF는 실패할 수 있어 하나만 FAIL이면 받음) 5) 앱 문의 사본(X-Sweetwo-Copy), 자동 응답, 반송 알림은 버림
// 6) MIME에서 From, Subject, Message-ID, In-Reply-To, References, text/plain 본문만 꺼내 ingest_inquiry_mail로 넘김.
// 첨부 파일은 받지 않고 개수만 넘김. 본문·주소는 로그에 남기지 않음.
import { serverKey, type Env as MailEnv } from '../send-mail/handler.ts';

export interface Env extends Pick<
  MailEnv,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEYS' | 'SUPABASE_SERVICE_ROLE_KEY'
> {
  INBOUND_MAIL_SECRET?: string;
  INBOUND_MAIL_TOPIC_ARN?: string;
}

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

interface SnsMessage {
  Type?: string;
  TopicArn?: string;
  Message?: string;
  SubscribeURL?: string;
}
interface Verdict {
  status?: string;
}
interface SesReceived {
  notificationType?: string;
  receipt?: {
    spamVerdict?: Verdict;
    virusVerdict?: Verdict;
    spfVerdict?: Verdict;
    dkimVerdict?: Verdict;
    action?: { type?: string; encoding?: string };
  };
  content?: string;
}

/** ingest_inquiry_mail에 넘길 값 */
export interface Parsed {
  from: string;
  subject: string;
  messageId: string | null;
  refs: string[];
  body: string;
  attachments: number;
}

const MAX_RAW = 400_000; // 글자(바이트) 상한. SES SNS 동작은 150KB까지만 보냄
const MAX_BODY = 4000; // inquiry_message.body 상한
const MAX_REFS = 30;

// ── MIME 읽기(최소) ──────────────────────────────────────────────────────
type Headers = Map<string, string[]>;

/** 바이트 → 한 바이트 한 글자(latin1) 문자열. 구조는 이 문자열로 읽고 본문만 charset으로 풂 */
function bin(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}
function bytesOf(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}
function decodeText(bytes: Uint8Array, charset: string | undefined): string {
  const cs = (charset ?? 'utf-8').trim().toLowerCase() || 'utf-8';
  try {
    return new TextDecoder(cs).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
function b64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const pad = clean.length % 4 === 0 ? clean : clean + '='.repeat(4 - (clean.length % 4));
  try {
    return bytesOf(atob(pad));
  } catch {
    return new Uint8Array();
  }
}
function qp(s: string, header = false): Uint8Array {
  const t = (header ? s.replace(/_/g, ' ') : s).replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      out.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(t.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(out);
}

/** RFC 2047 =?charset?B|Q?…?= 풀기(머리글은 latin1 문자열) */
export function decodeWords(v: string): string {
  const joined = v.replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, '$1');
  const parts = joined.split(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)/);
  return parts
    .map((p) => {
      const m = /^=\?([^?*]+)(?:\*[^?]*)?\?([BbQq])\?([^?]*)\?=$/.exec(p);
      if (!m) return decodeText(bytesOf(p), 'utf-8');
      const bytes = m[2].toUpperCase() === 'B' ? b64(m[3]) : qp(m[3], true);
      return decodeText(bytes, m[1]);
    })
    .join('');
}

function splitHead(raw: string): { headers: Headers; body: string } {
  const m = /\r?\n\r?\n/.exec(raw);
  const head = m ? raw.slice(0, m.index) : raw;
  const body = m ? raw.slice(m.index + m[0].length) : '';
  const headers: Headers = new Map();
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const list = headers.get(k) ?? [];
    list.push(line.slice(i + 1).trim());
    headers.set(k, list);
  }
  return { headers, body };
}
const h1 = (h: Headers, k: string) => h.get(k)?.[0];

function params(v: string | undefined): { value: string; p: Record<string, string> } {
  const [value = '', ...rest] = (v ?? '').split(';');
  const p: Record<string, string> = {};
  for (const r of rest) {
    const i = r.indexOf('=');
    if (i < 0) continue;
    p[r.slice(0, i).trim().toLowerCase().replace(/\*$/, '')] = r
      .slice(i + 1)
      .trim()
      .replace(/^"|"$/g, '');
  }
  return { value: value.trim().toLowerCase(), p };
}

interface Found {
  plain: string | null;
  html: string | null;
  attachments: number;
}

function walk(raw: string, found: Found, depth = 0): void {
  const { headers, body } = splitHead(raw);
  const ct = params(h1(headers, 'content-type') ?? 'text/plain');
  const disp = params(h1(headers, 'content-disposition'));
  if (ct.value.startsWith('multipart/') && ct.p.boundary && depth < 5) {
    const sep = '--' + ct.p.boundary;
    const chunks = body.split(sep).slice(1);
    for (const c of chunks) {
      if (c.startsWith('--')) break;
      walk(c.replace(/^\r?\n/, ''), found, depth + 1);
    }
    return;
  }
  const named = disp.p.filename ?? ct.p.name;
  const isText = ct.value === 'text/plain' || ct.value === 'text/html';
  if (!isText || disp.value === 'attachment' || named) {
    found.attachments++;
    return;
  }
  const enc = (h1(headers, 'content-transfer-encoding') ?? '').toLowerCase();
  const bytes =
    enc === 'base64' ? b64(body) : enc === 'quoted-printable' ? qp(body) : bytesOf(body);
  const text = decodeText(bytes, ct.p.charset);
  if (ct.value === 'text/plain' && found.plain === null) found.plain = text;
  if (ct.value === 'text/html' && found.html === null) found.html = text;
}

function htmlToText(h: string): string {
  return h
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// 답장 아래 붙는 이전 대화(best-effort): 이 줄부터 아래는 버림
const QUOTE_START = [
  /^On .+wrote:\s*$/i,
  /^.+님이 작성:\s*$/,
  /^.+작성:\s*$/,
  /^-{2,}\s*(Original Message|원본 메일|원본 메시지|Forwarded message|전달된 메시지)\s*-{2,}\s*$/i,
  /^(From|보낸 사람|보낸사람)\s*:\s.+$/i,
  /^_{10,}\s*$/,
];

/** 이전 대화(> 인용, ‘…님이 작성:’ 아래)를 빼고 앞뒤 빈 줄 정리 */
export function stripQuoted(text: string): string {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const t = line.trim();
    if (QUOTE_START.some((r) => r.test(t)) && out.some((x) => x.trim() !== '')) break;
    if (t.startsWith('>')) continue;
    out.push(line.replace(/\s+$/, ''));
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const ids = (v: string | undefined) =>
  [...(v ?? '').matchAll(/<([^<>\s]{1,250})>/g)].map((m) => m[1]);

export function addressOf(from: string): string | null {
  const m =
    /<([^<>\s]+@[^<>\s]+)>/.exec(from) ??
    /([^\s<>"(),;:]+@[^\s<>"(),;:]+\.[^\s<>"(),;:]+)/.exec(from);
  const a = m?.[1]?.trim().toLowerCase() ?? null;
  return a && /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(a) && a.length <= 254 ? a : null;
}

/** 버릴 메일인지: 앱 문의 사본, 자동 응답, 반송 알림 */
function skipReason(h: Headers, from: string): string | null {
  if (h.has('x-sweetwo-copy')) return 'copy';
  const auto = (h1(h, 'auto-submitted') ?? '').toLowerCase();
  if (auto && auto !== 'no') return 'auto';
  if (/^(bulk|junk|list|auto_reply)$/i.test(h1(h, 'precedence') ?? '')) return 'auto';
  if (h.has('x-autoreply') || h.has('x-autorespond')) return 'auto';
  if (/^(mailer-daemon|postmaster)@/i.test(from)) return 'bounce';
  if (params(h1(h, 'content-type')).value === 'multipart/report') return 'bounce';
  return null;
}

/** 원본 MIME(latin1 문자열) → 넘길 값. 버릴 메일이면 이유 */
export function parseMail(raw: string): Parsed | { skip: string } {
  const { headers } = splitHead(raw);
  const from = addressOf(decodeWords(h1(headers, 'from') ?? ''));
  if (!from) return { skip: 'from' };
  const why = skipReason(headers, from);
  if (why) return { skip: why };
  const found: Found = { plain: null, html: null, attachments: 0 };
  walk(raw, found);
  const text = found.plain ?? (found.html !== null ? htmlToText(found.html) : '');
  const refs = ids(h1(headers, 'references'));
  for (const x of ids(h1(headers, 'in-reply-to'))) if (!refs.includes(x)) refs.push(x);
  return {
    from,
    subject: decodeWords(h1(headers, 'subject') ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200),
    messageId: ids(h1(headers, 'message-id'))[0] ?? null,
    refs: refs.slice(-MAX_REFS),
    body: stripQuoted(text).slice(0, MAX_BODY),
    attachments: found.attachments,
  };
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;
const failed = (v?: Verdict) => (v?.status ?? '').toUpperCase() === 'FAIL';

export async function handle(
  req: Request,
  env: Env,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!env.INBOUND_MAIL_SECRET || !same(token, env.INBOUND_MAIL_SECRET))
    return new Response('forbidden', { status: 403 });
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  let msg: SnsMessage;
  try {
    msg = (await req.json()) as SnsMessage;
  } catch {
    return new Response('bad', { status: 400 });
  }
  if (!env.INBOUND_MAIL_TOPIC_ARN || msg.TopicArn !== env.INBOUND_MAIL_TOPIC_ARN)
    return new Response('topic', { status: 403 });

  if (msg.Type === 'SubscriptionConfirmation') {
    let u: URL;
    try {
      u = new URL(msg.SubscribeURL ?? '');
    } catch {
      return new Response('bad', { status: 400 });
    }
    if (u.protocol !== 'https:' || !SNS_HOST.test(u.hostname))
      return new Response('bad', { status: 400 });
    const res = await fetchFn(u.toString());
    return new Response(res.ok ? 'confirmed' : 'failed', { status: res.ok ? 200 : 502 });
  }
  if (msg.Type !== 'Notification') return new Response('ignored');

  let e: SesReceived;
  try {
    e = JSON.parse(msg.Message ?? '') as SesReceived;
  } catch {
    return new Response('bad', { status: 400 });
  }
  if (e.notificationType !== 'Received' || typeof e.content !== 'string')
    return Response.json({ result: 'ignored' });
  const r = e.receipt ?? {};
  if (
    failed(r.virusVerdict) ||
    failed(r.spamVerdict) ||
    (failed(r.spfVerdict) && failed(r.dkimVerdict))
  )
    return Response.json({ result: 'dropped' });

  // 인코딩 BASE64면 바이트 그대로, UTF-8이면 UTF-8 바이트로 바꿔 같은 방식으로 읽음
  const bytes =
    (r.action?.encoding ?? '').toUpperCase() === 'BASE64'
      ? b64(e.content)
      : new TextEncoder().encode(e.content);
  const p = parseMail(bin(bytes.subarray(0, MAX_RAW)));
  if ('skip' in p) return Response.json({ result: 'skipped', reason: p.skip });

  const key = serverKey(env);
  if (!key) return new Response('no key', { status: 500 });
  const res = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/ingest_inquiry_mail`, {
    method: 'POST',
    headers: {
      apikey: key,
      ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_from: p.from,
      p_subject: p.subject,
      p_message_id: p.messageId,
      p_refs: p.refs,
      p_body: p.body,
      p_attachments: p.attachments,
    }),
  });
  // 실패하면 5xx → SNS가 다시 보냄(같은 Message-ID는 DB가 한 번만 받음)
  if (!res.ok) return new Response('db', { status: 502 });
  const out = (await res.json().catch(() => ({}))) as { result?: string };
  return Response.json({ result: out.result ?? 'ok' });
}
