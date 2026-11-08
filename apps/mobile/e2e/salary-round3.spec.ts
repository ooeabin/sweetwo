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
