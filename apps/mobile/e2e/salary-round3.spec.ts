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

test('W-02 묶음 ‘모두 보냈어요’: 쓰는 돈 체크 + 되돌리기, 저금은 더한 금액 Toast 한 번, 다 하면 W-02 끝', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const lines = () => db.checklists[0]?.pay_check_line as unknown as Line[];
  await page.goto('/salary');
  const spend = page.getByRole('button', { name: '쓰는 돈 모두 보냈어요' });
  await expect(spend).toBeVisible();
  await axe(page);
  await spend.click();
  await expect(page.getByText('쓰는 돈 3개를 체크했어요')).toBeVisible();
  expect(
    lines()
      .filter((l) => l.kind !== 'saving')
      .every((l) => l.state === 'checked'),
  ).toBe(true);
  // 남은 줄이 없으면 버튼 없음
  await expect(spend).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(spend).toBeVisible();
  expect(
    lines()
      .filter((l) => l.kind !== 'saving')
      .every((l) => l.state === 'wait'),
  ).toBe(true);

  // 저금 묶음: 청약 44만 + 내 집 마련 95만 = 139만, Toast 한 번
  await page.getByRole('button', { name: '저금 모두 보냈어요' }).click();
  await expect(page.getByText('저금 2개에 139만 원 더했어요')).toBeVisible();
  expect(
    lines()
      .filter((l) => l.kind === 'saving')
      .every((l) => l.state === 'checked'),
  ).toBe(true);
  await expect(page.getByText('95만 원 / 1억 5,000만 원')).toBeVisible();
  // 마지막 묶음까지 다 하면 W-02 끝
  await spend.click();
  await expect(page).toHaveURL(/\/salary\/done$/);
});

test('W-02 ‘모두 보냈어요’ 오프라인이면 막음, 여러 저금이 한 번에 목표 금액에 닿아도 축하는 한 번씩', async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 두 저금 모두 이번 달 줄로 목표 금액에 닿게
  Object.assign(db.goals.find((g) => g.id === 'goal-h') ?? {}, { target_amount: 950_000 });
  Object.assign(db.goals.find((g) => g.id === 'goal-e') ?? {}, { target_amount: 440_000 });
  const lines = () => db.checklists[0]?.pay_check_line as unknown as Line[];
  await page.goto('/salary');
  await expect(page.getByRole('button', { name: '저금 모두 보냈어요' })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: '저금 모두 보냈어요' }).click();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  expect(lines().every((l) => l.state === 'wait')).toBe(true);
  await context.setOffline(false);

  await page.getByRole('button', { name: '저금 모두 보냈어요' }).click();
  // 첫 항목 축하 한 번(체크 Toast는 닫힘)
  await expect(page).toHaveURL(/\/salary\/items\/goal-[eh]\/achieved$/);
  const first = /goal-e/.test(page.url()) ? 'goal-e' : 'goal-h';
  const second = first === 'goal-e' ? 'goal-h' : 'goal-e';
  await expect(page.getByText('저금 2개에')).toHaveCount(0);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '이 저금을 어떻게 할까요?' })).toBeVisible();
  // 고르지 않고 닫고 월급 탭으로 돌아오면 다른 항목 축하 한 번
  await page.goto('/salary');
  await expect(page).toHaveURL(new RegExp(`/salary/items/${second}/achieved$`));
  await page.goto('/salary');
  // 두 항목 모두 본 뒤에는 다시 축하하지 않음
  await expect(page.getByRole('button', { name: '쓰는 돈 모두 보냈어요' })).toBeVisible();
  await expect(page).toHaveURL(/\/salary$/);
  expect(
    db.goals
      .filter((g) => g.status === 'achieved')
      .map((g) => g.id)
      .sort(),
  ).toEqual(['goal-e', 'goal-h']);
});

test('W-13 저금 목록: W-02 저금 묶음 머리, W-01 저금 머리, 홈 H-02 ‘전체 보기’에서 열림, 목표 금액 없는 저금, 그만 모은 저금', async ({
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
  // 목표 금액이 없는 청약도 모은 돈과 함께
  await expect(page.getByRole('button', { name: /청약.*모은 돈 0원/ })).toBeVisible();
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

  await page.goto('/salary/split');
  await page.getByRole('button', { name: '저금 목록 보기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\?from=split$/);

  await page.goto('/');
  await page.getByRole('link', { name: '전체 보기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\?from=home$/);
  await expect(page.getByRole('heading', { name: '저금' })).toBeVisible();
});

test('W-10 ‘매달 95만 원씩’ 바꾸기: 이 줄 금액만 열고 바로 저장 + 되돌리기, 남는 돈 미리보기', async ({
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
  // 지금 남는 돈 = 350만 − (44 + 95 + 88 + 88 + 35)만 = 0원
  await expect(page.getByText('남는 돈 0원')).toBeVisible();
  await expect(page.getByLabel('매달 얼마씩 모을까요?')).toHaveValue('950,000');
  await axe(page);
  await page.getByLabel('매달 얼마씩 모을까요?').fill('1000000');
  await expect(page.getByText('5만 원이 모자라요')).toBeVisible();
  await page.getByLabel('매달 얼마씩 모을까요?').fill('800000');
  await expect(page.getByText('남는 돈 15만 원')).toBeVisible();
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

test('W-12a 선택지 보조 한 줄 + ‘목표 금액을 새로 정할게요’ → 새 목표 금액(모은 돈보다 크게) → 기한, 되돌리기', async ({
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
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/achieved$/);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '이 저금을 어떻게 할까요?' })).toBeVisible();
  await expect(page.getByText('목표 금액만 지우고 지금처럼 모아요')).toBeVisible();
  await expect(page.getByText('월급 계획에서 빠지고 모은 기록은 남아요')).toBeVisible();
  await expect(page.getByText('모은 돈은 그대로 두고 더 큰 목표로 이어서 모아요')).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: /목표 금액을 새로 정할게요/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/amount\?retarget=1$/);
  await expect(page.getByRole('heading', { name: '새 목표 금액은 얼마예요?' })).toBeVisible();
  await expect(page.getByText('지금 모은 돈 44만 원')).toBeVisible();
  // 고르기 전이라 아직 달성 그대로
  expect(g.status).toBe('achieved');
  await page.getByLabel('새 목표 금액은 얼마예요?').fill('400000');
  await expect(page.getByText('지금 모은 돈보다 크게 넣어 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await page.getByLabel('새 목표 금액은 얼마예요?').fill('2000000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('목표 금액을 바꿨어요')).toBeVisible();
  // 기한은 지우고 기한 화면으로 이어짐
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/deadline$/);
  expect(g).toMatchObject({ target_amount: 2_000_000, deadline: null, status: 'active' });
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => g.status).toBe('achieved');
  expect(g).toMatchObject({ target_amount: 440_000, deadline: '2026-12-01' });
});
