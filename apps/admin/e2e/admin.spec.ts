import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// 어드민(27 어드민 화면): 매직 링크 + 인증 앱, 대시보드, 회원 검색·상세(L0·L1), 문의 답변·동의 요청, 감사 로그, 문서.
// 가짜 Supabase(http://127.0.0.1:54399). 관리자 cs01(CS), ops01(운영).

const SB = 'http://127.0.0.1:54399';
const ADMIN = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'cs01@sweetwo.kr' };
const CHANWOO = '11111111-1111-1111-1111-111111111111';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (aal: 'aal1' | 'aal2') =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: ADMIN.id,
    role: 'authenticated',
    aud: 'authenticated',
    aal,
    amr:
      aal === 'aal2'
        ? [
            { method: 'otp', timestamp: 1 },
            { method: 'totp', timestamp: 2 },
          ]
        : [{ method: 'otp', timestamp: 1 }],
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`;
const user = {
  id: ADMIN.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: ADMIN.email,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-10-01T00:00:00Z',
  factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'sweeTwo 어드민' }],
};
const session = (aal: 'aal1' | 'aal2') => ({
  access_token: jwt(aal),
  refresh_token: 'rt',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
});

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();

interface Db {
  rpc: { fn: string; body: Record<string, unknown> }[];
  roles: string[];
  inquiryStatus: string;
  messages: { author: string; body: string; created_at: string }[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });

async function mock(page: Page, o: { aal?: 'aal1' | 'aal2' | null; roles?: string[] } = {}) {
  const db: Db = {
    rpc: [],
    roles: o.roles ?? ['cs'],
    inquiryStatus: 'received',
    messages: [{ author: 'user', body: '연결이 안 돼요', created_at: '2026-10-17T01:00:00Z' }],
  };
  const aal = o.aal === undefined ? 'aal2' : o.aal;
  if (aal) {
    await page.addInitScript(
      (s) => {
        localStorage.setItem('sweetwo.keep-login', '1');
        localStorage.setItem('sb-session', s);
      },
      JSON.stringify(session(aal)),
    );
  }
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS')
      return route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      });
    const url = new URL(req.url());
    const p = url.pathname;
    const body = () => (req.postData() ? (req.postDataJSON() as Record<string, unknown>) : {});
    if (p === '/auth/v1/otp') return json(route, {});
    if (p === '/auth/v1/user') return json(route, user);
    if (p === '/auth/v1/factors/f1/challenge')
      return json(route, { id: 'c1', type: 'totp', expires_at: 9999999999 });
    if (p === '/auth/v1/factors/f1/verify') {
      if (body().code !== '123456')
        return json(route, { code: 'invalid', msg: 'Invalid TOTP code' }, 422);
      return json(route, session('aal2'));
    }
    if (p === '/auth/v1/logout')
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (!p.startsWith('/rest/v1/rpc/')) return json(route, { message: `e2e: ${p}` }, 404);
    const fn = p.slice('/rest/v1/rpc/'.length);
    db.rpc.push({ fn, body: body() });
    switch (fn) {
      case 'admin_me':
        return json(route, {
          email: ADMIN.email,
          name: 'cs01',
          roles: db.roles,
          mfa: true,
          last_seen_at: '2026-10-18T00:00:00Z',
        });
      case 'admin_dashboard':
        return json(route, {
          inquiries: { received: 3, in_progress: 1 },
          failed: { plans: 0, notifications: 2 },
          at: '2026-10-18T05:00:00Z',
        });
      case 'admin_inquiry_counts':
        return json(route, {
          received: db.inquiryStatus === 'received' ? 1 : 0,
          in_progress: 0,
          waiting_user: db.inquiryStatus === 'waiting_user' ? 1 : 0,
          done: 0,
        });
      case 'admin_search': {
        const q = String(body().p_q);
        return json(
          route,
          q === 'chanwoo@example.com' || q === 'A-10001'
            ? [
                {
                  user_id: CHANWOO,
                  email_masked: 'cha***@example.com',
                  created_at: '2026-10-01T00:00:00Z',
                  couple_state: 'connected',
                  subscription: '무료',
                },
              ]
            : [],
        );
      }
      case 'admin_user_detail':
        return json(route, {
          user_id: CHANWOO,
          email_masked: 'cha***@example.com',
          provider: 'kakao',
          created_at: '2026-10-01T00:00:00Z',
          last_sign_in_at: '2026-10-17T10:00:00Z',
          status: 'active',
          deletion_requested_at: null,
          space_id: 'space-1',
          couple_state: 'connected',
          marriage_status: 'married',
          partner_id: '22222222-2222-2222-2222-222222222222',
          subscription: '무료',
          invites: [
            {
              created_at: '2026-10-01T00:00:00Z',
              expires_at: '2026-10-08T00:00:00Z',
              used_at: '2026-10-02T00:00:00Z',
            },
          ],
          consents: [{ kind: 'terms', version: 'v1', agreed: true, at: '2026-10-01T00:00:00Z' }],
          counts: { assets: 6, assets_estimated: 2, goals: 3, closes: 1 },
          plan_status: 'splitting',
          sessions: 2,
          access: [],
        });
      case 'admin_reveal':
        return json(route, { email: 'chanwoo@example.com' });
      case 'admin_inquiries':
        return json(
          route,
          body().p_status === db.inquiryStatus
            ? [
                {
                  id: 'q1',
                  no: 'A-10001',
                  category: 'couple',
                  status: db.inquiryStatus,
                  channel: 'app',
                  user_id: CHANWOO,
                  created_at: '2026-10-16T00:00:00Z',
                  updated_at: '2026-10-16T00:00:00Z',
                },
              ]
            : [],
        );
      case 'admin_inquiry':
        return json(route, {
          id: 'q1',
          no: 'A-10001',
          category: 'couple',
          status: db.inquiryStatus,
          channel: 'app',
          user_id: CHANWOO,
          created_at: '2026-10-16T00:00:00Z',
          done_at: null,
          attach: { app_version: '1.0.0', os: 'mac' },
          messages: db.messages,
          access: [],
        });
      case 'admin_answer_inquiry':
        db.inquiryStatus = String(body().p_status);
        db.messages.push({
          author: 'admin',
          body: String(body().p_body),
          created_at: '2026-10-18T01:00:00Z',
        });
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      case 'admin_request_access':
        return json(route, 'acc-1');
      case 'admin_audit_rows':
        return json(route, [
          {
            id: 2,
            at: '2026-10-18T05:05:00Z',
            admin_id: ADMIN.id,
            admin_email: ADMIN.email,
            action: 'reveal',
            screen: 'AD-04',
            target: CHANWOO,
            reason: '본인 확인',
            detail: { inquiry: 'A-10001', scopes: ['email'] },
            approver: null,
            ip: '10.0.0.1',
          },
          {
            id: 1,
            at: '2026-10-18T05:00:00Z',
            admin_id: ADMIN.id,
            admin_email: ADMIN.email,
            action: 'search',
            screen: 'AD-02',
            target: null,
            reason: null,
            detail: { q_kind: 'email' },
            approver: null,
            ip: '10.0.0.1',
          },
        ]);
      default:
        return json(route, { message: `e2e: 모르는 함수 ${fn}` }, 404);
    }
  });
  return db;
}

test('로그인: 회사 이메일로 링크 받기', async ({ page }) => {
  const db = await mock(page, { aal: null });
  await page.goto('/');
  await heading(page, 'sweeTwo 어드민');
  await page.getByLabel('회사 이메일').fill('cs01@sweetwo.kr');
  await axe(page);
  await page.getByRole('button', { name: '로그인 링크 받기' }).click();
  await expect(page.getByText('메일함에서 링크를 눌러 주세요')).toBeVisible();
  expect(db.rpc).toEqual([]);
});

test('2단계 인증: 인증 앱 숫자를 넣어야 들어감', async ({ page }) => {
  await mock(page, { aal: 'aal1' });
  await page.goto('/');
  await heading(page, '인증 앱의 6자리 숫자를 넣어 주세요');
  await page.getByLabel('6자리 숫자').fill('000000');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('숫자가 맞지 않아요. 다시 넣어 주세요')).toBeVisible();
  await page.getByLabel('6자리 숫자').fill('123456');
  await page.getByRole('button', { name: '확인' }).click();
  await heading(page, '대시보드');
});

test('대시보드 → 회원 검색(정확히 일치, 1건이면 상세) → L1 이메일 보기', async ({ page }) => {
  const db = await mock(page);
  await page.goto('/');
  await heading(page, '대시보드');
  await expect(page.getByRole('region', { name: '실패 건수' })).toContainText('알림 발송 실패2');
  await expect(page.getByRole('link', { name: /미처리 문의/ })).toContainText('접수3');
  await axe(page);

  await page.getByRole('link', { name: '회원' }).click();
  await page.getByLabel('이메일, 사용자 ID, 문의 번호로 찾기').fill('chanwoo');
  await page.getByRole('button', { name: '보기' }).click();
  await expect(page.getByText('일치하는 회원이 없어요')).toBeVisible();
  await page.getByLabel('이메일, 사용자 ID, 문의 번호로 찾기').fill('chanwoo@example.com');
  await page.getByRole('button', { name: '보기' }).click();

  await heading(page, '회원 상세');
  await expect(page.getByText('cha***@example.com')).toBeVisible();
  await expect(page.getByText('자산 6개, 그중 추정 2개, 목표 3개, 정리한 달 1번')).toBeVisible();
  await expect(page.locator('.hg-admin__main')).not.toContainText(/\d+원|만 원/);
  await axe(page);
  await page.getByRole('button', { name: '개인정보 보기' }).click();
  const l1 = page.getByRole('region', { name: 'L1 사유 입력' });
  await expect(l1.getByRole('button', { name: '보기' })).toBeDisabled();
  await l1.getByLabel('문의 번호').fill('A-10001');
  await l1.getByRole('button', { name: '보기' }).click();
  await expect(page.getByText('chanwoo@example.com')).toBeVisible();
  expect(db.rpc.find((r) => r.fn === 'admin_reveal')?.body).toMatchObject({
    p_inquiry_no: 'A-10001',
    p_scopes: ['email'],
    p_reason: '본인 확인',
  });
});

test('문의 처리: 탭, 오래된 문의 강조, 답변 보내면 사용자 답변 대기, 동의 요청', async ({
  page,
}) => {
  const db = await mock(page);
  await page.goto('/inquiries');
  await heading(page, '문의');
  const row = page.getByRole('row', { name: /A-10001/ });
  await expect(row).toContainText('부부 연결');
  await expect(row.locator('b')).toHaveText(/일 \d+시간/);
  await axe(page);
  await row.click();
  await heading(page, 'A-10001 부부 연결');
  await expect(page.getByText('연결이 안 돼요')).toBeVisible();
  await expect(page.getByRole('region', { name: '자동 첨부' })).toContainText('1.0.0');
  await page.getByRole('textbox', { name: '답변' }).fill('초대 코드를 다시 받아 주세요');
  await page.getByRole('button', { name: '답변 보내기' }).click();
  await expect(page.getByText('답변을 보냈어요')).toBeVisible();
  expect(db.inquiryStatus).toBe('waiting_user');

  const ask = page.getByRole('region', { name: '동의 요청' });
  await ask.getByRole('button', { name: '월 수입·지출 화면' }).click();
  await ask.getByLabel('사유').fill('계산 확인');
  await axe(page);
  await ask.getByRole('button', { name: '동의 요청 보내기' }).click();
  await expect(page.getByText('동의를 요청했어요')).toBeVisible();
  expect(db.rpc.find((r) => r.fn === 'admin_request_access')?.body).toMatchObject({
    p_inquiry: 'q1',
    p_scopes: ['income_spend'],
    p_raw: false,
  });
});

test('감사 로그와 문서', async ({ page }) => {
  await mock(page);
  await page.goto('/audit');
  await heading(page, '감사 로그');
  await expect(page.getByRole('row', { name: /열람/ })).toContainText('본인 확인');
  // 최고 관리자가 아니면 관리자 필터 없음
  await expect(page.getByLabel('관리자', { exact: true })).toHaveCount(0);
  await page.getByRole('row', { name: /열람/ }).click();
  await expect(page.getByText('접속 IP: 10.0.0.1')).toBeVisible();
  await axe(page);

  await page.getByRole('link', { name: '문서' }).click();
  await page.getByLabel('문서 검색').fill('어드민 화면');
  await page.getByRole('button', { name: '어드민 화면' }).click();
  await expect(page.getByRole('heading', { name: 'AD-06 문의 처리' })).toBeVisible();
});

test('운영 역할: 회원 상세에 열람·조치 버튼 없음', async ({ page }) => {
  await mock(page, { roles: ['ops'] });
  await page.goto(`/members/${CHANWOO}`);
  await heading(page, '회원 상세');
  await expect(page.getByRole('button', { name: '개인정보 보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '계정 조치' })).toHaveCount(0);
});
