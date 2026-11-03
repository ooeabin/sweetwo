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
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** O-10 → O-03 → O-06(나중에) */
async function start(page: Page) {
  await page.goto('/');
  await heading(page, '2분이면 우리의 첫 목표가 생겨요');
  await expect(page.getByText('언제든 고칠 수 있으니 편하게 적어 주세요')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '시작하기' }).click();
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  await expect(page.getByRole('progressbar', { name: '온보딩 진행' }).first()).toBeVisible();
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await heading(page, '같이 쓸 사람을 초대할까요?');
  await axe(page);
  await page.getByRole('radio', { name: '나중에 할게요' }).click();
}

test('신혼부부: 이름부터 첫 체크리스트까지 9화면, 홈에서 분배표 확인과 금액 정하기', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);

  await heading(page, '두 사람은 어떤 사이예요?');
  await page.getByRole('radio', { name: '결혼했어요' }).click();
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
  await expect(page.getByText('비상금은 자동으로 들어가요')).toHaveCount(0);
  await page.getByRole('button', { name: /내 집 마련/ }).click();
  await page.getByRole('button', { name: /여행/ }).click();
  await expect(page.getByText('2개 골랐어요')).toBeVisible();
  await axe(page);
  await expect(page.getByRole('button', { name: '+ 직접 만들기' })).toHaveCount(0);
  await next(page);

  // 목표는 고르기만: 금액·기한 질문 없이 바로 월급(2026-11-02, ADR 0004)

  // 월급까지만 묻고 끝(ADR 0005): 관리 방식, 월급 → 추천 분배표 + 첫 체크리스트 → 홈
  await heading(page, '월급을 어떻게 관리해요?');
  await expect(page.getByRole('radio', { name: /각자 월급을 따로 관리해요/ })).toBeChecked();
  await axe(page);
  await next(page);
  await heading(page, '한 달 실수령액은 얼마예요?');
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('3500000');
  await axe(page);
  await next(page);
  // 월급날은 따로 한 화면(O-32), 마지막 질문
  await heading(page, '월급날은 며칠이에요?');
  // 휠(2026-11-03): 처음 값 25일, 맨 아래 말일
  const day = page.getByRole('spinbutton', { name: '월급날은 며칠이에요?' });
  await expect(day).toHaveAttribute('aria-valuetext', '25일');
  await day.focus();
  await day.press('End');
  await expect(day).toHaveAttribute('aria-valuetext', '말일');
  await day.press('Home');
  for (let i = 1; i < 25; i++) await day.press('ArrowDown');
  await expect(day).toHaveAttribute('aria-valuetext', '25일');
  await expect(page.getByText('맨 아래에 ‘말일’도 있어요')).toBeVisible();
  await axe(page);
  await next(page);
  // O-60 준비 끝: 해 둔 것 + 홈에서 할 것, 진행 막대 없음
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('25일 월급 체크리스트를 만들었어요')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '홈으로 가기' }).click();
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
  // 추천 분배표(17 O-50 추천값): 고정지출 88만, 생활비 88만, 용돈 35만, 비상금 44만, 금액 없는 목표 0원
  expect(db.splits).toHaveLength(1);
  expect(db.splits[0]?.owner_user_id).toBe(chanwoo.id);
  expect(db.splits[0]?.split_line.map((l) => [l.kind, l.amount])).toEqual([
    ['saving', 440_000],
    ['saving', 0],
    ['saving', 0],
    ['fixed', 880_000],
    ['living', 880_000],
    ['allowance', 350_000],
  ]);
  // 비상금 목표 금액 = (고정지출 88만 + 생활비 88만) × 3
  expect(db.goals.find((g) => g.template === 'emergency')).toMatchObject({
    target_amount: 5_280_000,
    deadline: '2027-10-01',
  });
  expect(db.rpc).toContain('start_checklist');
  expect(db.checklists).toHaveLength(1);

  // 홈 할 일: 분배표 확인 → W-01을 열면 끝남
  const todo = page.getByText('추천으로 나눈 분배표를 확인해 주세요');
  await expect(todo).toBeVisible();
  await page.locator('.hg-banner--todo').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/salary\/split$/);
  await page.goto('/');
  await expect(page.getByText('추천으로 나눈 분배표를 확인해 주세요')).toHaveCount(0);

  // 홈 1순위 카드 ‘금액 정하기’ → 템플릿 질문(G-03b) → 기한(G-03c) → 목표 상세(ADR 0004)
  await page.getByRole('button', { name: '금액 정하기', exact: true }).click();
  await heading(page, '어느 정도 집을 생각하세요?');
  await page.getByLabel('어느 정도 집을 생각하세요?').fill('500000000');
  await next(page);
  await heading(page, '그중 얼마를 모아서 낼까요?');
  await next(page);
  await heading(page, '언제까지 모을까요?');
  await next(page);
  // G-03g 매달 넣는 돈(2026-11-03): 추천 = min(월 필요액, 남는 돈 95만) → 분배표 저금 줄
  await heading(page, '매달 얼마씩 넣을까요?');
  await expect(page.getByText('지금 남는 돈 95만 원')).toBeVisible();
  await expect(page.getByLabel('매달 얼마씩 넣을까요?')).toHaveValue('950,000');
  await axe(page);
  await next(page);
  await expect(page).toHaveURL(/\/goals\/[^/]+$/);
  expect(db.goals.find((g) => g.template === 'home')).toMatchObject({
    target_amount: 150_000_000,
    deadline: '2031-10-01',
  });
  const home = db.goals.find((g) => g.template === 'home');
  expect(
    db.splits[0]?.split_line.find((l) => l.kind === 'saving' && l.goal_id === home?.id)?.amount,
  ).toBe(950_000);
});

test('O-07 초대 코드 시트: 카톡 주 버튼, 링크 복사, 보내기 전엔 ‘나중에 보낼게요’, 복사하면 ‘다음’', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.clock.setFixedTime(NOW);
  await mockOnboarding(page, { now: NOW });
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await heading(page, '같이 쓸 사람을 초대할까요?');
  await page.getByRole('radio', { name: '초대하기' }).click();
  const sheet = page.getByRole('dialog', { name: '이 코드를 보내 주세요' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('눌러서 복사')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '카톡으로 보내기' })).toHaveClass(
    /hg-btn--primary/,
  );
  await expect(sheet.getByRole('button', { name: '나중에 보낼게요' })).toBeVisible();
  await axe(page);
  await sheet.getByRole('button', { name: '링크 복사' }).click();
  await sheet.getByRole('button', { name: '다음' }).click();
  await heading(page, '두 사람은 어떤 사이예요?');
});

test('O-11 아직 안 정했어요: 결혼 날짜를 묻지 않고 출생연도로, 결혼 비용 추천 없음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  await heading(page, '두 사람은 어떤 사이예요?');
  await page.getByRole('radio', { name: '아직 안 정했어요' }).click();
  await heading(page, '찬우님은 몇 년생이에요?');
  expect(db.space?.marriage_status).toBe('undecided');
  expect(db.space?.wedding_date ?? null).toBeNull();
  await next(page);
  await heading(page, '둘이 가장 먼저 이루고 싶은 건 뭐예요?');
  await expect(page.getByRole('button', { name: /결혼 비용/ })).toHaveCount(0);
  // 뒤로 가도 날짜 질문 없이 O-11
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
  await heading(page, '찬우님은 몇 년생이에요?');
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
  await heading(page, '두 사람은 어떤 사이예요?');
});

test('예비부부, 합쳐서, 월급 없음: 결혼 비용 추천과 0원 분배표', async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);

  await page.getByRole('radio', { name: '결혼 준비 중이에요' }).click();
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
  await heading(page, '월급을 어떻게 관리해요?');
  await page.getByRole('radio', { name: /합쳐서 같이 관리해요/ }).click();
  await next(page);
  await heading(page, '한 달 실수령액은 얼마예요?');
  await page.getByRole('button', { name: '지금은 월급이 없어요' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('월급이 생기면 홈에서 알려 주세요')).toBeVisible();
  await page.getByRole('button', { name: '홈으로 가기' }).click();
  await expect(page).not.toHaveURL(/onboarding/);

  expect(db.space).toMatchObject({ marriage_status: 'engaged', salary_mode: 'joint' });
  expect(db.goals.find((g) => g.template === 'wedding')).toMatchObject({ target_amount: null });
  expect(db.me).toMatchObject({ monthly_income: 0, payday: null });
  expect(db.splits[0]?.owner_user_id).toBeNull();
  expect(db.splits[0]?.split_line.every((l) => l.amount === 0)).toBe(true);
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
  await axe(page);
  await page.getByRole('button', { name: '이어서 하기' }).click();
  await expect(page).toHaveURL(/\/onboarding\/o-11$/);
  // 같은 실행 안에서는 다시 묻지 않음
  await page.evaluate(() => history.pushState({}, '', '/'));
  await page.goto('/onboarding/o-11');
  await expect(page.getByRole('heading', { name: '이어서 할까요?' })).toHaveCount(0);
});
