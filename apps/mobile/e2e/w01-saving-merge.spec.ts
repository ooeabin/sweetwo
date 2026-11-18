import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, seed } from './mocks';

// 2026-11-18: 월급 탭 구간 탭 없앰(W-02 `/salary`, W-01 `/salary/plan`), 저금 목록 W-13을 W-01 ‘저축·투자’ 묶음으로 합침.
// 옛 주소 넘김, 묶음 안 모은 금액·진행, 줄 → W-10, 머리 링크와 뒤로.
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  return db;
}

test('옛 주소 넘김: /salary?view=plan(who·line 유지), /salary/split, /salary/items(?from 유지)', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary?view=plan');
  await expect(page).toHaveURL(/\/salary\/plan$/);
  await page.goto('/salary?view=plan&who=yebin');
  await expect(page).toHaveURL(/\/salary\/plan\?who=yebin$/);
  await page.goto('/salary?view=plan&line=goal-h');
  await expect(page.getByRole('dialog', { name: '내 집 마련 금액' })).toBeVisible();
  await page.goto('/salary/split');
  await expect(page).toHaveURL(/\/salary\/plan$/);
  await page.goto('/salary/items?from=home');
  await expect(page).toHaveURL(/\/salary\/plan\?from=home#saving$/);
  await page.goto('/salary/items');
  await expect(page).toHaveURL(/\/salary\/plan#saving$/);
  await expect(page.getByRole('heading', { name: '월급 계획 템플릿', level: 1 })).toBeVisible();
});

test('W-01 저축·투자 묶음: 줄마다 매달 금액 + 모은 금액 + 목표 금액 진행, 줄 → W-10', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/plan#saving');
  const group = page.getByRole('region', { name: '저축·투자', exact: true });
  const home = group.getByRole('button', { name: /^내 집 마련/ });
  await expect(home).toContainText('매달 95만 원');
  await expect(home).toContainText('모은 금액 0원');
  await expect(home).toContainText('목표 금액의 0%');
  await expect(home).toHaveAccessibleName('내 집 마련 매달 95만 원, 모은 금액 0원, 목표 금액의 0%');
  // 목표 금액이 없는 저금은 모은 금액만(막대·% 없음)
  const sub = group.getByRole('button', { name: /^청약/ });
  await expect(sub).toContainText('모은 금액 0원');
  await expect(sub).not.toContainText('목표 금액의');
  await expect(group.locator('.hg-receipt__progbar')).toHaveCount(1);
  await axe(page);
  await home.click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
});

test('W-02 ↔ W-01: 머리 링크, 구간 탭 없음, 저금 묶음 머리 → 저축·투자 묶음, ‹ = 건너온 화면', async ({
  page,
}, info) => {
  await open(page);
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '이번 달 월급 체크', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveCount(0);
  await page.getByRole('link', { name: '월급 계획 템플릿' }).click();
  await expect(page).toHaveURL(/\/salary\/plan$/);
  await expect(page.getByRole('heading', { name: '월급 계획 템플릿', level: 1 })).toBeVisible();
  if (info.project.name === 'narrow') {
    // ‹ = W-02(링크로 열었으니)
    await page.getByRole('button', { name: '홈으로' }).click();
    await expect(page).toHaveURL(/\/salary$/);
    // 홈에서 W-01을 열면 ‹ = 홈
    await page.goto('/');
    await page.getByRole('button', { name: '메뉴' }).click();
    await page
      .getByRole('dialog', { name: '메뉴' })
      .getByRole('button', { name: '월급 계획 템플릿', exact: true })
      .click();
    await page.getByRole('button', { name: '홈으로' }).click();
    await expect(page).toHaveURL(/\/$/);
  }
  // W-02 저금 묶음 머리 ‘저축·투자 ›’ → W-01 묶음(주소 #saving)
  await page.goto('/salary');
  await page.getByRole('button', { name: '저축·투자 목록 보기' }).click();
  await expect(page).toHaveURL(/\/salary\/plan\?from=checklist#saving$/);
});

test('W-11 만들기 → W-01 저축·투자 묶음: 새 줄 강조 + Toast, 첫 질문 안내 한 줄', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/items/new/a?from=split');
  await expect(
    page.getByText('매달 월급에서 이만큼 떼어 둬요. 월급 계획 템플릿에 들어가요'),
  ).toBeVisible();
  await page.getByRole('textbox').first().fill('제주 여행');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('매달 얼마씩 모을까요?').fill('10000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '아니요, 직접 보내요' }).click();
  await page.getByRole('button', { name: '목표 금액 없이 모을게요' }).click();
  await expect(page).toHaveURL(/\/salary\/plan/);
  // 시드는 미계획 금액이 모자라 “모자라요” Toast(addShort), 넉넉하면 ‘월급 계획 템플릿에 넣었어요’
  await expect(page.locator('.hg-toasts')).toBeVisible();
  const fresh = page.locator('.hg-receipt__row.is-new');
  await expect(fresh).toContainText('제주 여행');
  await expect(fresh).toContainText('매달 1만 원');
  // 미합류라 초대 물음 시트가 W-01에서 열림(2026-11-18, 예전엔 W-10)
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  // 잠깐 강조라 곧 사라짐, 줄은 남음
  await expect(fresh).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByRole('button', { name: /^제주 여행/ })).toBeVisible();
});
