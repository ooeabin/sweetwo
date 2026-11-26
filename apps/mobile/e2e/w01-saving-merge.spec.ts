import { test, expect, type Page } from '@playwright/test';
import { fillAmount, pickName } from './form';
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

test('W-01 저축·투자 묶음: 줄마다 매달 금액 + 모은 금액 + 목표 금액 진행(0%면 막대 없음), 줄 › → W-10', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/plan#saving');
  const group = page.getByRole('region', { name: '저축·투자', exact: true });
  const home = group.getByRole('button', { name: /^내 집 마련/ });
  await expect(home).toContainText('950,000원');
  // 2026-11-19: 모은 금액이 0원이면 “모은 금액 0원”을 빼고 “목표 금액 …”만
  await expect(home).not.toContainText('모은 금액');
  await expect(home).toContainText('목표 금액');
  await expect(home).toHaveAccessibleName(
    '내 집 마련 매달 950,000원, 모은 금액 0원, 목표 금액의 0%',
  );
  // 목표 금액이 없는 저금은 모은 금액만(막대·% 없음)
  const sub = group.getByRole('button', { name: /^청약/ });
  await expect(sub).not.toContainText('모은 금액');
  await expect(sub).not.toContainText('목표 금액');
  // 2026-11-26 사용자 결정: 목표 진행이 0%면 막대를 그리지 않음(보조 줄 “목표 금액 …”은 그대로)
  await expect(group.locator('.hg-receipt__progbar')).toHaveCount(0);
  // W-10으로 가는 줄은 금액 오른쪽 ›
  await expect(home.locator('.hg-receipt__go')).toBeVisible();
  await axe(page);
  await home.click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
});

test('W-02 ↔ W-01: W-02 머리 링크 없음, 구간 탭 없음, 저금 묶음 머리 없음(2026-11-19), ‹ = 건너온 화면', async ({
  page,
}, info) => {
  await open(page);
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '이번 달 월급 체크', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: '계획' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '월급 계획 템플릿' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '지난 달 모아보기' })).toHaveCount(0);
  if (info.project.name === 'narrow') {
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
  // 2026-11-19: W-02에는 저금 묶음 머리가 없음(저축·투자 묶음은 W-01에서만)
  await page.goto('/salary');
  await expect(page.getByRole('button', { name: '저축·투자 목록 보기' })).toHaveCount(0);
});

test('W-11 만들기 → W-01 저축·투자 묶음: 새 줄 강조 + Toast, 첫 질문 안내 줄은 없음', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/items/new?from=split');
  // 2026-11-18: 첫 질문 안내 줄은 뺌(미리 보기 단계 W-11f도 없앰)
  await expect(
    page.getByText('매달 월급에서 이만큼 떼어 둬요. 월급 계획 템플릿에 들어가요'),
  ).toHaveCount(0);
  await pickName(page, '제주 여행');
  await fillAmount(page, '매달 얼마씩?', 10000);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/salary\/plan/);
  // 시드는 미계획 금액이 모자라 “모자라요” Toast(addShort), 넉넉하면 ‘월급 계획 템플릿에 넣었어요’
  await expect(page.locator('.hg-toasts')).toBeVisible();
  const fresh = page.locator('.hg-receipt__row.is-new');
  await expect(fresh).toContainText('제주 여행');
  await expect(fresh).toContainText('10,000원');
  // 미합류라 초대 물음 시트가 W-01에서 열림(2026-11-18, 예전엔 W-10)
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  // 잠깐 강조라 곧 사라짐, 줄은 남음
  await expect(fresh).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByRole('button', { name: /^제주 여행/ })).toBeVisible();
});
