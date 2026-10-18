import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');

// 가이드(S-01~S-03), 체크리스트 할 일, 내 답 다시 보기(S-17). 찬우, 예빈 합류 전, 신혼 첫해.
function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-08-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    wedding_date: '2026-05-17',
    housing: 'jeonse',
    child_plan: 'none',
    partner_income: 2_700_000,
    partner_income_estimated: true,
    partner_income_unknown: false,
    fixed_total: 1_000_000,
    living_budget: 550_000,
    loan_repayment: 0,
    split_mode: 'half',
    split_ratio: 50,
    split_deferred: false,
    account_mode: 'roles',
    base_day: null,
    base_day_last: false,
  };
  db.checklistDone = [];
}

test('체크리스트: 이번 달 할 일 → S-02 완료했어요 → 다음 항목, 설정 가이드 진행률', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await page.getByRole('button', { name: /통장 3개 만들고 첫 월급 나누기/ }).click();
  await heading(page, '통장 3개 만들고 첫 월급 나누기');
  await expect(page.getByText('월급 플랜에서 통장별 금액을 확인해요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '완료했어요' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: /혼인신고 시점 확인/ })).toBeVisible();
  expect(db.checklistDone).toEqual([expect.objectContaining({ key: 'first-split' })]);

  await page.goto('/settings');
  await expect(page.locator('.hg-listrow', { hasText: '가이드 모아보기' })).toContainText(
    '체크리스트 1/7',
  );
  await page.locator('.hg-listrow', { hasText: '가이드 모아보기' }).click();
  await heading(page, '가이드 모아보기');
  await expect(page.getByText('신혼 첫해 체크리스트')).toBeVisible();
  // 전세 → 맞춤 글 첫째 = 전세 만기 전 점검
  await expect(page.getByRole('button', { name: '전세 만기 전 점검' })).toBeVisible();
  await axe(page);
  // 설정에서 연 항목은 보기만(완료 버튼 없음), 출처와 확인일
  await page.getByRole('button', { name: /보험 수익자 변경/ }).click();
  await heading(page, '보험 수익자 변경, 중복 보장 점검');
  await expect(page.getByRole('button', { name: '완료했어요' })).toHaveCount(0);
  await expect(page.getByText(/확인일 2026년 10월 18일/)).toBeVisible();
  await page.getByRole('button', { name: '뒤로' }).click();
  await page.getByRole('button', { name: /비상금은 왜 먼저일까요/ }).first().click();
  await heading(page, '비상금은 왜 먼저일까요');
  await expect(page.getByText('투자·금융 자문이 아니에요. 제도와 개념만 설명해요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '우리에게 적용하기: 비상금 목표 보기' }).click();
  await expect(page).toHaveURL(/\/goals$/);
});

test('내 답 다시 보기(S-17): 파트별 요약, 사는 집 다시 답하기, 계획 다시 세우기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/settings');
  await page.locator('.hg-listrow', { hasText: '내 답 다시 보기' }).click();
  await heading(page, '내 답 다시 보기');
  await expect(page.locator('.hg-listrow', { hasText: '사는 집' })).toContainText('전세');
  await expect(page.locator('.hg-listrow', { hasText: '월 수입' })).toContainText('350만 원');
  await axe(page);
  await page.locator('.hg-listrow', { hasText: '사는 집' }).click();
  await heading(page, '지금 어떤 집에 사세요?');
  await page.getByRole('radio', { name: '자가' }).click();
  await expect(page.getByText('바꿨어요')).toBeVisible();
  expect(db.space?.housing).toBe('own');
  await page.getByRole('button', { name: '계획 다시 세우기' }).click();
  await heading(page, '어떤 게 바뀌었나요?');
});
