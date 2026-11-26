import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { checkRow, doneRow, goRow, skippedRow, uncheckRow } from './w02-row';
import { chanwoo, type MemDb, mockOnboarding, seed } from './mocks';

// W-02 이번 달 월급 체크 새 구조(20 W-02, 2026-11-19) + W-01 금액 바꾸기 Toast(7번).
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

/** 상태 줄(2026-11-23 C안): 줄 전체가 버튼. 점·›는 그래픽이라 화면 읽기 이름이 “{이름} {금액}, 확인할 것” 등 */
const names = (page: Page) => page.locator('.hg-transfer__label');

test('확인 버튼(2026-11-19): 누르면 줄이 아래(완료)로 가고 보조 한 줄 숫자가 늘고, 큰 금액은 계획 합 그대로', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary');
  await expect(page.getByText('9월 25일 월급')).toBeVisible();
  await expect(page.locator('.hg-w02hero__amt')).toHaveText('3,500,000원');
  await expect(page.getByText('5개 중 0개 확인')).toHaveCount(0); // 2026-11-23 없앰
  // 밑줄 탭 숫자
  await expect(page.getByRole('tab', { name: /^전체 5$/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: /^남음 5$/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^완료 0$/ })).toBeVisible();
  // 체크 원은 이 화면에서 쓰지 않음
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.hg-transfer__dot.is-on')).toHaveCount(5);
  await expect(page.locator('.hg-transfer--act.is-go')).toHaveCount(5);
  await expect(goRow(page, '청약')).toBeVisible();
  // 줄 = 이름 + 금액, 종류 보조 줄 없음(2026-11-23), 목표 금액 진행·묶음 머리 없음
  await expect(page.locator('.hg-transfer', { hasText: '내 집 마련' })).not.toContainText(
    '저축·투자',
  );
  await expect(page.locator('.hg-transfer', { hasText: '내 집 마련' })).not.toContainText('1억');
  await expect(page.locator('.hg-checkgroup')).toHaveCount(0);
  // 청약을 확인하면 완료 쪽으로
  await checkRow(page, '청약');
  await expect(names(page)).toHaveText(['내 집 마련', '고정지출', '생활비', '용돈', '청약']);
  await expect(doneRow(page, '청약')).toBeVisible();
  await expect(page.locator('.hg-transfer--act.is-done .hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(page.locator('.hg-w02hero__amt')).toHaveText('3,500,000원');
  // 되돌리기 Toast
  await page.locator('.hg-toast').getByRole('button', { name: '되돌리기' }).click();
  await expect(names(page)).toHaveText(['청약', '내 집 마련', '고정지출', '생활비', '용돈']);
  // 탭: 남음 / 완료
  await checkRow(page, '청약');
  await checkRow(page, '고정지출');
  await page.getByRole('tab', { name: /^완료 2$/ }).click();
  await expect(names(page)).toHaveText(['청약', '고정지출']);
  await page.getByRole('tab', { name: /^남음 3$/ }).click();
  await expect(names(page)).toHaveText(['내 집 마련', '생활비', '용돈']);
  await axe(page);
});

test('줄 나머지를 누르면 줄 시트, 완료 버튼은 시트에서 체크 풀기', async ({ page }) => {
  const db = await open(page);
  mark(linesOf(db)[0], 'checked');
  await page.goto('/salary');
  await page.locator('.hg-transfer__open', { hasText: '생활비' }).click();
  const sheet = page.getByRole('dialog', { name: '생활비 880,000원' });
  await expect(sheet.getByRole('button', { name: '계획대로 했어요' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '다른 금액으로 했어요' })).toBeVisible();
  // 건너뛰기는 회색 채움이 아닌 글자 버튼(hg-btn--link hg-btn--quiet, 2026-11-23)
  const skipBtn = sheet.getByRole('button', { name: '이번 달은 건너뛸게요' });
  await expect(skipBtn).toBeVisible();
  await expect(skipBtn).toHaveClass(/hg-btn--link/);
  await expect(skipBtn).toHaveClass(/hg-btn--quiet/);
  await expect(skipBtn).not.toHaveClass(/hg-btn--secondary/);
  expect((await skipBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  // 완료 버튼 → 시트 → 체크 풀기
  await uncheckRow(page, '청약');
  await expect.poll(() => linesOf(db)[0]?.state).toBe('wait');
  await expect(goRow(page, '청약')).toBeVisible();
  // 건너뛰기 → 건너뜀 버튼(회색) + 아래로
  await page.locator('.hg-transfer__open', { hasText: '용돈' }).click();
  await page.getByRole('button', { name: '이번 달은 건너뛸게요' }).click();
  await expect(skippedRow(page, '용돈')).toContainText('건너뜀');
  await expect(names(page).last()).toHaveText('용돈');
});

test('다 확인(2026-11-19): 이동 없이 이 화면이 축하 상태로, 제목·저축·투자 합 알약·접힌 목록·주 버튼 사라짐, 되돌리기로 풀면 일반 상태', async ({
  page,
}) => {
  const db = await open(page);
  linesOf(db)
    .slice(0, 4)
    .forEach((l) => mark(l, 'checked'));
  await page.goto('/salary');
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toBeVisible();
  await checkRow(page, '용돈');
  await expect(page).toHaveURL(/\/salary$/);
  const toast = page.locator('.hg-toast');
  await expect(toast).toContainText('9월 25일 월급, 계획대로 됐어요');
  await expect(page.getByRole('heading', { name: '이번 달도 계획대로!' })).toBeVisible();
  await expect(page.locator('.hg-w02hero__saved')).toHaveText('저축·투자 1,390,000원 모았어요');
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  // 칩·큰 금액 없음, 그림 자리는 파일이 없어 비어 있음(회색 자리 없음)
  await expect(page.locator('.hg-w02hero__amt')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /^전체/ })).toHaveCount(0);
  await expect(page.locator('.hg-artslot')).toHaveCount(0);
  // 접힌 한 줄 → 펼치면 줄 목록
  const fold = page.getByRole('button', { name: '5개 모두 확인했어요' });
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.hg-transfer')).toHaveCount(0);
  await fold.click();
  await expect(page.locator('.hg-transfer')).toHaveCount(5);
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible();
  await axe(page);
  // 되돌리기 → 일반 상태
  await toast.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('heading', { name: '이번 달도 계획대로!' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /^남음 1$/ })).toBeVisible();
  // 옛 W-02 끝 주소는 W-02로
  await page.goto('/salary/done');
  await expect(page).toHaveURL(/\/salary$/);
});

test('다 확인 + 건너뜀이 섞이면 “이번 달 확인 끝”, 공유하기 = 내려받기, 저축·투자 0원이면 알약 숨김', async ({
  page,
}) => {
  const db = await open(page);
  linesOf(db).forEach((l) => mark(l, 'checked'));
  mark(linesOf(db)[0], 'skipped');
  mark(linesOf(db)[3], 'checked', 700_000);
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '이번 달 확인 끝' })).toBeVisible();
  // 확인한 저축·투자 = 내 집 마련 95만(청약은 건너뜀)
  await expect(page.locator('.hg-w02hero__saved')).toHaveText('저축·투자 950,000원 모았어요');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유하기' }).click();
  expect((await dl).suggestedFilename()).toBe('sweetwo-2026-09.png');
  await expect(page.getByText('이미지를 저장했어요')).toBeVisible();
  mark(linesOf(db)[1], 'skipped');
  await page.reload();
  await expect(page.getByRole('heading', { name: '이번 달 확인 끝' })).toBeVisible();
  await expect(page.locator('.hg-w02hero__saved')).toHaveCount(0);
  // 건너뜀 줄: 회색 “건너뜀” 버튼, 완료한 줄과 함께 아래
  // 건너뜀이 섞이면 접힌 줄은 “3개 확인, 2개 건너뜀”(2026-11-19)
  await page.getByRole('button', { name: '3개 확인, 2개 건너뜀' }).click();
  await expect(skippedRow(page, '청약')).toContainText('건너뜀');
  // 건너뜀 버튼 → 시트 → ‘계획대로 했어요’로 체크
  await skippedRow(page, '청약').click();
  await page.getByRole('dialog').getByRole('button', { name: '계획대로 했어요' }).click();
  await expect.poll(() => linesOf(db)[0]?.state).toBe('checked');
});

test('줄은 월급 계획 순서(sort)대로(남은 줄 먼저)', async ({ page }) => {
  const db = await open(page);
  // 서버가 순서 없이 돌려줘도 sort로 맞춤
  linesOf(db).reverse();
  await page.goto('/salary');
  await expect(names(page)).toHaveText(['청약', '내 집 마련', '고정지출', '생활비', '용돈']);
});

test('W-01에는 머리 링크 “이번 달 월급 체크 ›”가 없음(2026-11-19), W-02에도 머리 링크·‘+ 추가’ 없음', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/plan');
  await expect(page.getByRole('heading', { name: '월급 계획 템플릿' })).toBeVisible();
  await expect(page.getByRole('link', { name: '이번 달 월급 체크' })).toHaveCount(0);
  await page.goto('/salary');
  await expect(page.getByRole('link', { name: '월급 계획 템플릿' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '지난 달 모아보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /추가/ })).toHaveCount(0);
});

test('날짜 알약(2026-11-19): 지난 사이클이 있으면 ⌄ + 시트로 지난 달 읽기 전용, 없으면 글자만. 새 사이클 한 줄', async ({
  page,
}) => {
  const db = await open(page);
  await page.goto('/salary');
  const pill = page.locator('.hg-datepill');
  await expect(pill).toHaveText('9월 25일 월급');
  // 지난 달이 하나도 없으면 ⌄·시트 없음
  await expect(page.getByRole('button', { name: '월급날 고르기' })).toHaveCount(0);
  // 첫 체크리스트(지난 달 없음)에는 새 사이클 한 줄 없음
  await expect(page.getByText('계획대로 월급날 확인 목록을 만들었어요')).toHaveCount(0);
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
  const note = page.getByText('9월 계획대로 월급날 확인 목록을 만들었어요');
  await expect(note).toBeVisible();
  await axe(page);
  // 알약 → 시트(이번 달 + 지난 사이클 최근순) → 지난 달 보기(읽기 전용, 한 줄 없음)
  await page.getByRole('button', { name: '월급날 고르기' }).click();
  const sheet = page.getByRole('dialog', { name: '월급날 고르기' });
  await expect(sheet.getByRole('button', { name: /월급$/ })).toHaveText([
    '9월 25일 월급',
    '8월 25일 월급',
  ]);
  await sheet.getByRole('button', { name: '8월 25일 월급' }).click();
  await expect(pill).toHaveText('8월 25일 월급');
  await expect(note).toHaveCount(0);
  // 지난 달은 늦게 확인하는 보기(축하 상태 아님): 칩·목록이 그대로, 버튼은 모두 비활성
  await expect(page.getByRole('heading', { name: '이번 달도 계획대로!' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await expect(page.locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  // 이번 달로 돌아와 한 줄 닫기
  await page.getByRole('button', { name: '월급날 고르기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '9월 25일 월급' }).click();
  await page.locator('.hg-row', { has: note }).getByRole('button', { name: '닫기' }).click();
  await expect(note).toHaveCount(0);
  await page.reload();
  await expect(pill).toHaveText('9월 25일 월급');
  await expect(note).toHaveCount(0);
});

test('파트너 탭(각자): 같은 구조 보기만(버튼 비활성), 다 끝나면 같은 다 확인 상태', async ({
  page,
}) => {
  const db = await open(page);
  joinYebin(db);
  await page.goto('/salary?who=yebin');
  await expect(page.getByText('예빈님 월급날 확인 목록이에요. 보기만 할 수 있어요')).toBeVisible();
  // 큰 금액 = 그 사이클 월급(2026-11-19, 예전 줄 계획 합 95만 원)
  await expect(page.locator('.hg-w02hero__amt')).toHaveText('2,700,000원');
  await expect(page.getByRole('tab', { name: /^남음 2$/ })).toBeVisible();
  await expect(page.locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  // 수입 카드: 파트너 탭에는 “수입 적기” 버튼이 없음(2026-11-19)
  await expect(page.getByRole('button', { name: '수입 적기' })).toHaveCount(0);
  await axe(page);
  const yl = db.checklists.find((c) => c.owner_user_id === 'yebin')?.pay_check_line as Line[];
  yl.forEach((l) => mark(l, 'checked', null, 'yebin'));
  await page.reload();
  await expect(page.getByRole('heading', { name: '이번 달도 계획대로!' })).toBeVisible();
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible();
  await expect(page).toHaveURL(/\/salary\?who=yebin$/);
});

test('W-01 금액 바꾸기 Toast: 이번 달 체크 안 한 줄이 바뀌면 “이번 달 체크 안 한 줄도 바꿨어요”, 체크한 줄이면 그대로', async ({
  page,
}) => {
  const db = await open(page);
  mark(linesOf(db)[2], 'checked'); // 고정지출은 이미 체크
  await page.goto('/salary/plan');
  await page.getByRole('button', { name: '생활비 880,000원' }).click();
  let sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await sheet.getByRole('textbox', { name: '생활비 금액' }).fill('800000');
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('이번 달 아직 확인하지 않은 것도 바꿨어요')).toBeVisible();
  expect(linesOf(db).find((l) => l.kind === 'living' && l.state === 'wait')?.planned).toBe(800_000);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('button', { name: '생활비 880,000원' })).toBeVisible();
  // 체크한 줄(고정지출)은 이번 달이 안 바뀌므로 예전 Toast
  await page.getByRole('button', { name: '고정지출 880,000원' }).click();
  sheet = page.getByRole('dialog', { name: '고정지출 금액' });
  await sheet.getByRole('textbox', { name: '고정지출 금액' }).fill('900000');
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('고정지출을 900,000원으로 바꿨어요')).toBeVisible();
  await expect(page.getByText('이번 달 아직 확인하지 않은 것도 바꿨어요')).toHaveCount(0);
});

test('줄 상태(2026-11-23 C안): 할 일 점 + ›, 끝남 ✓, 건너뜀 취소선 + –, 나가는 날 전 자동 줄은 점 없이 날짜, 줄 전체가 버튼(Enter로 시트)', async ({
  page,
}) => {
  const db = await open(page);
  const l = linesOf(db);
  mark(l[0], 'checked'); // 청약 완료
  mark(l[1], 'skipped'); // 내 집 마련 건너뜀
  Object.assign(l[2] ?? {}, { auto: true, auto_due: '2026-10-20' }); // 고정지출: 나가는 날 전
  await page.goto('/salary');
  const row = (n: string) => page.locator('.hg-transfer--act', { hasText: n });
  // 할 일(생활비, 용돈): 점 + ›, 화면 읽기 “… 확인할 것”
  await expect(page.locator('.hg-transfer__dot.is-on')).toHaveCount(2);
  await expect(row('생활비').locator('.hg-transfer__dot.is-on')).toHaveCount(1);
  await expect(row('생활비').locator('.hg-transfer__trail .hg-ico')).toHaveCount(1);
  await expect(goRow(page, '생활비')).toBeVisible();
  // 끝남: 점 없이 흐리게 + ✓, 건너뜀: 취소선 + 보조 줄 “건너뜀”
  await expect(row('청약')).toHaveClass(/is-done/);
  await expect(row('청약').locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(row('청약').locator('.hg-transfer__trail .hg-ico')).toHaveCount(1);
  await expect(row('내 집 마련')).toHaveClass(/is-skipped/);
  await expect(row('내 집 마련').locator('.hg-transfer__label')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );
  await expect(row('내 집 마련').locator('.hg-transfer__meta')).toHaveText('건너뜀');
  // 나가는 날 전 자동 줄: 점·› 없이 보통 글자 + 보조 줄에 날짜, 그래도 누르면 시트
  await expect(row('고정지출')).toHaveClass(/is-wait/);
  await expect(row('고정지출').locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(row('고정지출').locator('.hg-transfer__meta')).toHaveText('20일 자동으로 나가요');
  // 상태 버튼은 없음, 줄 전체가 44px 이상 버튼
  await expect(page.locator('.hg-transfer__action')).toHaveCount(0);
  const box = await goRow(page, '생활비').boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  // 키보드 Enter로 시트
  await goRow(page, '생활비').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '생활비 880,000원' })).toBeVisible();
  await page.keyboard.press('Escape');
  await axe(page);
});
