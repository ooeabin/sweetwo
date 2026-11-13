import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { axe as runAxe } from './axe';

// 웹사이트 L-01·02·03·05·06과 초대 링크(docs/spec/28-website.md).
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

/** 바깥 주소(예전 다운로드, 웹 앱)는 흉내: 받은 요청을 셈 */
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

test.describe('PC', () => {
  test.use({ userAgent: MAC });
  test('L-01 랜딩: 제목, 스토어 2개(데스크톱 다운로드 없음), 자주 묻는 질문, 하단', async ({
    page,
  }) => {
    await outside(page);
    await page.goto('/');
    await expect(page).toHaveTitle('sweeTwo | 둘이 구워서 더 달콤한 자산파이');
    await expect(
      page.getByRole('heading', { level: 1, name: '둘이 구워서 더 달콤한 자산파이' }),
    ).toBeVisible();
    const hero = page.locator('[data-download]').first();
    await expect(hero.getByRole('link', { name: 'App Store에서 받기' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Google Play에서 받기' })).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=kr.sweetwo.app',
    );
    // 2026-11-10 데스크톱 앱 없앰(ADR 0008)
    await expect(page.getByRole('link', { name: /Mac용 다운로드|Windows용 다운로드/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: '다른 OS용 받기' })).toHaveCount(0);
    // 상단 ‘앱 받기’는 맨 아래 앱 받기로
    await expect(page.getByRole('link', { name: '앱 받기' })).toHaveAttribute('href', '/#get');
    await expect(page.getByText('월급 계획과 체크리스트')).toBeVisible();
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

  test('L-02 앱 받기(/download): 파일을 받지 않고 스토어 2개, 예전 ?os= 주소도 같음', async ({
    page,
  }) => {
    const hits = await outside(page);
    await page.goto('/download?os=mac');
    await expect(page.getByRole('heading', { level: 1, name: '앱 받기' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'App Store에서 받기' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Google Play에서 받기' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '다운로드를 시작했어요' })).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(hits.filter((h) => h.includes('download.sweetwo.kr'))).toEqual([]);
    await axe(page);
  });

  test('초대 링크: PC는 코드 + 스토어 2개, ‘앱으로 열까요?’ 없음', async ({ page }) => {
    await outside(page);
    await page.addInitScript(() => localStorage.setItem('sweetwo-app-seen', '1'));
    await page.goto('/i/K7M2QX');
    await expect(page.getByRole('heading', { name: 'sweeTwo에 초대받았어요' })).toBeVisible();
    await expect(page.getByText('K7M2QX', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'sweeTwo 앱으로 열까요?' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'App Store에서 받기' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Google Play에서 받기' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeHidden();
    await axe(page);
  });
});

test.describe('Windows', () => {
  test.use({ userAgent: WIN });
  test('Windows도 스토어 2개', async ({ page }) => {
    await outside(page);
    await page.goto('/');
    const hero = page.locator('[data-download]').first();
    await expect(hero.getByRole('link', { name: 'App Store에서 받기' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Google Play에서 받기' })).toBeVisible();
  });
});

test.describe('휴대폰', () => {
  test.use({ userAgent: IPHONE });
  test('iPhone: App Store 하나, 상단 앱 받기 = 스토어, 초대 링크는 코드 + 스토어', async ({
    page,
  }) => {
    await outside(page);
    await page.goto('/?utm_source=insta');
    const hero = page.locator('[data-download]').first();
    await expect(hero.getByRole('link', { name: 'App Store에서 받기' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Google Play에서 받기' })).toBeHidden();
    await expect(hero.getByText('Mac이나 Windows에서도 같은 계정으로 쓸 수 있어요')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '앱 받기' })).toHaveAttribute(
      'href',
      'https://apps.apple.com/kr/',
    );
    await page.goto('/i/K7M2QX');
    await expect(page.getByRole('heading', { name: 'sweeTwo에 초대받았어요' })).toBeVisible();
    await expect(page.getByText('앱을 설치한 뒤 이 코드를 입력해 주세요')).toBeVisible();
    await expect(page.getByText('K7M2QX', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'sweeTwo 앱으로 열까요?' })).toBeHidden();
    await axe(page);
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
  // 시행 중인 판의 시행일(새 판이 시행되면 날짜가 바뀌므로 형식만 확인, 2026-11-11)
  await expect(page.getByText(/^시행일 \d{4}년 \d{1,2}월 \d{1,2}일/).first()).toBeVisible();
  await axe(page);
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: '개인정보처리방침', level: 1 })).toBeVisible();
  await page.goto('/help');
  await expect(page).toHaveTitle('고객센터 - sweeTwo');
  await expect(page.getByRole('heading', { name: '둘이 쓰기' })).toBeVisible();
  await page.getByLabel('궁금한 걸 검색해 보세요').fill('초대');
  await expect(page.getByRole('button', { name: '파트너는 어떻게 초대하나요?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '기기와 보안' })).toBeHidden();
  await page.getByLabel('궁금한 걸 검색해 보세요').fill('우주여행');
  await expect(page.getByText('찾는 답이 없어요. 메일로 물어봐 주세요')).toBeVisible();
  await axe(page);
});

test('로그인 복귀 페이지(A-03 5번): 앱이면 code와 state만 sweetwo://로, 주소창에 code가 남지 않음', async ({
  page,
}) => {
  await page.addInitScript(() => Object.assign(window, { __sweetwoE2E: true }));
  await page.goto('/auth/callback?from=app&state=st_1&code=co-2&next=https://evil.example');
  await expect(page.getByRole('heading', { name: '로그인을 마쳤어요' })).toBeVisible();
  const open = page.getByRole('link', { name: 'sweeTwo 열기' });
  await expect(open).toHaveAttribute('href', 'sweetwo://auth/callback?state=st_1&code=co-2');
  expect(page.url()).not.toContain('code=');
  await axe(page);
  await page.goto('/auth/callback?from=app&state=<x>&code=a');
  await expect(page.getByRole('link', { name: 'sweeTwo 열기' })).toBeHidden();
});

// QA 12구간(2026-11-12)
test('L-01 머리(S12-09·10): canonical, og:url·type, 메타 설명, 파비콘 32·48·apple-touch-icon', async ({
  page,
  request,
}) => {
  await outside(page);
  await page.goto('/?utm_source=insta');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://sweetwo.kr/',
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://sweetwo.kr/',
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /^둘이 구워서 더 달콤한 자산파이\. /,
  );
  for (const [sel, href] of [
    ['link[rel="icon"][sizes="32x32"]', '/favicon-32.png'],
    ['link[rel="icon"][sizes="48x48"]', '/favicon-48.png'],
    ['link[rel="apple-touch-icon"]', '/apple-touch-icon.png'],
  ] as const) {
    await expect(page.locator(sel)).toHaveAttribute('href', href);
    expect((await request.get(href)).status()).toBe(200);
  }
  await page.goto('/help');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://sweetwo.kr/help/',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'sweeTwo 자주 묻는 질문을 찾아보고, 답이 없으면 메일로 물어볼 수 있어요',
  );
});

test('L-01(S12-01·12·13): 좁은 창 가로 스크롤 없음, 기능 2열 2줄, 사업자 정보는 값이 없으면 숨김', async ({
  page,
}) => {
  await outside(page);
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const cols = await page
    .locator('.hg-site__cols')
    .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
  await expect(page.getByText('[확인 필요]')).toHaveCount(0);
  await expect(page.locator('footer')).not.toContainText('사업자등록번호');
  // 하단 메일 링크는 토큰 색(ink-2), 브라우저 기본 파랑 아님
  const mail = page.getByRole('link', { name: '고객센터 help@sweetwo.kr' });
  const [link, ink2] = await mail.evaluate((e) => [
    getComputedStyle(e).color,
    getComputedStyle(document.querySelector('.hg-site__links a') as Element).color,
  ]);
  expect(link).toBe(ink2);
});

test('다크 모드(S12-03): 기기 설정을 따라 바탕이 어두워짐', async ({ page }, info) => {
  await outside(page);
  await page.goto('/');
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number);
  const light = ((r ?? 0) + (g ?? 0) + (b ?? 0)) / 3 > 128;
  if (info.project.name === 'dark') {
    expect(theme).toBe('dark');
    expect(light).toBe(false);
    // 그림 카드는 다크에서도 흰 카드
    const art = await page
      .locator('.hg-site__art')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(art).toBe('rgb(255, 255, 255)');
  } else {
    expect(theme).toBe('light');
    expect(light).toBe(true);
  }
  await axe(page);
});

test('초대 링크(S12-05): /i/는 코드 없이 안내 + 초대 제목, /i/{코드}는 _redirects로 200', async ({
  page,
}) => {
  await outside(page);
  await page.goto('/i/');
  await expect(page).toHaveTitle('sweeTwo에 초대받았어요');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'sweeTwo에 초대받았어요',
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'sweeTwo에 초대받았어요' }),
  ).toBeVisible();
  await expect(page.getByText('앱을 설치한 뒤 받은 초대 코드를 입력해 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '복사' })).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await axe(page);
  // astro preview는 _redirects를 모름: 빌드에 규칙이 있는지 확인(실제 200은 Cloudflare)
  const rules = readFileSync(new URL('../dist/_redirects', import.meta.url), 'utf8');
  expect(rules).toMatch(/^\/i\/\* \/i\/ 200$/m);
  await page.goto('/i/K7M2QX');
  await expect(page).toHaveTitle('sweeTwo에 초대받았어요');
  await expect(page.getByText('앱을 설치한 뒤 이 코드를 입력해 주세요')).toBeVisible();
});

test('L-05(S12-04·07): 시행일 YYYY-MM-DD, ?v= 이전 판, 개인정보처리방침 v2 시행', async ({
  page,
}) => {
  await outside(page);
  await page.goto('/privacy');
  await expect(page.getByText('시행일 2026년 11월 12일')).toBeVisible();
  await expect(page.getByRole('link', { name: /2026년 11월 1일/ })).toHaveAttribute(
    'href',
    '/privacy?v=2026-11-01',
  );
  await page.goto('/privacy?v=2026-11-01');
  await expect(page.getByText('시행일 2026년 11월 1일')).toBeVisible();
  await expect(page.getByText('시행일 2026년 11월 12일')).toBeHidden();
  await expect(page.getByRole('link', { name: '지금 버전 보기' })).toBeVisible();
  // 예전 링크 형식(ISO 시각)도 그 날짜 판
  await page.goto('/terms?v=2026-11-01T00:00:00.000Z');
  await expect(page.getByText('시행일 2026년 11월 1일')).toBeVisible();
  await axe(page);
});

test('L-03(S12-11): 버전 h2, 묶음 h3(제목 단계를 건너뛰지 않음)', async ({ page }) => {
  await page.goto('/releases');
  await expect(page.getByRole('heading', { level: 2, name: /1\.0\.0/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: '새 기능' }).first()).toBeVisible();
  expect(await page.locator('h4').count()).toBe(0);
});
