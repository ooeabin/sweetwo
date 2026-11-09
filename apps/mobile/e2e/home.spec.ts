import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';

// 이미 쓰던 사람: 온보딩 뒤 ‘월급 계획 확인’(ADR 0005)은 끝낸 상태로
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sweetwo:home:todo-closed', JSON.stringify(['split:split-1']));
    } catch {
      /* 없음 */
    }
  });
});

// 홈(19)과 월급 체크리스트(20 W-01·W-02·W-02a·W-02 끝·W-05). 찬우 혼자(예빈 미합류), 각자, 실수령 350만, 월급날 25일.
// 9월 월급 사이클 = 9월 25일 ~ 10월 24일, 월급 전 확인은 10월 22일부터.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
const REVIEW = new Date('2026-10-22T10:00:00+09:00');

const salaryCard = (page: Page) => page.getByRole('region', { name: '9월 월급' });

test('홈: 저금 항목(H-02), 이번 달 월급 체크 → 모은 금액에 더해짐 → 다 보냈어요', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');

  // 인사 카드 없이 맨 위가 이번 달 체크리스트(2026-11-03). 인사 문장은 화면 읽기용 제목
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  await expect(page.getByRole('button', { name: '월급 체크하기' })).toHaveCount(0);
  // 홈에서는 3줄까지만(나머지는 W-02)
  await expect(salaryCard(page).locator('.hg-transfer')).toHaveCount(3);
  // H-02 저금 항목(ADR 0007): 목표 금액이 있는 항목만(청약은 목표 금액이 없어 없음). 이번 달 체크는 위 체크리스트에서만
  const savings = page.getByRole('region', { name: '저금', exact: true });
  await expect(savings).toContainText('내 집 마련');
  await expect(savings).not.toContainText('청약');
  await expect(page.getByRole('button', { name: /^내 집 마련/ })).toContainText(
    '0원 / 1억 5,000만 원',
  );
  await expect(salaryCard(page)).toContainText('5개 중 0개 완료');
  // 자산이 없으면 자산 카드 없음(2026-11-03)
  await expect(page.getByRole('region', { name: '자산' })).toHaveCount(0);
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toBeVisible();
  await axe(page);

  // 홈 카드에서 바로 체크 → Toast, 저금 항목 줄도 모은 금액이 늘어남
  await salaryCard(page).getByRole('checkbox', { name: '내 집 마련 체크' }).click();
  await expect(page.getByText('내 집 마련에 95만 원 더했어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /^내 집 마련/ })).toContainText(
    '95만 원 / 1억 5,000만 원',
  );
  await expect(salaryCard(page)).toContainText('5개 중 1개 완료');
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();

  // W-02: 남은 줄 체크 → 마지막 줄이면 W-02 끝(카드 머리 ‘5개 중 1개 완료 ›’)
  await salaryCard(page).getByRole('link', { name: '5개 중 1개 완료' }).click();
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  await expect(page.getByText('09.25 ~ 10.24', { exact: true })).toBeVisible();
  // 2026-11-09 잇기: 개수는 진행 막대 화면 읽기 이름, 아래 “보낸 금액”
  await expect(page.getByRole('img', { name: '5개 중 1개 완료' })).toBeVisible();
  await expect(page.getByText('보낸 금액 95만 원 / 350만 원')).toBeVisible();
  await axe(page);
  for (const name of ['청약', '고정지출', '생활비', '용돈'])
    await page.getByRole('checkbox', { name: `${name} 체크` }).click();
  await expect(page.getByRole('heading', { name: '이번 달 월급 체크를 다 했어요' })).toBeVisible();
  // 달 결과 카드(2026-11-09, 저금 요약 대신): 저금 소계 139만, 보낸 금액 350만
  const result = page.locator('.hg-receipt');
  await expect(result.getByText('9월 월급', { exact: true })).toBeVisible();
  await expect(result.locator('.hg-receipt__subtotal').first()).toHaveText('139만 원');
  await expect(result.getByText('보낸 금액', { exact: true })).toBeVisible();
  // 축하 그림 자리(2026-11-08 2D 플랫으로 다시 만들 때까지 빈 자리)
  await expect(page.locator('.hg-doneart.hg-artslot')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  await expect(page.getByText('9월 월급 체크를 다 했어요', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '월급 체크하기' })).toHaveCount(0);
});

test('첫 저금 빈 줄(2026-11-09): 내 저금이 없으면 홈 H-03·W-02 저금 묶음에 ‘+ 저금 추가 (여유 자금)’ → W-11a, H-02 제안 문장 없음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 온보딩 직후처럼 저금이 하나도 없음: 여유 자금 = 350만 − 88만 − 88만 − 35만 = 139만
  db.goals.splice(0);
  const sp = db.splits[0];
  if (!sp) throw new Error('seed');
  sp.split_line = sp.split_line.filter((l) => l.kind !== 'saving');
  const c = db.checklists[0];
  if (c)
    c.pay_check_line = (c.pay_check_line as Record<string, unknown>[]).filter(
      (l) => l.kind !== 'saving',
    );
  await page.goto('/');
  const card = page.getByRole('region', { name: '9월 월급' });
  const row = card.getByRole('button', { name: '저금 추가 (여유 자금 139만 원)' });
  await expect(row).toBeVisible();
  // H-02 회색 제안 문장은 없앰
  await expect(page.getByText(/모으고 싶은 돈이 있으면/)).toHaveCount(0);
  await axe(page);
  await row.click();
  await expect(page).toHaveURL(/\/salary\/items\/new\/a\?from=home$/);
  await expect(page.getByRole('heading', { name: '무엇을 위해 모을까요?' })).toBeVisible();

  // W-02 저금 묶음 자리
  await page.goto('/salary');
  const group = page.getByRole('region', { name: '저금', exact: true });
  await group.getByRole('button', { name: '저금 추가 (여유 자금 139만 원)' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new\/a\?from=salary$/);
});

test('첫 저금 빈 줄: 합류한 파트너(각자)에게 파트너 저금이 있으면 “{파트너}님처럼 나도 모을 곳을 만들어 볼까요?”', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 찬우 저금은 모두 예빈 것으로(이 계정의 저금은 없음)
  for (const g of db.goals) Object.assign(g, { owner_user_id: 'yebin', created_by: 'yebin' });
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
  const sp = db.splits[0];
  if (!sp) throw new Error('seed');
  sp.split_line = sp.split_line.filter((l) => l.kind !== 'saving');
  const c = db.checklists[0];
  if (c)
    c.pay_check_line = (c.pay_check_line as Record<string, unknown>[]).filter(
      (l) => l.kind !== 'saving',
    );
  await page.goto('/');
  const row = page
    .getByRole('region', { name: '9월 월급' })
    .getByRole('button', { name: /예빈님처럼 나도 모을 곳을 만들어 볼까요\?/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('여유 자금 139만 원');
  await axe(page);
});

test('W-02a 다른 금액, W-01 월급 계획 고치기(체크 안 한 줄만 새 금액)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  // 생활비 줄을 누르면 시트 → ‘다른 금액으로 보냈어요’ → W-02a
  await page.getByRole('button', { name: /^생활비/ }).click();
  await expect(page.getByRole('dialog', { name: '생활비 88만 원' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다른 금액으로 보냈어요' }).click();
  // 어느 줄인지 제목에, 보조는 계획 금액(2026-11-09)
  await expect(page.getByRole('heading', { name: '생활비, 얼마를 보냈어요?' })).toBeVisible();
  await expect(page.getByText('계획 88만 원')).toBeVisible();
  await page.getByLabel('얼마를 보냈어요?').fill('780000');
  await expect(page.getByText('계획보다 10만 원 적어요')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  const living = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  expect(living.find((l) => l.kind === 'living')).toMatchObject({
    state: 'checked',
    actual: 780_000,
  });

  // W-01 영수증(2026-11-09): 고정지출 88만 → 90만, 확인 = 바로 저장 + Toast, 체크 안 한 고정지출 줄만 새 금액
  await page.getByRole('button', { name: '월급 계획 고치기' }).click();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveAttribute('aria-selected', 'true');
  await axe(page);
  await page.getByRole('button', { name: '고정지출 88만 원' }).click();
  await page.getByRole('textbox', { name: '고정지출 금액' }).fill('900000');
  await expect(page.getByRole('dialog').getByText('2만 원이 모자라요')).toBeVisible();
  await page.getByRole('button', { name: '확인' }).click();
  // 이번 달 체크 안 한 고정지출 줄도 바뀌어 Toast가 그 말로(2026-11-09)
  await expect(page.getByText('이번 달 체크 안 한 줄도 바꿨어요')).toBeVisible();
  await expect(page.locator('.hg-receipt__row.is-short')).toContainText('2만 원이 모자라요');
  const lines = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  expect(lines.find((l) => l.kind === 'fixed')).toMatchObject({ planned: 900_000, state: 'wait' });
  expect(lines.find((l) => l.kind === 'living')).toMatchObject({
    state: 'checked',
    actual: 780_000,
  });
  // 비상금 기본 항목·자동 목표 금액은 없음(ADR 0007): 목표 금액 없는 저금 항목은 그대로
  expect(db.goals.find((g) => g.id === 'goal-e')?.target_amount).toBeNull();
});

test('W-05 월급 전 확인: 다음 월급날 3일 전부터 할 일 한 줄 → 빠진 줄 체크, 이번 달은 못 했어요', async ({
  page,
}) => {
  await page.clock.setFixedTime(REVIEW);
  const db = await mockOnboarding(page, { now: REVIEW });
  seed(db);
  await page.goto('/');
  await expect(page.getByText('9월 월급에서 체크 안 한 게 5개 있어요')).toBeVisible();
  await page
    .getByRole('status')
    .filter({ hasText: '체크 안 한 게' })
    .getByRole('button')
    .first()
    .click();
  await expect(page.getByRole('heading', { name: '9월 월급, 빠진 게 있나요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('checkbox', { name: '내 집 마련 체크' }).click();
  await page.getByRole('button', { name: /^청약/ }).click();
  await page.getByRole('button', { name: '이번 달은 못 했어요' }).click();
  const lines = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  await expect.poll(() => lines.find((l) => l.goal_id === 'goal-e')?.state).toBe('skipped');
  // 줄이 빠지니 Toast로 알림 + 되돌리기(2026-11-03)
  await expect(page.getByText('청약, 이번 달은 못 한 걸로 했어요')).toBeVisible();
  expect(lines.find((l) => l.goal_id === 'goal-h')?.state).toBe('checked');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('H-04 자산: 순자산과 지난달 대비, 공지 띠(AD-10)는 할 일 한 줄 위', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const asset = (id: string, name: string, amount: number, principal: number | null) => ({
    id,
    side: 'asset',
    grp: 'deposit',
    kind: 'deposit',
    name,
    amount,
    principal,
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    deleted_at: null,
  });
  // 원금 기준 순자산 1,000 + 2,000 = 3,000만, 평가 3,120만. 지난달 말 2,790만
  db.assets.push(
    asset('a1', '공동 예금', 10_000_000, null),
    asset('a2', '공동 펀드', 21_200_000, 20_000_000),
  );
  db.netWorth.push(
    { month: '2026-08-01', net: 26_000_000, expected: 26_000_000 },
    { month: '2026-09-01', net: 27_900_000, expected: 28_500_000 },
  );
  db.notices.push({
    id: 'n2',
    kind: 'maintenance',
    title: '10월 20일 새벽 점검',
    body: '오전 2시부터 4시까지 저장이 안 돼요',
    importance: 'must',
    platforms: ['desktop', 'web'],
  });
  await page.goto('/');
  // F-01과 같은 모양(2026-11-03): 문장 + 최근 달 막대. 예상·안 판 수익은 F-01에서
  const card = page.getByRole('region', { name: '순자산', exact: true });
  await expect(card).toContainText('3,000만 원');
  await expect(card).toContainText('지난달보다 210만 원 늘었어요');
  await expect(
    card.getByRole('img', { name: /최근 6개월 순자산, 2026년 10월 3,000만 원/ }),
  ).toBeVisible();
  const bands = page.locator('.hg-body__banner');
  await expect(bands.first()).toContainText('10월 20일 새벽 점검');
  await expect(bands.nth(1)).toContainText('함께할 사람을 초대해 주세요');
  await bands.first().getByRole('button', { name: '보기' }).click();
  await expect(page.getByText('오전 2시부터 4시까지 저장이 안 돼요')).toBeVisible();
  await axe(page);
  await page
    .getByRole('region', { name: '저금', exact: true })
    .getByRole('button', { name: /^내 집 마련/ })
    .click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
});

test('알림 메일 반송(14): 홈 상단 띠 → S-11b 알림 이메일', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.mailBounced = true;
  await page.goto('/');
  await expect(page.getByText('알림 메일이 전달되지 않았어요')).toBeVisible();
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page).toHaveURL(/\/settings\/me\/email$/);
});

test('오프라인(30 동기화 4장): 볼 수만 있고, 체크를 누르면 “인터넷에 연결되면 할 수 있어요”(저장 안 함)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 개발 서버는 닿게 navigator.onLine만 끔
  await page.addInitScript(() => {
    const w = window as unknown as { __offline: boolean };
    w.__offline = false;
    Object.defineProperty(Navigator.prototype, 'onLine', { get: () => !w.__offline });
  });
  await page.goto('/');
  await expect(salaryCard(page)).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __offline: boolean }).__offline = true;
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByRole('status').filter({ hasText: '연결이 끊겼어요' })).toBeVisible();
  const box = salaryCard(page).getByRole('checkbox', { name: '내 집 마련 체크' });
  await box.click();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await expect(box).not.toBeChecked();
  expect(db.rpc.filter((x) => x === 'check_pay_line')).toHaveLength(0);
  await axe(page);
});
