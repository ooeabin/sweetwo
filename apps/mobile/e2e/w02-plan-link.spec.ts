import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, type MemDb, mockOnboarding, seed } from './mocks';

// W-01 ↔ W-02 잇기(20 W-02 1a·1c·W-01 3a·7번 Toast, 06 3-6, 2026-11-09, 2026-11-12 W-02 끝 대신 1c 한 줄).
// 찬우 350만 원 25일, 9월 월급 체크리스트: 저금 청약 44만·내 집 마련 95만, 지출 고정지출 88만·생활비 88만·용돈 35만(합 350만).
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
type Line = Record<string, unknown>;
const linesOf = (db: MemDb, i = 0) => db.checklists[i]?.pay_check_line as Line[];
const mark = (l: Line | undefined, state: string, actual: number | null = null, by = chanwoo.id) =>
  l && Object.assign(l, { state, actual, checked_by: by, checked_at: '2026-09-26T01:00:00Z' });

async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  return db;
}

/** 막대 칸 [flex-grow, 채움 너비(%)] */
async function bar(page: Page, scope = page.locator('body')) {
  return scope
    .locator('.hg-receipt__bar')
    .first()
    .evaluate((el) =>
      [...el.children].map((c) => {
        const s = (c as HTMLElement).style.flexGrow;
        const f = c.querySelector<HTMLElement>('.hg-receipt__fill');
        const kind = [...c.classList].find((x) => x.startsWith('hg-receipt__seg--'))?.slice(17);
        return [
          kind,
          Number(s),
          f ? f.style.width : c.classList.contains('is-progress') ? '0%' : null,
        ];
      }),
    );
}

/** 예빈 합류(각자): 예빈 월급 계획 생활비 68만 + 용돈 27만 */
function joinYebin(db: MemDb) {
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 270_000,
  };
  const line = (id: string, kind: string, amount: number, sort: number) => ({
    id,
    split_id: 'split-y',
    kind,
    goal_id: null,
    user_id: kind === 'allowance' ? 'yebin' : null,
    name: null,
    amount,
    sort,
  });
  db.splits.push({
    id: 'split-y',
    owner_user_id: 'yebin',
    split_line: [line('y1', 'living', 680_000, 0), line('y2', 'allowance', 270_000, 1)],
  });
}

test('진행 막대: 체크할수록 칸 안이 차고 “체크한 금액”이 늘어남, 개수는 화면 읽기 이름', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  await expect(page.getByText('09.25 ~ 10.24', { exact: true })).toBeVisible();
  await expect(page.getByText('체크한 금액 0원 / 350만 원')).toBeVisible();
  await expect(page.getByRole('img', { name: '5개 중 0개 완료' })).toBeVisible();
  // 개수 글자는 머리에서 빠짐
  await expect(page.getByText(/5개 중 0개 완료/)).toHaveCount(0);
  // 06 3-5: 139만 / 211만 / 0 → 40 / 60, 여유 자금 0이라 칸 없음
  expect(await bar(page)).toEqual([
    ['saving', 40, '0%'],
    ['spend', 60, '0%'],
  ]);
  await axe(page);
  await page.getByRole('checkbox', { name: /청약/ }).click();
  await expect(page.getByText('체크한 금액 44만 원 / 350만 원')).toBeVisible();
  await page.getByRole('checkbox', { name: /고정지출/ }).click();
  await expect(page.getByText('체크한 금액 132만 원 / 350만 원')).toBeVisible();
  await expect(page.getByRole('img', { name: '5개 중 2개 완료' })).toBeVisible();
  // 44 ÷ 139 = 31, 88 ÷ 211 = 41
  expect(await bar(page)).toEqual([
    ['saving', 40, '31%'],
    ['spend', 60, '41%'],
  ]);
  // 체크 풀면 다시 줄어듦
  await page.getByRole('checkbox', { name: /청약/ }).click();
  await expect(page.getByText('체크한 금액 88만 원 / 350만 원')).toBeVisible();
});

test('묶음은 월급 계획 순서(sort)대로', async ({ page }) => {
  const db = await open(page);
  // 서버가 순서 없이 돌려줘도 sort로 맞춤
  linesOf(db).reverse();
  await page.goto('/salary');
  await expect(page.locator('.hg-transfer__label')).toHaveText([
    '청약',
    '내 집 마련',
    '고정지출',
    '생활비',
    '용돈',
  ]);
});

test('모두 체크(2026-11-12 W-02 끝 없앰): 이동 없이 막대 아래 “다 했어요” 한 줄 + Toast + 되돌리기, 막대 = 계획 막대, 줄은 남고 풀면 한 줄 사라짐', async ({
  page,
}) => {
  const db = await open(page);
  linesOf(db)
    .slice(0, 4)
    .forEach((l) => mark(l, 'checked'));
  await page.goto('/salary?view=plan');
  const plan = await bar(page);
  await page.getByRole('tab', { name: '이번 달' }).click();
  await expect(page.locator('.hg-planbar__title')).toHaveCount(0);
  await page.getByRole('checkbox', { name: /용돈/ }).click();
  await expect(page).toHaveURL(/\/salary$/);
  // 마지막 줄 = 줄 Toast 대신 끝남 Toast 하나
  const toast = page.locator('.hg-toast');
  await expect(toast).toContainText('9월 25일 월급, 계획대로 됐어요');
  await expect(toast).not.toContainText('체크했어요 ');
  const title = page.locator('.hg-planbar__title');
  await expect(title).toHaveText('9월 25일 월급, 계획대로 됐어요');
  await expect(page.locator('.hg-planbar__foot')).toContainText('체크한 금액 350만 원 / 350만 원');
  await expect(
    page.locator('.hg-planbar__foot').getByRole('button', { name: '공유하기' }),
  ).toBeVisible();
  // 다 채운 막대 = W-01 막대(같은 칸, 같은 너비, 같은 색)
  const full = await bar(page);
  expect(full.map(([k, g]) => [k, g])).toEqual(plan.map(([k, g]) => [k, g]));
  expect(full.map(([, , f]) => f)).toEqual(['100%', '100%']);
  // 결과 카드·‘체크 고치기’ 없음, 묶음 카드는 그대로(체크 모양)
  await expect(page.locator('.hg-receipt')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '체크 고치기' })).toHaveCount(0);
  await expect(page.locator('.hg-checkgroup')).toHaveCount(2);
  await expect(page.getByText('영수증')).toHaveCount(0);
  await axe(page);
  // 되돌리기 = 마지막 줄을 풂 → 한 줄 사라짐
  await toast.getByRole('button', { name: '되돌리기' }).click();
  await expect(title).toHaveCount(0);
  await expect(page.getByText('체크한 금액 315만 원 / 350만 원')).toBeVisible();
  // 다시 체크 → 한 줄, 체크 칸으로 풀어도 같음
  await page.getByRole('checkbox', { name: /용돈/ }).click();
  await expect(title).toBeVisible();
  await page.getByRole('checkbox', { name: /용돈/ }).click();
  await expect(title).toHaveCount(0);
  // 옛 W-02 끝 주소는 W-02로
  await page.goto('/salary/done');
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
});

test('다 끝난 달 공유(2026-11-12): ‘못 함’이 섞이면 “마쳤어요”, ‘못 함’ 줄은 빈 원 + “이번 달은 못 했어요”(D2), 공유하기 = 내려받기', async ({
  page,
}) => {
  const db = await open(page);
  linesOf(db).forEach((l) => mark(l, 'checked'));
  mark(linesOf(db)[0], 'skipped');
  mark(linesOf(db)[3], 'checked', 700_000);
  await page.goto('/salary');
  await expect(page.locator('.hg-planbar__title')).toHaveText('9월 25일 월급, 확인을 마쳤어요');
  // ‘못 함’ 줄: 체크 안 된 빈 원, 취소선 없음, 화면 읽기 “청약 못 함”
  const skipped = page.getByRole('checkbox', { name: '청약 건너뜀' });
  await expect(skipped).toHaveAttribute('aria-checked', 'false');
  const row = page.locator('.hg-transfer', { hasText: '청약' });
  await expect(row).not.toHaveClass(/is-done/);
  await expect(row).toContainText('이번 달은 건너뛰었어요');
  // 못 함이 있으면 저금 칸은 다 차지 않음(95 ÷ 139 = 68)
  expect((await bar(page)).map(([, , f]) => f)).toEqual(['68%', '100%']);
  await expect(page.locator('.hg-planbar__foot')).toContainText('체크한 금액 288만 원 / 350만 원');
  await axe(page);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유하기' }).click();
  expect((await dl).suggestedFilename()).toBe('sweetwo-2026-09.png');
  await expect(page.getByText('이미지를 저장했어요')).toBeVisible();
  // ‘못 함’ 줄 체크 칸을 누르면 체크(보냈어요) → “다 했어요”
  await skipped.click();
  await expect.poll(() => linesOf(db)[0]?.state).toBe('checked');
  await expect(page.locator('.hg-planbar__title')).toHaveText('9월 25일 월급, 계획대로 됐어요');
});

test('W-01 링크 줄 “이번 달 2/5 체크했어요 ›” → 이번 달, 체크리스트가 없으면 없음', async ({
  page,
}) => {
  const db = await open(page);
  mark(linesOf(db)[0], 'checked');
  mark(linesOf(db)[2], 'checked');
  mark(linesOf(db)[1], 'skipped'); // 못 함은 보낸 것으로 세지 않음
  await page.goto('/salary?view=plan');
  const link = page.getByRole('button', { name: '이번 달 5개 중 2개 체크했어요' });
  await expect(link).toHaveText('이번 달 2/5 체크했어요');
  await axe(page);
  await page.getByRole('button', { name: '편집하기' }).click();
  await expect(link).toHaveCount(0);
  await page.getByRole('button', { name: '완료' }).click();
  await link.click();
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.getByRole('tab', { name: '이번 달' })).toHaveAttribute('aria-selected', 'true');
});

test('W-01 링크 줄: 월급날이 없어 체크리스트가 없으면 없음', async ({ page }) => {
  const db = await open(page);
  db.checklists.length = 0;
  Object.assign(db.me, { payday: null, payday_last: false });
  await page.goto('/salary?view=plan');
  await expect(page.locator('.hg-receipt__amount')).toBeVisible();
  await expect(page.locator('.hg-receipt__link')).toHaveCount(0);
});

test('W-01 금액 바꾸기 Toast: 이번 달 체크 안 한 줄이 바뀌면 “이번 달 체크 안 한 줄도 바꿨어요”, 체크한 줄이면 그대로', async ({
  page,
}) => {
  const db = await open(page);
  mark(linesOf(db)[2], 'checked'); // 고정지출은 이미 체크
  await page.goto('/salary?view=plan');
  await page.getByRole('button', { name: '생활비 88만 원' }).click();
  let sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await sheet.getByRole('textbox', { name: '생활비 금액' }).fill('800000');
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('이번 달 체크 안 한 줄도 바꿨어요')).toBeVisible();
  expect(linesOf(db).find((l) => l.kind === 'living' && l.state === 'wait')?.planned).toBe(800_000);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('button', { name: '생활비 88만 원' })).toBeVisible();
  // 체크한 줄(고정지출)은 이번 달이 안 바뀌므로 예전 Toast
  await page.getByRole('button', { name: '고정지출 88만 원' }).click();
  sheet = page.getByRole('dialog', { name: '고정지출 금액' });
  await sheet.getByRole('textbox', { name: '고정지출 금액' }).fill('900000');
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('고정지출을 90만 원으로 바꿨어요')).toBeVisible();
  await expect(page.getByText('이번 달 체크 안 한 줄도 바꿨어요')).toHaveCount(0);
});

test('새 사이클 한 줄 “9월 계획대로 체크리스트를 만들었어요”: 지난 달이 있을 때만, ×로 닫으면 다시 안 보임', async ({
  page,
}) => {
  const db = await open(page);
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  // 첫 체크리스트(지난 달 없음)에는 없음
  await expect(page.getByText('계획대로 체크리스트를 만들었어요')).toHaveCount(0);
  const cur = db.checklists[0] as Line;
  db.checklists.push({
    ...cur,
    id: 'checklist-0',
    label: '8월 월급',
    cycle_start: '2026-08-25',
    cycle_end: '2026-09-24',
    state: 'done',
    pay_check_line: (cur.pay_check_line as Line[]).map((l) => ({
      ...l,
      id: `${String(l.id)}-8`,
      state: 'checked',
      checked_by: chanwoo.id,
      checked_at: '2026-08-26T01:00:00Z',
    })),
  });
  await page.reload();
  const note = page.getByText('9월 계획대로 체크리스트를 만들었어요');
  await expect(note).toBeVisible();
  await axe(page);
  // 지난 달 보기에서는 없음, 지난 달은 같은 한 줄(읽기 전용, 2026-11-12)
  await page.getByRole('button', { name: '지난 달 보기' }).click();
  await expect(note).toHaveCount(0);
  await expect(page.locator('.hg-planbar__title')).toHaveText('8월 25일 월급, 계획대로 됐어요');
  await expect(page.getByRole('button', { name: '체크 고치기' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음 달 보기' }).click();
  await page.locator('.hg-row', { has: note }).getByRole('button', { name: '닫기' }).click();
  await expect(note).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  await expect(note).toHaveCount(0);
});

test('파트너 탭(각자): 같은 진행 막대 보기만, 다 끝나면 같은 한 줄, W-01 파트너 링크 → 예빈 이번 달', async ({
  page,
}) => {
  const db = await open(page);
  joinYebin(db);
  await page.goto('/salary?view=plan&who=yebin');
  const link = page.locator('.hg-receipt__link');
  await expect(link).toHaveText('이번 달 0/2 체크했어요');
  await link.click();
  await expect(page).toHaveURL(/\/salary\?who=yebin$/);
  await expect(page.getByText('예빈님 체크리스트예요. 보기만 할 수 있어요')).toBeVisible();
  await expect(page.getByText('체크한 금액 0원 / 95만 원')).toBeVisible();
  // 95 ÷ 270 → 지출 35%, 여유 자금 65%
  expect(await bar(page)).toEqual([
    ['spend', 35, '0%'],
    ['free', 65, null],
  ]);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await axe(page);
  // 예빈이 다 체크하면 같은 한 줄(보기만, 공유는 있음, 2026-11-12)
  const yl = db.checklists.find((c) => c.owner_user_id === 'yebin')?.pay_check_line as Line[];
  yl.forEach((l) => mark(l, 'checked', null, 'yebin'));
  await page.reload();
  await expect(page.locator('.hg-planbar__title')).toHaveText('9월 25일 월급, 계획대로 됐어요');
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page).toHaveURL(/\/salary\?who=yebin$/);
});
