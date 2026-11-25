import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, emptyV22, type MemDb, mockOnboarding, seed } from './mocks';

// 첫 사용 화면 확정(2026-11-25 사용자): W-02 빈 상태 3단계, 빈 화면 다음 행동(Y-09, W-21, N-01), 홈 캘린더 타일,
// 합쳐서 엔진 오류 a(W-02 첫날 다 확인 안 뜸)·b(H-12 쓸 곳 메모 이동)·c(미계획 금액 일치). 찬우 350만 원 25일, 10월 7일.
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const PARTNER = {
  id: 'yebin',
  nickname: '예빈',
  side: 'bride',
  employment: 'regular',
  monthly_income: 2_700_000,
  payday: 10,
  payday_last: false,
  allowance: 270_000,
};

const NOTI_ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const noti = (p: Record<string, unknown>) => ({
  user_id: 'me',
  space_id: 'space-1',
  kind: 'care_day',
  target: '/calendar',
  body: null,
  push_title: null,
  push_hidden: false,
  icon: null,
  actor_id: null,
  read_at: null,
  created_at: '2026-10-07T00:48:00Z',
  ...p,
});

async function open(page: Page, prep?: (db: MemDb) => void, url = '/') {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  prep?.(db);
  await page.goto(url);
  return db;
}
const clearPlan = (db: MemDb) => {
  const list = db.checklists[0];
  if (list) list.pay_check_line = [];
};
/** 합쳐서 + 찬우가 관리(D): 공동 월급 계획·확인 목록 */
const joint = (db: MemDb) => {
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    salary_mode: 'joint',
    joint_cycle_day: 25,
    manager_user_id: chanwoo.id,
  });
  db.partner = PARTNER;
  for (const sp of db.splits) sp.owner_user_id = null;
  for (const ch of db.checklists) ch.owner_user_id = null;
  for (const g of db.goals) g.owner_user_id = null;
};

test('W-02 빈 상태: 날짜 태그 + 큰 제목 + 보조 + 번호 3단계 + 예시 판 + 아래 주 버튼 “월급 계획 세우기”', async ({
  page,
}) => {
  await open(page, clearPlan, '/salary');
  await expect(
    page.getByRole('heading', { name: '월급날마다 여기서 한 번에 확인해요' }),
  ).toBeVisible();
  await expect(page.locator('.hg-w02guide__tag')).toHaveText(/월급$/);
  await expect(page.getByText('월급 계획을 세우면 확인할 것이 생겨요')).toBeVisible();
  // 번호 3단계(순서 목록)
  const steps = page.locator('.hg-w02guide__step');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('월급을 어디에 나눌지 정해요');
  await expect(steps.nth(0)).toContainText('저축·투자, 매달 나가는 지출');
  await expect(steps.nth(1)).toContainText('월급날 이 화면에 목록이 생겨요');
  await expect(steps.nth(1)).toContainText('자동으로 나가는 건 앱이 알아서 확인해요');
  await expect(steps.nth(2)).toContainText('한 번에 ‘모두 계획대로 됐어요’');
  await expect(steps.nth(2)).toContainText('모은 금액이 바로 쌓여요');
  // 예시 판: 흐린 줄 둘
  const sample = page.getByRole('group', { name: '이렇게 보여요(예시)' });
  await expect(sample).toContainText('비상금');
  await expect(sample).toContainText('30만 원');
  await expect(sample).toContainText('월세');
  await expect(sample).toContainText('자동으로 나가요');
  // 바탕 기준: 제목 22/700, 단계 제목 17/700, 보조 13/400, 번호 원 안 15/700
  const font = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => {
        const c = getComputedStyle(el);
        return `${c.fontSize}/${c.fontWeight}`;
      });
  expect(await font('.hg-w02guide__title')).toBe('22px/700');
  expect(await font('.hg-w02guide__step-title')).toBe('17px/700');
  expect(await font('.hg-w02guide__step-sub')).toBe('13px/400');
  // 예전 한 문장 안내와 칩·수입 카드는 없음
  await expect(page.getByText('월급 계획 템플릿을 완성해 주세요')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^전체/ })).toHaveCount(0);
  // 오렌지 채움은 주 버튼뿐: 번호 원은 회색 판
  const bg = await page
    .locator('.hg-w02guide__num')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const btn = page.getByRole('button', { name: '월급 계획 세우기', exact: true });
  await expect(btn).toBeVisible();
  const btnBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe(btnBg);
  await axe(page);
  await btn.click();
  await expect(page).toHaveURL(/\/salary\/plan/);
  await expect(page.getByRole('heading', { name: '월급 계획 템플릿' })).toBeVisible();
});

test('W-02 빈 상태: 휴대폰 크기(390x844)에서 주 버튼이 화면 아래에 보이고 제목은 줄바꿈이 어색하지 않음', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, clearPlan, '/salary');
  const btn = page.getByRole('button', { name: '월급 계획 세우기', exact: true });
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
  // 제목은 두 줄 이내
  const h = await page
    .locator('.hg-w02guide__title')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeLessThanOrEqual(64);
  // 예시 판 마지막 줄이 주 버튼과 겹치지 않음
  const sample = await page.locator('.hg-w02guide__sample').boundingBox();
  expect((sample?.y ?? 0) + (sample?.height ?? 0)).toBeLessThanOrEqual(box?.y ?? 0);
  await axe(page);
});

test('W-02 월급 0원 + 계획 없음도 같은 3단계 안내(예전 “월급을 적고 …” 없음)', async ({ page }) => {
  await open(
    page,
    (db) => {
      clearPlan(db);
      Object.assign(db.me, { monthly_income: 0 });
    },
    '/salary',
  );
  await expect(
    page.getByRole('heading', { name: '월급날마다 여기서 한 번에 확인해요' }),
  ).toBeVisible();
  await expect(page.getByText('월급을 적고')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '월급 계획 세우기', exact: true })).toBeVisible();
});

test('선물 기록 빈 상태: 새 보조 문구 + 회색 “+ 기념일 적기” → 경조사 추가(Y-07)', async ({
  page,
}) => {
  await open(page, undefined, '/calendar/gifts');
  await expect(page.getByText('아직 선물 기록이 없어요')).toBeVisible();
  await expect(
    page.getByText('다가오는 생일·기념일을 먼저 적어 두면 그날 무엇을 했는지 여기에 모여요'),
  ).toBeVisible();
  const add = page.getByRole('button', { name: '+ 기념일 적기' });
  const box = await add.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  // 회색 보조 버튼(오렌지 채움 아님), 글자 700
  await expect(add).toHaveCSS('font-weight', '700');
  const bg = await add.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgb(255, 119, 22)');
  await axe(page);
  await add.click();
  await expect(page).toHaveURL(/\/calendar\/add\//);
  await expect(page.getByRole('heading', { name: '경조사 추가' })).toBeVisible();
});

test('지난 달 모아보기 빈 상태: 월급 계획이 없으면 “+ 월급 계획 세우기” → W-01, 있으면 안내 문구만', async ({
  page,
}) => {
  // 계획 있음(확인 목록에 들어갈 줄이 있음): 문구만
  await open(page, undefined, '/salary/archive');
  await expect(page.getByText('아직 지난 달 기록이 없어요')).toBeVisible();
  await expect(page.getByText('첫 월급날이 지나면 여기에 모여요')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ 월급 계획 세우기' })).toHaveCount(0);
  await axe(page);
});

test('지난 달 모아보기 빈 상태: 월급 계획이 없으면 “+ 월급 계획 세우기” → W-01', async ({
  page,
}) => {
  await open(
    page,
    (db) => {
      for (const s of db.splits) s.split_line = [];
      clearPlan(db);
    },
    '/salary/archive',
  );
  await expect(page.getByText('아직 지난 달 기록이 없어요')).toBeVisible();
  await expect(page.getByText('첫 월급날이 지나면 여기에 모여요')).toHaveCount(0);
  const add = page.getByRole('button', { name: '+ 월급 계획 세우기' });
  await expect(add).toBeVisible();
  await axe(page);
  await add.click();
  await expect(page).toHaveURL(/\/salary\/plan/);
});

test('알림이 거의 없을 때: 목록 아래 “알림 종류 고르기” → 알림 설정, 많으면 안 보임', async ({
  page,
}) => {
  const db = await open(
    page,
    (d) => {
      d.notifications.push(noti({ id: NOTI_ID(1), title: '마케팅 정보 받기에 동의했어요' }));
    },
    '/notifications',
  );
  await expect(page.getByText('마케팅 정보 받기에 동의했어요')).toBeVisible();
  const pick = page.getByRole('button', { name: '알림 종류 고르기' });
  await expect(pick).toBeVisible();
  expect((await pick.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await axe(page);
  await pick.click();
  await expect(page).toHaveURL(/\/settings\/notifications/);
  // 4개 이상이면 안 그림
  for (let i = 2; i <= 4; i++)
    db.notifications.push({
      ...db.notifications[0],
      id: NOTI_ID(i),
      title: `알림 ${i}`,
    });
  await page.goto('/notifications');
  await expect(page.getByText('알림 4')).toBeVisible();
  await expect(page.getByRole('button', { name: '알림 종류 고르기' })).toHaveCount(0);
});

test('H-12: 쓸 곳 메모가 0개면 쓸 곳 메모 추가(W-14a)로, 있으면 목록(W-14)으로', async ({
  page,
}) => {
  const db = await open(page, (d) => {
    Object.assign(d.space ?? {}, { marriage_status: 'engaged', wedding_date: '2027-03-01' });
  });
  const tile = page.getByRole('button', { name: /^결혼 준비 메모/ });
  await expect(tile.locator('.hg-hubtile__sub')).toHaveText('+ 쓸 곳 메모 추가');
  await page.waitForLoadState('networkidle');
  await tile.click();
  await expect(page).toHaveURL(/\/salary\/items\/[^/]+\/notes\/new$/);
  await expect(page.getByRole('heading', { name: '쓸 곳 메모 추가' })).toBeVisible();
  await axe(page);
  // 메모가 하나 있으면 홈에서 목록으로
  const goal = db.goals.find((g) => g.id === 'goal-h');
  (db.v22?.notes ?? []).push({
    id: 'note-1',
    space_id: 'space-1',
    goal_id: goal?.id,
    bundle_id: null,
    name: '예식장 계약금',
    amount: 3_000_000,
    due_on: '2026-12-03',
    paid: false,
    paid_at: null,
    deleted_at: null,
    created_by: chanwoo.id,
    created_at: '2026-10-05T00:00:00Z',
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^결혼 준비 메모 1개/ })).toBeVisible();
  await page.getByRole('button', { name: /^결혼 준비 메모 1개/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/[^/]+\/notes$/);
});

test('합쳐서 엔진 첫날: 손 줄이 없고 자동 줄만이면 “이번 달도 계획대로!” 다 확인 상태가 아니라 평소 목록 + “자동으로 나가는 것뿐이에요”', async ({
  page,
}) => {
  await open(
    page,
    (db) => {
      joint(db);
      for (const l of (db.checklists[0]?.pay_check_line ?? []) as Record<string, unknown>[])
        Object.assign(l, {
          auto: true,
          auto_due: '2026-09-25',
          state: 'checked',
          checked_by: null,
          checked_at: '2026-09-24T15:05:00Z',
        });
    },
    '/salary',
  );
  await expect(page.getByRole('heading', { name: '이번 달 월급 체크' }).first()).toBeVisible();
  await expect(page.getByText('이번 달은 자동으로 나가는 것뿐이에요')).toBeVisible();
  await expect(page.getByText('이번 달도 계획대로!')).toHaveCount(0);
  await expect(page.getByText('이번 달 확인 끝')).toHaveCount(0);
  await expect(page.getByText(/개 모두 확인했어요/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await expect(page.locator('.hg-transfer').first()).toContainText('자동으로 나갔어요');
  await axe(page);
});

test('손 줄을 확인해서 끝나면 다 확인 상태는 그대로(축하는 사용자가 확인했을 때만)', async ({
  page,
}) => {
  await open(
    page,
    (db) => {
      for (const l of (db.checklists[0]?.pay_check_line ?? []) as Record<string, unknown>[])
        Object.assign(l, {
          state: 'checked',
          checked_by: chanwoo.id,
          checked_at: '2026-09-26T01:00:00Z',
        });
    },
    '/salary',
  );
  await expect(page.getByText('이번 달도 계획대로!')).toBeVisible();
  await expect(page.getByText('이번 달은 자동으로 나가는 것뿐이에요')).toHaveCount(0);
});

test('미계획 금액: 합쳐서 + 한 사람 관리형에서 저축·투자 추가 머리가 월급 계획 템플릿(W-01)과 같은 값', async ({
  page,
}) => {
  const db = await open(
    page,
    (d) => {
      joint(d);
      d.goals.splice(0);
      const row = (
        id: string,
        kind: string,
        user: string | null,
        amount: number,
        sort: number,
      ) => ({
        id,
        split_id: 'split-1',
        kind,
        goal_id: null,
        user_id: user,
        name: null,
        amount,
        sort,
        in_checklist: true,
        auto_pay: kind === 'send',
        auto_day: null,
      });
      for (const sp of d.splits)
        sp.split_line = [
          row('l-a1', 'allowance', chanwoo.id, 350_000, 0),
          row('l-a2', 'allowance', 'yebin', 300_000, 1),
          row('l-send', 'send', 'yebin', 2_400_000, 2),
        ];
      for (const c of d.checklists) c.pay_check_line = [];
      Object.assign(d.me, { monthly_income: 3_500_000 });
      Object.assign(d.partner as object, { monthly_income: 2_700_000 });
    },
    '/salary/plan',
  );
  // 수입 350 + 270 = 620만, 용돈 35 + 30 = 65만, 보내기는 셈하지 않음 → 555만 원
  await expect(page.locator('.hg-plansum')).toContainText('555만 원');
  await page.goto('/salary/items/new');
  await expect(page.getByText('미계획 금액 555만 원')).toBeVisible();
  expect(db.splits.length).toBeGreaterThan(0);
  await axe(page);
});
