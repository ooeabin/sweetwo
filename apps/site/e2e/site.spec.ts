import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';

// 웹사이트 L-01·02·03·05·06과 초대 링크(docs/spec/28-website.md).
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const WIN7 =
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

/** 바깥 주소(다운로드, 웹 앱)는 흉내: 받은 요청을 셈 */
async function outside(page: Page) {
  const hits: string[] = [];
  await page.route('https://download.sweetwo.kr/**', (r) => {
    hits.push(r.request().url());
    return r.fulfill({ status: 204 });
  });
  await page.route('https://app.sweetwo.kr/**', (r) => {
    hits.push(r.request().url());
    return r.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>웹 앱</title><h1>웹 앱</h1>',
    });
  });
  return hits;
}

test.describe('Mac', () => {
  test.use({ userAgent: MAC });
  test('L-01 랜딩: 제목, Mac용 다운로드, 다른 OS용 받기, 자주 묻는 질문, 하단', async ({
    page,
  }) => {
    await outside(page);
    await page.goto('/');
    await expect(page).toHaveTitle('sweeTwo | 함께 구워 더 달콤한 자산파이');
    await expect(
      page.getByRole('heading', { level: 1, name: '함께 구워 더 달콤한 자산파이' }),
    ).toBeVisible();
    const hero = page.locator('[data-download]').first();
    await expect(hero.getByRole('link', { name: 'Mac용 다운로드' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Windows용 다운로드' })).toBeHidden();
    await hero.getByRole('button', { name: '다른 OS용 받기' }).click();
    await expect(hero.getByRole('link', { name: 'Windows용 다운로드' })).toBeVisible();
    await expect(
      page.getByText('macOS 12 이상, Windows 10 64비트 이상에서 쓸 수 있어요').first(),
    ).toBeVisible();
    await expect(page.getByText('직접 입력해요, 계좌를 연결하지 않아요')).toBeVisible();
    const q = page.getByRole('button', { name: '계좌를 연결하지 않나요?' });
    await q.click();
    await expect(q).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/계좌·카드 연동 없이 직접 입력해요/)).toBeVisible();
    await expect(page.getByRole('link', { name: '개인정보처리방침' })).toHaveClass(/is-strong/);
    await expect(
      page.getByText(
        'sweeTwo는 입력한 숫자로 계산한 참고 정보를 보여드려요. 투자·금융 자문이 아니에요',
      ),
    ).toBeVisible();
    await axe(page);
  });

  test('L-02 설치 안내: 받기 시작, 3단계, 보안 경고 접기, 새로고침하면 다시 받지 않음', async ({
    page,
  }) => {
    const hits = await outside(page);
    await page.goto('/');
    await page
      .locator('[data-download]')
      .first()
      .getByRole('link', { name: 'Mac용 다운로드' })
      .click();
    await expect(page.getByRole('heading', { name: '다운로드를 시작했어요' })).toBeVisible();
    await expect.poll(() => hits.filter((h) => h.includes('/latest/mac')).length).toBe(1);
    await expect(page.getByText('dmg 파일을 열어요')).toBeVisible();
    await expect(page.getByText('설치 파일을 실행해요')).toBeHidden();
    await page.getByRole('button', { name: '보안 경고가 뜨나요?' }).click();
    await expect(page.getByText(/그래도 열기/)).toBeVisible();
    await expect(
      page.getByText('앱에서 로그인하면 웹에서 쓰던 기록이 그대로 있어요'),
    ).toBeVisible();
    await axe(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: '다운로드를 시작했어요' })).toBeVisible();
    await page.waitForTimeout(300);
    expect(hits.filter((h) => h.includes('/latest/mac')).length).toBe(1);
    await page.getByRole('button', { name: '다시 받기' }).click();
    await expect.poll(() => hits.filter((h) => h.includes('/latest/mac')).length).toBe(2);
  });

  test('초대 링크: 앱을 받은 브라우저면 앱으로 열까요', async ({ page }) => {
    await outside(page);
    await page.addInitScript(() => localStorage.setItem('sweetwo-app-seen', '1'));
    await page.goto('/i/K7M2QX');
    await expect(page.getByRole('heading', { name: 'sweeTwo 앱으로 열까요?' })).toBeVisible();
    await expect(page.getByRole('link', { name: '앱으로 열기' })).toHaveAttribute(
      'href',
      'sweetwo://i/K7M2QX',
    );
    await expect(page.getByRole('link', { name: '웹에서 계속하기' })).toHaveAttribute(
      'href',
      'https://app.sweetwo.kr/i/K7M2QX',
    );
    await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeHidden();
    await axe(page);
  });
});

test.describe('Windows', () => {
  test.use({ userAgent: WIN });
  test('Windows용 다운로드, 설치 안내는 Windows 단계', async ({ page }) => {
    await outside(page);
    await page.goto('/');
    await expect(
      page.locator('[data-download]').first().getByRole('link', { name: 'Windows용 다운로드' }),
    ).toBeVisible();
    await page.goto('/download?os=win');
    await expect(page.getByText('시작 메뉴에서 sweeTwo를 열어요')).toBeVisible();
    await page.getByRole('button', { name: '보안 경고가 뜨나요?' }).click();
    await expect(page.getByText(/SmartScreen/)).toBeVisible();
  });
});

test.describe('Windows 7', () => {
  test.use({ userAgent: WIN7 });
  test('지원하지 않는 OS: 안내 + 웹에서 시작하기', async ({ page }) => {
    await outside(page);
    await page.goto('/');
    const hero = page.locator('[data-download]').first();
    await expect(
      hero.getByText('이 기기에서는 앱을 쓸 수 없어요. 웹에서 시작할 수 있어요'),
    ).toBeVisible();
    await expect(hero.getByRole('link', { name: '웹에서 시작하기' })).toBeVisible();
  });
});

test.describe('휴대폰', () => {
  test.use({ userAgent: IPHONE });
  test('웹에서 시작하기 + 설치 안내 1줄, 초대 링크는 바로 웹 앱', async ({ page }) => {
    await outside(page);
    await page.goto('/?utm_source=insta');
    const hero = page.locator('[data-download]').first();
    await expect(hero.getByText('Mac이나 Windows에서 설치할 수 있어요')).toBeVisible();
    const web = hero.getByRole('link', { name: '웹에서 시작하기' });
    await expect(web).toHaveAttribute('href', /utm_source=insta/);
    await page.goto('/i/K7M2QX');
    await expect(page).toHaveURL('https://app.sweetwo.kr/i/K7M2QX');
  });
});

test('L-03 릴리스 노트, L-05 약관(시행일), L-06 고객센터 검색', async ({ page }) => {
  await outside(page);
  await page.goto('/releases');
  await expect(page).toHaveTitle('릴리스 노트 - sweeTwo');
  await expect(page.getByRole('heading', { name: 'sweeTwo 릴리스 노트' })).toBeVisible();
  await expect(page.locator('#\\31 \\.0\\.0')).toContainText('새 기능');
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: '이용약관', level: 1 })).toBeVisible();
  await expect(page.getByText('시행일 2026년 11월 1일')).toBeVisible();
  await axe(page);
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: '개인정보처리방침', level: 1 })).toBeVisible();
  await page.goto('/help');
  await expect(page).toHaveTitle('고객센터 - sweeTwo');
  await expect(page.getByRole('heading', { name: '둘이 쓰기' })).toBeVisible();
  await page.getByLabel('궁금한 걸 검색해 보세요').fill('초대');
  await expect(page.getByRole('button', { name: '배우자는 어떻게 초대하나요?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '기기와 보안' })).toBeHidden();
  await page.getByLabel('궁금한 걸 검색해 보세요').fill('우주여행');
  await expect(page.getByText('찾는 답이 없어요. 메일로 물어봐 주세요')).toBeVisible();
  await axe(page);
});
