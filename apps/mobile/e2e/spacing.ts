import type { Page } from '@playwright/test';

// 간격 정리(2026-11-27, DESIGN.md ‘간격 정리 2026-11-27’) 공통 도우미.
// 보이는 간격 = 글자 줄 상자 사이(56 줄은 끝에서 글자 줄까지 16, ‘+ … 추가’ 회색 원은 원 끝).

export interface BandGap {
  /** 띠 위 보이는 간격(앞 글자 → 띠) */
  above: number;
  /** 띠 아래 보이는 간격(띠 → 다음 글자) */
  below: number;
  height: number;
  /** 띠 왼쪽·오른쪽 끝(화면 끝까지면 0, 화면 폭) */
  left: number;
  right: number;
}

/** 화면의 회색 띠(`hg-band` 요소와 이어진 묶음 사이 ::before)마다 위아래 보이는 간격 */
export async function bandGaps(page: Page): Promise<BandGap[]> {
  return page.evaluate(() => {
    const sy = scrollY;
    const shown = (el: Element) => {
      const cs = getComputedStyle(el);
      return (
        cs.visibility !== 'hidden' && cs.display !== 'none' && el.getBoundingClientRect().height > 0
      );
    };
    // 글자 줄 상자(글자가 바로 들어 있는 요소의 안쪽 상자)와 그림(svg, 입력 칸, 바탕이 있는 작은 상자)
    const marks: { t: number; b: number }[] = [];
    for (const e of Array.from(document.querySelectorAll('#root *'))) {
      if (
        !shown(e) ||
        e.closest('.hg-frame__mhead, .hg-pagehead, .hg-noti__head, .hg-stickybar, .hg-appside')
      )
        continue;
      const r = e.getBoundingClientRect();
      if (e.matches('.hg-addrow__icon')) {
        // ‘+ … 추가’ 회색 원(32)은 원 끝을 잼
        marks.push({ t: r.top + sy, b: r.bottom + sy });
        continue;
      }
      if (e.closest('[aria-hidden="true"]') && e.tagName !== 'svg') continue;
      const cs = getComputedStyle(e);
      const text = Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim());
      const bg =
        cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.height < 120 && r.width < innerWidth - 2;
      const media = ['svg', 'INPUT', 'TEXTAREA', 'IMG'].includes(e.tagName);
      if (!text && !bg && !media) continue;
      const pt = text && !bg ? parseFloat(cs.paddingTop) : 0;
      const pb = text && !bg ? parseFloat(cs.paddingBottom) : 0;
      marks.push({ t: r.top + sy + pt, b: r.bottom + sy - pb });
    }
    const bands: { t: number; b: number; l: number; r: number }[] = [];
    for (const e of Array.from(document.querySelectorAll('#root *'))) {
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect();
      if (e.matches('.hg-band, .hg-page__band')) {
        bands.push({ t: r.top + sy, b: r.bottom + sy, l: r.left, r: r.right });
        continue;
      }
      const c = getComputedStyle(e, '::before');
      if (
        c.content !== 'none' &&
        c.position === 'absolute' &&
        c.height === '8px' &&
        c.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        c.backgroundImage === 'none'
      ) {
        const t = r.top + sy + parseFloat(c.top || '0');
        const l = r.left + parseFloat(c.left || '0');
        bands.push({
          t,
          b: t + 8,
          l: c.left === 'auto' ? 0 : l,
          r: c.right === 'auto' ? innerWidth : r.right - parseFloat(c.right || '0'),
        });
      }
    }
    return bands
      .sort((a, b) => a.t - b.t)
      .map((bd) => {
        const up = marks
          .filter((m) => m.b <= bd.t + 0.5)
          .reduce((x, m) => Math.max(x, m.b), -Infinity);
        const dn = marks
          .filter((m) => m.t >= bd.b - 0.5)
          .reduce((x, m) => Math.min(x, m.t), Infinity);
        return {
          above: Math.round(bd.t - up),
          below: Math.round(dn - bd.b),
          height: Math.round(bd.b - bd.t),
          left: Math.round(bd.l),
          right: Math.round(bd.r),
        };
      });
  });
}

/** 좁은 창 머리(‹ 제목): 머리 상자 위·아래, ‹ 누르는 칸 왼쪽, 제목 위 */
export async function headBox(page: Page) {
  return page.evaluate(() => {
    const head = Array.from(
      document.querySelectorAll('.hg-frame__mhead--back, .hg-pagehead, .hg-noti__head'),
    ).find((e) => e.getBoundingClientRect().height > 0);
    if (!head) return null;
    const r = head.getBoundingClientRect();
    const back = head.querySelector('.hg-back, .hg-mhead__back')?.getBoundingClientRect();
    const title = head
      .querySelector('.hg-mhead__title, .hg-pagehead__title, .hg-noti__title')
      ?.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      backLeft: back ? Math.round(back.left) : null,
      titleTop: title ? Math.round(title.top) : null,
    };
  });
}

/** 요소 위 끝 − 머리 아래 끝 */
export async function belowHead(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const head = Array.from(
      document.querySelectorAll('.hg-frame__mhead--back, .hg-pagehead, .hg-noti__head'),
    ).find((e) => e.getBoundingClientRect().height > 0);
    const el = Array.from(document.querySelectorAll(sel)).find(
      (e) => e.getBoundingClientRect().height > 0,
    );
    if (!head || !el) return null;
    return Math.round(el.getBoundingClientRect().top - head.getBoundingClientRect().bottom);
  }, selector);
}

/** 아래 고정 주 버튼(StickyBar·질문 화면 아래 바·로그인·상태 화면 버튼 묶음)의 아래 끝 → 화면 아래(브라우저는 안전 영역 0) */
export async function bottomBarGap(page: Page) {
  return page.evaluate(() => {
    const btn = Array.from(
      document.querySelectorAll(
        '.hg-stickybar .hg-btn--primary, .hg-q__foot .hg-btn--primary, .hg-auth__actions .hg-btn--primary',
      ),
    ).find((e) => e.getBoundingClientRect().height > 0);
    if (!btn) return null;
    return Math.round(innerHeight - btn.getBoundingClientRect().bottom);
  });
}
