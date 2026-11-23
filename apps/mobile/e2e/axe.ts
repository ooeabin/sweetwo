import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// 2026-11-15 3차 검토: 주 버튼 글자는 진한 글자(on-accent-app-text, 오렌지 위 6.5:1)라 예외에서 뺌(예전 흰 글자 2.7:1).
// 달성 배지의 color-contrast만 예외로 빼고, 나머지 규칙은 그대로 검사함.
const BRAND_FILL = /hg-badge--achieved/;

// 2026-11-09 브랜드 색 규칙(당근처럼 오렌지 하나): 흰 바탕 위 오렌지 글자(약 2.7:1)도 알고 씀.
// 예외는 14px 이상 + 600 이상의 짧은 강조 숫자, 띠 안 흰 작은 버튼, 고른 바꾸기 칩만(2026-11-09 글자 버튼은 모두 회색이라 예외 없음. tokens.css `--brand` 주석, DESIGN.md 색, CLAUDE.md 브랜드 색).
// 체크 원, 진행 원·막대, + 버튼(FAB)은 글자가 없는 그래픽이라 axe color-contrast 대상이 아님.
// 이 선택자에 걸리는 요소(또는 그 안의 글자)만 color-contrast에서 뺌. 나머지 규칙과 요소는 그대로 검사함.
const ORANGE_TEXT = [
  '.hg-sechead__count b', // “저축·투자 1/2”의 한 개수
  '.hg-amountin > .hg-quick > .hg-chip.is-selected', // 고른 바꾸기 칩(W-11b)
  ':is(.hg-card, .hg-list, .hg-checklist) .hg-btn--secondary', // 카드 안 보조 버튼의 오렌지 글자(‘초대 취소’, ‘링크 복사’ 등, 2026-11-11 사용자 결정, 14px 이상 700)
  '.hg-plan__block--soft', // 옅은 오렌지 판 위 버튼의 오렌지 글자(W-01 ‘월급 적기’, 2026-11-19 사용자 결정, 14px 이상 700)
  '.hg-form__val', // 한 화면 입력 요약 문장의 금액(22px 700, 2026-11-23 사용자 결정: 이름은 ink, 금액 자리만 오렌지)
  '.hg-chip--sm.is-selected', // 고른 작은 칩의 오렌지 글자(S-20 묶음 칩, 기간·필터 칩, 2026-11-20 사용자 결정, 13px 600)
  '.hg-plansum__title em', // W-01 요약 문장 “월급의 31%를 모으고 있어요”의 퍼센트(2026-11-23 사용자 결정, 20px 700)
  '.hg-receipt__row.is-new', // W-01 새 항목 강조 2초 동안 이름·금액 글자(2026-11-23, 16px 600·700)
  '.hg-banner--line .hg-btn--secondary', // 공지 띠 안 흰 작은 버튼의 오렌지 글자(‘보기’). 홈 초대 띠는 2026-11-11부터 코코아 HubBand라 예외 없음
].join(', ');

export async function axe(page: Page) {
  // 주 버튼이 켜지며 바탕색이 바뀌는 중에 재면 중간 색으로 대비가 모자라 보임(느린 CI에서만): 전환이 끝난 뒤에 잼
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))),
  );
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const violations = await Promise.all(
    r.violations.map(async (v) => {
      if (v.id !== 'color-contrast') return v;
      const keep = await Promise.all(
        v.nodes.map(async (n) => {
          if (BRAND_FILL.test(`${n.html} ${n.target.join(' ')}`)) return false;
          const sel = n.target.length === 1 ? n.target[0] : undefined;
          if (typeof sel !== 'string') return true;
          const orange = await page
            .evaluate(([s, o]) => !!document.querySelector(s)?.closest(o), [
              sel,
              ORANGE_TEXT,
            ] as const)
            .catch(() => false);
          return !orange;
        }),
      );
      return { ...v, nodes: v.nodes.filter((_, i) => keep[i]) };
    }),
  );
  return { ...r, violations: violations.filter((v) => v.nodes.length > 0) };
}
