import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { homeTask, homeTaskTexts } from './home-tasks';
import { chanwoo, emptyV22, type MemDb, mockOnboarding, seed } from './mocks';

// 구역 1 홈 점검(2026-11-20, 19 H-04·H-10·H-16·H-06·H-08, 25 S-20): 사용자 결정 7건 중 홈·도움말 5건
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
const care = (o: Record<string, unknown>) => ({
  id: 'c-1',
  category: 'couple',
  kind: 'custom',
  name: '어머니 생신',
  member_id: null,
  side: null,
  date_rule: 'solar_yearly',
  month: 10,
  day: 14,
  leap: false,
  once_on: null,
  budget: 300_000,
  carer: 'together',
  alerts: [30, 7],
  status: 'todo',
  status_on: null,
  memo: null,
  secret: false,
  auto: null,
  auto_moves: true,
  created_by: chanwoo.id,
  created_at: '2026-09-01T00:00:00Z',
  ...o,
});

async function open(page: Page, prep?: (db: MemDb) => void, url = '/') {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  prep?.(db);
  await page.goto(url);
  return db;
}
const asset = (o: Record<string, unknown>) => ({
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
  ...o,
});

test('H-10 C안 문장 한 줄(목표 금액 있으면 “목표까지 150,000,000원 남았어요”, 금액만 오렌지 700), 막대 없음. “…님은 아직 같이 모으기에 없어요”는 카드에 없음', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    d.partner = PARTNER;
  });
  const slide = page.locator('.hg-together__slide').first();
  await expect(slide).toBeVisible();
  await expect(slide.locator('.hg-together__say')).toHaveText('목표까지 150,000,000원 남았어요');
  await expect(slide.locator('.hg-together__em')).toHaveText('150,000,000원');
  expect(
    await slide.locator('.hg-together__em').evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe('700');
  await expect(slide.locator('.hg-together__bar')).toHaveCount(0);
  await expect(slide.locator('.hg-together__line')).toHaveCount(0);
  await expect(page.locator('.hg-together')).not.toContainText('같이 모으기에 없어요');
});

test('H-10 목표 금액이 없으면 문장은 “이번 달 +950,000원 모았어요”', async ({ page }) => {
  await open(page, (d) => {
    for (const g of d.goals) Object.assign(g, { target_amount: null, deadline: null });
    const c = d.checklists[0];
    for (const l of (c?.pay_check_line ?? []) as Record<string, unknown>[])
      Object.assign(l, {
        state: 'checked',
        checked_by: chanwoo.id,
        checked_at: '2026-10-01T00:00:00Z',
      });
  });
  const slide = page.locator('.hg-together__slide').first();
  await expect(slide.locator('.hg-together__say')).toHaveText('이번 달 +950,000원 모았어요');
  await expect(slide.locator('.hg-together__em')).toHaveCount(0);
  await expect(slide.locator('.hg-together__bar')).toHaveCount(0);
});

test('H-04 자산 관리 타일: 이름표 “순자산”, 마이너스 그대로, ‘자산 / 부채’ 줄은 없앰(2026-11-23), 금액 가리기면 값 가림', async ({
  page,
}) => {
  await open(page, (d) => {
    d.assets.push(
      asset({}),
      asset({
        id: 'd1',
        side: 'debt',
        grp: 'credit',
        kind: 'credit_loan',
        name: '대출',
        amount: 50_000_000,
      }),
    );
  });
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile.locator('.hg-hubtile__sub')).toHaveText('순자산');
  await expect(tile.locator('.hg-hubtile__value')).toHaveText('−20,000,000원');
  await expect(tile.locator('.hg-hubtile__foot')).toHaveCount(0);
  await expect(tile).toHaveClass(/hg-hubtile--point/);
  await axe(page);
  await page.evaluate(() => localStorage.setItem('sweetwo.masked', '1'));
  await page.reload();
  const masked = page.getByRole('button', { name: /^자산 관리/ });
  await expect(masked.locator('.hg-hubtile__value')).toHaveText('•••');
  await expect(masked.locator('.hg-hubtile__foot')).toHaveCount(0);
});

test('H-04 자산 0개면 기존 동기 문구 그대로(이름표·작은 줄 없음)', async ({ page }) => {
  await open(page);
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile).toContainText('아직 입력한 자산이 없어요');
  await expect(tile.locator('.hg-hubtile__foot')).toHaveCount(0);
});

test('H-16 다가오는 날 상자(최대 2개, D-n) → 달력, H-08 타일 보조 줄은 “{이름} D-n”', async ({
  page,
}) => {
  await open(page, (d) => {
    d.cares.push(
      care({ id: 'c-mom' }),
      care({
        id: 'c-100',
        name: '사귄 지 100일',
        date_rule: 'once',
        month: null,
        day: null,
        once_on: '2026-10-30',
      }),
      care({
        id: 'c-far',
        name: '설 명절',
        date_rule: 'once',
        month: null,
        day: null,
        once_on: '2026-12-01',
      }),
    );
  });
  const box = page.locator('.hg-hubup');
  await expect(box).toBeVisible();
  await expect(box.locator('.hg-hubup__title')).toHaveText('다가오는 날');
  await expect(box.locator('.hg-hubup__row')).toHaveCount(2);
  await expect(box.locator('.hg-hubup__name')).toHaveText(['어머니 생신', '사귄 지 100일']);
  await expect(box.locator('.hg-hubup__dday')).toHaveText(['D-7', 'D-23']);
  // 맨 아래(반 칸 타일 둘 아래)
  const top = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
  expect(await top('.hg-hubup')).toBeGreaterThan(await top('.hg-hubtile'));
  await expect(page.getByRole('button', { name: /^캘린더/ })).toContainText('어머니 생신 D-7');
  await axe(page);
  await box.click();
  await expect(page).toHaveURL(/\/calendar$/);
});

test('H-16 일정이 없으면 상자를 안 그림, 캘린더 타일은 “기념일을 입력해 보세요”', async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole('button', { name: /^캘린더/ })).toContainText(
    '기념일을 입력해 보세요',
  );
  await expect(page.locator('.hg-hubup')).toHaveCount(0);
});

test('H-06 할 일 시트 8번 줄: 줄 사이 회색 “이미 정했어요” 대신 오른쪽 알약 “정했어요”(체크 아이콘), 누르면 띠를 닫음', async ({
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
  await page.locator('.hg-hubband').first().click();
  const sheet = page.getByRole('dialog', { name: '할 일' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('이미 정했어요', { exact: true })).toHaveCount(0);
  const row = sheet.locator('.hg-tasksheet__row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('같이 쓰는 생활비를 나눠 볼까요?');
  const pill = row.locator('.hg-tasksheet__done');
  await expect(pill).toHaveText('정했어요');
  await expect(pill.locator('.hg-ico')).toHaveCount(1);
  await expect(row.locator('.hg-chevron')).toHaveCount(0);
  const box = await pill.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(28);
  await axe(page);
  await pill.click();
  await expect.poll(() => db.v22?.tasks ?? []).toContain('split_suggest');
  await expect(sheet).toHaveCount(0);
});

test('S-20 도움말: 기본 탭 “자주 묻는 질문” 대표 5개 + 묶음 탭 5개, 탭을 고르면 그 묶음만, 검색하면 탭을 무시', async ({
  page,
}) => {
  await open(page, undefined, '/settings/help');
  // 2026-11-23 칩 줄 → 밑줄 탭(LineTabs): 첫 탭 ‘자주 묻는 질문’ + 묶음 5개
  const tabs = page.getByRole('tablist', { name: '묶음' }).getByRole('tab');
  await expect(tabs).toHaveText([
    '자주 묻는 질문',
    '시작하기',
    '둘이 쓰기',
    '쓰는 법',
    '기기와 보안',
    '데이터와 계정',
  ]);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  const qs = page.locator('.hg-acc__q');
  await expect(qs).toHaveCount(5);
  await expect(qs.first()).toContainText('통장을 연결하지 않나요?');
  await axe(page);
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await axe(page);
  await expect(qs.first()).toContainText('파트너는 어떻게 초대하나요?');
  expect(await qs.count()).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: '통장을 연결하지 않나요?' })).toHaveCount(0);
  // 검색은 탭을 무시하고 전체에서
  const search = page.getByRole('searchbox', { name: '자주 묻는 질문에서 찾기' });
  await search.fill('통장을 연결');
  await expect(page.getByRole('button', { name: '통장을 연결하지 않나요?' })).toBeVisible();
  await search.fill('');
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  // 첫 탭을 누르면 기본으로
  await tabs.first().click();
  await expect(qs).toHaveCount(5);
  // 문의·약관·버전 상자는 그대로
  await expect(page.getByRole('button', { name: '문의하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '버전' })).toBeVisible();
});

// 구역 1 홈 케이스 점검(2026-11-20, 19 H-06 5c·11a, H-10, H-12(2026-11-26 없앰), H-16, W-12)
test('H-06 묶음 띠: 가장 앞선 할 일 문장 + 오른쪽 “+n” + ›, 읽기 이름 “할 일 n개”, 누르면 시트', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'not_joined' });
  });
  const band = page.locator('.hg-hubband').first();
  await expect(band).toBeVisible();
  const texts = await homeTaskTexts(page);
  expect(texts.length).toBeGreaterThan(1);
  await expect(band.locator('.hg-hubband__text')).toHaveText(texts[0] ?? '');
  await expect(band.locator('.hg-hubband__more')).toHaveText(`+${texts.length - 1}`);
  await expect(band.getByRole('button', { name: `할 일 ${texts.length}개` })).toBeVisible();
  // 이동 글자(“초대하기”, “확인하기”)는 묶음 띠에 없음
  await expect(band).not.toContainText('초대하기');
  await axe(page);
  await band.click();
  await expect(page.getByRole('dialog', { name: '할 일' })).toBeVisible();
});

test('같이 모으기 모은 금액이 0원이어도 홈 순서는 고정: 띠 → H-10 → 월급 상자 → 타일 → 다가오는 날', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, (d) => {
    d.cares.push(care({ id: 'c-mom' }));
  });
  await expect(page.locator('.hg-together__slide').first()).toContainText('0원');
  const top = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
  const hero = await top('.hg-together');
  expect(await top('.hg-hubband')).toBeLessThan(hero);
  expect(hero).toBeLessThan(await top('.hg-hubbox'));
  expect(await top('.hg-hubbox')).toBeLessThan(await top('.hg-hubtile'));
  expect(await top('.hg-hubtile')).toBeLessThan(await top('.hg-hubup'));
});

test('H-12 결혼 준비 메모 상자는 없앰(2026-11-26 사용자 결정): 결혼 준비 중이어도 홈에 그리지 않음, 결혼식 D-day는 H-10 머리 그대로', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { marriage_status: 'engaged', wedding_date: '2027-03-01' });
  });
  await expect(page.locator('.hg-hubbox')).toBeVisible();
  await expect(page.getByText(/결혼 준비 메모/)).toHaveCount(0);
  await expect(page.getByText('+ 쓸 곳 메모 추가')).toHaveCount(0);
  await expect(page.locator('.hg-hubtile.hg-hub__wide')).toHaveCount(0);
  await expect(page.locator('.hg-together .hg-hubtile__badge')).toContainText('결혼식 D-');
});

// 2026-11-26 사용자 결정(“같이 모으기 박스도 빈 공간이 너무 많은 듯”): 홈 상자 세로 간격(DESIGN.md 강약 기준 ‘홈 상자 세로 간격’)
test('H-10 세로 간격(C안): 제목 줄 → 이름표 12, 이름표 → 금액 4, 금액 → 문장 8, 문장 → 넘김 점 12, 상자 위아래 24', async ({
  page,
}) => {
  // 좁은 창 기준(넓은 창 4열은 H-10이 두 줄 높이라 아래가 늘어남)
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    d.partner = PARTNER;
    for (const g of d.goals) g.owner_user_id = null;
  });
  const box = page.locator('.hg-together');
  await expect(box.locator('.hg-together__say').first()).toBeVisible();
  const r = await box.evaluate((el) => {
    const q = (s: string) => el.querySelector(s)?.getBoundingClientRect() ?? null;
    const b = el.getBoundingClientRect();
    const head = q('.hg-together__head');
    const name = q('.hg-together__name');
    const amt = q('.hg-together__amount');
    const say = q('.hg-together__say');
    const dots = q('.hg-together__dots');
    return {
      top: Math.round((head?.top ?? 0) - b.top),
      headName: Math.round((name?.top ?? 0) - (head?.bottom ?? 0)),
      nameAmt: Math.round((amt?.top ?? 0) - (name?.bottom ?? 0)),
      amtSay: Math.round((say?.top ?? 0) - (amt?.bottom ?? 0)),
      sayDots: dots ? Math.round(dots.top - (say?.bottom ?? 0)) : 12,
      bottom: Math.round(b.bottom - (dots?.bottom ?? say?.bottom ?? 0)),
    };
  });
  expect(r).toEqual({ top: 24, headName: 12, nameAmt: 4, amtSay: 8, sayDots: 12, bottom: 24 });
});

test('목표 달성: 홈을 열어도 W-12로 넘어가지 않고 띠 “{이름} 다 모았어요”가 뜸 → W-12(머리글 없음) → 고르면 띠가 사라짐', async ({
  page,
}) => {
  const db = await open(page, (d) => {
    const g = d.goals.find((x) => x.id === 'goal-h');
    Object.assign(g ?? {}, { status: 'achieved', achieved_seen: [] });
    d.goalStory = { months: 3, together: 0 };
  });
  await expect(page.locator('.hg-hub')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/$/);
  expect(await homeTaskTexts(page)).toContain('내 집 마련 다 모았어요');
  await (await homeTask(page, '내 집 마련 다 모았어요')).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h\/achieved$/);
  await expect(page.locator('.hg-celebrate__title')).toHaveText('내 집 마련');
  await expect(page.locator('.hg-celebrate__eyebrow')).toHaveCount(0);
  await expect(page.getByText('다 모았어요')).toHaveCount(0);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '계속 모을게요' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-h')?.target_amount).toBeNull();
  await page.goto('/');
  expect(await homeTaskTexts(page)).not.toContain('내 집 마련 다 모았어요');
});

test('모으는 저금이 하나도 없고 그만 모은 것이 있으면 H-10이 없고 띠 “다음엔 뭘 모을까요?” → W-01 저축·투자 묶음', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.me, { onboarding_done_at: '2026-08-01T00:00:00Z' });
    for (const g of d.goals) Object.assign(g, { closed_at: '2026-10-01T00:00:00Z' });
  });
  await expect(page.locator('.hg-hub')).toBeVisible();
  await expect(page.locator('.hg-together')).toHaveCount(0);
  expect(await homeTaskTexts(page)).toContain('다음엔 뭘 모을까요?');
  await (await homeTask(page, '다음엔 뭘 모을까요?')).click();
  await expect(page).toHaveURL(/\/salary\/plan\?from=home#saving$/);
});

test('홈 A안 강약(2026-11-26): 상자 제목 15/700, 월급 줄은 이름표 13/400 위 + 값 17/700 아래(높이 64), 타일 제목 15/700 + 값 17/700, 안내 글자 15/400', async ({
  page,
}) => {
  await open(page, (d) => {
    d.cares.push(care({}));
    d.assets.push(asset({}));
  });
  const font = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.fontSize}/${s.fontWeight}`;
      });
  for (const sel of [
    '.hg-hubbox__title',
    '.hg-hubup__title',
    '.hg-together__title',
    '.hg-hubtile__title',
  ])
    expect(await font(sel)).toBe('15px/700');
  expect(await font('.hg-hubbox__row .hg-hubbox__name')).toBe('13px/400');
  expect(await font('.hg-hubbox__row .hg-hubbox__main')).toBe('17px/700');
  expect(await font('.hg-together__name')).toBe('13px/400');
  expect(await font('.hg-together__say')).toBe('15px/400'); // 2026-11-26 C안 문장 한 줄
  const month = page.locator('.hg-hubbox__row').first();
  await expect(month.locator('.hg-hubbox__name')).toHaveText('이번 달 월급 체크');
  await expect(month.locator('.hg-hubbox__main')).toHaveText('5개 남음');
  expect(Math.round((await month.boundingBox())?.height ?? 0)).toBe(64);
  // 이름표가 값 위
  const y = async (sel: string) => (await month.locator(sel).boundingBox())?.y ?? 0;
  expect(await y('.hg-hubbox__name')).toBeLessThan(await y('.hg-hubbox__main'));
  // 타일: 자산 관리 이름표 13 + 값 17/700, 캘린더는 기존 보조 값을 굵게
  const assets = page.getByRole('button', { name: /^자산 관리/ });
  expect(
    await assets.locator('.hg-hubtile__sub').evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe('13px');
  expect(
    await assets.locator('.hg-hubtile__value').evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe('700');
  const cal = page.getByRole('button', { name: /^캘린더/ });
  await expect(cal.locator('.hg-hubtile__value')).toHaveText('어머니 생신 D-7');
  await axe(page);
});

// 2026-11-26 사용자 결정: H-10 칸 왼쪽 = 저축·투자 그림(파일이 없으면 자리째 없음), 사람 원은 머리 제목 오른쪽 작은 Avatar
test('H-10 그림 자리는 파일이 없으면 그리지 않고, 사람 원은 머리 “같이 모으기” 바로 오른쪽 sm(연결이면 둘)', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    d.partner = PARTNER;
    for (const g of d.goals) g.owner_user_id = null;
  });
  const box = page.locator('.hg-together');
  const slide = box.locator('.hg-together__slide').first();
  await expect(slide).toBeVisible();
  // 그림 파일이 아직 없어 그림·회색 빈 자리·사람 원 모두 칸 안에 없음
  await expect(slide.locator('img, .hg-artslot, .hg-avatar, .hg-ico')).toHaveCount(0);
  const owners = box.locator('.hg-together__titlerow .hg-together__owners .hg-avatar');
  await expect(owners).toHaveCount(2);
  for (const a of await owners.all())
    expect(Math.round((await a.boundingBox())?.width ?? 0)).toBe(24);
  // 제목 바로 오른쪽(같은 줄, 8px 띄움)
  const t = await box.locator('.hg-together__title').boundingBox();
  const o = await box.locator('.hg-together__owners').boundingBox();
  expect(Math.round((o?.x ?? 0) - ((t?.x ?? 0) + (t?.width ?? 0)))).toBe(8);
  expect(
    Math.abs((o?.y ?? 0) + (o?.height ?? 0) / 2 - ((t?.y ?? 0) + (t?.height ?? 0) / 2)),
  ).toBeLessThan(2);
  // 화면 읽기 문장은 그대로
  await expect(slide).toHaveAccessibleName(/^같이 모으기, 내 집 마련, 0원/);
  await axe(page);
});

test('H-16 다가오는 날 줄: 이름 15/400 ink + D-n 13/400 slate, 줄 높이 40, 제목과 첫 줄 사이 8', async ({
  page,
}) => {
  await open(page, (d) => {
    d.cares.push(care({}), care({ id: 'c-2', name: '결혼기념일', day: 30 }));
  });
  const box = page.locator('.hg-hubup');
  await expect(box.locator('.hg-hubup__row')).toHaveCount(2);
  const font = (sel: string) =>
    box
      .locator(sel)
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.fontSize}/${s.fontWeight}`;
      });
  expect(await font('.hg-hubup__name')).toBe('15px/400');
  expect(await font('.hg-hubup__dday')).toBe('13px/400');
  const rows = await box.locator('.hg-hubup__row').all();
  for (const r of rows) expect(Math.round((await r.boundingBox())?.height ?? 0)).toBe(40);
  const title = await box.locator('.hg-hubup__title').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { bottom: r.bottom, pad: parseFloat(getComputedStyle(el).paddingBottom) };
  });
  const firstTop = (await rows[0]?.boundingBox())?.y ?? 0;
  expect(Math.round(firstTop - (title.bottom - title.pad))).toBe(8);
  expect(Math.round((await box.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
});

for (const [amount, text] of [
  [42_000_000, '42,000,000원'],
  [150_000_000, '150,000,000원'],
] as const)
  test(`320px 반 칸 타일 자산 관리 금액 “${text}”이 17/700 한 줄(안쪽 좌우 8, 2026-11-26 A안)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, (d) => {
      d.assets.push(asset({ amount }));
    });
    const tile = page.getByRole('button', { name: /^자산 관리/ });
    const value = tile.locator('.hg-hubtile__value');
    await expect(value).toHaveText(text);
    const v = await value.evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: s.fontSize, weight: s.fontWeight, h: el.getBoundingClientRect().height };
    });
    expect(v).toEqual({ size: '17px', weight: '700', h: 24 });
    expect(await tile.evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('8px');
  });

test('375px 반 칸 타일 안쪽 좌우는 그대로 20', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, (d) => {
    d.assets.push(asset({}));
  });
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile.locator('.hg-hubtile__value')).toBeVisible();
  expect(await tile.evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('20px');
});
