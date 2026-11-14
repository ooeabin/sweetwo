import { test, expect, type Page, type Route } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, type MemDb, mockOnboarding, seed } from './mocks';

// W-01 월급 계획 영수증(20 W-01, 2026-11-09): 월급 탭 구간 탭 ‘계획’(/salary?view=plan), 줄마다 바로 저장 + 되돌리기,
// 지출 추가 칩, 기본 줄 지우기, 편집 모드 순서(키보드), 파트너 탭 보기만, 합쳐서(두 Avatar, 합), 모자람, 공유(브라우저 = 내려받기),
// 금액 가리기. 찬우(시작) 350만 원 25일, 저금 청약 44만·내 집 마련 95만, 지출 고정지출 88만·생활비 88만·용돈 35만.
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const lineOf = (db: MemDb, kind: string, name?: string) =>
  db.splits[0]?.split_line.find((l) => l.kind === kind && (!name || l.name === name));
const waitLine = (db: MemDb, kind: string) =>
  (db.checklists[0]?.pay_check_line as Record<string, unknown>[]).find(
    (l) => l.kind === kind && l.state === 'wait',
  );
const names = (page: Page, group: string) =>
  page.getByRole('list', { name: group }).locator('.hg-receipt__name').allTextContents();

async function open(page: Page, url = '/salary?view=plan') {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  return { db, go: () => page.goto(url) };
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

test('보기: 구간 탭 ‘계획’, 머리·비율·묶음·합계, + 버튼 없음, ‘이번 달’로 돌아감', async ({
  page,
}) => {
  const { go } = await open(page);
  await go();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveAttribute('aria-selected', 'true');
  const card = page.locator('.hg-receipt');
  await expect(card.locator('.hg-receipt__amount')).toHaveText('350만 원');
  await expect(card.getByText('매달 25일')).toBeVisible();
  // 06 3-5: 139만 / 211만 / 0 → 40% / 60% / 0%
  await expect(page.getByRole('img', { name: '저금 40%, 지출 60%, 여유 자금 0%' })).toBeVisible();
  await expect(card.locator('.hg-receipt__seg--free')).toHaveCount(1); // 범례 네모만(막대 칸 없음)
  expect(await names(page, '저금')).toEqual(['청약', '내 집 마련']);
  expect(await names(page, '지출')).toEqual(['고정지출', '생활비', '용돈']);
  await expect(card.getByText('139만 원', { exact: true })).toBeVisible();
  await expect(card.getByText('211만 원', { exact: true })).toBeVisible();
  await expect(card.locator('.hg-receipt__row--strong')).toContainText('여유 자금0원');
  await expect(page.locator('.hg-fab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible();
  await axe(page);
  // 큰 금액 → 설정 내 월급
  await page.getByRole('button', { name: '월급 350만 원, 내 월급 고치기' }).click();
  await expect(page).toHaveURL(/\/settings\/me$/);
  // 옛 주소 /salary/split → 계획, ‘이번 달’ → W-02
  await page.goto('/salary/split');
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  await page.getByRole('tab', { name: '이번 달' }).click();
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  await page.getByRole('button', { name: '월급 계획 고치기' }).click();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveAttribute('aria-selected', 'true');
});

test('금액 바꾸기: 시트(여유 자금 미리보기) → 바로 저장 + 되돌리기, 이번 달 체크 안 한 줄도', async ({
  page,
}) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '생활비 88만 원' }).click();
  const sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await expect(sheet.getByText('여유 자금 0원')).toBeVisible();
  await sheet.getByRole('textbox', { name: '생활비 금액' }).fill('800000');
  await expect(sheet.getByText('여유 자금 8만 원')).toBeVisible();
  // 기본 줄은 이름을 바꾸지 않음
  await expect(sheet.getByLabel('줄 이름')).toHaveCount(0);
  await axe(page);
  await sheet.getByRole('button', { name: '확인' }).click();
  // 이번 달 체크 안 한 줄도 바뀌어 Toast가 그 말로(2026-11-09)
  await expect(page.getByText('이번 달 확인 안 한 줄도 바꿨어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '생활비 80만 원' })).toBeVisible();
  expect(lineOf(db, 'living')?.amount).toBe(800_000);
  expect(waitLine(db, 'living')?.planned).toBe(800_000);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('button', { name: '생활비 88만 원' })).toBeVisible();
  expect(lineOf(db, 'living')?.amount).toBe(880_000);
});

test('지출 추가: 이름 칩 → 금액 → 추가하기, 직접 추가 줄은 이름 바꾸기', async ({ page }) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '+ 지출 추가' }).click();
  const chips = page.getByRole('group', { name: '지출 이름' });
  for (const n of ['관리비', '통신비', '보험료', '구독료', '교통비', '부모님 용돈'])
    await expect(chips.getByRole('button', { name: n })).toBeVisible();
  await chips.getByRole('button', { name: '관리비' }).click();
  const sheet = page.getByRole('dialog', { name: '관리비 금액' });
  await sheet.getByRole('textbox', { name: '관리비 금액' }).fill('100000');
  await sheet.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByText('관리비를 추가했어요')).toBeVisible();
  expect(await names(page, '지출')).toEqual(['고정지출', '생활비', '용돈', '관리비']);
  expect(lineOf(db, 'custom', '관리비')?.amount).toBe(100_000);
  expect(waitLine(db, 'custom')?.planned).toBe(100_000);
  // 이미 있는 이름은 칩에서 숨김, 글자로 넣으면 막음
  await page.getByRole('button', { name: '+ 지출 추가' }).click();
  await expect(chips.getByRole('button', { name: '관리비' })).toHaveCount(0);
  await chips.getByRole('textbox', { name: '줄 이름' }).fill('관리비');
  await chips.getByRole('textbox', { name: '줄 이름' }).press('Enter');
  await expect(page.getByText('이미 있는 이름이에요')).toBeVisible();
  // 직접 추가 줄: 시트에서 이름 바꾸기
  await page.getByRole('button', { name: '관리비 10만 원' }).click();
  const s2 = page.getByRole('dialog', { name: '관리비 금액' });
  await s2.getByLabel('줄 이름').fill('아파트 관리비');
  await s2.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('이름을 바꿨어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '아파트 관리비 10만 원' })).toBeVisible();
});

test('기본 줄 지우기 + 되돌리기(같은 자리), 저금 줄 지우기는 확인 뒤 그만 모음', async ({
  page,
}) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '고정지출 88만 원' }).click();
  await page
    .getByRole('dialog', { name: '고정지출 금액' })
    .getByRole('button', { name: '고정지출 줄 지우기' })
    .click();
  await expect(page.getByText('고정지출을 지웠어요')).toBeVisible();
  expect(await names(page, '지출')).toEqual(['생활비', '용돈']);
  expect(lineOf(db, 'fixed')).toBeUndefined();
  expect(waitLine(db, 'fixed')).toBeUndefined();
  await expect(page.getByRole('img', { name: '저금 40%, 지출 35%, 여유 자금 25%' })).toBeVisible();
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => names(page, '지출')).toEqual(['고정지출', '생활비', '용돈']);
  // 저금 줄: 확인 Modal → 그만 모음
  await page.getByRole('button', { name: '청약 44만 원' }).click();
  await page
    .getByRole('dialog', { name: '청약 금액' })
    .getByRole('button', { name: '청약 줄 지우기' })
    .click();
  const modal = page.getByRole('alertdialog', { name: '청약 저금을 그만 모을까요?' });
  await expect(modal.getByText('월급 계획에서 빠지고 저금 내역은 남아요')).toBeVisible();
  await modal.getByRole('button', { name: '그만할게요' }).click();
  await expect(page.getByText('그만 모으기로 했어요')).toBeVisible();
  expect(await names(page, '저금')).toEqual(['내 집 마련']);
  expect(db.goals.find((g) => g.id === 'goal-e')?.closed_at).toBeTruthy();
  await expect(page.getByRole('button', { name: '그만 모은 저금 1개' })).toBeVisible();
});

test('편집 모드: 키보드 위·아래로 순서 → ‘완료’에서 한 번에 저장 + 되돌리기, 줄마다 지우기', async ({
  page,
}) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '편집하기' }).click();
  await expect(page.getByRole('heading', { name: '월급 계획 편집' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveCount(0);
  // 기본 줄도 지우기(마우스 기기는 늘 보임)
  await expect(page.getByRole('button', { name: '고정지출 지우기' })).toBeVisible();
  await axe(page);
  const up = page.getByRole('button', { name: '용돈 위로' });
  await up.focus();
  await expect(up).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('용돈, 2번째')).toBeAttached();
  await page.keyboard.press('Enter');
  expect(await names(page, '지출')).toEqual(['용돈', '고정지출', '생활비']);
  // 아직 저장 전
  expect(db.rpc.includes('split_reorder')).toBe(false);
  await page.getByRole('button', { name: '완료' }).click();
  await expect(page.getByText('순서를 바꿨어요')).toBeVisible();
  expect(db.rpc.filter((x) => x === 'split_reorder')).toHaveLength(1);
  expect(
    [...(db.splits[0]?.split_line ?? [])]
      .sort((a, b) => Number(a.sort) - Number(b.sort))
      .map((l) => l.kind),
  ).toEqual(['saving', 'saving', 'allowance', 'fixed', 'living']);
  // 이번 달 체크리스트도 같은 순서
  await page.getByRole('tab', { name: '이번 달' }).click();
  await expect(page.locator('.hg-transfer__label').nth(2)).toHaveText('용돈');
  await page.getByRole('tab', { name: '계획' }).click();
  await page.getByRole('button', { name: '편집하기' }).click();
  await page.getByRole('button', { name: '완료' }).click();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
});

test('파트너 탭(각자): 보기만(자물쇠), 편집·추가·추천값 없음, 공유는 있음', async ({ page }) => {
  const { db, go } = await open(page, '/salary?view=plan&who=yebin');
  joinYebin(db);
  await go();
  await expect(page.getByText('예빈님 월급 계획이에요. 보기만 할 수 있어요')).toBeVisible();
  const card = page.locator('.hg-receipt');
  await expect(card.locator('.hg-receipt__amount')).toHaveText('270만 원');
  await expect(card.getByText('매달 10일')).toBeVisible();
  await expect(card.locator('.hg-receipt__lock')).toHaveCount(2);
  // 누를 수 있는 건 머리 아래 ‘이번 달 0/2 체크했어요 ›’ 링크 하나(2026-11-09)
  await expect(card.getByRole('button')).toHaveText(['이번 달 0/2 확인했어요']);
  for (const n of ['편집하기', '추천값으로 다시 채우기', '+ 지출 추가', '+ 저금 추가'])
    await expect(page.getByRole('button', { name: n })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '공유하기' })).toBeVisible();
  await axe(page);
  // 내 탭으로
  await page.getByRole('tab', { name: '찬우' }).click();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
});

test('합쳐서: 두 사람 Avatar 겹침, 수입 합, 월급날 둘, 용돈 줄은 지울 수 없음', async ({
  page,
}) => {
  const { db, go } = await open(page);
  joinYebin(db);
  Object.assign(db.space ?? {}, { salary_mode: 'joint' });
  db.splits = [
    {
      id: 'split-j',
      owner_user_id: null,
      split_line: [
        ['saving', 'goal-h', null, 950_000],
        ['fixed', null, null, 1_560_000],
        ['allowance', null, chanwoo.id, 350_000],
        ['allowance', null, 'yebin', 270_000],
      ].map(([kind, goal_id, user_id, amount], i) => ({
        id: `j${i}`,
        split_id: 'split-j',
        kind,
        goal_id,
        user_id,
        name: null,
        amount,
        sort: i,
      })),
    },
  ];
  db.checklists = [];
  await go();
  await expect(page.locator('.hg-receipt__head .hg-avatars .hg-avatar')).toHaveCount(2);
  await expect(page.locator('.hg-receipt__amount')).toHaveText('620만 원');
  await expect(page.getByText('찬우 25일, 예빈 10일')).toBeVisible();
  expect(await names(page, '지출')).toEqual(['고정지출', '찬우 용돈', '예빈 용돈']);
  await page.getByRole('button', { name: '편집하기' }).click();
  await expect(page.getByRole('button', { name: '고정지출 지우기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '찬우 용돈 지우기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '예빈 용돈 지우기' })).toHaveCount(0);
  await axe(page);
});

test('모자람: 막대는 저금·지출만, 범례 “여유 자금 −32만 원”, 합계 “32만 원이 모자라요”(danger)', async ({
  page,
}) => {
  const { db, go } = await open(page);
  Object.assign(lineOf(db, 'living') ?? {}, { amount: 1_200_000 });
  await go();
  // 139만 / 243만(기준 382만) → 36.39 / 63.61 → 36 / 64
  await expect(
    page.getByRole('img', { name: '저금 36%, 지출 64%, 여유 자금 −32만 원' }),
  ).toBeVisible();
  await expect(page.locator('.hg-receipt__legend li.is-short')).toHaveText('여유 자금 −32만 원');
  const short = page.locator('.hg-receipt__row.is-short');
  await expect(short).toContainText('32만 원이 모자라요');
  const red = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(),
  );
  expect(red).not.toBe('');
  await expect(short.locator('.hg-receipt__amt')).not.toHaveCSS('color', 'rgb(0, 0, 0)');
  await axe(page);
});

test('공유하기: 브라우저는 PNG 내려받기 + Toast', async ({ page }) => {
  const { go } = await open(page);
  await go();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유하기' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('sweetwo-plan-2026-10-07.png');
  await expect(page.getByText('이미지를 저장했어요')).toBeVisible();
});

test('금액 가리기: 영수증 금액은 •••, 공유 이미지도 가린 금액으로', async ({ page }) => {
  const { go } = await open(page);
  await page.addInitScript(() => localStorage.setItem('sweetwo.masked', '1'));
  // 이미지에 그린 글자를 모음(가린 금액인지 확인)
  await page.addInitScript(() => {
    const w = window as unknown as { __drawn: string[] };
    w.__drawn = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t: string, x: number, y: number) {
      w.__drawn.push(t);
      return fill.call(this, t, x, y);
    };
  });
  await go();
  const card = page.locator('.hg-receipt');
  await expect(card.locator('.hg-receipt__amount')).toHaveText('•••');
  await expect(card.locator('.hg-receipt__amt').first()).toHaveText('•••');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '공유하기' }).click();
  await dl;
  const drawn = await page.evaluate(() => (window as unknown as { __drawn: string[] }).__drawn);
  expect(drawn).toContain('•••');
  expect(drawn.some((t) => /만 원/.test(t))).toBe(false);
  expect(drawn).toContain('내 집 마련');
});

test('W-10 ‘매달 금액 바꾸기’ 주소(?line=): 그 저금 줄 시트를 열고 시작, ‘저금 보기’', async ({
  page,
}) => {
  const { go } = await open(page, '/salary?view=plan&line=goal-h');
  await go();
  const sheet = page.getByRole('dialog', { name: '내 집 마련 금액' });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  await sheet.getByRole('button', { name: '저금 보기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
});

test('오프라인: 줄을 눌러도 시트 없이 “인터넷에 연결되면 할 수 있어요”', async ({
  page,
  context,
}) => {
  const { go } = await open(page);
  await go();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: '생활비 88만 원' }).click();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await context.setOffline(false);
});

// ── QA 5구간(2026-11-12) ────────────────────────────────────────────

test('추천값으로 다시 채우기(D1): 직접 추가 줄은 금액 그대로, 고정지출·생활비는 남은 금액에서, 확인 창은 바뀌는 것을', async ({
  page,
}) => {
  const { db, go } = await open(page);
  const sp = db.splits[0];
  sp?.split_line.push({
    id: 'c-m',
    split_id: sp.id,
    kind: 'custom',
    goal_id: null,
    user_id: null,
    name: '관리비',
    amount: 150_000,
    sort: sp.split_line.length,
  });
  await go();
  await page.getByRole('button', { name: '추천값으로 다시 채우기' }).click();
  const modal = page.getByRole('alertdialog', { name: '추천값으로 다시 채울까요?' });
  await expect(
    modal.getByText(
      '고정지출, 생활비, 용돈과 기한을 정한 저금 금액이 바뀌어요. 직접 추가한 지출은 그대로예요',
    ),
  ).toBeVisible();
  await modal.getByRole('button', { name: '다시 채우기' }).click();
  await expect(page.getByText('월급 계획을 바꿨어요')).toBeVisible();
  // 06 3-2: 기준 350만 − 15만 = 335만 → 고정지출·생활비 84만
  await expect.poll(() => lineOf(db, 'custom', '관리비')?.amount).toBe(150_000);
  expect(lineOf(db, 'fixed')?.amount).toBe(840_000);
  expect(lineOf(db, 'living')?.amount).toBe(840_000);
  expect(await names(page, '지출')).toEqual(['고정지출', '생활비', '용돈', '관리비']);
});

test('Toast ‘되돌리기’를 누르면 토스트가 닫힘(S5-03)', async ({ page }) => {
  const { db, go } = await open(page);
  await go();
  await page.getByRole('button', { name: '생활비 88만 원' }).click();
  const sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await sheet.getByRole('textbox', { name: '생활비 금액' }).fill('800000');
  await sheet.getByRole('button', { name: '확인' }).click();
  const undo = page.getByRole('button', { name: '되돌리기' });
  await undo.click();
  await expect(page.locator('.hg-toast')).toHaveCount(0);
  await expect.poll(() => lineOf(db, 'living')?.amount).toBe(880_000);
});

test('파트너 탭(각자)인데 파트너 월급 계획이 없으면 빈 카드(D3)', async ({ page }) => {
  const { db, go } = await open(page, '/salary?view=plan&who=yebin');
  joinYebin(db);
  db.splits = db.splits.filter((s) => s.owner_user_id !== 'yebin');
  await go();
  await expect(page.getByText('예빈님은 아직 월급 계획이 없어요')).toBeVisible();
  await expect(page.locator('.hg-receipt')).toHaveCount(0);
  await expect(page.getByText('예빈님 월급 계획이에요. 보기만 할 수 있어요')).toHaveCount(0);
});

test('못 불러오면 오류 카드 + 다시 시도, 구간 탭은 그대로(S5-02)', async ({ page }) => {
  const { go } = await open(page);
  let fail = true;
  await page.route('**/rest/v1/salary_split*', (r) =>
    fail
      ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' })
      : r.fallback(),
  );
  await go();
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('tab', { name: '계획' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.hg-receipt')).toBeVisible();
});

test('오프라인: ‘+ 저금 추가’도 W-11로 가지 않음(S5-08)', async ({ page, context }) => {
  const { go } = await open(page);
  await go();
  await expect(page.getByRole('button', { name: '편집하기' })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: '+ 저금 추가' }).click();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  await context.setOffline(false);
});

test('저금 그만 모음 되돌리기는 원래 자리(S5-09)', async ({ page }) => {
  const { go } = await open(page);
  await go();
  await page.getByRole('button', { name: '청약 44만 원' }).click();
  await page
    .getByRole('dialog', { name: '청약 금액' })
    .getByRole('button', { name: '청약 줄 지우기' })
    .click();
  await page
    .getByRole('alertdialog', { name: '청약 저금을 그만 모을까요?' })
    .getByRole('button', { name: '그만할게요' })
    .click();
  await expect.poll(() => names(page, '저금')).toEqual(['내 집 마련']);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => names(page, '저금')).toEqual(['청약', '내 집 마련']);
});

test('금액 가리기: 화면 읽기는 “가려진 금액”, 시트 미리보기도 가림(S5-12)', async ({ page }) => {
  const { go } = await open(page);
  await page.addInitScript(() => localStorage.setItem('sweetwo.masked', '1'));
  await go();
  await page.getByRole('button', { name: '생활비 가려진 금액' }).click();
  const sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await expect(sheet.locator('.hg-help', { hasText: '여유 자금' })).toHaveText(
    '여유 자금 •••가려진 금액',
  );
});

test('W-02 ‘이번 달’도 못 불러오면 오류 카드(‘월급 없음’ 카드가 아님, S5-02)', async ({ page }) => {
  const { go } = await open(page, '/salary');
  const fail = (r: Route) =>
    r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' });
  await page.route('**/rest/v1/pay_checklist*', fail);
  await page.route('**/rest/v1/rpc/ensure*', fail);
  await go();
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page.getByText('월급이 생기면 월급 계획을 만들어 드려요')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '이번 달' })).toBeVisible();
});
