import { test, expect, type Page } from '@playwright/test';
import { emptyV22, type MemDb, mockOnboarding, seed } from './mocks';

// W-02 이번 달 월급 체크: 체크리스트가 화면 맨 위(20 W-02 0번, 2026-11-18).
// 순서: 제목 줄 → (회색 한 줄) → 체크리스트 → ‘수입’ 묶음(+ 수입 적기). 머리 링크 두 개와 체크리스트 안 ‘+ 추가’는 없음(2026-11-18 사용자 결정).
const y = async (loc: ReturnType<Page['locator']>) => {
  const box = await loc.first().boundingBox();
  expect(box).not.toBeNull();
  return box?.y ?? 0;
};

async function open(page: Page, now: Date, prep?: (db: MemDb) => void) {
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.v22 = emptyV22();
  prep?.(db);
  await page.goto('/salary');
  return db;
}

test('월급날 확인이 남은 달: 제목 → 체크리스트 → 수입 묶음 순서, 머리 링크·‘+ 추가’ 없음', async ({
  page,
}) => {
  await open(page, new Date('2026-10-07T10:00:00+09:00'));
  const title = page.getByRole('heading', { name: '9월 25일 월급' });
  await expect(title).toBeVisible();
  const first = page.locator('.hg-transfer').first();
  await expect(first).toBeVisible();
  const income = page.getByRole('region', { name: '수입' });
  await expect(income).toBeVisible();
  await expect(income.getByRole('button', { name: '수입 적기' })).toBeVisible();
  // 머리 링크 두 개와 ‘+ 추가’ 없음, 저축·투자 묶음 머리는 W-01로 가는 이동
  await expect(page.getByRole('link', { name: '월급 계획 템플릿' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '지난 달 모아보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /추가/ })).toHaveCount(0);
  // 이번 달이면 › 숨김, 지난 달이 없으면 ‹도 숨김(2026-11-18)
  await expect(page.getByRole('button', { name: '다음 달 보기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '지난 달 보기', exact: true })).toHaveCount(0);
  expect(await y(title)).toBeLessThan(await y(first));
  expect(await y(first)).toBeLessThan(await y(income));
  // 주 버튼은 체크리스트 아래, 수입 묶음 위
  const confirm = page.getByRole('button', { name: '모두 계획대로 됐어요' });
  expect(await y(first)).toBeLessThan(await y(confirm));
  expect(await y(confirm)).toBeLessThan(await y(income));
});

test('첫 월급날 전: 제목 줄(‹ › 없음) → 회색 한 줄 → 미리 보기(체크 불가) → 수입 묶음', async ({
  page,
}) => {
  await open(page, new Date('2026-10-20T10:00:00+09:00'), (d) => {
    d.checklists.length = 0;
    if (d.v22) d.v22.noRetro = true;
    Object.assign(d.splits[0] ?? {}, { checklist_from: '2026-10-15' });
    Object.assign(d.me, { onboarding_done_at: '2026-10-15T00:00:00Z' });
  });
  const title = page.getByRole('heading', { name: '10월 23일 월급' });
  await expect(title).toBeVisible();
  const note = page.getByText('10월 23일 첫 월급날에 확인해요');
  await expect(note).toBeVisible();
  const rows = page.locator('.hg-list--preview .hg-transfer');
  await expect(rows.first()).toBeVisible();
  // 체크 불가(회색 원)
  await expect(rows.first().getByRole('checkbox')).toBeDisabled();
  const income = page.getByRole('region', { name: '수입' });
  await expect(income.getByRole('button', { name: '수입 적기' })).toBeVisible();
  // 회색 카드는 없고 ‘수입 적기’는 수입 묶음 안 하나뿐
  await expect(page.getByRole('button', { name: '수입 적기' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: '월급 계획 템플릿' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '지난 달 모아보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /추가/ })).toHaveCount(0);
  // 미리 보기에는 제목 옆 ‹ ›가 없음
  await expect(page.getByRole('button', { name: '지난 달 보기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음 달 보기', exact: true })).toHaveCount(0);
  expect(await y(title)).toBeLessThan(await y(note));
  expect(await y(note)).toBeLessThan(await y(rows));
  expect(await y(rows)).toBeLessThan(await y(income));
});
