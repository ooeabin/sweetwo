import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding, seed } from './mocks';

// W-02 로직 수정(2026-11-23 사용자 결정, 구역 2 케이스 점검): 파트너 보기만 화면(상태 글자·금액 숨김·빈 목록 문구),
// 자동 줄만 있는 달의 다 확인 상태, 다 확인 상태에서 새 사이클 안내 숨김, 지난 달 W-02 제목, 관리하는 사람 줄 묶음.
// 서버 쪽(늦은 확인 대기 유지, 합쳐서 수입 두 줄)은 pgTAP `w02_late_keep`, `auto_salary_income`이 맡음.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

function joinYebin(db: MemDb, income = 2_700_000) {
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: income,
    payday: 10,
    payday_last: false,
    allowance: 270_000,
  };
  db.splits.push({
    id: 'split-y',
    owner_user_id: 'yebin',
    split_line: [
      {
        id: 'y1',
        split_id: 'split-y',
        kind: 'fixed',
        goal_id: null,
        user_id: null,
        name: null,
        amount: 500_000,
        sort: 0,
      },
    ],
  });
}
function yebinList(db: MemDb, states: string[]) {
  db.checklists.push({
    id: 'checklist-y',
    split_id: 'split-y',
    owner_user_id: 'yebin',
    label: '9월 월급',
    cycle_start: '2026-09-10',
    cycle_end: '2026-10-09',
    state: 'open',
    pay_check_line: states.map((st, i) => ({
      id: `yl${i}`,
      checklist_id: 'checklist-y',
      split_line_id: 'y1',
      kind: 'fixed',
      goal_id: null,
      user_id: null,
      name: null,
      planned: 500_000,
      actual: null,
      sort: i,
      auto: false,
      state: st,
      checked_by: st === 'checked' ? 'yebin' : null,
      checked_at: st === 'checked' ? '2026-09-11T01:00:00Z' : null,
    })),
  });
}

test('파트너 보기만: 대기 줄은 회색 “대기” 글자(주황 ‘확인’ 버튼 없음), 월급 금액을 못 보면 큰 “0원”을 숨김', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db, 0);
  yebinList(db, ['wait', 'checked']);
  await page.goto('/salary?who=yebin');
  await expect(page.getByText('예빈님 월급날 확인 목록이에요. 보기만 할 수 있어요')).toBeVisible();
  await expect(page.locator('.hg-transfer__meta', { hasText: '대기' })).toHaveCount(1);
  await expect(page.locator('.hg-transfer.is-done')).toHaveCount(1);
  await expect(page.locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(page.locator('.hg-transfer__open')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /확인할 것$/ })).toHaveCount(0);
  await expect(page.locator('.hg-w02hero__amt')).toHaveCount(0);
  await expect(page.getByText('0원', { exact: true })).toHaveCount(0);
  await expect(page.getByText('2개 중 1개 확인')).toBeVisible();
  await axe(page);
});

test('파트너 보기만: 보이는 줄이 없으면(‘했어요만’ 공개 등) “아직 확인한 게 없어요”, 줄 추가 안내 없음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  yebinList(db, []);
  await page.goto('/salary?who=yebin');
  await expect(page.getByText('아직 확인한 게 없어요')).toBeVisible();
  await expect(page.getByText('월급 계획 템플릿에서 항목을 추가해 주세요')).toHaveCount(0);
  await axe(page);
});

test('자동 줄만 있는 달: 자동 줄이 모두 확인됐으면 다 확인 상태, 새 사이클 안내는 숨김 / 나가는 날 전이면 평소 목록', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const cur = db.checklists[0] as Record<string, unknown>;
  const lines = cur.pay_check_line as Record<string, unknown>[];
  // 지난 사이클이 있어야 “만들었어요” 안내가 후보가 됨
  db.checklists.push({
    ...cur,
    id: 'prev',
    label: '8월 월급',
    cycle_start: '2026-08-25',
    cycle_end: '2026-09-24',
    pay_check_line: [],
  });
  for (const l of lines)
    Object.assign(l, { auto: true, state: 'checked', checked_at: '2026-09-25T01:00:00Z' });
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '이번 달도 계획대로!' })).toBeVisible();
  await expect(page.getByText(/계획대로 월급날 확인 목록을 만들었어요/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await axe(page);
});

test('자동 줄만 있는 달: 아직 나가는 날 전인 줄이 있으면 다 확인 상태가 아님', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const cur = db.checklists[0] as Record<string, unknown>;
  const lines = cur.pay_check_line as Record<string, unknown>[];
  lines.forEach((l, i) =>
    Object.assign(l, { auto: true, state: i === 0 ? 'wait' : 'checked', auto_due: '2026-10-25' }),
  );
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '이번 달도 계획대로!' })).toHaveCount(0);
  await expect(page.locator('.hg-datepill')).toBeVisible();
  await expect(page.getByRole('group', { name: '보기 고르기' })).toBeVisible();
});

test('한 사람 관리형 관리하지 않는 쪽: 관리하는 사람 손 줄은 “{이름}님이 확인해요” 묶음(대기 글자), 주 버튼은 내 손 줄이 없으면 숨김', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joinYebin(db);
  Object.assign(db.space ?? {}, { salary_mode: 'joint', manager_user_id: 'yebin' });
  const cur = db.checklists[0] as Record<string, unknown>;
  Object.assign(cur, { owner_user_id: null });
  const lines = cur.pay_check_line as Record<string, unknown>[];
  // 관리하는 사람(예빈)이 아닌 내 줄은 자동 줄 하나, 나머지 손 줄은 모두 예빈이 확인할 것
  lines.forEach((l, i) =>
    Object.assign(
      l,
      i === 0
        ? { auto: true, state: 'checked', user_id: String(db.me.id) }
        : { auto: false, state: 'wait', user_id: null },
    ),
  );
  await page.goto('/salary');
  const group = page.getByRole('region', { name: '예빈님이 확인해요' });
  await expect(group).toBeVisible();
  await expect(group.locator('.hg-transfer__meta', { hasText: '대기' }).first()).toBeVisible();
  await expect(group.locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await axe(page);
});
