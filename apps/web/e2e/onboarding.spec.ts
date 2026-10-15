import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding } from './onboarding-mock';

// 온보딩 처음부터 끝까지(docs/spec/16-onboarding-1.md, 17-onboarding-2.md). 찬우가 처음 시작하고 예빈은 아직 미합류.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const next = (page: Page) => page.getByRole('button', { name: '다음' }).click();
// 기획서 예시 날짜: 25일 기준, 10월 7일 → 9월 월급 플랜 남은 18일
const NOW = new Date('2026-10-07T10:00:00+09:00');

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

test('신혼부부: 호칭부터 첫 월급 플랜까지', async ({ page }) => {
  // 기획서 예시 날짜: 25일 기준, 10월 7일 시작 → 9월 월급 플랜 남은 18일
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
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

  // 파트 3 소득·지출(기획서 예시값: 찬우 350만, 25일, 예빈 추정 250만, 고정 100만 + 대출 30만, 생활비 130만)
  await heading(page, '찬우님은 한 달에 얼마 받으세요?');
  await axe(page);
  await page.getByLabel('찬우님은 한 달에 얼마 받으세요?').fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await page.getByRole('radio', { name: '25일' }).click();
  await axe(page);
  await next(page);
  await heading(page, '예빈님 수입을 대략 알면 골라주세요');
  await page.getByRole('radio', { name: '200~300만' }).click();

  await heading(page, '매달 꼭 나가는 돈을 골라주세요');
  await page.getByRole('button', { name: '주거', exact: true }).click();
  await page.getByRole('button', { name: '관리비' }).click();
  await page.getByRole('button', { name: '공과금' }).click();
  await page.getByRole('button', { name: '통신' }).click();
  await expect(page.getByText('3개 골랐어요')).toBeVisible();
  await axe(page);
  await next(page);
  await heading(page, '같이 내는 돈은 한 달에 얼마예요?');
  await page.getByLabel('같이 내는 돈은 한 달에 얼마예요?').fill('1000000');
  await next(page);
  await heading(page, '식비·생활용품 등에는 한 달에 얼마쯤 쓰세요?');
  await page.getByLabel('식비·생활용품 등에는 한 달에 얼마쯤 쓰세요?').fill('1300000');
  await next(page);
  await heading(page, '갚고 있는 대출이 있다면 한 달에 모두 얼마씩 갚아요?');
  await page.getByLabel('갚고 있는 대출이 있다면 한 달에 모두 얼마씩 갚아요?').fill('300000');
  await next(page);

  // 파트 5 용돈·분담(용돈 각자 50만 → 공동자금 500만, 버는 만큼 292만 : 208만)
  await heading(page, '찬우님 용돈은 한 달에 얼마로 할까요?');
  await expect(page.getByText('예빈님 용돈도 같은 금액으로 계산해 둘게요')).toBeVisible();
  await expect(page.getByRole('button', { name: '나중에 할게요' })).toBeVisible();
  await page.getByLabel('찬우님 용돈은 한 달에 얼마로 할까요?').fill('500000');
  await next(page);
  await heading(page, '같이 쓰는 돈은 어떻게 나눌까요?');
  await expect(page.getByText('한 달 500만 원을 두 분이 나눠 넣어요')).toBeVisible();
  const byIncome = page.getByRole('radio', { name: /버는 만큼/ });
  await expect(byIncome).toContainText('추정');
  await expect(byIncome).toContainText('292만 원');
  await expect(byIncome).toContainText('208만 원');
  await axe(page);
  await page.getByRole('radio', { name: '직접 정할게요' }).click();
  await page.getByRole('slider').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('찬우 60%')).toBeVisible();
  await expect(page.getByText('300만 원', { exact: true })).toBeVisible();
  await next(page);

  // 파트 6 결과: O-61 분석 중 → O-62 요약(저축 가능 = 600 − 100 − 260 = 240만)
  await heading(page, '두 분의 돈 흐름을 정리하고 있어요');
  await heading(page, '두 분은 한 달에 240만 원을 모을 수 있어요');
  await expect(page.getByText('임시 플랜')).toBeVisible();
  await expect(page.getByText('예빈님이 합류하면 다시 계산돼요')).toBeVisible();
  await expect(page.getByText('예빈님이 합류하면 여기서 월급을 나눠요')).toBeVisible();
  await expect(page.getByText('600만 원은 이렇게 나뉘어요')).toBeVisible();
  await axe(page);
  await next(page);

  // O-63 통장 구조: 역할별로 나눔, 생활비는 쓰던 통장, 나머지는 새로
  await heading(page, '통장을 어떻게 쓰고 있어요?');
  await page.getByRole('radio', { name: '역할별로 나눠 쓸래요' }).click();
  await heading(page, '통장을 이렇게 나눠 쓸까요?');
  await expect(page.getByRole('button', { name: '260만 원/월' })).toBeVisible();
  const which = (role: string) =>
    page.getByRole('radiogroup', { name: `${role} 어느 통장으로 쓸까요` });
  await which('공동 생활비').getByRole('radio', { name: '쓰던 통장이 있어요' }).click();
  await page.getByLabel('공동 생활비 통장 이름').fill('생활비 통장');
  await page.getByLabel('공동 생활비 지금 잔액').fill('1200000');
  await which('목표자금')
    .getByRole('radio', { name: /새로 만들 거예요/ })
    .click();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await which('비상금')
    .getByRole('radio', { name: /새로 만들 거예요/ })
    .click();
  await expect(page.getByText('예빈 50만 원 (가정)')).toBeVisible();
  await expect(page.getByText('매달 25일 기준')).toBeVisible();
  await axe(page);
  await next(page);

  // O-64: 비상금 = (130 + 130) × 3 = 780만, 12개월 → 65만. 내 집은 250만이 필요한데 175만만 남아 부족
  await heading(page, '목표는 이렇게 모아요');
  await expect(page.getByText('65만 원/월')).toBeVisible();
  await expect(page.getByText('175만 원/월')).toBeVisible();
  await expect(page.getByText('내 집 마련은 기한까지 조금 부족해요')).toBeVisible();
  await expect(page.getByText('금액을 정하면 계산돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: /지출 줄이기/ }).click();
  await expect(page.getByText('250만 원/월')).toBeVisible();
  await expect(page.getByText('내 집 마련은 기한까지 조금 부족해요')).toBeHidden();
  await next(page);

  // O-65: 저축률 52.5%, 대출 5%, 고정 21.7% 모두 양호. 비상금, 투자 원칙은 아직 몰라요
  await heading(page, '지금 흐름이 좋아요');
  await expect(page.getByText('아직 몰라요')).toHaveCount(2);
  await expect(page.getByText('자산 정리하기')).toBeVisible();
  await expect(page.getByText('투자 원칙 정하기')).toBeVisible();
  await axe(page);
  await next(page);

  // O-66: 생활비 185만(100 + 30 + 55), 목표 250만, 비상금 65만 × 18/30 → 111 + 150 + 39 = 300만
  await heading(page, '이대로 시작할까요?');
  await expect(page.getByText('매달 25일')).toBeVisible();
  await expect(page.getByText('찬우님 월급날')).toBeVisible();
  await expect(page.getByText('9월 월급 플랜')).toBeVisible();
  await expect(page.getByText('18일 남음')).toBeVisible();
  await expect(page.getByLabel('이번 달 옮길 수 있는 돈')).toHaveValue(/3,?000,?000/);
  await expect(page.getByRole('button', { name: '예빈님 초대하기' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '시작하기' }).click();

  // O-67 첫 미션 → 이번 달
  await heading(page, '9월 월급 플랜을 시작했어요');
  await expect(page.getByText('양가 명절·생신도 미리 챙겨볼까요?')).toBeVisible();
  await expect(page.getByRole('button', { name: '뒤로' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '나중에 할게요' }).click();

  // 이번 달(H-01): 미합류라 월급 나누기 대신 지출 적기, 생활비 55만(O-64에서 줄임)
  await heading(page, '찬우님, 이번 달 생활비가 55만 원 남았어요');
  await expect(page.locator('.hg-today__date')).toHaveText('10월 7일 수요일');
  await expect(page.getByRole('button', { name: '지출 적기' })).toBeVisible();
  await expect(page.getByText('아직 몰라요')).toBeVisible();
  await expect(page.getByRole('heading', { name: /9월 월급 플랜/ })).toContainText('임시');
  const planRows: [string, string][] = [
    ['공동 생활비', '111만 원'],
    ['목표자금', '150만 원'],
    ['비상금', '39만 원'],
    ['용돈', '60만 원'], // 각자 50만 × 18/30
  ];
  for (const [label, value] of planRows)
    await expect(page.locator('.hg-listrow', { hasText: label }).first()).toContainText(value);
  await expect(page.getByText('9월 월급 플랜 정리할 때예요').first()).toBeVisible();
  await expect(page.getByText('찬우님 월급날')).toBeVisible();
  await expect(page.getByRole('img', { name: '내 집 마련 0%' })).toBeVisible();
  await axe(page);
  // 금액 가리기
  await page.getByRole('button', { name: '금액 가리기' }).first().click();
  await heading(page, '찬우님, 이번 달 생활비가 ••• 남았어요');
  await expect(page.getByText('111만 원')).toHaveCount(0);
  expect(db.me.onboarding_done_at).toBeTruthy();
  expect(db.accounts.map((a) => [a.role, a.name, a.is_existing, a.start_balance])).toEqual([
    ['living', '생활비 통장', true, 1_200_000],
    ['goal_fund', '목표자금 통장', false, 0],
    ['emergency', '비상금 통장', false, 0],
  ]);
  const goalId = (t: string) => db.goals.find((x) => x.template === t && !x.deleted_at)?.id;
  const plan = db.plans[0]?.args;
  expect(plan).toMatchObject({
    p_label_month: '2026-09-01',
    p_cycle_start: '2026-09-25',
    p_cycle_end: '2026-10-24',
    p_first_adjust: 3_000_000,
    p_merged_close: false,
    p_is_temp: true,
  });
  expect(plan?.p_lines).toEqual([
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
    { target: 'goal', goal_id: goalId('emergency'), amount: 390_000 },
    { target: 'goal', goal_id: goalId('home'), amount: 1_500_000 },
  ]);
  const g = (t: string) => db.goals.find((x) => x.template === t && !x.deleted_at);
  expect(g('emergency')).toMatchObject({
    priority: 0,
    target_amount: 7_800_000, // O-61에서 비상금 기준으로 맞춤
    amount_estimated: false,
  });
  expect(g('home')).toMatchObject({ priority: 1, target_amount: 150_000_000, kind: 'once' });
  expect(String(g('home')?.deadline)).toMatch(/^20\d\d-\d\d-01$/);
  expect(g('travel')).toMatchObject({ priority: 2 });
  expect(db.me).toMatchObject({
    nickname: '찬우',
    side: 'groom',
    birth_year: 1994,
    employment: 'regular',
    monthly_income: 3_500_000,
    income_variable: false,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
  });
  expect(db.space).toMatchObject({
    partner_nickname: '예빈',
    marriage_status: 'married',
    wedding_date: '2025-05-17',
    housing: 'jeonse',
    child_plan: 'in_1_3y',
    partner_income: 2_500_000,
    partner_income_estimated: true,
    fixed_total: 1_000_000,
    living_budget: 550_000, // O-64 ‘지출 줄이기’로 75만 줄임
    loan_repayment: 300_000,
    split_mode: 'custom',
    split_ratio: 60,
    split_deferred: false,
  });
  expect(db.fixed.filter((r) => !r.deleted_at).map((r) => `${r.group_key}/${r.name}`)).toEqual([
    'housing/관리비',
    'utilities/공과금',
    'telecom/통신',
  ]);
});

test('예비부부 각자 관리: 결혼 비용 목표만, 비상금 없음', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
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

  // 파트 3: 각자 관리 예비부부는 고정지출·생활비·대출·용돈을 건너뛴다
  await heading(page, '찬우님은 한 달에 얼마 받으세요?');
  await page.getByLabel('찬우님은 한 달에 얼마 받으세요?').fill('2800000');
  await next(page);
  await page.getByRole('radio', { name: '말일' }).click();
  await next(page);
  await page.getByRole('radio', { name: '잘 모르겠어요' }).click();

  await heading(page, '결혼 비용은 어떻게 나눌까요?');
  await expect(page.getByText(/^한 달 .+만 원을 두 분이 나눠 넣어요$/)).toBeVisible();
  const byIncome = page.getByRole('radio', { name: /버는 만큼/ });
  await expect(byIncome).toHaveAttribute('aria-disabled', 'true');
  await expect(byIncome).toContainText('예빈님 수입을 알면 계산돼요');
  await axe(page);
  await page.getByRole('radio', { name: /반반/ }).click();

  // 결과: 결혼 비용 하나만
  await heading(page, /^결혼 비용으로 한 달에 .+만 원씩 모아요$/);
  await expect(page.getByText('임시 플랜')).toBeVisible();
  await axe(page);
  await next(page);
  await heading(page, '결혼 준비 통장을 하나 정해요');
  await page.getByRole('radio', { name: /새로 만들 거예요/ }).click();
  await axe(page);
  await next(page);
  await heading(page, '목표는 이렇게 모아요');
  await expect(page.getByText('결혼 비용', { exact: true })).toBeVisible();
  await expect(page.getByText('비상금', { exact: true })).toBeHidden();
  await next(page);
  await expect(page.getByText('아직 몰라요').first()).toBeVisible();
  await next(page);
  await heading(page, '이대로 시작할까요?');
  await expect(page.getByText('매달 말일')).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();
  await heading(page, '9월 월급 플랜을 시작했어요');
  await expect(page.getByText('결혼 비용 항목부터 나눠볼까요?')).toBeVisible();
  await page.getByRole('button', { name: '지금 하기' }).click();

  // 예비부부 이번 달(H-P): 예식일 미정이라 예정 월 + 추정, 모으기, 결혼 비용 현황
  await heading(page, /2027년 5월 예정/);
  await expect(page.getByRole('heading', { name: '이번 달 모으기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '결혼 비용 현황' })).toBeVisible();
  await expect(page.locator('.hg-listrow', { hasText: '총예산' })).toContainText('4,000만 원');
  await expect(page.getByRole('heading', { name: /월급 플랜/ })).toHaveCount(0);
  await axe(page);
  expect(db.accounts.map((a) => [a.role, a.name])).toEqual([['wedding', '결혼 준비 통장']]);
  expect(db.plans[0]?.args).toMatchObject({
    p_cycle_start: '2026-09-30',
    p_cycle_end: '2026-10-30',
  });
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
    partner_income: null,
    partner_income_unknown: true,
    fixed_total: null,
    split_mode: 'half',
  });
  expect(db.me).toMatchObject({ monthly_income: 2_800_000, payday: null, payday_last: true });
  expect(db.fixed).toEqual([]);
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

test('O-33 배우자 수입: 정확히 알면 금액으로, 추정 없이 저장', async ({ page }) => {
  const db = await mockOnboarding(page);
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    birth_year: 1994,
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    onboarding_step: 'O-33',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: null,
    partner_income_estimated: false,
    partner_income_unknown: false,
    fixed_total: null,
  };
  await page.goto('/onboarding/o-33');
  await heading(page, '예빈님 수입을 대략 알면 골라주세요');
  await page.getByRole('radio', { name: '정확히 알아요' }).click();
  await page.getByLabel('예빈님 한 달 실수령').fill('2730000');
  await expect(page.getByText('273만 원', { exact: true })).toBeVisible();
  await axe(page);
  await next(page);
  await heading(page, '매달 꼭 나가는 돈을 골라주세요');
  expect(db.space).toMatchObject({
    partner_income: 2_730_000,
    partner_income_estimated: false,
    partner_income_unknown: false,
  });
});
