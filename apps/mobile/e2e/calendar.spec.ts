import { test, expect, type Page } from '@playwright/test';
import { setWheel } from './wheel';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding, mockRealtime } from './mocks';

/** 추가 입구: 넓은 창은 제목 줄 버튼, 좁은 창은 화면 안 회색 ‘+ … 추가’ 줄(AddRow, 2026-11-09 + 버튼 대신) */
const addEntry = (page: Page, name: string) =>
  page
    .getByRole('button', { name, exact: true })
    .or(page.locator('.hg-addrow'))
    .locator('visible=true')
    .first();

// 캘린더(docs/spec/24-calendar.md, 재기획): 금융 일정과 경조사. 찬우(월급날 25일)와 합류한 예빈(10일)

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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
      // 축하는 이미 봄(월급 탭에서 축하로 넘어가지 않게)
      achieved_seen: [db.me.id],
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

test('목록(Y-01): 60일 안 금융 일정(월급날, 월급 전 확인, 저금 항목 기한, 만기), 누르면 해당 화면, 빈 상태, 필터', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar');
  await expect(page).toHaveURL(/\/calendar\/list$/);
  await expect(page.locator('.hg-empty')).toBeVisible();
  await expect(
    page.locator('.hg-empty').getByRole('button', { name: '경조사 추가' }),
  ).toBeVisible();
  // 경조사와 금융 일정은 “일정” 한 목록, 오른쪽 D-day(2026-11-03)
  const money = page.getByRole('region', { name: '일정' });
  // 예빈 월급날 10일(토) → 9일(금), 월급 전 확인 22일, 찬우 월급날 25일(일) → 23일(금), 만기 30일, 여행 기한 11월 30일(그 달 말일, 2026-11-09)
  // 머리 오른쪽 ‘+ 경조사 추가’(2026-11-09)는 빼고 줄만
  const rows = await money.locator('.hg-list').getByRole('button').allTextContents();
  expect(rows[0]).toContain('예빈 월급날');
  expect(rows[0]).toContain('10월 9일');
  expect(rows[0]).toContain('D-2');
  const all = rows.join('|');
  expect(all).toContain('월급 전 확인');
  expect(all).toContain('청년 적금 만기');
  expect(all).toContain('여행 기한');
  // 달성한 저금 항목 기한은 없음
  expect(all).not.toContain('자동차 기한');
  await axe(page);

  await page.getByRole('button', { name: '경조사', exact: true }).click();
  await expect(money.locator('.hg-list').getByRole('button')).toHaveCount(0);
  await page.getByRole('button', { name: '금융 일정', exact: true }).click();
  await expect(page.locator('.hg-empty')).toHaveCount(0);
  await page.getByRole('button', { name: /여행 기한/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/g-trip$/);
  await page.goto('/calendar/list');
  await page.getByRole('button', { name: /청년 적금 만기/ }).click();
  await expect(page).toHaveURL(/\/assets\/a-sav$/);
});

test('Y-01 맨 위 이번 주 띠(2026-11-09): 일~토, 오늘 ink 원, 일정 있는 날 오렌지 점(보기 필터대로), ‘목록/달력’ 탭 대신 ‘달력 ›’', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar');
  await expect(page).toHaveURL(/\/calendar\/list$/);
  const week = page.locator('.hg-week');
  await expect(week).toBeVisible();
  // 그림만(아래 목록이 같은 내용을 읽음)
  await expect(week).toHaveAttribute('aria-hidden', 'true');
  const days = week.locator('.hg-week__day');
  await expect(days).toHaveCount(7);
  // 10월 4일(일) ~ 10일(토), 오늘 7일
  await expect(days.first().locator('b')).toHaveText('4');
  await expect(week.locator('.is-today b')).toHaveText('7');
  // 예빈 월급날 10일(토) → 9일(금)에 점
  const dot = (d: number) => days.nth(d - 4).locator('i.is-on');
  await expect(dot(9)).toHaveCount(1);
  await expect(dot(8)).toHaveCount(0);
  // 경조사만 보면 금융 일정 점 없음
  await page.getByRole('button', { name: '경조사', exact: true }).click();
  await expect(dot(9)).toHaveCount(0);
  await page.getByRole('button', { name: '전체', exact: true }).click();
  // ‘목록 / 달력’ 탭은 없고 오른쪽 ‘달력 ›’
  await expect(page.getByRole('tab', { name: '달력' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('link', { name: '달력' }).click();
  await expect(page).toHaveURL(/\/calendar\/month$/);
  // 달력은 안쪽 화면: ‘‹ 캘린더’로 목록에
  await page.getByRole('button', { name: '뒤로' }).locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
});

test('달력(Y-04): 금융 일정 점, 월급 전 확인 띠(→ W-05), 고른 날 일정 → 화면, 달 넘기기, 캘린더 탭은 늘 목록', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar/month');
  // 2026-11-04 토스 소비 달력형: 처음부터 한 달(그 달 주만, 10월은 5주), 처음 고른 날은 오늘
  await expect(page.locator('.hg-cal__day')).toHaveCount(35);
  await expect(page.getByRole('button', { name: '10월 7일' })).toHaveAttribute(
    'aria-current',
    'date',
  );
  await expect(page.getByRole('button', { name: '10월 7일' })).toHaveClass(/is-selected/);
  await expect(page.getByText('10월 7일 수요일')).toBeVisible();
  await expect(page.getByText('이 날은 일정이 없어요')).toBeVisible();
  // 칸 안 짧은 이름
  await expect(page.getByRole('button', { name: '10월 9일, 일정 1개' })).toContainText('월급');
  await expect(page.getByRole('button', { name: '오늘' })).toHaveCount(0);
  await axe(page);

  const d23 = page.getByRole('button', { name: '10월 23일, 일정 1개' });
  // 월급 전 확인 기간은 칸 아래 이어진 띠, 시작 칸에 이름
  await expect(d23.locator('.hg-cal__band')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: '10월 22일, 일정 1개' }).locator('.hg-cal__band'),
  ).toHaveText('월급 전 확인');
  await page.getByRole('button', { name: '10월 22일, 일정 1개' }).click();
  await page.getByRole('button', { name: /9월 월급, 빠진 게 있는지 확인할 때예요/ }).click();
  // 오늘(10월 7일)은 아직 월급 전 확인 기간 전이라 W-05가 W-02로 보냄(2026-11-12 D3)
  await expect(page).toHaveURL(/\/salary$/);
  await page.goto('/calendar/month');
  await page.getByRole('button', { name: '10월 23일, 일정 1개' }).click();
  await expect(page.getByText('10월 23일 금요일')).toBeVisible();
  await page.getByRole('button', { name: /찬우 월급날/ }).click();
  await expect(page).toHaveURL(/\/salary$/);

  // 2026-11-09 ‘목록/달력’ 탭 대신 Y-01 ‘달력 ›’ 링크, 캘린더 탭은 마지막 보기를 기억하지 않고 늘 목록
  await page.goto('/calendar');
  await expect(page).toHaveURL(/\/calendar\/list$/);
  await page.getByRole('link', { name: '달력' }).click();
  await expect(page).toHaveURL(/\/calendar\/month$/);
  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(page.getByRole('region', { name: '2026년 11월' })).toBeVisible();
  // 다른 달이면 ‘오늘’로 돌아오기
  await expect(page.getByRole('button', { name: '오늘' })).toBeVisible();
  // 기한은 그 달 말일(2026-11-09)
  await page.getByRole('button', { name: '11월 30일, 일정 1개' }).click();
  await expect(page.getByRole('button', { name: /여행 기한/ })).toBeVisible();
  // 경조사만 보면 금융 일정 점·띠 없음
  await page.getByRole('button', { name: '경조사', exact: true }).click();
  await expect(page.getByRole('button', { name: '11월 30일' })).toBeVisible();
});

test('경조사 추가(Y-07): 이름 칩, 음력 매년, 명절은 날짜 건너뜀, 지난 날 안내, 달력에서 날짜 채움', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/calendar/list');
  await addEntry(page, '+ 추가').click();
  await expect(page.getByRole('heading', { name: '어떤 날이에요?' })).toBeVisible();
  await expect(page.getByLabel('어떤 날이에요?')).toHaveAttribute('placeholder', '예: 어머니 생신');
  await axe(page);
  await page.getByRole('button', { name: '생일', exact: true }).click();
  await expect(page.getByLabel('어떤 날이에요?')).toHaveValue('생일');
  await page.getByLabel('어떤 날이에요?').fill('어머니 생신');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '언제예요?' })).toBeVisible();
  await page.getByRole('tab', { name: '음력' }).click();
  await setWheel(page, '언제예요?', 2026, 8, 3);
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
  await addEntry(page, '+ 추가').click();
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
  await addEntry(page, '+ 추가').click();
  await page.getByRole('button', { name: '행사', exact: true }).click();
  await page.getByLabel('어떤 날이에요?').fill('민지 결혼식');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('switch', { name: '매년 돌아와요' })).not.toBeChecked();
  await setWheel(page, '언제예요?', 2026, 9, 1);
  await expect(page.getByText('이미 지난 날이에요. 기록으로 남길까요?')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await setWheel(page, '언제예요?', 2026, 11, 21);
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
  await page.getByRole('link', { name: '달력' }).click();
  await page.getByRole('button', { name: /^10월 30일/ }).click();
  await page.getByRole('button', { name: '이 날에 경조사 추가' }).click();
  await page.getByLabel('어떤 날이에요?').fill('집들이');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('spinbutton', { name: '일', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '30',
  );
});

test('상세(Y-05)와 기록(Y-08): 7일 지난 날 기록하기(꺼내 쓰기 없음, ADR 0007), 수정, 지우기 되돌리기', async ({
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
  // 기록할 날은 맨 위 회색 띠(2026-11-03)
  const overdue = page.getByRole('button', { name: /기록할 날이 1개 있어요/ });
  await expect(overdue).toContainText('민지 결혼식, 10월 5일');
  const next = page.getByRole('region', { name: '다음 경조사' });
  await expect(next).toContainText('D-6');
  await expect(next).toContainText('30만 원 생각해 뒀어요');
  await axe(page);

  await overdue.click();
  await expect(page.getByRole('heading', { name: '얼마 썼어요?' })).toBeVisible();
  await expect(page.getByLabel('얼마 썼어요?')).toHaveValue('100,000');
  // 2026-11-08 ‘목표에서 꺼내 쓰기’ 없앰(ADR 0007)
  await expect(page.getByRole('button', { name: '목표에서 꺼내 쓰기' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '선물' }).click();
  await page.getByLabel('어떤 선물이에요?').fill('꽃');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/calendar\/day\/c-wed$/);
  expect(db.careRecords.at(-1)).toMatchObject({
    care_day_id: 'c-wed',
    occurs_on: '2026-10-05',
    amount: 100_000,
    paid_from: 'personal',
    gift_name: '꽃',
  });
  // 한 번인 날을 기록하면 ‘지남’·‘기록하기’와 목록 ‘기록할 날’ 띠가 사라짐(2026-11-12 S9-01)
  await expect(page.getByRole('heading', { name: '민지 결혼식' })).toBeVisible();
  await expect(page.getByText(/^지남/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '기록하기' })).toHaveCount(0);
  await page.goto('/calendar/list');
  await expect(page.getByRole('region', { name: '다음 경조사' })).toBeVisible();
  await expect(page.getByRole('button', { name: /기록할 날이/ })).toHaveCount(0);

  // 상세: 수정(이름), 지우기 → 되돌리기
  await page.goto('/calendar/day/c-mom');
  await expect(page.getByRole('heading', { name: '어머니 생신' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '경조사 메뉴' }).click();
  await page.getByRole('menuitem', { name: '수정' }).click();
  await expect(page.getByLabel('어떤 날이에요?')).toHaveValue('어머니 생신');
  await page.getByLabel('어떤 날이에요?').fill('엄마 생신');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('spinbutton', { name: '일', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '20',
  );
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '엄마 생신' })).toBeVisible();
  expect(db.cares.find((x) => x.id === 'c-mom')).toMatchObject({
    name: '엄마 생신',
    month: 10,
    day: 20,
  });

  await page.getByRole('button', { name: '경조사 메뉴' }).click();
  await page.getByRole('menuitem', { name: '지우기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  await expect(page.getByText('휴지통으로 옮겼어요')).toBeVisible();
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('region', { name: '다음 경조사' })).toContainText('엄마 생신');
});

test('기록 사진(Y-08c): 처음엔 사진 동의 → 형식·크기·10장 → 저장하면 기록 + 사진, 선물 기록(Y-09)에 미리보기', async ({
  page,
}) => {
  const DAY = new Date('2026-10-14T20:00:00+09:00');
  await page.clock.setFixedTime(DAY);
  const db = await mockOnboarding(page, { now: DAY });
  seed(db);
  db.cares.push(care({ id: 'c-mom', month: 10, day: 14 }));
  await page.goto('/calendar/day/c-mom/record/c?on=2026-10-14');
  await expect(page.getByRole('heading', { name: '기억하고 싶은 게 있나요?' })).toBeVisible();
  await expect(page.getByText('사진 10장까지, 한 장에 10MB 이하')).toBeVisible();
  const input = page.locator('.hg-attach input[type="file"]');
  await input.setInputFiles({ name: 'cake.png', mimeType: 'image/png', buffer: PNG });
  const consent = page.getByRole('region', { name: '사진을 저장해도 될까요?' });
  await expect(consent).toContainText('기록을 지우면 사진도 함께 지워져요');
  await axe(page);
  await consent.getByRole('button', { name: '동의할게요' }).click();
  await expect
    .poll(() => db.consents.at(-1))
    .toMatchObject({
      kind: 'photo',
      agreed: true,
      source: 'care_day_first',
    });
  await expect(page.getByRole('button', { name: 'cake.png 빼기' })).toBeVisible();

  await input.setInputFiles({
    name: 'big.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(11 * 1024 * 1024),
  });
  await expect(page.getByRole('alert')).toHaveText('10MB 이하 사진만 올릴 수 있어요');
  await input.setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: PNG });
  await expect(page.getByRole('alert')).toHaveText('이 형식은 올릴 수 없어요');
  await input.setInputFiles(
    Array.from({ length: 10 }, (_, i) => ({
      name: `p${i}.png`,
      mimeType: 'image/png',
      buffer: PNG,
    })),
  );
  await expect(page.getByRole('alert')).toHaveText('사진은 10장까지 올릴 수 있어요');
  await expect(page.locator('.hg-photos__item')).toHaveCount(10);
  await page.getByRole('button', { name: 'cake.png 빼기' }).click();
  await expect(page.locator('.hg-photos__item')).toHaveCount(9);
  await axe(page);

  await page.getByLabel('메모').fill('케이크 맛있었어요');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/calendar\/day\/c-mom$/);
  expect(db.careRecords.at(-1)).toMatchObject({ care_day_id: 'c-mom', memo: '케이크 맛있었어요' });
  const rid = String(db.careRecords.at(-1)?.id);
  expect((db.photos ?? []).filter((p) => p.care_record_id === rid)).toHaveLength(9);
  expect((db.photos ?? []).every((p) => /^r\/[0-9a-f-]{36}\.jpg$/.test(p.path))).toBe(true);

  await page.goto('/calendar/gifts');
  await expect(page.getByText(/사진 9장/)).toBeVisible();
  await expect(page.locator('.hg-thumb img')).toBeVisible();
  await axe(page);
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
  await expect(page.locator('.hg-cal__agenda .hg-listrow__label').first()).toHaveText('추석');
  await axe(page);

  // 앞당기기 끄면 10일 그대로
  (db.space as Record<string, unknown>).holiday_shift = false;
  await page.goto('/calendar/list');
  const up = page.getByRole('region', { name: '일정' });
  await expect(up.getByRole('button', { name: /예빈 월급날/ }).first()).toContainText('10월 10일');
});

test('2026-11-04 사용성: 달력은 보던 날 기억, Y-05 그날엔 ‘다녀왔어요’ 주 버튼, 목록은 달 머리', async ({
  page,
}) => {
  const DAY = new Date('2026-10-20T10:00:00+09:00');
  await page.clock.setFixedTime(DAY);
  const db = await mockOnboarding(page, { now: DAY });
  seed(db);
  db.cares.push(care({ id: 'c-mom' }));
  await page.goto('/calendar/list');
  await expect(page.getByRole('heading', { name: '10월', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '11월', exact: true })).toBeVisible();

  await page.goto('/calendar/month');
  await page.getByRole('button', { name: '다음 달' }).click();
  await page.getByRole('button', { name: /^11월 10일/ }).click();
  await page
    .getByRole('button', { name: /월급날/ })
    .first()
    .click();
  await page.goBack();
  await expect(page.getByText('11월 10일 화요일')).toBeVisible();

  await page.goto('/calendar/day/c-mom');
  const status = page.getByRole('group', { name: '준비 상황' });
  await expect(status.getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '다녀왔어요' })).toBeVisible();
  // 미리 알림은 체크 목록
  const alerts = page.getByRole('group', { name: '미리 알림' });
  await expect(alerts.getByRole('checkbox', { name: '30일 전' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await alerts.getByRole('checkbox', { name: '14일 전' }).click();
  await expect
    .poll(() => (db.cares.find((x) => x.id === 'c-mom') as { alerts: number[] }).alerts)
    .toContain(14);
  await expect(page.getByLabel('메모')).toHaveAttribute(
    'placeholder',
    '예: 무릎이 안 좋으시다고 하셨음',
  );
  await axe(page);
});

test('QA 9구간: 고치기 Toast ‘되돌리기’(S9-04), 파트너 월급날 → 그 사람 체크리스트(S9-10), 맨 위 월급 전 확인 띠 없음(D1)', async ({
  page,
}) => {
  // 10월 22일 = 찬우 월급 전 확인 기간(22~24일)
  const DAY = new Date('2026-10-22T10:00:00+09:00');
  await page.clock.setFixedTime(DAY);
  const db = await mockOnboarding(page, { now: DAY });
  seed(db);
  db.cares.push(care({ id: 'c-mom', month: 11, day: 3 }));

  await page.goto('/calendar/list');
  const list = page.getByRole('region', { name: '일정' });
  await expect(list.getByRole('button', { name: /월급 전 확인/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /빠진 게 있는지 확인할 때예요/ })).toHaveCount(0);
  await expect(page.locator('.hg-banner')).toHaveCount(0);
  // 넓은 창은 제목 줄 ‘+ 추가’만, 좁은 창은 ‘+ 경조사 추가’만(S9-11)
  await expect(page.locator('.hg-addrow').locator('visible=true')).toHaveCount(
    (page.viewportSize()?.width ?? 0) >= 768 ? 0 : 1,
  );
  await list
    .getByRole('button', { name: /예빈 월급날/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/salary\?who=yebin$/);

  // Y-05 준비 상황 → “고쳤어요” + 되돌리기
  await page.goto('/calendar/day/c-mom');
  await page.getByRole('button', { name: '준비 중', exact: true }).click();
  await expect(page.getByText('고쳤어요')).toBeVisible();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.status).toBe('preparing');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.status).toBe('todo');

  // 미리 알림 끄기 → 되돌리기
  await page.getByRole('checkbox', { name: '7일 전' }).click();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.alerts).toEqual([30]);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.alerts).toEqual([30, 7]);

  // 메모 → 되돌리기
  await page.getByLabel('메모').fill('케이크 예약');
  await page.getByLabel('메모').blur();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.memo).toBe('케이크 예약');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.memo).toBeNull();
  await expect(page.getByLabel('메모')).toHaveValue('');

  // 금액 메모 → 상세로 돌아와 Toast + 되돌리기
  await page.getByRole('button', { name: /금액 메모/ }).click();
  await page.getByLabel('쓸 돈을 메모해 둘까요?').fill('500000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('고쳤어요')).toBeVisible();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.budget).toBe(500_000);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.cares.find((x) => x.id === 'c-mom')?.budget).toBe(300_000);
  await axe(page);
});

test('QA 9구간: Y-07d 건너뛰기도 같은 날 확인(S9-09), 못 불러오면 오류 카드 + 다시 시도(S9-02)', async ({
  page,
}) => {
  // 못 불러옴은 쿼리 재시도(3번)가 끝난 뒤라 두 화면이면 30초를 넘음
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.cares.push(
    care({
      id: 'c-chu',
      kind: 'chuseok',
      name: '추석',
      date_rule: 'lunar_yearly',
      month: 8,
      day: 15,
    }),
  );

  await page.goto('/calendar/list');
  await addEntry(page, '+ 추가').click();
  await page.getByRole('button', { name: '추석', exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByText('같은 날이 있어요. 그래도 추가할까요?')).toBeVisible();
  expect(db.cares).toHaveLength(1);
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.cares).toHaveLength(2);

  let fail = true;
  await page.route('**/rest/v1/care_day?*', (route) =>
    fail && route.request().method() === 'GET'
      ? route.fulfill({ status: 500, body: '{}' })
      : route.fallback(),
  );
  await page.goto('/calendar/day/c-chu');
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/calendar\/day\/c-chu$/);
  await axe(page);
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('heading', { name: '추석' })).toBeVisible();

  fail = true;
  await page.goto('/calendar/list');
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.hg-empty')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('region', { name: '다음 경조사' })).toContainText('추석');
});

test('Realtime: 상대가 경조사를 넣거나 기록하면 목록이 바로 바뀜(S9-03)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar/list');
  await expect(page.locator('.hg-empty')).toBeVisible();
  await expect.poll(() => rt.subscribed('care_day')).toBeGreaterThan(0);
  await expect.poll(() => rt.subscribed('care_record')).toBeGreaterThan(0);
  db.cares.push(care({ id: 'c-y', name: '할머니 생신', month: 10, day: 30, created_by: 'yebin' }));
  rt.emit('care_day', 'INSERT', { id: 'c-y', space_id: 'space-1' });
  await expect(page.getByRole('region', { name: '다음 경조사' })).toContainText('할머니 생신');
});
