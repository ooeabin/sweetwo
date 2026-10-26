import { test, expect } from '@playwright/test';
import { axe } from './axe';
import { asReturningFromProvider, mockSupabase } from './supabase-mock';

// 로그인, 가입 흐름(docs/spec/15-login-signup.md). Supabase 응답은 흉내 낸다.

const noA11yViolations = async (page: import('@playwright/test').Page) => {
  const r = await axe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

test('첫 방문: O-01 → A-02', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '함께 구워 더 달콤한 자산파이' })).toBeVisible();
  await noA11yViolations(page);
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { name: '함께 구워 더 달콤한 자산파이' })).toBeVisible();
  for (const name of ['카카오로 3초 만에 시작하기', 'Google로 시작하기', 'Apple로 시작하기']) {
    await expect(page.getByRole('button', { name })).toBeEnabled();
  }
  await expect(page.getByRole('checkbox', { name: '이 기기에서 로그인 유지' })).toHaveCount(0);
  await noA11yViolations(page);
});

test('A-01: 최소 지원 버전 미만이면 업데이트 안내', async ({ page }) => {
  await mockSupabase(page, { minVersionWeb: '9.0.0' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '새 버전으로 업데이트해 주세요' })).toBeVisible();
  await page.getByRole('button', { name: '업데이트 없이 보기만 할게요' }).click();
  await expect(page.getByRole('heading', { name: '함께 구워 더 달콤한 자산파이' })).toBeVisible();
});

test('A-01: 점검 시간이면 점검 안내, 끝나는 시각', async ({ page }) => {
  const now = Date.now();
  await mockSupabase(page, {
    maintenance: {
      starts: new Date(now - 3_600_000).toISOString(),
      ends: '2099-01-01T06:00:00Z',
    },
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '지금 점검 중이에요' })).toBeVisible();
  await expect(page.getByText('15:00에 끝나요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await noA11yViolations(page);
});

test('신규 가입: 카카오 이메일 거부 → A-04 → A-05 → 온보딩 O-10', async ({ page }) => {
  let signup: Record<string, unknown> | undefined;
  await mockSupabase(page, {
    loginState: { state: 'new', needs_email: true },
    signup: (b) => (signup = b),
  });
  await asReturningFromProvider(page, 'kakao');
  await page.goto('/auth/callback?code=e2e-code');

  await expect(page.getByRole('heading', { name: '알림 받을 이메일을 알려주세요' })).toBeVisible();
  const next = page.getByRole('button', { name: '다음' });
  const email = page.getByLabel('알림 이메일');
  await email.fill('chanwoo@mail');
  await email.blur();
  await expect(page.getByText('이메일 주소를 다시 확인해 주세요')).toBeVisible();
  await expect(next).toBeDisabled();
  await email.fill(' ChanWoo@Mail.com ');
  await next.click();

  await expect(page.getByRole('checkbox', { name: '모두 동의해요' })).toBeVisible();
  const agree = page.getByRole('button', { name: '동의하고 계속하기' });
  await expect(agree).toBeDisabled();
  await page.getByRole('checkbox', { name: '[필수] 이용약관' }).click();
  await page.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용' }).click();
  await expect(agree).toBeDisabled();
  await page.getByRole('checkbox', { name: '[필수] 배우자와 부부 공간 공유' }).click();
  await expect(agree).toBeDisabled(); // 만 18세 확인도 필수(A-05 2a)
  await page.getByRole('checkbox', { name: '[필수] 만 18세 이상이에요' }).click();
  await expect(page.getByRole('checkbox', { name: '모두 동의해요' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await noA11yViolations(page);
  await agree.click();

  await expect(
    page.getByRole('heading', { name: '2분이면 우리의 첫 목표가 생겨요' }),
  ).toBeVisible();
  expect(signup).toMatchObject({
    p_provider: 'kakao',
    p_notify_email: 'chanwoo@mail.com',
    p_marketing: false,
  });
});

test('다른 소셜로 가입된 계정이면 막고 가입한 방법을 알려 준다', async ({ page }) => {
  await mockSupabase(page, { loginState: { state: 'provider_conflict', provider: 'kakao' } });
  await asReturningFromProvider(page, 'google');
  await page.goto('/auth/callback?code=e2e-code');
  await expect(page.getByText('이미 카카오로 가입한 이메일이에요')).toBeVisible();
  await expect(page.getByRole('button', { name: '카카오로 3초 만에 시작하기' })).toHaveClass(
    /hg-btn--primary/,
  );
});

test('제공자 화면에서 취소하면 A-02에 안내', async ({ page }) => {
  await mockSupabase(page);
  await asReturningFromProvider(page, 'kakao');
  await page.goto('/auth/callback?error=access_denied');
  await expect(page.getByText('로그인을 취소했어요')).toBeVisible();
});

test('데스크톱 로그인 복귀 페이지는 code와 state를 딥링크로 넘긴다', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/auth/callback?from=desktop&state=s1&code=c1');
  await expect(page.getByRole('heading', { name: '로그인을 마쳤어요' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'sweeTwo 열기' })).toHaveAttribute(
    'href',
    'sweetwo://auth/callback?state=s1&code=c1',
  );
});
