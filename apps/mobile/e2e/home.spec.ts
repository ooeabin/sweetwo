import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';
import { chanwoo } from './supabase-mock';
import { mockRealtime } from './realtime-mock';

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

const hero = (page: Page) => page.locator('.hg-hubhero');
const PARTNER = {
  id: 'yebin',
  nickname: '예빈',
  side: 'bride',
  employment: 'regular',
  monthly_income: 2_700_000,
  payday: 10,
  payday_last: false,
  allowance: 270_000,
};

test('홈 허브(19, 2026-11-09): 큰 상자(다음 월급날, 이번 달 체크, 체크한 금액·모은 금액), 타일, 저금 상자 → 체크하면 상자 숫자가 바뀜', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  // 예전 체크 목록 카드·저금 줄 목록·일정 카드는 없음(2026-11-09)
  await expect(page.getByRole('region', { name: '9월 월급' })).toHaveCount(0);
  await expect(page.locator('.hg-transfer')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '일정' })).toHaveCount(0);
  // 1. 큰 상자: 10월 25일 월급날까지 18일, 보낸 줄 0 / 5
  const h = hero(page);
  await expect(h).toContainText('10월 25일 월급날까지');
  await expect(h).toContainText('18일 남았어요');
  await expect(h.locator('.hg-hubhero__count')).toHaveText('0 / 5');
  await expect(h).toContainText('이번 달 체크');
  await expect(h).toContainText('체크한 금액0원');
  await expect(h).toHaveAccessibleName(
    '10월 25일 월급날까지 18일 남았어요. 이번 달 5개 중 0개 체크했어요. 체크한 금액 0원, 모은 금액 0원',
  );
  // 혼자(예빈 미합류)면 Avatar 하나
  await expect(h.locator('.hg-avatar')).toHaveCount(1);
  // 2. 할 일: 월급날(9월 25일)에서 7일이 지나 ‘월급날 체크’ 없음, 초대는 큰 상자 아래 코코아 띠(2026-11-11)
  await expect(page.locator('.hg-hubband')).toHaveCount(1);
  await expect(page.locator('.hg-hubband')).toContainText('함께할 사람을 초대해 주세요');
  await expect(page.locator('.hg-hubband')).toContainText('초대하기');
  await expect(page.locator('.hg-banner--todo')).toHaveCount(0);
  // 월급 계획 타일은 오렌지 포인트 상자(2026-11-11), 캘린더는 흰 상자
  await expect(page.locator('.hg-hubtile--point')).toHaveCount(1);
  await expect(page.locator('.hg-hubtile--point')).toContainText('월급 계획');
  // 3~5. 타일과 저금 상자(목표 금액이 있는 내 집 마련, 청약은 목표 금액이 없어 상자에 없음)
  await expect(page.getByRole('button', { name: /^월급 계획/ })).toContainText('매달 25일');
  await expect(page.getByRole('button', { name: /^캘린더/ })).toContainText('다가오는 일정 없어요');
  const box = page.getByRole('button', { name: /^내 집 마련, 0%/ });
  await expect(box).toContainText('0원 / 1억 5,000만 원');
  // 2026-11-11 보조 줄 ‘순자산’은 없앰(값만)
  await expect(page.getByRole('button', { name: /^자산 관리/ })).not.toContainText('순자산');
  await expect(page.getByRole('button', { name: /^저금/ })).toContainText('2개 모으는 중');
  // 2D 그림이 들어올 때까지 회색 빈 자리(타일 72px 둘 + 저금 상자 56px)
  await expect(page.locator('.hg-hub .hg-artslot')).toHaveCount(3);
  await axe(page);

  // 큰 상자 → W-02, 체크하면 모은 금액에 더해짐
  await h.click();
  await expect(page).toHaveURL(/\/salary$/);
  await page.getByRole('checkbox', { name: '내 집 마련 체크' }).click();
  await expect(page.getByText('내 집 마련에 95만 원 더했어요')).toBeVisible();
  // 좁은 창은 머리 ‹(홈으로), 넓은 창은 사이드바 ‘홈’
  await page
    .getByRole('button', { name: '홈으로' })
    .or(page.getByRole('link', { name: '홈', exact: true }))
    .locator('visible=true')
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(h.locator('.hg-hubhero__count')).toHaveText('1 / 5');
  await expect(h).toContainText('체크한 금액95만 원');
  await expect(h).toContainText('모은 금액95만 원');
  await expect(page.getByRole('button', { name: /^내 집 마련, \d+%/ })).toContainText(
    '95만 원 / 1억 5,000만 원',
  );
  await expect(page.getByRole('button', { name: /^저금/ })).toContainText('95만 원');

  // W-02에서 나머지 체크 → 이동 없이 막대 아래 “다 했어요” 한 줄 + Toast(2026-11-12 W-02 끝 없앰) → 홈 큰 상자 5 / 5
  await h.click();
  for (const name of ['청약', '고정지출', '생활비', '용돈'])
    await page.getByRole('checkbox', { name: `${name} 체크` }).click();
  await expect(page.locator('.hg-planbar__title')).toHaveText('9월 월급 체크를 다 했어요');
  await expect(page.locator('.hg-toast')).toContainText('9월 월급 체크를 다 했어요');
  await expect(page).toHaveURL(/\/salary$/);
  await axe(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  await expect(h.locator('.hg-hubhero__count')).toHaveText('5 / 5');
  await expect(h).toContainText('체크한 금액350만 원');
});

test('홈 상자 → 화면(2026-11-09): 월급 계획 W-01, 캘린더 Y-01, 저금 상자 W-10, 자산 관리 F-01, 저금 W-13', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  for (const [name, url] of [
    [/^월급 계획/, /\/salary\?view=plan$/],
    [/^캘린더/, /\/calendar\/list$/],
    [/^내 집 마련, 0%/, /\/salary\/items\/goal-h$/],
    [/^자산 관리/, /\/assets$/],
    [/^저금/, /\/salary\/items\?from=home$/],
  ] as const) {
    await page.goto('/');
    await page.getByRole('button', { name }).click();
    await expect(page).toHaveURL(url);
  }
  // 키보드만으로: 큰 상자에 포커스(ink 링) → Enter
  await page.goto('/');
  await hero(page).focus();
  await expect(hero(page)).toBeFocused();
  const ring = await hero(page).evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(ring).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/salary$/);
});

test('할 일 띠(H-06 3a, 2026-11-09): 월급날부터 7일 안 코코아 띠(2026-11-11) “월급날 체크할 차례예요” → W-02, 닫기 없이 다 체크하면 사라지고 초대 띠(맨 끝)', async ({
  page,
}) => {
  const PAY = new Date('2026-09-28T10:00:00+09:00');
  await page.clock.setFixedTime(PAY);
  const db = await mockOnboarding(page, { now: PAY });
  seed(db);
  await page.goto('/');
  const band = page.locator('.hg-hubband');
  await expect(band).toContainText('월급날 체크할 차례예요');
  await expect(band).toContainText('체크하기');
  await expect(hero(page)).toContainText('27일 남았어요');
  // 한 번에 하나: 초대 띠는 아직 없음
  await expect(page.locator('.hg-hubband')).toHaveCount(1);
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toHaveCount(0);
  // 코코아 띠 위 밝은 글자, 오렌지 포인트 상자 위 ink(라이트)/어두운 글자(다크) → axe 대비 통과
  await axe(page);
  await band.getByRole('button', { name: /월급날 체크할 차례예요/ }).click();
  await expect(page).toHaveURL(/\/salary$/);
  await page.goto('/');
  // 2026-11-11 띠 닫기(✕) 없음: 띠 전체 버튼 하나뿐
  await expect(band.getByRole('button')).toHaveCount(1);
  await expect(band.getByRole('button', { name: '닫기' })).toHaveCount(0);
  // 다 체크하면(‘못 함’ 포함) 사라지고, 다른 할 일이 없으니 같은 자리에 초대 띠(맨 끝 순서)
  for (const c of db.checklists)
    for (const l of c.pay_check_line as unknown as { state: string }[]) l.state = 'checked';
  await page.reload();
  await expect(band).toHaveCount(1);
  await expect(band).toContainText('함께할 사람을 초대해 주세요');
  await expect(band).not.toContainText('월급날 체크할 차례예요');
  await expect(band.getByRole('button', { name: '닫기' })).toHaveCount(0);
});

test('두 사람(찬우·예빈, 각자): 큰 상자 Avatar 둘, 저금 상자는 목표 금액에 가장 가까운 저금(예빈 것도, 이름 배지), 모은 금액은 내 저금만', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = PARTNER;
  Object.assign(db.goals.find((g) => g.id === 'goal-h') ?? {}, { start_saved: 60_000_000 });
  db.goals.push({
    ...(db.goals.find((g) => g.id === 'goal-h') ?? {}),
    id: 'goal-y',
    name: '여행',
    owner_user_id: 'yebin',
    created_by: 'yebin',
    target_amount: 5_000_000,
    start_saved: 4_000_000,
    deadline: null,
  });
  await page.goto('/');
  const h = hero(page);
  await expect(h.locator('.hg-avatar')).toHaveCount(2);
  // 모은 금액 = 찬우 저금(내 집 마련 6,000만 + 청약 0)
  await expect(h).toContainText('모은 금액6,000만 원');
  // 저금 상자: 여행 80% > 내 집 마련 40%. 파트너 저금이라 이름 옆 “예빈” 배지(2026-11-11 D4)
  const save = page.getByRole('button', { name: /^여행, 예빈, 80%/ });
  await expect(save).toContainText('400만 원 / 500만 원');
  await expect(save.locator('.hg-hubtile__badge')).toHaveText('예빈');
  // 저금 타일은 W-13 범위(예빈 것 포함)
  await expect(page.getByRole('button', { name: /^저금/ })).toContainText('3개 모으는 중');
  await expect(page.getByRole('button', { name: /^저금/ })).toContainText('6,400만 원');
  // 합류했으니 초대 띠 없음
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toHaveCount(0);
  await axe(page);
});

test('첫 저금 빈 줄(2026-11-09): 내 저금이 없으면 W-02 저금 묶음에 ‘+ 저금 추가 (여유 자금)’ → W-11a. 홈은 저금 상자 없음, 저금 타일 “아직 없어요”', async ({
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
  await expect(page.locator('.hg-hubsave')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^저금/ })).toContainText('아직 없어요');
  await expect(page.getByRole('button', { name: /저금 추가 \(여유 자금/ })).toHaveCount(0);
  await axe(page);

  // W-02 저금 묶음 자리(‘+ 저금 추가’ 줄 대신 첫 저금 빈 줄)
  await page.goto('/salary');
  const group = page.getByRole('region', { name: '저금', exact: true });
  await expect(group.locator('.hg-addrow')).toHaveCount(0);
  await group.getByRole('button', { name: '저금 추가 (여유 자금 139만 원)' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new\/a\?from=salary$/);
  await expect(page.getByRole('heading', { name: '무엇을 위해 모을까요?' })).toBeVisible();
});

test('첫 저금 빈 줄: 합류한 파트너(각자)에게 파트너 저금이 있으면 W-02에 “{파트너}님처럼 나도 모을 곳을 만들어 볼까요?”', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 찬우 저금은 모두 예빈 것으로(이 계정의 저금은 없음)
  for (const g of db.goals) Object.assign(g, { owner_user_id: 'yebin', created_by: 'yebin' });
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = PARTNER;
  const sp = db.splits[0];
  if (!sp) throw new Error('seed');
  sp.split_line = sp.split_line.filter((l) => l.kind !== 'saving');
  const c = db.checklists[0];
  if (c)
    c.pay_check_line = (c.pay_check_line as Record<string, unknown>[]).filter(
      (l) => l.kind !== 'saving',
    );
  await page.goto('/salary');
  const row = page
    .getByRole('region', { name: '저금', exact: true })
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
  // 코코아 할 일 띠(H-06, 2026-11-11) + “확인하기 ›”
  const band = page.locator('.hg-hubband');
  await expect(band).toContainText('9월 월급에서 체크 안 한 게 5개 있어요');
  await expect(band).toContainText('확인하기');
  await band.getByRole('button', { name: /체크 안 한 게/ }).click();
  // 할 일 띠는 그 체크리스트만(2026-11-12 D3)
  await expect(page).toHaveURL(/\/salary\/review\?checklist=checklist-1&from=home$/);
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
  // 체크한 줄은 목록에 남고 체크 모양(2026-11-12 D6), ‘못 함’ 줄은 빠짐
  await expect(page.getByRole('checkbox', { name: '내 집 마련 체크' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('.hg-transfer', { hasText: '청약' })).toHaveCount(0);
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('H-04 자산 관리 타일(2026-11-09): 순자산 값(보조 줄 없음, 2026-11-11), 공지 띠(AD-10)는 맨 위, 초대 띠는 큰 상자 아래', async ({
  page,
}) => {
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
  // 평가금액 기준 순자산(2026-11-13) 1,000 + 2,120 = 3,120만
  db.assets.push(
    asset('a1', '공동 예금', 10_000_000, null),
    asset('a2', '공동 펀드', 21_200_000, 20_000_000),
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
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile).not.toContainText('순자산');
  await expect(tile).toContainText('3,120만 원');
  // 예전 순자산 카드(지난달 대비, 6달 막대)는 없음
  await expect(page.getByRole('region', { name: '순자산', exact: true })).toHaveCount(0);
  const bands = page.locator('.hg-body__banner');
  await expect(bands.first()).toContainText('10월 20일 새벽 점검');
  // 2026-11-11 초대 띠는 맨 위 띠 묶음이 아니라 큰 상자 아래 코코아 띠
  await expect(
    page.locator('.hg-body__banner', { hasText: '함께할 사람을 초대해 주세요' }),
  ).toHaveCount(0);
  await expect(page.locator('.hg-hubband')).toContainText('함께할 사람을 초대해 주세요');
  await bands.first().getByRole('button', { name: '보기' }).click();
  await expect(page.getByText('오전 2시부터 4시까지 저장이 안 돼요')).toBeVisible();
  await axe(page);
  await tile.click();
  await expect(page).toHaveURL(/\/assets$/);
  // 자산 관리도 회색 바탕(2026-11-09)
  await expect(page.locator('.hg-frame')).toHaveClass(/hg-frame--alt/);
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
  // 2026-11-09 홈에서는 체크하지 않아 W-02에서
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __offline: boolean }).__offline = true;
    window.dispatchEvent(new Event('offline'));
  });
  // 받아 둔 화면이 있으면 13-9 “오프라인 / 마지막 저장 {시각}”(2026-11-12 S6-17, 처음 받기 전이면 “연결이 끊겼어요”)
  await expect(page.getByRole('status').filter({ hasText: '마지막 저장' })).toBeVisible();
  const box = page.getByRole('checkbox', { name: '내 집 마련 체크' });
  await box.click();
  await expect(page.getByText('인터넷에 연결되면 할 수 있어요')).toBeVisible();
  await expect(box).not.toBeChecked();
  expect(db.rpc.filter((x) => x === 'check_pay_line')).toHaveLength(0);
  await axe(page);
});

// ---- QA 4구간(2026-11-11): 맨 위 띠, 큰 상자 오류, 자산 없음, Realtime ----

const pendingUnlink = (db: Awaited<ReturnType<typeof mockOnboarding>>, by: string) => {
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending', partner_nickname: '예빈' });
  db.partner = PARTNER;
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-1',
    requested_by: by,
    partner_id: by === 'yebin' ? chanwoo.id : 'yebin',
    status: 'pending',
    deadline: '2026-10-20',
    requested_at: '2026-10-06T01:00:00Z',
  });
};
const mustNotice = {
  id: 'n2',
  kind: 'maintenance',
  title: '10월 20일 새벽 점검이 있어요. 오전 2시부터 4시까지 저장이 안 돼요',
  body: '점검 중에는 볼 수만 있어요',
  importance: 'must',
  platforms: ['desktop', 'web', 'ios', 'android'],
};

test('맨 위 띠는 하나만(D3): 해제 대기 > 필독 공지 > 메일 반송 > 일반 공지. 회색 바탕 위 회색 띠는 흰 판(D1), 두 줄까지(D2)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  pendingUnlink(db, 'yebin');
  db.mailBounced = true;
  db.notices.push(mustNotice, { ...mustNotice, id: 'n3', title: '새 기능', importance: 'normal' });
  await page.goto('/');
  const bands = page.locator('.hg-body__banners .hg-banner');
  await expect(page.getByText('예빈님이 연결 해제를 요청했어요')).toBeVisible();
  await expect(bands).toHaveCount(1);
  // 흰 판: 큰 상자와 같은 바탕(surface), 회색 바탕(frame)과 다름
  const bg = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg('.hg-banner--strip')).toBe(await bg('.hg-hubhero'));
  expect(await bg('.hg-banner--strip')).not.toBe(await bg('.hg-frame'));
  // 두 줄까지 보이고 그 뒤 말줄임
  expect(
    await page
      .locator('.hg-banner--strip strong')
      .evaluate((el) =>
        [el, el.closest('.hg-banner__one')].some(
          (e) => !!e && getComputedStyle(e).webkitLineClamp === '2',
        ),
      ),
  ).toBe(true);
  await axe(page);
  // 해제가 풀리면 필독 공지 → 메일 반송 → 일반 공지 순으로 하나씩
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  db.unlinks.length = 0;
  await page.reload();
  await expect(bands).toHaveCount(1);
  await expect(bands.first()).toContainText('10월 20일 새벽 점검');
  db.notices.splice(0, 1);
  await page.reload();
  await expect(bands).toHaveCount(1);
  await expect(bands.first()).toContainText('알림 메일이 전달되지 않았어요');
  db.mailBounced = false;
  await page.reload();
  await expect(bands).toHaveCount(1);
  await expect(bands.first()).toContainText('새 기능');
});

test('큰 상자(S4-01): 월급이 있는데 체크리스트를 못 불러오면 오류 카드 + 다시 시도, 월급이 없을 때만 ‘월급 알려 주기’', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  test.setTimeout(90_000);
  let fail = true;
  let tries = 0;
  await page.route('**/rest/v1/pay_checklist*', (r) => {
    if (!fail || r.request().method() !== 'GET') return r.fallback();
    tries += 1;
    return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' });
  });
  await page.goto('/');
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 30_000 });
  // 홈이 그려지며 붙은 쿼리가 한 번 더 받아 보는 것(재시도 4번)까지 끝난 뒤 확인(그동안도 오류 카드 그대로)
  await expect.poll(() => tries, { timeout: 30_000 }).toBeGreaterThanOrEqual(8);
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('월급이 생기면 월급 계획을 만들어 드려요')).toHaveCount(0);
  await axe(page);
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(hero(page)).toBeVisible();
  // 월급이 없음(O-31 ‘지금은 월급이 없어요’): 월급 알려 주기 카드
  Object.assign(db.me, { monthly_income: 0, payday: null });
  db.splits.length = 0;
  db.checklists.length = 0;
  await page.reload();
  await expect(page.getByText('월급이 생기면 월급 계획을 만들어 드려요')).toBeVisible();
  await expect(page.getByText('잠시 문제가 생겼어요')).toHaveCount(0);
});

test('자산 관리 타일(D5): 자산·부채가 없으면 “0원” 대신 “아직 없어요”', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile).toContainText('아직 없어요');
  await expect(tile).not.toContainText('0원');
});

test('Realtime(S4-02): 파트너가 합류하면 초대 띠가 사라짐', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(page.locator('.hg-hubband')).toContainText('함께할 사람을 초대해 주세요');
  await expect.poll(() => rt.subscribed('notification')).toBeGreaterThan(0);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = PARTNER;
  rt.emit('notification', 'INSERT', {
    id: '00000000-0000-4000-8000-000000000301',
    user_id: 'me',
    kind: 'partner_joined',
    title: '예빈님이 합류했어요',
    target: '/',
    read_at: null,
    created_at: '2026-10-07T01:00:00Z',
  });
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toHaveCount(0);
  await expect(hero(page).locator('.hg-avatar')).toHaveCount(2);
});

test('Realtime(S4-02): P-WAIT 대기 중 시작한 사람이 월급 계획을 만들면 바로 다음 화면', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const splits = [...db.splits];
  db.splits.length = 0;
  db.checklists.length = 0;
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    created_by: 'starter',
    partner_nickname: '예빈',
  });
  db.partner = { ...PARTNER, id: 'starter', nickname: '찬우' };
  Object.assign(db.me, { nickname: '예빈', onboarding_step: 'P-WAIT' });
  await page.goto('/');
  await expect(page.getByText('찬우님이 시작하고 있어요')).toBeVisible();
  await expect.poll(() => rt.subscribed('salary_split')).toBeGreaterThan(0);
  db.splits.push(...splits);
  rt.emit('salary_split', 'INSERT', { id: 'split-new', space_id: 'space-1' });
  await expect(page).toHaveURL(/\/join\/p-04/);
});

test('Realtime(S4-02): 합쳐서 모드에서 상대가 체크하면 큰 상자 숫자가 바로 바뀜', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    salary_mode: 'joint',
    joint_cycle_day: 25,
  });
  db.partner = PARTNER;
  for (const sp of db.splits) sp.owner_user_id = null;
  for (const c of db.checklists) c.owner_user_id = null;
  for (const g of db.goals) g.owner_user_id = null;
  await page.goto('/');
  await expect(page.locator('.hg-hubhero__count')).toHaveText('0 / 5');
  await expect.poll(() => rt.subscribed('pay_check_line')).toBeGreaterThan(0);
  const line = (db.checklists[0]?.pay_check_line as Record<string, unknown>[])[2] ?? {};
  Object.assign(line, {
    state: 'checked',
    checked_by: 'yebin',
    checked_at: '2026-10-07T01:00:00Z',
  });
  rt.emit('pay_check_line', 'UPDATE', { id: line.id, space_id: 'space-1', state: 'checked' });
  await expect(page.locator('.hg-hubhero__count')).toHaveText('1 / 5');
});
