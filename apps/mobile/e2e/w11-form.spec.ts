import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fillAmount, foldAmount, pickName } from './form';
import { mockOnboarding, seed } from './mocks';
import { pickDay } from './wheel';

// W-11 저축·투자 추가 한 화면 입력(2026-11-23, FormScreen): 필수 비활성, 직접 정하기, 자동으로 나가요 + 나가는 날, 칩 미리 고름
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

test('필수가 비면 추가하기 비활성, 1만 원 단위, 직접 정하기는 이름 칸, 요약 문장', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 2026-11-26: 월급을 넘는 매달 금액은 입력에서 막힘(06 3-3). 시드는 미계획 0원이라 월급을 늘려 둠
  Object.assign(db.me, { monthly_income: 5_000_000 });
  await page.goto('/salary/items/new');
  const add = page.getByRole('button', { name: '추가하기' });
  await expect(add).toBeDisabled();
  // 이름 칸은 ‘직접 정하기’를 누르기 전엔 없음
  await expect(page.getByLabel('이름', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '직접 정하기', exact: true }).click();
  await expect(page.getByLabel('이름', { exact: true })).toBeFocused();
  await page.getByLabel('이름', { exact: true }).fill('운동');
  await expect(add).toBeDisabled(); // 금액이 아직
  await fillAmount(page, '매달 얼마씩?', 15000);
  await expect(page.getByText('1만 원 단위로 넣어 주세요')).toBeVisible();
  await expect(add).toBeDisabled();
  await fillAmount(page, '매달 얼마씩?', 10000);
  await expect(add).toBeEnabled();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    '운동에 매달 10,000원씩 모을까요?',
  );
  // 금액 자리만 오렌지(accent), 이름 자리는 ink
  const val = page.locator('.hg-form__val');
  await expect(val).toHaveText('10,000원');
  await axe(page);
});

test('자동으로 나가요 → 나가는 날(월급날 / 다음 날 / 한 줄 + 일 칸 시트) → 새 줄에 자동 설정', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 2026-11-26: 월급을 넘는 매달 금액은 입력에서 막힘(06 3-3). 시드는 미계획 0원이라 월급을 늘려 둠
  Object.assign(db.me, { monthly_income: 5_000_000 });
  await page.goto('/salary/items/new');
  await page.getByRole('button', { name: '여행', exact: true }).click();
  await fillAmount(page, '매달 얼마씩?', 100000);
  // 월급날 확인(처음 값)일 때는 안내 한 줄, 나가는 날은 안 보임
  await expect(page.getByText('자동으로 나가면 그날 앱이 알아서 완료로 바꿔요')).toBeVisible();
  await expect(page.getByRole('group', { name: '나가는 날 고르기' })).toHaveCount(0);
  await page.getByRole('radio', { name: '자동으로 나가요' }).click();
  await expect(page.getByRole('radio', { name: '자동으로 나가요' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const days = page.getByRole('group', { name: '나가는 날 고르기' });
  await expect(days.getByRole('button', { name: '월급날' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await days.getByRole('button', { name: '다음 날' }).click();
  await expect(page.getByRole('button', { name: '나가는 날, 매달 26일' })).toBeVisible();
  // 한 줄 → 1~31 + 말일 칸 시트(2026-11-26 휠에서 바꿈): 키보드로 옮기면 바로 고름, 주 버튼으로 확정
  await page.getByRole('button', { name: '나가는 날, 매달 26일' }).click();
  const dlg = page.getByRole('dialog', { name: '나가는 날' });
  await expect(dlg.getByRole('radio', { name: '26', exact: true })).toBeChecked();
  await dlg.getByRole('radio', { name: '26', exact: true }).press('ArrowRight');
  await expect(dlg.getByRole('radio', { name: '27', exact: true })).toBeChecked();
  await axe(page);
  await dlg.getByRole('button', { name: '매달 27일로 하기' }).click();
  await expect(page.getByRole('button', { name: '나가는 날, 매달 27일' })).toBeVisible();
  await pickDay(page, '나가는 날', 'last');
  await expect(page.getByRole('button', { name: '나가는 날, 매달 말일' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/salary\/plan/);
  const call = db.v22?.calls.find((c) => 'p_items' in (c.body as Record<string, unknown>));
  expect(call?.body).toMatchObject({ p_items: [{ auto_pay: true, auto_day: 31 }] });
  // 다시 월급날 확인으로 돌리면 나가는 날 칸이 사라짐
  await page.goto('/salary/items/new');
  await page.getByRole('button', { name: '비상금', exact: true }).click();
  await page.getByRole('radio', { name: '자동으로 나가요' }).click();
  await page.getByRole('radio', { name: '월급날 확인' }).click();
  await expect(page.getByRole('group', { name: '나가는 날 고르기' })).toHaveCount(0);
});

test('진입점: 빈 묶음 이름 칩은 그 이름을 미리 고르고, 직접 정하기는 이름 칸이 열림', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.length = 0;
  const sp = db.splits[0];
  if (sp) sp.split_line = [];
  await page.goto('/salary/plan');
  await page.getByRole('button', { name: '비상금', exact: true }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new\?from=split$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    '비상금에 매달 얼마씩 모을까요?',
  );
  await expect(page.getByLabel('이름', { exact: true })).toHaveCount(0);
  await page.goBack();
  await page.getByRole('button', { name: '직접 정하기', exact: true }).first().click();
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('');
});

test('선택 항목 접힌 줄: 목표 금액을 정하면 기한 줄이 생기고 지우면 사라짐', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/items/new');
  await pickName(page, '여행', true);
  await foldAmount(page, '목표 금액', 3000000);
  await expect(page.getByRole('button', { name: /^목표 금액,/ })).toContainText('3,000,000원');
  await expect(page.getByRole('button', { name: /^기한,/ })).toBeVisible();
  await page.getByRole('button', { name: /^목표 금액,/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '목표 금액 지우기' }).click();
  await expect(page.getByRole('button', { name: /^목표 금액,/ })).toContainText('정하기');
  await expect(page.getByRole('button', { name: /^기한,/ })).toHaveCount(0);
});
