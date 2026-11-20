import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, emptyV22, type MemDb, mockOnboarding, seed } from './mocks';

// 월급 계획 템플릿(W-01)·이번 달 월급 체크(W-02) 상황별 수정(2026-11-19 사용자 결정, 20 W-01 3·5c번, W-02 2·3·8·9번, W-02a 키패드).
// 찬우 350만 원 25일, 10월 7일. 월급 체크리스트(9월 25일): 저금 청약 44만·내 집 마련 95만, 지출 고정지출 88만·생활비 88만·용돈 35만.
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
type Line = Record<string, unknown>;
const linesOf = (db: MemDb, i = 0) => db.checklists[i]?.pay_check_line as Line[];
const mark = (l: Line | undefined, state: string, actual: number | null = null) =>
  l &&
  Object.assign(l, { state, actual, checked_by: chanwoo.id, checked_at: '2026-09-26T01:00:00Z' });

async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  return db;
}

test('W-01 b: 줄이 하나도 없으면 막대·범례 없이 문장만(월급이 있어도)', async ({ page }) => {
  const db = await open(page);
  for (const s of db.splits) s.split_line = [];
  await page.goto('/salary/plan');
  await expect(page.getByRole('button', { name: '월급 350만 원, 금액 고치기' })).toBeVisible();
  await expect(page.getByText('월급을 어떻게 나눌지 정해 보세요')).toBeVisible();
  await expect(page.locator('.hg-plansum__bar')).toHaveCount(0);
  await expect(page.locator('.hg-plansum__legend')).toHaveCount(0);
  await axe(page);
});

test('W-01 e: 계획이 월급보다 많으면 “계획이 월급보다 150만 원 많아요”(오류 빨강), 줄이 있으면 막대·범례는 그대로', async ({
  page,
}) => {
  const db = await open(page);
  Object.assign(db.me, { monthly_income: 2_000_000 });
  await page.goto('/salary/plan');
  const title = page.locator('.hg-plansum__title');
  await expect(title).toHaveText('계획이 월급보다 150만 원 많아요');
  await expect(title).toHaveClass(/hg-plansum__title--error/);
  const color = await title.evaluate((el) => getComputedStyle(el).color);
  const danger = await page.evaluate(() => {
    const d = document.createElement('i');
    d.style.color = 'var(--danger)';
    document.body.append(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  });
  expect(color).toBe(danger);
  await expect(page.locator('.hg-plansum__bar')).toBeVisible();
  await expect(page.locator('.hg-plansum__legend li')).toHaveCount(3);
  await axe(page);
});

test('W-01 저축·투자 줄 보조 줄: 모은 금액 0원은 빼고 “목표 금액 …”, 자동은 앞에 “26일 자동”', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/plan#saving');
  const group = page.getByRole('region', { name: '저축·투자', exact: true });
  const house = group.locator('.hg-receipt__row', { hasText: '내 집 마련' });
  await expect(house.locator('.hg-receipt__note')).toHaveText('목표 금액 1억 5,000만 원');
  await expect(
    group.locator('.hg-receipt__row', { hasText: '청약' }).locator('.hg-receipt__note'),
  ).toHaveCount(0);
  await expect(group).not.toContainText('모은 금액 0원');
  // 보조 줄은 한 줄(말줄임)
  const wrap = await house
    .locator('.hg-receipt__note')
    .evaluate((el) => getComputedStyle(el).whiteSpace);
  expect(wrap).toBe('nowrap');
});

test('W-02 a: 템플릿 줄이 0개면 날짜 알약 + 한 덩어리 안내 + ‘월급 계획 템플릿 채우기’(큰 금액·칩·수입 카드 없음)', async ({
  page,
}) => {
  const db = await open(page);
  const list = db.checklists[0];
  if (list) list.pay_check_line = [];
  await page.goto('/salary');
  await expect(page.getByText('월급 계획 템플릿을 완성해 주세요')).toBeVisible();
  await expect(page.getByRole('region', { name: '이번 달 수입' })).toHaveCount(0);
  await expect(page.locator('.hg-w02hero__amt')).toHaveCount(0);
  await expect(page.locator('.hg-w02hero__meta')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^전체/ })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '월급 계획 템플릿 채우기' }).click();
  await expect(page.getByRole('heading', { name: '월급 계획 템플릿' })).toBeVisible();
});

test('W-02 f: 건너뜀이 섞여 다 확인하면 접힌 줄 “4개 확인, 1개 건너뜀”, 건너뜀이 없으면 “5개 모두 확인했어요”', async ({
  page,
}) => {
  const db = await open(page);
  linesOf(db).forEach((l, i) => mark(l, i === 2 ? 'skipped' : 'checked'));
  await page.goto('/salary');
  await expect(page.getByRole('button', { name: '4개 확인, 1개 건너뜀' })).toBeVisible();
  linesOf(db).forEach((l) => mark(l, 'checked'));
  await page.reload();
  await expect(page.getByRole('button', { name: '5개 모두 확인했어요' })).toBeVisible();
});

test('W-02 보조 줄: “n개 중 m개 확인”의 m에 건너뜀을 넣지 않고 “, k개 건너뜀”을 붙임', async ({
  page,
}) => {
  const db = await open(page);
  mark(linesOf(db)[0], 'checked');
  mark(linesOf(db)[1], 'skipped');
  await page.goto('/salary');
  await expect(page.locator('.hg-w02hero__meta')).toHaveText('5개 중 1개 확인, 1개 건너뜀');
});

test('W-02 h: 월급날 없는 사람은 같은 모양(제목, 기간 알약, 기간 수입 큰 금액, 월급 계획 중, 수입 카드, 저축·투자 목록)', async ({
  page,
}) => {
  const db = await open(page);
  Object.assign(db.me, { payday: null, payday_none: true });
  db.checklists.length = 0;
  if (db.v22)
    db.v22.period = {
      status: 'bar',
      start: '2026-09-20',
      end: '2026-10-19',
      day: 18,
      received: 3_400_000,
      needed: 3_500_000,
      gap_days: null,
    };
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '이번 달 월급 체크' })).toBeVisible();
  await expect(page.locator('.hg-datepill')).toHaveText('9월 20일 ~ 10월 19일');
  await expect(page.locator('.hg-w02hero__amt')).toHaveText('340만 원');
  await expect(page.locator('.hg-w02hero__meta')).toHaveText('월급 계획 350만 원 중');
  // 큰 금액은 위 기간 수입이라 카드는 이름표 + 기록 없음 안내 + 버튼만
  const card = page.getByRole('region', { name: '이번 기간 수입' });
  await expect(card).toContainText('수입 적기');
  await expect(card.locator('.hg-incomecard__sum')).not.toHaveText(/\d+만 원/);
  await expect(page.getByText('수입이 들어오면')).toHaveCount(0);
  const group = page.getByRole('region', { name: '저축·투자', exact: true });
  await expect(group.locator('.hg-receipt__row', { hasText: '내 집 마련' })).toContainText(
    '목표 금액',
  );
  // 막대는 오렌지가 아닌 ink-2
  const fill = await page
    .locator('.hg-w02hero__bar > i')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const ink2 = await page.evaluate(() => {
    const d = document.createElement('i');
    d.style.backgroundColor = 'var(--ink-2)';
    document.body.append(d);
    const c = getComputedStyle(d).backgroundColor;
    d.remove();
    return c;
  });
  expect(fill).toBe(ink2);
  await axe(page);
});

test.describe('W-02a 키패드(좁은 창)', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  async function openOther(page: Page) {
    await open(page);
    await page.goto('/salary');
    await page.locator('.hg-transfer__open', { hasText: '생활비' }).click();
    await page.getByRole('button', { name: '다른 금액으로 했어요' }).click();
    await expect(page.getByRole('heading', { name: /이번 달은 얼마였어요/ })).toBeVisible();
  }
  const input = (page: Page) => page.locator('.hg-amount__value');
  const key = (page: Page, k: string) => page.getByRole('button', { name: k, exact: true }).click();

  test('미리 채워진 계획 금액: 첫 숫자는 바꿔 쓰고, 그 뒤는 끝에 붙음', async ({ page }) => {
    await openOther(page);
    await expect(input(page)).toHaveValue('880,000');
    await key(page, '5');
    await expect(input(page)).toHaveValue('5');
    await key(page, '00');
    await key(page, '0');
    await expect(input(page)).toHaveValue('5,000');
    await axe(page);
  });

  test('지우기를 먼저 누르면 끝자리를 지움', async ({ page }) => {
    await openOther(page);
    await page.getByRole('button', { name: '한 글자 지우기' }).click();
    await expect(input(page)).toHaveValue('88,000');
    await key(page, '1');
    await expect(input(page)).toHaveValue('880,001');
  });

  test('999억 원을 넘는 숫자는 받지 않고 흔들림, 오류 화면으로 떨어지지 않음', async ({ page }) => {
    await openOther(page);
    for (let i = 0; i < 11; i++) await key(page, '9');
    await expect(input(page)).toHaveValue('99,999,999,999');
    await key(page, '9');
    await expect(input(page)).toHaveValue('99,999,999,999');
    await expect(page.locator('.hg-amount.is-shake')).toBeVisible();
    await key(page, '00');
    await expect(input(page)).toHaveValue('99,999,999,999');
    await expect(page.getByRole('heading', { name: /이번 달은 얼마였어요/ })).toBeVisible();
    await expect(page.getByText('잠시 문제가 생겼어요')).toHaveCount(0);
  });
});
