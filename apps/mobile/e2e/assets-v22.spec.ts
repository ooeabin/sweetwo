import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fakeBridge, fb } from './fake-bridge';
import { type MemDb, mockOnboarding, YEBIN } from './mocks';
import { fillAmount, pickAssetKind } from './form';

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
  await expect(nw).toContainText('12,000,000원');
  await expect(nw).toContainText('지난달보다 1,000,000원 늘었어요');
  await expect(page.getByText('예상 순자산')).toHaveCount(0);
  await axe(page);
  await page.getByRole('switch', { name: /원금으로 보기/ }).click();
  // 원금: 300 + 800 − 100 = 1,000만, 지난달(원금 900만)보다 100만
  await expect(nw).toContainText('10,000,000원');
});

test('F-01·F-02·홈 H-04: 내 ‘숨기기’ 항목은 파트너에게만 안 보이고 내 합계에는 더함(H3)', async ({
  page,
}) => {
  const db = await start(page);
  const me = String(db.me.id);
  db.assets.push(
    row({
      id: 'a5',
      side: 'asset',
      grp: 'cash',
      kind: 'bank',
      name: '비상금 통장',
      amount: 5_000_000,
      visibility: 'private',
      owner_user_id: me,
      created_by: me,
    }),
  );
  await page.goto('/assets');
  // 300 + 1,000 + 숨김 500 − 100 = 1,700만
  const nw = page.getByRole('region', { name: '순자산', exact: true });
  await expect(nw).toContainText('17,000,000원');
  await expect(page.getByRole('button', { name: /자산 18,000,000원/ })).toBeVisible();
  await page.goto('/assets/items?side=asset');
  // 숨김 알약은 그대로, 묶음 머리 합계(현금·예적금)에 숨김 500만도 더함
  await expect(page.getByText('숨김', { exact: true })).toBeVisible();
  await expect(page.getByText('8,000,000원').first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('17,000,000원').first()).toBeVisible();
});

test('F-03q 빠르게 적기 + F-03e 처음 공개 선택: 미리 고른 값 없음, 빈 칸은 저장 안 함, 고른 값이 기본값', async ({
  page,
}) => {
  const db = await start(page, { withAssets: false });
  await page.goto('/assets');
  await page.getByRole('button', { name: /큰 항목만 빠르게 적기/ }).click();
  await expect(page).toHaveURL(/\/assets\/quick$/);
  await expect(page.getByRole('heading', { name: '큰 항목만 빠르게 적어 볼까요?' })).toBeVisible();
  const next = page.getByRole('button', { name: '다음', exact: true });
  await expect(next).toBeDisabled();
  // 적금을 어디에 넣는지 + 저금과 두 번 세지 않음(실구동)
  await expect(page.getByText('적금 통장도 여기에 적어요')).toBeVisible();
  await expect(
    page.getByText(
      '모은 금액은 자산에 적은 통장이나 투자에 이미 들어 있어서 순자산에 따로 더하지 않아요',
    ),
  ).toBeVisible();
  await page.getByLabel('현금·예적금').fill('5000000');
  await page.getByLabel('대출').fill('20000000');
  await axe(page);
  await next.click();
  // F-03e: 질문 + 세 선택지, 아무것도 고르지 않은 채
  await expect(page.getByRole('heading', { name: '파트너에게 어떻게 보여 줄까요?' })).toBeVisible();
  await expect(page.getByText('항목은 안 보이고 총액에만 더해요')).toBeVisible();
  await expect(page.getByText('파트너에게는 총액에도 안 더해요')).toBeVisible();
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
  await pickAssetKind(page, '현금성', '입출금 통장');
  await fillAmount(page, '지금 금액', 1_000_000);
  await page.getByRole('radio', { name: /^나/ }).click();
  // 이미 고른 기본값은 접힌 줄에 그 이름으로(2026-11-24 한 화면)
  await expect(page.getByRole('button', { name: /파트너에게 보이기.*숨기기/ })).toBeVisible();
  await page.getByRole('button', { name: /파트너에게 보이기/ }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('radio', { name: /숨기기/ })).toHaveAttribute('aria-checked', 'true');
  await expect(dlg.getByRole('radio', { name: /총액만 보여 주기/ })).toBeVisible();
});

test('F-03e 연결할 때(2026-11-16 B5): 숨겨 둔 내 자산이 있으면 홈 띠 → 한 번 고르기 → 고른 값으로', async ({
  page,
}) => {
  const db = await start(page);
  db.me.asset_share_default = null;
  const a2 = db.assets.find((a) => a.id === 'a2');
  Object.assign(a2 ?? {}, { visibility: 'private', share_pending: true });
  await page.goto('/');
  await page.getByText('혼자 쓸 때 적은 자산을 예빈님에게 어떻게 보여 줄까요?').click();
  await expect(page).toHaveURL(/\/assets\/share$/);
  await expect(page.getByRole('heading', { name: '파트너에게 어떻게 보여 줄까요?' })).toBeVisible();
  await expect(page.getByText('혼자 쓸 때 적은 자산은 고르기 전까지 숨겨 뒀어요')).toBeVisible();
  // 미리 고른 값 없음
  const save = page.getByRole('button', { name: '저장하기' });
  await expect(save).toBeDisabled();
  await axe(page);
  await page.getByRole('radio', { name: /총액만 보여 주기/ }).click();
  await save.click();
  await expect(page.getByText('자산 공개를 정했어요')).toBeVisible();
  expect(a2).toMatchObject({ visibility: 'sum', share_pending: false });
  expect(db.me.asset_share_default).toBe('sum');
  await expect(page.getByText('혼자 쓸 때 적은 자산을')).toHaveCount(0);
});

test('F-08 (나) 순위 없음: 또래 가구 중간값 한 줄(광고 없음) → F-08c 같이 보자고 하기', async ({
  page,
}) => {
  const db = await start(page);
  await page.goto('/assets');
  const banner = page.getByRole('button', { name: /또래 가구 중간값 보기/ });
  await expect(banner).toBeVisible();
  await expect(banner).not.toContainText('광고');
  // 2026-11-24 원 그래픽(“중간”)을 없앰, › 는 같은 줄 오른쪽 끝
  await expect(banner).toHaveText('또래 가구 중간값 보기');
  await expect(banner.locator('.hg-rankrow__badge')).toHaveCount(0);
  await expect(banner.locator('.hg-chevron')).toBeVisible();
  await banner.click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  // 1993년생 → 30대 중간값
  await expect(page.getByText('또래 가구 중간값은 155,850,000원이에요')).toBeVisible();
  await expect(page.getByText(/상위 \d+%/)).toHaveCount(0);
  await axe(page);
  // 2026-11-24 ‘같이 순위 보기’는 아래 고정 주 버튼
  await expect(
    page.locator('.hg-stickybar').getByRole('button', { name: '예빈님과 같이 순위 보기' }),
  ).toBeVisible();
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
  // 2026-11-24 그래프 아래 작은 글은 한 줄 + ‘자세히’ 시트로
  await expect(page.getByText(/둘의 자산을 합쳐 비교했어요/)).toHaveCount(0);
  await page.getByRole('button', { name: '자세히' }).click();
  await expect(page.getByText(/둘의 자산을 합쳐 비교했어요/)).toBeVisible();
  await expect(page.getByText(/전체 가구 기준이에요/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  await expect(page.getByText('광고를 끝까지 보면 새 순위를 보여 드려요')).toBeVisible();
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
  // 2026-11-24 지난 결과를 볼 때는 지난달 대비 문장을 숨김
  await expect(page.getByText(/월보다 .*%p/)).toHaveCount(0);
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

// ---- 첫 자산 적기 동기(2026-11-18, 19 H-04, 23 F-02 빈 상태): 궁금함, 파트너 소식, 쉬운 첫 입력 ----

const heading = (page: Page, name: string) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const tile = (page: Page) => page.getByRole('button', { name: /^자산 관리/ });
const SHOTS = process.env.ASSET_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

test('H-04 빈 타일(둘): “아직 적은 자산이 없어요” → F-02 종류 칩 → 금액만 → 저장 → 순자산 + 순위 링크(한 번만)', async ({
  page,
}) => {
  const db = await start(page, { withAssets: false });
  db.me.asset_share_default = 'sum';
  await page.goto('/');
  await expect(tile(page)).toContainText('아직 적은 자산이 없어요');
  await expect(tile(page)).not.toContainText('+ 자산 추가');
  await expect(tile(page)).not.toContainText('원');
  await expect(tile(page)).toHaveClass(/hg-hubtile--point/);
  await shot(page, '1-home-empty-tile');
  await axe(page);
  await tile(page).click();
  await expect(page).toHaveURL(/\/assets\/items$/);
  await expect(page.getByText('예빈님이 자산을 적었어요')).toHaveCount(0);
  const chips = page.getByRole('group', {
    name: '아직 적은 자산이 없어요',
  });
  await expect(chips.getByRole('button')).toHaveText([
    '통장',
    '적금·예금',
    '주식·펀드',
    '전세 보증금',
    '자동차',
    '직접 고르기',
  ]);
  // 칩 위 안내는 한 줄, 예전 빈 상태(문구 + 자산 추가하기)는 칩과 같은 일이라 안 그림
  await expect(page.locator('.hg-empty')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '자산 추가하기' })).toHaveCount(0);
  await expect(page.getByText('부채가 없어요')).toHaveCount(0);
  await shot(page, '5-f02-asset-tab');
  await page.getByRole('tab', { name: '부채', exact: true }).click();
  const debtChips = page.getByRole('group', {
    name: '아직 적은 부채가 없어요',
  });
  await expect(debtChips.getByRole('button')).toHaveText([
    '신용대출',
    '주택담보대출',
    '전세 대출',
    '학자금 대출',
    '카드 할부',
    '직접 고르기',
  ]);
  await expect(page.getByRole('button', { name: '+ 부채 추가' })).toHaveCount(0);
  await shot(page, '6-f02-debt-tab');
  await page.getByRole('tab', { name: '자산', exact: true }).click();
  await expect(chips).toBeVisible();
  await shot(page, '2-f02-empty-chips');
  await axe(page);
  await chips.getByRole('button', { name: '통장' }).click();
  await expect(page).toHaveURL(/\/assets\/new\?chip=/);
  await heading(page, '자산 추가');
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('통장');
  await expect(page.getByRole('button', { name: '추가하기', exact: true })).toBeDisabled();
  await fillAmount(page, '지금 금액', 23_000_000);
  await page.getByRole('button', { name: '추가하기', exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=asset$/);
  const nw = page.getByRole('region', { name: '순자산', exact: true });
  await expect(nw).toContainText('23,000,000원');
  const rank = page.getByRole('button', { name: '또래 중 어디쯤인지 보기' });
  await expect(rank).toBeVisible();
  await expect(page.getByRole('group', { name: '아직 적은 자산이 없어요' })).toHaveCount(0);
  await shot(page, '3-f02-after-first');
  await axe(page);
  const saved = db.assets.filter((a) => !a.deleted_at);
  expect(saved.map((a) => [a.name, a.grp, a.kind, a.side, a.amount, a.visibility])).toEqual([
    ['통장', 'cash', 'bank', 'asset', 23_000_000, 'sum'],
  ]);
  expect(saved[0]?.owner_user_id).toBe(db.me.id);
  // 새로 고치면 첫 강조는 없고 F-02 기존 모양
  await page.reload();
  await expect(page.getByRole('button', { name: '또래 중 어디쯤인지 보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^통장/ })).toBeVisible();
});

test('첫 자산 직후 링크는 F-08 자산 순위로 간다', async ({ page }) => {
  const db = await start(page, { withAssets: false });
  db.me.asset_share_default = 'sum';
  await page.goto('/assets/items');
  await page.getByRole('button', { name: '자동차' }).click();
  await fillAmount(page, '지금 금액', 8_000_000);
  await page.getByRole('button', { name: '추가하기', exact: true }).click();
  await page.getByRole('button', { name: '또래 중 어디쯤인지 보기' }).click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  expect(db.assets.map((a) => [a.name, a.grp, a.kind])).toEqual([['자동차', 'etc', 'car']]);
});

test('쉬운 첫 입력: 처음 적는 사람은 금액 뒤 F-03e를 한 번(미리 고른 값 없음), 대출 칩은 부채로 저장', async ({
  page,
}) => {
  const db = await start(page, { withAssets: false });
  await page.goto('/assets/items?side=debt');
  await page.getByRole('button', { name: '신용대출' }).click();
  await heading(page, '부채 추가');
  await fillAmount(page, '남은 금액', 5_000_000);
  // 처음 적는 사람은 공개 범위를 한 번 직접 고름(미리 고른 값 없음)
  await expect(
    page.getByRole('radiogroup', { name: '파트너에게 어떻게 보여 줄까요?' }),
  ).toBeVisible();
  const save = page.getByRole('button', { name: '추가하기', exact: true });
  await expect(save).toBeDisabled();
  await page.getByRole('radio', { name: /총액만 보여 주기/ }).click();
  await save.click();
  await expect(page).toHaveURL(/\/assets\/items\?side=debt$/);
  await expect(page.getByText('순자산', { exact: true })).toHaveCount(0);
  expect(db.me.asset_share_default).toBe('sum');
  expect(db.assets.map((a) => [a.name, a.side, a.grp, a.amount, a.visibility])).toEqual([
    ['신용대출', 'debt', 'credit', 5_000_000, 'sum'],
  ]);
});

test('F-01 묶음 타일은 그 묶음을 고른 채로 추가 화면을 엶(?grp=)', async ({ page }) => {
  await start(page, { withAssets: false });
  await page.goto('/assets/new?side=asset&grp=deposit');
  await heading(page, '자산 추가');
  await expect(page.getByRole('button', { name: '예금·적금', pressed: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '예금·적금', exact: true })).toBeVisible();
  // 자산·부채 탭을 바꾸면 종류 고름이 비워짐
  await page.getByRole('tab', { name: '부채', exact: true }).click();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '추가하기', exact: true })).toBeDisabled();
});

test('직접 고르기 칩은 전체 추가 흐름(종류 고르기부터)을 연다', async ({ page }) => {
  await start(page, { withAssets: false });
  await page.goto('/assets/items');
  await page.getByRole('button', { name: '직접 고르기' }).click();
  await expect(page).toHaveURL(/\/assets\/new/);
  await expect(page).not.toHaveURL(/chip=/);
});

test('H-04 파트너 소식: 내 자산 0개 + 예빈님이 적음(모두 / 총액만) → 이름만 알림(금액 없음), F-02 맨 위 한 줄, 우선순위는 궁금함보다 위', async ({
  page,
}) => {
  const db = await start(page, { withAssets: false });
  db.assets.push(
    row({
      id: 'p1',
      side: 'asset',
      grp: 'cash',
      kind: 'bank',
      name: '예빈 통장',
      amount: 7_700_000,
      owner_user_id: YEBIN,
      created_by: YEBIN,
    }),
  );
  await page.goto('/');
  await expect(tile(page)).toContainText('예빈님이 자산을 적었어요');
  await expect(tile(page)).not.toContainText('우리 둘 순자산');
  await expect(tile(page)).not.toContainText('770만');
  await shot(page, '4-home-partner-wrote');
  await tile(page).click();
  await expect(page).toHaveURL(/\/assets\/items$/);
  await expect(
    page.getByText('예빈님이 자산을 적었어요. 내 것도 적으면 우리 둘 순자산이 보여요'),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: '아직 적은 자산이 없어요' })).toBeVisible();
  await axe(page);
  // ‘총액만’: 묶음 개수만 서버가 줌
  db.assets.length = 0;
  db.partnerSums.push({
    side: 'asset',
    grp: 'invest',
    n: 2,
    total: 4_400_000,
    principal_total: 4_000_000,
  });
  await page.goto('/');
  await expect(tile(page)).toContainText('예빈님이 자산을 적었어요');
  await expect(tile(page)).not.toContainText('440만');
});

test('H-04 파트너가 숨기기만 적었으면(서버가 아무것도 안 줌) 알리지 않음, 혼자 쓰기·미합류는 “내 순자산, …”', async ({
  page,
}) => {
  const db = await start(page, { withAssets: false });
  await page.goto('/');
  await expect(tile(page)).toContainText('아직 적은 자산이 없어요');
  await expect(tile(page)).not.toContainText('자산을 적었어요');
  db.space = { ...db.space, couple_state: 'solo' };
  db.partner = null;
  await page.goto('/');
  await expect(tile(page)).toContainText('아직 적은 자산이 없어요');
  await expect(tile(page)).not.toContainText('우리 둘');
});

test('H-04 내 자산이 생기면 지금처럼 순자산 금액', async ({ page }) => {
  await start(page);
  await page.goto('/');
  await expect(tile(page)).toContainText('12,000,000원');
  await expect(tile(page)).not.toContainText('어디쯤');
});

test('F-08 (가): 그래프 아래는 한 줄 + ‘자세히’ 시트(‘중간’ 설명, 합쳐 비교, 기준)', async ({
  page,
}) => {
  const db = await start(page);
  db.rank = { pair: true, topPct: 38, views: [{ paid_by_ad: false }], requests: [] };
  Object.assign(db.me, { rank_month: '2026-10-01', rank_pct: 38, rank_net: 12_000_000 });
  await page.goto('/assets/rank');
  await expect(page.getByText('2025년 가계금융복지조사 기준', { exact: true })).toBeVisible();
  await expect(page.getByText('‘중간’은 전체 가구를 줄 세웠을 때 한가운데예요')).toHaveCount(0);
  await page.getByRole('button', { name: '자세히' }).click();
  const sheet = page.getByRole('dialog', { name: '순위는 이렇게 봐요' });
  await expect(sheet).toContainText('‘중간’은 전체 가구를 줄 세웠을 때 한가운데예요');
  await expect(sheet).toContainText('둘의 자산을 합쳐 비교했어요');
  await expect(sheet).toContainText('전체 가구 기준이에요');
  await axe(page);
});

test('F-08 직접 열기: 자산이 하나도 없으면 순위 없이 “아직 적은 자산이 없어요” + 자산 적고 순위 보기', async ({
  page,
}) => {
  const db = await start(page, { withAssets: false });
  db.rank = { pair: true, topPct: 97, views: [], requests: [] };
  await page.goto('/assets/rank');
  await expect(page.getByText('아직 적은 자산이 없어요')).toBeVisible();
  await expect(page.getByText(/상위 \d+%/)).toHaveCount(0);
  expect(db.rpc).not.toContain('record_rank_view');
  await axe(page);
  await page.locator('.hg-stickybar').getByRole('button', { name: '자산 적고 순위 보기' }).click();
  await expect(page).toHaveURL(/\/assets\/new/);
});

test('F-08 다시 동의한 뒤(저장 순위 없음): 줄 글자는 F-01과 같은 “확인하기”', async ({ page }) => {
  const db = await start(page);
  db.rank = { pair: true, topPct: 38, views: [{ paid_by_ad: false }], requests: [] };
  Object.assign(db.me, { rank_month: null, rank_pct: null, rank_net: null });
  await page.goto('/assets/rank');
  const b = page.getByRole('button', { name: /아직 확인하지 않았어요/ });
  await expect(b).toContainText('확인하기');
  await expect(b).not.toContainText('새로 확인하기');
});
