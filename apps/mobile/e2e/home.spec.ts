import { test, expect, type Page } from '@playwright/test';
import { fillAmount } from './form';
import { axe as runAxe } from './axe';
import { chanwoo, emptyV22, type MemDb, mockOnboarding, mockRealtime, seed } from './mocks';
import { fakeBridge } from './fake-bridge';
import { events } from './analytics';
import { homeTask, homeTaskTexts } from './home-tasks';
import { doneRow } from './w02-row';

// 홈 v2.2(19 ‘홈 v2.2’, ADR 0009): H-10 같이 모으기, H-11 이번 달 한 줄(날짜 없는 사람 H-13), H-06 할 일 띠 16순서,
// H-15 월급 상자(이번 달 월급 체크·월급 계획 템플릿, 2026-11-17, 2026-11-18 저축·투자 줄 없앰), H-04 자산 관리(H-12 결혼 준비는 2026-11-26 없앰)·H-08 캘린더 타일.
// 찬우 혼자(예빈 미합류), 각자, 실수령 350만, 월급날 25일.
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
// 월급 상자(H-15)의 첫 줄 “이번 달 월급 체크”(예전 H-11 한 줄 자리)와 둘째 줄 “월급 계획 템플릿”
// 2026-11-18: 상자 전체가 버튼 하나, 줄은 정보 줄(누르는 줄·꺾쇠 없음)
const salaryBox = (page: Page) => page.locator('.hg-hubbox');
const monthLine = (page: Page) => page.locator('.hg-hubbox__row').nth(0);
const planRow = (page: Page) => page.locator('.hg-hubbox__row').nth(1);
// 할 일 띠는 두 칸까지(2026-11-13 UX B M5): 첫 칸
const band = (page: Page) => page.locator('.hg-hubband').first();
const bands = (page: Page) => page.locator('.hg-hubband');

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

test('H-10 같이 모으기 + H-15 월급 상자(이번 달 월급 체크·월급 계획 템플릿)(19 v2.2, 2026-11-17): 대표 저금은 목표 금액에 가까운 것, 저금 2개면 가로 넘김 + ‘저금 모두 보기’', async ({
  page,
}) => {
  const db = await open(page);
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  // 예전 큰 상자(H-03)·저금 상자(H-02)는 없음
  await expect(page.locator('.hg-hubhero, .hg-hubsave')).toHaveCount(0);
  const h = together(page);
  await expect(h.getByRole('heading', { name: '같이 모으기' })).toBeVisible();
  // 미합류면 내 Avatar 하나(빈 원 없음). 2026-11-26: 사람 원은 머리 제목 오른쪽(작은 sm), 칸 안에는 없음
  const first = h.locator('.hg-together__slide').first();
  await expect(h.locator('.hg-together__owners .hg-avatar')).toHaveCount(1);
  await expect(h.locator('.hg-together__owners .hg-avatar--sm')).toHaveCount(1);
  await expect(first.locator('.hg-avatar')).toHaveCount(0);
  await expect(first).toHaveAccessibleName(
    '같이 모으기, 내 집 마련, 0원, 목표 금액의 0%, 2031년 10월까지 150,000,000원 더 필요해요',
  );
  // 2026-11-26 C안: 막대·보조 줄 없이 문장 한 줄 “목표까지 n원 남았어요”
  await expect(first.locator('.hg-together__say')).toHaveText('목표까지 150,000,000원 남았어요');
  await expect(first.locator('.hg-together__bar, .hg-together__line')).toHaveCount(0);
  await expect(h.locator('.hg-together__slide')).toHaveCount(2);
  // 2026-11-18 누를 수 없는 정보 상자: 칸은 버튼이 아니고 ‘모두 보기’ 칸도 없음
  await expect(h.getByRole('button')).toHaveCount(0);
  await expect(first).toHaveCSS('cursor', 'default');
  // 2026-11-15: ‘수입 입력하기’는 저금 카드에서 빼고 월급 ‘이번 달’(W-02) ‘수입 입력하기’로 옮김
  await expect(h.getByRole('button', { name: '수입 입력하기' })).toHaveCount(0);
  // H-11: 손 줄 5개가 남음. 월급날(9월 25일)이 지났으니 “월급날이에요” 대신 날짜 문장(2026-11-13 UX B M2)
  await expect(monthLine(page)).toContainText('이번 달 월급 체크');
  await expect(monthLine(page)).toContainText('5개 남음');
  // H-06: 월급날 확인할 게 있어 5b 띠 + 미합류라 초대(15번) = 띠 하나 “할 일 2개”(저금이 있어 첫 저금 띠는 없음)
  await expect(bands(page)).toHaveCount(1);
  expect(await homeTaskTexts(page)).toEqual([
    '9월 25일 월급에서 확인할 게 5개 남았어요',
    '같이 모을 사람을 초대해 보세요',
  ]);
  // H-15 둘째 줄: 미계획(350만 − 350만), “매달 25일”은 2026-11-23에 지움
  await expect(planRow(page)).toContainText('월급 계획 템플릿');
  await expect(planRow(page)).not.toContainText('매달 25일');
  await expect(planRow(page)).toContainText('미계획 0원');
  // 2026-11-18: 월급 상자는 줄 둘(저축·투자 줄 없앰)
  await expect(page.locator('.hg-hubbox__row')).toHaveCount(2);
  // 결혼했어요라 H-12 없음
  await expect(page.getByText(/결혼 준비 메모/)).toHaveCount(0);
  await axe(page);

  // 2026-11-18 줄마다 버튼: 상자·머리는 누를 수 없고, 줄마다 › 하나, “자세히 보기” 없음
  await expect(page.locator('button.hg-hubbox')).toHaveCount(0);
  await expect(page.locator('button.hg-hubbox__row')).toHaveCount(2);
  await expect(page.locator('.hg-hubbox__title .hg-ico')).toHaveCount(0);
  await expect(page.locator('.hg-hubbox__row .hg-hubbox__go .hg-ico')).toHaveCount(2);
  await expect(page.getByText('자세히 보기')).toHaveCount(0);
  expect((await planRow(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(monthLine(page)).toHaveAccessibleName('이번 달 월급 체크, 5개 남음');
  await expect(planRow(page)).toHaveAccessibleName('월급 계획 템플릿, 미계획 0원');
  // 이번 달 월급 체크 → W-02 “모두 계획대로 됐어요” 한 번(confirm_payday)
  await monthLine(page).click();
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.locator('.hg-datepill')).toHaveText('9월 25일 월급');
  await expect(page.getByRole('tab', { name: /^남음 5$/ })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '모두 계획대로 됐어요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('9월 25일 월급, 계획대로 됐어요');
  expect(lines(db).every((l) => l.state === 'checked')).toBe(true);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await page.goto('/');
  await expect(monthLine(page)).toContainText('계획대로 됐어요');
  // 체크한 저금 줄이 모은 금액에. 목표 금액이 있으면 ‘이번 달 +’ 대신 남은 금액 문장(2026-11-26 C안)
  await expect(first.locator('.hg-together__amount')).toHaveText('950,000원');
  await expect(first.locator('.hg-together__say')).toHaveText('목표까지 149,050,000원 남았어요');
});

test('홈 상자 → 화면: 월급 줄마다 W-02·W-01, 캘린더, 자산 관리(같이 모으기 H-10은 누를 수 없음, 2026-11-18)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  for (const [click, url] of [
    [() => monthLine(page).click(), /\/salary$/],
    [() => planRow(page).click(), /\/salary\/plan$/],
    [() => page.getByRole('button', { name: /^캘린더/ }).click(), /\/calendar$/],
    [() => page.getByRole('button', { name: /^자산 관리/ }).click(), /\/assets\/items$/],
  ] as const) {
    await page.goto('/');
    await expect(together(page)).toBeVisible();
    await click();
    await expect(page).toHaveURL(url);
  }
  // 키보드만으로(2026-11-18): Tab은 줄마다 한 번(머리·상자는 Tab 자리 없음), ink 링 → Enter
  await page.goto('/');
  await expect(together(page)).toBeVisible();
  await monthLine(page).focus();
  expect(await monthLine(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Tab');
  expect(await planRow(page).evaluate((el) => el === document.activeElement)).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await monthLine(page).evaluate((el) => el === document.activeElement)).toBe(true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/salary\/plan$/);
});

test('저금 0개(2026-11-18): 홈에 H-10 없음 → 첫 저금 띠 → W-01 저축·투자 빈 묶음 칩 → W-11 한 화면 → 저장 → W-01 새 줄 강조 → H-10이 생기고 누를 수 없음, 결혼 준비 중이어도 H-12 없음', async ({
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
  // H-10은 그리지 않음(빈 상태 질문·칩·버튼도 홈에서 없어짐)
  await expect(together(page)).toHaveCount(0);
  await expect(page.getByText('무엇을 같이 모을까요?')).toHaveCount(0);
  // 머리 아래가 비지 않음(2026-11-18): 띠, 월급 상자, 반 칸 타일 둘이 그대로 나옴
  await expect(band(page)).toBeVisible();
  await expect(page.locator('.hg-hubbox__name')).toHaveText([
    '이번 달 월급 체크',
    '월급 계획 템플릿',
  ]);
  // 반 칸 타일 둘(2026-11-26 H-12 결혼 준비 상자는 없앰)
  await expect(page.locator('.hg-hubtile')).toHaveCount(2);
  await expect(page.locator('.hg-hubtile').filter({ hasText: /^자산 관리/ })).toBeVisible();
  await expect(page.locator('.hg-hubtile').filter({ hasText: /^캘린더/ })).toBeVisible();
  // 띠 5b(월급날 확인할 게 있음)는 두 칸에 세지 않음(2026-11-17): 확인 + 첫 저금(7번) + 초대. 초대는 가려지지 않음(19 ‘띠 두 칸’). 2026-11-16 띠는 하나 “할 일 3개” → 시트
  await expect(bands(page)).toHaveCount(1);
  await expect(band(page).getByRole('button', { name: '할 일 3개' })).toBeVisible();
  // 2026-11-20: 가장 앞선 할 일 문장 + 오른쪽 “+2”
  await expect(band(page)).toContainText(/월급에서 확인할 게 \d개 남았어요/);
  await expect(band(page).locator('.hg-hubband__more')).toHaveText('+2');
  await band(page).click();
  const tl = page.getByRole('dialog', { name: '할 일' });
  await expect(tl.locator('.hg-listrow').nth(0)).toContainText(/월급에서 확인할 게 \d개 남았어요/);
  await expect(tl.locator('.hg-listrow').nth(1)).toContainText('무엇을 같이 모을지 정해 볼까요?');
  await expect(tl.locator('.hg-listrow').nth(2)).toContainText('같이 모을 사람을 초대해 보세요');
  await axe(page);
  await page.keyboard.press('Escape');
  // H-12 결혼 준비 상자는 없앰(2026-11-26): 결혼 준비 중이어도 홈에 없음
  await expect(page.getByText(/결혼 준비 메모|\+ 저축·투자 추가/)).toHaveCount(0);
  // 띠 → W-01 저축·투자 묶음 빈 상태
  await band(page).click();
  await page.getByRole('dialog', { name: '할 일' }).locator('.hg-listrow').nth(1).click();
  await expect(page).toHaveURL(/\/salary\/plan\?from=home#saving$/);
  const sec = page.getByRole('region', { name: '저축·투자', exact: true });
  // 2026-11-27 ‘W-01 빈 묶음 A안’: 빈 묶음은 칩 없이 머리 + “+ 저축·투자 추가” 한 줄, 합계 0원은 숨김
  await expect(sec.locator('.hg-plancard__sum')).toHaveCount(0);
  await expect(sec.locator('.hg-chip')).toHaveCount(0);
  await axe(page);
  await sec.getByRole('button', { name: '+ 저축·투자 추가' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new\?from=split$/);
  // 이름 칩은 W-11a 안(19 ‘이름 칩 표’, 결혼 준비 중)
  const chips = page.getByRole('group', { name: '이름 고르기' });
  for (const c of [
    '결혼 비용',
    '신혼집',
    '신혼여행',
    '혼수',
    '비상금',
    '내 집 마련',
    '직접 정하기',
  ])
    await expect(chips.getByRole('button', { name: c, exact: true })).toBeVisible();
  await expect(chips.getByRole('button', { name: '전세 대출 갚기' })).toHaveCount(0);
  await chips.getByRole('button', { name: '신혼집' }).click();
  // 칩으로 들어오면 그 이름을 미리 고름
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    '신혼집에 매달 얼마씩 모을까요?',
  );
  await fillAmount(page, '매달 얼마씩?', 300000);
  await page.getByRole('button', { name: '추가하기' }).click();
  // 저장 → W-01로 돌아와 새 줄 강조(미리 보기 단계 W-11f는 없앰)
  await expect(page).toHaveURL(/\/salary\/plan/);
  await expect(page.locator('.hg-receipt__row.is-new')).toContainText('신혼집');
  // 저장하면 홈에 H-10이 생기고 누를 수 없음
  await page.goto('/');
  const h = together(page);
  await expect(h).toBeVisible();
  await expect(h).toContainText('신혼집');
  await expect(h.getByRole('button')).toHaveCount(0); // 결혼식 날짜가 있어 머리는 D-day 알약(버튼 아님)
  await h.locator('.hg-together__slide').first().click();
  await expect(page).toHaveURL(/\/$/);
});

test('첫 월급날 전(소급 없음): 월급 상자 첫 줄 “10월 23일부터”(25일 일요일 → 앞당김), 7일 전 띠 9번 → W-01d 자동 줄 고르기 → 띠 사라짐', async ({
  page,
}) => {
  test.setTimeout(60_000); // 홈·W-02·시트를 여러 번 오가서 병렬 부하에선 30초를 넘김
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
  // 첫 월급날도 앞당긴 날(25일 일요일 → 23일 금요일, 서버 make_checklist와 같음, 2026-11-14 R3)
  await expect(monthLine(page)).toContainText('10월 23일부터');
  // 할 일이 다 올라오기 전엔 띠가 하나로 보일 수 있어, 문장이 보일 때까지 다시 읽는다
  await expect.poll(() => homeTaskTexts(page)).toContain('자동으로 나가는 걸 골라 주세요');
  await axe(page);
  // W-02도 같은 문장(첫 확인 목록 전)
  await page.goto('/salary');
  await expect(page.locator('.hg-datepill')).toHaveText('10월 23일 월급'); // 2026-11-19 회색 한 줄 문장은 날짜 알약으로
  await expect(page.getByRole('link', { name: '월급 계획 템플릿' })).toHaveCount(0); // 2026-11-18 머리 링크 없앰
  await page.goto('/');
  await (await homeTask(page, '자동으로 나가는 걸 골라 주세요')).click();
  await expect(page).toHaveURL(/\/salary\/auto-lines$/);
  const sheet = page.getByRole('dialog', { name: '자동으로 나가는 걸 골라 주세요' });
  await expect(sheet).toBeVisible();
  // 저금·고정지출 줄만(생활비·용돈은 없음)
  await expect(sheet.getByRole('checkbox')).toHaveCount(3);
  await sheet.getByRole('checkbox', { name: /^내 집 마련/ }).click();
  await sheet.getByRole('button', { name: '다음 날' }).click();
  await axe(page);
  await sheet.getByRole('button', { name: '저장하기' }).click();
  await expect(page).toHaveURL(/\/salary\/plan$/);
  expect(db.v22?.calls.find((c) => c.fn === 'split_lines_configure')?.body).toEqual({
    p_items: [{ id: 'split-1-line-1', auto_pay: true, auto_day: 26 }],
  });
  expect(db.v22?.tasks).toContain('auto_pick');
  // 줄 보조 줄 “27일 자동”(2026-11-19 짧게, 예전 알약 “자동 26일”)
  await expect(page.locator('.hg-receipt__row', { hasText: '내 집 마련' })).toContainText(
    '26일 자동',
  );
  await page.goto('/');
  await expect(band(page)).not.toContainText('자동으로 나가는 걸 골라 주세요');
});

test('자동 줄뿐인 사람: 월급 상자 첫 줄 “자동으로 나가요”, W-02 주 버튼 없음, 자동 줄 건너뛰기', async ({
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
  await expect(monthLine(page)).toContainText('자동으로 나가요');
  await axe(page);
  await monthLine(page).click();
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  // 자동 줄뿐이면 다 확인 상태를 만들지 않고 일반 목록(칩 + 줄), 자동 줄은 보조 줄 “자동으로 나가요”
  await expect(page.locator('.hg-transfer', { hasText: '내 집 마련' })).toContainText(
    '자동으로 나가요',
  );
  // 자동 확인된 줄은 “자동으로 나갔어요”(2026-11-23 C안)
  await expect(page.locator('.hg-transfer', { hasText: '고정지출' })).toContainText(
    '자동으로 나갔어요',
  );
  await expect(doneRow(page, '고정지출')).toBeVisible();
  await axe(page);
  // 자동 확인된 줄도 시트에서 건너뜀
  await page.locator('.hg-transfer__open', { hasText: '고정지출' }).click();
  await page.getByRole('button', { name: '이번 달은 건너뛸게요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('고정지출, 이번 달은 건너뛰었어요');
  expect(lines(db).find((l) => l.kind === 'fixed')?.state).toBe('skipped');
});

test('지난 달 늦은 확인: 월급 상자 첫 줄 “지난달 2개 남음”, W-02 지난 달은 건너뜀만 남아 주 버튼 없음, 건너뜀 줄 시트로 다시 확인', async ({
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
  // 10월 25일(일요일)은 앞당겨 23일로 보임(W-02 제목과 같은 날, 2026-11-13 UX B M2)
  await expect(monthLine(page)).toContainText('5개 남음');
  await expect(monthLine(page)).toContainText('지난달 2개 남음');
  expect(await homeTaskTexts(page)).toContain('10월 23일 월급에서 확인할 게 5개 남았어요');
  await page.goto('/salary?cycle=last');
  await expect(page.locator('.hg-datepill')).toHaveText('9월 25일 월급');
  await expect(page.getByText('다음 월급날 전까지 언제든 확인할 수 있어요')).toBeVisible();
  await axe(page);
  // 남은(미확인) 손 줄이 없고 서버가 닫은 건너뜀 줄만 남았으면 주 버튼 없음(2026-11-19)
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  const skippedBtns = page.getByRole('button', { name: /건너뜀, 고치기$/ });
  // 사람이 직접 건너뛴 줄 1개는 다시 고칠 수 없는 줄(누를 수 없음), 서버가 닫은 줄 2개만 줄 시트
  await expect(page.locator('.hg-transfer--act.is-skipped')).toHaveCount(3);
  await expect(skippedBtns).toHaveCount(2);
  // 서버가 닫은 건너뜀 줄: 줄 → 줄 시트(계획대로 했어요 / 다른 금액으로 했어요) → 완료로 바뀜
  await skippedBtns.nth(1).click();
  await expect(page.getByRole('button', { name: '다른 금액으로 했어요' })).toBeVisible();
  await page.getByRole('button', { name: '계획대로 했어요', exact: true }).click();
  await expect(skippedBtns).toHaveCount(1);
  const prev = lines(db, 0);
  expect(prev.filter((l) => l.state === 'checked' && l.late)).toHaveLength(1);
  expect(db.v22?.calls.some((c) => c.fn === 'confirm_payday')).toBe(false);
});

test('날짜 없는 사람(H-13): 16일째부터 월급 상자 첫 줄에 “3,400,000원 / 3,500,000원”(판정 문장 없음), 월급 계획 템플릿 “수입이 들어올 때”, W-02 자리는 기간 막대', async ({
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
  await expect(line).toContainText('3,400,000원 / 3,500,000원');
  await expect(line).toContainText('수입 / 월급 계획');
  await expect(line).not.toContainText('모자라');
  await expect(line).toHaveAccessibleName(
    '이번 달 월급 체크, 3,400,000원 / 3,500,000원 수입 / 월급 계획',
  );
  await expect(page.locator('.hg-hubline, .hg-periodbar')).toHaveCount(0);
  await expect(planRow(page)).not.toContainText('수입이 들어올 때');
  await axe(page);
  await line.click();
  await expect(page).toHaveURL(/\/salary\/money-in$/);
  await page.goto('/salary');
  // 2026-11-19: 같은 개편 모양(기간 알약, 큰 금액, “월급 계획 350만 원 중”) + 중립 막대
  await expect(page.locator('.hg-w02hero__bar')).toBeVisible();
  await expect(page.locator('.hg-w02hero__amt')).toHaveText('3,400,000원');
  // 막대는 오렌지가 아닌 ink-2
  const fill = await page
    .locator('.hg-w02hero__bar > i')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const ink2 = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ink-2').trim(),
  );
  expect(fill).not.toBe('');
  expect(ink2).not.toBe('');
  await expect(page.getByRole('heading', { name: /\d+일 월급$/ })).toHaveCount(0);
});

test('날짜 없는 사람: 첫 수입 전 “수입 입력하기”, 빈 날 “마지막 수입 41일 전”', async ({
  page,
}) => {
  const db = await open(page, (d) => {
    Object.assign(d.me, { payday: null, payday_none: true });
    d.checklists.length = 0;
  });
  // 2026-11-26 ‘빈 상태 A안’ 보충: 기간 없음은 줄만 빈 상태 → 줄은 묶음, 이름표 오른쪽 작은 회색 보조 버튼 “수입 입력하기”(→ W-20)
  // 2026-11-26 사용자 결정 ‘홈 상자 안은 작은 보조 버튼’: sm, 보이는 높이 32, 15/700, 줄 높이 56
  const row = page.getByRole('group', { name: '이번 달 월급 체크' });
  const moneyIn = row.getByRole('button', { name: '수입 입력하기' });
  await expect(moneyIn).toHaveClass(/hg-btn--secondary/);
  await expect(moneyIn).toHaveClass(/hg-btn--sm/);
  expect(
    await moneyIn.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${Math.round(el.getBoundingClientRect().height)}/${s.fontSize}/${s.fontWeight}`;
    }),
  ).toBe('32/15px/700');
  // 누르는 칸은 44 이상(::after)
  expect(
    await moneyIn.evaluate((el) => parseFloat(getComputedStyle(el, '::after').height)),
  ).toBeGreaterThanOrEqual(44);
  expect(Math.round((await row.boundingBox())?.height ?? 0)).toBe(56);
  // 이름표 왼쪽, 버튼 오른쪽 한 줄
  const nameBox = await row.locator('.hg-hubbox__name').boundingBox();
  const btnBox = await moneyIn.boundingBox();
  expect((btnBox?.x ?? 0) > (nameBox?.x ?? 0) + (nameBox?.width ?? 0)).toBe(true);
  await expect(page.getByRole('button', { name: /^이번 달 월급 체크/ })).toHaveCount(0);
  await axe(page);
  await row.getByRole('button', { name: '수입 입력하기' }).click();
  await expect(page).toHaveURL(/\/salary\/money-in(\?|$)/);
  await page.goto('/');
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
  await expect(monthLine(page)).toContainText('마지막 수입 41일 전');
});

test('월급날 확인 목록 기간(v2.2, W-05 화면은 2026-11-15 없앰): 월급 상자 첫 줄 “4개 남음” + 할 일 띠 5b, 누르면 월급 탭 W-02, 남은 손 줄만(자동 줄 없음), ‘이번 달은 건너뛸게요’', async ({
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
  await expect(monthLine(page)).toContainText('4개 남음');
  expect(await homeTaskTexts(page)).toContain('9월 25일 월급에서 확인할 게 4개 남았어요');
  await monthLine(page).click();
  await expect(page).toHaveURL(/\/salary$/);
  // 2026-11-19 한 목록: 자동 줄도 같은 목록에(보조 줄 “자동으로 나가요”), 큰 숫자·보조 줄은 남은 손 줄과 별개로 전체 줄 수
  await expect(page.locator('.hg-transfer', { hasText: '고정지출' })).toContainText(
    '자동으로 나가요',
  );
  await axe(page);
  await page.locator('.hg-transfer__open', { hasText: '청약' }).click();
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
    // 월급날 확인할 게 없게(띠 5b가 맨 앞에서 띠를 “할 일 2개”로 묶지 않게)
    for (const l of lines(d)) Object.assign(l, { state: 'checked', checked_by: chanwoo.id });
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

test('각자 계열 묶음(찬우·예빈): 묶음이 맨 앞, 합계 + 문장 한 줄(각자 금액 줄은 홈 칸에 없음, 2026-11-26 C안), 멈춤 문장, 퍼센트만이면 % 하나', async ({
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
  await expect(together(page).locator('.hg-together__owners .hg-avatar')).toHaveCount(2);
  await expect(first).toHaveAccessibleName(
    '같이 모으기, 결혼 비용, 31,000,000원, 목표 금액의 62%, 2027년 5월까지 19,000,000원 더 필요해요',
  );
  // 2026-11-26 C안: 칸 = 이름표(묶음 이름) + 합계 + 문장 한 줄. 각자 금액 줄·“둘이 모은 금액” 줄은 칸에서 뺌(각자 금액은 W-10 묶음 카드)
  await expect(first.locator('.hg-together__name')).toHaveText('결혼 비용');
  await expect(first.locator('.hg-together__amount')).toHaveText('31,000,000원');
  await expect(first.locator('.hg-together__say')).toHaveText('목표까지 19,000,000원 남았어요');
  await expect(first).not.toContainText('찬우 21,000,000원');
  await expect(first).not.toContainText('둘이 모은 금액');
  await axe(page);
  // 해제 대기(멈춤): 문장은 “같이 모으기를 잠시 멈췄어요”
  Object.assign(db.v22?.bundles[0] ?? {}, { paused: true });
  await page.reload();
  await expect(first.locator('.hg-together__say')).toHaveText('같이 모으기를 잠시 멈췄어요');
  Object.assign(db.v22?.bundles[0] ?? {}, { paused: false });
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
  // 퍼센트만: 금액 자리 “62%”만, 문장 없음(2026-11-26), 기한(달만)은 화면 읽기에만
  await expect(first.locator('.hg-together__say')).toHaveCount(0);
  await expect(first).toHaveAccessibleName('같이 모으기, 결혼 비용, 62%, 2027년 5월까지');
  await expect(first).not.toContainText('원');
});

test('한 사람 관리형 관리하지 않는 쪽: 월급 상자 첫 줄 “자동으로 정해져요”, W-01 보내기 줄은 자물쇠 + “월급 − 용돈”', async ({
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
  await expect(monthLine(page)).toContainText('자동으로 정해져요');
  await page.goto('/salary/plan');
  const send = page.locator('.hg-receipt__row', { hasText: '보내기' });
  await expect(send).toContainText('월급 − 용돈');
  await expect(send).toContainText('자동');
  await expect(send.locator('.hg-receipt__lock')).toHaveCount(1);
  await expect(send.getByRole('button')).toHaveCount(0);
  await axe(page);
});

test('W-01 줄 설정(7a): 체크리스트에 넣기 끄기, 은행에서 자동으로 보내요 + 나가는 날 → 바로 저장 + 되돌리기, 보조 줄 “27일 자동”', async ({
  page,
}) => {
  const db = await open(page, undefined, NOW, '/salary/plan');
  await page.getByRole('button', { name: '고정지출 880,000원' }).click();
  const sheet = page.getByRole('dialog', { name: '고정지출 금액' });
  // 2026-11-23: 스위치 둘 대신 ‘어떻게 챙겨요?’ 구간 선택(지출 줄은 세 칸)
  await expect(sheet.getByRole('radio')).toHaveCount(3);
  await expect(sheet.getByRole('radio', { name: '월급날 확인' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await sheet.getByRole('radio', { name: '자동으로 나가요' }).click();
  await sheet.getByRole('button', { name: '다음 날' }).click();
  await axe(page);
  // 나가는 날은 한 줄 → 1~31 + 말일 칸 시트(2026-11-26 휠에서 바꿈). 시트 위의 시트: Esc는 위 시트만 닫음
  await page.getByRole('button', { name: '나가는 날, 매달 26일' }).click();
  const day = page.getByRole('dialog', { name: '나가는 날' });
  await expect(day.getByRole('radio', { name: '26', exact: true })).toBeChecked();
  await axe(page);
  await page.keyboard.press('Escape');
  await expect(day).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: '나가는 날, 매달 26일' }).click();
  await page
    .getByRole('dialog', { name: '나가는 날' })
    .getByRole('radio', { name: '27', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: '나가는 날' })
    .getByRole('button', { name: '매달 27일로 하기' })
    .click();
  await expect(sheet.getByRole('button', { name: '나가는 날, 매달 27일' })).toBeVisible();
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(page.locator('.hg-toast')).toContainText('고정지출 설정을 바꿨어요');
  expect(db.v22?.calls.at(-1)?.body).toEqual({
    p_items: [{ id: 'split-1-line-2', in_checklist: true, auto_pay: true, auto_day: 27 }],
  });
  await expect(page.locator('.hg-receipt__row', { hasText: '고정지출' })).toContainText(
    '27일 자동',
  );
  // 저금 줄 시트에는 ‘확인 안 해요’가 없음(늘 목록에 넣음)
  await page.goto('/salary/plan?line=goal-e'); // W-10 ‘매달 금액 바꾸기’로 그 저금 줄 시트를 엶
  await expect(page.getByRole('dialog', { name: '청약 금액' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '확인 안 해요' })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(2);
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
  await expect(tile).toContainText('30,000,000원');
  // 홈의 오렌지 포인트 상자는 자산 관리 타일 하나뿐(2026-11-17)
  await expect(page.locator('.hg-hubtile--point')).toHaveCount(1);
  await expect(tile).toHaveClass(/hg-hubtile--point/);
  await expect(page.getByRole('button', { name: /^캘린더/ })).not.toHaveClass(/--point/);
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
  // 할 일 띠 1번(해제 요청)은 맨 위 띠가 대신함(월급날 확인 5b 띠만 남음)
  expect((await homeTaskTexts(page)).join()).not.toContain('연결 해제');
  await axe(page);
});

test('월급 상자 오류(S4-01): 확인 목록을 못 불러오면 첫 줄 “잠시 문제가 생겼어요” + 누르면 다시 시도, 월급이 0원이어도 ‘월급 알려 주기’ 없이 평소 줄', async ({
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
  await expect(monthLine(page)).toContainText('잠시 문제가 생겼어요', { timeout: 30_000 });
  await expect(monthLine(page)).toContainText('다시 시도');
  await expect(page.getByText('월급 알려 주기')).toHaveCount(0);
  await axe(page);
  fail = false;
  await monthLine(page).click();
  await expect(monthLine(page)).toContainText('5개 남음');
  Object.assign(db.me, { monthly_income: 0, payday: null });
  db.splits.length = 0;
  db.checklists.length = 0;
  await page.reload();
  await expect(monthLine(page)).toContainText('첫 월급날부터');
  await expect(page.getByText('월급 알려 주기')).toHaveCount(0);
  await expect(page.getByText('월급 0원')).toBeVisible();
});

test('Realtime(S4-02): 파트너가 합류하면 초대 띠가 사라지고 H-10 내 저금 칸은 내 Avatar 하나', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  expect(await homeTaskTexts(page)).toContain('같이 모을 사람을 초대해 보세요');
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
  // 각자 계열의 묶이지 않은 내 저금 칸은 내 얼굴만(2026-11-14 ‘묶기 전 두 얼굴’), 묶음·공동 저금 칸이 둘
  await expect(together(page).locator('.hg-together__owners .hg-avatar')).toHaveCount(1);
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
  await expect(monthLine(c)).toContainText('5개 남음');
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
  await expect(monthLine(c)).toContainText('1개 남음');
  await cCtx.close();
  await yCtx.close();
});

test('한 사람 관리형(찬우 관리): 예빈 홈은 자동 문장, W-02는 찬우 줄을 “찬우님이 확인해요” 묶음으로 보기만, 주 버튼 없음(UX B H2)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const cdb = await mockOnboarding(page, { now: NOW });
  seed(cdb);
  Object.assign(cdb.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    salary_mode: 'joint',
    joint_cycle_day: 25,
    manager_user_id: chanwoo.id,
  });
  for (const sp of cdb.splits) sp.owner_user_id = null;
  for (const ch of cdb.checklists) ch.owner_user_id = null;
  for (const g of cdb.goals) g.owner_user_id = null;
  Object.assign(cdb, {
    me: { ...cdb.me, ...PARTNER, space_id: 'space-1', onboarding_done_at: '2026-10-02T00:00:00Z' },
    partner: { id: chanwoo.id, nickname: '찬우', monthly_income: 3_500_000, payday: 25 },
    v22: emptyV22(),
  });
  await page.goto('/');
  await expect(monthLine(page)).toContainText('자동으로 정해져요');
  await page.goto('/salary');
  // 2026-11-23: 관리하는 사람(찬우)의 손 줄은 “찬우님이 확인해요” 묶음에 보기만(점·› 없이 상태만, 보조 줄 “대기”)
  const group = page.getByRole('region', { name: '찬우님이 확인해요' });
  await expect(group).toBeVisible();
  await expect(group.locator('.hg-transfer', { hasText: '고정지출' })).toBeVisible();
  await expect(group.locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(group.getByText('대기').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await axe(page);
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

test('위젯 분석(32 4-7, PR 14): 이 기기에서 처음 본 위젯만 widget_added, 위젯을 누르면 widget_tapped + 그 화면', async ({
  page,
}) => {
  await fakeBridge(page, {
    signedIn: true,
    pin: null,
    widgets: [
      { widget: 'wg01', size: 'medium' },
      { widget: 'wg04', size: 'small' },
    ],
  });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  const ev = events(page);
  const added = () => ev.filter((e) => e.name === 'widget_added').map((e) => e.props);
  await open(page);
  await expect.poll(added).toEqual([
    { widget: 'wg01', size: 'medium', amounts_shown: false },
    { widget: 'wg04', size: 'small', amounts_shown: false },
  ]);
  // 다시 열어도 같은 위젯은 다시 보내지 않음
  await page.reload();
  await expect(together(page).locator('.hg-together__slide').first()).toBeVisible();
  // WG-04를 눌러 캘린더로(앱이 켜져 있음)
  await page.evaluate(() =>
    (window as unknown as { __fbcb: { navigate: (x: [string, unknown]) => void } }).__fbcb.navigate(
      ['/calendar', { widget: 'wg04', appWasRunning: true }],
    ),
  );
  await expect(page).toHaveURL(/\/calendar/);
  await expect
    .poll(() => ev.find((e) => e.name === 'widget_tapped')?.props)
    .toEqual({ widget: 'wg04', element: 'card', landing_screen: 'Y-04', app_was_running: true });
  expect(added()).toHaveLength(2);
});

test('H-14 이번 달 우리 둘은 홈에서 없앰(2026-11-17): 서버 카드가 있어도 안 그리고 부르지도 않음', async ({
  page,
}) => {
  const asked: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('month_us_card')) asked.push(r.url());
  });
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    d.partner = { id: 'p-yebin', nickname: '예빈', monthly_income: 2_700_000, payday: 10 };
    if (d.v22)
      d.v22.monthUs = {
        id: '00000000-0000-4000-8000-0000000000c1',
        sent_on: '2026-10-06',
        month_key: '2026-10',
        saved_total: 15_000_000,
        saved_delta: 1_000_000,
        saving_count: 2,
        hidden: false,
        care: [{ name: '어머니 생신', on: '2026-10-20' }],
        care_count: 1,
        allowance: 300_000,
      };
  });
  await expect(salaryBox(page)).toBeVisible();
  await expect(page.getByText('이번 달 우리 둘')).toHaveCount(0);
  expect(asked).toEqual([]);
});

const top = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);

test('홈 순서(2026-11-17, 2026-11-20 고정): 같이 모으기가 0원이어도 같이 모으기가 월급 상자 위, 월급 상자 줄 이름은 메뉴 서랍과 같고 반 칸 타일은 자산 관리·캘린더', async ({
  page,
}) => {
  await open(page);
  await expect(together(page)).toBeVisible();
  const narrow = (page.viewportSize()?.width ?? 1280) < 1100;
  if (narrow) {
    expect(await top(page, '.hg-together')).toBeLessThan(await top(page, '.hg-hubbox'));
    expect(await top(page, '.hg-hubbox')).toBeLessThan(await top(page, '.hg-hubtile'));
  }
  await expect(page.locator('.hg-hubbox__name')).toHaveText([
    '이번 달 월급 체크',
    '월급 계획 템플릿',
  ]);
  await expect(page.locator('.hg-hubtile')).toHaveText([/^자산 관리/, /^캘린더/]);
  await expect(page.locator('.hg-hubline')).toHaveCount(0);
  await axe(page);
});

test('홈 순서(2026-11-17): 모은 금액이 있으면 같이 모으기 → 월급 상자 → 타일 둘', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.goals.find((g) => g.id === 'goal-h') ?? {}, { start_saved: 5_000_000 });
  });
  await expect(together(page)).toContainText('5,000,000원');
  const narrow = (page.viewportSize()?.width ?? 1280) < 1100;
  if (narrow) {
    expect(await top(page, '.hg-together')).toBeLessThan(await top(page, '.hg-hubbox'));
    expect(await top(page, '.hg-hubbox')).toBeLessThan(await top(page, '.hg-hubtile'));
  }
  await axe(page);
});
