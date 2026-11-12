import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { seed } from './seed-home';

// W-01·W-02 빠진 것(20): 지난 달 보기(‹ ›, 읽기 전용), 상대가 월급 계획을 바꾼 안내, 파트너 탭(보기만, 2026-11-09),
// 수입 줄 → 설정 내 월급, 직접 추가 줄 이름 바꾸기, 연결 해제 대기면 보기만. 찬우(시작), 예빈(합류), 각자.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** 예빈 합류: 예빈 월급 계획(내 집 마련 + 예빈 카메라(예빈 저금) + 생활비) */
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

test('W-02 지난 달 보기(‹ ›)와 상대가 월급 계획을 바꾼 안내', async ({ page }) => {
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
    page.getByText('예빈님이 월급 계획을 바꿔서 체크 안 한 줄을 다시 계산했어요'),
  ).toBeVisible();
  await axe(page);
  // 지난 달이 있어 새 사이클 한 줄도 있음(2026-11-09): 안내마다 ×
  await page
    .locator('.hg-row', { hasText: '예빈님이 월급 계획을 바꿔서' })
    .getByRole('button', { name: '닫기' })
    .click();
  await expect(page.getByText('예빈님이 월급 계획을 바꿔서')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음 달 보기' })).toBeDisabled();
  await page.getByRole('button', { name: '지난 달 보기' }).click();
  await expect(page.getByRole('heading', { name: '8월 월급' })).toBeVisible();
  // 지난 달은 막대 아래 끝남 한 줄 + 줄은 읽기 전용(2026-11-12 결과 카드 대신: 체크 칸은 누를 수 없고 시트 없음)
  await expect(page.getByText('08.25 ~ 09.24', { exact: true })).toBeVisible();
  await expect(page.locator('.hg-planbar__title')).toContainText('8월 월급 체크를');
  await expect(page.locator('.hg-transfer').first()).toBeVisible();
  await expect(page.locator('.hg-transfer__open')).toHaveCount(0);
  for (const c of await page.getByRole('checkbox').all()) await expect(c).toBeDisabled();
  await page.getByRole('button', { name: '다음 달 보기' }).click();
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
});

test('W-01 파트너 탭은 보기만(2026-11-09): 회색 한 줄, 줄마다 자물쇠, 편집·추천값·추가 없음 / 내 탭은 고침, 큰 금액 → 내 월급, 직접 추가 줄 이름 바꾸기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  await page.goto('/salary');
  await page.getByRole('button', { name: '월급 계획 고치기' }).click();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '예빈' }).click();
  await expect(page.locator('.hg-receipt__amount')).toHaveText('270만 원');
  await expect(page.getByText('예빈님 월급 계획이에요. 보기만 할 수 있어요')).toBeVisible();
  // 줄은 누를 수 없고 자물쇠
  await expect(page.getByRole('button', { name: /^생활비/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^예빈 카메라/ })).toHaveCount(0);
  await expect(page.locator('.hg-receipt__lock')).toHaveCount(3);
  for (const n of ['추천값으로 다시 채우기', '+ 지출 추가', '편집하기'])
    await expect(page.getByRole('button', { name: n })).toHaveCount(0);
  await axe(page);
  const y = db.splits.find((s) => s.owner_user_id === 'yebin');
  expect(
    (y?.split_line as Record<string, unknown>[]).find((l) => l.kind === 'living')?.amount,
  ).toBe(680_000);

  // 내 탭: 직접 추가 줄 → 이름 바꾸기, 큰 금액 → S-11
  await page.getByRole('tab', { name: '찬우' }).click();
  await page.getByRole('button', { name: '+ 지출 추가' }).click();
  await page.getByRole('textbox', { name: '줄 이름' }).fill('운동');
  await page.getByRole('textbox', { name: '줄 이름' }).press('Enter');
  await page.getByRole('button', { name: '추가하기' }).click();
  await page.getByRole('button', { name: /^운동/ }).click();
  await page.getByRole('dialog').getByLabel('줄 이름').fill('헬스');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.getByRole('button', { name: /^헬스/ })).toBeVisible();
  await page.getByRole('button', { name: /월급 350만 원/ }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
});

test('W-02 파트너 탭은 보기만(2026-11-09): 회색 한 줄, 체크한 줄은 취소선 없이 흐린 글자 + 체크 표시', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  const ys = db.splits.find((x) => x.owner_user_id === 'yebin');
  db.checklists.push({
    id: 'checklist-y',
    split_id: 'split-y',
    owner_user_id: 'yebin',
    label: '9월 월급',
    cycle_start: '2026-09-10',
    cycle_end: '2026-10-09',
    state: 'open',
    pay_check_line: (ys?.split_line ?? []).map((l, i) => ({
      ...l,
      id: `${String(l.id)}-c`,
      planned: l.amount,
      actual: null,
      state: i === 2 ? 'checked' : 'wait',
      checked_by: i === 2 ? 'yebin' : null,
      checked_at: i === 2 ? '2026-09-11T01:00:00Z' : null,
    })),
  });
  await page.goto('/salary?who=yebin');
  await expect(page.getByText('예빈님 체크리스트예요. 보기만 할 수 있어요')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const done = page.locator('.hg-transfer.is-view.is-done').first();
  await expect(done).toBeVisible();
  await expect(done.locator('.hg-transfer__label')).toHaveCSS('text-decoration-line', 'none');
  await expect(done.locator('.hg-transfer__state .hg-ico--check')).toHaveCount(1);
  await axe(page);
  // 첫 저금 빈 줄은 파트너 탭에 없음
  await expect(page.getByRole('button', { name: /저금 추가 \(여유 자금/ })).toHaveCount(0);
  // 고치는 것 없음(2026-11-09 round 3): ‘월급 계획 고치기’, 묶음 ‘모두 보냈어요’
  await expect(page.getByRole('button', { name: '월급 계획 고치기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /모두 보냈어요/ })).toHaveCount(0);
  // 내 탭으로 돌아가면 있음
  await page.getByRole('tab', { name: '찬우' }).click();
  await expect(page.getByRole('button', { name: '월급 계획 고치기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '지출 모두 보냈어요' })).toBeVisible();
});

test('W-01 연결 해제 대기 중이면 보기만', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending' });
  await page.goto('/salary/split');
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  await expect(page.getByText('연결 해제 대기 중에는 월급 계획을 고칠 수 없어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /^고정지출/ })).toHaveCount(0);
  for (const n of ['추천값으로 다시 채우기', '편집하기', '+ 지출 추가', '+ 저금 추가'])
    await expect(page.getByRole('button', { name: n })).toHaveCount(0);
});
