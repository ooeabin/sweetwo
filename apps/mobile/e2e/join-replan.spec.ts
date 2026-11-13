import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, SB } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { seed } from './seed-home';
import { setWheel } from './wheel';

// 파트너 합류 재기획(18): P-03 이름 → P-04 관리 방식 → P-05 월급 → P-05b 월급날(P-06 월급 계획은 추천값으로 자동).
// 2026-11-11 P-03a 출생연도를 뺌: 합류한 사람도 출생연도는 자산 순위 F-08 ‘출생연도 알려 주기’ → S-11i에서.
// 이 테스트의 나(로그인 계정) = 합류하는 예빈, 시작한 사람 = 찬우(월급 계획 저금 항목 청약 44만, 내 집 마련 95만).
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

/** 진행 막대 칸: 넓은 창은 칸 수(aria-valuenow/max = 칸), 좁은 창은 %라 비율로 봄 */
async function expectStep(page: Page, done: number, total: number) {
  const bar = page.getByRole('progressbar');
  await expect
    .poll(async () => {
      const now = Number(await bar.getAttribute('aria-valuenow'));
      const max = Number(await bar.getAttribute('aria-valuemax'));
      return max ? now / max : -1;
    })
    .toBeCloseTo(done / total, 1);
}

async function answerBasics(page: Page, waiting = false) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-03$/);
  await expect(page.getByRole('heading', { name: '내 이름이나 애칭을 알려 주세요' })).toBeVisible();
  await expect(page.getByText('파트너에게도 이 이름으로 보여요')).toBeVisible();
  await axe(page);
  // 진행 막대 4칸 중 1칸(P-03a 뺌). 시작한 사람이 아직 온보딩 중이면 3칸(2026-11-11 S3-24)
  await expectStep(page, 1, waiting ? 3 : 4);
  await page.getByRole('button', { name: '다음' }).click();
  // 출생연도는 묻지 않음(2026-11-11): 이름 다음은 P-04(시작한 사람이 온보딩 중이면 P-05)
  await expect(page).toHaveURL(waiting ? /\/join\/p-05$/ : /\/join\/p-04$/);
  await expect(page.getByRole('heading', { name: /몇 년생이에요/ })).toHaveCount(0);
  if (!waiting)
    await expect(
      page.getByRole('heading', { name: '찬우님이 고른 월급 관리 방식이에요' }),
    ).toBeVisible();
}

/** 합류 축하(P-10, 2026-11-11 D7): 축하 배경 + 그림 자리 + “찬우님과 연결됐어요” → 홈(웹은 푸시 질문 없음) */
async function celebrate(page: Page, help = '이제 월급과 저금을 같이 봐요') {
  await expect(page).toHaveURL(/\/join\/p-10$/);
  await expect(page.getByRole('heading', { name: '찬우님과 연결됐어요' })).toBeVisible();
  await expect(page.getByText(help)).toBeVisible();
  await expect(page.locator('main.hg-celebrate-bg')).toHaveCount(1);
  await axe(page);
  await page.getByRole('button', { name: '홈으로 가기' }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function salary(page: Page) {
  await expect(page.getByRole('heading', { name: '한 달 실수령액은 얼마예요?' })).toBeVisible();
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('2700000');
  await page.getByRole('button', { name: '다음' }).click();
  // 월급날은 따로 P-05b(2026-11-03), 휠 25일에서 시작 → 10일
  await expect(page.getByRole('heading', { name: '월급날은 며칠이에요?' })).toBeVisible();
  const day = page.getByRole('spinbutton', { name: '월급날은 며칠이에요?' });
  await expect(day).toHaveAttribute('aria-valuetext', '25일');
  await day.focus();
  for (let i = 0; i < 15; i++) await day.press('ArrowUp');
  await expect(day).toHaveAttribute('aria-valuetext', '10일');
  await page.getByRole('button', { name: '다음' }).click();
}

test('각자: 관리 방식 그대로 → 월급 → 월급날 → 추천 월급 계획(저금 줄 없음, ADR 0007)로 합류 완료 → 홈 할 일', async ({
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

  // 월급 계획 화면 없이 합류 축하(P-10, 2026-11-11 D7) → 홈. 홈 할 일 ‘월급 계획 확인’은 없앰(2026-11-03)
  await celebrate(page);
  await expect(page.getByText('추천으로 나눈 월급 계획을 확인해 주세요')).toHaveCount(0);
  const call = db.joinCalls.find((c) => c.fn === 'complete_join');
  expect(call?.p_version).toBeUndefined();
  expect(
    (call?.p_lines as { kind: string; amount: number }[]).map((l) => [l.kind, l.amount]),
  ).toEqual([
    ['fixed', 680_000],
    ['living', 680_000],
    ['allowance', 270_000],
  ]);
  expect(db.me).toMatchObject({ birth_year: null, monthly_income: 2_700_000, payday: 10 });
  expect(db.space?.couple_state).toBe('connected');

  // 출생연도는 자산 순위(F-08)를 처음 열 때 물음: ‘출생연도 알려 주기’ → S-11i → F-08(시작한 사람과 같음).
  // 순위는 자산이 있어야 보여서 공동 통장 하나
  db.assets.push({
    id: 'join-a1',
    side: 'asset',
    grp: 'cash',
    kind: 'bank',
    name: '생활비 통장',
    amount: 30_000_000,
    owner: 'joint',
    owner_user_id: null,
    created_by: STARTER,
    principal: null,
    rate_estimated: false,
    maturity_date: null,
    monthly_payment: null,
    interest_rate: null,
    paid_count: null,
    pay_from: null,
    goal_id: null,
    estimated: false,
    visibility: 'all',
    status: 'held',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });
  await page.goto('/assets/rank');
  const ask = page.getByRole('button', { name: /출생연도 알려 주기/ });
  await expect(ask).toContainText('또래와 비교해 드려요');
  await ask.click();
  await expect(page).toHaveURL(/\/settings\/me\/birth-year\?from=rank$/);
  await expect(page.getByRole('heading', { name: '예빈님은 몇 년생이에요?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await setWheel(page, '예빈님은 몇 년생이에요?', 1995);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  expect(db.me.birth_year).toBe(1995);
  await expect(page.getByRole('button', { name: /출생연도 알려 주기/ })).toHaveCount(0);
});

test('예전 P-03a(출생연도)에 멈춘 사람: 다시 열면 다음 화면 P-04', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  db.me.onboarding_step = 'P-03A';
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-04$/);
  await expect(
    page.getByRole('heading', { name: '찬우님이 고른 월급 관리 방식이에요' }),
  ).toBeVisible();
  // 진행 막대 4칸 중 2칸, 뒤로는 P-03
  await expectStep(page, 2, 4);
  await expect.poll(() => db.me.onboarding_step).toBe('P-04');
  // 좁은 창은 머리 ‘뒤로’, 넓은 창은 아래 바 ‘이전’
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/join\/p-03$/);

  // 주소로 바로 와도 같음
  await page.goto('/join/p-03a');
  await expect(page).toHaveURL(/\/join\/p-04$/);
});

test('예전 P-03a에 멈췄고 시작한 사람이 아직 온보딩 중: 다시 열면 P-05', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, false);
  db.me.onboarding_step = 'P-03A';
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-05$/);
  await expect(page.getByRole('heading', { name: '한 달 실수령액은 얼마예요?' })).toBeVisible();
  // 시작한 사람이 아직 온보딩 중이면 P-03, P-05, P-05b 세 칸(2026-11-11 S3-24)
  await expectStep(page, 2, 3);
});

test('합쳐서로 바꾸면 바로 적용 → 공동 월급 계획 다시 채우기(있던 줄 그대로, 예빈 용돈)로 합류 완료', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  await answerBasics(page);
  // 각자 그대로면 결과 한 줄 없음
  await expect(page.getByText(/월급 계획이 두 분의 월급 계획 하나가 돼요/)).toHaveCount(0);
  await page.getByRole('radio', { name: /합쳐서 같이 관리해요/ }).click();
  // 다른 방식을 고르면 주 버튼 위 결과 한 줄 + ‘다음’은 확인 Modal(2026-11-09 round 3)
  await expect(page.getByText('찬우님 월급 계획이 두 분의 월급 계획 하나가 돼요')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  const dialog = page.getByRole('alertdialog', { name: '월급 관리 방식을 바꿀까요?' });
  await expect(dialog).toContainText('찬우님에게도 바로 적용되고 알림이 가요');
  await axe(page);
  await dialog.getByRole('button', { name: '다시 고를게요' }).click();
  await expect(dialog).toHaveCount(0);
  expect(db.joinCalls).toHaveLength(0);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '바꿀게요' }).click();
  await expect
    .poll(() => db.joinCalls[0])
    .toMatchObject({ fn: 'set_join_salary_mode', p_mode: 'joint' });
  await salary(page);

  await celebrate(page);
  const lines = db.splits.find((x) => x.owner_user_id === null)?.split_line as {
    kind: string;
    amount: number;
  }[];
  expect(lines.some((l) => l.kind === 'allowance' && l.amount === 270_000)).toBe(true);
  expect(db.splits.find((x) => x.owner_user_id === null)?.split_line).toHaveLength(6);
});

test('시작한 사람이 아직 온보딩 중: 이름 → 월급 → 월급날 저장 = 합류, 홈 대기, 월급 계획이 생기면 P-04부터', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, false);
  await answerBasics(page, true);
  await salary(page);
  await celebrate(page, '찬우님이 월급 계획을 만들면 알려 드릴게요');
  await expect(page.getByText('찬우님이 시작하고 있어요')).toBeVisible();
  await expect(page.getByText('찬우님이 월급 계획을 만들면 알려 드릴게요')).toBeVisible();
  expect(db.joinCalls.at(-1)).toMatchObject({ fn: 'complete_join' });
  expect(db.me.onboarding_step).toBe('P-WAIT');
  await axe(page);

  // 찬우가 월급 계획을 만들면 다음에 열 때 P-04 → 홈(월급 계획은 자동)
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
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.joinCalls.at(-1)).toMatchObject({ fn: 'complete_join' });
  expect(db.joinCalls.at(-1)?.p_lines).toBeTruthy();
});

test('P-02a 혼자 쓰던 기록 옮기기: 이미 시작한 기록 → 합류하기 → 내 정보만(자산 공개 범위) → 다음 → P-03', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.me, {
    nickname: '예빈',
    space_id: 'space-solo',
    monthly_income: 2_700_000,
    payday: 10,
    onboarding_done_at: '2026-10-01T00:00:00Z',
  });
  db.assets.push({
    id: 'a-y',
    space_id: 'space-solo',
    side: 'asset',
    grp: 'deposit',
    kind: 'saving',
    name: '예빈 적금',
    amount: 5_000_000,
    owner: 'person',
    owner_user_id: db.me.id,
    visibility: 'all',
    deleted_at: null,
  });
  await page.goto('/i/K7M2QX');
  await page.getByRole('button', { name: '합류하기' }).click();
  await expect(page.getByRole('heading', { name: '이미 시작한 기록이 있어요' })).toBeVisible();
  await page.getByRole('button', { name: '합류하기' }).click();
  await expect(page.getByRole('heading', { name: '내 정보만 옮겨요' })).toBeVisible();
  await expect(page.getByText('월급날 10일')).toBeVisible();
  await expect(page.getByText('270만 원', { exact: true })).toBeVisible();
  // 공개 범위: 줄 오른쪽 ‘금액만 보여 주기’ → 시트에서 고름(2026-11-03)
  const row = page.getByRole('button', { name: /예빈 적금 500만 원/ });
  await expect(row).toContainText('금액만 보여 주기');
  await expect(page.getByText(/30일 보관 후 지워져요/)).toBeVisible();
  await axe(page);
  await row.click();
  const sheet = page.getByRole('dialog', { name: '예빈 적금 공개 범위' });
  await sheet.getByRole('radio', { name: '모두 보여 주기' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row).toContainText('모두 보여 주기');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/join\/p-03$/);
  expect(db.assets.find((a) => a.id === 'a-y')).toMatchObject({
    space_id: 'space-1',
    visibility: 'all',
  });
});

// 2026-11-11 QA 3구간 D1: 시작한 사람이 초대를 취소했거나 잡아 둔 24시간이 지나면 합류 화면 대신 안내
test('합류가 끝난 초대: 코드 다시 입력하기(뒤로 = 홈) / 혼자 시작하기 → 온보딩', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  db.joinEnded = true;
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-03$/);
  await expect(
    page.getByRole('heading', { name: '초대가 취소됐거나 기한이 지났어요' }),
  ).toBeVisible();
  await expect(page.getByText('받은 코드를 다시 넣거나 혼자 시작할 수 있어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '코드 다시 입력하기' }).click();
  await expect(page).toHaveURL(/\/i$/);
  await expect(page.getByRole('heading', { name: '받은 초대 코드를 넣어 주세요' })).toBeVisible();
  await page.goto('/join/p-03');
  await page.getByRole('button', { name: '혼자 시작하기' }).click();
  await expect(page).toHaveURL(/\/onboarding\/o-03$/);
  expect(db.me.onboarding_step).toBe('O-03');
});

test('P-05 큰 값은 O-31과 같은 확인 띠 한 번(S3-25)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  db.me.onboarding_step = 'P-05';
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-05$/);
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('200000000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('.hg-banner--check')).toContainText('입력한 값이 맞나요?');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/join\/p-05b$/);
});

test('로그인된 사람의 합류 불가(A-07 7번): 코드 다시 입력하기 + 홈으로 가기(D4)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.route(`${SB}/rest/v1/rpc/invite_preview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ inviter_nickname: '찬우', status: 'used' }]),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await page.goto('/i/K7M2QX');
  await expect(page.getByRole('heading', { name: '이미 합류가 끝난 초대예요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '홈으로 가기' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '코드 다시 입력하기' }).click();
  await expect(page).toHaveURL(/\/i$/);
  // 뒤로 = 홈(합류 불가 화면으로 돌아가지 않음, S3-28)
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
});

test('O-06 ‘받은 초대 코드가 있어요 ›’ → P-01 코드 입력, 뒤로 = O-06(D4)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  Object.assign(db.me, { nickname: '찬우', onboarding_step: 'O-06', onboarding_done_at: null });
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding\/o-06$/);
  await page.getByRole('button', { name: '받은 초대 코드가 있어요 ›' }).click();
  await expect(page).toHaveURL(/\/i$/);
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/onboarding\/o-06$/);
});
