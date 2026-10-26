import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { seed } from './seed-home';
import { setWheel } from './wheel';

// 배우자 합류 재기획(18): P-03 이름 → P-03a 출생연도 → P-04 관리 방식 → P-05 월급 → P-06 분배표.
// 이 테스트의 나(로그인 계정) = 합류하는 예빈, 시작한 사람 = 찬우(분배표 비상금 44만, 내 집 마련 95만).
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
const STARTER = 'starter-chanwoo';

function joining(db: MemDb, starterReady = true) {
  seed(db);
  for (const sp of db.splits) {
    sp.owner_user_id = STARTER;
    for (const l of sp.split_line as Record<string, unknown>[])
      if (l.user_id === chanwoo.id) l.user_id = STARTER;
  }
  for (const c of db.checklists) c.owner_user_id = STARTER;
  if (!starterReady) db.splits.length = 0;
  Object.assign(db.me, {
    nickname: '예빈',
    onboarding_done_at: null,
    onboarding_step: 'P-03',
    monthly_income: null,
    payday: null,
    birth_year: null,
  });
  Object.assign(db.space ?? {}, {
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    created_by: STARTER,
  });
  db.partner = {
    id: STARTER,
    nickname: '찬우',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
  };
}

async function answerBasics(page: Page, waiting = false) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-03$/);
  await expect(page.getByRole('heading', { name: '내 이름이나 애칭을 알려 주세요' })).toBeVisible();
  await expect(page.getByText('배우자에게도 이 이름으로 보여요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '예빈님은 몇 년생이에요?' })).toBeVisible();
  await setWheel(page, '예빈님은 몇 년생이에요?', 1995);
  await page.getByRole('button', { name: '다음' }).click();
  if (!waiting)
    await expect(
      page.getByRole('heading', { name: '찬우님이 고른 월급 관리 방식이에요' }),
    ).toBeVisible();
}

async function salary(page: Page) {
  await expect(page.getByRole('heading', { name: '한 달에 월급이 얼마 들어와요?' })).toBeVisible();
  await page.getByLabel('한 달에 월급이 얼마 들어와요?').fill('2700000');
  await page.getByRole('radio', { name: '10일', exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
}

test('각자: 관리 방식 그대로 → 월급 → 내 분배표(아직 안 채운 월 필요액) → 합류 완료', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  await answerBasics(page);
  await expect(page.getByRole('radio', { name: /각자 월급을 따로 관리해요/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await salary(page);

  await expect(page.getByRole('heading', { name: '내 월급을 이렇게 나눠 볼까요?' })).toBeVisible();
  const home = page.getByRole('button', { name: /내 집 마련/ });
  await expect(home).toContainText('107만 원');
  await expect(home).toContainText('찬우님이 매달 95만 원 넣어요');
  await expect(page.getByRole('button', { name: /비상금/ })).toContainText('0원');
  await axe(page);
  await page.getByRole('button', { name: '이대로 할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  const call = db.joinCalls.find((c) => c.fn === 'complete_join');
  expect(call?.p_version).toBeUndefined();
  expect(
    (call?.p_lines as { kind: string; amount: number }[]).map((l) => [l.kind, l.amount]),
  ).toEqual([
    ['saving', 0],
    ['saving', 1_070_000],
    ['fixed', 680_000],
    ['living', 680_000],
    ['allowance', 270_000],
  ]);
  expect(db.me).toMatchObject({ birth_year: 1995, monthly_income: 2_700_000, payday: 10 });
  expect(db.space?.couple_state).toBe('connected');
});

test('합쳐서로 바꾸면 바로 적용 → 공동 분배표 다시 채우기(있던 줄 그대로, 예빈 용돈, 바뀐 줄 이전 값)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  await answerBasics(page);
  await page.getByRole('radio', { name: /합쳐서 같이 관리해요/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  expect(db.joinCalls[0]).toMatchObject({ fn: 'set_join_salary_mode', p_mode: 'joint' });
  await salary(page);

  await expect(page.getByRole('heading', { name: '같이 쓰는 분배표예요' })).toBeVisible();
  await expect(page.getByText('찬우 350만 원, 예빈 270만 원')).toBeVisible();
  const home = page.getByRole('button', { name: /내 집 마련/ });
  await expect(home).toContainText('95만 원 → ');
  await expect(page.getByRole('button', { name: /예빈 용돈/ })).toContainText('27만 원');
  await axe(page);
  await page.getByRole('button', { name: '이대로 할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.splits.find((x) => x.owner_user_id === null)?.split_line).toHaveLength(6);
});

test('시작한 사람이 아직 온보딩 중: 이름 → 출생연도 → 월급 저장 = 합류, 홈 대기, 분배표가 생기면 P-04부터', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, false);
  await answerBasics(page, true);
  await salary(page);
  await expect(page.getByText('찬우님이 시작하고 있어요')).toBeVisible();
  await expect(page.getByText('찬우님이 첫 목표를 정하면 알려 드릴게요')).toBeVisible();
  expect(db.joinCalls.at(-1)).toMatchObject({ fn: 'complete_join' });
  expect(db.me.onboarding_step).toBe('P-WAIT');
  await axe(page);

  // 찬우가 분배표를 만들면 다음에 열 때 P-04 → P-06
  seed(db);
  Object.assign(db.me, { nickname: '예빈', onboarding_step: 'P-WAIT' });
  db.partner = {
    id: STARTER,
    nickname: '찬우',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
  };
  await page.reload();
  await expect(page).toHaveURL(/\/join\/p-04$/);
});
