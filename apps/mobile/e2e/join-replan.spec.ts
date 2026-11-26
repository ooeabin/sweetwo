import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, emptyV22, fakeJwt, type MemDb, mockOnboarding, SB, seed } from './mocks';
import { events } from './analytics';
import { pickYear } from './wheel';
import { fakeBridge } from './fake-bridge';

// 파트너 합류 v2.2(18 ‘파트너 합류 v2.2’, 2026-11-13): P-03 이름 → P-04 형태 확인(좋아요 / 월급은 대부분 보내요) → P-05 월급
// (공개 고지, 각자 계열 ‘월급 없이 합류할게요’) → P-05b 월급날 → (P-05c 용돈: 관리하지 않는 쪽) → P-10 축하 → P-11 알림 종류 → 홈.
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

/** 시작한 사람이 고른 관리 형태(08 2장). 기본 ‘저금만 같이 해요’ */
type Style = 'saving_only' | 'living_saving' | 'together' | 'one_manager' | 'unset';
function joining(db: MemDb, starterReady = true, style: Style = 'saving_only') {
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
  const joint = style === 'together' || style === 'one_manager';
  Object.assign(db.space ?? {}, {
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    created_by: STARTER,
    salary_mode: joint ? 'joint' : 'separate',
    shared_living: style === 'unset' ? null : style !== 'saving_only',
    shared_saving: style === 'unset' ? null : style !== 'together',
    manager_user_id: style === 'one_manager' ? STARTER : null,
    manager_pending_partner: false,
  });
  // 합쳐서면 찬우 월급 계획이 공동 월급 계획
  if (joint) for (const sp of db.splits) sp.owner_user_id = null;
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
    await expect(page.getByRole('heading', { name: '찬우님이 이렇게 골랐어요' })).toBeVisible();
}

/** 합류 축하(P-10, 2026-11-11 D7): 축하 배경 + 그림 자리 + “찬우님과 연결됐어요” → P-11 알림 종류 */
async function celebrate(page: Page, help = '이제 같이 모으는 저축·투자를 둘이 봐요') {
  await expect(page).toHaveURL(/\/join\/p-10$/);
  await expect(page.getByRole('heading', { name: '찬우님과 연결됐어요' })).toBeVisible();
  await expect(page.getByText(help)).toBeVisible();
  await expect(page.locator('main.hg-celebrate-bg')).toHaveCount(1);
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '이런 알림을 보내 드려요' })).toBeVisible();
}

/** P-11 알림 종류: 보이는 줄(이름 → 켬)을 확인하고 ‘나중에 할게요’ → 홈 */
async function pushKinds(page: Page, rows: [string, boolean][]) {
  const list = page.getByRole('region', { name: '이런 알림을 보내 드려요' });
  await expect(list.getByRole('switch')).toHaveCount(rows.length);
  // 테두리 카드 없이 흰 바탕 줄(2026-11-25 구역 6)
  expect(await list.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
  for (const [name, on] of rows)
    await expect(list.getByRole('switch', { name })).toHaveAttribute('aria-checked', String(on));
  await axe(page);
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** P-05c 용돈: 처음 값 월급 × 10%, 관리하는 사람 안내 → amount로 저장 */
async function allowance(page: Page, amount: string) {
  await expect(page).toHaveURL(/\/join\/p-05c$/);
  await expect(page.getByRole('heading', { name: '용돈은 얼마로 할까요?' })).toBeVisible();
  await expect(page.getByText('나머지는 찬우님에게 보내요')).toBeVisible();
  await expect(page.getByText('찬우님도 용돈을 고칠 수 있어요. 고치면 알려 드려요')).toBeVisible();
  const f = page.getByLabel('용돈은 얼마로 할까요?');
  await expect(f).toHaveValue('270,000');
  await f.fill('3000000');
  await expect(page.locator('.hg-banner--check')).toContainText(
    '용돈은 월급보다 많이 정할 수 없어요',
  );
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await axe(page);
  await f.fill(amount);
  await page.getByRole('button', { name: '다음' }).click();
}

async function salary(page: Page) {
  await expect(page.getByRole('heading', { name: '한 달 실수령액은 얼마예요?' })).toBeVisible();
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('2700000');
  await page.getByRole('button', { name: '다음' }).click();
  // 월급날은 따로 P-05b(2026-11-03), 날짜 칸(2026-11-25 휠 대신) 25일에서 시작 → 10일
  await expect(page.getByRole('heading', { name: '월급날은 며칠이에요?' })).toBeVisible();
  const days = page.getByRole('radiogroup', { name: '월급날은 며칠이에요?' });
  await expect(days.getByRole('radio', { name: '25일' })).toBeChecked();
  await days.getByRole('radio', { name: '10일' }).click();
  await expect(days.getByRole('radio', { name: '10일' })).toBeChecked();
  await page.getByRole('button', { name: '다음' }).click();
}

test('각자(저금만 같이 해요): 형태 확인 ‘좋아요’ → 월급(공개 고지) → 월급날 → 추천 월급 계획으로 합류 → 축하 → 알림 종류 → 홈', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  // 찬우 첫 저금 ‘내 집 마련’에 같이 모으기로 바로 묶을 수 있음(P-09, 3차 검토 D2)
  db.v22 = { ...emptyV22(), joinOffer: { bundle_id: null, goal_id: 'g-home', name: '내 집 마련' } };
  const ev = events(page);
  await answerBasics(page);
  await expect(page.getByText('저축·투자만 같이 해요')).toBeVisible();
  await expect(page.getByRole('radio', { name: '좋아요' })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: '월급은 대부분 찬우님에게 보내요' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '좋아요' }).click();
  await expect(page.getByText('파트너에게는 저축·투자만 보여요')).toBeVisible();
  await salary(page);

  // 합류를 마치면 P-09 지금까지 모은 금액(각자 계열, 묶을 곳이 있을 때만) → 같이 모으기에 바로 묶음
  await expect(page).toHaveURL(/\/join\/p-09$/);
  await expect(
    page.getByRole('heading', { name: '지금까지 모은 금액을 알려 주세요' }),
  ).toBeVisible();
  await expect(
    page.getByText('찬우님의 ‘내 집 마련’과 묶어서 둘이 모은 금액을 바로 보여 드려요'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '같이 모으기' })).toBeDisabled();
  // 새 저금 매달 금액은 0원이라 월급 계획에서 정한다고 알림(r5 A2, 예전 ‘월급날 확인하면 더해져요’)
  await expect(
    page.getByText('이 금액은 처음 한 번만 넣어요. 매달 모을 금액은 월급 계획에서 정해요'),
  ).toBeVisible();
  // 다시 열면 여기부터(r5 A1): 이 기기에 계정과 화면을 기억
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('sweetwo.join-after')))
    .toBe(`${db.me.id}|p-09`);
  await axe(page);
  await page.getByLabel('지금까지 모은 금액').fill('4000000');
  await page.getByRole('button', { name: '같이 모으기' }).click();
  await expect(page).toHaveURL(/\/join\/p-10$/);
  expect(db.v22?.calls.find((c) => c.fn === 'join_saving_start')?.body).toEqual({
    p_amount: 4_000_000,
  });
  // 콘솔 이벤트는 비동기로 모여서 기다림(좁은 창 CI에서 가끔 늦음)
  await expect
    .poll(() => ev.find((e) => e.name === 'join_saved_answered')?.props)
    .toEqual({
      entered: true,
      amount_band: '300-1000만',
      new_bundle: true,
    });

  // 월급 계획 화면 없이 합류 축하(P-10) → P-11. 첫 확인 목록은 다음 월급날(소급 없음)
  await celebrate(page);
  await pushKinds(page, [
    ['경조사가 다가올 때', true],
    ['월급날 확인할 게 있을 때', true],
    ['같이 모으기를 다 모았을 때', true],
    ['진행 소식', true],
    ['매달 우리 둘 소식', true],
  ]);
  expect(await page.evaluate(() => localStorage.getItem('sweetwo.join-after'))).toBeNull();
  const call = db.joinCalls.find((c) => c.fn === 'complete_join');
  expect(call?.p_version).toBeUndefined();
  expect(
    (call?.p_lines as { kind: string; amount: number }[]).map((l) => [l.kind, l.amount]),
  ).toEqual([['allowance', 270_000]]);
  expect(db.modeRequests).toHaveLength(0);
  expect(db.me).toMatchObject({ birth_year: null, monthly_income: 2_700_000, payday: 10 });
  expect(db.me.push_kinds).toEqual({
    care: true,
    payday: true,
    achieved: true,
    progress_news: true,
    month_us: true,
  });
  expect(db.space?.couple_state).toBe('connected');
  await expect
    .poll(() => ev.find((e) => e.name === 'push_permission_answered')?.props)
    .toMatchObject({ screen_id: 'P-11', result: 'later' });

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
  // 처음 보이는 값으로 바로 저장할 수 있음(2026-11-13 실구동)
  await expect(page.getByRole('button', { name: '저장' })).toBeEnabled();
  await pickYear(page, '출생연도', 1995);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  expect(db.me.birth_year).toBe(1995);
});

test('각자(생활비와 저금을 같이 해요) + ‘월급은 대부분 찬우님에게 보내요’: P-05c 용돈 → 합류 뒤 관리 형태 요청(p04_send)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, true, 'living_saving');
  const ev = events(page);
  await answerBasics(page);
  await expect(page.getByText('생활비와 저축·투자를 같이 해요')).toBeVisible();
  await page.getByRole('radio', { name: '월급은 대부분 찬우님에게 보내요' }).click();
  await expect(page).toHaveURL(/\/join\/p-05$/);
  // 진행 막대: P-03, P-04, P-05, P-05b, P-05c 다섯 칸
  await expectStep(page, 3, 5);
  await salary(page);
  await allowance(page, '300000');
  await celebrate(page);
  // 각자 공간에는 아직 요청 중: 용돈 자동 줄만(보내기 줄은 수락되면 서버가 만듦)
  const call = db.joinCalls.find((c) => c.fn === 'complete_join');
  expect(call?.p_lines).toEqual([
    expect.objectContaining({
      kind: 'allowance',
      amount: 300_000,
      in_checklist: true,
      auto_pay: true,
      auto_day: 10,
    }),
  ]);
  expect(db.modeRequests).toEqual([
    expect.objectContaining({
      p_shared_living: true,
      p_shared_saving: true,
      p_manager: 'partner',
      p_phrase: 'p04_send',
      status: 'open',
    }),
  ]);
  expect(db.space?.salary_mode).toBe('separate');
  // 요청이 열려 있거나 거절돼도 내 각자 월급 계획에 ‘보내기’(월급 − 용돈) + ‘용돈’(서버 20261208090000 계약 6)
  expect(
    db.splits.find((x) => x.owner_user_id === db.me.id)?.split_line.map((l) => l.kind),
  ).toEqual(['allowance', 'send']);
  await expect
    .poll(() => ev.find((e) => e.name === 'mode_change_requested')?.props)
    .toEqual({ phrase: 'p04_send', to_mode: 'combined', result: 'requested' });
  // 관리하지 않는 쪽: 월급날 확인 없음(자동 줄뿐), 내 용돈이 바뀌었을 때
  await pushKinds(page, [
    ['경조사가 다가올 때', true],
    ['같이 모으기를 다 모았을 때', true],
    ['내 용돈이 바뀌었을 때', true],
    ['진행 소식', true],
    ['매달 우리 둘 소식', true],
  ]);
});

test('한 사람이 관리해요(찬우가 관리): 형태 확인만 → P-05c 용돈 → 공동 월급 계획에 내 용돈 + 보내기 자동 줄', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, true, 'one_manager');
  await answerBasics(page);
  await expect(page.getByText('한 사람이 관리해요')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '좋아요' }).click();
  await expect(page.getByText('월급을 합쳐서 쓰면 파트너도 이 금액을 봐요')).toBeVisible();
  // 같이 계열은 월급 없이 합류가 아니라 ‘지금은 월급이 없어요’
  await expect(page.getByRole('button', { name: '월급 없이 합류할게요' })).toHaveCount(0);
  await salary(page);
  await allowance(page, '250000');
  await celebrate(page);
  // R1(2026-11-14): 본 version(공간에 넣기 전 값)으로 비교. 넣는 순간 보내기 줄로 version이 올라도 멈추지 않음
  expect(db.joinCalls.find((c) => c.fn === 'complete_join')?.p_version).toBe(1);
  const joint = db.splits.find((x) => x.owner_user_id === null);
  expect((joint as { version?: number } | undefined)?.version).toBe(3);
  const mine = joint?.split_line.filter((l) => l.user_id === db.me.id);
  expect(mine?.map((l) => [l.kind, l.amount, l.auto_pay, l.auto_day])).toEqual([
    ['allowance', 250_000, true, 10],
    ['send', 2_450_000, true, 10],
  ]);
  // 찬우가 정한 줄은 그대로
  expect(joint?.split_line.filter((l) => l.user_id !== db.me.id && l.kind !== 'send').length).toBe(
    5,
  );
  await pushKinds(page, [
    ['경조사가 다가올 때', true],
    ['같이 모으기를 다 모았을 때', true],
    ['찬우님이 같이 쓰는 걸 바꿨을 때', false],
    ['내 용돈이 바뀌었을 때', true],
    ['진행 소식', true],
    ['매달 우리 둘 소식', true],
  ]);
  expect(db.me.push_kinds).toMatchObject({ shared_change: false, my_allowance: true });
});

test('월급을 합쳐서 써요(둘이 같이): 형태 확인만 → 공동 월급 계획 다시 채우기(있던 줄 그대로, 예빈 용돈)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, true, 'together');
  await answerBasics(page);
  await expect(page.getByText('월급을 합쳐서 써요')).toBeVisible();
  await page.getByRole('button', { name: '좋아요' }).click();
  await salary(page);
  await celebrate(page);
  const lines = db.splits.find((x) => x.owner_user_id === null)?.split_line ?? [];
  expect(lines.some((l) => l.kind === 'allowance' && l.amount === 270_000)).toBe(true);
  expect(lines.some((l) => l.kind === 'send')).toBe(false);
  await pushKinds(page, [
    ['경조사가 다가올 때', true],
    ['월급날 확인할 게 있을 때', true],
    ['같이 모으기를 다 모았을 때', true],
    ['찬우님이 같이 쓰는 걸 바꿨을 때', true],
    ['진행 소식', true],
  ]);
});

test('각자 계열 ‘월급 없이 합류할게요’: 월급날·용돈 없이 월급 계획 없이 합류', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  await answerBasics(page);
  await page.getByRole('radio', { name: '좋아요' }).click();
  await page.getByRole('button', { name: '월급 없이 합류할게요' }).click();
  await celebrate(page);
  expect(db.joinCalls.map((c) => c.fn)).toEqual(['finish_join']);
  expect(db.me).toMatchObject({ monthly_income: 0, payday: null });
  expect(db.splits.filter((s) => s.owner_user_id === db.me.id)).toHaveLength(0);
  await pushKinds(page, [
    ['경조사가 다가올 때', true],
    ['같이 모으기를 다 모았을 때', true],
    ['진행 소식', true],
    ['매달 우리 둘 소식', true],
  ]);
});

test('예전 P-03a(출생연도)에 멈춘 사람: 다시 열면 다음 화면 P-04', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  db.me.onboarding_step = 'P-03A';
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-04$/);
  await expect(page.getByRole('heading', { name: '찬우님이 이렇게 골랐어요' })).toBeVisible();
  await expectStep(page, 2, 4);
  await expect.poll(() => db.me.onboarding_step).toBe('P-04');
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/join\/p-03$/);
  await page.goto('/join/p-03a');
  await expect(page).toHaveURL(/\/join\/p-04$/);
});

test('예전 P-03a에 멈췄고 시작한 사람이 아직 온보딩 중(같이 계열): 다시 열면 P-05', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, false, 'together');
  db.me.onboarding_step = 'P-03A';
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-05$/);
  await expect(page.getByRole('heading', { name: '한 달 실수령액은 얼마예요?' })).toBeVisible();
  await expectStep(page, 2, 3);
});

test('시작한 사람이 아직 온보딩 중 + 같이 계열: 합류만 하고 홈 대기 + ‘알려 주기’(24시간에 1번), 월급 계획이 생기면 P-04부터', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, false, 'together');
  await answerBasics(page, true);
  await salary(page);
  await celebrate(page, '찬우님이 월급 계획을 만들면 알려 드릴게요');
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await expect(page.getByText('찬우님이 시작하고 있어요')).toBeVisible();
  expect(db.joinCalls.at(-1)).toMatchObject({ fn: 'complete_join' });
  expect(db.me.onboarding_step).toBe('P-WAIT');
  await page.getByRole('button', { name: '알려 주기' }).click();
  await expect(page.locator('.hg-toast', { hasText: '찬우님께 알렸어요' })).toBeVisible();
  await page.getByRole('button', { name: '알려 주기' }).click();
  await expect(page.locator('.hg-toast', { hasText: '내일 다시 알릴 수 있어요' })).toBeVisible();
  await axe(page);

  // 찬우가 월급 계획을 만들면 다음에 열 때 P-04 → 홈(월급 계획은 자동)
  seed(db);
  for (const sp of db.splits) sp.owner_user_id = null;
  Object.assign(db.me, { nickname: '예빈', onboarding_step: 'P-WAIT' });
  db.partner = {
    id: STARTER,
    nickname: '찬우',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
  };
  Object.assign(db.space ?? {}, { salary_mode: 'joint', shared_living: true, created_by: STARTER });
  await page.reload();
  await expect(page).toHaveURL(/\/join\/p-04$/);
  await page.getByRole('button', { name: '좋아요' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.joinCalls.at(-1)).toMatchObject({ fn: 'complete_join' });
  expect(db.joinCalls.at(-1)?.p_lines).toBeTruthy();
});

test('시작한 사람이 아직 온보딩 중 + 형태를 아직 안 고름: 각자 계열로 보고 기다리지 않음(P-04 없이 내 월급 계획)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, false, 'unset');
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-03$/);
  await expectStep(page, 1, 3);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/join\/p-05$/);
  await salary(page);
  await celebrate(page);
  expect(db.joinCalls.at(-1)?.p_lines).toBeTruthy();
  expect(db.me.onboarding_step).not.toBe('P-WAIT');
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
  await expect(page.getByText('2,700,000원', { exact: true })).toBeVisible();
  // 공개 범위: 줄 오른쪽 ‘총액만 보여 주기’ → 시트에서 고름(2026-11-03)
  const row = page.getByRole('button', { name: /예빈 적금 5,000,000원/ });
  await expect(row).toContainText('총액만 보여 주기');
  await expect(page.getByText(/30일 동안 보관한 뒤 지워요/)).toBeVisible();
  // 테두리 카드 없이 흰 바탕 줄 + 묶음 사이 8px 띠(2026-11-25 구역 6)
  const lists = page.locator('.hg-q .hg-list');
  for (let i = 0; i < (await lists.count()); i++)
    expect(await lists.nth(i).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
  const bandH = await page
    .locator('.hg-q > .hg-list + .hg-sechead')
    .evaluate((el) => getComputedStyle(el, '::before').height);
  expect(bandH).toBe('8px');
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

// 2026-11-14 재테스트 R2: 로그인 전에 P-01을 한 번 열어 ‘로그인 안 됨’을 기억한 채 가입(A-05)을 마치고 돌아오면(?go=1)
// 옛 값으로 다시 A-02에 튀었음. 열 때마다 새로 확인해 바로 합류하고, 가입 도중 앱을 다시 열어도 초대로 이어 감
const freshJoiner = (db: MemDb) => {
  joining(db, true, 'one_manager');
  Object.assign(db.me, { space_id: null, onboarding_step: null, nickname: null });
};
test('초대 코드로 가입: 로그인 전에 연 P-01 뒤 가입을 마치고 돌아오면 A-02로 튀지 않고 바로 합류(R2)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  freshJoiner(db);
  await fakeBridge(page, { signedIn: false });
  await page.goto('/i/K7M2QX');
  await expect(page.getByRole('heading', { name: '찬우님이 초대했어요' })).toBeVisible();
  await page.getByRole('button', { name: '합류하기' }).click();
  await expect(
    page.getByRole('heading', { name: '찬우님 공간에 합류할 계정을 골라요' }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sweetwo.pending-invite'))).toBe('K7M2QX');
  // 로그인·가입이 끝난 것처럼: 토큰을 주고 A-05가 하듯 앱 안에서 돌아갈 자리로
  await page.evaluate(() => {
    const w = window as unknown as {
      __fb: { token: string | null };
      __fbcb: { navigate: (x: [string, unknown]) => void };
    };
    w.__fb.token = 'e2e-access-token';
    w.__fbcb.navigate(['/i/K7M2QX?go=1', undefined]);
  });
  await expect(page).toHaveURL(/\/join\/p-03$/);
  expect(db.rpc).toContain('join_space');
  // 합류를 시작하면 이 기기에 남긴 초대는 지움
  expect(await page.evaluate(() => localStorage.getItem('sweetwo.pending-invite'))).toBeNull();
});

test('초대 코드로 가입 도중 앱을 다시 열면(돌아갈 자리 없음) 시작한 사람 질문이 아니라 합류로(R2)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  freshJoiner(db);
  await fakeBridge(page, { signedIn: true, pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pending-invite', 'K7M2QX'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-03$/);
  await expect(page.getByRole('heading', { name: '내 이름이나 애칭을 알려 주세요' })).toBeVisible();
  expect(db.rpc).toContain('join_space');
});

test('합류를 마치고 P-09에서 앱을 닫았다 열면 A-06 권장보다 P-09부터, A-06은 P-11 뒤(r5 A1)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  db.v22 = { ...emptyV22(), joinOffer: { bundle_id: null, goal_id: 'g-home', name: '내 집 마련' } };
  // 합류를 마친 각자 계열 예빈(월급 없이 합류)
  Object.assign(db.me, { onboarding_done_at: '2026-10-07T00:50:00Z', onboarding_step: 'P-06' });
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  await fakeBridge(page, { signedIn: true, pin: null });
  const id = db.me.id as string;
  await page.addInitScript(
    ([jwt, mark]) => {
      (window as unknown as { __fb: { token: string } }).__fb.token = jwt;
      if (!sessionStorage.getItem('e2e-marked')) {
        sessionStorage.setItem('e2e-marked', '1');
        localStorage.setItem('sweetwo.join-after', mark);
      }
    },
    [fakeJwt(id), `${id}|p-09`] as const,
  );
  await page.goto('/');
  await expect(page).toHaveURL(/\/join\/p-09$/);
  await expect(
    page.getByRole('heading', { name: '지금까지 모은 금액을 알려 주세요' }),
  ).toBeVisible();
  // 월급 계획이 없으면 안내는 앞 문장만(r5 A2)
  await expect(page.getByText('이 금액은 처음 한 번만 넣어요', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await expect(page).toHaveURL(/\/join\/p-10$/);
  // 축하에서 다시 열어도 축하부터
  await page.reload();
  await expect(page).toHaveURL(/\/join\/p-10$/);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '이런 알림을 보내 드려요' })).toBeVisible();
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await expect(page).toHaveURL(/\/lock\/setup$/);
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('sweetwo.join-after'))).toBeNull();
});

// 구역 6(2026-11-25): 뺀 화면 /join/p-03a, /join/p-06은 화면을 그리지 않고 그 흐름의 다음 화면으로
test('/join/p-06(없앤 화면): 화면 없이 다음 화면 P-04, 시작한 사람이 온보딩 중이면 P-05', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  db.me.onboarding_step = 'P-06';
  await page.goto('/join/p-06');
  await expect(page).toHaveURL(/\/join\/p-04$/);
  await expect(page.getByRole('heading', { name: '찬우님이 이렇게 골랐어요' })).toBeVisible();
  await expect(page.getByText('같이 쓰는 월급 계획이에요')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이대로 저장하기' })).toHaveCount(0);
});

test('/join/p-06: 시작한 사람이 아직 온보딩 중(같이 계열)이면 P-05', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, false, 'together');
  db.me.onboarding_step = 'P-06';
  await page.goto('/join/p-06');
  await expect(page).toHaveURL(/\/join\/p-05$/);
  await expect(page.getByRole('heading', { name: '한 달 실수령액은 얼마예요?' })).toBeVisible();
});

test('/join/p-06, /join/p-03a: 합류를 마친 계정은 홈으로', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.me, { onboarding_done_at: '2026-10-07T00:50:00Z', onboarding_step: 'P-06' });
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  await page.goto('/join/p-06');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/join/p-03a');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('같이 쓰는 월급 계획이에요')).toHaveCount(0);
});

// 구역 6(2026-11-25): A-07 이미 다른 파트너와 연결됨은 ‘홈으로 가기’ 하나(15 A-07 7번 예외)
test('A-07 이미 다른 파트너와 연결됨: 버튼은 ‘홈으로 가기’ 하나', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.route('**/rest/v1/rpc/join_space', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify('already_connected'),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await page.goto('/i/K7M2QX');
  await page.getByRole('button', { name: '합류하기' }).click();
  await expect(
    page.getByRole('heading', { name: '이미 우리 둘 공간이 연결돼 있어요' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '코드 다시 입력하기' })).toHaveCount(0);
  const buttons = page.locator('.hg-q button:not(.hg-back)');
  await expect(buttons).toHaveCount(1);
  await axe(page);
  await page.getByRole('button', { name: '홈으로 가기' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('P-05b 월급날: 펼친 날짜 칸(25일에서 시작), 10일을 고르고 다음', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  db.me.onboarding_step = 'P-05B';
  Object.assign(db.me, { monthly_income: 2_700_000 });
  await page.goto('/join/p-05b');
  await expect(page.getByRole('heading', { name: '월급날은 며칠이에요?' })).toBeVisible();
  await expect(page.locator('.hg-wheel')).toHaveCount(0);
  const days = page.getByRole('radiogroup', { name: '월급날은 며칠이에요?' });
  await expect(days.getByRole('radio')).toHaveCount(6);
  await expect(days.getByRole('radio', { name: '25일' })).toBeChecked();
  await days.getByRole('radio', { name: '말일' }).click();
  await expect(days.getByRole('radio', { name: '말일' })).toBeChecked();
  await days.getByRole('radio', { name: '10일' }).click();
  // 직접 입력하기(A안): 칩이 풀리고, 범위 밖이면 오류 + 다음 꺼짐
  const custom = page.getByRole('textbox', { name: '다른 날 직접 입력하기' });
  await custom.fill('40');
  await expect(days.getByRole('radio', { name: '10일' })).not.toBeChecked();
  await expect(page.getByText('1~31 사이로 입력해 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await custom.fill('30');
  await expect(page.getByText('그날이 없는 달은 말일로 계산해요')).toBeVisible();
  await days.getByRole('radio', { name: '10일' }).click();
  await expect(custom).toHaveValue('');
  await axe(page);
});
