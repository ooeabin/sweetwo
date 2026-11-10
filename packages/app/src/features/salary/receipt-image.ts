// W-01 영수증 이미지(‘공유하기’, docs/spec/20-salary-plan.md W-01 ‘영수증 이미지 공유’, 2026-11-09).
// 화면과 같은 숫자·문구(금액 가리기, 공개 범위는 부르는 쪽에서 이미 적용)를 같은 디자인 토큰 색으로 canvas에 그림.
// 사진 Avatar는 다른 출처라 canvas가 막히므로(tainted) 사람 색 원 + 빵모자 실루엣(화면 Avatar와 같은 path, 2026-11-09)으로 그림.

import { AVATAR_FIGURE_PATH, AVATAR_FIGURE_VIEWBOX } from '@sweetwo/ui';

export interface ReceiptImageModel {
  /** 사람 색 번호(시작한 사람 1, 합류한 사람 2). 합쳐서면 둘 */
  people: (1 | 2)[];
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
  | 'accent'
  | 'accentSoft'
  | 'danger'
  | 'person1'
  | 'person1Figure'
  | 'person2'
  | 'person2Figure',
  string
> & { font: string };

/** 지금 테마 토큰(라이트·다크 그대로) */
function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    surface: v('--surface'),
    surfaceAlt: v('--surface-alt'),
    ink: v('--ink'),
    slate: v('--slate'),
    stone: v('--stone'),
    hairline: v('--hairline'),
    hairlineSoft: v('--hairline-soft'),
    accent: v('--accent-app'),
    accentSoft: v('--accent-app-soft'),
    danger: v('--danger'),
    person1: v('--person-1'),
    person1Figure: v('--person-1-figure'),
    person2: v('--person-2'),
    person2Figure: v('--person-2-figure'),
    font: v('--font-sans') || 'sans-serif',
  };
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
    ctx.fillStyle = p === 1 ? t.person1 : t.person2;
    ctx.beginPath();
    ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.fill();
    // 빵모자 실루엣(라이트 흰색, 다크 person-*-ink), 원 밖은 잘라 냄
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx - r, y);
    ctx.scale((r * 2) / AVATAR_FIGURE_VIEWBOX, (r * 2) / AVATAR_FIGURE_VIEWBOX);
    ctx.fillStyle = p === 1 ? t.person1Figure : t.person2Figure;
    ctx.fill(new Path2D(AVATAR_FIGURE_PATH));
    ctx.restore();
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
    k === 'saving' ? t.accent : k === 'spend' ? t.hairline : t.stone;
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
          ctx.strokeStyle = t.hairline;
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
  const png = await renderReceiptPng(m);
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
