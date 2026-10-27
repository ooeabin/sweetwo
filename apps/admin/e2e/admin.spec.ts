import { test, expect, type Page, type Route } from '@playwright/test';
import { axe as runAxe } from './axe';

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
  const r = await runAxe(page);
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
  notices: Record<string, unknown>[];
  kindNames: Record<string, unknown>[];
  approvals: {
    id: string;
    kind: string;
    summary: string;
    payload: object;
    requested_by: string;
    requested_at: string;
    status: string;
    decided_by: string | null;
    decided_at: string | null;
  }[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
    headers: { 'Access-Control-Allow-Origin': '*' },
  });

async function mock(
  page: Page,
  o: { aal?: 'aal1' | 'aal2' | null; roles?: string[]; otpError?: string } = {},
) {
  const db: Db = {
    rpc: [],
    roles: o.roles ?? ['cs'],
    inquiryStatus: 'received',
    messages: [{ author: 'user', body: '연결이 안 돼요', created_at: '2026-10-17T01:00:00Z' }],
    notices: [],
    kindNames: [],
    approvals: [
      {
        id: 'ap0',
        kind: 'admin_add',
        summary: '관리자 추가: cs02@sweetwo.kr',
        payload: {},
        requested_by: 'boss2@sweetwo.kr',
        requested_at: '2026-10-17T00:00:00Z',
        status: 'requested',
        decided_by: null,
        decided_at: null,
      },
    ],
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
    if (p === '/auth/v1/otp')
      return o.otpError
        ? json(
            route,
            {
              code: 429,
              error_code: o.otpError,
              msg: 'For security purposes, you can only request this after 10 seconds.',
            },
            429,
          )
        : json(route, {});
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
    if (p === '/rest/v1/asset_kind_name') return json(route, db.kindNames);
    if (p === '/rest/v1/loan_rate')
      return json(route, [
        {
          kind: 'credit',
          rate_bp: 600,
          applied_on: '2026-10-01',
          updated_by: null,
          updated_at: '2026-10-01T00:00:00Z',
        },
        {
          kind: 'mortgage',
          rate_bp: 400,
          applied_on: '2026-10-01',
          updated_by: null,
          updated_at: '2026-10-01T00:00:00Z',
        },
      ]);
    if (p === '/rest/v1/holiday')
      return json(route, [{ date: '2026-12-25', name: '성탄절', kind: 'holiday' }]);
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
        // 부부 공간 ID: 두 사람
        if (q === 'space-1')
          return json(route, [
            {
              user_id: CHANWOO,
              email_masked: 'cha***@example.com',
              created_at: '2026-10-01T00:00:00Z',
              couple_state: 'connected',
              subscription: '무료',
            },
            {
              user_id: 'yebin-0000',
              email_masked: 'yeb***@example.com',
              created_at: '2026-10-03T00:00:00Z',
              couple_state: 'connected',
              subscription: '무료',
            },
          ]);
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
      case 'admin_note_export':
        return json(route, 'cs01@sweetwo.kr');
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
      case 'admin_account_action':
        return json(route, null);
      case 'admin_request_login_move':
        return body().p_new === 'nobody@example.com'
          ? json(route, { message: 'new_not_found' }, 400)
          : json(route, 'ap9');
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
      case 'admin_notices':
        return json(route, db.notices);
      case 'admin_save_notice': {
        const b = body();
        db.notices.push({
          id: `n${db.notices.length + 1}`,
          kind: b.p_kind,
          title: b.p_title,
          body: b.p_body,
          importance: b.p_importance,
          platforms: b.p_platforms,
          starts_at: b.p_starts_at,
          ends_at: b.p_ends_at,
          status: b.p_request ? 'requested' : 'draft',
          created_by: ADMIN.id,
          created_at: '2026-10-18T00:00:00Z',
          published_at: null,
        });
        if (b.p_request)
          db.approvals.push({
            id: `ap${db.approvals.length + 1}`,
            kind: 'notice_publish',
            summary: `공지 게시: ${String(b.p_title)}`,
            payload: {},
            requested_by: ADMIN.email,
            requested_at: '2026-10-18T00:00:00Z',
            status: 'requested',
            decided_by: null,
            decided_at: null,
          });
        return json(route, `n${db.notices.length}`);
      }
      case 'admin_set_notice_email': {
        const b = body();
        const n = db.notices.find((x) => x.id === b.p_id);
        if (n) n.email = b.p_email;
        return json(route, null);
      }
      case 'admin_approvals':
        return json(
          route,
          db.approvals.filter((a) => a.status === body().p_status),
        );
      case 'admin_decide': {
        const a = db.approvals.find((x) => x.id === body().p_id);
        if (a && a.requested_by === ADMIN.email && body().p_decision !== 'cancel')
          return json(route, { message: 'self_approval' }, 403);
        if (a)
          a.status =
            body().p_decision === 'approve'
              ? 'approved'
              : body().p_decision === 'reject'
                ? 'rejected'
                : 'cancelled';
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      case 'admin_content_versions':
        return json(route, [
          {
            id: 'cv1',
            kind: 'faq',
            key: 'couple',
            version: '1.0',
            effective_on: '2026-01-01',
            checked_on: '2026-01-01',
            note: null,
            created_by: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ]);
      case 'admin_terms_versions':
        return json(route, [
          {
            id: 't1',
            kind: 'terms',
            version: 'v1',
            effective_on: '2026-10-01',
            reconsent: false,
            legal_checked: true,
            status: 'approved',
            agreed: 1234,
          },
        ]);
      case 'admin_add_terms_version':
        return json(route, 't2');
      case 'admin_save_kind_name': {
        const b = body();
        const id = (b.p_id as string | undefined) ?? `k${db.kindNames.length + 1}`;
        db.kindNames = db.kindNames.filter((x) => x.id !== id);
        db.kindNames.push({
          id,
          grp: b.p_grp,
          base: b.p_base,
          name: b.p_name,
          added: b.p_added,
          hidden: b.p_hidden,
        });
        return json(route, id);
      }
      case 'admin_set_loan_rate':
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      case 'admin_app_config':
        return json(route, {
          min_version_desktop: '1.0.0',
          min_version_web: '1.0.0',
          min_version_ios: '1.0.0',
          min_version_android: '1.0.0',
          latest_version_desktop: '1.1.0',
          maintenance_starts_at: null,
          maintenance_ends_at: null,
          maintenance_message: null,
          below_min: { desktop: 12, ios: 0, android: 3 },
        });
      case 'admin_request_app_config':
        return json(route, 'ap9');
      case 'admin_users':
        return json(route, [
          {
            email: ADMIN.email,
            name: 'cs01',
            roles: db.roles,
            locked: false,
            last_seen_at: '2026-10-18T00:00:00Z',
            linked: true,
            mfa: true,
          },
          {
            email: 'ops01@sweetwo.kr',
            name: '운영1',
            roles: ['ops'],
            locked: false,
            last_seen_at: null,
            linked: false,
            mfa: false,
          },
        ]);
      case 'admin_reviews':
        return json(route, []);
      case 'admin_set_lock':
      case 'admin_request_user':
        return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
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
  await expect(page.getByText(/초 뒤에 다시 받을 수 있어요/)).toBeVisible();
  await expect(page.getByRole('button', { name: '로그인 링크 받기' })).toBeDisabled();
  expect(db.rpc).toEqual([]);
});

test('로그인: 너무 자주 누르면 조금 뒤에 다시', async ({ page }) => {
  await mock(page, { aal: null, otpError: 'over_email_send_rate_limit' });
  await page.goto('/');
  await page.getByLabel('회사 이메일').fill('cs01@sweetwo.kr');
  await page.getByRole('button', { name: '로그인 링크 받기' }).click();
  await expect(page.getByText('조금 뒤에 다시 눌러 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '로그인 링크 받기' })).toBeDisabled();
  await axe(page);
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

test('회원 검색 내려받기(AD-02 5번): 사유를 남겨야 받음, L0 열만, 첫 줄에 관리자 ID', async ({
  page,
}) => {
  const db = await mock(page);
  await page.goto('/members');
  await page.getByLabel('이메일, 사용자 ID, 문의 번호로 찾기').fill('space-1');
  await page.getByRole('button', { name: '보기' }).click();
  await expect(page.getByText('yeb***@example.com')).toBeVisible();
  await page.getByRole('button', { name: '내려받기' }).click();
  const go = page.getByRole('button', { name: '사유 남기고 내려받기' });
  await expect(go).toBeDisabled();
  await page.getByLabel('내려받는 이유').fill('문의 A-10001 부부 확인');
  await axe(page);
  const dl = page.waitForEvent('download');
  await go.click();
  const file = await dl;
  const text = (await import('node:fs')).readFileSync(await file.path(), 'utf8');
  expect(text).toContain('내려받은 관리자 cs01@sweetwo.kr');
  expect(text).toContain('yeb***@example.com');
  expect(text).not.toContain('chanwoo@'); // 가리지 않은 이메일 없음
  expect(db.rpc.find((r) => r.fn === 'admin_note_export')?.body).toMatchObject({
    p_screen: 'AD-02',
    p_reason: '문의 A-10001 부부 확인',
    p_rows: 2,
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

  // 금액 원값: 화면 1개만, 최고 관리자 승인 요청
  await ask.getByRole('button', { name: '목표' }).click();
  await ask.getByLabel('금액 원값 요청').check();
  await expect(
    ask.getByText('최고 관리자가 승인하면 사용자에게 요청해요', { exact: false }),
  ).toBeVisible();
  await ask.getByLabel('사유').fill('목표 금액 확인');
  await ask.getByRole('button', { name: '동의 요청 보내기' }).click();
  await expect(page.getByText('최고 관리자에게 원값 승인을 요청했어요')).toBeVisible();
  expect(db.rpc.filter((r) => r.fn === 'admin_request_access').at(-1)?.body).toMatchObject({
    p_scopes: ['goals'],
    p_raw: true,
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

test('계정 조치(AD-05): 삭제 대리 접수는 확인 뒤 바로, 로그인 수단 이전은 승인 요청', async ({
  page,
}) => {
  const db = await mock(page);
  await page.goto(`/members/${CHANWOO}`);
  await heading(page, '회원 상세');
  await page.getByRole('button', { name: '계정 조치' }).click();
  const form = page.getByRole('region', { name: '계정 조치' });
  await form.getByLabel('계정 조치').selectOption('delete_request');
  await form.getByLabel('문의 번호').fill('A-10001');
  await form.getByRole('button', { name: '실행' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('30일 뒤 지워져요');
  await axe(page);
  await dialog.getByRole('button', { name: '삭제 대리 접수' }).click();
  await expect(form.getByRole('status')).toHaveText('처리했어요');
  expect(db.rpc.find((r) => r.fn === 'admin_account_action')?.body).toMatchObject({
    p_action: 'delete_request',
    p_inquiry_no: 'A-10001',
  });

  await form.getByLabel('계정 조치').selectOption('login_move');
  const go = form.getByRole('button', { name: '승인 요청' });
  await expect(go).toBeDisabled();
  await form.getByLabel('새 계정 이메일 또는 사용자 ID').fill('nobody@example.com');
  await go.click();
  await expect(form.getByRole('status')).toHaveText('새 계정을 찾지 못했어요');
  await form.getByLabel('새 계정 이메일 또는 사용자 ID').fill('chanwoo.new@example.com');
  await go.click();
  await expect(form.getByRole('status')).toHaveText('최고 관리자에게 승인을 요청했어요');
  await axe(page);
  expect(db.rpc.filter((r) => r.fn === 'admin_request_login_move').at(-1)?.body).toMatchObject({
    p_user: CHANWOO,
    p_new: 'chanwoo.new@example.com',
    p_inquiry_no: 'A-10001',
  });
});

test('운영 역할: 회원 상세에 열람·조치 버튼 없음', async ({ page }) => {
  await mock(page, { roles: ['ops'] });
  await page.goto(`/members/${CHANWOO}`);
  await heading(page, '회원 상세');
  await expect(page.getByRole('button', { name: '개인정보 보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '계정 조치' })).toHaveCount(0);
});

test('공지(운영): 초안 저장, 승인 요청, 밤 시간 안내 없이 저장', async ({ page }) => {
  const db = await mock(page, { roles: ['ops'] });
  await page.goto('/notices');
  await heading(page, '공지');
  await page.getByRole('button', { name: '새 공지' }).click();
  const form = page.getByRole('region', { name: '새 공지' });
  await form.getByLabel('종류').selectOption('maintenance');
  await form.getByLabel('제목').fill('저장 기능 점검');
  await form.getByLabel('시작').fill('2026-10-20T14:00');
  await form.getByLabel('끝').fill('2026-10-20T16:00');
  await expect(form.getByRole('button', { name: '필독' })).toBeVisible();
  await axe(page);
  await form.getByRole('button', { name: '승인 요청' }).click();
  await expect(page.getByRole('row', { name: /저장 기능 점검/ })).toContainText('승인 대기');
  expect(db.rpc.find((r) => r.fn === 'admin_save_notice')?.body).toMatchObject({
    p_kind: 'maintenance',
    p_request: true,
    p_starts_at: '2026-10-20T05:00:00.000Z',
  });
});

test('공지 메일(AD-10): 약관 개정·장애 고지만 ‘이메일로도 보내기’', async ({ page }) => {
  const db = await mock(page, { roles: ['ops'] });
  await page.goto('/notices');
  await page.getByRole('button', { name: '새 공지' }).click();
  const form = page.getByRole('region', { name: '새 공지' });
  await expect(form.getByRole('switch', { name: '이메일로도 보내기' })).toHaveCount(0);
  await form.getByLabel('종류').selectOption('terms');
  await form.getByLabel('제목').fill('이용약관이 바뀌어요');
  await form.getByLabel('시작', { exact: true }).fill('2026-10-20T10:00');
  await form.getByLabel('끝', { exact: true }).fill('2026-11-20T10:00');
  const mail = form.getByRole('switch', { name: '이메일로도 보내기' });
  await mail.click();
  await expect(mail).toBeChecked();
  await axe(page);
  await form.getByRole('button', { name: '승인 요청' }).click();
  await expect(page.getByRole('row', { name: /이용약관이 바뀌어요/ })).toContainText('승인 대기');
  expect(db.rpc.find((r) => r.fn === 'admin_set_notice_email')?.body).toMatchObject({
    p_id: 'n1',
    p_email: true,
  });
});

test('콘텐츠: 가이드 버전, 약관 버전(법률 검토 체크해야 요청), 평균 금리', async ({ page }) => {
  const db = await mock(page, { roles: ['ops'] });
  await page.goto('/content');
  await heading(page, '콘텐츠');
  await expect(page.getByRole('row', { name: /couple/ })).toContainText('재검토');
  await page.getByRole('tab', { name: '약관·개인정보 처리방침' }).click();
  await expect(page.getByRole('row', { name: /v1/ })).toContainText('1,234');
  const add = page.getByRole('region', { name: '버전 추가' });
  await add.getByLabel('버전').fill('v2');
  await expect(add.getByRole('button', { name: '승인 요청' })).toBeDisabled();
  await add.getByLabel('법률 검토 확인').check();
  await add.getByRole('button', { name: '승인 요청' }).click();
  await expect(page.getByText('승인을 요청했어요')).toBeVisible();
  await page.getByRole('tab', { name: '계산·기준 데이터' }).click();
  await page.getByLabel('신용 연 금리').fill('6.5');
  await page.getByRole('row', { name: /신용/ }).getByRole('button', { name: '저장' }).click();
  await expect
    .poll(() => db.rpc.find((r) => r.fn === 'admin_set_loan_rate')?.body.p_rate_bp)
    .toBe(650);
  await axe(page);

  // AD-19 항목 이름 목록: 새 칩은 기본 항목을 따름, 기본 항목은 숨김
  const kinds = page.getByRole('region', { name: '칩 추가' });
  await kinds.getByLabel('종류').selectOption({ label: '예금·적금' });
  await kinds.getByLabel('따르는 항목').selectOption({ label: '정책형 적금' });
  await kinds.getByLabel('이름').fill('청년도약계좌');
  await kinds.getByRole('button', { name: '칩 추가' }).click();
  await expect(page.getByRole('row', { name: /청년도약계좌/ })).toContainText('정책형 적금');
  const term = page.getByRole('row', { name: /정기예금/ });
  await term.getByRole('checkbox', { name: '정기예금 숨김' }).check();
  await term.getByRole('button', { name: '저장' }).click();
  await expect(term.getByRole('button', { name: '처음대로' })).toBeVisible();
  await page.mouse.move(0, 0); // 줄 hover 바탕은 빼고 봄
  await axe(page);
  expect(db.rpc.filter((r) => r.fn === 'admin_save_kind_name').map((r) => r.body)).toEqual([
    {
      p_grp: 'deposit',
      p_base: 'policy_saving',
      p_name: '청년도약계좌',
      p_added: true,
      p_hidden: false,
    },
    {
      p_grp: 'deposit',
      p_base: 'term_deposit',
      p_name: '정기예금',
      p_added: false,
      p_hidden: true,
    },
  ]);
});

test('시스템(최고 관리자): 승인(내 요청은 승인 못 함), 앱 버전·점검은 승인 요청, 관리자 계정', async ({
  page,
}) => {
  const db = await mock(page, { roles: ['super', 'ops'] });
  await page.goto('/system');
  await heading(page, '시스템');
  const row = page.getByRole('row', { name: /cs02@sweetwo.kr/ });
  await axe(page);
  await row.getByRole('button', { name: '승인' }).click();
  await expect(page.getByRole('row', { name: /cs02@sweetwo.kr/ })).toHaveCount(0);
  expect(db.approvals[0]?.status).toBe('approved');

  await page.getByRole('tab', { name: '앱 버전·점검' }).click();
  await expect(page.getByLabel('최신 버전(데스크톱)')).toHaveValue('1.1.0');
  await expect(
    page.getByText('지금 최소 버전보다 낮은 기기 12대(90일 안에 켠 기기)'),
  ).toBeVisible();
  await page.getByLabel('최소 지원 버전(데스크톱)').fill('1.1.0');
  await page.getByRole('button', { name: '승인 요청' }).click();
  await expect(page.getByText('승인을 요청했어요')).toBeVisible();
  expect(db.rpc.find((r) => r.fn === 'admin_request_app_config')?.body.p).toMatchObject({
    min_version_desktop: '1.1.0',
    maintenance_starts_at: null,
  });

  await page.getByRole('tab', { name: '관리자 계정' }).click();
  await expect(page.getByRole('row', { name: /ops01@sweetwo.kr/ })).toContainText('첫 로그인 전');
  await page
    .getByRole('row', { name: /ops01@sweetwo.kr/ })
    .getByRole('button', { name: '잠그기' })
    .click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  await axe(page);
});
