import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { mockSaving, newSavingDb, notiTitles, type SavingDb } from './saving-mock';
import { seed } from './seed-home';

// v2.2 돈 기록(20 W-20·W-20a 돈 들어왔어요, W-10b 바로잡기, W-10c 잔액 맞추기, W-14·W-14a 쓸 곳 메모, ADR 0009 결정 4, F1·F3·G7·G11).
// 찬우 ‘내 집 마련’(목표 1억 5,000만, 이미 모은 300만). 바로잡기 상대 문구는 찬우·예빈 두 계정(묶음)
const NOW = new Date('2026-10-07T10:00:00+09:00');
const YEBIN = 'yebin';
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

async function open(page: Page, url: string, prep?: (db: MemDb, s: SavingDb) => void) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const h = db.goals.find((g) => g.id === 'goal-h');
  if (h) h.start_saved = 3_000_000;
  const s = newSavingDb();
  prep?.(db, s);
  await mockSaving(page, db, s, chanwoo.id);
  await page.goto(url);
  return { db, s };
}

test('W-20 돈 들어왔어요 → W-20a 저금에 나눠 넣기: 남은 금액, 넘치면 막음, 저금 내역에 기록', async ({
  page,
}) => {
  const { s } = await open(page, '/salary/items/goal-h');
  await page.getByRole('button', { name: '돈 들어왔어요' }).click();
  await expect(page.getByRole('heading', { name: '얼마 들어왔어요?' })).toBeVisible();
  // 칩은 미리 고른 값 없음, 받은 날은 오늘
  await expect(page.getByRole('button', { name: '상여' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('받은 날 오늘')).toBeVisible();
  await page.getByLabel('얼마 들어왔어요?').fill('3000000');
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await page.getByRole('button', { name: '가족이 보태 줬어요' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '저금에 얼마씩 넣을까요?' })).toBeVisible();
  await expect(page.getByText('들어온 돈 300만 원 중 남은 300만 원')).toBeVisible();
  await page.getByLabel('내 집 마련').fill('1000000');
  await expect(page.getByText('들어온 돈 300만 원 중 남은 200만 원')).toBeVisible();
  await page.getByLabel('청약').fill('5000000');
  await expect(page.getByText('들어온 돈보다 많이 넣을 수 없어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '넣기' })).toBeDisabled();
  await page.getByLabel('청약').fill('');
  await axe(page);
  await page.getByRole('button', { name: '넣기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
  await expect(page.getByText('저금 1개에 100만 원 넣었어요')).toBeVisible();
  expect(s.moneyIns[0]).toMatchObject({ amount: 3_000_000, kind: 'family' });
  expect(s.moves).toMatchObject([
    { goal_id: 'goal-h', kind: 'in', amount: 1_000_000, money_in_id: 'in-1' },
  ]);
  await expect(page.getByText('돈 들어왔어요 100만 원')).toBeVisible();
  await expect(page.getByText('400만 원', { exact: true }).first()).toBeVisible();
});

test('W-10b 바로잡기(묶음): 사유는 나만, 예빈에게는 사람·금액·사유 없는 한 줄, 되돌리기로 한 줄도 지움(두 계정)', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const c = await (await browser.newContext()).newPage();
  const bundle = (db: MemDb, s: SavingDb) => {
    Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    db.partner = { id: YEBIN, nickname: '예빈', monthly_income: 2_700_000, payday: 10 };
    s.bundles.push({
      id: 'bundle-1',
      name: '결혼 비용',
      target_amount: 180_000_000,
      deadline: null,
      status: 'active',
      member_a: chanwoo.id,
      member_b: YEBIN,
      achieved_seen: [],
    });
    const h = db.goals.find((g) => g.id === 'goal-h');
    if (h) h.bundle_id = 'bundle-1';
  };
  const { db, s } = await open(c, '/salary/items/goal-h', bundle);
  await c.getByRole('button', { name: '더보기' }).first().click();
  await c.getByRole('menuitem', { name: '모은 금액 바로잡기' }).click();
  await expect(c.getByRole('heading', { name: '모은 금액 바로잡기' })).toBeVisible();
  await c.getByRole('radio', { name: '뺄게요' }).click();
  await expect(c.getByText('지금 모은 금액 300만 원')).toBeVisible();
  await c.getByLabel('얼마를 뺄까요?').fill('5000000');
  await expect(c.getByText('모은 금액보다 많이 뺄 수 없어요')).toBeVisible();
  await c.getByLabel('얼마를 뺄까요?').fill('300000');
  await c.getByRole('button', { name: '다음' }).click();
  await expect(c.getByRole('heading', { name: '왜 바꾸나요?' })).toBeVisible();
  await expect(c.getByText('이 내용은 나만 봐요')).toBeVisible();
  await c.getByRole('button', { name: '꺼내 썼어요' }).click();
  // 같이 모으는 저금이라 주간 요약 체크 칸(기본 끔)
  const hide = c.getByRole('checkbox', { name: '주간 요약에 넣지 않기' });
  await expect(hide).toHaveAttribute('aria-checked', 'false');
  await hide.click();
  await axe(c);
  await c.getByRole('button', { name: '바로잡기' }).click();
  await expect(c).toHaveURL(/\/salary\/items\/goal-h$/);
  await expect(c.getByText('모은 금액을 바로잡았어요')).toBeVisible();
  expect(s.moves[0]).toMatchObject({
    kind: 'out',
    amount: 300_000,
    reason_code: 'used',
    hide_from_summary: true,
  });
  // 찬우 내역: 사유가 보임
  const row = c.getByText('바로잡기 −30만 원');
  await expect(row).toBeVisible();
  await expect(c.getByText(/꺼내 썼어요/).first()).toBeVisible();
  // 예빈에게 간 한 줄: 사람·금액·사유 없음
  expect(notiTitles(s, YEBIN)).toEqual(['같이 모으기에서 꺼내 썼어요']);

  // 예빈 화면: 찬우 저금은 합계만, 내역·사유 없음
  const y = await (await browser.newContext()).newPage();
  await y.clock.setFixedTime(NOW);
  const ydb = await mockOnboarding(y, { now: NOW });
  Object.assign(ydb, {
    me: {
      ...ydb.me,
      id: YEBIN,
      nickname: '예빈',
      space_id: 'space-1',
      onboarding_done_at: '2026-10-02T00:00:00Z',
    },
    partner: { id: chanwoo.id, nickname: '찬우', monthly_income: 3_500_000, payday: 25 },
    space: { ...db.space, partner_nickname: '찬우' },
    goals: db.goals,
    splits: db.splits,
    checklists: db.checklists,
  });
  await mockSaving(y, ydb, s, YEBIN);
  await y.goto('/salary/items/goal-h');
  await expect(y.getByText('찬우님 저금이에요. 같이 모으기 합계만 보여요')).toBeVisible();
  await expect(y.getByText(/바로잡기/)).toHaveCount(0);
  await expect(y.getByText(/꺼내 썼어요/)).toHaveCount(0);
  await axe(y);

  // 찬우 되돌리기: 모은 금액이 돌아오고 예빈 한 줄도 지움
  await c.goto('/salary/items/goal-h/adjust/1');
  await c.getByRole('radio', { name: '더할게요' }).click();
  await c.getByLabel('얼마를 더할까요?').fill('100000');
  await c.getByRole('button', { name: '다음' }).click();
  await c.getByRole('button', { name: '이자가 붙었어요' }).click();
  await c.getByRole('button', { name: '바로잡기' }).click();
  await c.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => s.moves[1]?.deleted_at).toBeTruthy();
  expect(notiTitles(s, YEBIN)).toEqual(['같이 모으기에서 꺼내 썼어요']);
});

test('W-10c 실제 잔액 맞추기: 비운 칸은 그대로, 차이만큼 바로잡기', async ({ page }) => {
  const { s } = await open(page, '/salary/items');
  await page.getByRole('button', { name: '더보기' }).first().click();
  await page.getByRole('menuitem', { name: '실제 잔액과 맞추기' }).click();
  await expect(page.getByRole('heading', { name: '실제 잔액과 맞춰 볼까요?' })).toBeVisible();
  await expect(page.getByText('지금 모은 금액 300만 원')).toBeVisible();
  await page.getByLabel('내 집 마련').fill('2500000');
  await axe(page);
  await page.getByRole('button', { name: '맞추기' }).click();
  await expect(page.getByText('저금 1개를 실제 잔액과 맞췄어요')).toBeVisible();
  expect(s.moves).toMatchObject([
    { goal_id: 'goal-h', kind: 'out', amount: 500_000, reason_code: 'reconcile' },
  ]);
  expect(s.reconciledAt[chanwoo.id]).toBeTruthy();
});

test('W-14 쓸 곳 메모: 추가 → ‘냈어요’ “모은 금액에서 250만 원 뺄까요?” → 뺄게요, 되돌리기', async ({
  page,
}) => {
  const { s } = await open(page, '/salary/items/goal-h/notes');
  await expect(page.getByRole('heading', { name: '쓸 곳 메모 내 집 마련' })).toBeVisible();
  await expect(page.getByText('아직 메모가 없어요')).toBeVisible();
  await page.getByRole('button', { name: '메모 추가' }).click();
  await page.getByLabel('어디에 쓸 돈이에요?').fill('예식장 잔금');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('얼마쯤 들어요?').fill('2500000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('년', { exact: true }).fill('2026');
  await page.getByLabel('월', { exact: true }).fill('12');
  await page.getByLabel('일', { exact: true }).fill('3');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h\/notes$/);
  await expect(page.getByText('12월 3일, 250만 원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '예식장 잔금 냈어요' }).click();
  const sheet = page.getByRole('dialog', { name: '모은 금액에서 250만 원 뺄까요?' });
  await expect(sheet).toBeVisible();
  await axe(page);
  await sheet.getByRole('button', { name: '뺄게요' }).click();
  await expect(page.getByText('모은 금액에서 250만 원 뺐어요')).toBeVisible();
  expect(s.moves).toMatchObject([{ kind: 'out', amount: 2_500_000, reason_code: 'note_paid' }]);
  expect(s.notes[0]).toMatchObject({ paid: true });
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => s.notes[0]?.paid).toBe(false);
  expect(s.moves[0]?.deleted_at).toBeTruthy();
});
