import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 설정(docs/spec/25-settings.md S-10, S-11, S-11a, S-14, S-14a). 찬우(시작, 25일)와 합류한 예빈(10일), 웹

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
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

test('설정 홈(S-10) → 내 정보(S-11): 호칭, 알림 이메일, 앞당기기, 분담 방식, 로그아웃', async ({
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
  await expect(page.getByRole('button', { name: /호칭/ })).toContainText('찬우');
  // 월급 플랜 날짜 25일(늦은 월급날), 버는 만큼 350만 : 250만 → 58 : 42
  await expect(page.getByText('늦은 월급날')).toBeVisible();
  await expect(page.getByText('버는 만큼 58 : 42')).toBeVisible();
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

  // 호칭(S-11a)
  await page.getByRole('button', { name: /호칭/ }).click();
  await expect(page.getByRole('heading', { name: '뭐라고 부르면 될까요?' })).toBeVisible();
  await page.getByLabel('호칭').fill('찬우씨');
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
    '주 1회 모아서, 수입 변경은 바로 알려요',
  );
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

test('신랑·신부(S-11b)는 둘 다 바뀜, 월급 플랜 날짜(S-11d)는 예빈님께 제안', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /찬우와 예빈/ }).click();

  await expect(page.getByRole('button', { name: /신랑·신부/ })).toContainText('신랑');
  await page.getByRole('button', { name: /신랑·신부/ }).click();
  await expect(page.getByRole('heading', { name: '신랑·신부 중 누구예요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '신부' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.me.side).toBe('bride');
  expect((db.partner as Record<string, unknown>).side).toBe('groom');

  await page.getByRole('button', { name: /월급 플랜 날짜/ }).click();
  await expect(page.getByRole('heading', { name: '월급 플랜을 언제 세울까요?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '찬우 월급날 25일' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('button', { name: '예빈님께 제안하기' })).toBeDisabled();
  await page.getByRole('radio', { name: '예빈 월급날 10일' }).click();
  await expect(page.getByText(/좋아요면 바로, 반대 없으면 .+부터 적용돼요/)).toBeVisible();
  await expect(
    page.getByRole('switch', { name: '월급날이 쉬는 날이면 앞당겨 보여줘요' }),
  ).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.proposals.at(-1)).toMatchObject({
    item: 'base_day',
    after: { base_day: 10, base_day_last: false },
    before: { base_day: 25, base_day_last: false },
  });
  // 열린 제안이 있으면 고르기 대신 제안 보기
  await page.getByRole('button', { name: /월급 플랜 날짜/ }).click();
  await expect(page.getByText('답을 기다리는 제안이 있어요')).toBeVisible();
  await page.getByRole('button', { name: '제안 보기' }).click();
  await expect(page).toHaveURL(/\/proposals\//);
  await expect(page.getByText('25일 → 10일')).toBeVisible();
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

const jointSaving = (db: MemDb) =>
  db.assets.push({
    id: 'a-joint',
    side: 'asset',
    grp: 'deposit',
    kind: 'saving',
    name: '공동 적금',
    amount: 24_000_000,
    principal: null,
    maturity_date: null,
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });

test('연결 해제 요청(S-12a~c): 분담 비율 기본안, 몫 고치기, “연결 해제” 입력, 대기 띠, 요청 취소', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { split_mode: 'income' });
  jointSaving(db);
  db.assets.push({
    id: 'a-loan',
    side: 'debt',
    grp: 'loan',
    kind: 'credit',
    name: '공동 대출',
    amount: 10_000_000,
    principal: null,
    maturity_date: null,
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /부부 정보/ }).click();
  await page.getByRole('button', { name: '연결 해제' }).click();

  // S-12a 안내
  await expect(page.getByRole('heading', { name: '연결을 해제할까요?' })).toBeVisible();
  await expect(page.getByText('예빈님이 동의하면 바로, 아니면 14일 뒤에 해제돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  // S-12b 자산 정리 안: 버는 만큼 350만 : 250만 → 58 : 42
  await expect(page.getByRole('heading', { name: '분담 비율 58 : 42로 정리했어요' })).toBeVisible();
  await expect(page.getByText('10월 21일까지 정하지 않으면 분담 비율로 정리해요')).toBeVisible();
  await expect(page.getByLabel('공동 적금 내 몫')).toHaveValue('13,920,000');
  await expect(page.getByText('예빈님 몫 1,008만')).toBeVisible();
  const young = page.getByLabel('청년 적금 내 몫');
  await expect(young).toHaveValue('1,740,000');
  await young.fill('4000000');
  await expect(page.getByText('금액보다 많이 넣을 수 없어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await young.fill('1000000');
  await expect(page.getByText('1,492만')).toBeVisible();
  await expect(page.getByText('1,208만')).toBeVisible();
  // 공동 부채도 정리 안에(분담 비율 기본 580만 : 420만), 합계는 자산, 부채 따로
  await expect(page.getByLabel('공동 대출 내 몫')).toHaveValue('5,800,000');
  await expect(page.getByText('예빈님 몫 420만')).toBeVisible();
  await expect(page.getByText('부채', { exact: true })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  // S-12c 입력 후 보내기
  const send = page.getByRole('button', { name: '보내기' });
  await expect(send).toBeDisabled();
  await page.getByLabel('연결 해제').fill('연결해제');
  await expect(send).toBeDisabled();
  await page.getByLabel('연결 해제').fill('연결 해제');
  await axe(page);
  await send.click();
  await expect(page.getByText('예빈님에게 연결 해제를 요청했어요')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/couple$/);
  await expect(page.getByText('예빈님 답을 기다리고 있어요')).toBeVisible();
  await expect(page.getByText('해제 전까지 멈춤')).toBeVisible();
  const plan = db.unlinks[0]?.plan as { name: string; mine: number }[];
  expect(plan.map((p) => [p.name, p.mine])).toEqual([
    ['공동 적금', 13_920_000],
    ['청년 적금', 1_000_000],
    ['공동 대출', 5_800_000],
  ]);
  await axe(page);

  // 이번 달: 해제 대기 띠 → 확인하기 → S-12
  await page.goto('/');
  await expect(page.getByText('연결 해제를 기다리고 있어요')).toBeVisible();
  await expect(page.getByText('10월 21일에 분담 비율대로 정리돼요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page).toHaveURL(/\/settings\/couple$/);

  // 요청 취소 → 연결
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('연결 해제 요청을 취소했어요')).toBeVisible();
  await expect(page.getByText('연결됨', { exact: true })).toBeVisible();
  expect(db.unlinks[0]?.status).toBe('cancelled');
});

test('연결 해제 요청 받음(S-12, S-12d) → 동의해요 → 혼자 쓰기(S-12h)', async ({ page }, info) => {
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
    ratio: 42,
    plan: [{ asset_id: 'a-sav', name: '청년 적금', amount: 3_000_000, mine: 1_260_000 }],
    status: 'pending',
    cancelled_at: null,
    confirmed_at: null,
  });
  await open(page, info.project.name === 'narrow');
  await expect(page.getByRole('button', { name: /부부 정보/ })).toContainText('연결 해제 대기 중');
  await page.getByRole('button', { name: /부부 정보/ }).click();
  await expect(page.getByText('예빈님이 연결 해제를 요청했어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '요청 취소' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '연결 해제' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '자산 정리 안 보기' }).click();
  await expect(page.getByRole('heading', { name: '분담 비율 42 : 58로 정리했어요' })).toBeVisible();
  await expect(page.getByText('예빈 126만, 찬우 174만')).toBeVisible();
  await expect(page.getByText('10월 19일까지 정하지 않으면 분담 비율로 정리해요')).toBeVisible();
  await axe(page);

  // 동의해요 → 바로 해제 확정(S-12h)
  await page.getByRole('button', { name: '동의해요' }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/unlinked$/);
  await expect(page.getByRole('heading', { name: '연결이 해제됐어요' })).toBeVisible();
  await expect(page.getByText('174만 원은 각자 목표로 옮겨요')).toBeVisible();
  await expect(page.getByText('30일 안에 다시 연결하면 되돌릴 수 있어요')).toBeVisible();
  expect(db.unlinks[0]?.status).toBe('confirmed');
  await axe(page);
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/$/);

  // 혼자 쓰기 S-12
  await page.goto('/settings/couple');
  await expect(page.getByText('혼자 쓰는 중')).toBeVisible();
  await expect(page.getByText('11월 6일까지 다시 연결할 수 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '연결 해제' })).toHaveCount(0);
  await axe(page);
});

const pendingFromYebin = (db: MemDb, counter: unknown = null, requestedBy = 'yebin') =>
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-1',
    requested_by: requestedBy,
    requested_at: '2026-10-05T01:00:00Z',
    deadline: '2026-10-19',
    ratio: 42,
    plan: [
      { asset_id: 'a-sav', name: '청년 적금', amount: 3_000_000, mine: 1_260_000, side: 'asset' },
    ],
    counter,
    status: 'pending',
    cancelled_at: null,
    confirmed_at: null,
  });

test('연결 해제 받은 사람: 할 일 맨 위 → 다르게 정리하기(S-12e)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending' });
  pendingFromYebin(db);
  await page.goto('/');
  const todo = page.getByRole('button', { name: /예빈님이 연결 해제를 요청했어요/ });
  await expect(todo).toContainText('10월 19일까지');
  await axe(page);
  await todo.click();
  await expect(page).toHaveURL(/\/settings\/couple\/unlink\/review$/);
  await page.getByRole('button', { name: '다르게 정리하기' }).click();

  await expect(page.getByRole('heading', { name: '어떻게 나눌지 다시 정해 주세요' })).toBeVisible();
  const mine = page.getByLabel('청년 적금 내 몫');
  await expect(mine).toHaveValue('1,740,000');
  await mine.fill('2000000');
  await expect(page.getByText('예빈님 몫 100만')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText('예빈님에게 다르게 정리한 안을 보냈어요')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/couple$/);
  await expect(page.getByText('예빈님 답을 기다리고 있어요')).toBeVisible();
  expect((db.unlinks[0]?.counter as { mine: number }[])[0]?.mine).toBe(1_000_000);

  // 다시 보면: 보낸 안내, 다르게 정리하기는 한 번만
  await page.goto('/settings/couple/unlink/review');
  await expect(page.getByText('다르게 정리한 안을 보냈어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다르게 정리하기' })).toHaveCount(0);
});

test('연결 해제 요청한 사람: 다르게 정리한 안 확인(S-12f) → 동의해요', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending' });
  // 찬우가 요청(58%), 예빈이 다르게: 찬우 100만, 예빈 200만
  pendingFromYebin(
    db,
    [{ asset_id: 'a-sav', name: '청년 적금', amount: 3_000_000, mine: 1_000_000, side: 'asset' }],
    String(db.me.id),
  );
  await open(page, info.project.name === 'narrow');
  await page.getByRole('button', { name: /부부 정보/ }).click();
  await expect(page.getByText('예빈님이 자산 정리 안을 다르게 정리했어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '요청 취소' })).toHaveCount(0);
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(
    page.getByRole('heading', { name: '예빈님이 자산 정리 안을 다르게 정리했어요' }),
  ).toBeVisible();
  await expect(
    page.getByText('동의하면 바로, 아니면 10월 19일에 분담 비율로 정리돼요'),
  ).toBeVisible();
  await expect(page.getByText('찬우 100만, 예빈 200만')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '동의해요' }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/unlinked$/);
  await expect(page.getByText('100만 원은 각자 목표로 옮겨요')).toBeVisible();
  expect(db.unlinks[0]?.how).toBe('counter');
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
    ratio: 58,
    plan: [
      { asset_id: 'a-sav', name: '청년 적금', amount: 3_000_000, mine: 1_740_000, side: 'asset' },
    ],
    final_plan: [
      { asset_id: 'a-sav', name: '청년 적금', amount: 3_000_000, mine: 1_740_000, side: 'asset' },
    ],
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
  await page.goto('/');
  await page.getByRole('button', { name: /예빈님이 다시 연결하자고 해요/ }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/reconnect$/);
  await expect(page.getByRole('heading', { name: '예빈님이 다시 연결하자고 해요' })).toBeVisible();
  await expect(page.getByText('연결을 끊기 전 공동 목표·통장이 돌아와요')).toBeVisible();
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
  await expect(row).toContainText('내 자산 합계만');
  await row.click();
  await expect(page).toHaveURL(/\/settings\/visibility$/);
  await expect(page.getByText('수입·용돈 금액 항상 공유')).toBeVisible();
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

test('휴지통(S-21): 되살리기, 연결된 부부 목표는 제안, 영구 삭제', async ({ page }, info) => {
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
  await expect(page.getByText('예빈님에게 되살리자고 제안했어요')).toBeVisible();
  expect(db.proposals.some((p) => p.item === 'goal_restore')).toBe(true);

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
  await page.goto('/');
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
