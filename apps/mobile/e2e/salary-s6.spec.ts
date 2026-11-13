import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { mockRealtime } from './realtime-mock';
import { seed } from './seed-home';
import { chanwoo } from './supabase-mock';

// QA 6구간(2026-11-12): W-02 다 끝난 달 한 줄(W-02 끝 없앰), 상대가 끝내도 이동 없음, 달성 되돌린 뒤 같은 화면 다시 축하,
// W-02a Toast·되돌리기·뒤로, W-05 그 체크리스트만(옛 링크·기간 밖·끝난 사이클), W-05 Realtime 강조.
// 찬우 350만 원 25일, 9월 월급(9.25 ~ 10.24): 청약 44만·내 집 마련 95만·고정지출 88만·생활비 88만·용돈 35만
const NOW = new Date('2026-10-07T10:00:00+09:00');
const REVIEW = new Date('2026-10-22T20:30:00+09:00');
type Line = Record<string, unknown>;
const linesOf = (db: MemDb) => db.checklists[0]?.pay_check_line as Line[];
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
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
/** 합쳐서 모드(공동 체크리스트, 누구나 체크) */
function joint(db: MemDb) {
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
}
const byYebin = (l: Line | undefined, state = 'checked') =>
  l &&
  Object.assign(l, {
    state,
    checked_by: state === 'wait' ? null : 'yebin',
    checked_at: state === 'wait' ? null : '2026-10-07T01:00:00Z',
  });

async function open(page: Page, now = NOW, prep?: (db: MemDb) => void) {
  await page.clock.setFixedTime(now);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now });
  seed(db);
  prep?.(db);
  return { db, rt };
}

test('합쳐서: 상대가 마지막 줄을 끝내도 이동 없음, 막대 아래 한 줄만 바뀜(Toast 없음), 바뀐 줄은 2초 강조', async ({
  page,
}) => {
  const { db, rt } = await open(page, NOW, joint);
  linesOf(db)
    .slice(0, 4)
    .forEach((l) => Object.assign(l, { state: 'checked', checked_by: chanwoo.id }));
  await page.goto('/salary');
  await expect(page.locator('.hg-checkgroup').first()).toBeVisible();
  await expect.poll(() => rt.subscribed('pay_check_line')).toBeGreaterThan(0);
  const last = linesOf(db)[4];
  byYebin(last);
  rt.emit('pay_check_line', 'UPDATE', { id: last?.id, space_id: 'space-1', state: 'checked' });
  await expect(page.locator('.hg-planbar__title')).toHaveText('9월 25일 월급, 계획대로 됐어요');
  await expect(page.locator('.hg-transfer.is-changed')).toHaveCount(1);
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.locator('.hg-toast')).toHaveCount(0);
  await expect(page.locator('.hg-transfer.is-changed')).toHaveCount(0, { timeout: 4000 });
});

test('달성 되돌린 뒤 같은 화면에서 다시 체크하면 다시 W-12(배경 있음), W-12a 고른 뒤 W-02로', async ({
  page,
}) => {
  const { db } = await open(page);
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  Object.assign(home, { target_amount: 950_000, deadline: null });
  await page.goto('/salary');
  const box = page.getByRole('checkbox', { name: /내 집 마련/ });
  await box.click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h\/achieved\?from=checklist$/);
  // 축하 배경(2026-11-12 D5)
  await expect(page.locator('main.hg-qmain.hg-celebrate-bg')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/salary$/);
  // 체크를 풀어 목표 금액 아래로 → 모으는 중(배지도 바로 사라짐)
  await box.click();
  await expect.poll(() => home.status).toBe('active');
  await expect(box).toHaveAttribute('aria-checked', 'false');
  // 새로 고치지 않고 다시 체크 → 다시 축하
  await box.click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h\/achieved\?from=checklist$/);
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '계속 모을게요' }).click();
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.getByText('목표 금액을 지우고 계속 모아요')).toBeVisible();
  // 이제 달성이 아니면 W-12 주소는 저금 상세로
  await page.goto('/salary/items/goal-h/achieved');
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
});

test('W-02a 다른 금액: 저장하면 Toast + 되돌리기, 0원은 못 함 Toast, 빈 칸이면 다음을 못 누름, 뒤로는 W-02', async ({
  page,
}) => {
  const { db } = await open(page);
  await page.goto('/salary');
  const living = () => linesOf(db).find((l) => l.kind === 'living');
  await page.getByRole('button', { name: /^생활비/ }).click();
  await page.getByRole('button', { name: '다른 금액으로 했어요' }).click();
  await expect(page.getByRole('heading', { name: '생활비, 이번 달은 얼마였어요?' })).toBeVisible();
  // 하드웨어(브라우저) 뒤로 = W-02
  await page.goBack();
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  await expect(page).toHaveURL(/\/salary$/);
  await page.getByRole('button', { name: /^생활비/ }).click();
  await page.getByRole('button', { name: '다른 금액으로 했어요' }).click();
  const input = page.getByRole('textbox', { name: '얼마를 보냈어요?' });
  await input.fill('');
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await input.fill('700000');
  await expect(page.getByText('계획보다 18만 원 적어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '9월 25일 월급' })).toBeVisible();
  const toast = page.locator('.hg-toast');
  await expect(toast).toContainText('체크했어요');
  await expect.poll(() => living()?.actual).toBe(700_000);
  await toast.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => living()?.state).toBe('wait');
  // 0원 = 못 함 + Toast
  await page.getByRole('button', { name: /^청약/ }).click();
  await page.getByRole('button', { name: '다른 금액으로 했어요' }).click();
  await page.getByRole('textbox', { name: '얼마를 보냈어요?' }).fill('0');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('.hg-toast')).toContainText('청약, 이번 달은 건너뛰었어요');
  await expect.poll(() => linesOf(db)[0]?.state).toBe('skipped');
  await expect(page.getByRole('checkbox', { name: '청약 건너뜀' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

test('W-05 그 체크리스트만: 옛 링크는 지금 것, 기간 밖은 W-02, 끝난 사이클은 W-02 그 달', async ({
  page,
}) => {
  // 기간 밖(10월 7일): 옛 링크도 id 링크도 W-02
  await open(page);
  await page.goto('/salary/review');
  await expect(page).toHaveURL(/\/salary$/);
  await page.goto('/salary/review?checklist=checklist-1');
  await expect(page).toHaveURL(/\/salary$/);
});

test('W-05 기간 안: 옛 링크(/salary/review)와 id 링크, 끝난 사이클 알림은 W-02 지난 달, 시트에 다른 금액·저금 보기, 체크한 줄은 남음', async ({
  page,
}) => {
  const { db } = await open(page, REVIEW, (d) => {
    const cur = d.checklists[0] as Line;
    d.checklists.push({
      ...cur,
      id: 'checklist-past',
      label: '8월 월급',
      cycle_start: '2026-08-25',
      cycle_end: '2026-09-24',
      state: 'closed',
      pay_check_line: (cur.pay_check_line as Line[]).map((l) => ({
        ...l,
        id: `${String(l.id)}-p`,
        state: 'checked',
        checked_by: chanwoo.id,
        checked_at: '2026-08-26T01:00:00Z',
      })),
    });
  });
  await page.goto('/salary/review');
  await expect(
    page.getByRole('heading', { name: '9월 25일 월급, 확인할 게 남았어요' }),
  ).toBeVisible();
  await page.goto('/salary/review?checklist=checklist-1');
  await expect(
    page.getByRole('heading', { name: '9월 25일 월급, 확인할 게 남았어요' }),
  ).toBeVisible();
  // 시트: W-02와 같음(2026-11-12 D6)
  await page.getByRole('button', { name: /^내 집 마련/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: '계획대로 했어요', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '다른 금액으로 했어요' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '이번 달은 건너뛸게요' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '저금 보기' })).toHaveClass(/hg-btn--link/);
  await sheet.getByRole('button', { name: '계획대로 했어요', exact: true }).click();
  const box = page.getByRole('checkbox', { name: '내 집 마련 체크' });
  await expect(page.locator('.hg-toast')).toContainText('내 집 마련에 95만 원 더했어요');
  await expect(box).toHaveAttribute('aria-checked', 'true');
  await expect(box).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.hg-transfer')).toHaveCount(5);
  // 다시 누르면 풀림
  await box.click();
  await expect.poll(() => linesOf(db)[1]?.state).toBe('wait');
  // 지난 사이클을 가리키는 링크 → W-02 그 달(읽기 전용)
  await page.goto('/salary/review?checklist=checklist-past');
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.getByRole('heading', { name: '8월 25일 월급' })).toBeVisible();
});

test('W-05 Realtime(합쳐서): 상대가 체크하면 바로 바뀌고 2초 강조, 못 불러오면 다시 시도', async ({
  page,
}) => {
  const { db, rt } = await open(page, REVIEW, joint);
  await page.goto('/salary/review');
  await expect(
    page.getByRole('heading', { name: '9월 25일 월급, 확인할 게 남았어요' }),
  ).toBeVisible();
  await expect.poll(() => rt.subscribed('pay_check_line')).toBeGreaterThan(0);
  const fixed = linesOf(db).find((l) => l.kind === 'fixed');
  byYebin(fixed);
  rt.emit('pay_check_line', 'UPDATE', { id: fixed?.id, space_id: 'space-1', state: 'checked' });
  await expect(page.getByRole('checkbox', { name: '고정지출 체크' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('.hg-transfer.is-changed')).toContainText('고정지출');
  await expect(page.locator('.hg-transfer', { hasText: '고정지출' })).toContainText('예빈');

  // 못 불러오면 오류 + 다시 시도(S6-08)
  await page.route('**/rest/v1/pay_checklist*', (r) =>
    r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x"}' }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: '잠시 문제가 생겼어요' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('저금 묶음 끝 ‘+ 저금 추가’는 좁은 창만(넓은 창은 제목 줄 버튼, S6-16)', async ({
  page,
}, info) => {
  await open(page);
  await page.goto('/salary');
  await expect(page.locator('.hg-checkgroup').first()).toBeVisible();
  const row = page.locator('.hg-checkgroup .hg-addrow');
  const narrow = (info.project.use.viewport?.width ?? 1280) < 768;
  if (narrow) await expect(row).toBeVisible();
  else {
    await expect(row).toBeHidden();
    await expect(page.getByRole('button', { name: '+ 저금 추가' })).toBeVisible();
  }
});
