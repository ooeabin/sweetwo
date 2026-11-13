import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';

// 월급 탭 다음 개선(20 ‘다음 개선’ 2026-11-09 검토 → round 3에서 만듦). 찬우(시작), 각자.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
type Line = { kind: string; state: string; goal_id: string | null };

// 2026-11-13 묶음 ‘모두 보냈어요’(3a)는 없앰: 주 버튼 “모두 계획대로 됐어요”가 대신(home.spec.ts)

test('W-13 저금 목록: W-02 저금 묶음 머리, 홈 저금 타일(H-09)에서 열림, 목표 금액 없는 저금, 그만 모은 저금', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const base = db.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
  db.goals.push({
    ...base,
    id: 'goal-old',
    name: '노트북',
    target_amount: null,
    deadline: null,
    closed_at: '2026-10-02T00:00:00Z',
  });
  await page.goto('/salary');
  await page.getByRole('button', { name: '저금 목록 보기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\?from=checklist$/);
  await expect(page.getByRole('heading', { name: '저금' })).toBeVisible();
  // 목표 금액이 없는 청약도 모은 금액과 함께
  await expect(page.getByRole('button', { name: /청약.*모은 금액 0원/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /내 집 마련.*0원 \/ 1억 5,000만 원/ }),
  ).toBeVisible();
  // 그만 모은 저금은 접힌 줄
  await expect(page.getByRole('button', { name: '노트북' })).toHaveCount(0);
  await page.getByRole('button', { name: '그만 모은 저금 1개' }).click();
  await expect(page.getByRole('button', { name: /노트북/ })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: /청약/ }).click();
  await expect(page.getByRole('heading', { name: '청약' })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: '저금 추가' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new\/a\?from=list$/);

  // W-01 영수증 저금 머리는 소계만(2026-11-09), 저금 목록은 W-02 저금 묶음 머리에서
  await page.goto('/salary?view=plan');
  await expect(page.locator('.hg-receipt').getByRole('heading', { name: '저금' })).toBeVisible();
  await expect(page.getByRole('button', { name: '저금 목록 보기' })).toHaveCount(0);

  // 2026-11-09 홈 허브: 저금 타일(H-09) → W-13
  await page.goto('/');
  await page.getByRole('button', { name: /^저금 (\d|아직)/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\?from=home$/);
  await expect(page.getByRole('heading', { name: '저금' })).toBeVisible();
});

test('W-10 ‘매달 95만 원씩’ 바꾸기: 이 줄 금액만 열고 바로 저장 + 되돌리기, 여유 자금 미리보기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const amountOf = () => db.splits[0]?.split_line.find((l) => l.goal_id === 'goal-h')?.amount;
  await page.goto('/salary/items/goal-h');
  await page
    .getByRole('region', { name: '매달 95만 원씩' })
    .getByRole('button', { name: '바꾸기' })
    .click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h\/edit\/monthly$/);
  await expect(page.getByRole('heading', { name: '매달 얼마씩 모을까요?' })).toBeVisible();
  // 지금 여유 자금 = 350만 − (44 + 95 + 88 + 88 + 35)만 = 0원
  await expect(page.getByText('여유 자금 0원')).toBeVisible();
  await expect(page.getByLabel('매달 얼마씩 모을까요?')).toHaveValue('950,000');
  await axe(page);
  await page.getByLabel('매달 얼마씩 모을까요?').fill('1000000');
  await expect(page.getByText('5만 원이 모자라요')).toBeVisible();
  await page.getByLabel('매달 얼마씩 모을까요?').fill('800000');
  await expect(page.getByText('여유 자금 15만 원')).toBeVisible();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('매달 금액을 바꿨어요')).toBeVisible();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
  await expect(page.getByText('매달 80만 원씩')).toBeVisible();
  expect(amountOf()).toBe(800_000);
  // 다른 줄은 그대로, 이번 달 체크 안 한 줄도 새 금액
  expect(db.splits[0]?.split_line.map((l) => l.amount)).toEqual([
    440_000, 800_000, 880_000, 880_000, 350_000,
  ]);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByText('매달 95만 원씩')).toBeVisible();
  expect(amountOf()).toBe(950_000);
});

test('W-12a 선택지 보조 한 줄 + ‘목표 금액을 새로 정할게요’ → 새 목표 금액(모은 금액보다 크게) → 기한, 되돌리기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const g = db.goals.find((x) => x.id === 'goal-e');
  if (!g) throw new Error('seed');
  Object.assign(g, { target_amount: 440_000, deadline: '2026-12-01' });
  await page.goto('/salary');
  await page.getByRole('checkbox', { name: /청약/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/achieved(\?from=checklist)?$/);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '이 저금을 어떻게 할까요?' })).toBeVisible();
  await expect(page.getByText('목표 금액만 지우고 지금처럼 모아요')).toBeVisible();
  await expect(page.getByText('월급 계획에서 빠지고 저금 내역은 남아요')).toBeVisible();
  await expect(page.getByText('모은 금액은 그대로 두고 더 큰 목표로 이어서 모아요')).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: /목표 금액을 새로 정할게요/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/amount\?retarget=1$/);
  await expect(page.getByRole('heading', { name: '새 목표 금액은 얼마예요?' })).toBeVisible();
  await expect(page.getByText('지금 모은 금액 44만 원')).toBeVisible();
  // 고르기 전이라 아직 달성 그대로
  expect(g.status).toBe('achieved');
  await page.getByLabel('새 목표 금액은 얼마예요?').fill('400000');
  await expect(page.getByText('지금 모은 금액보다 크게 넣어 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await page.getByLabel('새 목표 금액은 얼마예요?').fill('2000000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('목표 금액을 바꿨어요')).toBeVisible();
  // 기한은 지우고 기한 화면으로 이어짐
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/deadline\?first=1$/);
  expect(g).toMatchObject({ target_amount: 2_000_000, deadline: null, status: 'active' });
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => g.status).toBe('achieved');
  expect(g).toMatchObject({ target_amount: 440_000, deadline: '2026-12-01' });
});

test('홈 H-06 띠 7번 ‘첫 저금’(첫 30일)은 초대보다 먼저(초대는 맨 끝), 홈 순위 줄 없음(2026-11-11 H-04 타일 배지로)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 내 저금이 없음(첫 주: 온보딩 10월 1일, 오늘 10월 7일)
  db.goals.length = 0;
  for (const sp of db.splits) sp.split_line = sp.split_line.filter((l) => l.kind !== 'saving');
  for (const c of db.checklists)
    c.pay_check_line = (c.pay_check_line as unknown as Line[]).filter(
      (l) => l.kind !== 'saving',
    ) as never;
  await page.goto('/');
  // 첫 저금이 먼저, 초대는 다른 할 일이 없을 때만(2026-11-11 띠 닫기 없음)
  await expect(page.getByText('같이 모을 사람을 초대해 보세요')).toHaveCount(0);
  await expect(page.locator('.hg-hubband').getByRole('button', { name: '닫기' })).toHaveCount(0);
  // 홈에는 순위 줄이 없음(2026-11-11), 순위를 본 적이 없으면 자산 관리 타일 배지도 없음
  await expect(page.getByRole('button', { name: /상위 몇 %/ })).toHaveCount(0);
  await expect(page.locator('.hg-hubtile__badge')).toHaveCount(0);
  const todo = page
    .locator('.hg-hubband')
    .getByRole('button', { name: '무엇을 같이 모을지 정해 볼까요?' });
  await expect(todo).toBeVisible();
  await axe(page);
  // 체크해도 홈에 순위 줄은 없음
  await page.goto('/salary');
  await page.locator('.hg-transfer').first().getByRole('checkbox').click();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /상위 몇 %/ })).toHaveCount(0);
  await todo.click();
  await expect(page).toHaveURL(/\/salary\/items\/new\/a\?from=home$/);
  // 첫 30일이 끝나면(2026-11-13 v2.2 띠 7번) 사라지고 초대 띠(맨 끝)
  db.me.onboarding_done_at = '2026-09-01T01:00:00Z';
  await page.goto('/');
  await expect(page.getByText('무엇을 같이 모을지 정해 볼까요?')).toHaveCount(0);
  await expect(page.locator('.hg-hubband')).toContainText('같이 모을 사람을 초대해 보세요');
});

test('S-11f 저장 전 미리보기 한 줄: 다른 방식을 고르면 “{다음 시작일}부터 체크리스트가 …”', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
  };
  await page.goto('/settings/me/salary-mode');
  await expect(page.getByRole('heading', { name: '월급을 어떻게 관리해요?' })).toBeVisible();
  await expect(page.getByText(/부터 체크리스트가/)).toHaveCount(0);
  await page.getByRole('radio', { name: '합쳐서 같이 관리해요' }).click();
  // 9월 월급 기간 끝 10월 24일 → 10월 25일부터
  await expect(page.getByText('10월 25일부터 체크리스트가 하나가 돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '각자 월급을 따로 관리해요' }).click();
  await expect(page.getByText(/부터 체크리스트가/)).toHaveCount(0);
  await page.getByRole('radio', { name: '합쳐서 같이 관리해요' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  expect(db.space?.salary_mode).toBe('joint');
  // 합쳐서 → 각자 미리보기
  await page.goto('/settings/me/salary-mode');
  await page.getByRole('radio', { name: '각자 월급을 따로 관리해요' }).click();
  await expect(page.getByText(/부터 체크리스트가 사람마다 생겨요$/)).toBeVisible();
});
