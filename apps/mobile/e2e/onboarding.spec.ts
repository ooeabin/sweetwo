import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fakeBridge, fb } from './fake-bridge';
import { chanwoo, SB } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 온보딩(docs/spec/16-onboarding-1.md, 17-onboarding-2.md, 재기획 ADR 0003, 목표 고르기 O-21은 ADR 0007로 없앰).
// 2026-11-10 QA 2구간: O-10 첫 화면, O-12 결혼한 날, O-13 출생연도, 이어하기 질문 화면을 뺌 → O-03 → O-06 (→ O-07) → O-11 → O-30 → O-31 → O-32 → O-60.
// 찬우가 처음 시작하고 예빈은 아직 미합류. 기획서 예시: 실수령 350만, 월급날 25일.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const next = (page: Page) => page.getByRole('button', { name: '다음' }).click();
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

/** O-03 → O-06(나중에 할게요) → O-11 */
async function start(page: Page) {
  await page.goto('/');
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  // O-10을 뺌: 첫 화면은 이름, 진행 막대는 있고 뒤로는 없음
  await expect(page.getByRole('progressbar', { name: '온보딩 진행' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '뒤로' })).toHaveCount(0);
  await axe(page);
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await heading(page, '같이 쓸 사람을 초대할까요?');
  await expect(page.getByRole('radio', { name: '지금 초대할게요' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '나중에 할게요' }).click();
  await heading(page, '두 사람은 어떤 사이예요?');
}

/** O-11 → O-30(각자) → O-31 */
async function toSalary(page: Page, status = '결혼했어요') {
  await page.getByRole('radio', { name: status }).click();
  await heading(page, '월급을 어떻게 관리해요?');
  await next(page);
  await heading(page, '한 달 실수령액은 얼마예요?');
}

test('신혼부부: 이름부터 첫 체크리스트까지 7화면(결혼한 날·출생연도 없음), 분석 이벤트, 홈 큰 상자 → W-11', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  const ev = events(page);
  await start(page);
  await axe(page);
  await toSalary(page);
  await expect(page.getByRole('heading', { name: /몇 년생이에요/ })).toHaveCount(0);
  // 금액 칸에 처음 포커스(S2-12)
  await expect(amount(page)).toBeFocused();
  await amount(page).fill('3500000');
  await axe(page);
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  const day = page.getByRole('spinbutton', { name: '월급날은 며칠이에요?' });
  await expect(day).toHaveAttribute('aria-valuetext', '25일');
  await expect(page.getByText('맨 아래에 ‘말일’도 있어요')).toBeVisible();
  // 29~31일을 고르면 짧은 달 안내(S2-24)
  await day.focus();
  for (let i = 0; i < 5; i++) await day.press('ArrowDown');
  await expect(day).toHaveAttribute('aria-valuetext', '30일');
  await expect(page.getByText('짧은 달은 말일로 계산해요')).toBeVisible();
  for (let i = 0; i < 5; i++) await day.press('ArrowUp');
  await axe(page);
  await next(page);
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('25일 월급 체크리스트를 만들었어요')).toBeVisible();
  await expect(page.getByText('첫 저금은 체크리스트에서 추가해요')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '홈으로 가기' }).click();
  await expect(page).not.toHaveURL(/onboarding/);

  expect(db.me).toMatchObject({
    nickname: '찬우',
    birth_year: null,
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
  });
  expect(db.me.onboarding_done_at).toBeTruthy();
  expect(db.space).toMatchObject({ marriage_status: 'married', salary_mode: 'separate' });
  expect(db.space?.wedding_date ?? null).toBeNull();
  // 추천 월급 계획(17 O-50 추천값): 고정지출 88만, 생활비 88만, 용돈 35만, 저금 줄 없음
  expect(db.splits).toHaveLength(1);
  expect(db.splits[0]?.owner_user_id).toBe(chanwoo.id);
  expect(lines(db)[0]).toEqual([
    ['fixed', 880_000],
    ['living', 880_000],
    ['allowance', 350_000],
  ]);
  expect(db.checklists).toHaveLength(1);

  // 분석 이벤트(32 4-3, S2-04)
  await expect.poll(() => ev.some((e) => e.name === 'onboarding_completed')).toBe(true);
  const names = ev.map((e) => e.name);
  expect(names).toContain('onboarding_started');
  expect(names.filter((n) => n === 'onboarding_step_viewed').length).toBeGreaterThanOrEqual(6);
  expect(ev.find((e) => e.name === 'onboarding_step_skipped')?.props).toEqual({
    screen_id: 'O-06',
  });
  expect(
    ev.find((e) => e.name === 'onboarding_step_completed' && e.props.screen_id === 'O-31')?.props,
  ).toMatchObject({ answer: 'input', changed_after_back: false });
  expect(ev.find((e) => e.name === 'onboarding_completed')?.props).toMatchObject({
    salary_mode: 'separate',
    income_band: '300-1000만',
    split_left_band: '100-300만',
    no_income: false,
  });

  // 홈 큰 상자 → W-02 첫 저금 빈 줄 → W-11a 저금 추가 → 매달 금액은 빈 칸, 보조 = 여유 자금 139만
  await page.locator('.hg-hubline').click();
  await page.getByRole('button', { name: '저금 추가 (여유 자금 139만 원)' }).click();
  await heading(page, '무엇을 위해 모을까요?');
  await page.getByLabel('무엇을 위해 모을까요?').fill('내 집 마련');
  await next(page);
  await heading(page, '매달 얼마씩 모을까요?');
  await expect(page.getByText('지금 여유 자금 139만 원')).toBeVisible();
  await page.getByLabel('매달 얼마씩 모을까요?').fill('950000');
  await next(page);
  await page.getByLabel('모으고 싶은 목표 금액이 있나요?').fill('150000000');
  await next(page);
  await heading(page, '언제까지 모을까요?');
  await page.getByRole('button', { name: '기한 없이 모을게요' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/[0-9a-f-]{36}$/);

  // 끝난 뒤 뒤로(웹뷰 기록)로 온보딩 화면에 오면 홈으로(S2-01)
  await page.goto('/onboarding/o-32');
  await expect(page).not.toHaveURL(/onboarding/);
});

test('O-07 초대 코드 시트: 링크 복사 = invite_sent, 앱은 브리지 공유 글(S2-05), 시트를 닫으면 O-11(복사 토스트는 닫힘), O-11 뒤로는 O-06(S2-15)', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.clock.setFixedTime(NOW);
  await mockOnboarding(page, { now: NOW });
  await fakeBridge(page, { signedIn: true, pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  const ev = events(page);
  await page.goto('/');
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await page.getByRole('radio', { name: '지금 초대할게요' }).click();
  const sheet = page.getByRole('dialog', { name: '이 코드를 보내 주세요' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('눌러서 복사')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '나중에 보낼게요' })).toBeVisible();
  await axe(page);
  await sheet.getByRole('button', { name: '카톡으로 보내기' }).click();
  await expect.poll(async () => (await fb(page)).shared.length).toBe(1);
  const shared = (await fb(page)).shared[0];
  expect(shared?.text).toMatch(
    /^찬우님이 sweeTwo에 초대했어요\. 초대 코드 [A-Z0-9]{6} https:\/\/app\.sweetwo\.kr\/i\/[A-Z0-9]{6}$/,
  );
  await expect(sheet.getByRole('button', { name: '다음' })).toBeVisible();
  await sheet.getByRole('button', { name: '링크 복사' }).click();
  await expect
    .poll(() => ev.filter((e) => e.name === 'invite_sent').map((e) => e.props.channel))
    .toEqual(['share', 'link']);
  await expect(page.locator('.hg-toast', { hasText: '복사했어요' })).toBeVisible();
  await sheet.getByRole('button', { name: '다음' }).click();
  await heading(page, '두 사람은 어떤 사이예요?');
  // 2026-11-11 화면이 바뀌면 그 화면의 토스트(‘복사했어요’)는 닫힘
  await expect(page.locator('.hg-toast')).toHaveCount(0);
  await back(page);
  await heading(page, '같이 쓸 사람을 초대할까요?');
  await expect(sheet).toHaveCount(0);
});

test('O-07에서 앱을 닫았다 열면 묻지 않고 시트, 닫으면 O-11(S2-03, 이어하기 질문 없음 Q4)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  const ev = events(page);
  await page.goto('/');
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await page.getByRole('radio', { name: '지금 초대할게요' }).click();
  const sheet = page.getByRole('dialog', { name: '이 코드를 보내 주세요' });
  await expect(sheet).toBeVisible();
  await expect.poll(() => db.me.onboarding_step).toBe('O-07');
  await page.goto('/'); // 앱 다시 열기(이번 실행의 상태가 사라짐)
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('heading', { name: '이어서 할까요?' })).toHaveCount(0);
  await sheet.getByRole('button', { name: '나중에 보낼게요' }).click();
  await heading(page, '두 사람은 어떤 사이예요?');
  await expect(page).toHaveURL(/\/onboarding\/o-11$/);
  await expect
    .poll(() => ev.find((e) => e.name === 'onboarding_resumed')?.props.screen_id)
    .toBe('O-07');
});

test('이어하기: 가장 멀리 간 화면으로 바로, 뒤로 가도 기록은 그대로(S2-23), 뺀 화면(O-12·O-13·O-10)은 옮김', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  await toSalary(page, '아직 안 정했어요');
  await expect.poll(() => db.me.onboarding_step).toBe('O-31');
  await back(page);
  await heading(page, '월급을 어떻게 관리해요?');
  await back(page);
  await heading(page, '두 사람은 어떤 사이예요?');
  await page.waitForTimeout(300);
  expect(db.me.onboarding_step).toBe('O-31');
  await page.goto('/');
  await heading(page, '한 달 실수령액은 얼마예요?');
  for (const [old, now] of [
    ['O-12', 'o-30'],
    ['O-13', 'o-30'],
    ['O-10', 'o-03'],
  ] as const) {
    db.me.onboarding_step = old;
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/onboarding/${now}$`));
  }
});

test('파트너가 이미 합류했으면 초대(O-06·O-07)를 건너뜀(S2-11)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await page.goto('/');
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await heading(page, '같이 쓸 사람을 초대할까요?');
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
  };
  db.me.onboarding_step = 'O-07';
  await page.goto('/');
  await heading(page, '두 사람은 어떤 사이예요?');
  await back(page);
  await heading(page, '내 이름이나 애칭을 알려 주세요');
});

test('‘지금은 월급이 없어요’: 확인 대화상자(S2-02), 뒤로 오면 빈 칸, 월급을 넣으면 추천값·체크리스트를 다시 만듦(S2-01)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  const ev = events(page);
  await start(page);
  await page.getByRole('radio', { name: '결혼 준비 중이에요' }).click();
  await heading(page, '월급을 어떻게 관리해요?');
  await page.getByRole('radio', { name: /합쳐서 같이 관리해요/ }).click();
  await next(page);
  await page.getByRole('button', { name: '지금은 월급이 없어요' }).click();
  const dialog = page.getByRole('alertdialog', { name: '월급 없이 시작할까요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('월급이 생기면 설정에서 넣을 수 있어요')).toBeVisible();
  await axe(page);
  await dialog.getByRole('button', { name: '다시 적을게요' }).click();
  await heading(page, '한 달 실수령액은 얼마예요?');
  expect(db.splits).toHaveLength(0);
  await page.getByRole('button', { name: '지금은 월급이 없어요' }).click();
  await dialog.getByRole('button', { name: '월급 없이 시작할게요' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('월급이 생기면 홈에서 알려 주세요')).toBeVisible();
  expect(db.splits[0]?.owner_user_id).toBeNull();
  expect(db.splits[0]?.split_line.every((l) => l.amount === 0)).toBe(true);
  expect(db.checklists).toHaveLength(0);

  // Android 하드웨어 뒤로(웹뷰 기록) → O-31은 0 대신 빈 칸, 오류 없음
  await page.goBack();
  await heading(page, '한 달 실수령액은 얼마예요?');
  await expect(amount(page)).toHaveValue('');
  await expect(page.getByText('0원보다 큰 금액을 넣어 주세요')).toHaveCount(0);
  await amount(page).fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('25일 월급 체크리스트를 만들었어요')).toBeVisible();
  expect(db.splits).toHaveLength(1);
  expect(lines(db)[0]).toEqual([
    ['fixed', 880_000],
    ['living', 880_000],
    ['allowance', 350_000],
  ]);
  expect(db.checklists).toHaveLength(1);
  await expect
    .poll(
      () =>
        ev.filter((e) => e.name === 'onboarding_step_completed' && e.props.screen_id === 'O-31')
          .length,
    )
    .toBe(2);
  expect(
    ev.filter((e) => e.name === 'onboarding_step_completed' && e.props.screen_id === 'O-31'),
  ).toEqual([
    expect.objectContaining({
      props: expect.objectContaining({ answer: 'none', changed_after_back: false }),
    }),
    expect.objectContaining({
      props: expect.objectContaining({ answer: 'input', changed_after_back: true }),
    }),
  ]);
});

test('O-60에서 뒤로 → 월급·월급날·관리 방식을 바꾸면 추천값과 첫 체크리스트를 다시 만듦(S2-01)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  await toSalary(page);
  await amount(page).fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await heading(page, '찬우님, 준비가 끝났어요');
  expect(db.checklists.map((c) => c.cycle_start)).toEqual(['2026-09-25']);
  await page.goBack();
  await page.goBack();
  await heading(page, '한 달 실수령액은 얼마예요?');
  await amount(page).fill('5000000');
  await next(page);
  // 이어하기 기록도 O-32로 되돌림(바꾼 답으로 다시 만들게)
  await expect.poll(() => db.me.onboarding_step).toBe('O-32');
  const day = page.getByRole('spinbutton', { name: '월급날은 며칠이에요?' });
  await day.focus();
  for (let i = 0; i < 15; i++) await day.press('ArrowUp');
  await expect(day).toHaveAttribute('aria-valuetext', '10일');
  await next(page);
  await heading(page, '찬우님, 준비가 끝났어요');
  await expect(page.getByText('10일 월급 체크리스트를 만들었어요')).toBeVisible();
  expect(lines(db)).toEqual([
    [
      ['fixed', 1_250_000],
      ['living', 1_250_000],
      ['allowance', 500_000],
    ],
  ]);
  expect(db.checklists.map((c) => c.cycle_start)).toEqual(['2026-09-10']);

  // 관리 방식 각자 → 합쳐서: 각자 월급 계획은 지우고 공동 월급 계획 하나
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await heading(page, '월급을 어떻게 관리해요?');
  await page.getByRole('radio', { name: /합쳐서 같이 관리해요/ }).click();
  await next(page);
  await heading(page, '한 달 실수령액은 얼마예요?');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await heading(page, '찬우님, 준비가 끝났어요');
  expect(db.splits.map((s) => s.owner_user_id)).toEqual([null]);
  expect(db.checklists.map((c) => c.owner_user_id)).toEqual([null]);
});

test('파트너가 온보딩 중에 먼저 합류 + 합쳐서: 두 사람 합으로 추천값(18 ‘시작한 사람이 아직 온보딩 중’)', async ({
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
  await page.getByRole('radio', { name: '결혼했어요' }).click();
  await page.getByRole('radio', { name: /합쳐서 같이 관리해요/ }).click();
  await next(page);
  await amount(page).fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await heading(page, '찬우님, 준비가 끝났어요');
  expect(db.splits[0]?.split_line.map((l) => [l.kind, l.user_id ?? null, l.amount])).toEqual([
    ['fixed', null, 1_550_000],
    ['living', null, 1_550_000],
    ['allowance', chanwoo.id, 350_000],
    ['allowance', 'yebin', 270_000],
  ]);
});

test('O-31 금액: 999억 넘으면 다음 비활성(S2-06), 10만 원 미만·1억 원 초과는 한 번 확인(S2-07), 소수점은 버림(S2-18)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  await start(page);
  await toSalary(page, '아직 안 정했어요');
  const btn = page.getByRole('button', { name: '다음' });
  await amount(page).fill('100000000000');
  await expect(page.getByText('999억 원까지 넣을 수 있어요')).toBeVisible();
  await expect(btn).toBeDisabled();
  await amount(page).fill('1234567890123');
  await expect(amount(page)).toHaveValue('100,000,000,000'); // 12자리 넘으면 더 받지 않음
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

test('Enter 키 = 주 버튼(S2-08): 휠·선택 화면과 O-60도, 넓은 창 Enter 안내와 같게', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  await mockOnboarding(page, { now: NOW });
  await page.goto('/');
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  await page.keyboard.type('찬우');
  await page.keyboard.press('Enter');
  await heading(page, '같이 쓸 사람을 초대할까요?');
  await page.keyboard.press('2');
  await heading(page, '두 사람은 어떤 사이예요?');
  await page.keyboard.press('3');
  await heading(page, '월급을 어떻게 관리해요?');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await heading(page, '한 달 실수령액은 얼마예요?');
  await page.keyboard.type('3500000');
  await page.keyboard.press('Enter');
  await heading(page, '월급날은 며칠이에요?');
  await page.keyboard.press('Enter');
  await heading(page, '찬우님, 준비가 끝났어요');
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/onboarding/);
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
  await heading(page, '같이 쓸 사람을 초대할까요?');
  expect(db.me.nickname).toBe(`${couple.repeat(6)}찬우`);
});

test('O-60 ‘홈으로 가기’ 저장 실패 → 토스트 다시 시도, 체크리스트 실패 뒤 다시 시도해도 체크리스트가 생김', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  let failCl = 1;
  await page.route(`${SB}/rest/v1/rpc/start_checklist`, (route) =>
    failCl-- > 0
      ? route.fulfill({
          status: 500,
          body: '{}',
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      : route.fallback(),
  );
  await start(page);
  await toSalary(page);
  await amount(page).fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await expect(page.getByText('잠시 문제가 생겼어요. 다시 시도해 주세요')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  expect(db.splits).toHaveLength(1);
  expect(db.checklists).toHaveLength(1);
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
