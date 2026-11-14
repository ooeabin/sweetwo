import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, mockOnboarding, mockSaving, newSavingDb, seed, YEBIN } from './mocks';

// v2.2 큰 흐름 한 번(ADR 0009, 2026-11-13 PR 14): 찬우·예빈 두 계정이 같은 흉내 표를 나눠 씀.
// 첫 저금이 있는 찬우(온보딩 끝) → 초대 코드 → 예빈 합류(‘저금만 같이 해요’, 합류 화면 자체는 join-replan.spec) →
// 찬우 월급날 확인 한 번 → 같이 모으기 묶음(찬우 제안, 예빈 들어가기) → 예빈 돈 들어왔어요 → 연결 해제(각자 엔진)
// → 찬우에게 내 월급 계획·내 저금이 남음.
// 관리 형태 2-5 여섯 줄: 시작 쪽 onboarding.spec(각자 따로, 생활비만, 저금만, 생활비와 저금, 한 사람, 합쳐서),
// 합류 쪽 join-replan.spec(저금만, 생활비와 저금 + 보내요, 한 사람, 합쳐서), 설정 쪽 settings.spec·settings-v22.spec.
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

test('찬우·예빈 큰 흐름: 첫 저금 → 초대 → 합류 → 월급날 확인 → 같이 모으기 → 돈 들어왔어요 → 해제 뒤 내 것은 남음', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const cCtx = await browser.newContext();
  const c = await cCtx.newPage();
  await c.clock.setFixedTime(NOW);
  const s = newSavingDb();
  const db = await mockOnboarding(c, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'not_joined', partner_nickname: null });
  db.partner = null;
  await mockSaving(c, db, s, chanwoo.id);

  // 1. 찬우 홈: 첫 저금(H-10) + 초대 띠 → 초대 코드
  await c.goto('/');
  await expect(c.locator('.hg-together').getByText('내 집 마련').first()).toBeVisible();
  await expect(c.locator('.hg-hubband')).toContainText('같이 모을 사람을 초대해 보세요');
  await c.locator('.hg-hubband').getByText('초대하기').click();
  await expect(c).toHaveURL(/\/settings\/couple/);
  // 띠 ‘초대하기’ = S-12 코드 상자를 바로 엶(?invite=1)
  await expect(c.getByRole('button', { name: /초대 코드 K 7 M 2 Q X/ })).toContainText('K7M2QX');
  await axe(c);

  // 2. 예빈 합류(서버 join_space·complete_join 결과): 각자 엔진 ‘저금만 같이 해요’, 예빈 저금 ‘결혼 비용’
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    shared_living: false,
    shared_saving: true,
    manager_user_id: null,
  });
  db.partner = { ...YEBIN_PROFILE };
  const inv = db.invites[0];
  if (inv) inv.used_at = '2026-10-07T00:30:00Z';
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
  const yCtx = await browser.newContext();
  const y = await yCtx.newPage();
  await y.clock.setFixedTime(NOW);
  const ydb = await mockOnboarding(y, { now: NOW });
  Object.assign(ydb, {
    me: {
      ...ydb.me,
      ...YEBIN_PROFILE,
      space_id: 'space-1',
      onboarding_done_at: '2026-10-07T00:40:00Z',
    },
    partner: {
      id: chanwoo.id,
      nickname: '찬우',
      side: 'groom',
      monthly_income: 3_500_000,
      payday: 25,
    },
    space: db.space,
    goals: db.goals,
    splits: db.splits,
    checklists: db.checklists,
  });
  await mockSaving(y, ydb, s, YEBIN);

  // 3. 찬우 월급날 확인 한 번(W-02 “모두 계획대로 됐어요”) → 저금 줄 95만이 모은 금액에
  await c.goto('/salary');
  await expect(c.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  await c.getByRole('button', { name: '모두 계획대로 됐어요' }).click();
  await expect(c.locator('.hg-toast')).toContainText('9월 25일 월급, 계획대로 됐어요');
  const lines = (db.checklists[0]?.pay_check_line ?? []) as Record<string, unknown>[];
  expect(lines.every((l) => l.state === 'checked')).toBe(true);

  // 4. 같이 모으기: 찬우가 예빈 저금과 묶음 → 예빈 들어가기 → 합계 = 95만 + 500만
  await c.goto('/salary/bundles/new?goal=goal-y');
  await c.getByRole('radio', { name: '내 집 마련' }).click();
  await c.getByRole('button', { name: '다음' }).click();
  await c.getByRole('button', { name: '기한 없이 모을게요' }).click();
  await c.getByRole('button', { name: '같이 모으기 시작하기' }).click();
  await expect(c).toHaveURL(/\/salary\/items\/goal-h$/);
  expect(s.bundles[0]).toMatchObject({ member_a: chanwoo.id, member_b: YEBIN });
  await y.goto('/salary/bundles/bundle-1');
  await expect(y).toHaveURL(/\/salary\/bundles\/bundle-1\/join$/);
  await y.getByRole('radio', { name: '결혼 비용' }).click();
  await y.getByRole('button', { name: '같이 모으기 시작하기' }).click();
  await expect(y).toHaveURL(/\/salary\/items\/goal-y$/);
  const yCard = y.getByRole('region', { name: '같이 모으기', exact: true });
  await expect(yCard).toContainText('595만 원');
  await axe(y);

  // 5. 예빈 돈 들어왔어요 → 결혼 비용에 50만 → 찬우 묶음 합계도 645만
  await y.getByRole('button', { name: '돈 들어왔어요' }).click();
  await y.getByLabel('얼마 들어왔어요?').fill('1000000');
  await y.getByRole('button', { name: '가족이 보태 줬어요' }).click();
  await y.getByRole('button', { name: '다음' }).click();
  await y.getByLabel('결혼 비용', { exact: true }).fill('500000');
  await y.getByRole('button', { name: '넣기', exact: true }).click();
  await expect(y.getByText('저금 1개에 50만 원 넣었어요')).toBeVisible();
  expect(s.moves).toMatchObject([{ goal_id: 'goal-y', kind: 'in', amount: 500_000 }]);
  await c.goto('/salary/items/goal-h');
  await expect(c.getByRole('region', { name: '같이 모으기', exact: true })).toContainText(
    '645만 원',
  );

  // 6. 예빈이 연결 해제를 요청 → 찬우 ‘해제할게요’ → 해제 안내(S-12h) → 시작하기 = 홈(각자 엔진은 내 것이 남음)
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending' });
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-1',
    requested_by: YEBIN,
    requested_at: '2026-10-07T01:00:00Z',
    deadline: '2026-10-21',
    ratio: 50,
    plan: [],
    status: 'pending',
    cancelled_at: null,
    confirmed_at: null,
  });
  await c.goto('/settings/couple');
  await c.getByRole('button', { name: '확인하기' }).click();
  await expect(c.getByRole('heading', { name: '예빈님이 연결 해제를 요청했어요' })).toBeVisible();
  await c.getByRole('button', { name: '해제할게요' }).click();
  await c.getByRole('alertdialog').getByRole('button', { name: '해제할게요' }).click();
  await expect(c.getByRole('heading', { name: '연결이 해제됐어요' })).toBeVisible();
  // 같이 쓰던 것(예빈 저금, 묶음)만 빠지고 내 월급 계획·확인 목록·내 저금은 남음(20261204090000 계약 1)
  expect(db.goals.map((g) => g.id)).not.toContain('goal-y');
  expect(db.goals.find((g) => g.id === 'goal-h')).toMatchObject({ bundle_id: null });
  expect(db.splits.map((x) => x.id)).toEqual(['split-1']);
  expect(db.checklists).toHaveLength(1);
  await axe(c);
  await c.getByRole('button', { name: '시작하기' }).click();
  await expect(c).toHaveURL(/\/$/);
  await expect(c.locator('.hg-together').getByText('내 집 마련').first()).toBeVisible();
  await expect(c.getByText('결혼 비용')).toHaveCount(0);

  await cCtx.close();
  await yCtx.close();
});
