import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { emptyV22, type MemDb, mockOnboarding, mockV22Settings, seed } from './mocks';

// 월급 0원도 막지 않음(2026-11-19 사용자 결정): 온보딩에서 넣은 월급은 W-01 맨 위 ‘월급’ 줄에 그대로,
// ‘지금은 월급이 없어요’는 0원으로 보이고 둘 다 줄을 눌러 바로 고침. W-02는 막는 카드 없이, 홈 월급 상자는 평소 줄 둘.
// 찬우가 시작(각자, 미합류). 오늘 2026-10-07

const NOW = new Date('2026-10-07T10:00:00+09:00');
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

/** 준비 끝 화면까지 온 사람이 첫 저축·투자는 나중에(온보딩을 마친 상태로 다른 화면을 엶) */
const finish = (db: MemDb) =>
  Object.assign(db.me, { onboarding_done_at: NOW.toISOString(), onboarding_step: 'O-60' });

/** 이름 → 관계 → 생활비 ‘아니요’ → 저축·투자 ‘아직 없어요’ → O-31 */
async function toSalary(page: Page) {
  await page.goto('/');
  await heading(page, '내 이름이나 애칭을 알려 주세요');
  await page.getByLabel('내 이름이나 애칭을 알려 주세요').fill('찬우');
  await next(page);
  await radio(page, '결혼했어요');
  await radio(page, '아니요');
  await radio(page, '아직 없어요');
  await heading(page, '한 달 실수령액은 얼마예요?');
}

test('온보딩에서 넣은 월급은 W-01 월급 줄에 그대로, 줄을 눌러 고치면 미계획 금액이 다시 계산돼요', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  const v = await mockV22Settings(page, db, NOW);
  await toSalary(page);
  await page.getByLabel('한 달 실수령액은 얼마예요?').fill('3500000');
  await next(page);
  await heading(page, '월급날은 며칠이에요?');
  await next(page);
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  finish(db);

  await page.goto('/salary/plan');
  await heading(page, '월급 계획 템플릿');
  const row = page.getByRole('button', { name: '월급 3,500,000원, 금액 고치기' });
  await expect(row).toBeVisible();
  await expect(page.getByText('월급 알려 주기')).toHaveCount(0);
  // 용돈 35만 원만 계획: 저축·투자 0원이라 도넛 대신 지출 / 미계획 표(2026-11-27 ‘저축·투자 0원 요약 ①’)
  const tbl = page.locator('.hg-plansum__table li');
  await expect(tbl).toHaveText(['지출350,000원', '미계획3,150,000원']);
  await row.click();
  const sheet = page.getByRole('dialog', { name: '월급 금액' });
  // 월급날은 이미 있어 휠 없음
  await expect(sheet.getByRole('radiogroup', { name: '월급날은 며칠이에요?' })).toHaveCount(0);
  await axe(page);
  await sheet.getByRole('textbox', { name: '월급 금액' }).fill('4000000');
  await expect(sheet.getByText(/^미계획 금액 /)).toBeVisible();
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.getByRole('button', { name: '월급 4,000,000원, 금액 고치기' })).toBeVisible();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  expect(db.me.monthly_income).toBe(4_000_000);
  expect(v.calls.find((c) => c.fn === 'schedule_salary_change')?.body).toMatchObject({
    p_amount: 4_000_000,
    p_from: '2026-10-01',
  });
  // 미계획 금액은 새 월급 기준으로 바로 다시 계산
  await expect(tbl).toHaveText(['지출350,000원', '미계획3,650,000원']);
});

test('‘지금은 월급이 없어요’: W-01은 월급 0원 줄을 보여 주고 고칠 수 있고, W-02는 막는 카드 없이 안내 한 줄, 홈은 평소 줄', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  db.v22 = emptyV22();
  await mockV22Settings(page, db, NOW);
  await toSalary(page);
  await page.getByRole('button', { name: '지금은 월급이 없어요' }).click();
  await page
    .getByRole('alertdialog', { name: '월급 없이 시작할까요?' })
    .getByRole('button', { name: '월급 없이 시작할게요' })
    .click();
  await heading(page, /알려 드릴까요\?$/);
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await heading(page, '찬우님, 준비가 끝났어요');
  finish(db);

  // W-01: 0원 줄 + 템플릿을 그대로 씀(추가 줄 있음)
  await page.goto('/salary/plan');
  await heading(page, '월급 계획 템플릿');
  const row = page.getByRole('button', { name: '월급 0원, 금액 고치기' });
  await expect(row).toBeVisible();
  // 2026-11-19: 요약 카드 “월급 입력하기”. 2026-11-27 A안: 빈 카드는 칩 없이 추가 줄 한 줄씩
  await expect(page.getByRole('button', { name: '월급 입력하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ 저축·투자 추가' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ 지출 추가' })).toBeVisible();
  await expect(page.locator('.hg-plancard .hg-chip')).toHaveCount(0);
  await expect(page.getByText('월급을 넣으면 월급 계획을 만들어 드려요')).toHaveCount(0);
  await axe(page);

  // W-02: 막는 카드 없음, 줄이 없으면 안내 한 줄 + 이동 글자
  await page.goto('/salary');
  await heading(page, '이번 달 월급 체크');
  await expect(page.getByText('월급을 넣으면 월급 계획을 만들어 드려요')).toHaveCount(0);
  await expect(page.getByText('월급 알려 주기')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '월급날 루틴, 한 번에 끝내기' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '월급 계획 세우기' }).click();
  await heading(page, '월급 계획 템플릿');

  // 홈: ‘월급 알려 주기’ 없이 평소 줄 두 개
  await page.goto('/');
  const box = page.getByRole('group', { name: '월급' });
  await expect(page.getByText('월급 알려 주기')).toHaveCount(0);
  await expect(box).toBeVisible();
  await expect(box.getByRole('button', { name: /^이번 달 월급 체크/ })).toBeVisible();
  await expect(box.getByRole('button', { name: /^월급 계획 템플릿/ })).toContainText('미계획 0원');

  // 0원 줄도 고칠 수 있음: 월급날이 없어서 금액이 0보다 크면 월급날 휠도 같이
  await page.goto('/salary/plan');
  await page.getByRole('button', { name: '월급 0원, 금액 고치기' }).click();
  const sheet = page.getByRole('dialog', { name: '월급 금액' });
  await sheet.getByRole('textbox', { name: '월급 금액' }).fill('3000000');
  await expect(sheet.getByRole('radiogroup', { name: '월급날은 며칠이에요?' })).toBeVisible();
  // 월급날 고르기(A안): 25일 칩이 골라져 있고, 직접 입력한 범위 밖 숫자는 확인을 막음
  await expect(sheet.getByRole('radio', { name: '25일' })).toBeChecked();
  const custom = sheet.getByRole('textbox', { name: '다른 날 직접 입력하기' });
  await custom.fill('40');
  await expect(sheet.getByText('1~31 사이로 입력해 주세요')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '확인' })).toBeDisabled();
  await custom.fill('17');
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.getByRole('button', { name: '월급 3,000,000원, 금액 고치기' })).toBeVisible();
  expect(db.me).toMatchObject({ monthly_income: 3_000_000, payday: 17 });
});

test('월급 계획 템플릿이 아직 없는 사람(월급 0원)이 W-01·W-11을 열면 막지 않고 그 자리에서 만들어요', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.me, { monthly_income: 0, payday: null });
  db.splits.length = 0;
  db.checklists.length = 0;
  db.v22 = emptyV22();
  await page.goto('/salary/plan');
  await heading(page, '월급 계획 템플릿');
  await expect(page.getByRole('button', { name: '월급 0원, 금액 고치기' })).toBeVisible();
  await expect(page.getByText('월급을 넣으면 월급 계획을 만들어 드려요')).toHaveCount(0);
  await expect.poll(() => db.splits.length).toBe(1);
  await expect(page.getByRole('button', { name: '+ 지출 추가' })).toBeVisible();

  // W-11도 월급 0원이라고 돌려보내지 않음
  db.splits.length = 0;
  await page.goto('/salary/items/new');
  await heading(page, '저축·투자 추가');
  await expect.poll(() => db.splits.length).toBe(1);
});

test('합쳐서: 사람마다 월급 줄, 내 줄만 고치고 상대 줄은 보기만(월급 0원이면 “{이름}님이 입력해요”)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    salary_mode: 'joint',
    joint_cycle_day: 25,
  });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 0,
    payday: 10,
    payday_last: false,
    allowance: 0,
  };
  for (const sp of db.splits) sp.owner_user_id = null;
  for (const c of db.checklists) c.owner_user_id = null;
  await page.goto('/salary/plan');
  await heading(page, '월급 계획 템플릿');
  const mine = page.getByRole('button', { name: '찬우 월급 3,500,000원, 금액 고치기' });
  await expect(mine).toBeVisible();
  // 예빈 줄: 누를 수 없고 자물쇠 + 회색 보조
  await expect(page.getByRole('button', { name: /^예빈 월급/ })).toHaveCount(0);
  await expect(page.getByText('예빈님이 입력해요')).toBeVisible();
  await mine.click();
  await expect(page.getByRole('dialog', { name: '찬우 월급 금액' })).toBeVisible();
});
