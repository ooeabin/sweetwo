import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { setWheel } from './wheel';
import { mockOnboarding } from './onboarding-mock';

// 온보딩 11화면(docs/spec/16-onboarding-1.md, 17-onboarding-2.md, 재기획 ADR 0003).
// 찬우가 처음 시작하고 예빈은 아직 미합류. 기획서 예시: 실수령 350만, 월급날 25일, 1순위 내 집 마련.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const next = (page: Page) => page.getByRole('button', { name: '다음' }).click();
const row = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}`) });
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** O-10 → O-03 → O-06(나중에) */
async function start(page: Page) {
  await page.goto('/');
  await heading(page, '2분이면 우리의 첫 목표가 생겨요');
  await expect(page.getByText('목표와 월급만 알려 주세요')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '시작할게요' }).click();
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  await expect(page.getByRole('progressbar', { name: '온보딩 진행' }).first()).toBeVisible();
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await heading(page, '같이 쓸 사람을 초대할까요?');
  await axe(page);
  await page.getByRole('radio', { name: '나중에 할게요' }).click();
}

test('신혼부부: 이름부터 첫 체크리스트까지 11화면', async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);

  await heading(page, '결혼은 하셨나요?');
  await page.getByRole('radio', { name: '했어요' }).click();
  await heading(page, '결혼한 날은 언제예요?');
  await page.getByLabel('년', { exact: true }).fill('2025');
  await page.getByLabel('월', { exact: true }).fill('05');
  await page.getByLabel('일', { exact: true }).fill('17');
  await next(page);
  await heading(page, '찬우님은 몇 년생이에요?');
  await expect(page.getByRole('spinbutton', { name: '월', exact: true })).toHaveCount(0);
  await setWheel(page, '찬우님은 몇 년생이에요?', 1994);
  await axe(page);
  await next(page);

  await heading(page, '둘이 가장 먼저 이루고 싶은 건 뭐예요?');
  await expect(page.getByText('비상금은 자동으로 들어가요')).toBeVisible();
  await page.getByRole('button', { name: /내 집 마련/ }).click();
  await page.getByRole('button', { name: /여행/ }).click();
  await expect(page.getByText('2개 골랐어요')).toBeVisible();
  await axe(page);
  await next(page);

  await heading(page, '어느 정도 집을 생각하세요?');
  await page.getByLabel('어느 정도 집을 생각하세요?').fill('500000000');
  await next(page);
  await heading(page, '그중 얼마를 모아서 낼까요?');
  await expect(page.getByText('1억 5,000만 원을 모아요')).toBeVisible();
  await next(page);
  await heading(page, '언제까지 모을까요?');
  await expect(page.getByText('매달 250만 원씩 모으면 돼요')).toBeVisible();
  await next(page);

  // 온보딩 ②: 관리 방식, 월급, 분배표, 결과
  await heading(page, '월급을 어떻게 관리해요?');
  await expect(page.getByRole('radio', { name: /각자 월급을 따로 관리해요/ })).toBeChecked();
  await axe(page);
  await next(page);
  await heading(page, '한 달에 월급이 얼마 들어와요?');
  await page.getByLabel('한 달에 월급이 얼마 들어와요?').fill('3500000');
  await page.getByRole('radio', { name: '25일' }).click();
  await axe(page);
  await next(page);

  // 추천값(17 O-50 예시): 고정지출 88만, 생활비 88만, 용돈 35만, 비상금 44만, 내 집 마련 95만, 여행 0원, 남는 돈 0원
  await heading(page, '월급을 이렇게 나눠 볼까요?');
  await expect(page.getByText('월급 350만 원')).toBeVisible();
  await expect(row(page, '비상금')).toContainText('44만 원');
  await expect(row(page, '내 집 마련')).toContainText('95만 원');
  await expect(row(page, '내 집 마련')).toContainText('매달 250만 원이 필요해요');
  await expect(row(page, '여행')).toContainText('0원');
  await expect(row(page, '고정지출')).toContainText('88만 원');
  await expect(row(page, '생활비')).toContainText('88만 원');
  await expect(row(page, '용돈')).toContainText('35만 원');
  await expect(page.getByText('남는 돈 0원')).toBeVisible();
  await axe(page);
  // 줄을 눌러 금액 고치기 → 남는 돈이 바로 바뀜
  await row(page, '생활비').click();
  await heading(page, '생활비 금액');
  await page.getByLabel('생활비 금액').fill('780000');
  await next(page);
  await expect(page.getByText('남는 돈 10만 원')).toBeVisible();
  await page.getByRole('button', { name: '이대로 할게요' }).click();

  await heading(page, '매달 95만 원씩 모으면 2039년 12월에 내 집 마련을 이뤄요');
  await expect(page.getByText(/목표 기한보다 8년 2개월 늦어요/)).toBeVisible();
  await expect(page.getByText('월급날(25일)에 분배표대로 보내고 체크해 주세요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '시작할게요' }).click();
  await expect(page).not.toHaveURL(/onboarding/);

  expect(db.me).toMatchObject({
    nickname: '찬우',
    birth_year: 1994,
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
  });
  expect(db.me.onboarding_done_at).toBeTruthy();
  expect(db.space).toMatchObject({
    marriage_status: 'married',
    wedding_date: '2025-05-17',
    salary_mode: 'separate',
  });
  // 비상금 목표 금액 = (고정지출 88만 + 생활비 78만) × 3
  expect(db.goals.find((g) => g.template === 'emergency')).toMatchObject({
    target_amount: 4_980_000,
    deadline: '2027-10-01',
  });
  expect(db.splits).toHaveLength(1);
  expect(db.splits[0]?.owner_user_id).toBe(chanwoo.id);
  expect(db.splits[0]?.split_line.map((l) => [l.kind, l.amount])).toEqual([
    ['saving', 440_000],
    ['saving', 950_000],
    ['saving', 0],
    ['fixed', 880_000],
    ['living', 780_000],
    ['allowance', 350_000],
  ]);
  expect(db.rpc).toContain('start_checklist');
  expect(db.checklists).toHaveLength(1);
});

test('예비부부, 합쳐서, 월급 없음: 결혼 비용 질문과 0원 분배표', async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);

  await page.getByRole('radio', { name: '준비 중이에요' }).click();
  await heading(page, '결혼 예정일은 언제예요?');
  await page.getByRole('button', { name: '아직 미정이에요' }).click();
  await heading(page, '언제쯤 예정이에요?');
  await page.getByRole('button', { name: '건너뛸게요' }).click();
  await heading(page, '찬우님은 몇 년생이에요?');
  await next(page);

  // 결혼 준비 중: 결혼 비용이 ‘자주 고르는’ 맨 앞 + 추천(미리 선택 안 함)
  await heading(page, '둘이 가장 먼저 이루고 싶은 건 뭐예요?');
  const wedding = page.getByRole('button', { name: /결혼 비용/ });
  await expect(wedding).toContainText('추천');
  await expect(page.getByText('개 골랐어요')).toHaveCount(0);
  await wedding.click();
  await next(page);
  await heading(page, '결혼 준비에 총 얼마를 생각하세요?');
  await expect(page.getByText('둘이 합한 금액이에요')).toBeVisible();
  await page.getByLabel('결혼 준비에 총 얼마를 생각하세요?').fill('30000000');
  await next(page);
  await heading(page, '지금까지 모아둔 돈이 있나요?');
  await page.getByRole('button', { name: '없어요' }).click();
  await heading(page, '언제까지 모을까요?');
  await next(page);

  await heading(page, '월급을 어떻게 관리해요?');
  await page.getByRole('radio', { name: /합쳐서 같이 관리해요/ }).click();
  await next(page);
  await heading(page, '한 달에 월급이 얼마 들어와요?');
  await page.getByRole('button', { name: '지금은 월급이 없어요' }).click();

  await heading(page, '월급을 이렇게 나눠 볼까요?');
  await expect(row(page, '결혼 비용')).toContainText('0원');
  await expect(page.getByText('남는 돈 0원')).toBeVisible();
  await page.getByRole('button', { name: '이대로 할게요' }).click();

  await heading(page, '분배표에서 저금을 정하면 언제 이룰지 알려 드려요');
  await page.getByRole('button', { name: '시작할게요' }).click();
  await expect(page).not.toHaveURL(/onboarding/);

  expect(db.space).toMatchObject({ marriage_status: 'engaged', salary_mode: 'joint' });
  expect(db.goals.find((g) => g.template === 'wedding')).toMatchObject({
    target_amount: 30_000_000,
    other_held: 0,
    deadline_estimated: true,
  });
  expect(db.me).toMatchObject({ monthly_income: 0, payday: null });
  expect(db.splits[0]?.owner_user_id).toBeNull();
  expect(db.checklists).toHaveLength(0); // 월급날이 없으면 체크리스트 없음
});

test('이어하기(16): 앱을 다시 열면 “이어서 할까요?” → 멈춘 화면부터, 한 번만 물음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  Object.assign(db.me, { nickname: '찬우', onboarding_step: 'O-11', onboarding_done_at: null });
  await page.goto('/');
  await heading(page, '이어서 할까요?');
  await expect(page.getByText('멈춘 곳부터 이어서 해요. 적어 둔 답은 그대로예요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '이어서 할게요' }).click();
  await expect(page).toHaveURL(/\/onboarding\/o-11$/);
  // 같은 실행 안에서는 다시 묻지 않음
  await page.evaluate(() => history.pushState({}, '', '/'));
  await page.goto('/onboarding/o-11');
  await expect(page.getByRole('heading', { name: '이어서 할까요?' })).toHaveCount(0);
});
