import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, SB } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { seed } from './seed-home';
import { setWheel } from './wheel';

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

/** 분석 이벤트(개발 빌드 콘솔 ‘[analytics]’)를 모음 */
function events(page: Page) {
  const out: { name: string; props: Record<string, unknown> }[] = [];
  page.on('console', async (m) => {
    if (m.type() !== 'debug' || !m.text().startsWith('[analytics]')) return;
    const [, name, props] = await Promise.all(m.args().map((a) => a.jsonValue()));
    out.push({ name: String(name), props: (props ?? {}) as Record<string, unknown> });
  });
  return out;
}
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
async function celebrate(page: Page, help = '이제 같이 모은 걸 같이 봐요') {
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
  await expect(page.locator('.hg-banner--check')).toContainText('월급보다 많이 정할 수 없어요');
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await axe(page);
  await f.fill(amount);
  await page.getByRole('button', { name: '다음' }).click();
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

test('각자(저금만 같이 해요): 형태 확인 ‘좋아요’ → 월급(공개 고지) → 월급날 → 추천 월급 계획으로 합류 → 축하 → 알림 종류 → 홈', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db);
  const ev = events(page);
  await answerBasics(page);
  await expect(page.getByText('저금만 같이 해요')).toBeVisible();
  await expect(page.getByRole('radio', { name: '좋아요' })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: '월급은 대부분 찬우님에게 보내요' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '좋아요' }).click();
  await expect(page.getByText('파트너에게는 저금만 보여요')).toBeVisible();
  await salary(page);

  // 월급 계획 화면 없이 합류 축하(P-10) → P-11. 첫 확인 목록은 다음 월급날(소급 없음)
  await celebrate(page);
  await pushKinds(page, [
    ['경조사 일주일 전', true],
    ['월급날 확인할 게 있을 때', true],
    ['같이 모으기를 다 모았을 때', true],
    ['진행 소식', true],
  ]);
  const call = db.joinCalls.find((c) => c.fn === 'complete_join');
  expect(call?.p_version).toBeUndefined();
  expect(
    (call?.p_lines as { kind: string; amount: number }[]).map((l) => [l.kind, l.amount]),
  ).toEqual([
    ['fixed', 680_000],
    ['living', 680_000],
    ['allowance', 270_000],
  ]);
  expect(db.modeRequests).toHaveLength(0);
  expect(db.me).toMatchObject({ birth_year: null, monthly_income: 2_700_000, payday: 10 });
  expect(db.me.push_kinds).toEqual({
    care: true,
    payday: true,
    achieved: true,
    progress_news: true,
  });
  expect(db.space?.couple_state).toBe('connected');
  expect(ev.find((e) => e.name === 'push_permission_answered')?.props).toMatchObject({
    screen_id: 'P-11',
    result: 'later',
  });

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
});

test('각자(생활비와 저금을 같이 해요) + ‘월급은 대부분 찬우님에게 보내요’: P-05c 용돈 → 합류 뒤 관리 형태 요청(p04_send)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, true, 'living_saving');
  const ev = events(page);
  await answerBasics(page);
  await expect(page.getByText('생활비와 저금을 같이 해요')).toBeVisible();
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
  expect(ev.find((e) => e.name === 'mode_change_requested')?.props).toEqual({
    phrase: 'p04_send',
    to_mode: 'joint',
    result: 'requested',
  });
  // 관리하지 않는 쪽: 월급날 확인 없음(자동 줄뿐), 내 용돈이 바뀌었을 때
  await pushKinds(page, [
    ['경조사 일주일 전', true],
    ['같이 모으기를 다 모았을 때', true],
    ['내 용돈이 바뀌었을 때', true],
    ['진행 소식', true],
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
  await expect(page.getByText('같이 관리하면 파트너도 이 금액을 봐요')).toBeVisible();
  // 같이 계열은 월급 없이 합류가 아니라 ‘지금은 월급이 없어요’
  await expect(page.getByRole('button', { name: '월급 없이 합류할게요' })).toHaveCount(0);
  await salary(page);
  await allowance(page, '250000');
  await celebrate(page);
  const joint = db.splits.find((x) => x.owner_user_id === null);
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
    ['경조사 일주일 전', true],
    ['같이 모으기를 다 모았을 때', true],
    ['찬우님이 같이 쓰는 걸 바꿨을 때', false],
    ['내 용돈이 바뀌었을 때', true],
    ['진행 소식', true],
  ]);
  expect(db.me.push_kinds).toMatchObject({ shared_change: false, my_allowance: true });
});

test('합쳐서 관리해요(둘이 같이): 형태 확인만 → 공동 월급 계획 다시 채우기(있던 줄 그대로, 예빈 용돈)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  joining(db, true, 'together');
  await answerBasics(page);
  await expect(page.getByText('합쳐서 관리해요')).toBeVisible();
  await page.getByRole('button', { name: '좋아요' }).click();
  await salary(page);
  await celebrate(page);
  const lines = db.splits.find((x) => x.owner_user_id === null)?.split_line ?? [];
  expect(lines.some((l) => l.kind === 'allowance' && l.amount === 270_000)).toBe(true);
  expect(lines.some((l) => l.kind === 'send')).toBe(false);
  await pushKinds(page, [
    ['경조사 일주일 전', true],
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
    ['경조사 일주일 전', true],
    ['같이 모으기를 다 모았을 때', true],
    ['진행 소식', true],
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
  await expect(page.locator('.hg-toast', { hasText: '찬우님에게 알렸어요' })).toBeVisible();
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
