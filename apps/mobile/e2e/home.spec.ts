import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { seed } from './seed-home';
import { chanwoo } from './supabase-mock';
import { mockRealtime } from './realtime-mock';
import { emptyV22 } from './v22-mock';
import { fakeBridge } from './fake-bridge';

// 홈 v2.2(19 ‘홈 v2.2’, ADR 0009): H-10 같이 모으기, H-11 이번 달 한 줄(날짜 없는 사람 H-13), H-06 할 일 띠 16순서,
// H-07 월급 계획 + 여유 자금, H-12 결혼 준비, H-04·H-09. 찬우 혼자(예빈 미합류), 각자, 실수령 350만, 월급날 25일.
// 9월 25일 월급 사이클 = 9월 25일 ~ 10월 24일, 월급 전 확인은 10월 22일부터.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
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

const together = (page: Page) => page.locator('.hg-together');
const monthLine = (page: Page) => page.locator('.hg-hubline');
const band = (page: Page) => page.locator('.hg-hubband');

async function open(page: Page, prep?: (db: MemDb) => void, now = NOW, url = '/') {
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.v22 = emptyV22();
  prep?.(db);
  await page.goto(url);
  return db;
}
const lines = (db: MemDb, i = 0) =>
  (db.checklists[i]?.pay_check_line ?? []) as Record<string, unknown>[];

test('H-10 같이 모으기 + H-11 월급날 + H-07 여유 자금(19 v2.2): 대표 저금은 목표 금액에 가까운 것, 저금 2개면 가로 넘김 + ‘저금 모두 보기’', async ({
  page,
}) => {
  const db = await open(page);
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  // 예전 큰 상자(H-03)·저금 상자(H-02)는 없음
  await expect(page.locator('.hg-hubhero, .hg-hubsave')).toHaveCount(0);
  const h = together(page);
  await expect(h.getByRole('heading', { name: '같이 모으기' })).toBeVisible();
  // 미합류면 내 Avatar 하나(빈 원 없음)
  const first = h.locator('.hg-together__slide').first();
  await expect(first.locator('.hg-avatar')).toHaveCount(1);
  await expect(first).toHaveAccessibleName(
    '같이 모으기, 내 집 마련, 0원, 목표 금액의 0%, 2031년 10월까지 1억 5,000만 원 더 필요해요',
  );
  await expect(first).toContainText('목표 금액 1억 5,000만 원의 0%');
  await expect(h.locator('.hg-together__slide')).toHaveCount(2);
  await expect(h.getByRole('button', { name: '저금 모두 보기' })).toBeVisible();
  await expect(h.getByRole('button', { name: '돈 들어왔어요' })).toBeVisible();
  // H-11: 손 줄 5개가 남음
  await expect(monthLine(page)).toContainText('월급날이에요. 확인할 게 5개 있어요');
  await expect(monthLine(page)).toContainText('확인하기');
  // H-06: 저금이 있어 첫 저금 띠는 없고, 미합류라 초대(15번)
  await expect(band(page)).toContainText('같이 모을 사람을 초대해 보세요');
  await expect(band(page)).toContainText('초대하기');
  // H-07 포인트 상자: 매달 25일 + 여유 자금(350만 − 350만)
  const plan = page.getByRole('button', { name: /^월급 계획/ });
  await expect(plan).toContainText('매달 25일');
  await expect(plan).toContainText('여유 자금 0원');
  // 결혼했어요라 H-12 없음
  await expect(page.getByText(/결혼 준비 메모/)).toHaveCount(0);
  await axe(page);

  // H-11 → W-02 “모두 계획대로 됐어요” 한 번(confirm_payday)
  await monthLine(page).click();
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '확인할 것 5개' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '모두 계획대로 됐어요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('9월 25일 월급, 계획대로 됐어요');
  expect(lines(db).every((l) => l.state === 'checked')).toBe(true);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await page.goto('/');
  await expect(monthLine(page)).toContainText('9월 25일 월급, 계획대로 됐어요');
  await expect(monthLine(page)).toContainText('다음 월급날까지 18일');
  // 체크한 저금 줄이 모은 금액과 ‘이번 달 +’에
  await expect(first).toContainText('95만 원');
  await expect(first).toContainText('이번 달 +95만 원');
});

test('홈 상자 → 화면: 같이 모으기 W-10, 돈 들어왔어요 W-20, 저금 모두 보기 W-13, 월급 계획 W-01, 캘린더, 자산 관리, 저금', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  for (const [click, url] of [
    [
      () => together(page).locator('.hg-together__slide').first().click(),
      /\/salary\/items\/goal-h$/,
    ],
    [() => page.getByRole('button', { name: '돈 들어왔어요' }).click(), /\/salary\/money-in$/],
    [
      () => page.getByRole('button', { name: '저금 모두 보기' }).click(),
      /\/salary\/items\?from=home$/,
    ],
    [() => page.getByRole('button', { name: /^월급 계획/ }).click(), /\/salary\?view=plan$/],
    [() => page.getByRole('button', { name: /^캘린더/ }).click(), /\/calendar\/list$/],
    [() => page.getByRole('button', { name: /^자산 관리/ }).click(), /\/assets$/],
    [
      () => page.getByRole('button', { name: /^저금 (\d|아직)/ }).click(),
      /\/salary\/items\?from=home$/,
    ],
  ] as const) {
    await page.goto('/');
    await expect(together(page)).toBeVisible();
    await click();
    await expect(page).toHaveURL(url);
  }
  // 키보드만으로: H-11에 포커스(ink 링) → Enter
  await page.goto('/');
  await monthLine(page).focus();
  expect(await monthLine(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/salary$/);
});

test('빈 상태(미합류·저금 0, 결혼 준비 중): “무엇을 같이 모을까요?” + 이름 칩 → W-11a 이름 채움, D-day 알약, 첫 저금 띠, H-12 결혼 준비', async ({
  page,
}) => {
  await open(page, (db) => {
    db.goals.splice(0);
    const sp = db.splits[0];
    if (sp) sp.split_line = sp.split_line.filter((l) => l.kind !== 'saving');
    const c = db.checklists[0];
    if (c)
      c.pay_check_line = (c.pay_check_line as Record<string, unknown>[]).filter(
        (l) => l.kind !== 'saving',
      );
    Object.assign(db.space ?? {}, { marriage_status: 'engaged', wedding_date: '2027-03-01' });
  });
  const h = together(page);
  await expect(h).toContainText('무엇을 같이 모을까요?');
  for (const c of ['결혼 비용', '신혼여행', '비상금'])
    await expect(h.getByRole('button', { name: c })).toBeVisible();
  // 결혼식 D-145(10월 7일 → 3월 1일)
  await expect(h.locator('.hg-hubtile__badge')).toHaveText('결혼식 D-145');
  // 띠 7번: 저금 0개 + 첫 30일
  await expect(band(page)).toContainText('무엇을 같이 모을지 정해 볼까요?');
  // H-12: 메모가 없으면 “+ 쓸 곳 메모 적기”
  await expect(page.getByRole('button', { name: /결혼 준비 메모 0개/ })).toContainText(
    '+ 쓸 곳 메모 적기',
  );
  // 저금 타일 “아직 없어요”
  await expect(page.getByRole('button', { name: /^저금 (\d|아직)/ })).toContainText('아직 없어요');
  await axe(page);
  await h.getByRole('button', { name: '결혼 비용' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new\/a\?from=home$/);
  await expect(page.getByRole('textbox').first()).toHaveValue('결혼 비용');
});

test('첫 월급날 전(소급 없음): H-11 “10월 25일 첫 월급날에 확인해요”, 7일 전 띠 9번 → W-01d 자동 줄 고르기 → 띠 사라짐', async ({
  page,
}) => {
  const PRE = new Date('2026-10-20T10:00:00+09:00');
  const db = await open(
    page,
    (d) => {
      d.checklists.length = 0;
      if (d.v22) d.v22.noRetro = true;
      Object.assign(d.splits[0] ?? {}, { checklist_from: '2026-10-15' });
      Object.assign(d.me, { onboarding_done_at: '2026-10-15T00:00:00Z' });
    },
    PRE,
  );
  await expect(monthLine(page)).toContainText('10월 25일 첫 월급날에 확인해요');
  await expect(band(page)).toContainText('자동으로 나가는 걸 골라 주세요');
  await axe(page);
  // W-02도 같은 문장(첫 확인 목록 전)
  await page.goto('/salary');
  await expect(page.getByText('10월 25일 첫 월급날에 확인해요')).toBeVisible();
  await page.goto('/');
  await band(page).click();
  await expect(page).toHaveURL(/\/salary\/auto-lines$/);
  const sheet = page.getByRole('dialog', { name: '자동으로 나가는 걸 골라 주세요' });
  await expect(sheet).toBeVisible();
  // 저금·고정지출 줄만(생활비·용돈은 없음)
  await expect(sheet.getByRole('checkbox')).toHaveCount(3);
  await sheet.getByRole('checkbox', { name: /^내 집 마련/ }).click();
  await sheet.getByRole('button', { name: '다음 날' }).click();
  await axe(page);
  await sheet.getByRole('button', { name: '저장하기' }).click();
  await expect(page).toHaveURL(/\/salary\?view=plan$/);
  expect(db.v22?.calls.find((c) => c.fn === 'split_lines_configure')?.body).toEqual({
    p_items: [{ id: 'split-1-line-1', auto_pay: true, auto_day: 26 }],
  });
  expect(db.v22?.tasks).toContain('auto_pick');
  // 영수증 줄 알약 “자동 26일”
  await expect(page.locator('.hg-receipt__row', { hasText: '내 집 마련' })).toContainText(
    '자동 26일',
  );
  await page.goto('/');
  await expect(band(page)).not.toContainText('자동으로 나가는 걸 골라 주세요');
});

test('자동 줄뿐인 사람: H-11 “이번 달은 자동으로 나가는 것뿐이에요” + 다음 나가는 날, W-02 주 버튼 없음, 자동 줄 건너뛰기', async ({
  page,
}) => {
  const db = await open(page, (d) => {
    for (const l of lines(d)) {
      const goalH = l.goal_id === 'goal-h';
      Object.assign(l, {
        auto: true,
        auto_due: goalH ? '2026-10-10' : '2026-09-25',
        state: goalH ? 'wait' : 'checked',
        checked_by: null,
        checked_at: goalH ? null : '2026-09-24T15:05:00Z',
      });
    }
  });
  await expect(monthLine(page)).toContainText('이번 달은 자동으로 나가는 것뿐이에요');
  await expect(monthLine(page)).toContainText('10일에 1개');
  await axe(page);
  await monthLine(page).click();
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  const fold = page.getByRole('button', { name: '자동으로 나가는 것 5개' });
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await fold.click();
  await expect(page.getByText('안 나갔으면 눌러서 바꿔요')).toBeVisible();
  await expect(page.locator('.hg-transfer', { hasText: '내 집 마련' })).toContainText('10일 자동');
  await expect(page.locator('.hg-transfer', { hasText: '고정지출' })).toContainText('자동 확인');
  await axe(page);
  // 자동 확인된 줄도 시트에서 건너뜀
  await page.getByRole('button', { name: /^고정지출/ }).click();
  await page.getByRole('button', { name: '이번 달은 건너뛸게요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('고정지출, 이번 달은 건너뛰었어요');
  expect(lines(db).find((l) => l.kind === 'fixed')?.state).toBe('skipped');
});

test('지난 달 늦은 확인: H-11 아래 “지난 달 2개 늦게 확인할 수 있어요”, W-02 지난 달에서 “모두 계획대로 됐어요”(직접 건너뛴 줄은 빼고)', async ({
  page,
}) => {
  const LATE = new Date('2026-10-28T10:00:00+09:00');
  const db = await open(
    page,
    (d) => {
      const prev = d.checklists[0] as Record<string, unknown>;
      // 지난 사이클(9월 25일): 닫을 때 서버가 건너뜀으로 바꾼 손 줄 2개(checked_by 없음) + 사람이 직접 건너뛴 줄 1개
      Object.assign(prev, { state: 'closed' });
      lines(d).forEach((l, i) =>
        Object.assign(
          l,
          i < 2
            ? { state: 'checked', checked_by: chanwoo.id, checked_at: '2026-09-26T01:00:00Z' }
            : i === 2
              ? { state: 'skipped', checked_by: chanwoo.id, checked_at: '2026-10-01T01:00:00Z' }
              : { state: 'skipped', checked_by: null },
        ),
      );
      // 이번 사이클(10월 25일)
      d.checklists.push({
        ...prev,
        id: 'checklist-2',
        label: '10월 월급',
        cycle_start: '2026-10-25',
        cycle_end: '2026-11-24',
        state: 'open',
        pay_check_line: lines(d).map((l) => ({
          ...l,
          id: `${String(l.id)}-2`,
          state: 'wait',
          checked_by: null,
          checked_at: null,
        })),
      });
    },
    LATE,
  );
  await expect(monthLine(page)).toContainText('월급날이에요. 확인할 게 5개 있어요');
  await expect(monthLine(page)).toContainText('지난 달 2개 늦게 확인할 수 있어요');
  await page.goto('/salary?cycle=last');
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  await expect(page.getByText('다음 월급날 전까지 늦게 확인할 수 있어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '모두 계획대로 됐어요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('9월 25일 월급, 확인을 마쳤어요');
  expect(db.v22?.calls.find((c) => c.fn === 'confirm_payday')?.body).toEqual({
    p_checklist: 'checklist-1',
  });
  const prev = lines(db, 0);
  expect(prev.slice(3).every((l) => l.state === 'checked' && l.late)).toBe(true);
  // 직접 건너뛴 줄은 그대로
  expect(prev[2]?.state).toBe('skipped');
});

test('날짜 없는 사람(H-13): 16일째부터 기간 막대(중립 색, 판정 문장 없음), H-07 “돈이 들어올 때”, W-02 자리도 같은 한 줄', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.me, { payday: null, payday_none: true });
    d.checklists.length = 0;
    if (d.v22)
      d.v22.period = {
        status: 'bar',
        start: '2026-09-20',
        end: '2026-10-19',
        day: 18,
        received: 3_400_000,
        needed: 3_500_000,
        gap_days: null,
      };
  });
  const line = monthLine(page);
  await expect(line).toContainText('들어온 돈 340만 원 / 필요한 돈 350만 원');
  await expect(line).toContainText('9월 20일부터');
  await expect(line).not.toContainText('모자라');
  await expect(line).toHaveAccessibleName(
    '이번 기간 들어온 돈 340만 원, 필요한 돈 350만 원, 9월 20일부터',
  );
  // 막대는 오렌지가 아닌 ink-2
  const fill = await page
    .locator('.hg-periodbar__bar > i')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const ink2 = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ink-2').trim(),
  );
  expect(fill).not.toBe('');
  expect(ink2).not.toBe('');
  await expect(page.getByRole('button', { name: /^월급 계획/ })).toContainText('돈이 들어올 때');
  await axe(page);
  await line.click();
  await expect(page).toHaveURL(/\/salary\/money-in$/);
  await page.goto('/salary');
  await expect(page.locator('.hg-periodbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: /\d+일 월급$/ })).toHaveCount(0);
});

test('날짜 없는 사람: 첫 돈 전 “돈이 들어오면 알려 주세요”, 빈 날 “지난번 돈이 들어온 지 41일 됐어요”', async ({
  page,
}) => {
  const db = await open(page, (d) => {
    Object.assign(d.me, { payday: null, payday_none: true });
    d.checklists.length = 0;
  });
  await expect(monthLine(page)).toContainText('돈이 들어오면 알려 주세요');
  await expect(monthLine(page)).toContainText('돈 들어왔어요');
  if (db.v22)
    db.v22.period = {
      status: 'gap',
      start: '2026-07-28',
      end: '2026-08-26',
      day: null,
      received: 0,
      needed: 3_500_000,
      gap_days: 41,
    };
  await page.reload();
  await expect(monthLine(page)).toContainText('지난번 돈이 들어온 지 41일 됐어요');
});

test('W-05 월급 전 확인(v2.2): 남은 손 줄만(자동 줄 없음), 제목 “9월 25일 월급, 확인할 게 남았어요”, ‘이번 달은 건너뛸게요’', async ({
  page,
}) => {
  const REVIEW = new Date('2026-10-22T10:00:00+09:00');
  const db = await open(
    page,
    (d) => {
      for (const l of lines(d))
        if (l.kind === 'fixed') Object.assign(l, { auto: true, auto_due: '2026-09-25' });
    },
    REVIEW,
  );
  await expect(monthLine(page)).toContainText('9월 25일 월급에서 확인할 게 4개 남았어요');
  await monthLine(page).click();
  await expect(page).toHaveURL(/\/salary\/review\?checklist=checklist-1$/);
  await expect(
    page.getByRole('heading', { name: '9월 25일 월급, 확인할 게 남았어요' }),
  ).toBeVisible();
  await expect(page.locator('.hg-transfer', { hasText: '고정지출' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: /^청약/ }).click();
  await page.getByRole('button', { name: '이번 달은 건너뛸게요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('청약, 이번 달은 건너뛰었어요');
  await expect.poll(() => lines(db).find((l) => l.goal_id === 'goal-e')?.state).toBe('skipped');
});

test('띠 8번 생활비 나누기(각자 + 생활비 ‘네’): 글자 버튼 둘, ‘이미 정했어요’ → 다시 안 뜸(home_task_state)', async ({
  page,
}) => {
  const db = await open(page, (d) => {
    Object.assign(d.space ?? {}, {
      couple_state: 'connected',
      partner_nickname: '예빈',
      shared_living: true,
    });
    d.partner = PARTNER;
  });
  const b = band(page);
  await expect(b).toContainText('같이 쓰는 생활비를 나눠 볼까요?');
  await expect(b).toHaveClass(/hg-hubband--two/);
  await expect(b.getByRole('button')).toHaveCount(2);
  await axe(page);
  await b.getByRole('button', { name: '이미 정했어요' }).click();
  await expect(band(page)).toHaveCount(0);
  expect(db.v22?.tasks).toContain('split_suggest');
  await page.reload();
  await expect(together(page)).toBeVisible();
  await expect(band(page)).toHaveCount(0);
});

test('각자 계열 묶음(찬우·예빈): 묶음이 맨 앞, 합계 + 둘 다 켰을 때만 각자 금액, 퍼센트만이면 % 하나', async ({
  page,
}) => {
  const bundle = {
    id: 'b1',
    name: '결혼 비용',
    status: 'active',
    deadline: '2027-05-01',
    paused: false,
    percent_only: false,
    show_each: true,
    my_show_each: true,
    my_percent_only: false,
    pct: 62,
    total: 31_000_000,
    target: 50_000_000,
    mine: 21_000_000,
    partner: 10_000_000,
    goals: [
      { id: 'goal-h', mine: true, name: '내 집 마련' },
      { id: 'goal-y', mine: false, name: '결혼 비용' },
    ],
  };
  const db = await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    d.partner = PARTNER;
    Object.assign(d.goals.find((g) => g.id === 'goal-h') ?? {}, { bundle_id: 'b1' });
    if (d.v22) d.v22.bundles.push(bundle);
  });
  const first = together(page).locator('.hg-together__slide').first();
  await expect(first.locator('.hg-avatar')).toHaveCount(2);
  await expect(first).toHaveAccessibleName(
    '같이 모으기, 결혼 비용, 3,100만 원, 목표 금액의 62%, 2027년 5월까지 1,900만 원 더 필요해요',
  );
  await expect(first).toContainText('찬우 2,100만 원, 예빈 1,000만 원');
  await axe(page);
  // 퍼센트만(G1)
  Object.assign(db.v22?.bundles[0] ?? {}, {
    percent_only: true,
    show_each: false,
    total: null,
    target: null,
    mine: null,
    partner: null,
  });
  await page.reload();
  await expect(first.locator('.hg-together__amount')).toHaveText('62%');
  await expect(first).toContainText('2027년 5월까지');
  await expect(first).not.toContainText('만 원');
});

test('한 사람 관리형 관리하지 않는 쪽: H-11 “이번 달 보내기와 용돈은 자동이에요”, W-01 보내기 줄은 자물쇠 + “월급 − 용돈”', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.space ?? {}, {
      couple_state: 'connected',
      partner_nickname: '예빈',
      salary_mode: 'joint',
      joint_cycle_day: 25,
      manager_user_id: 'yebin',
    });
    d.partner = PARTNER;
    for (const sp of d.splits) {
      sp.owner_user_id = null;
      sp.split_line.push({
        id: 'split-1-send',
        split_id: sp.id,
        kind: 'send',
        goal_id: null,
        user_id: chanwoo.id,
        name: null,
        amount: 3_150_000,
        sort: 9,
        auto_pay: true,
        auto_day: null,
      });
    }
    for (const c of d.checklists) c.owner_user_id = null;
    for (const g of d.goals) g.owner_user_id = null;
  });
  await expect(monthLine(page)).toContainText('이번 달 보내기와 용돈은 자동이에요');
  await page.goto('/salary?view=plan');
  const send = page.locator('.hg-receipt__row', { hasText: '보내기' });
  await expect(send).toContainText('월급 − 용돈');
  await expect(send).toContainText('자동 월급날');
  await expect(send.locator('.hg-receipt__lock')).toHaveCount(1);
  await expect(send.getByRole('button')).toHaveCount(0);
  await axe(page);
});

test('W-01 줄 설정(7a): 체크리스트에 넣기 끄기, 은행에서 자동으로 나가요 + 나가는 날 → 바로 저장 + 되돌리기, 알약 “자동 26일”', async ({
  page,
}) => {
  const db = await open(page, undefined, NOW, '/salary?view=plan');
  await page.getByRole('button', { name: '고정지출 88만 원' }).click();
  const sheet = page.getByRole('dialog', { name: '고정지출 금액' });
  await expect(sheet.getByRole('switch', { name: '체크리스트에 넣기' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await sheet.getByRole('switch', { name: '은행에서 자동으로 나가요' }).click();
  await sheet.getByRole('button', { name: '다음 날' }).click();
  await axe(page);
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.locator('.hg-toast')).toContainText('고정지출 설정을 바꿨어요');
  expect(db.v22?.calls.at(-1)?.body).toEqual({
    p_items: [{ id: 'split-1-line-2', in_checklist: true, auto_pay: true, auto_day: 26 }],
  });
  await expect(page.locator('.hg-receipt__row', { hasText: '고정지출' })).toContainText(
    '자동 26일',
  );
  // 저금 줄 시트에는 ‘체크리스트에 넣기’가 없음(늘 켬)
  await page.getByRole('button', { name: /^청약/ }).click();
  await expect(page.getByRole('switch', { name: '체크리스트에 넣기' })).toHaveCount(0);
});

// ---- 맨 위 띠, 오류, 자산, Realtime(2026-11-11 QA 4구간, v2.2에 맞춤) ----

test('H-04 자산 관리 타일: 순자산 값, 순위 배지는 기본 끔(배지 켜기는 assets 쪽 e2e), 공지 띠는 맨 위', async ({
  page,
}) => {
  await open(page, (d) => {
    d.assets.push({
      id: 'a1',
      side: 'asset',
      grp: 'deposit',
      kind: 'deposit',
      name: '공동 예금',
      amount: 30_000_000,
      principal: null,
      owner: 'joint',
      owner_user_id: null,
      visibility: 'all',
      status: 'held',
      deleted_at: null,
    });
    Object.assign(d.me, { rank_month: '2026-10-01', rank_pct: 38, rank_net: 30_000_000 });
    d.notices.push({
      id: 'n2',
      kind: 'maintenance',
      title: '10월 20일 새벽 점검',
      body: '오전 2시부터 4시까지 저장이 안 돼요',
      importance: 'must',
      platforms: ['desktop', 'web'],
    });
  });
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile).toContainText('3,000만 원');
  await expect(tile.locator('.hg-hubtile__badge')).toHaveCount(0);
  await expect(page.locator('.hg-body__banner').first()).toContainText('10월 20일 새벽 점검');
  await axe(page);
});

test('알림 메일 반송(14): 홈 상단 띠 → S-11b 알림 이메일', async ({ page }) => {
  const db = await open(page);
  db.mailBounced = true;
  await page.reload();
  await expect(page.getByText('알림 메일이 전달되지 않았어요')).toBeVisible();
  await page.getByRole('button', { name: '확인하기' }).first().click();
  await expect(page).toHaveURL(/\/settings\/me\/email$/);
});

test('맨 위 띠는 하나만(D3): 해제 대기 > 필독 공지 > 메일 반송. 회색 바탕 위 회색 띠는 흰 판(D1)', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'unlink_pending', partner_nickname: '예빈' });
    d.partner = PARTNER;
    d.unlinks.push({
      id: 'u1',
      space_id: 'space-1',
      requested_by: 'yebin',
      partner_id: chanwoo.id,
      status: 'pending',
      deadline: '2026-10-20',
      requested_at: '2026-10-06T01:00:00Z',
    });
    d.mailBounced = true;
  });
  const bands = page.locator('.hg-body__banners .hg-banner');
  await expect(page.getByText('예빈님이 연결 해제를 요청했어요')).toBeVisible();
  await expect(bands).toHaveCount(1);
  const bg = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg('.hg-banner--strip')).toBe(await bg('.hg-together'));
  expect(await bg('.hg-banner--strip')).not.toBe(await bg('.hg-frame'));
  // 할 일 띠 1번(해제 요청)은 맨 위 띠가 대신함
  await expect(band(page)).toHaveCount(0);
  await axe(page);
});

test('H-11 오류(S4-01): 확인 목록을 못 불러오면 공통 7번 카드 + 다시 시도, 월급이 없을 때만 ‘월급 알려 주기’', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  let fail = true;
  await page.route('**/rest/v1/pay_checklist*', (r) => {
    if (!fail || r.request().method() !== 'GET') return r.fallback();
    return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' });
  });
  await page.goto('/');
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('월급이 생기면 월급 계획을 만들어 드려요')).toHaveCount(0);
  await axe(page);
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(monthLine(page)).toContainText('확인할 게 5개 있어요');
  Object.assign(db.me, { monthly_income: 0, payday: null });
  db.splits.length = 0;
  db.checklists.length = 0;
  await page.reload();
  await expect(monthLine(page)).toContainText('월급이 생기면 월급 계획을 만들어 드려요');
  await expect(monthLine(page)).toContainText('월급 알려 주기');
});

test('Realtime(S4-02): 파트너가 합류하면 초대 띠가 사라지고 H-10 Avatar 둘', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(band(page)).toContainText('같이 모을 사람을 초대해 보세요');
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
  await expect(page.getByText('같이 모을 사람을 초대해 보세요')).toHaveCount(0);
  await expect(
    together(page).locator('.hg-together__slide').first().locator('.hg-avatar'),
  ).toHaveCount(2);
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

test('두 계정(찬우·예빈, 합쳐서): 예빈이 “모두 계획대로 됐어요”를 누르면 찬우 홈 H-11이 Realtime으로 바로 “계획대로 됐어요”', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const cCtx = await browser.newContext();
  const yCtx = await browser.newContext();
  const c = await cCtx.newPage();
  const y = await yCtx.newPage();
  await c.clock.setFixedTime(NOW);
  await y.clock.setFixedTime(NOW);
  const rt = await mockRealtime(c);
  const db = await mockOnboarding(c, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    salary_mode: 'joint',
    joint_cycle_day: 25,
  });
  db.partner = PARTNER;
  for (const sp of db.splits) sp.owner_user_id = null;
  for (const ch of db.checklists) ch.owner_user_id = null;
  for (const g of db.goals) g.owner_user_id = null;
  // 용돈 줄은 찬우 것(예빈은 건너뜀)
  const ydb = await mockOnboarding(y, { now: NOW });
  Object.assign(ydb, {
    me: {
      ...ydb.me,
      ...PARTNER,
      space_id: 'space-1',
      onboarding_done_at: '2026-10-02T00:00:00Z',
    },
    partner: { id: chanwoo.id, nickname: '찬우', monthly_income: 3_500_000, payday: 25 },
    space: db.space,
    goals: db.goals,
    splits: db.splits,
    checklists: db.checklists,
    v22: db.v22 ?? emptyV22(),
  });
  db.v22 = ydb.v22;
  await c.goto('/');
  await expect(monthLine(c)).toContainText('확인할 게 5개 있어요');
  await expect.poll(() => rt.subscribed('pay_check_line')).toBeGreaterThan(0);
  await y.goto('/salary');
  await y.getByRole('button', { name: '모두 계획대로 됐어요' }).click();
  await expect(y.locator('.hg-toast')).toContainText('9월 25일 월급');
  // 찬우 용돈 줄은 남음(합쳐서 용돈은 주인만, B7)
  const left = (db.checklists[0]?.pay_check_line as Record<string, unknown>[]).filter(
    (l) => l.state === 'wait',
  );
  expect(left.map((l) => l.kind)).toEqual(['allowance']);
  rt.emit('pay_check_line', 'UPDATE', { id: 'x', space_id: 'space-1', state: 'checked' });
  await expect(monthLine(c)).toContainText('확인할 게 1개 있어요');
  await cCtx.close();
  await yCtx.close();
});

test('홈 화면 위젯(26 v2.2): 홈 값으로 WG-01 대표 저금 %·기한 달, WG-04 다가오는 날을 금액 없이 브리지에 넘김', async ({
  page,
}) => {
  await fakeBridge(page, { signedIn: true, pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  await open(page);
  await expect(together(page).locator('.hg-together__slide').first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __fb: { widget: unknown[] } }).__fb.widget.length,
      ),
    )
    .toBeGreaterThan(0);
  const last = await page.evaluate(() => {
    const w = (window as unknown as { __fb: { widget: unknown[] } }).__fb.widget;
    return w[w.length - 1] as {
      save: {
        name: string;
        big: string;
        pct: number | null;
        line: string | null;
        to: string;
      } | null;
      next: { name: string; date: string; to: string } | null;
    };
  });
  // H-10 첫 칸과 같은 저금, 금액은 없음
  expect(last.save).toMatchObject({
    name: '내 집 마련',
    big: '0%',
    pct: 0,
    line: '2031년 10월까지',
  });
  expect(last.save?.to).toMatch(/^\/salary\/items\//);
  expect(JSON.stringify(last)).not.toMatch(/원/);
});
