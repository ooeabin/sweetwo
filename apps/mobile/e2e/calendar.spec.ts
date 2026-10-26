import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 캘린더(docs/spec/24-calendar.md, 재기획): 돈 일정과 챙길 날. 찬우(월급날 25일)와 합류한 예빈(10일)

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
  db.goals.push(
    {
      id: 'g-trip',
      template: 'travel',
      name: '여행',
      kind: 'once',
      priority: 1,
      target_amount: 3_000_000,
      other_held: 500_000,
      deadline: '2026-11-01',
      status: 'active',
      owner_user_id: null,
      details: {},
      created_by: db.me.id,
      created_at: '2026-09-01T00:00:00Z',
      deleted_at: null,
    },
    {
      id: 'g-done',
      template: 'car',
      name: '자동차',
      kind: 'once',
      priority: 2,
      target_amount: 1_000_000,
      other_held: 1_000_000,
      deadline: '2026-10-20',
      status: 'achieved',
      owner_user_id: null,
      details: {},
      created_by: db.me.id,
      created_at: '2026-09-01T00:00:00Z',
      deleted_at: null,
    },
  );
}

const care = (o: Record<string, unknown>) => ({
  id: 'c-1',
  category: 'couple',
  kind: 'custom',
  name: '어머니 생신',
  member_id: null,
  side: null,
  date_rule: 'solar_yearly',
  month: 10,
  day: 20,
  leap: false,
  once_on: null,
  budget: 300_000,
  carer: 'together',
  alerts: [30, 7],
  status: 'todo',
  status_on: null,
  memo: null,
  secret: false,
  auto: null,
  auto_moves: true,
  created_by: 'chanwoo',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  deleted_at: null,
  ...o,
});

test('목록(Y-01): 60일 안 돈 일정(월급날, 월급 확인, 목표 기한, 만기), 누르면 해당 화면, 빈 상태, 필터', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar');
  await expect(page).toHaveURL(/\/calendar\/list$/);
  await expect(page.getByText('생일, 기념일, 명절을 적어 두면 미리 알려 드려요')).toBeVisible();
  const money = page.getByRole('region', { name: '돈 일정' });
  // 예빈 월급날 10일(토) → 9일(금), 월급 확인 22일, 찬우 월급날 25일(일) → 23일(금), 만기 30일, 여행 기한 11월 1일
  const rows = await money.getByRole('button').allTextContents();
  expect(rows[0]).toContain('예빈 월급날');
  expect(rows[0]).toContain('10월 9일');
  const all = rows.join('|');
  expect(all).toContain('월급 확인');
  expect(all).toContain('청년 적금 만기');
  expect(all).toContain('여행 기한');
  // 달성한 목표 기한은 없음
  expect(all).not.toContain('자동차 기한');
  await axe(page);

  await page.getByRole('button', { name: '챙길 날', exact: true }).click();
  await expect(money).toHaveCount(0);
  await page.getByRole('button', { name: '돈 일정', exact: true }).click();
  await expect(page.getByText('생일, 기념일, 명절을 적어 두면 미리 알려 드려요')).toHaveCount(0);
  await page.getByRole('button', { name: /여행 기한/ }).click();
  await expect(page).toHaveURL(/\/goals\/g-trip$/);
  await page.goto('/calendar/list');
  await page.getByRole('button', { name: /청년 적금 만기/ }).click();
  await expect(page).toHaveURL(/\/assets\/a-sav$/);
});

test('달력(Y-04): 돈 일정 점, 월말 확인 띠(→ W-05), 고른 날 일정 → 화면, 달 넘기기, 보기 기억', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar/month');
  await expect(page.getByRole('button', { name: '10월 7일' })).toHaveAttribute(
    'aria-current',
    'date',
  );
  await expect(page.getByText('이 날짜엔 없어요')).toBeVisible();
  await axe(page);

  const d23 = page.getByRole('button', { name: '10월 23일, 일정 1개' });
  await expect(d23).toHaveClass(/is-band/);
  await page.getByRole('button', { name: '10월 22일, 일정 1개' }).click();
  await page.getByRole('button', { name: /9월 월급, 빠진 게 있는지 확인할 때예요/ }).click();
  await expect(page).toHaveURL(/\/salary\/review$/);
  await page.goto('/calendar/month');
  await page.getByRole('button', { name: '10월 23일, 일정 1개' }).click();
  await expect(page.getByText('10월 23일(금)')).toBeVisible();
  await page.getByRole('button', { name: /찬우 월급날/ }).click();
  await expect(page).toHaveURL(/\/salary$/);

  await page.goto('/calendar');
  await expect(page).toHaveURL(/\/calendar\/month$/);
  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(page.getByRole('region', { name: '2026년 11월' })).toBeVisible();
  await page.getByRole('button', { name: '11월 1일, 일정 1개' }).click();
  await expect(page.getByRole('button', { name: /여행 기한/ })).toBeVisible();
  // 챙길 날만 보면 돈 일정 점·띠 없음
  await page.getByRole('button', { name: '챙길 날', exact: true }).click();
  await expect(page.getByRole('button', { name: '11월 1일' })).toBeVisible();
});

test('챙길 날 추가(Y-07): 이름 칩, 음력 매년, 명절은 날짜 건너뜀, 지난 날 안내, 달력에서 날짜 채움', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/calendar/list');
  await page.getByRole('button', { name: '+ 추가' }).click();
  await expect(page.getByRole('heading', { name: '어떤 날이에요?' })).toBeVisible();
  await expect(page.getByLabel('어떤 날이에요?')).toHaveAttribute('placeholder', '예: 어머니 생신');
  await axe(page);
  await page.getByRole('button', { name: '생일', exact: true }).click();
  await expect(page.getByLabel('어떤 날이에요?')).toHaveValue('생일');
  await page.getByLabel('어떤 날이에요?').fill('어머니 생신');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '언제예요?' })).toBeVisible();
  await page.getByRole('tab', { name: '음력' }).click();
  await page.getByLabel('년', { exact: true }).fill('2026');
  await page.getByLabel('월', { exact: true }).fill('8');
  await page.getByLabel('일', { exact: true }).fill('3');
  await expect(page.getByRole('switch', { name: '매년 돌아와요' })).toBeChecked();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '쓸 돈을 메모해 둘까요?' })).toBeVisible();
  await page.getByLabel('쓸 돈을 메모해 둘까요?').fill('300000');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.cares.at(-1)).toMatchObject({
    name: '어머니 생신',
    category: 'couple',
    kind: 'birthday',
    date_rule: 'lunar_yearly',
    month: 8,
    day: 3,
    budget: 300_000,
  });

  // 추석: 날짜를 채우고 건너뜀, 금액은 건너뛰기
  await page.getByRole('button', { name: '+ 추가' }).click();
  await page.getByRole('button', { name: '추석', exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '쓸 돈을 메모해 둘까요?' })).toBeVisible();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.cares.at(-1)).toMatchObject({
    name: '추석',
    date_rule: 'lunar_yearly',
    month: 8,
    day: 15,
    budget: 0,
  });

  // 행사(한 번): 지난 날이면 안내 + 다음 꺼짐
  await page.getByRole('button', { name: '+ 추가' }).click();
  await page.getByRole('button', { name: '행사', exact: true }).click();
  await page.getByLabel('어떤 날이에요?').fill('민지 결혼식');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('switch', { name: '매년 돌아와요' })).not.toBeChecked();
  await page.getByLabel('년', { exact: true }).fill('2026');
  await page.getByLabel('월', { exact: true }).fill('9');
  await page.getByLabel('일', { exact: true }).fill('1');
  await expect(page.getByText('이미 지난 날이에요. 기록으로 남길까요?')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await page.getByLabel('월', { exact: true }).fill('11');
  await page.getByLabel('일', { exact: true }).fill('21');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.cares.at(-1)).toMatchObject({
    name: '민지 결혼식',
    kind: 'event',
    date_rule: 'once',
    once_on: '2026-11-21',
  });

  // 달력에서 고른 날 → 날짜 채움
  await page.getByRole('tab', { name: '달력' }).click();
  await page.getByRole('button', { name: /^10월 30일/ }).click();
  await page.getByRole('button', { name: '이 날에 챙길 날 추가' }).click();
  await page.getByLabel('어떤 날이에요?').fill('집들이');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByLabel('일', { exact: true })).toHaveValue('30');
});

test('상세(Y-05)와 기록(Y-08): 7일 지난 날 기록하기, 목표 고르기 → 꺼내 쓰기(금액 채움), 수정, 지우기 되돌리기', async ({
  page,
}) => {
  const DAY = new Date('2026-10-14T20:00:00+09:00');
  await page.clock.setFixedTime(DAY);
  const db = await mockOnboarding(page, { now: DAY });
  seed(db);
  db.cares.push(
    care({
      id: 'c-wed',
      kind: 'event',
      name: '민지 결혼식',
      date_rule: 'once',
      month: null,
      day: null,
      once_on: '2026-10-05',
      budget: 100_000,
    }),
    care({ id: 'c-mom' }),
  );

  await page.goto('/calendar/list');
  const overdue = page.getByRole('region', { name: '기록하기' });
  await expect(overdue).toContainText('민지 결혼식');
  const next = page.getByRole('region', { name: '다음 챙길 날' });
  await expect(next).toContainText('D-6');
  await expect(next).toContainText('30만 원 생각해 뒀어요');
  await axe(page);

  await overdue.getByRole('button', { name: /민지 결혼식/ }).click();
  await expect(page.getByRole('heading', { name: '얼마 썼어요?' })).toBeVisible();
  await expect(page.getByLabel('얼마 썼어요?')).toHaveValue('100,000');
  await expect(
    page.getByText('목표에 모은 돈으로 냈다면 목표에서 꺼내 쓰기로 적어 주세요'),
  ).toBeVisible();
  await page.getByRole('button', { name: '목표 고르기' }).click();
  await page.getByRole('radio', { name: '여행' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '선물' }).click();
  await page.getByLabel('어떤 선물이에요?').fill('꽃');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/goals\/g-trip\/spend\?amount=100000$/);
  await expect(page.getByLabel('여행에서 얼마를 꺼내 썼어요?')).toHaveValue('100,000');
  expect(db.careRecords.at(-1)).toMatchObject({
    care_day_id: 'c-wed',
    occurs_on: '2026-10-05',
    amount: 100_000,
    paid_from: 'personal',
    gift_name: '꽃',
  });

  // 상세: 수정(이름), 지우기 → 되돌리기
  await page.goto('/calendar/day/c-mom');
  await expect(page.getByRole('heading', { name: '어머니 생신' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '챙길 날 메뉴' }).click();
  await page.getByRole('menuitem', { name: '수정' }).click();
  await expect(page.getByLabel('어떤 날이에요?')).toHaveValue('어머니 생신');
  await page.getByLabel('어떤 날이에요?').fill('엄마 생신');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByLabel('일', { exact: true })).toHaveValue('20');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '엄마 생신' })).toBeVisible();
  expect(db.cares.find((x) => x.id === 'c-mom')).toMatchObject({
    name: '엄마 생신',
    month: 10,
    day: 20,
  });

  await page.getByRole('button', { name: '챙길 날 메뉴' }).click();
  await page.getByRole('menuitem', { name: '지우기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  await expect(page.getByText('휴지통으로 옮겼어요')).toBeVisible();
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('region', { name: '다음 챙길 날' })).toContainText('엄마 생신');
});

test('공휴일: 빨간 숫자와 이름, 설·추석 연휴 띠, 월급날이 쉬는 날이면 직전 영업일(끄면 그대로)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.holidays.push(
    { date: '2026-09-24', name: '추석 연휴', kind: 'holiday' },
    { date: '2026-09-25', name: '추석', kind: 'holiday' },
    { date: '2026-09-26', name: '추석 연휴', kind: 'holiday' },
    { date: '2026-10-03', name: '개천절', kind: 'holiday' },
    { date: '2026-10-05', name: '대체공휴일(개천절)', kind: 'substitute' },
    { date: '2026-10-09', name: '한글날', kind: 'holiday' },
  );

  await page.goto('/calendar/month');
  const hangul = page.getByRole('button', { name: '10월 9일, 한글날' });
  await expect(hangul).toHaveClass(/is-holiday/);
  await expect(hangul).toContainText('한글날');
  await expect(page.getByRole('button', { name: '10월 5일, 대체공휴일(개천절)' })).toHaveClass(
    /is-holiday/,
  );
  await expect(page.getByRole('button', { name: /^10월 6일/ })).not.toHaveClass(/is-holiday/);
  // 예빈 월급날 10일(토) → 9일 한글날 → 8일(목)
  await page.getByRole('button', { name: '10월 8일, 일정 1개' }).click();
  await expect(page.getByRole('button', { name: /예빈 월급날/ })).toBeVisible();
  await axe(page);

  // 9월: 추석 연휴 띠, 고른 날 목록 맨 위에 이름
  await page.getByRole('button', { name: '이전 달' }).click();
  const chuseok = page.getByRole('button', { name: /^9월 25일, 추석/ });
  await expect(chuseok).toHaveClass(/is-festive/);
  await expect(page.getByRole('button', { name: /^9월 24일, 추석 연휴/ })).toHaveClass(
    /is-festive/,
  );
  await expect(page.getByRole('button', { name: /^9월 27일/ })).not.toHaveClass(/is-festive/);
  await chuseok.click();
  await expect(page.locator('.hg-cal__event.is-holiday')).toHaveText('추석');
  await axe(page);

  // 앞당기기 끄면 10일 그대로
  (db.space as Record<string, unknown>).holiday_shift = false;
  await page.reload();
  await page.getByRole('tab', { name: '목록' }).click();
  await expect(page.getByRole('region', { name: '돈 일정' })).toContainText('예빈 월급날10월 10일');
});
