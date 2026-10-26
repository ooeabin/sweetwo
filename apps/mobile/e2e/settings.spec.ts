import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { setWheel } from './wheel';

// 설정(docs/spec/25-settings.md S-10, S-11, S-11a, S-14, S-14a). 찬우(시작, 25일)와 합류한 예빈(10일), 웹

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-09-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'connected',
    salary_mode: 'separate',
    joint_cycle_day: null,
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_500_000,
    fixed_total: 1_000_000,
    living_budget: 550_000,
    loan_repayment: 300_000,
    split_mode: 'half',
    account_mode: 'roles',
    base_day: 25,
    base_day_last: false,
  };
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_500_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
  };
  db.assets.push({
    id: 'a-sav',
    side: 'asset',
    grp: 'deposit',
    kind: 'saving',
    name: '청년 적금',
    amount: 3_000_000,
    principal: null,
    maturity_date: '2026-10-30',
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });
  db.incomeEvents.push({
    id: 'ev',
    owner_user_id: db.me.id,
    name: '상여금',
    amount: 2_000_000,
    month: 11,
    yearly: true,
    created_at: '2026-09-21T00:00:00Z',
    deleted_at: null,
  });
}

const open = async (page: Page, narrow: boolean) => {
  await page.goto('/calendar/list');
  await page
    .locator(narrow ? '.hg-frame__mhead' : '.hg-topnav')
    .getByRole('button', { name: narrow ? '설정' : '설정 열기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
};

test('설정 홈(S-10) → 내 정보(S-11): 이름, 알림 이메일, 결혼·출생연도, 월급 묶음, 앞당기기, 로그아웃', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { split_mode: 'income', holiday_shift: true });
  db.me.notify_email = 'chanwoo@example.com';
  await open(page, info.project.name === 'narrow');

  const me = page.getByRole('button', { name: /찬우와 예빈/ });
  await expect(me).toContainText('카카오로 로그인했어요');
  await expect(page.locator('main').getByRole('button', { name: /^알림/ })).toContainText('이메일');
  await expect(page.getByText('예빈님과 연결됨')).toBeVisible();
  await axe(page);
  await me.click();

  await expect(page).toHaveURL(/\/settings\/me$/);
  await expect(page.getByRole('button', { name: /이름/ })).toContainText('찬우');
  await expect(page.getByRole('button', { name: /결혼 상태/ })).toContainText('했어요');
  // 내 월급 + 예빈 값 보기만, 관리 방식(각자면 체크리스트 만드는 날 없음)
  const salary = page.getByRole('button', { name: /내 월급/ });
  await expect(salary).toContainText('350만 원, 25일');
  await expect(salary).toContainText('예빈 250만 원, 10일');
  await expect(page.getByRole('button', { name: /월급 관리 방식/ })).toContainText('각자 관리해요');
  await expect(page.getByRole('button', { name: /체크리스트 만드는 날/ })).toHaveCount(0);
  // 알림 이메일: 형식 오류면 저장 안 됨
  const email = page.getByLabel('알림 이메일');
  await email.fill('chanwoo@');
  await expect(page.getByText('이메일 주소를 다시 확인해 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await email.fill(' New@Example.com ');
  await page.getByRole('button', { name: '저장' }).click();
  await expect.poll(() => db.me.notify_email).toBe('new@example.com');
  // 앞당기기 끄기(부부 공통)
  const shift = page.getByRole('switch', { name: '월급날이 쉬는 날이면 앞당겨 보여줘요' });
  await expect(shift).toHaveAttribute('aria-checked', 'true');
  await shift.click();
  await expect.poll(() => db.space?.holiday_shift).toBe(false);
  await axe(page);

  // 이름(S-11a)
  await page.getByRole('button', { name: /이름/ }).click();
  await expect(page.getByRole('heading', { name: '내 이름이나 애칭을 알려 주세요' })).toBeVisible();
  await page.getByLabel('이름').fill('찬우씨');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.me.nickname).toBe('찬우씨');

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('알림 설정(S-14, S-14a): 웹은 이메일만, 묶음 토글, 받는 방법 다 끄면 확인, 방해 금지 시간', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.locator('main').getByRole('button', { name: /^알림/ }).click();

  await expect(page).toHaveURL(/\/settings\/notifications$/);
  await expect(page.getByText('이메일은 한 달에 6번까지만 보내요')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'OS 알림' })).toHaveCount(0);
  const d14 = page
    .getByRole('region', { name: '챙길 날 D-14' })
    .getByRole('switch', { name: '이메일' });
  await expect(d14).toHaveAttribute('aria-checked', 'false');
  await d14.click();
  await expect
    .poll(
      () =>
        (db.me.noti_prefs as { topics?: { care_14?: { email?: boolean } } })?.topics?.care_14
          ?.email,
    )
    .toBe(true);
  await expect(page.getByRole('region', { name: '예빈님이 바꾼 값' })).toContainText(
    '분배표·관리 방식·목표 변경은 바로, 나머지는 월요일에 모아서 알려요',
  );
  await expect(page.getByRole('region', { name: '월급 체크리스트' })).toBeVisible();
  await expect(page.getByRole('region', { name: '제안' })).toHaveCount(0);
  await axe(page);

  // 받는 방법: 웹은 이메일 하나라 끄면 확인
  await page
    .getByRole('region', { name: '받는 방법' })
    .getByRole('switch', { name: '이메일' })
    .click();
  await expect(page.getByText('알림을 받을 방법이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '끄기' }).click();
  await expect.poll(() => (db.me.noti_prefs as { email?: boolean })?.email).toBe(false);
  await expect(d14).toBeDisabled();

  // 방해 금지 시간
  await expect(page.getByRole('button', { name: /방해 금지 시간/ })).toContainText(
    '밤 10시 ~ 아침 8시',
  );
  await page.getByRole('button', { name: /방해 금지 시간/ }).click();
  await expect(
    page.getByRole('heading', { name: '알림을 받지 않을 시간을 정해 주세요' }),
  ).toBeVisible();
  await page.getByLabel('시작').selectOption('23');
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);
  expect(db.me).toMatchObject({ quiet_start: 23 });
});

test('월급(S-11c), 관리 방식(S-11f → W-01), 체크리스트 만드는 날(S-11d), 결혼 상태·날짜(S-11g·h), 출생연도(S-11i)', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /찬우와 예빈/ }).click();

  // 내 월급
  await page.getByRole('button', { name: /내 월급/ }).click();
  await expect(page.getByRole('heading', { name: '한 달에 월급이 얼마 들어와요?' })).toBeVisible();
  await page.getByLabel('한 달에 월급이 얼마 들어와요?').fill('3800000');
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  expect(db.me.monthly_income).toBe(3_800_000);

  // 관리 방식: 합쳐서로 → 서버가 분배표를 합치고 W-01로
  await page.getByRole('button', { name: /월급 관리 방식/ }).click();
  await expect(page.getByRole('heading', { name: '월급을 어떻게 관리해요?' })).toBeVisible();
  await page.getByRole('radio', { name: '합쳐서 같이 관리해요' }).click();
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/salary\/split$/);
  expect(db.space?.salary_mode).toBe('joint');

  // 체크리스트 만드는 날(합쳐서 + 합류): 늦은 월급날이 기본
  await page.goto('/settings/me');
  await expect(page.getByRole('button', { name: /체크리스트 만드는 날/ })).toContainText(
    '늦은 월급날',
  );
  await page.getByRole('button', { name: /체크리스트 만드는 날/ }).click();
  await expect(page.getByRole('heading', { name: '체크리스트를 언제 만들까요?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '찬우 월급날 25일' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: '예빈 월급날 10일' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.space?.joint_cycle_day).toBe(10);

  // 결혼 상태 준비 중 → 예정일
  await page.getByRole('button', { name: /결혼 상태/ }).click();
  await page.getByRole('radio', { name: '준비 중이에요' }).click();
  await expect(page.getByRole('heading', { name: '결혼 예정일은 언제예요?' })).toBeVisible();
  await page.getByLabel('년', { exact: true }).fill('2027');
  await page.getByLabel('월', { exact: true }).fill('5');
  await page.getByLabel('일', { exact: true }).fill('15');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.space).toMatchObject({ marriage_status: 'engaged', wedding_date: '2027-05-15' });
  await expect(page.getByRole('button', { name: /결혼 예정일/ })).toContainText('2027년 5월 15일');

  // 출생연도
  await page.getByRole('button', { name: /출생연도/ }).click();
  await setWheel(page, '찬우님은 몇 년생이에요?', 1993);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.me.birth_year).toBe(1993);
});

test('부부 정보(S-12): 연결됨 예비부부 결혼 예정일 D-day', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { marriage_status: 'engaged', wedding_date: '2027-01-09' });
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /부부 정보/ }).click();
  await expect(page).toHaveURL(/\/settings\/couple$/);
  await expect(page.getByText('찬우 예빈')).toBeVisible();
  await expect(page.getByText('연결됨', { exact: true })).toBeVisible();
  await expect(page.getByText('결혼 예정일')).toBeVisible();
  await expect(page.getByText('2027년 1월 9일')).toBeVisible();
  await expect(page.getByText('D-94')).toBeVisible();
  await expect(page.getByText('초대 코드')).toHaveCount(0);
  await axe(page);
});

test('부부 정보(S-12): 미합류 초대 코드 만들기, 새 코드 받기, 만료', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;
  await open(page, info.project.name === 'narrow');
  await expect(page.getByRole('button', { name: /부부 정보/ })).toContainText('초대 중');
  await page.getByRole('button', { name: /부부 정보/ }).click();

  // 초대 전
  await expect(page.getByText('예빈님을 초대해 주세요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '초대 코드 만들기' }).click();
  await expect(page.getByText('K7M 2QX')).toBeVisible();
  await expect(page.getByText('10월 22일까지')).toBeVisible();
  await axe(page);

  // 새 코드 받기: 이전 코드는 바로 만료
  await page.getByRole('button', { name: '새 코드 받기' }).click();
  await expect(page.getByText('새 코드를 받았어요. 이전 코드는 이제 못 써요')).toBeVisible();
  await expect(page.getByText('K7M 2QX')).toHaveCount(0);
  await expect(page.getByText('R1N EWX')).toBeVisible();
  expect(db.invites.map((i) => i.code)).toEqual(['R1NEWX', 'K7M2QX']);
  expect(db.invites[1]?.expires_at).toBe('2026-10-01T00:00:00Z');

  // 만료
  const last = db.invites[0];
  if (last) last.expires_at = '2026-10-05T00:00:00Z';
  await page.reload();
  await expect(page.getByText('초대가 만료됐어요')).toBeVisible();
  await page.getByRole('button', { name: '새 코드 받기' }).click();
  await expect(page.getByText('초대가 만료됐어요')).toHaveCount(0);
  await expect(page.getByText('10월 22일까지')).toBeVisible();
  await axe(page);
});

test('연결 해제 요청(S-12a·c): 지워지는 것, “연결 해제” 입력, 대기(분배표 멈춤), 요청 취소', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /부부 정보/ }).click();
  await page.getByRole('button', { name: '연결 해제' }).click();

  // S-12a 안내: 나누지 않고 모두 지움
  await expect(page.getByRole('heading', { name: '연결을 해제할까요?' })).toBeVisible();
  await expect(page.getByText('해제되면 두 분이 같이 쓰던 데이터가 모두 지워져요')).toBeVisible();
  await expect(page.getByText('월급 분배표와 체크리스트')).toBeVisible();
  await expect(page.getByText('예빈님이 확인하거나 14일이 지나면 해제돼요')).toBeVisible();
  await expect(page.getByRole('button', { name: '먼저 내보내기' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  // S-12c 입력 후 요청
  const send = page.getByRole('button', { name: '연결 해제 요청하기' });
  await expect(
    page.getByRole('heading', { name: '확인을 위해 ‘연결 해제’라고 적어 주세요' }),
  ).toBeVisible();
  await expect(send).toBeDisabled();
  await page.getByLabel('연결 해제').fill('연결해제');
  await expect(send).toBeDisabled();
  await page.getByLabel('연결 해제').fill('연결 해제');
  await axe(page);
  await send.click();
  await expect(page.getByText('예빈님에게 연결 해제를 요청했어요')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/couple$/);
  await expect(page.getByText('예빈님 답을 기다리고 있어요')).toBeVisible();
  await expect(page.getByText('예빈님이 확인하거나 10월 21일이 되면 해제돼요')).toBeVisible();
  await expect(page.getByText('해제 전까지 분배표를 고칠 수 없어요')).toBeVisible();
  await axe(page);

  // 요청 취소 → 연결
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('연결 해제 요청을 취소했어요')).toBeVisible();
  await expect(page.getByText('연결됨', { exact: true })).toBeVisible();
  expect(db.unlinks[0]?.status).toBe('cancelled');
});

test('연결 해제 요청 받음(S-12, S-12d) → 확인했어요 → 해제 안내(S-12h) → 시작하기(O-11)', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending' });
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-1',
    requested_by: 'yebin',
    requested_at: '2026-10-05T01:00:00Z',
    deadline: '2026-10-19',
    ratio: 50,
    plan: [],
    status: 'pending',
    cancelled_at: null,
    confirmed_at: null,
  });
  await open(page, info.project.name === 'narrow');
  await expect(page.getByRole('button', { name: /부부 정보/ })).toContainText('연결 해제 대기 중');
  await page.getByRole('button', { name: /부부 정보/ }).click();
  await expect(page.getByText('예빈님이 연결 해제를 요청했어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '요청 취소' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(
    page.getByRole('heading', { name: '예빈님이 연결 해제를 요청했어요' }),
  ).toBeVisible();
  await expect(page.getByText('10월 19일에 해제돼요')).toBeVisible();
  await expect(page.getByText('해제되면 두 분이 같이 쓰던 데이터가 모두 지워져요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다르게 정리하기' })).toHaveCount(0);
  await axe(page);

  await page.getByRole('button', { name: '확인했어요' }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/unlinked$/);
  await expect(page.getByRole('heading', { name: '연결이 해제됐어요' })).toBeVisible();
  await expect(
    page.getByText('같이 쓰던 데이터는 지웠어요. 혼자 쓰기로 처음부터 시작해요'),
  ).toBeVisible();
  await expect(page.getByText('30일 안에 다시 연결하면 되돌릴 수 있어요')).toBeVisible();
  expect(db.unlinks[0]?.status).toBe('confirmed');
  expect(db.goals).toHaveLength(0);
  await axe(page);
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page).toHaveURL(/\/onboarding\/o-11$/);
});

const soloAfterUnlink = (db: MemDb, reconnectBy: string | null = null) => {
  Object.assign(db.space ?? {}, { couple_state: 'solo', partner_nickname: null });
  db.partner = null;
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-old',
    requested_by: db.me.id,
    partner_id: 'yebin',
    requested_at: '2026-09-20T01:00:00Z',
    deadline: '2026-10-04',
    ratio: 50,
    plan: [],
    status: 'confirmed',
    how: 'agreed',
    confirmed_at: '2026-10-01T01:00:00Z',
    reconnect_until: '2026-10-31T01:00:00Z',
    reconnect_by: reconnectBy,
    reconnect_answer: null,
  });
};

test('혼자 쓰기(S-12): 다시 연결하기, 새로 초대하기', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  soloAfterUnlink(db);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /부부 정보/ }).click();
  await expect(page.getByText('혼자 쓰는 중')).toBeVisible();
  await expect(page.getByText('10월 31일까지 다시 연결할 수 있어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다시 연결하기' }).click();
  await expect(page.getByText('예빈님에게 다시 연결하자고 했어요')).toBeVisible();
  await expect(page.getByText('예빈님 답을 기다리고 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 연결하기' })).toHaveCount(0);

  await page.getByRole('button', { name: '새로 초대하기' }).click();
  await expect(page.getByText('배우자를 초대해 주세요')).toBeVisible();
  expect(db.space?.couple_state).toBe('not_joined');
  await axe(page);
});

test('다시 연결 요청 받음: 할 일 → S-12g → 다시 연결할게요', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  soloAfterUnlink(db, 'yebin');
  await page.goto('/month');
  await page.getByRole('button', { name: /예빈님이 다시 연결하자고 해요/ }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/reconnect$/);
  await expect(page.getByRole('heading', { name: '예빈님이 다시 연결하자고 해요' })).toBeVisible();
  await expect(
    page.getByText('연결을 끊기 전 같이 쓰던 목표와 분배표가 돌아와요. 해제 뒤 새로 적은 내용은 지워져요'),
  ).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다시 연결할게요' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.unlinks[0]?.status).toBe('reconnected');
});

const myStock = (db: MemDb, extra: Record<string, unknown> = {}) =>
  db.assets.push({
    id: 'a-stock',
    side: 'asset',
    grp: 'invest',
    kind: 'stock',
    name: '찬우 주식',
    amount: 2_000_000,
    principal: null,
    maturity_date: null,
    owner: 'person',
    owner_user_id: db.me.id,
    visibility: 'sum',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
    ...extra,
  });

test('공개 범위(S-13): 새 항목 기본값, 이미 있는 항목도 바꾸기, 항목별', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db);
  await open(page, info.project.name === 'narrow');
  const row = page.getByRole('button', { name: /공개 범위/ });
  await expect(row).toContainText('내 자산 금액만 보여 주기');
  await row.click();
  await expect(page).toHaveURL(/\/settings\/visibility$/);
  await expect(page.getByText('월급과 분배표는 늘 같이 봐요')).toBeVisible();
  await axe(page);

  await page.getByLabel('새 항목 기본값').selectOption('private');
  await expect(page.getByText('이미 있는 항목 1개도 바꿀까요?')).toBeVisible();
  await page.getByRole('button', { name: '모두 바꾸기' }).click();
  await expect.poll(() => db.me.default_visibility).toBe('private');
  await expect.poll(() => db.assets.find((a) => a.id === 'a-stock')?.visibility).toBe('private');

  await page.getByLabel('찬우 주식 공개 범위').selectOption('all');
  await expect.poll(() => db.assets.find((a) => a.id === 'a-stock')?.visibility).toBe('all');
  await axe(page);
});

test('휴지통(S-21): 되살리기(연결된 부부 목표도 바로), 영구 삭제', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db, { deleted_at: '2026-10-03T01:00:00Z' });
  db.assets.push({
    id: 'a-old',
    side: 'debt',
    grp: 'loan',
    kind: 'credit',
    name: '옛 대출',
    amount: 1_000_000,
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-08-01T00:00:00Z',
    deleted_at: '2026-10-01T01:00:00Z',
  });
  db.goals.push({
    id: 'g-trip',
    space_id: 'space-1',
    template: 'travel',
    name: '여행',
    kind: 'once',
    priority: 2,
    status: 'active',
    target_amount: 3_000_000,
    deleted_at: '2026-10-05T01:00:00Z',
  });
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /데이터/ }).click();
  await expect(page).toHaveURL(/\/settings\/data$/);
  await page.getByRole('button', { name: /휴지통/ }).click();
  await expect(page).toHaveURL(/\/settings\/trash$/);
  await expect(page.getByText('지운 항목은 30일 뒤 완전히 지워져요')).toBeVisible();
  await expect(page.getByText('10월 3일에 지웠어요')).toBeVisible();
  await expect(page.getByText('26일 남음')).toBeVisible();
  await axe(page);

  const rowOf = (name: string) => page.locator('.hg-listrow').filter({ hasText: name });
  await rowOf('찬우 주식').getByRole('button', { name: '되살리기' }).click();
  await expect(page.getByText('되살렸어요')).toBeVisible();
  await expect.poll(() => db.assets.find((a) => a.id === 'a-stock')?.deleted_at).toBeNull();

  await rowOf('여행').getByRole('button', { name: '되살리기' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'g-trip')?.deleted_at).toBeNull();

  await rowOf('옛 대출').getByRole('button', { name: '옛 대출 더보기' }).click();
  await page.getByRole('menuitem', { name: '영구 삭제' }).click();
  await expect(page.getByRole('alertdialog', { name: '완전히 지울까요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '지울게요' }).click();
  await expect(page.getByText('완전히 지웠어요')).toBeVisible();
  expect(db.assets.some((a) => a.id === 'a-old')).toBe(false);
});

test('데이터(S-18): 내보내기 zip, 사용 기록 보내기, 휴지통 개수', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db, { visibility: 'all' });
  await page.goto('/settings/data');
  await expect(page.getByRole('button', { name: /휴지통/ })).toContainText('0개');
  await expect(page.getByText(/사진은 내보내기에 들어가지 않아요/)).toBeVisible();
  await axe(page);
  const toggle = page.getByRole('switch', { name: '사용 기록 보내기' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect.poll(() => db.me.analytics_off).toBe(true);

  // 웹 본인 확인(다시 로그인) 뒤 돌아온 것처럼 ?export=mine
  const dl = page.waitForEvent('download');
  await page.goto('/settings/data?export=mine');
  const file = await dl;
  expect(file.suggestedFilename()).toBe('sweetwo-mine-20261007.zip');
  const path = await file.path();
  const bytes = (await import('node:fs')).readFileSync(path);
  const text = bytes.toString('utf8');
  expect(text).toContain('자산.csv');
  expect(text).toContain('찬우 주식');
  expect(text).not.toContain('청년 적금'); // 공동 항목은 ‘공동 데이터’에
});

test('계정 삭제(S-18b) → 로그아웃, 다시 로그인하면 삭제 취소', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  myStock(db);
  await page.goto('/settings/data');
  await page.getByRole('button', { name: /계정 삭제/ }).click();
  await expect(page).toHaveURL(/\/settings\/data\/delete$/);
  await expect(page.getByText('내 명의 항목 1개는 지워져요')).toBeVisible();
  await expect(page.getByText('공동 항목은 예빈님에게 남아요')).toBeVisible();
  await expect(page.getByText('30일 안에 다시 로그인하면 복구돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '카카오로 확인하고 삭제' }).click();
  const dialog = page.getByRole('alertdialog', { name: '계정을 삭제할까요?' });
  await expect(dialog).toBeVisible();
  await axe(page);
  await dialog.getByRole('button', { name: '카카오로 확인하고 삭제' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText('계정 삭제 요청을 받았어요. 11월 6일까지 다시 로그인하면 취소할 수 있어요'),
  ).toBeVisible();
  expect(db.me.status).toBe('deletion_requested');
});

test('삭제 요청한 계정으로 다시 로그인: 계정 삭제를 취소할까요?', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.me.status = 'deletion_requested';
  await page.goto('/month');
  await expect(page.getByRole('heading', { name: '계정 삭제를 취소할까요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '취소하고 계속 쓰기' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.me.status).toBe('active');
});

test('도움말(S-20) 검색 → 문의하기(S-19a) → 내 문의, 열람 동의(S-19b)', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /도움말/ }).click();
  await expect(page).toHaveURL(/\/settings\/help$/);
  await expect(page.getByRole('heading', { name: '시작하기' })).toBeVisible();
  await page.getByRole('button', { name: '계좌를 연결하지 않나요?' }).click();
  await expect(page.getByText(/계좌·카드 연동 없이 직접 입력해요/)).toBeVisible();
  await axe(page);
  const search = page.getByRole('searchbox', { name: '자주 묻는 질문에서 찾기' });
  await search.fill('초대 코드');
  await expect(page.getByRole('button', { name: '배우자는 어떻게 초대하나요?' })).toBeVisible();
  await search.fill('우주선');
  await expect(page.getByText('찾는 답이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '문의하기' }).first().click();

  // 문의하기
  await expect(page).toHaveURL(/\/settings\/help\/inquiry$/);
  await page.getByLabel('분류').selectOption('couple');
  await page.getByLabel('내용').fill('예빈이 합류 코드를 넣었는데 연결이 안 돼요');
  await axe(page);
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText('문의 #A-10001를 받았어요')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/help\/inquiries$/);
  expect(db.inquiries[0]?.attach).toMatchObject({ couple_state: 'connected', platform: 'web' });

  // 운영자 답변과 열람 요청이 왔다고 치고
  Object.assign(db.inquiries[0] ?? {}, {
    status: 'waiting_user',
    access_request: [
      {
        id: 'ar-1',
        status: 'requested',
        scope: ['income_spend'],
        raw_amount: false,
        expires_at: null,
      },
    ],
  });
  (db.inquiries[0]?.inquiry_message as unknown[]).push({
    id: 'm-admin',
    author: 'admin',
    body: '확인해 볼게요',
    created_at: '2026-10-07T03:00:00Z',
  });
  await page.reload();
  await page.getByRole('button', { name: /문의 #A-10001/ }).click();
  await expect(page.getByText('확인해 볼게요')).toBeVisible();
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByText('동의하면 24시간만 봐요')).toBeVisible();
  await expect(page.getByText('월 수입·지출 화면')).toBeVisible();
  await expect(page.getByText('금액은 구간으로')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '동의해요' }).click();
  await expect(page.getByText('상담원이 확인 중이에요')).toBeVisible();
  await page.getByRole('button', { name: '지금 그만 보게 하기' }).click();
  await expect(page.getByText('이제 운영자는 볼 수 없어요')).toBeVisible();
});

test('보안(S-15, 웹): 로그인된 기기, 기기별 로그아웃, 모든 기기에서 로그아웃', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.sessions.push({
    id: 's-win',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537',
    created_at: '2026-09-01T00:00:00Z',
    last_used_at: '2026-10-03T00:00:00Z',
    current: false,
  });
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /보안/ }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByText('지금 이 기기')).toBeVisible();
  await expect(page.getByText('Chrome(Windows)')).toBeVisible();
  await expect(page.getByText('10월 3일에 마지막으로 썼어요')).toBeVisible();
  // 웹은 기기 목록만(앱 잠금 없음)
  await expect(page.getByRole('switch', { name: '앱 잠금' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByText('그 기기에서 로그아웃했어요')).toBeVisible();
  await expect(page.getByText('Chrome(Windows)')).toHaveCount(0);
  await page.getByRole('button', { name: '모든 기기에서 로그아웃' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
