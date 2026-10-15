import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding } from './onboarding-mock';
import { mockSupabase, SB } from './supabase-mock';

// 배우자 합류(docs/spec/18-partner-join.md). 예빈이 찬우의 초대 링크로 합류한다.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const next = (page: Page) => page.getByRole('button', { name: '다음' }).click();
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('로그인 전: 초대한 사람을 보여 주고, 합류하기 → 로그인 뒤 돌아올 자리 기억', async ({
  page,
}) => {
  await mockSupabase(page);
  await page.route(`${SB}/rest/v1/rpc/invite_preview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ inviter_nickname: '찬우', status: 'ok' }]),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await page.goto('/i/K7M2QX');
  await heading(page, '찬우님이 초대했어요');
  await expect(page.getByText('둘이 같이 쓰는 공간에 합류해요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '합류하기' }).click();
  await heading(page, '시작하려면 로그인해 주세요');
  const back = await page.evaluate(
    () => localStorage.getItem('sweetwo.return-to') ?? sessionStorage.getItem('sweetwo.return-to'),
  );
  expect(back).toBe('/i/K7M2QX?go=1');
});

test('예빈 합류: P-02b → P-03 → P-04 → P-05 → P-07 제안 → P-08 다르게 → P-10 → P-11 → 이번 달', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  // 찬우가 만든 공간과 첫 플랜(9월 월급 플랜, 직접 정할게요 60:40)
  db.space = {
    id: 'space-1',
    created_by: 'starter',
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_500_000,
    partner_income_estimated: true,
    partner_income_unknown: false,
    fixed_total: 1_000_000,
    living_budget: 1_300_000,
    loan_repayment: 300_000,
    split_mode: 'custom',
    split_ratio: 60,
    split_deferred: false,
    account_mode: 'roles',
    base_day: null,
    base_day_last: false,
  };
  db.partner = {
    id: 'starter',
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    income_variable: false,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
  };
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: 3_000_000,
      p_merged_close: false,
      p_is_temp: true,
      p_snapshot: {
        parts: { living: 1_110_000, goalFund: 1_500_000, emergency: 390_000 },
        income: 6_000_000,
        saveable: 2_400_000,
      },
      p_lines: [
        {
          target: 'account',
          account_role: 'living',
          amount: 1_110_000,
          amount_groom: 670_000,
          amount_bride: 440_000,
        },
        {
          target: 'account',
          account_role: 'goal_fund',
          amount: 1_500_000,
          amount_groom: 900_000,
          amount_bride: 600_000,
        },
        {
          target: 'account',
          account_role: 'emergency',
          amount: 390_000,
          amount_groom: 230_000,
          amount_bride: 160_000,
        },
      ],
    },
  });

  await page.goto('/i/K7M2QX');
  await heading(page, '찬우님이 초대했어요');
  await expect(page.getByText('카카오 계정으로 합류해요')).toBeVisible();
  await page.getByRole('button', { name: '합류하기' }).click();

  // P-02b 사전 입력 확인·동의
  await heading(page, '찬우님이 미리 적어 둔 내 정보가 있어요');
  await expect(page.locator('.hg-listrow', { hasText: '월 수입' })).toContainText('250만 원');
  await axe(page);
  await page.getByRole('button', { name: '확인하고 이어 쓸게요' }).click();

  await heading(page, '‘예빈’이 맞나요?');
  await page.getByRole('button', { name: '맞아요' }).click();

  await heading(page, '출생연도와 일하는 방식을 알려주세요');
  await page.getByLabel('출생연도').fill('1996');
  await page.getByRole('radio', { name: '정규직' }).click();
  await axe(page);
  await next(page);

  await heading(page, '한 달에 얼마 받으세요?');
  await expect(page.getByText('찬우님이 적어 둔 값이에요')).toBeVisible();
  await page.getByLabel('한 달에 얼마 받으세요?').fill('2700000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await page.getByRole('radio', { name: '10일' }).click();
  await next(page);

  await heading(page, '예빈님 용돈은 한 달에 얼마로 할까요?');
  await expect(page.getByLabel('예빈님 용돈은 한 달에 얼마로 할까요?')).toHaveValue(/500,?000/);
  // 같으면 안내 없음, 다르면 찬우에게 제안(적용일 = 72시간 뒤 첫 기준일, 두 월급날 중 늦은 25일)
  await expect(page.getByText(/반대 없으면/)).toHaveCount(0);
  await page.getByLabel('예빈님 용돈은 한 달에 얼마로 할까요?').fill('600000');
  await expect(page.getByText('좋아요면 바로, 반대 없으면 10월 25일부터 적용돼요')).toBeVisible();
  await next(page);

  // P-08: 확정 전 예빈 용돈 = 찬우 용돈. 공동자금 = 고정 130 + 생활비 130 + 모을 돈(620 − 100 − 260 = 260) = 520
  // → 예빈 40% 208, 찬우 312
  await heading(page, '같이 쓰는 돈 나누는 방식, 괜찮아요?');
  await expect(page.getByText('직접 정할게요')).toBeVisible();
  await expect(page.getByText('208만 원')).toBeVisible();
  await expect(page.getByText('312만 원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다르게 해볼래요' }).click();
  await page.getByRole('radio', { name: /반반/ }).click();
  await expect(page.getByText('좋아요면 바로, 반대 없으면 10월 25일부터 적용돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '찬우님께 제안하기' }).click();

  // P-10: 찬우가 아직 목표가 없음
  await heading(page, '합류 전에 바뀐 것과 목표예요');
  await expect(page.getByText('찬우님이 목표를 정하면 여기에 보여요')).toBeVisible();
  await axe(page);
  await next(page);

  // P-11 합류 완료
  await heading(page, '두 분은 한 달에 260만 원을 모을 수 있어요');
  await expect(page.getByText('620만 원')).toBeVisible();
  await expect(page.getByLabel('이전').first()).toHaveText('600만 원');
  await expect(
    page.getByText('9월 월급 플랜은 그대로, 안 나눈 돈만 다시 계산했어요'),
  ).toBeVisible();
  // 답 기다리는 제안: 전 → 후 + 적용일
  const waiting = page.getByRole('list', { name: '답 기다리는 제안' });
  await expect(waiting.getByRole('listitem')).toHaveCount(2);
  await expect(waiting).toContainText('예빈님 용돈');
  await expect(waiting).toContainText('50만 원 → 60만 원');
  await expect(waiting).toContainText('찬우 60%, 예빈 40% → 반반');
  await expect(waiting).toContainText('10월 25일부터 적용');
  await axe(page);
  await page.getByRole('button', { name: '이번 달로' }).click();

  // 예빈의 이번 달: 합류했고 통장 역할을 나눠서 월급 나누기
  await heading(page, '예빈님, 9월 월급 나누기가 3곳 남았어요');
  expect(db.space).toMatchObject({
    couple_state: 'connected',
    split_mode: 'custom',
    split_deferred: false,
  });
  expect(db.me).toMatchObject({
    nickname: '예빈',
    side: 'bride',
    birth_year: 1996,
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    allowance: 500_000,
    onboarding_step: 'P-11',
  });
  // 제안 2건: 용돈 60만, 분담 반반(적용일 10월 25일)
  expect(db.proposals).toEqual([
    expect.objectContaining({
      item: 'allowance',
      before: { allowance: 500_000 },
      after: { allowance: 600_000 },
      apply_on: '2026-10-25',
      status: 'open',
    }),
    expect.objectContaining({
      item: 'split',
      before: { mode: 'custom', starter_ratio: 60 },
      after: { mode: 'half' },
      apply_on: '2026-10-25',
      status: 'open',
    }),
  ]);
  expect(db.consents).toEqual([
    expect.objectContaining({ kind: 'space_sharing', source: 'prefill_review', agreed: true }),
  ]);
  // 안 나눈 줄 분담 다시: 찬우 60, 예빈 40
  expect(db.shares?.p_shares).toEqual([
    { account_role: 'living', amount_groom: 670_000, amount_bride: 440_000 },
    { account_role: 'goal_fund', amount_groom: 900_000, amount_bride: 600_000 },
    { account_role: 'emergency', amount_groom: 230_000, amount_bride: 160_000 },
  ]);
  expect(db.shares?.p_is_temp).toBe(false);
});
