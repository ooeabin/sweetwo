import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { seed } from './seed-home';

// W-01·W-02 빠진 것(20): 지난 달 보기(‹ ›, 읽기 전용), 상대가 분배표를 바꾼 안내, 배우자 탭(분배표 고치기, 내 목표 줄 잠금),
// 수입 줄 → 설정 내 월급, 직접 추가 줄 이름 바꾸기, 연결 해제 대기면 보기만. 찬우(시작), 예빈(합류), 각자.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** 예빈 합류: 예빈 분배표(내 집 마련 + 예빈 카메라(내 목표) + 생활비) */
function joinYebin(db: MemDb) {
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 270_000,
  };
  const base = db.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
  db.goals.push({
    ...base,
    id: 'goal-y',
    name: '예빈 카메라',
    template: 'hobby',
    priority: 1,
    owner_user_id: 'yebin',
    visibility: 'all',
    target_amount: 2_000_000,
  });
  db.splits.push({
    id: 'split-y',
    owner_user_id: 'yebin',
    split_line: [
      {
        id: 'y1',
        split_id: 'split-y',
        kind: 'saving',
        goal_id: 'goal-h',
        user_id: null,
        name: null,
        amount: 500_000,
        sort: 0,
      },
      {
        id: 'y2',
        split_id: 'split-y',
        kind: 'saving',
        goal_id: 'goal-y',
        user_id: null,
        name: null,
        amount: 300_000,
        sort: 1,
      },
      {
        id: 'y3',
        split_id: 'split-y',
        kind: 'living',
        goal_id: null,
        user_id: null,
        name: null,
        amount: 680_000,
        sort: 2,
      },
    ],
  });
}

test('W-02 지난 달 보기(‹ ›)와 상대가 분배표를 바꾼 안내', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  const cur = db.checklists[0] as Record<string, unknown>;
  db.checklists.push({
    ...cur,
    id: 'checklist-0',
    label: '8월 월급',
    cycle_start: '2026-08-25',
    cycle_end: '2026-09-24',
    state: 'done',
    pay_check_line: (cur.pay_check_line as Record<string, unknown>[]).map((l) => ({
      ...l,
      id: `${String(l.id)}-8`,
      state: 'checked',
      checked_by: 'yebin',
      checked_at: '2026-08-26T01:00:00Z',
    })),
  });
  Object.assign(db.splits[0] ?? {}, { updated_by: 'yebin', updated_at: '2026-10-01T03:00:00Z' });
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  await expect(
    page.getByText('예빈님이 분배표를 바꿔서 체크 안 한 줄을 다시 계산했어요'),
  ).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByText('예빈님이 분배표를 바꿔서')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음 달 보기' })).toBeDisabled();
  await page.getByRole('button', { name: '지난 달 보기' }).click();
  await expect(page.getByRole('heading', { name: '8월 월급' })).toBeVisible();
  await expect(page.getByText('08.25 ~ 09.24. 다 보냈어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다른 금액으로 보냈어요' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음 달 보기' }).click();
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
});

test('W-01 배우자 탭: 고칠 수 있고 배우자 내 목표 줄은 잠금, 수입 줄 → 내 월급, 직접 추가 줄 이름 바꾸기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  await page.goto('/salary');
  await page.getByRole('button', { name: '분배표 고치기' }).click();
  await expect(page.getByRole('heading', { name: '월급 분배표' })).toBeVisible();
  await page.getByRole('tab', { name: '예빈' }).click();
  await expect(page.getByText('월급 270만 원')).toBeVisible();
  await expect(page.getByRole('button', { name: /^예빈 카메라/ })).toHaveCount(0);
  await expect(page.getByText('예빈 카메라')).toBeVisible();
  await page.getByRole('button', { name: /^생활비/ }).click();
  await page.getByLabel('생활비 금액').fill('700000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('분배표를 바꿨어요')).toBeVisible();
  const y = db.splits.find((s) => s.owner_user_id === 'yebin');
  expect(
    (y?.split_line as Record<string, unknown>[]).find((l) => l.kind === 'living')?.amount,
  ).toBe(700_000);

  // 내 탭: 직접 추가 줄 → 이름 바꾸기, 수입 줄 → S-11
  await page.goto('/salary/split');
  await page.getByRole('button', { name: '+ 줄 추가' }).click();
  await page.getByLabel('줄 이름').fill('운동');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: /^운동/ }).click();
  await page.getByLabel('줄 이름').fill('헬스');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('button', { name: /^헬스/ })).toBeVisible();
  await page.getByRole('button', { name: /월급 350만 원/ }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
});

test('W-01 연결 해제 대기 중이면 보기만', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending' });
  await page.goto('/salary/split');
  await expect(page.getByText('연결 해제 대기 중에는 분배표를 고칠 수 없어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /^고정지출/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '추천값으로 다시 채우기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
});
