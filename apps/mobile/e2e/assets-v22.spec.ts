import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fakeBridge, fb } from './fake-bridge';
import { type MemDb, mockOnboarding, YEBIN } from './mocks';

// 자산 관리 v2.2(23 ‘자산 관리 v2.2’, 06 7-8, ADR 0009 결정 11·13): F-01 평가금액 + 원금으로 보기, F-03q 빠르게 적기,
// F-03e 첫 공개 선택(미리 고른 값 없음, ‘총액만 보여 주기’), F-08 두 상태(pair / 또래 중간값), 첫 결과 광고 없음,
// ‘새로 확인하기’ 보상형 광고(흉내 브리지: 끝까지 봄, 닫음, 못 불러옴, 브리지 없음), F-08c 동의 요청·답. 찬우, 예빈.

const NOW = new Date('2026-10-07T10:00:00+09:00');

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

const row = (o: Record<string, unknown>) => ({
  principal: null,
  rate_estimated: false,
  maturity_date: null,
  monthly_payment: null,
  interest_rate: null,
  paid_count: null,
  pay_from: null,
  goal_id: null,
  estimated: false,
  owner: 'person',
  visibility: 'all',
  status: 'held',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  deleted_at: null,
  ...o,
});

/** 찬우(1993년생) + 예빈 합류. withAssets면 공동 통장 300만 + 내 주식(평가 1,000만, 원금 800만) + 신용대출 100만 */
function seed(db: MemDb, o: { joined?: boolean; withAssets?: boolean } = {}) {
  const joined = o.joined ?? true;
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    allowance: 500_000,
    birth_year: 1993,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-08-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: joined ? 'connected' : 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    salary_mode: 'separate',
    base_day: null,
    base_day_last: false,
  };
  db.partner = joined
    ? { id: YEBIN, nickname: '예빈', side: 'bride', monthly_income: 2_700_000, payday: 10 }
    : null;
  if (o.withAssets === false) return;
  const me = String(db.me.id);
  db.me.asset_share_default = 'sum';
  db.assets.push(
    row({
      id: 'a1',
      side: 'asset',
      grp: 'cash',
      kind: 'bank',
      name: '생활비 통장',
      amount: 3_000_000,
      owner: 'joint',
      owner_user_id: null,
      created_by: me,
    }),
    row({
      id: 'a2',
      side: 'asset',
      grp: 'invest',
      kind: 'stock_kr',
      name: '내 주식',
      amount: 10_000_000,
      principal: 8_000_000,
      owner_user_id: me,
      created_by: me,
    }),
    row({
      id: 'a4',
      side: 'debt',
      grp: 'credit',
      kind: 'credit_loan',
      name: '신용대출',
      amount: 1_000_000,
      owner_user_id: me,
      created_by: me,
    }),
  );
  db.netWorth.push({ month: '2026-09-01', net: 9_000_000, expected: 11_000_000 });
}

const start = async (
  page: Page,
  o: {
    joined?: boolean;
    withAssets?: boolean;
    ad?: 'rewarded' | 'closed' | 'failed' | 'throw';
  } = {},
) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, o);
  if (o.ad) {
    await fakeBridge(page, { signedIn: true, pin: null, ad: o.ad });
    await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  }
  return db;
};

test('F-01: 순자산은 평가금액 기준, ‘원금으로 보기’를 켜면 원금 기준(예상 순자산 줄 없음)', async ({
  page,
}) => {
  await start(page);
  await page.goto('/assets');
  const nw = page.getByRole('region', { name: '순자산', exact: true });
  // 평가: 300 + 1,000 − 100 = 1,200만, 지난달(평가 1,100만)보다 100만 늘었어요
  await expect(nw).toContainText('1,200만 원');
  await expect(nw).toContainText('지난달보다 100만 원 늘었어요');
  await expect(page.getByText('예상 순자산')).toHaveCount(0);
  await axe(page);
  await page.getByRole('switch', { name: /원금으로 보기/ }).click();
  // 원금: 300 + 800 − 100 = 1,000만, 지난달(원금 900만)보다 100만
  await expect(nw).toContainText('1,000만 원');
});

test('F-03q 빠르게 적기 + F-03e 처음 공개 선택: 미리 고른 값 없음, 빈 칸은 저장 안 함, 고른 값이 기본값', async ({
  page,
}) => {
  const db = await start(page, { withAssets: false });
  await page.goto('/assets');
  await page.getByRole('button', { name: /큰 묶음만 빠르게 적기/ }).click();
  await expect(page).toHaveURL(/\/assets\/quick$/);
  await expect(page.getByRole('heading', { name: '큰 묶음만 빠르게 적어 볼까요?' })).toBeVisible();
  const next = page.getByRole('button', { name: '다음', exact: true });
  await expect(next).toBeDisabled();
  await page.getByLabel('현금·예적금').fill('5000000');
  await page.getByLabel('대출').fill('20000000');
  await axe(page);
  await next.click();
  // F-03e: 질문 + 세 선택지, 아무것도 고르지 않은 채
  await expect(page.getByRole('heading', { name: '파트너에게 어떻게 보여 줄까요?' })).toBeVisible();
  await expect(page.getByText('항목은 안 보이고 총액에만 더해요')).toBeVisible();
  await expect(page.getByText('총액에도 안 더해요')).toBeVisible();
  const save = page.getByRole('button', { name: '저장하기', exact: true });
  await expect(save).toBeDisabled();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await axe(page);
  await page.getByRole('radio', { name: /총액만 보여 주기/ }).click();
  await save.click();
  await expect(page).toHaveURL(/\/assets$/);
  expect(db.me.asset_share_default).toBe('sum');
  const saved = db.assets.filter((a) => !a.deleted_at);
  expect(saved.map((a) => [a.name, a.side, a.amount, a.visibility, a.owner_user_id])).toEqual([
    ['현금·예적금', 'asset', 5_000_000, 'sum', db.me.id],
    ['대출', 'debt', 20_000_000, 'sum', db.me.id],
  ]);
  expect(db.rpc).toContain('set_asset_share_default');
});

test('F-03e: 기본값을 이미 골랐으면 그 값이 골라진 채로, 이름은 ‘총액만 보여 주기’', async ({
  page,
}) => {
  const db = await start(page);
  db.me.asset_share_default = 'private';
  await page.goto('/assets/new?side=asset');
  await page.getByRole('button', { name: /현금성/ }).click();
  await page.getByRole('button', { name: '입출금 통장' }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('현재 금액은 얼마예요?').fill('1000000');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('radio', { name: /^나/ }).click();
  await expect(page.getByRole('heading', { name: '파트너에게 어떻게 보여 줄까요?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /숨기기/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /총액만 보여 주기/ })).toBeVisible();
});

test('F-08 (나) 순위 없음: 또래 가구 중간값 한 줄(광고 없음) → F-08c 같이 보자고 하기', async ({
  page,
}) => {
  const db = await start(page);
  await page.goto('/assets');
  const banner = page.getByRole('button', { name: /또래 가구 중간값 보기/ });
  await expect(banner).toBeVisible();
  await expect(banner).not.toContainText('광고');
  await banner.click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  // 1993년생 → 30대 중간값
  await expect(page.getByText('또래 가구 중간값은 1억 5,585만 원이에요')).toBeVisible();
  await expect(page.getByText(/상위 \d+%/)).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '예빈님과 같이 순위 보기' }).click();
  await expect(page).toHaveURL(/\/assets\/rank\/consent$/);
  await expect(
    page.getByRole('heading', { name: '둘의 자산을 합쳐 전체 가구와 비교해요' }),
  ).toBeVisible();
  await expect(page.getByText('예빈님도 좋다고 하면 보여요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '같이 보자고 하기' }).click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  await expect(page.getByText('예빈님 답을 기다리고 있어요')).toBeVisible();
  expect(db.rank?.requests[0]?.status).toBe('open');
  expect(db.rpc).not.toContain('record_rank_view');
});

test('F-08 (나): 출생연도가 없으면 ‘출생연도 알려 주기’, 혼자(미합류)면 같이 보기 버튼 없음', async ({
  page,
}) => {
  const db = await start(page, { joined: false });
  db.me.birth_year = null;
  await page.goto('/assets/rank');
  await expect(page.getByRole('button', { name: /출생연도 알려 주기/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /같이 순위 보기/ })).toHaveCount(0);
});

test('F-08c 받는 쪽(예빈 요청) ‘좋아요’ → (가) 첫 결과는 광고 없이, 전체 가구 기준, 홈 배지 기본 끔', async ({
  page,
}) => {
  const db = await start(page, { ad: 'rewarded' });
  db.rank = {
    pair: false,
    topPct: 62,
    views: [],
    requests: [
      {
        id: 'rq-1',
        space_id: 'space-1',
        from_user: YEBIN,
        status: 'open',
        created_at: '2026-10-06T01:00:00Z',
        expires_at: '2026-10-13T01:00:00Z',
        answered_at: null,
      },
    ],
  };
  await page.goto('/assets/rank/consent/rq-1');
  await expect(
    page.getByRole('heading', { name: '예빈님이 자산 순위를 같이 보자고 해요' }),
  ).toBeVisible();
  await expect(page.getByText('숨긴 자산은 빼고 합쳐요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '좋아요', exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  await expect(page.getByText('상위 62%예요')).toBeVisible();
  await expect(page.getByText('전체 가구 가운데')).toBeVisible();
  await expect(page.getByText(/둘의 자산을 합쳐 비교했어요/)).toBeVisible();
  await expect(page.getByText(/전체 가구 기준이에요/)).toBeVisible();
  await expect(page.getByText(/30대 가구/)).toHaveCount(0); // 연령대 분포가 아직 없어 연령대라고 하지 않음
  expect(db.rank?.views).toEqual([{ paid_by_ad: false }]);
  expect((await fb(page)).ads).toBe(0);
  // 홈에 보여 주기: 기본 끔 → 켜면 저장
  const sw = page.getByRole('switch', { name: '홈에 보여 주기' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await axe(page);
  await sw.click();
  await expect.poll(() => db.me.rank_badge_home).toBe(true);
});

const pairSeen = (db: MemDb, pct = 41) => {
  db.rank = { pair: true, topPct: 38, views: [{ paid_by_ad: false }], requests: [] };
  // 지난달에 본 결과(순자산도 그 뒤 바뀜) → 지난번 값 + ‘새로 확인하기’(광고)
  Object.assign(db.me, { rank_month: '2026-09-01', rank_pct: pct, rank_net: 1 });
};

test('새로 확인하기: 광고를 끝까지 보면 기록(paid_by_ad) 후 새 결과', async ({ page }) => {
  const db = await start(page, { ad: 'rewarded' });
  pairSeen(db);
  await page.goto('/assets');
  const stale = page.getByRole('button', { name: /지난번엔 상위 41%였어요/ });
  await expect(stale).toContainText('광고');
  await expect(stale).toContainText('새로 확인하기');
  await stale.click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  await expect(page.getByText('상위 38%예요')).toBeVisible();
  expect((await fb(page)).ads).toBe(1);
  expect(db.rank?.views.at(-1)).toEqual({ paid_by_ad: true });
});

test('새로 확인하기: 광고를 닫으면 Toast, 순위를 열지 않음', async ({ page }) => {
  const db = await start(page, { ad: 'closed' });
  pairSeen(db);
  await page.goto('/assets');
  await page.getByRole('button', { name: /지난번엔 상위 41%였어요/ }).click();
  await expect(page.getByText('광고를 끝까지 보면 볼 수 있어요')).toBeVisible();
  await expect(page).toHaveURL(/\/assets$/);
  expect(db.rank?.views).toHaveLength(1);
});

for (const ad of ['failed', 'throw'] as const)
  test(`새로 확인하기: 광고를 못 불러오면(${ad}) 광고 없이 바로 결과(기록 없음)`, async ({
    page,
  }) => {
    const db = await start(page, { ad });
    pairSeen(db);
    await page.goto('/assets');
    await page.getByRole('button', { name: /지난번엔 상위 41%였어요/ }).click();
    await expect(page).toHaveURL(/\/assets\/rank$/);
    await expect(page.getByText('상위 38%예요')).toBeVisible();
    expect(db.rank?.views).toHaveLength(1);
  });

test('새로 확인하기: 브리지가 없으면(개발 브라우저) 광고 없이 바로 결과', async ({ page }) => {
  const db = await start(page);
  pairSeen(db);
  await page.goto('/assets/rank');
  // F-08에서도 지난 결과 + ‘새로 확인하기’(광고)
  await expect(page.getByText('상위 41%예요')).toBeVisible();
  const refresh = page.getByRole('button', { name: /9월에 본 결과예요/ });
  await expect(refresh).toContainText('광고');
  await axe(page);
  await refresh.click();
  await expect(page.getByText('상위 38%예요')).toBeVisible();
  expect(db.rank?.views).toHaveLength(1);
});

test('홈 H-04 배지: (가)라도 ‘홈에 보여 주기’를 켜야 “상위 n%”', async ({ page }) => {
  const db = await start(page);
  db.rank = { pair: true, topPct: 38, views: [{ paid_by_ad: false }], requests: [] };
  Object.assign(db.me, { rank_month: '2026-10-01', rank_pct: 38, rank_net: 12_000_000 });
  await page.goto('/');
  await expect(page.locator('.hg-hubtile__badge')).toHaveCount(0);
  db.me.rank_badge_home = true;
  await page.reload();
  await expect(page.locator('.hg-hubtile__badge')).toHaveText('상위 38%');
});
