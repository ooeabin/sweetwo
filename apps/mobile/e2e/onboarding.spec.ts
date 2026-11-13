import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fakeBridge, fb } from './fake-bridge';
import { chanwoo, SB } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 온보딩 v2.2(docs/spec/16·17 ‘온보딩 ② v2.2’, ADR 0009, 2026-11-13):
// O-03 → O-11(4지선다) → O-30 → O-30b → (O-30c) → O-31(공개 고지) → O-32(날짜 없음) → O-55 알림 → O-60 ‘첫 저금 만들기’
// → W-11 → (미합류) O-07 초대 시트 → A-06 앱 잠금 권장(앱) → 홈. O-06 초대 화면 없음, 첫 확인 목록은 다음 월급날(소급 없음).
// 찬우가 처음 시작하고 예빈은 아직 미합류. 기획서 예시: 실수령 350만, 월급날 25일. 오늘 2026-10-07.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const next = (page: Page) => page.getByRole('button', { name: '다음' }).click();
const radio = (page: Page, name: string | RegExp) => page.getByRole('radio', { name }).click();
const amount = (page: Page) => page.getByLabel('한 달 실수령액은 얼마예요?');
const back = (page: Page) =>
  page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .first()
    .click();
const NOW = new Date('2026-10-07T10:00:00+09:00');
const lines = (db: MemDb) => db.splits.map((s) => s.split_line.map((l) => [l.kind, l.amount]));

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

/** O-03 → O-11(두 사람 사이) → O-30 */
async function start(page: Page, relation = '결혼했어요') {
  await page.goto('/');
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await heading(page, '두 사람은 어떤 사이예요?');
  await radio(page, relation);
  await heading(page, '같이 쓰는 생활비가 있어요?');
}

/** O-30 → O-30b → (O-30c) → O-31 */
async function manage(
  page: Page,
  living: '네' | '아니요',
  saving: '네' | '아직 없어요',
  who?: string,
) {
  await radio(page, living);
  await heading(page, '같이 모으는 저금이 있어요?');
  await radio(page, saving);
  if (who) {
    await heading(page, '누가 주로 관리해요?');
    await radio(page, who);
  }
  await heading(page, '한 달 실수령액은 얼마예요?');
}

/** O-31 350만 → O-32 25일 → O-55 */
async function salary(page: Page, won = '3500000') {
  await amount(page).fill(won);
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await heading(page, /알려 드릴까요\?$/);
}

test('결혼했어요 + 각자 따로: 이름부터 준비 끝까지(O-06 없음, 첫 확인 목록 없음) → 첫 저금 → 초대 시트 → 홈, 분석 이벤트', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  const ev = events(page);
  await page.goto('/');
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  await expect(page.getByRole('progressbar', { name: '온보딩 진행' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '뒤로' })).toHaveCount(0);
  await axe(page);
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  // O-11 4지선다, 미리 고른 값 없음
  await heading(page, '두 사람은 어떤 사이예요?');
  for (const n of ['결혼했어요', '결혼 준비 중이에요', '연애 중이에요', '같이 살아요'])
    await expect(page.getByRole('radio', { name: n })).not.toBeChecked();
  await expect(page.getByRole('heading', { name: '같이 쓸 사람을 초대할까요?' })).toHaveCount(0);
  await axe(page);
  await radio(page, '결혼했어요');
  await heading(page, '같이 쓰는 생활비가 있어요?');
  await expect(page.getByText('월세, 장보기, 데이트비처럼 둘이 같이 내는 돈이에요')).toBeVisible();
  await expect(page.getByRole('radio', { name: '네' })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: '아니요' })).not.toBeChecked();
  await axe(page);
  await radio(page, '아니요');
  await heading(page, '같이 모으는 저금이 있어요?');
  await axe(page);
  await radio(page, '아직 없어요');
  // 생활비 ‘아니요’면 O-30c 없이 O-31
  await heading(page, '한 달 실수령액은 얼마예요?');
  await expect(amount(page)).toBeFocused();
  // 공개 고지 한 줄(각자 계열): 저금만 + 바꾸기
  await expect(page.getByText('파트너에게는 저금만 보여요')).toBeVisible();
  await amount(page).fill('3500000');
  await axe(page);
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  // 매달 금액이 같으면 날짜 없음 선택지 없음
  await expect(page.getByText('날짜가 정해져 있지 않아요')).toHaveCount(0);
  await next(page);
  // O-55: 날짜 있음(오늘 10/7, 첫 월급날 10/25)
  await heading(page, '10월 25일 월급날 아침에 알려 드릴까요?');
  await expect(page.getByText('경조사 일주일 전에도 알려 드려요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('월급을 추천값으로 나눠 뒀어요')).toBeVisible();
  await expect(page.getByText('10월 25일 월급날에 처음 확인해요')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await axe(page);

  expect(db.me).toMatchObject({ nickname: '찬우', monthly_income: 3_500_000, payday: 25 });
  expect(db.space).toMatchObject({
    marriage_status: 'married',
    salary_mode: 'separate',
    shared_living: false,
    shared_saving: false,
    manager_user_id: null,
  });
  expect(db.splits).toHaveLength(1);
  expect(db.splits[0]?.owner_user_id).toBe(chanwoo.id);
  expect(lines(db)[0]).toEqual([
    ['fixed', 880_000],
    ['living', 880_000],
    ['allowance', 350_000],
  ]);
  // 소급 없음: 첫 확인 목록은 만들지 않음
  expect(db.checklists).toHaveLength(0);
  expect(db.rpc).not.toContain('start_checklist');

  // 주 버튼 ‘첫 저금 만들기’ → W-11a(from=onboarding) → 저장 → 초대 시트(미합류) → 홈
  await page.getByRole('button', { name: '첫 저금 만들기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new\/a\?from=onboarding$/);
  expect(db.me.onboarding_done_at).toBeTruthy();
  await page.getByLabel('무엇을 위해 모을까요?').fill('내 집 마련');
  await next(page);
  await page.getByLabel('매달 얼마씩 모을까요?').fill('950000');
  await next(page);
  // W-11e 은행에서 자동으로 나가요?(2026-11-13)
  await page.getByRole('radio', { name: '아니요, 직접 보내요' }).click();
  await page.getByLabel('모으고 싶은 목표 금액이 있나요?').fill('150000000');
  await next(page);
  await page.getByRole('button', { name: '기한 없이 모을게요' }).click();
  const sheet = page.getByRole('dialog', { name: '같이 모을 사람을 초대할까요?' });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
  // 코드를 받아 버튼이 켜지고 시트가 다 올라온 뒤 접근성 검사(올라오는 중에는 글자가 흐림)
  await expect(sheet.getByText('눌러서 복사')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '링크 복사' })).toBeEnabled();
  await page.waitForTimeout(400);
  await axe(page);
  await sheet.getByRole('button', { name: '나중에 보낼게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(sheet).toHaveCount(0);

  // 분석 이벤트(32 0-4)
  await expect.poll(() => ev.some((e) => e.name === 'onboarding_completed')).toBe(true);
  expect(ev.find((e) => e.name === 'manage_answers_saved')?.props).toEqual({
    shared_living: false,
    shared_saving: false,
    manager: null,
    salary_mode: 'separate',
    screen_id: 'O-30B',
  });
  expect(ev.find((e) => e.name === 'push_permission_answered')?.props).toEqual({
    screen_id: 'O-55',
    result: 'later',
    kinds_on: [],
  });
  expect(ev.find((e) => e.name === 'saving_item_created')?.props.entry).toBe('onboarding');
  expect(ev.find((e) => e.name === 'onboarding_completed')?.props).toMatchObject({
    salary_mode: 'separate',
    income_band: '300-1000만',
    no_income: false,
  });
  expect(ev.filter((e) => e.name === 'onboarding_step_viewed').length).toBeGreaterThanOrEqual(8);
  // 끝난 뒤 뒤로(웹뷰 기록)로 온보딩 화면에 오면 홈으로
  await page.goto('/onboarding/o-32');
  await expect(page).not.toHaveURL(/onboarding/);
});

// 08 2장 표(core resolveManageStyle, 서버 resolve_manage_style): 세 답 → 엔진 값, 처음 월급 계획
const ROWS: {
  name: string;
  living: '네' | '아니요';
  saving: '네' | '아직 없어요';
  who?: string;
  space: Record<string, unknown>;
  manager: 'self' | 'partner' | 'both' | 'each' | null;
  shared?: boolean;
  note: string;
}[] = [
  {
    name: '한 사람이 관리해요(제가)',
    living: '네',
    saving: '아직 없어요',
    who: '제가 주로 해요',
    space: { salary_mode: 'joint', manager_user_id: chanwoo.id, manager_pending_partner: false },
    manager: 'self',
    note: '같이 관리하면 파트너도 이 금액을 봐요',
  },
  {
    name: '한 사람이 관리해요(파트너가, 합류 전)',
    living: '네',
    saving: '네',
    who: '파트너가 주로 해요',
    space: { salary_mode: 'joint', manager_user_id: null, manager_pending_partner: true },
    manager: 'partner',
    note: '같이 관리하면 파트너도 이 금액을 봐요',
  },
  {
    name: '합쳐서 관리해요(둘이 같이)',
    living: '네',
    saving: '네',
    who: '둘이 같이 해요',
    space: { salary_mode: 'joint', manager_user_id: null, manager_pending_partner: false },
    manager: 'both',
    note: '같이 관리하면 파트너도 이 금액을 봐요',
  },
  {
    name: '생활비와 저금을 같이 해요',
    living: '네',
    saving: '네',
    who: '각자 자기 월급으로 해요',
    space: { salary_mode: 'separate', shared_living: true, shared_saving: true },
    manager: 'each',
    shared: true,
    note: '파트너에게는 저금만 보여요',
  },
  {
    name: '생활비만 같이 해요',
    living: '네',
    saving: '아직 없어요',
    who: '각자 자기 월급으로 해요',
    space: { salary_mode: 'separate', shared_living: true, shared_saving: false },
    manager: 'each',
    shared: true,
    note: '파트너에게는 저금만 보여요',
  },
  {
    name: '저금만 같이 해요',
    living: '아니요',
    saving: '네',
    space: { salary_mode: 'separate', shared_living: false, shared_saving: true },
    manager: null,
    note: '파트너에게는 저금만 보여요',
  },
];
for (const row of ROWS)
  test(`관리 형태 세 질문 → 엔진 값: ${row.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.clock.setFixedTime(NOW);
    const db = await mockOnboarding(page, { now: NOW });
    const ev = events(page);
    await start(page, '같이 살아요');
    await manage(page, row.living, row.saving, row.who);
    await expect(page.getByText(row.note)).toBeVisible();
    await salary(page);
    expect(db.space).toMatchObject(row.space);
    expect(db.space?.marriage_status).toBe('living_together');
    // 합쳐서 엔진이면 공동 월급 계획 하나, 각자 엔진이면 내 것. 생활비 네 + 각자면 같이 쓰는 통장 0원 자동 줄(Q9)
    const joint = row.space.salary_mode === 'joint';
    expect(db.splits.filter((s) => s.split_line.length).map((s) => s.owner_user_id)).toEqual([
      joint ? null : chanwoo.id,
    ]);
    const acc = db.splits.flatMap((s) => s.split_line).find((l) => l.kind === 'shared_account');
    if (row.shared) expect(acc).toMatchObject({ amount: 0, in_checklist: true, auto_pay: true });
    else expect(acc).toBeUndefined();
    // 한 사람 관리형(내가 관리)이라도 합류 전에는 보내기 줄 없음(관리하지 않는 사람이 아직 없음)
    expect(db.splits.flatMap((s) => s.split_line).some((l) => l.kind === 'send')).toBe(false);
    await expect
      .poll(() => ev.find((e) => e.name === 'manage_answers_saved')?.props.manager)
      .toBe(row.manager);
  });

test('O-32 ‘날짜가 정해져 있지 않아요’(매달 달라요일 때만): 날짜 없음 문구, 확인 목록 없음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page, '연애 중이에요');
  await manage(page, '아니요', '아직 없어요');
  await page.getByRole('checkbox', { name: '매달 금액이 달라요' }).click();
  await expect(
    page.getByText('보통 들어오는 금액을 적어 주세요. 더 들어오면 그때 알려 주세요'),
  ).toBeVisible();
  await amount(page).fill('2800000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await page.getByRole('checkbox', { name: '날짜가 정해져 있지 않아요' }).click();
  await axe(page);
  await next(page);
  await heading(page, '경조사와 큰돈 나갈 날 일주일 전에 알려 드릴까요?');
  await expect(page.getByText('경조사 일주일 전에도 알려 드려요')).toHaveCount(0);
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('돈이 들어오면 홈에서 알려 주세요')).toBeVisible();
  expect(db.me).toMatchObject({ payday: null, payday_last: false, payday_none: true });
  expect(db.space?.marriage_status).toBe('dating');
  expect(db.splits).toHaveLength(1);
  expect(db.checklists).toHaveLength(0);
});

test('O-55 알림 받기(앱): OS 허용 창 → 기기 등록, O-60 ‘나중에 할게요’ → A-06 “앱 잠금을 켤까요?” 건너뛰기 → 홈', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await fakeBridge(page, { signedIn: true, pin: null, push: { status: 'prompt', grant: true } });
  const ev = events(page);
  await start(page);
  await manage(page, '아니요', '네');
  await salary(page);
  await page.getByRole('button', { name: '알림 받기' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  expect((await fb(page)).pushRequests).toBe(1);
  await expect.poll(() => db.rpc.includes('register_push_device')).toBe(true);
  expect(ev.find((e) => e.name === 'push_permission_answered')?.props).toMatchObject({
    screen_id: 'O-55',
    result: 'granted',
  });
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  // 앱 잠금 권장(건너뛸 수 있음, 2026-11-13). 가입 직후가 아니라 여기서
  await heading(page, '앱 잠금을 켤까요?');
  await expect(page.getByText('기기 잠금이 있어도 한 번 더 지켜 줘요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.me.onboarding_done_at).toBeTruthy();
  expect((await fb(page)).pin).toBeNull();
  expect(ev.find((e) => e.name === 'app_lock_answered')?.props).toEqual({ result: 'later' });
});

test('A-06 ‘켜기’면 PIN 정하기 흐름, 다 정하면 홈', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  Object.assign(db.me, {
    nickname: '찬우',
    onboarding_step: 'O-60',
    monthly_income: 3_500_000,
    payday: 25,
  });
  await mockSpace(db);
  await fakeBridge(page, { signedIn: true, pin: null });
  const ev = events(page);
  await page.goto('/onboarding/o-60');
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await heading(page, '앱 잠금을 켤까요?');
  await page.getByRole('button', { name: '켜기' }).click();
  await heading(page, /PIN 6자리를 정해 주세요/);
  await page.keyboard.type('258036');
  await heading(page, /한 번 더/);
  await page.keyboard.type('258036');
  await expect(page).toHaveURL(/\/$/);
  expect((await fb(page)).pin).toBe('258036');
  expect(ev.find((e) => e.name === 'app_lock_answered')?.props).toEqual({ result: 'on' });
});

/** 공간을 미리 만들어 둠(이어하기 테스트) */
async function mockSpace(db: MemDb) {
  db.space = {
    id: 'space-1',
    couple_state: 'not_joined',
    salary_mode: 'separate',
    shared_living: false,
    shared_saving: false,
    manager_user_id: null,
    manager_pending_partner: false,
    marriage_status: 'married',
    version: 1,
  };
  db.me.space_id = 'space-1';
}

test('O-31 공개 고지 ‘바꾸기’ → 내 월급 계획 시트(모두 / 저금만 / 했어요만) → plan_share, 문장이 바뀜', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  const ev = events(page);
  await start(page);
  await manage(page, '아니요', '아직 없어요');
  await page.getByRole('button', { name: '바꾸기' }).click();
  const sheet = page.getByRole('dialog', { name: '내 월급 계획' });
  await expect(sheet.getByRole('radio', { name: '저금만 보여 주기' })).toBeChecked();
  await axe(page);
  await sheet.getByRole('radio', { name: '모두 보여 주기' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText('파트너에게 모두 보여요')).toBeVisible();
  expect(db.me.plan_share).toBe('all');
  expect(ev.find((e) => e.name === 'plan_share_changed')?.props).toEqual({
    from: 'saving_only',
    to: 'all',
    screen_id: 'O-31',
  });
});

test('이어하기: 가장 멀리 간 화면으로, 고른 답은 지나간 뒤에만 보임, 뺀 화면(O-06·O-07·O-12·O-10)은 옮김', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  await manage(page, '네', '네', '둘이 같이 해요');
  await expect.poll(() => db.me.onboarding_step).toBe('O-31');
  await back(page);
  await heading(page, '누가 주로 관리해요?');
  await expect(page.getByRole('radio', { name: '둘이 같이 해요' })).toBeChecked();
  await page.waitForTimeout(300);
  expect(db.me.onboarding_step).toBe('O-31');
  await page.goto('/');
  await heading(page, '한 달 실수령액은 얼마예요?');
  for (const [old, now] of [
    ['O-06', 'o-11'],
    ['O-07', 'o-11'],
    ['O-12', 'o-30'],
    ['O-10', 'o-03'],
  ] as const) {
    db.me.onboarding_step = old;
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/onboarding/${now}$`));
  }
  // 홈 띠 waiting_joiner(/onboarding/resume) → 가장 멀리 간 화면
  db.me.onboarding_step = 'O-31';
  await page.goto('/onboarding/resume');
  await expect(page).toHaveURL(/\/onboarding\/o-31$/);
});

test('‘지금은 월급이 없어요’: 확인 대화상자, O-32 없이 O-55, 준비 끝은 한 줄, 뒤로 와서 월급을 넣으면 다시 만듦', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page, '결혼 준비 중이에요');
  await manage(page, '네', '네', '둘이 같이 해요');
  await page.getByRole('button', { name: '지금은 월급이 없어요' }).click();
  const dialog = page.getByRole('alertdialog', { name: '월급 없이 시작할까요?' });
  await expect(dialog).toBeVisible();
  await axe(page);
  await dialog.getByRole('button', { name: '월급 없이 시작할게요' }).click();
  await heading(page, '경조사와 큰돈 나갈 날 일주일 전에 알려 드릴까요?');
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('월급이 생기면 홈에서 알려 주세요')).toBeVisible();
  await expect(page.getByText('월급을 추천값으로 나눠 뒀어요')).toHaveCount(0);
  expect(db.splits.find((s) => s.split_line.length)?.owner_user_id).toBeNull();
  // 뒤로(O-55 → O-31, O-32는 건너뜀)
  await page.goBack();
  await heading(page, '경조사와 큰돈 나갈 날 일주일 전에 알려 드릴까요?');
  await back(page);
  await heading(page, '한 달 실수령액은 얼마예요?');
  await expect(amount(page)).toHaveValue('');
  await amount(page).fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await heading(page, '10월 25일 월급날 아침에 알려 드릴까요?');
  expect(lines(db).filter((l) => l.length)).toEqual([
    [
      ['fixed', 880_000],
      ['living', 880_000],
      ['allowance', 350_000],
    ],
  ]);
});

test('O-60에서 뒤로 → 생활비 답을 바꾸면(각자 → 합쳐서) 월급 계획을 다시 만듦(S2-01)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  await manage(page, '아니요', '아직 없어요');
  await salary(page);
  expect(db.splits.map((s) => s.owner_user_id)).toEqual([chanwoo.id]);
  // O-55 → O-32 → O-31 → O-30b → O-30
  for (let i = 0; i < 4; i++) await back(page);
  await heading(page, '같이 쓰는 생활비가 있어요?');
  await expect(page.getByRole('radio', { name: '아니요' })).toBeChecked();
  await radio(page, '네');
  await heading(page, '같이 모으는 저금이 있어요?');
  await radio(page, '아직 없어요');
  await heading(page, '누가 주로 관리해요?');
  await expect(page.getByRole('radio', { name: '둘이 같이 해요' })).not.toBeChecked();
  await radio(page, '둘이 같이 해요');
  // 이어하기 기록도 다음 화면으로 되돌림(바꾼 답으로 다시 만들게)
  await expect.poll(() => db.me.onboarding_step).toBe('O-31');
  await next(page);
  await next(page);
  await heading(page, '10월 25일 월급날 아침에 알려 드릴까요?');
  expect(db.space).toMatchObject({ salary_mode: 'joint', shared_living: true });
  expect(db.splits.filter((s) => s.split_line.length).map((s) => s.owner_user_id)).toEqual([null]);
});

test('파트너가 온보딩 중에 먼저 합류: O-30c “예빈이 주로 해요”, 둘이 같이면 두 사람 합으로 추천값', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
  };
  await radio(page, '네');
  await heading(page, '같이 모으는 저금이 있어요?');
  await radio(page, '네');
  await heading(page, '누가 주로 관리해요?');
  await expect(page.getByRole('radio', { name: '예빈이 주로 해요' })).toBeVisible();
  await radio(page, '둘이 같이 해요');
  await salary(page);
  expect(
    db.splits
      .find((s) => s.owner_user_id === null)
      ?.split_line.map((l) => [l.kind, l.user_id ?? null, l.amount]),
  ).toEqual([
    ['fixed', null, 1_550_000],
    ['living', null, 1_550_000],
    ['allowance', chanwoo.id, 310_000],
    ['allowance', 'yebin', 310_000],
  ]);
});

test('O-31 금액: 999억 넘으면 다음 비활성(S2-06), 10만 원 미만·1억 원 초과는 한 번 확인(S2-07), 소수점은 버림(S2-18)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  await manage(page, '아니요', '아직 없어요');
  const btn = page.getByRole('button', { name: '다음' });
  await amount(page).fill('100000000000');
  await expect(page.getByText('999억 원까지 넣을 수 있어요')).toBeVisible();
  await expect(btn).toBeDisabled();
  await amount(page).fill('1234567890123');
  await expect(amount(page)).toHaveValue('100,000,000,000');
  await amount(page).fill('3500000.5');
  await expect(amount(page)).toHaveValue('3,500,000');
  await amount(page).fill('50000');
  await next(page);
  await expect(
    page.getByRole('alert').filter({ hasText: '한 달에 5만 원이 맞나요?' }),
  ).toBeVisible();
  await axe(page);
  await amount(page).fill('150000000');
  await next(page);
  await expect(page.getByText('한 달에 1억 5,000만 원이 맞나요?')).toBeVisible();
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  expect(db.me.monthly_income).toBe(150_000_000);
});

test('Enter 키 = 주 버튼(S2-08): 선택 화면은 숫자 키, 휠·O-55·O-60도 Enter', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await mockOnboarding(page, { now: NOW });
  await page.goto('/');
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  await page.keyboard.type('찬우');
  await page.keyboard.press('Enter');
  await heading(page, '두 사람은 어떤 사이예요?');
  await page.keyboard.press('3');
  await heading(page, '같이 쓰는 생활비가 있어요?');
  await page.keyboard.press('2');
  await heading(page, '같이 모으는 저금이 있어요?');
  await page.keyboard.press('2');
  await heading(page, '한 달 실수령액은 얼마예요?');
  await page.keyboard.type('3500000');
  await page.keyboard.press('Enter');
  await heading(page, '월급날은 며칠이에요?');
  await page.keyboard.press('Enter');
  await heading(page, '10월 25일 월급날 아침에 알려 드릴까요?');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await heading(page, '찬우님, 준비가 끝났어요');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/salary\/items\/new\/a/);
});

test('이름: 보이는 글자로 셈(커플 이모지 = 1자, S2-19), 공백만이면 오류', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await page.goto('/');
  const f = page.getByLabel('내 이름이나 애칭을 알려 주세요');
  await f.fill('   ');
  await expect(page.getByText('이름을 넣어 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  const couple = '👩‍❤️‍👨';
  await f.fill(`${couple.repeat(6)}찬우`);
  await expect(page.getByText('8/10')).toBeVisible();
  await next(page);
  await heading(page, '두 사람은 어떤 사이예요?');
  expect(db.me.nickname).toBe(`${couple.repeat(6)}찬우`);
});

test('O-32 월급 계획 저장 실패 → Toast 다시 시도 → 다시 만듦', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  let fail = 1;
  await page.route(`${SB}/rest/v1/rpc/onboarding_reset_plan`, (route) =>
    fail-- > 0
      ? route.fulfill({
          status: 500,
          body: '{}',
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      : route.fallback(),
  );
  await start(page);
  await manage(page, '아니요', '아직 없어요');
  await amount(page).fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await expect(page.getByText('잠시 문제가 생겼어요. 다시 시도해 주세요')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await heading(page, '10월 25일 월급날 아침에 알려 드릴까요?');
  expect(db.splits).toHaveLength(1);
});

test('첫 저금 끝: 이미 합류했으면 초대 시트 없이 홈', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await mockSpace(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  db.partner = { id: 'yebin', nickname: '예빈', monthly_income: 2_700_000, payday: 10 };
  Object.assign(db.me, {
    nickname: '찬우',
    monthly_income: 3_500_000,
    payday: 25,
    onboarding_done_at: NOW.toISOString(),
  });
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog', { name: '같이 모을 사람을 초대할까요?' })).toHaveCount(0);
});

test('O-32 휠 둘레 링은 키보드로 왔을 때만(손가락·마우스로 고르면 없음, 2026-11-11)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  Object.assign(db.me, { nickname: '찬우', onboarding_step: 'O-32', monthly_income: 3_500_000 });
  await page.goto('/onboarding/o-32');
  await heading(page, '월급날은 며칠이에요?');
  const wheel = page.locator('.hg-wheel');
  const col = wheel.getByRole('spinbutton');
  const ring = () => wheel.evaluate((el) => getComputedStyle(el).outlineStyle);
  await col.getByText('26일').click();
  await expect(col).toHaveAttribute('aria-valuenow', '26');
  await expect(col).toBeFocused();
  expect(await ring()).toBe('none');
  await col.press('ArrowDown');
  await expect(col).toHaveAttribute('aria-valuenow', '27');
  expect(await ring()).toBe('solid');
  await col.getByText('25일').click();
  expect(await ring()).toBe('none');
});
