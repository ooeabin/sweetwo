// W-01 공유 이미지(‘공유하기’, docs/spec/20-salary-plan.md W-01 ‘공유 이미지’, 2026-11-19 요약 카드 모양으로 다시 그림)와
// W-02 달 결과 이미지(예전 영수증 모양, `ReceiptImageModel`).
// 화면과 같은 숫자·문구(금액 가리기, 공개 범위는 부르는 쪽에서 이미 적용)를 같은 디자인 토큰 색으로 canvas에 그림.
// 라이트 고정(2026-11-19): 앱이 다크여도 이미지는 라이트 토큰(`data-theme="light"` 자리에서 읽음)으로 그림. 보내는 그림이라 받는 사람 화면 테마와 무관해야 함.
// 사진 Avatar는 다른 출처라 canvas가 막히므로(tainted) 사람 색 원 + 닉네임 앞 최대 3자(화면 Avatar와 같은 글자·크기 단계, 2026-11-18)로 그림.

import { avatarInitialCount, avatarInitials } from '@sweetwo/core';
import { wordmarkUrl } from '@sweetwo/ui';

export interface ReceiptImageModel {
  /** 사람 색 번호(시작한 사람 1, 합류한 사람 2)와 닉네임. 합쳐서면 둘 */
  people: { no: 1 | 2; name: string }[];
  /** 금액 위 제목(달 결과 카드 “11월 월급”, 2026-11-09) */
  title?: string;
  amount: string;
  sub?: string;
  /** 비율 막대 칸(0%는 그리지 않음). progress면 저금·지출 칸 안을 fill(0~100)만큼 채움(PlanBar 진행 모드) */
  bar: { kind: 'saving' | 'spend' | 'free'; percent: number; fill?: number }[];
  progress?: boolean;
  /** 비면 범례 없음 */
  legend: { kind: 'saving' | 'spend' | 'free'; text: string; short?: boolean }[];
  /** 줄 sub = 금액 아래 조용한 줄(“계획 80만 원”), muted = 금액 stone(‘못 함’) */
  sections: {
    title: string;
    subtotal: string;
    rows: { name: string; amount: string; sub?: string; muted?: boolean }[];
  }[];
  totals: { label: string; amount: string; strong?: boolean; short?: boolean }[];
}

const W = 420; // 이미지 너비(CSS px), 3배로 그림
const SCALE = 3;
const PAD = 20; // 바탕 안쪽(카드 밖)
const CARD_PAD = 24;
const TOOTH = 14;

type Tokens = Record<
  | 'surface'
  | 'surfaceAlt'
  | 'ink'
  | 'slate'
  | 'stone'
  | 'hairline'
  | 'hairlineSoft'
  | 'spend'
  | 'accent'
  | 'accentSoft'
  | 'brandInk'
  | 'ink2'
  | 'barTrack'
  | 'danger'
  | 'person1'
  | 'person1Ink'
  | 'person2'
  | 'person2Ink',
  string
> & { font: string };

/** 라이트 토큰(앱 테마와 상관없이. 보이지 않는 `data-theme="light"` 요소에서 읽음) */
function readTokens(): Tokens {
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', 'light');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const t = {
    surface: v('--surface'),
    surfaceAlt: v('--surface-alt'),
    ink: v('--ink'),
    slate: v('--slate'),
    stone: v('--stone'),
    hairline: v('--hairline'),
    hairlineSoft: v('--hairline-soft'),
    // 지출 칸(2026-11-12 S5-15, 다크는 hairline보다 한 단계 밝게)
    spend: v('--spend'),
    accent: v('--accent-app'),
    accentSoft: v('--accent-app-soft'),
    brandInk: v('--brand-ink'),
    ink2: v('--ink-2'),
    barTrack: v('--bar-track'),
    danger: v('--danger'),
    person1: v('--person-1'),
    person1Ink: v('--person-1-ink'),
    person2: v('--person-2'),
    person2Ink: v('--person-2-ink'),
    font: v('--font-sans') || 'sans-serif',
  };
  probe.remove();
  return t;
}

/** 그리기(draw = false면 높이만 잼). 끝난 y(카드 아래 톱니 포함)를 돌려줌 */
function layout(ctx: CanvasRenderingContext2D, m: ReceiptImageModel, t: Tokens, draw: boolean) {
  const left = PAD + CARD_PAD;
  const right = W - PAD - CARD_PAD;
  const mid = W / 2;
  const font = (weight: number, size: number) => `${weight} ${size}px ${t.font}`;
  const text = (
    s: string,
    x: number,
    y: number,
    o: { weight: number; size: number; color: string; align?: CanvasTextAlign; max?: number },
  ) => {
    if (!draw) return;
    ctx.font = font(o.weight, o.size);
    ctx.fillStyle = o.color;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = 'middle';
    let out = s;
    if (o.max && ctx.measureText(out).width > o.max) {
      while (out.length > 1 && ctx.measureText(`${out}…`).width > o.max) out = out.slice(0, -1);
      out = `${out}…`;
    }
    ctx.fillText(out, x, y);
  };
  let y = PAD + CARD_PAD;

  // 머리: Avatar 40px(둘이면 겹쳐서)
  const r = 20;
  const n = m.people.length;
  m.people.forEach((p, i) => {
    const cx = mid + (i - (n - 1) / 2) * 32;
    if (!draw) return;
    ctx.fillStyle = t.surface;
    ctx.beginPath();
    ctx.arc(cx, y + r, r + (i > 0 ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.no === 1 ? t.person1 : t.person2;
    ctx.beginPath();
    ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.fill();
    // 닉네임 앞 최대 3자(화면 Avatar와 같은 크기 단계: 1자 40%, 2자 38%, 3자 28%). 글자가 없으면 그리지 않음
    const initials = avatarInitials(p.name);
    if (initials) {
      const k = [0, 0.4, 0.38, 0.28][avatarInitialCount(p.name)] ?? 0.28;
      ctx.font = font(600, Math.round(r * 2 * k));
      ctx.fillStyle = p.no === 1 ? t.person1Ink : t.person2Ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, cx, y + r + 1);
    }
  });
  y += 40 + 12;
  if (m.title) {
    text(m.title, mid, y + 11, { weight: 600, size: 15, color: t.ink, align: 'center' });
    y += 22 + 4;
  }
  text(m.amount, mid, y + 18, { weight: 700, size: 28, color: t.ink, align: 'center' });
  y += 36;
  if (m.sub) {
    text(m.sub, mid, y + 11, { weight: 400, size: 13, color: t.stone, align: 'center' });
    y += 22;
  }

  // 비율 막대 12px, 칸 사이 3px
  y += 20;
  const shown = m.bar.filter((b) => b.percent > 0);
  const color = (k: 'saving' | 'spend' | 'free') =>
    k === 'saving' ? t.accent : k === 'spend' ? t.spend : t.stone;
  if (draw) {
    const width = right - left - 3 * Math.max(shown.length - 1, 0);
    let x = left;
    if (!shown.length) {
      ctx.fillStyle = t.hairlineSoft;
      ctx.beginPath();
      ctx.roundRect(left, y, right - left, 12, 6);
      ctx.fill();
    }
    for (const b of shown) {
      const w = Math.max((width * b.percent) / 100, 12);
      if (m.progress && b.kind !== 'free') {
        // 진행 모드: 조용한 칸(저금 옅은 판, 지출 테두리) 위에 보낸 만큼 채움
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, 12, 6);
        ctx.clip();
        if (b.kind === 'saving') {
          ctx.fillStyle = t.accentSoft;
          ctx.fillRect(x, y, w, 12);
        } else {
          ctx.strokeStyle = t.spend;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x, y, w, 12, 6);
          ctx.stroke();
        }
        const f = Math.max(0, Math.min(100, b.fill ?? 0));
        if (f > 0) {
          ctx.fillStyle = color(b.kind);
          ctx.beginPath();
          ctx.roundRect(x, y, Math.min(Math.max((w * f) / 100, 12), w), 12, 6);
          ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = color(b.kind);
        ctx.beginPath();
        ctx.roundRect(x, y, w, 12, 6);
        ctx.fill();
      }
      x += w + 3;
    }
  }
  y += 12;
  // 범례(가운데). 없으면 건너뜀
  if (m.legend.length) y += 14;
  ctx.font = font(500, 13);
  const items = m.legend.map((l) => ({ ...l, w: 10 + 8 + ctx.measureText(l.text).width }));
  const gap = 16;
  const total = items.reduce((s, l) => s + l.w, 0) + gap * Math.max(items.length - 1, 0);
  let lx = mid - total / 2;
  for (const l of items) {
    if (draw) {
      ctx.fillStyle = color(l.kind);
      ctx.beginPath();
      ctx.roundRect(lx, y + 4, 10, 10, 2);
      ctx.fill();
    }
    text(l.text, lx + 18, y + 9, { weight: 500, size: 13, color: l.short ? t.danger : t.slate });
    lx += l.w + gap;
  }
  if (m.legend.length) y += 18;

  const rule = () => {
    y += 24;
    if (draw) {
      ctx.fillStyle = t.hairlineSoft;
      ctx.fillRect(left, y, right - left, 1);
    }
    y += 1 + 20;
  };
  // 묶음
  for (const s of m.sections) {
    rule();
    text(s.title, left, y + 11, { weight: 600, size: 15, color: t.ink });
    text(s.subtotal, right, y + 11, { weight: 500, size: 13, color: t.stone, align: 'right' });
    y += 22 + 4;
    for (const row of s.rows) {
      ctx.font = font(500, 15);
      const aw = ctx.measureText(row.amount).width;
      text(row.name, left, y + 20, {
        weight: 400,
        size: 15,
        color: t.slate,
        max: right - left - aw - 12,
      });
      if (row.sub) {
        text(row.amount, right, y + 11, {
          weight: row.muted ? 400 : 500,
          size: 15,
          color: row.muted ? t.stone : t.ink,
          align: 'right',
        });
        text(row.sub, right, y + 31, { weight: 400, size: 13, color: t.stone, align: 'right' });
      } else
        text(row.amount, right, y + 20, {
          weight: row.muted ? 400 : 500,
          size: 15,
          color: row.muted ? t.stone : t.ink,
          align: 'right',
        });
      y += 40;
    }
  }
  // 합계
  rule();
  for (const row of m.totals) {
    const c = row.short ? t.danger : undefined;
    text(row.label, left, y + 20, { weight: 400, size: 15, color: c ?? t.slate });
    text(row.amount, right, y + 20, {
      weight: row.strong ? 700 : 500,
      size: row.strong ? 16 : 15,
      color: c ?? t.ink,
      align: 'right',
    });
    y += 40;
  }
  y += CARD_PAD;
  return y + TOOTH / 2;
}

/** 카드(위 모서리 20px, 아래 톱니) */
function cardPath(ctx: CanvasRenderingContext2D, bottom: number) {
  const l = PAD;
  const r = W - PAD;
  const top = PAD;
  const rad = 20;
  ctx.beginPath();
  ctx.moveTo(l, top + rad);
  ctx.arcTo(l, top, l + rad, top, rad);
  ctx.lineTo(r - rad, top);
  ctx.arcTo(r, top, r, top + rad, rad);
  ctx.lineTo(r, bottom - TOOTH / 2);
  // 오른쪽에서 왼쪽으로 톱니(가운데 맞춤)
  const width = r - l;
  const count = Math.floor(width / TOOTH);
  const start = r - (width - count * TOOTH) / 2;
  ctx.lineTo(start, bottom - TOOTH / 2);
  for (let i = 0; i < count; i += 1) {
    const x = start - i * TOOTH;
    ctx.lineTo(x - TOOTH / 2, bottom);
    ctx.lineTo(x - TOOTH, bottom - TOOTH / 2);
  }
  ctx.lineTo(l, bottom - TOOTH / 2);
  ctx.closePath();
}

/** 영수증 PNG(Blob) */
export async function renderReceiptPng(m: ReceiptImageModel): Promise<Blob> {
  await document.fonts?.ready;
  const t = readTokens();
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('canvas');
  const bottom = layout(probe, m, t, false);
  const H = Math.ceil(bottom + PAD);
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = t.surfaceAlt;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = t.surface;
  cardPath(ctx, bottom);
  ctx.fill();
  layout(ctx, m, t, true);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'),
  );
}

/** 요약 카드 모양 공유 이미지(W-01, 2026-11-19) */
export interface PlanImageModel {
  /** 카드 위 이름표 “월급” */
  label: string;
  amount: string;
  /** 굵은 한 문장. pct가 있으면 앞·뒤 글자 사이에 퍼센트를 brand-ink로 */
  sentence: { before: string; pct?: string; after: string };
  /** 막대·범례를 그림(월급 0원이면 false) */
  chart: boolean;
  bar: { kind: 'saving' | 'spend' | 'free'; percent: number }[];
  legend: { kind: 'saving' | 'spend' | 'free'; name: string; amount: string; short?: boolean }[];
  /** 저축·투자, 지출 줄 목록(줄이 없는 묶음은 부르는 쪽에서 뺌). sub = 목표 금액이 있으면 “목표 금액의 62%” */
  sections: {
    title: string;
    subtotal: string;
    rows: { name: string; amount: string; sub?: string }[];
  }[];
}

const CARD_R = 24;
const GAP = 12;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 요약 카드 모양 그리기(draw = false면 높이만 잼). 끝난 y를 돌려줌 */
function layoutPlan(
  ctx: CanvasRenderingContext2D,
  m: PlanImageModel,
  t: Tokens,
  logo: HTMLImageElement | null,
  draw: boolean,
) {
  const x0 = PAD;
  const x1 = W - PAD;
  const left = x0 + CARD_PAD;
  const right = x1 - CARD_PAD;
  const font = (weight: number, size: number) => `${weight} ${size}px ${t.font}`;
  const text = (
    s: string,
    x: number,
    y: number,
    o: { weight: number; size: number; color: string; align?: CanvasTextAlign; max?: number },
  ) => {
    if (!draw) return;
    ctx.font = font(o.weight, o.size);
    ctx.fillStyle = o.color;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = 'middle';
    let out = s;
    if (o.max && ctx.measureText(out).width > o.max) {
      while (out.length > 1 && ctx.measureText(`${out}…`).width > o.max) out = out.slice(0, -1);
      out = `${out}…`;
    }
    ctx.fillText(out, x, y);
  };
  const card = (top: number, bottom: number) => {
    if (!draw) return;
    ctx.fillStyle = t.surface;
    ctx.beginPath();
    ctx.roundRect(x0, top, x1 - x0, bottom - top, CARD_R);
    ctx.fill();
  };
  const color = (k: 'saving' | 'spend' | 'free') =>
    k === 'saving' ? t.accent : k === 'spend' ? t.ink2 : t.barTrack;

  // ── 요약 카드 ──
  let y = PAD;
  const top = y;
  // 카드 높이는 안을 다 잰 뒤에 알 수 있어 draw 때는 먼저 같은 식으로 잰 높이로 칠함
  const inner = (d: boolean) => {
    let yy = top + CARD_PAD;
    const put = (s: string, x: number, cy: number, o: Parameters<typeof text>[3]) => {
      if (d) text(s, x, cy, o);
    };
    put(m.label, left, yy + 10, { weight: 500, size: 14, color: t.slate });
    yy += 20 + 4;
    put(m.amount, left, yy + 19, { weight: 700, size: 30, color: t.ink });
    yy += 38 + 12;
    // 굵은 한 문장(숫자만 brand-ink). 너무 길면 글자 크기를 줄임
    const full = `${m.sentence.before}${m.sentence.pct ?? ''}${m.sentence.after}`;
    let size = 20;
    ctx.font = font(700, size);
    while (size > 15 && ctx.measureText(full).width > right - left) {
      size -= 1;
      ctx.font = font(700, size);
    }
    if (d) {
      let x = left;
      const parts: [string, string][] = [
        [m.sentence.before, t.ink],
        ...(m.sentence.pct ? ([[m.sentence.pct, t.brandInk]] as [string, string][]) : []),
        [m.sentence.after, t.ink],
      ];
      for (const [str, c] of parts) {
        text(str, x, yy + 15, { weight: 700, size, color: c });
        ctx.font = font(700, size);
        x += ctx.measureText(str).width;
      }
    }
    yy += 30;
    if (m.chart) {
      yy += 20;
      if (d) {
        const shown = m.bar.filter((b) => b.percent > 0);
        const width = right - left - 3 * Math.max(shown.length - 1, 0);
        let x = left;
        for (const b of shown) {
          const w = Math.max((width * b.percent) / 100, 16);
          ctx.fillStyle = color(b.kind);
          ctx.beginPath();
          ctx.roundRect(x, yy, w, 16, 8);
          ctx.fill();
          x += w + 3;
        }
      }
      yy += 16 + 16;
      for (const l of m.legend) {
        if (d) {
          ctx.fillStyle = color(l.kind);
          ctx.beginPath();
          ctx.arc(left + 4, yy + 11, 4, 0, Math.PI * 2);
          ctx.fill();
          if (l.kind === 'free') {
            // 미계획 점: 흰 카드 위에서 보이게 slate 1px 테두리(화면 hg-plansum__dot과 같음)
            ctx.strokeStyle = t.slate;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(left + 4, yy + 11, 3.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        put(l.name, left + 20, yy + 11, { weight: 500, size: 15, color: t.ink2 });
        put(l.amount, right, yy + 11, {
          weight: 600,
          size: 15,
          color: l.short ? t.danger : t.ink,
          align: 'right',
        });
        yy += 22 + 12;
      }
      yy -= 12;
    }
    return yy + CARD_PAD;
  };
  const summaryBottom = inner(false);
  card(top, summaryBottom);
  inner(draw);
  y = summaryBottom;

  // ── 저축·투자, 지출 카드 ──
  for (const s of m.sections) {
    y += GAP;
    const cardTop = y;
    const rowsH = s.rows.reduce((h, r) => h + (r.sub ? 60 : 48), 0);
    const bottom = cardTop + CARD_PAD + 28 + 4 + rowsH + CARD_PAD - 8;
    card(cardTop, bottom);
    y = cardTop + CARD_PAD;
    text(s.title, left, y + 14, { weight: 700, size: 18, color: t.ink });
    text(s.subtotal, right, y + 14, { weight: 600, size: 15, color: t.slate, align: 'right' });
    y += 28 + 4;
    for (const r of s.rows) {
      ctx.font = font(700, 16);
      const aw = ctx.measureText(r.amount).width;
      const h = r.sub ? 60 : 48;
      text(r.name, left, y + (r.sub ? 20 : 24), {
        weight: 600,
        size: 16,
        color: t.ink,
        max: right - left - aw - 12,
      });
      if (r.sub) text(r.sub, left, y + 42, { weight: 400, size: 13, color: t.slate });
      text(r.amount, right, y + (r.sub ? 20 : 24), {
        weight: 700,
        size: 16,
        color: t.ink,
        align: 'right',
      });
      y += h;
    }
    y = bottom;
  }

  // ── 맨 아래 작은 워드마크 ──
  y += 24;
  const lh = 18;
  if (logo && draw) {
    const lw = Math.round((lh * 6074) / 1633);
    ctx.drawImage(logo, W / 2 - lw / 2, y, lw, lh);
  }
  y += lh + 20;
  return y;
}

/** 요약 카드 모양 PNG(Blob). 라이트 고정 */
export async function renderPlanPng(m: PlanImageModel): Promise<Blob> {
  await document.fonts?.ready;
  const t = readTokens();
  const logo = await loadImage(wordmarkUrl);
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('canvas');
  const H = Math.ceil(layoutPlan(probe, m, t, logo, false));
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = t.surfaceAlt;
  ctx.fillRect(0, 0, W, H);
  layoutPlan(ctx, m, t, logo, true);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'),
  );
}

const toBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error ?? new Error('read'));
    r.readAsDataURL(b);
  });

/**
 * 공유: 브리지 shareImage(모바일 공유 창)가 있으면 그것, 없으면(브라우저) 내려받기.
 * 결과: shared / downloaded / cancelled
 */
export async function shareReceipt(
  m: ReceiptImageModel,
  name: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  return sharePng(await renderReceiptPng(m), name);
}

/** W-01 공유(요약 카드 모양) */
export async function sharePlan(
  m: PlanImageModel,
  name: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  return sharePng(await renderPlanPng(m), name);
}

async function sharePng(png: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const bridge = typeof window !== 'undefined' ? window.sweetwo : undefined;
  if (bridge?.shareImage) return bridge.shareImage({ name, base64: await toBase64(png) });
  const url = URL.createObjectURL(png);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
