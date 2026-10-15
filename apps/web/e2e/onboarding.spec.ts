import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding } from './onboarding-mock';

// 온보딩 ① 파트 0~2(docs/spec/16-onboarding-1.md). 찬우가 처음 시작한다.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const next = (page: Page) => page.getByRole('button', { name: '다음' }).click();

async function part0(page: Page) {
  await page.goto('/');
  await heading(page, '뭐라고 부르면 될까요?');
  await axe(page);
  await page.getByLabel('뭐라고 부르면 될까요?').fill('찬우');
  await next(page);
  await heading(page, '어느 쪽이세요?');
  await page.getByRole('radio', { name: '신랑' }).click();
  await heading(page, '배우자는 뭐라고 부를까요?');
  await page.getByLabel('배우자는 뭐라고 부를까요?').fill('예빈');
  await next(page);
  await heading(page, '배우자도 지금 초대할까요?');
  await page.getByRole('radio', { name: '나 먼저 할게요' }).click();
  await heading(page, '우리 부부에 대해 알려주세요');
  await page.getByRole('button', { name: '시작할게요' }).click();
}

test('신혼부부: 호칭부터 1순위 목표 기한까지', async ({ page }) => {
  const db = await mockOnboarding(page);
  await part0(page);

  await heading(page, '결혼은 하셨나요?');
  await page.getByRole('radio', { name: '했어요' }).click();
  await heading(page, '결혼한 날은 언제예요?');
  await page.getByLabel('년', { exact: true }).fill('2025');
  await page.getByLabel('월', { exact: true }).fill('05');
  await page.getByLabel('일', { exact: true }).fill('17');
  await next(page);
  await heading(page, '찬우님은 몇 년생이세요?');
  await page.getByLabel('찬우님은 몇 년생이세요?').fill('1994'); // 4자리면 자동 다음
  await heading(page, '지금 어떤 집에 사세요?');
  await page.getByRole('radio', { name: '전세', exact: true }).click();
  await heading(page, '찬우님은 어떻게 일하고 계세요?');
  await page.getByRole('radio', { name: '정규직' }).click();
  await heading(page, '아이 계획이 있으세요?');
  await page.getByRole('radio', { name: '1~3년' }).click();

  await heading(page, '이제 둘의 목표를 정해요');
  await expect(page.getByText('2025년 5월 17일')).toBeVisible();
  await expect(page.getByText('전세', { exact: true })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '목표 고르기' }).click();

  await heading(page, '둘이 가장 먼저 이루고 싶은 건 뭐예요?');
  await expect(page.getByText('비상금은 자동으로 들어가요')).toBeVisible();
  await expect(page.getByRole('button', { name: /내 집 마련/ })).toContainText('추천');
  await page.getByRole('button', { name: /내 집 마련/ }).click();
  await page.getByRole('button', { name: /여행/ }).click();
  await expect(page.getByText('2개 골랐어요')).toBeVisible();
  await axe(page);
  await next(page);

  await heading(page, '어느 정도 집을 생각하세요?');
  await page.getByLabel('어느 정도 집을 생각하세요?').fill('500000000');
  await expect(page.getByText('5억 원', { exact: true })).toBeVisible();
  await next(page);
  await heading(page, '그중 얼마를 모아서 낼까요?');
  await expect(page.getByText('1억 5,000만 원을 모아요')).toBeVisible();
  await next(page);

  await heading(page, '언제까지 모을까요?');
  await expect(page.getByText('매달 250만 원씩 모으면 돼요')).toBeVisible();
  await expect(page.getByText('1억 5,000만 원 ÷ 60개월')).toBeVisible();
  await next(page);

  await expect(page.getByRole('button', { name: '지출 적기' })).toBeVisible();
  const g = (t: string) => db.goals.find((x) => x.template === t && !x.deleted_at);
  expect(g('emergency')).toMatchObject({
    priority: 0,
    target_amount: 10_000_000,
    amount_estimated: true,
  });
  expect(g('home')).toMatchObject({ priority: 1, target_amount: 150_000_000, kind: 'once' });
  expect(String(g('home')?.deadline)).toMatch(/^20\d\d-\d\d-01$/);
  expect(g('travel')).toMatchObject({ priority: 2 });
  expect(db.me).toMatchObject({
    nickname: '찬우',
    side: 'groom',
    birth_year: 1994,
    employment: 'regular',
    onboarding_step: 'O-31',
  });
  expect(db.space).toMatchObject({
    partner_nickname: '예빈',
    marriage_status: 'married',
    wedding_date: '2025-05-17',
    housing: 'jeonse',
    child_plan: 'in_1_3y',
  });
});

test('예비부부 각자 관리: 결혼 비용 목표만, 비상금 없음', async ({ page }) => {
  const db = await mockOnboarding(page);
  await part0(page);

  await page.getByRole('radio', { name: /준비 중이에요/ }).click();
  await heading(page, '결혼 예정일은 언제예요?');
  await page.getByRole('button', { name: '아직 미정이에요' }).click();
  await heading(page, '언제쯤 예정이에요?');
  await page.getByLabel('년', { exact: true }).fill(String(new Date().getFullYear() + 1));
  await page.getByRole('radio', { name: '5월' }).click();
  await next(page);
  await page.getByLabel('찬우님은 몇 년생이세요?').fill('1995');
  await page.getByRole('radio', { name: '부모님 집' }).click();
  await page.getByRole('radio', { name: '계약직' }).click();
  await page.getByRole('radio', { name: '아직 모르겠어요' }).click();

  await heading(page, '결혼 준비에 총 얼마를 생각하세요?');
  await page.getByRole('button', { name: '잘 모르겠어요' }).click();
  await page.getByRole('button', { name: '3~5천' }).click();
  await heading(page, '양가에서 도움을 받기로 했나요?');
  await page.getByRole('radio', { name: '네' }).click();
  await heading(page, '얼마를 도와주시기로 했어요?');
  await page.getByLabel('얼마를 도와주시기로 했어요?').fill('10000000');
  await next(page);
  await heading(page, '지금까지 결혼 준비로 모아둔 돈이 있나요?');
  await page.getByRole('button', { name: '없어요' }).click();
  await heading(page, '신혼집은 언제 구하나요?');
  await page.getByRole('radio', { name: '부모님 집에서 시작해요' }).click();
  await heading(page, '결혼 전까지 돈은 어떻게 관리할까요?');
  await page.getByRole('radio', { name: /각자 관리하고 결혼 비용만 같이/ }).click();

  await heading(page, '이제 둘의 목표를 정해요');
  await expect(page.getByText('4,000만 원')).toBeVisible();
  await page.getByRole('button', { name: '목표 고르기' }).click();
  await expect(page.getByText('결혼 비용은 자동으로 들어가요')).toBeVisible();
  await expect(page.getByText('고른 목표는 결혼 후부터 모아요')).toBeVisible();
  await page.getByRole('button', { name: '결혼 비용만 먼저 모을게요' }).click();

  await expect(page.getByRole('button', { name: '지출 적기' })).toBeVisible();
  const live = db.goals.filter((x) => !x.deleted_at);
  expect(live.map((x) => x.template)).toEqual(['wedding']);
  expect(live[0]).toMatchObject({
    target_amount: 30_000_000,
    other_held: 0,
    amount_estimated: true,
    deadline_estimated: true,
  });
  expect(db.space).toMatchObject({
    wedding_budget: 40_000_000,
    wedding_budget_estimated: true,
    family_support: 10_000_000,
    prep_money_mode: 'separate',
  });
});

test('만 18세 미만이면 계정을 지우고 시작 화면으로', async ({ page }) => {
  const db = await mockOnboarding(page);
  await part0(page);
  await page.getByRole('radio', { name: '했어요' }).click();
  await page.getByLabel('년', { exact: true }).fill('2025');
  await page.getByLabel('월', { exact: true }).fill('1');
  await page.getByLabel('일', { exact: true }).fill('10');
  await next(page);
  await page.getByLabel('찬우님은 몇 년생이세요?').fill(String(new Date().getFullYear() - 10));
  await expect(page.getByText('만 18세부터 쓸 수 있어요')).toBeVisible();
  expect(db.rpc).toContain('delete_minor_account');
});
