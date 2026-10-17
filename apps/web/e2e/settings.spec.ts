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
  await expect(page.getByText('통장 잔액보다 많이 넣을 수 없어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await young.fill('1000000');
  await expect(page.getByText('1,492만')).toBeVisible();
  await expect(page.getByText('1,208만')).toBeVisible();
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

test('연결 해제 요청 받음(S-12, S-12d 보기)', async ({ page }, info) => {
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
});
