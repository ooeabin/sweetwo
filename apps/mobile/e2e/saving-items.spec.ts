import { setYearMonth } from './wheel';
import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';

// 저금 항목(20 W-10~W-12, ADR 0007): 목표 탭 없이 월급 탭 저금 줄이 목표 금액(+ 기한)을 가짐.
// 모은 돈 = 체크한 저금 합. 달성하면 축하 1회 → ‘계속 모을게요’ / ‘그만할게요’.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('W-02 저금 줄 진행, 시트 ‘저금 보기’ → W-10 상세(목표 금액, 기한, 월 필요액, 매달)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary');
  // 목표 금액이 있는 저금 줄만 진행 “0원 / 1억 5,000만 원”
  await expect(page.getByText('0원 / 1억 5,000만 원')).toBeVisible();
  await axe(page);

  await page.goto('/salary/items/goal-h');
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  const target = page.getByRole('region', { name: '목표 금액 정하기' });
  await expect(target).toContainText('목표 1억 5,000만 원의 0%');
  await expect(target).toContainText('2031년 10월까지');
  await expect(target).toContainText('매달');
  await expect(page.getByText('매달 95만 원씩')).toBeVisible();
  await axe(page);

  // 목표 금액이 없는 항목: 진행 대신 ‘목표 금액 정하기’
  await page.goto('/salary/items/goal-e');
  await expect(page.getByRole('heading', { name: '청약' })).toBeVisible();
  await expect(page.getByText('목표 금액을 정하면 얼마나 모았는지 보여 드려요')).toBeVisible();
  await page.getByRole('button', { name: '목표 금액 정하기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/amount\?first=1$/);
  await page.getByRole('textbox').first().fill('5000000');
  await page.getByRole('button', { name: '저장' }).click();
  // 처음 정하면 기한으로 이어짐
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/deadline$/);
  expect(db.goals.find((g) => g.id === 'goal-e')?.target_amount).toBe(5_000_000);
});

test('W-11 저금 항목 추가: 이름 → 매달 → 목표 금액 → 기한 → W-10, 월급 계획 저금 줄과 이번 달 체크리스트', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/items/new');
  await expect(page.getByRole('heading', { name: '무엇을 위해 모을까요?' })).toBeVisible();
  await axe(page);
  await page.getByLabel('무엇을 위해 모을까요?').fill('제주 여행');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '매달 얼마씩 모을까요?' })).toBeVisible();
  // 처음 값은 빈 칸(남는 돈 전부를 채우지 않음, 2026-11-09), 보조는 지금 남는 돈
  await expect(page.getByLabel('매달 얼마씩 모을까요?')).toHaveValue('');
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await expect(page.getByText(/^지금 남는 돈/)).toBeVisible();
  // 빠른 칩은 그 금액으로 바꿈(더하지 않음)
  await page.getByRole('button', { name: '30만 원' }).click();
  await page.getByRole('button', { name: '10만 원' }).click();
  await expect(page.getByRole('button', { name: '10만 원' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('매달 얼마씩 모을까요?').fill('200000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(
    page.getByRole('heading', { name: '모으고 싶은 목표 금액이 있나요?' }),
  ).toBeVisible();
  await page.getByLabel('모으고 싶은 목표 금액이 있나요?').fill('2000000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '언제까지 모을까요?' })).toBeVisible();
  // 처음 값 = 1년 뒤(2027년 10월, 13개월) → 200만 ÷ 13 = 16만(올림), 매달 20만이면 늦지 않음
  await expect(page.getByText('매달 16만 원이 필요해요')).toBeVisible();
  await expect(page.getByText(/기한보다/)).toHaveCount(0);
  // 2027년 6월(9개월) → 23만 > 20만 → 10개월째 2027년 7월, 1개월 늦어요
  await setYearMonth(page, 2027, 6);
  await expect(page.getByText('매달 23만 원이 필요해요')).toBeVisible();
  await expect(page.getByText('지금대로면 기한보다 1개월 늦어요')).toBeVisible();
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: '제주 여행' })).toBeVisible();
  // W-10: 늦어지는 사실 한 줄 + 할 일(2026-11-09)
  const target = page.getByRole('region', { name: '목표 금액 정하기' });
  await expect(target).toContainText('지금대로면 기한보다 1개월 늦어요');
  await expect(target.getByRole('button', { name: '기한 바꾸기' })).toBeVisible();
  await target.getByRole('button', { name: '매달 금액 바꾸기' }).click();
  // 2026-11-09 round 3: W-01 전체 대신 이 줄 금액만
  await expect(page).toHaveURL(/\/salary\/items\/[0-9a-f-]{36}\/edit\/monthly$/);
  await page.goBack();
  const g = db.goals.find((x) => x.name === '제주 여행');
  expect(g).toMatchObject({
    target_amount: 2_000_000,
    deadline: '2027-06-01',
    owner_user_id: chanwoo.id,
  });
  const line = db.splits[0]?.split_line.find((l) => l.goal_id === g?.id);
  expect(line?.amount).toBe(200_000);
  // 이번 사이클 체크리스트에도 줄
  const lines = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  expect(lines.find((l) => l.goal_id === g?.id)?.planned).toBe(200_000);

  // 목표 금액 없이 모을게요: 바로 저장
  await page.goto('/salary/items/new');
  await page.getByLabel('무엇을 위해 모을까요?').fill('적금');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('매달 얼마씩 모을까요?').fill('100000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '목표 금액 없이 모을게요' }).click();
  await expect(page.getByRole('heading', { name: '적금' })).toBeVisible();
  expect(db.goals.find((x) => x.name === '적금')?.target_amount).toBeNull();

  // 휠을 건드리지 않고 추가하면 기한 = 1년 뒤(20 W-11d, 다음 달로 잡히던 것 고침)
  await page.goto('/salary/items/new');
  await page.getByLabel('무엇을 위해 모을까요?').fill('노트북');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '50만 원' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('모으고 싶은 목표 금액이 있나요?').fill('1500000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByRole('heading', { name: '노트북' })).toBeVisible();
  expect(db.goals.find((x) => x.name === '노트북')).toMatchObject({ deadline: '2027-10-01' });
  expect(
    db.splits[0]?.split_line.find((l) => l.goal_id === db.goals.find((x) => x.name === '노트북')?.id)
      ?.amount,
  ).toBe(500_000);
});

test('W-11c 이미 모은 돈(2026-11-09): 만들 때만, 목표 금액보다 적게, 모은 돈 = 시작값 + 체크, 모은 기록 맨 아래', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/items/new');
  await page.getByLabel('무엇을 위해 모을까요?').fill('결혼 비용');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '30만 원' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('모으고 싶은 목표 금액이 있나요?').fill('30000000');
  const has = page.getByRole('checkbox', { name: '이미 모은 돈이 있어요' });
  await expect(has).toHaveAttribute('aria-checked', 'false');
  await has.click();
  await page.getByLabel('이미 모은 돈').fill('30000000');
  await expect(page.getByText('목표 금액보다 적게 넣어 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await page.getByLabel('이미 모은 돈').fill('20000000');
  await expect(page.getByText('목표 금액보다 적게 넣어 주세요')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  // 월 필요액은 남은 1,000만 기준: 1년 뒤(13개월) → 77만(올림)
  await expect(page.getByText('매달 77만 원이 필요해요')).toBeVisible();
  await page.getByRole('button', { name: '기한 없이 모을게요' }).click();
  await expect(page.getByRole('heading', { name: '결혼 비용' })).toBeVisible();
  const g = db.goals.find((x) => x.name === '결혼 비용');
  expect(g).toMatchObject({ start_saved: 20_000_000, target_amount: 30_000_000 });
  await expect(page.getByText('2,000만 원', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('목표 3,000만 원의 66%')).toBeVisible();
  await expect(page.getByText('시작할 때 모은 돈 2,000만 원')).toBeVisible();
  // 체크하면 시작값에 더해짐
  await page.getByRole('checkbox', { name: /이번 달/ }).click();
  await expect(page.getByText('2,030만 원', { exact: true }).first()).toBeVisible();
});

test('W-11b 바꾸기 칩 고른 표시, W-11c 키패드는 하나로 맨 아래(2026-11-09 round 3)', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/items/new');
  await page.getByLabel('무엇을 위해 모을까요?').fill('여행');
  await page.getByRole('button', { name: '다음' }).click();
  const chip = page.getByRole('button', { name: '30만 원' });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  // 고른 칩은 잉크 테두리(안쪽 그림자)로 보임. 고르지 않은 칩은 없음
  expect(await chip.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none');
  expect(
    await page
      .getByRole('button', { name: '10만 원' })
      .evaluate((e) => getComputedStyle(e).boxShadow),
  ).toBe('none');
  await page.getByRole('button', { name: '다음' }).click();
  if (info.project.name !== 'narrow') return;
  // 좁은 창: 키패드로 목표 금액 → 체크 칸을 켜면 이미 모은 돈 칸이 활성, 키패드는 그 칸 아래
  for (const k of ['5', '00', '00', '00']) await page.getByRole('button', { name: k, exact: true }).click();
  await expect(page.getByLabel('모으고 싶은 목표 금액이 있나요?')).toHaveValue('5,000,000');
  await page.getByRole('checkbox', { name: '이미 모은 돈이 있어요' }).click();
  for (const k of ['1', '00', '00', '00']) await page.getByRole('button', { name: k, exact: true }).click();
  await expect(page.getByLabel('이미 모은 돈')).toHaveValue('1,000,000');
  await expect(page.getByLabel('모으고 싶은 목표 금액이 있나요?')).toHaveValue('5,000,000');
  const startBox = await page.getByLabel('이미 모은 돈').boundingBox();
  const padBox = await page.getByLabel('숫자 키패드').boundingBox();
  expect(startBox && padBox && padBox.y > startBox.y).toBe(true);
  await expect(page.getByLabel('숫자 키패드')).toHaveCount(1);
  // 목표 금액 칸을 누르면 키패드가 다시 그 칸에
  await page.getByLabel('모으고 싶은 목표 금액이 있나요?').click();
  await page.getByRole('button', { name: '지우기' }).click();
  await expect(page.getByLabel('모으고 싶은 목표 금액이 있나요?')).toHaveValue('500,000');
  await axe(page);
});

test('W-10a 고치기: 이름 바로 저장 + 되돌리기, 목표 금액 지우기, 지우기(휴지통) 되돌리기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  await page.goto('/salary/items/goal-h');
  await page.getByRole('button', { name: '더보기' }).first().click();
  await page.getByRole('menuitem', { name: '이름 바꾸기' }).click();
  await page.getByRole('textbox').first().fill('우리 집');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('이름을 바꿨어요')).toBeVisible();
  await expect(page.getByRole('heading', { name: '우리 집' })).toBeVisible();
  expect(home.name).toBe('우리 집');

  await page.goto('/salary/items/goal-h/edit/amount');
  await page.getByRole('button', { name: '목표 금액 지우기' }).click();
  await expect(page.getByText('목표 금액을 지웠어요')).toBeVisible();
  // 목표 금액을 지우면 기한도 같이 지움
  expect(home.target_amount).toBeNull();
  expect(home.deadline).toBeNull();

  await page.goto('/salary/items/goal-h');
  await page.getByRole('button', { name: '더보기' }).first().click();
  await page.getByRole('menuitem', { name: '지우기' }).click();
  await expect(page.getByText('휴지통으로 옮겼어요')).toBeVisible();
  await expect(page).toHaveURL(/\/salary$/);
  expect(home.deleted_at).toBeTruthy();
});

test('달성: 체크로 목표 금액에 닿으면 W-12 축하 → W-12a ‘계속 모을게요’ = 목표 금액만 지우고 줄은 그대로', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.push({
    id: 'goal-tv',
    template: 'custom',
    name: '가전 바꾸기',
    kind: 'once',
    priority: 2,
    target_amount: 300_000,
    other_held: 0,
    deadline: null,
    status: 'active',
    achieved_seen: [],
    owner_user_id: chanwoo.id,
    created_by: chanwoo.id,
    visibility: 'all',
    details: {},
    closed_at: null,
    deleted_at: null,
    created_at: '2026-06-01T00:00:00Z',
  });
  const sp = db.splits[0];
  if (!sp) throw new Error('seed');
  sp.split_line.push({
    id: 'split-1-line-tv',
    split_id: 'split-1',
    kind: 'saving',
    goal_id: 'goal-tv',
    user_id: null,
    name: null,
    amount: 300_000,
    sort: 2,
  });
  (db.checklists[0]?.pay_check_line as Record<string, unknown>[]).push({
    id: 'split-1-line-tv-c',
    split_id: 'split-1',
    kind: 'saving',
    goal_id: 'goal-tv',
    user_id: null,
    name: null,
    amount: 300_000,
    planned: 300_000,
    actual: null,
    state: 'wait',
    sort: 2,
    checked_by: null,
    checked_at: null,
  });
  db.goalStory = { months: 4, together: 0 };
  await page.goto('/salary');
  await page.getByRole('checkbox', { name: /가전 바꾸기/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-tv\/achieved$/);
  await expect(page.getByText('4개월 만에 모았어요')).toBeVisible();
  // 축하 화면 위에 체크 ‘되돌리기’ 토스트가 남지 않음(2026-11-09)
  await expect(page.getByText('가전 바꾸기에 30만 원 더했어요')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '되돌리기' })).toHaveCount(0);
  expect(db.goals.find((g) => g.id === 'goal-tv')?.status).toBe('achieved');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '이 저금을 어떻게 할까요?' })).toBeVisible();
  await page.getByRole('radio', { name: '계속 모을게요' }).click();
  await expect(page.getByText('목표 금액을 지우고 계속 모아요')).toBeVisible();
  const tv = db.goals.find((g) => g.id === 'goal-tv');
  expect(tv?.target_amount).toBeNull();
  expect(tv?.closed_at ?? null).toBeNull();
  expect(sp.split_line.some((l) => l.goal_id === 'goal-tv')).toBe(true);
});

test('달성 되돌리기: 고르기 전에 체크를 풀어 목표 금액 아래로 내려가면 모으는 중, 다시 체크하면 다시 축하', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  // 목표 금액 95만: 이번 달 줄을 체크하면 달성
  Object.assign(home, { target_amount: 950_000, deadline: null });
  await page.goto('/salary');
  await page.getByRole('checkbox', { name: /내 집 마련/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h\/achieved$/);
  expect(home.status).toBe('achieved');
  await page.goto('/salary');
  await page.getByRole('checkbox', { name: /내 집 마련/ }).click();
  await expect.poll(() => home.status).toBe('active');
  expect(db.notifications.some((n) => n.kind === 'goal_achieved')).toBe(false);
  await page.goto('/salary/items/goal-h');
  await expect(page.getByText('목표 95만 원의 0%')).toBeVisible();
  await expect(page.getByRole('region', { name: '목표 금액 정하기' }).getByText('달성')).toHaveCount(0);
  // 다시 체크하면 다시 축하
  await page.goto('/salary');
  await page.getByRole('checkbox', { name: /내 집 마련/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h\/achieved$/);
});

test('W-12a ‘그만할게요’: 월급 계획 줄이 빠지고 W-01 접힌 묶음, 되돌리기로 다시 모음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  Object.assign(home, { status: 'achieved', achieved_seen: [chanwoo.id] });
  await page.goto('/salary/items/goal-h/after');
  await expect(page.getByRole('heading', { name: '이 저금을 어떻게 할까요?' })).toBeVisible();
  await page.getByRole('radio', { name: '그만할게요' }).click();
  await expect(page.getByText('그만 모으기로 했어요')).toBeVisible();
  expect(home.closed_at).toBeTruthy();
  expect(db.splits[0]?.split_line.some((l) => l.goal_id === 'goal-h')).toBe(false);
  await page.goto('/salary/items/goal-h');
  await expect(page.getByText('그만 모은 저금이에요')).toBeVisible();
  await page.goto('/salary/split');
  await expect(page.getByText('그만 모은 저금 1개')).toBeVisible();
});

test('각자 모드 파트너 저금 항목: 보기만, ‘금액만 보여 주기’면 “개인 저금”, S-13 내 저금 항목 공개 범위', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
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
  const base = db.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
  db.goals.push(
    {
      ...base,
      id: 'goal-y',
      name: '예빈 카메라',
      priority: 2,
      owner_user_id: 'yebin',
      created_by: 'yebin',
      visibility: 'amount',
      target_amount: 2_000_000,
    },
    {
      ...base,
      id: 'goal-c',
      name: '찬우 자전거',
      priority: 3,
      owner_user_id: chanwoo.id,
      visibility: 'all',
      target_amount: 1_000_000,
    },
  );
  await page.goto('/salary/items/goal-y');
  await expect(page.getByRole('heading', { name: '개인 저금' })).toBeVisible();
  await expect(page.getByText('예빈님 저금이에요. 보기만 할 수 있어요')).toBeVisible();
  // 보기만: ⋯ 메뉴, 고치기 버튼 없음
  await expect(page.getByRole('button', { name: '더보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '고치기' })).toHaveCount(0);
  await expect(page.getByText('예빈 카메라')).toHaveCount(0);

  await page.goto('/settings/visibility');
  const pick = page.getByRole('button', { name: /찬우 자전거/ });
  await expect(pick).toContainText('모두 보여 주기');
  await pick.click();
  await page
    .getByRole('dialog', { name: '찬우 자전거 공개 범위' })
    .getByRole('radio', { name: '금액만 보여 주기' })
    .click();
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-c')?.visibility).toBe('amount');
  await axe(page);
});

test('충돌 선택(30 동기화 2장): 파트너가 1분 안에 같은 칸을 바꿨으면 “어느 쪽으로 할까요?”', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  if (db.space) db.space.partner_nickname = '예빈';
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  await page.goto('/salary/items/goal-h/edit/amount');
  await expect(page.getByRole('textbox').first()).toBeVisible();
  // 화면을 연 뒤 파트너가 30초 전에 1억 2,000만 원으로 바꿈
  Object.assign(home, {
    target_amount: 120_000_000,
    updated_by: 'yebin-id',
    updated_at: new Date(NOW.getTime() - 30_000).toISOString(),
  });
  await page.getByRole('textbox').first().fill('130000000');
  await page.getByRole('button', { name: '저장' }).click();
  const choice = page.getByRole('group', { name: '어느 쪽으로 할까요?' });
  await expect(choice).toContainText('예빈님이 방금 이 값을 바꿨어요');
  await expect(choice.getByRole('button', { name: /내 값/ })).toContainText('1억 3,000만 원');
  await expect(choice.getByRole('button', { name: /예빈님 값/ })).toContainText('1억 2,000만 원');
  expect(home.target_amount).toBe(120_000_000);
  await choice.getByRole('button', { name: /내 값/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
  expect(home.target_amount).toBe(130_000_000);
});
