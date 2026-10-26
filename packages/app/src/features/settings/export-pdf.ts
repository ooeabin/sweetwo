import type { ExportData, PartnerAssetSum } from '@sweetwo/api';
import {
  formatDateFull,
  formatManWon,
  formatYm,
  goalEta,
  netWorth,
  netWorthSeries,
  readWon,
  yearlySavings,
  type Won,
} from '@sweetwo/core';
import { toAllocGoal } from '../salary';
import { copy } from './copy';
import type { Names, Scope } from './export';

// S-18 PDF 요약(25 ‘내보내기 명세’): A4 세로, 맨 아래 만든 날.
// ① 우리 자산 요약: 순자산, 자산·부채 합계, 최근 12개월 순자산 그래프(공동 데이터만. 계산은 F-01과 같은 core netWorth)
// ② 연간 요약: 올해 1~12월 목표에 넣은 돈(체크한 저금 줄, core yearlySavings), 목표별 진행 막대와 예상 달성
// 범위: 공동 = 보이는 항목 전부(배우자 ‘합계만’은 합계로), 내 데이터 = 내 명의 항목, 내 분배표·체크리스트, 내 목표.
// 글꼴은 디자인 글꼴 SUIT에서 뽑은 고정 굵기(assets/pdf-fonts), 색은 디자인 토큰(라이트) 값을 읽어 씀.

export interface PdfModel {
  scope: Scope;
  today: string;
  assets: { net: Won; assets: Won; debts: Won; trend: { month: number; net: Won }[] | null };
  year: {
    year: number;
    months: Won[];
    goals: {
      name: string;
      saved: Won;
      target: Won | null;
      pct: number | null;
      note: string | null;
    }[];
  };
}

export function buildPdfModel(
  d: ExportData,
  extra: { history: { month: string; net: Won; expected: Won }[]; partnerSums: PartnerAssetSum[] },
  scope: Scope,
  n: Names,
  today: string,
): PdfModel {
  const joint = scope === 'joint';
  const items = joint
    ? d.assets
    : d.assets.filter((a) => a.owner === 'person' && a.owner_user_id === n.myId);
  const nw = netWorth(
    items.map((a) => ({ ...a, side: a.side as 'asset' | 'debt' })),
    joint ? extra.partnerSums : [],
  );
  const trend = joint
    ? netWorthSeries(extra.history, nw, `${today.slice(0, 7)}-01`)
        .slice(-12)
        .map((p) => ({ month: Number(p.month.slice(5, 7)), net: p.net }))
    : null;

  const mine = (owner: string | null) => joint || owner === n.myId;
  const year = Number(today.slice(0, 4));
  const months = yearlySavings(
    d.checklists
      .filter((c) => mine(c.owner_user_id))
      .flatMap((c) =>
        c.pay_check_line
          .filter((l) => l.kind === 'saving')
          .map((l) => ({
            cycleStart: c.cycle_start,
            state: l.state,
            planned: l.planned,
            actual: l.actual,
          })),
      ),
    year,
  );
  const monthlyOf = (gid: string) =>
    d.splits
      .filter((x) => mine(x.owner_user_id))
      .flatMap((x) => x.split_line)
      .filter((l) => l.kind === 'saving' && l.goal_id === gid)
      .reduce((t, l) => t + l.amount, 0);
  const goals = d.goals
    .filter((g) => g.status !== 'used' && (joint || g.owner_user_id === n.myId))
    .map((g) => {
      const saved = d.saved[g.id] ?? g.other_held;
      const target = g.kind === 'monthly' ? null : g.target_amount;
      const eta =
        g.status === 'active' || g.status === 'delayed'
          ? goalEta(toAllocGoal({ ...g, other_held: saved }), monthlyOf(g.id)).expected
          : null;
      return {
        name: g.name,
        saved,
        target,
        pct: target ? Math.min(Math.floor((saved * 100) / target), 100) : null,
        note:
          g.status === 'achieved'
            ? copy.pdf.achieved
            : g.status === 'paused'
              ? copy.pdf.paused
              : eta && target
                ? copy.pdf.eta(formatYm(eta))
                : null,
      };
    });
  return {
    scope,
    today,
    assets: { net: nw.net, assets: nw.assets, debts: nw.debts, trend },
    year: { year, months, goals },
  };
}

/** 디자인 토큰(라이트) 색: 화면에 붙은 tokens.css에서 읽음 */
function tokenColors() {
  const el = document.createElement('div');
  el.setAttribute('data-theme', 'light');
  el.hidden = true;
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const read = (name: string) => cs.getPropertyValue(`--${name}`).trim();
  const out = {
    ink: read('ink'),
    slate: read('slate'),
    stone: read('stone'),
    hairline: read('hairline'),
    track: read('surface-alt'),
  };
  el.remove();
  return out;
}

const hex = (s: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  return m ? [m[1], m[2], m[3]].map((x) => parseInt(x ?? '0', 16) / 255) : [0, 0, 0];
};

const fromBase64 = (dataUrl: string) => {
  const b = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

/** PDF 만들기(pdf-lib, 글꼴은 처음 쓸 때만 불러옴) */
export async function renderPdf(m: PdfModel): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, { default: fontkit }, regular, bold] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
    import('../../assets/pdf-fonts/SUIT-Regular.ttf?inline'),
    import('../../assets/pdf-fonts/SUIT-Bold.ttf?inline'),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(m.scope === 'joint' ? copy.pdf.assetsTitle : copy.pdf.myAssetsTitle);
  doc.setProducer('sweeTwo');
  doc.setCreator('sweeTwo');
  const R = await doc.embedFont(fromBase64(regular.default));
  const B = await doc.embedFont(fromBase64(bold.default));
  const t = tokenColors();
  const c = (s: string) => {
    const [r = 0, g = 0, b = 0] = hex(s);
    return rgb(r, g, b);
  };
  const INK = c(t.ink);
  const SLATE = c(t.slate);
  const STONE = c(t.stone);
  const LINE = c(t.hairline);
  const TRACK = c(t.track);
  const W = 595.28;
  const H = 841.89;
  const M = 48;

  let page = doc.addPage([W, H]);
  const text = (
    s: string,
    x: number,
    y: number,
    o: {
      size?: number;
      bold?: boolean;
      color?: typeof INK;
      align?: 'left' | 'right' | 'center';
    } = {},
  ) => {
    const font = o.bold ? B : R;
    const size = o.size ?? 11;
    const w = font.widthOfTextAtSize(s, size);
    const dx = o.align === 'right' ? -w : o.align === 'center' ? -w / 2 : 0;
    page.drawText(s, { x: x + dx, y, size, font, color: o.color ?? INK });
  };
  const footer = () => {
    page.drawLine({
      start: { x: M, y: 56 },
      end: { x: W - M, y: 56 },
      thickness: 0.5,
      color: LINE,
    });
    text(copy.pdf.made(formatDateFull(m.today)), M, 40, { size: 9, color: STONE });
    text('sweeTwo', W - M, 40, { size: 9, color: STONE, align: 'right' });
  };

  // ① 자산 요약
  let y = H - M - 20;
  text(m.scope === 'joint' ? copy.pdf.assetsTitle : copy.pdf.myAssetsTitle, M, y, {
    size: 22,
    bold: true,
  });
  y -= 22;
  text(copy.scope[m.scope] ?? '', M, y, { size: 10, color: STONE });
  y -= 44;
  text(copy.pdf.net, M, y, { size: 11, color: SLATE });
  y -= 34;
  text(readWon(m.assets.net), M, y, { size: 28, bold: true });
  y -= 36;
  const half = (W - 2 * M) / 2;
  text(copy.pdf.assets, M, y, { size: 10, color: SLATE });
  text(copy.pdf.debts, M + half, y, { size: 10, color: SLATE });
  y -= 20;
  text(readWon(m.assets.assets), M, y, { size: 15, bold: true });
  text(readWon(m.assets.debts), M + half, y, { size: 15, bold: true });
  y -= 52;
  const trend = m.assets.trend;
  if (trend && trend.length) {
    text(copy.pdf.trend, M, y, { size: 13, bold: true });
    y -= 24;
    const top = y;
    const hgt = 180;
    const bottom = top - hgt;
    const vals = trend.map((p) => p.net);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const n = trend.length;
    const xAt = (i: number) => (n < 2 ? W - M - 20 : M + 20 + (i * (W - 2 * M - 40)) / (n - 1));
    const yAt = (v: number) => bottom + 16 + ((v - lo) / (hi - lo)) * (hgt - 36);
    page.drawLine({
      start: { x: M, y: bottom },
      end: { x: W - M, y: bottom },
      thickness: 0.5,
      color: LINE,
    });
    trend.forEach((p, i) => {
      const next = trend[i + 1];
      if (next)
        page.drawLine({
          start: { x: xAt(i), y: yAt(p.net) },
          end: { x: xAt(i + 1), y: yAt(next.net) },
          thickness: 2,
          color: INK,
        });
      page.drawCircle({ x: xAt(i), y: yAt(p.net), size: 2.5, color: INK });
      text(copy.pdf.month(p.month), xAt(i), bottom - 16, {
        size: 9,
        color: STONE,
        align: 'center',
      });
    });
    const last = trend[n - 1];
    if (last)
      text(readWon(last.net), xAt(n - 1), yAt(last.net) + 10, {
        size: 9,
        bold: true,
        align: n < 2 ? 'center' : 'right',
      });
  }
  footer();

  // ② 연간 요약
  page = doc.addPage([W, H]);
  y = H - M - 20;
  text(copy.pdf.yearTitle(m.year.year), M, y, { size: 22, bold: true });
  y -= 22;
  text(copy.scope[m.scope] ?? '', M, y, { size: 10, color: STONE });
  y -= 44;
  text(copy.pdf.yearSaved, M, y, { size: 11, color: SLATE });
  y -= 34;
  text(readWon(m.year.months.reduce((a, b) => a + b, 0)), M, y, { size: 28, bold: true });
  y -= 48;
  text(copy.pdf.monthly, M, y, { size: 13, bold: true });
  y -= 24;
  {
    const hgt = 150;
    const bottom = y - hgt;
    const max = Math.max(...m.year.months, 1);
    const slot = (W - 2 * M) / 12;
    const bw = Math.min(22, slot - 10);
    page.drawLine({
      start: { x: M, y: bottom },
      end: { x: W - M, y: bottom },
      thickness: 0.5,
      color: LINE,
    });
    m.year.months.forEach((v, i) => {
      const cx = M + slot * i + slot / 2;
      const h = (v / max) * (hgt - 24);
      if (v > 0) {
        page.drawRectangle({
          x: cx - bw / 2,
          y: bottom,
          width: bw,
          height: Math.max(h, 1),
          color: INK,
        });
        text(formatManWon(v), cx, bottom + h + 5, { size: 8, color: SLATE, align: 'center' });
      }
      text(copy.pdf.month(i + 1), cx, bottom - 16, { size: 9, color: STONE, align: 'center' });
    });
    y = bottom - 52;
  }
  text(copy.pdf.goals, M, y, { size: 13, bold: true });
  y -= 28;
  if (!m.year.goals.length) text(copy.pdf.noGoals, M, y, { size: 11, color: SLATE });
  for (const g of m.year.goals) {
    if (y < 110) {
      footer();
      page = doc.addPage([W, H]);
      y = H - M - 20;
    }
    text(g.name, M, y, { size: 12, bold: true });
    if (g.note) text(g.note, W - M, y, { size: 10, color: SLATE, align: 'right' });
    y -= 14;
    if (g.pct !== null) {
      page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 6, color: TRACK });
      if (g.pct > 0)
        page.drawRectangle({
          x: M,
          y: y - 6,
          width: ((W - 2 * M) * g.pct) / 100,
          height: 6,
          color: INK,
        });
      y -= 22;
      text(`${copy.pdf.savedOf(readWon(g.saved), readWon(g.target ?? 0))}, ${g.pct}%`, M, y, {
        size: 10,
        color: SLATE,
      });
    } else {
      y -= 8;
      text(readWon(g.saved), M, y, { size: 10, color: SLATE });
    }
    y -= 30;
  }
  footer();
  return doc.save();
}
