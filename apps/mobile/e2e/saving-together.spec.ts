import { test, expect, type Browser, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import {
  chanwoo,
  type MemDb,
  mockOnboarding,
  mockSaving,
  newSavingDb,
  notiTitles,
  type SavingDb,
  seed,
  YEBIN,
} from './mocks';

// v2.2 같이 모으기(20 W-15·W-15a·W-10 0번·W-13·W-12(묶음)·W-12b, ADR 0009 결정 5, G1·G4). 찬우(시작한 사람)와 예빈(합류한 사람) 두 계정.
// 각자 계열 연결, 찬우 ‘내 집 마련’(목표 1억 5,000만), 예빈 ‘결혼 비용’(목표 3,000만, 이미 모은 500만)
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const YEBIN_PROFILE = {
  id: YEBIN,
  nickname: '예빈',
  side: 'bride',
  employment: 'regular',
  monthly_income: 2_700_000,
  payday: 10,
  payday_last: false,
};

/** 각자 계열 연결 + 예빈 저금 ‘결혼 비용’. 두 기기가 같은 표를 나눠 씀 */
async function pair(browser: Browser, prep?: (db: MemDb, s: SavingDb) => void) {
  const cCtx = await browser.newContext();
  const yCtx = await browser.newContext();
  const c = await cCtx.newPage();
  const y = await yCtx.newPage();
  await c.clock.setFixedTime(NOW);
  await y.clock.setFixedTime(NOW);
  const s = newSavingDb();
  const db = await mockOnboarding(c, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = { ...YEBIN_PROFILE };
  const base = db.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
  db.goals.push({
    ...base,
    id: 'goal-y',
    name: '결혼 비용',
    priority: 2,
    target_amount: 30_000_000,
    deadline: null,
    start_saved: 5_000_000,
    owner_user_id: YEBIN,
    created_by: YEBIN,
  });
  db.splits.push({
    id: 'split-y',
    owner_user_id: YEBIN,
    split_line: [
      {
        id: 'split-y-0',
        split_id: 'split-y',
        kind: 'saving',
        goal_id: 'goal-y',
        amount: 500_000,
        sort: 0,
      },
    ],
  });
  prep?.(db, s);
  const ydb = await mockOnboarding(y, { now: NOW });
  Object.assign(ydb, {
    me: {
      ...ydb.me,
      ...YEBIN_PROFILE,
      space_id: 'space-1',
      onboarding_done_at: '2026-10-02T00:00:00Z',
    },
    partner: {
      id: chanwoo.id,
      nickname: '찬우',
      side: 'groom',
      monthly_income: 3_500_000,
      payday: 25,
    },
    space: { ...db.space, partner_nickname: '찬우' },
    goals: db.goals,
    splits: db.splits,
    checklists: db.checklists,
  });
  await mockSaving(c, db, s, chanwoo.id);
  await mockSaving(y, ydb, s, YEBIN);
  return { c, y, db, s, close: () => Promise.all([cCtx.close(), yCtx.close()]) };
}

test('W-15 묶기(찬우) → 들어가기(예빈): 합계만, 상대 줄은 이름만, 둘 다 켜야 각자 금액, 하나라도 켜면 둘 다 %', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { c, y, db, s, close } = await pair(browser);
  // 홈 띠 13번과 같은 주소: 상대 저금을 고른 채로
  await c.goto('/salary/bundles/new?goal=goal-y');
  await expect(c.getByRole('heading', { name: '어떤 저금으로 같이 모을까요?' })).toBeVisible();
  await axe(c);
  await c.getByRole('radio', { name: '내 집 마련' }).click();
  await expect(c.getByRole('heading', { name: '같이 모을 목표 금액이 있나요?' })).toBeVisible();
  // 처음 값 = 두 목표 금액 합(Q11)
  await expect(c.getByLabel('같이 모을 목표 금액이 있나요?')).toHaveValue('180,000,000');
  await c.getByRole('button', { name: '다음' }).click();
  await c.getByRole('button', { name: '기한 없이 모을게요' }).click();
  await expect(c.getByRole('heading', { name: '같이 모으기 전에 알려 드려요' })).toBeVisible();
  // 고지(G1): 합계로 짐작할 수 있음을 숨기지 않음
  await expect(c.getByText(/합계로 서로 얼마 넣었는지 짐작할 수 있어요/)).toBeVisible();
  await expect(c.getByRole('checkbox', { name: '퍼센트만 보여 주기' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await axe(c);
  await c.getByRole('button', { name: '같이 모으기 시작하기' }).click();
  await expect(c).toHaveURL(/\/salary\/items\/goal-h$/);
  expect(db.goals.find((g) => g.id === 'goal-h')?.bundle_id).toBe('bundle-1');
  expect(s.bundles[0]).toMatchObject({ name: '결혼 비용', target_amount: 180_000_000 });
  expect(notiTitles(s, YEBIN)).toEqual(['내 집 마련에 같이 모을까요?']);

  // 예빈: 알림 링크 → 들어가기(2~4단계)
  await y.goto('/salary/bundles/bundle-1');
  await expect(y).toHaveURL(/\/salary\/bundles\/bundle-1\/join$/);
  await y.getByRole('radio', { name: '결혼 비용' }).click();
  await expect(y.getByRole('heading', { name: '같이 모으기 전에 알려 드려요' })).toBeVisible();
  await y.getByRole('button', { name: '같이 모으기 시작하기' }).click();
  await expect(y).toHaveURL(/\/salary\/items\/goal-y$/);
  // 묶음 카드: 합계 500만, 각자 금액 줄 없음
  const card = y.getByRole('region', { name: '같이 모으기', exact: true });
  await expect(card).toContainText('500만 원');
  await expect(card).toContainText('목표 금액 1억 8,000만 원의 2%');
  await expect(card).not.toContainText('찬우');
  await axe(y);

  // 찬우 W-13: 묶음 한 줄, 펼치면 예빈 줄은 이름만(금액 없음)
  await c.goto('/salary/items');
  await c.getByRole('button', { name: '결혼 비용 펼치기' }).click();
  await expect(c.getByText('예빈님 결혼 비용')).toBeVisible();
  // 찬우 W-10의 예빈 저금: 합계만 보인다는 한 줄, 금액 칸 없음
  await c.goto('/salary/items/goal-y');
  await expect(c.getByText('예빈님 저금이에요. 같이 모으기 합계만 보여요')).toBeVisible();
  await expect(c.getByRole('region', { name: '모은 금액' })).toHaveCount(0);

  // 각자 금액: 한 사람만 켜면 아직 안 보임, 둘 다 켜야 보임
  await y.goto('/salary/bundles/bundle-1/edit');
  await y.getByRole('switch', { name: /각자 모은 금액 보여 주기/ }).click();
  await expect(y.getByRole('switch', { name: /각자 모은 금액 보여 주기/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await axe(y);
  await c.goto('/salary/items/goal-h');
  await expect(c.getByRole('region', { name: '같이 모으기', exact: true })).not.toContainText(
    '예빈 500만 원',
  );
  await c.goto('/salary/bundles/bundle-1/edit');
  await c.getByRole('switch', { name: /각자 모은 금액 보여 주기/ }).click();
  await expect(c.getByRole('switch', { name: /각자 모은 금액 보여 주기/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await c.goto('/salary/items/goal-h');
  await expect(c.getByRole('region', { name: '같이 모으기', exact: true })).toContainText(
    '찬우 0원, 예빈 500만 원',
  );

  // 퍼센트만: 찬우만 켜도 예빈 화면도 금액 대신 %
  await c.goto('/salary/bundles/bundle-1/edit');
  await c.getByRole('switch', { name: /퍼센트만 보여 주기/ }).click();
  await expect(c.getByRole('switch', { name: /퍼센트만 보여 주기/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await y.goto('/salary/items/goal-y');
  const yc = y.getByRole('region', { name: '같이 모으기', exact: true });
  await expect(yc).toContainText('2%');
  await expect(yc).not.toContainText('500만 원');
  await close();
});

test('묶음 달성(합계 기준): 두 사람 모두 W-12 한 번 → 다음엔 뭘 같이 모을까요(W-12b)', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { c, y, close } = await pair(browser, (db, s) => {
    s.bundles.push({
      id: 'bundle-1',
      name: '결혼 비용',
      target_amount: 30_000_000,
      deadline: null,
      status: 'active',
      member_a: chanwoo.id,
      member_b: YEBIN,
      show_each_a: false,
      show_each_b: false,
      percent_only_a: false,
      percent_only_b: false,
      achieved_seen: [],
    });
    for (const g of db.goals) if (g.id === 'goal-h' || g.id === 'goal-y') g.bundle_id = 'bundle-1';
  });
  // 목표 금액을 합계(500만)로 낮추면 달성
  await c.goto('/salary/bundles/bundle-1/edit/target');
  await c.getByLabel('같이 모을 목표 금액이 있나요?').fill('5000000');
  await c.getByRole('button', { name: '저장' }).click();
  await expect(c.getByText('목표 금액을 바꿨어요')).toBeVisible();
  await c.goto('/salary/items/goal-h');
  await expect(c).toHaveURL(/\/salary\/bundles\/bundle-1\/achieved$/);
  await expect(c.getByText('다 모았어요').first()).toBeVisible();
  await axe(c);
  await c.getByRole('button', { name: '다음' }).click();
  await expect(c.getByRole('heading', { name: '다음엔 뭘 같이 모을까요?' })).toBeVisible();
  // 결혼했어요 칩(19 이름 칩 표) + 직접 정할게요
  await expect(c.getByRole('radio', { name: '전세 대출 갚기' })).toBeVisible();
  await expect(c.getByRole('radio', { name: '직접 정할게요' })).toBeVisible();
  await axe(c);
  await c.getByRole('radio', { name: '여행' }).click();
  await expect(c).toHaveURL(/\/salary\/items\/new\/a\?from=next$/);
  await expect(c.getByLabel('무엇을 위해 모을까요?')).toHaveValue('여행');

  // 예빈도 한 번(알림 링크)
  await y.goto('/salary/bundles/bundle-1');
  await expect(y).toHaveURL(/\/salary\/bundles\/bundle-1\/achieved$/);
  await y.getByRole('button', { name: '다음' }).click();
  await expect(y.getByRole('heading', { name: '다음엔 뭘 같이 모을까요?' })).toBeVisible();
  // 두 번째는 축하 없이 내 저금으로
  await y.goto('/salary/bundles/bundle-1');
  await expect(y).toHaveURL(/\/salary\/items\/goal-y$/);
  await close();
});

test('W-15a 묶음 풀기: 각자 저금은 그대로', async ({ browser }) => {
  test.setTimeout(120_000);
  const { c, db, s, close } = await pair(browser, (d, sv) => {
    sv.bundles.push({
      id: 'bundle-1',
      name: '결혼 비용',
      target_amount: 180_000_000,
      deadline: null,
      status: 'active',
      member_a: chanwoo.id,
      member_b: YEBIN,
      achieved_seen: [],
    });
    for (const g of d.goals) if (g.id === 'goal-h' || g.id === 'goal-y') g.bundle_id = 'bundle-1';
  });
  await c.goto('/salary/bundles/bundle-1/edit');
  await c.getByRole('button', { name: '묶음 풀기' }).click();
  await expect(c.getByRole('alertdialog', { name: '같이 모으기를 풀까요?' })).toBeVisible();
  await c.getByRole('button', { name: '풀게요' }).click();
  await expect(c).toHaveURL(/\/salary\/items\/goal-h$/);
  await expect(c.getByText('같이 모으기를 풀었어요')).toBeVisible();
  expect(s.bundles[0]?.status).toBe('closed');
  expect(db.goals.filter((g) => g.bundle_id)).toHaveLength(0);
  await expect(c.getByRole('region', { name: '같이 모으기', exact: true })).toHaveCount(0);
  await close();
});

test('묶음 하나씩(H1): 찬우가 묶은 뒤 예빈이 자기 저금에서 묶기 → “찬우님 ‘내 집 마련’에 같이 모을까요?” → 들어가기, 새 묶음 없음', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const { c, y, db, s, close } = await pair(browser, (_d, sv) => {
    sv.bundles.push({
      id: 'bundle-1',
      name: '내 집 마련',
      target_amount: 150_000_000,
      deadline: null,
      status: 'active',
      member_a: chanwoo.id,
      member_b: YEBIN,
      show_each_a: false,
      show_each_b: false,
      percent_only_a: false,
      percent_only_b: false,
      achieved_seen: [],
    });
    for (const g of _d.goals) if (g.id === 'goal-h') g.bundle_id = 'bundle-1';
  });
  // 예빈이 찬우 저금을 열면 들어가기 버튼, ‘+ 돈 들어왔어요’는 없음(보기만)
  await y.goto('/salary/items/goal-h');
  await expect(y.getByRole('button', { name: '같이 모으기에 들어가기' })).toBeVisible();
  await expect(y.getByRole('button', { name: '돈 들어왔어요' })).toHaveCount(0);
  // 예빈 자기 저금 ⋯ 같이 모으기로 묶기 → 들어갈 묶음을 먼저 물음
  await y.goto('/salary/items/goal-y');
  await y.getByRole('button', { name: '더보기' }).click();
  await y.getByRole('menuitem', { name: '같이 모으기로 묶기' }).click();
  await expect(
    y.getByRole('heading', { name: '찬우님 ‘내 집 마련’에 같이 모을까요?' }),
  ).toBeVisible();
  await axe(y);
  await y.getByRole('radio', { name: '같이 모을게요' }).click();
  await expect(y).toHaveURL(/\/salary\/bundles\/bundle-1\/join\?goal=goal-y$/);
  await expect(y.getByRole('heading', { name: '같이 모으기 전에 알려 드려요' })).toBeVisible();
  await y.getByRole('button', { name: '같이 모으기 시작하기' }).click();
  await expect(y).toHaveURL(/\/salary\/items\/goal-y$/);
  expect(s.bundles).toHaveLength(1);
  expect(db.goals.find((g) => g.id === 'goal-y')?.bundle_id).toBe('bundle-1');

  // 찬우가 다른 저금을 또 묶으면 둘 다 든 묶음만 있으니 그대로 만듦(질문 없음)
  await c.goto('/salary/bundles/new?goal=goal-e');
  await expect(c.getByRole('heading', { name: '같이 모을 목표 금액이 있나요?' })).toBeVisible();
  await close();
});

test('묶음 하나씩(H1): 기다리는 묶음이 있으면 ‘따로 새로 모을게요’로만 새로 만듦(separate)', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { c, s, close } = await pair(browser, (_d, sv) => {
    sv.bundles.push({
      id: 'bundle-1',
      name: '내 집 마련',
      target_amount: 150_000_000,
      deadline: null,
      status: 'active',
      member_a: chanwoo.id,
      member_b: YEBIN,
      achieved_seen: [],
    });
    for (const g of _d.goals) if (g.id === 'goal-h') g.bundle_id = 'bundle-1';
  });
  await c.goto('/salary/bundles/new?goal=goal-e');
  await expect(
    c.getByRole('heading', { name: '예빈님이 아직 ‘내 집 마련’에 들어오지 않았어요' }),
  ).toBeVisible();
  await c.getByRole('radio', { name: '따로 새로 모을게요' }).click();
  await expect(c.getByRole('heading', { name: '같이 모을 목표 금액이 있나요?' })).toBeVisible();
  await c.getByRole('button', { name: '목표 금액 없이 모을게요' }).click();
  await c.getByRole('button', { name: '같이 모으기 시작하기' }).click();
  await expect(c).toHaveURL(/\/salary\/items\/goal-e$/);
  expect(s.bundles).toHaveLength(2);
  await close();
});
