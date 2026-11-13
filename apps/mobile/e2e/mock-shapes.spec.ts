import { test, expect, type Route } from '@playwright/test';
import {
  AnswerResult,
  BundleViewListSchema,
  HomeTaskStateSchema,
  ModeChangeRequestRowSchema,
  ModeChangeResult,
  MoneyInPeriodSchema,
  MoneyInRowSchema,
  MyManageStyleSchema,
  PartnerPlanViewSchema,
  RankPairSchema,
  SalaryChangeRowSchema,
  SharedAccountRowSchema,
} from '@sweetwo/core';
import type { ZodTypeAny } from 'zod';
import {
  chanwoo,
  type MemDb,
  mockOnboarding,
  mockSaving,
  mockV22Settings,
  newSavingDb,
  SB,
  seed,
  YEBIN,
} from './mocks';

// 흉내 응답이 서버와 같은 모양인지(B1, 2026-11-13 PR 14): 앱이 Zod로 검사하는 v2.2 응답을 브라우저 없이 흉내에 직접 묻고
// core 스키마(api가 쓰는 것과 같은 것)로 읽는다. 흉내가 서버와 다른 모양을 돌려 화면 테스트만 통과하던 일을 막음.
// 새 RPC나 표를 흉내 내면 여기에 한 줄 더한다(mocks/index.ts 표).

type Handler = (route: Route) => unknown;
type Reply = { status: number; body: unknown };

/** page.route·addInitScript만 받는 가짜 Page. 나중에 붙인 route가 먼저(Playwright 규칙), fallback이면 앞 것으로 */
class FakePage {
  handlers: Handler[] = [];
  route(_url: string, h: Handler) {
    this.handlers.push(h);
    return Promise.resolve();
  }
  addInitScript() {
    return Promise.resolve();
  }
  async call(method: string, path: string, body?: unknown): Promise<Reply> {
    const url = `${SB}${path}`;
    const post = body === undefined ? null : JSON.stringify(body);
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      let reply: Reply | null = null;
      let fell = false;
      const route = {
        request: () => ({
          url: () => url,
          method: () => method,
          postData: () => post,
          postDataJSON: () => (post ? (JSON.parse(post) as unknown) : null),
          headers: () => ({}),
        }),
        fulfill: (o: { status?: number; body?: string }) => {
          reply = {
            status: o.status ?? 200,
            body: o.body ? (JSON.parse(o.body) as unknown) : null,
          };
          return Promise.resolve();
        },
        fallback: () => {
          fell = true;
          return Promise.resolve();
        },
        continue: () => {
          fell = true;
          return Promise.resolve();
        },
      } as unknown as Route;
      await this.handlers[i]?.(route);
      if (reply) return reply;
      if (!fell) break;
    }
    throw new Error(`흉내 없음: ${method} ${path}`);
  }
  rpc(fn: string, body: Record<string, unknown> = {}) {
    return this.call('POST', `/rest/v1/rpc/${fn}`, body);
  }
  rows(table: string, query = 'select=*') {
    return this.call('GET', `/rest/v1/${table}?${query}`);
  }
}

const NOW = new Date('2026-10-07T10:00:00+09:00');

/** 찬우(각자 계열, 예빈과 연결) + 예빈 저금 하나. saving-together·settings-v22와 같은 시드 */
async function pair(withMock: 'saving' | 'settings') {
  const page = new FakePage();
  const p = page as unknown as Parameters<typeof mockOnboarding>[0];
  const db = await mockOnboarding(p, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = { id: YEBIN, nickname: '예빈', monthly_income: 2_700_000, payday: 10 };
  // 스펙과 같게 둘 중 하나만 붙임(bundle_view처럼 둘 다 흉내 내는 RPC가 있어 나중 것이 먼저 받음)
  const s = newSavingDb();
  if (withMock === 'saving') await mockSaving(p, db, s, chanwoo.id);
  else await mockV22Settings(p, db, NOW);
  return { page, db, s };
}

const expectShape = (schema: ZodTypeAny, value: unknown, what: string) => {
  const r = schema.safeParse(value);
  expect(r.success, `${what}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true);
};
const ok2xx = (r: Reply, what: string) => expect(r.status, what).toBeLessThan(300);
const rowsOf = (r: Reply) => (Array.isArray(r.body) ? (r.body as unknown[]) : []);

// 브라우저가 없어 한 프로젝트에서만
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'light', '브라우저 없이 한 번만');
});

test('같이 모으기·돈 기록(mocks/saving): bundle_view, money_in, 남은 기간 = 서버 모양', async () => {
  const { page, db } = await pair('saving');
  const h = db.goals.find((g) => g.id === 'goal-h') as MemDb['goals'][number];
  ok2xx(await page.rpc('bundle_create', { p_goal: h.id, p_name: '내 집 마련' }), 'bundle_create');
  const view = await page.rpc('bundle_view', { p_bundle: null });
  expect(rowsOf(view)).toHaveLength(1);
  expectShape(BundleViewListSchema, view.body ?? [], 'bundle_view');

  ok2xx(
    await page.rpc('log_money_in', {
      p_amount: 3_000_000,
      p_received_on: '2026-10-07',
      p_kind: 'family',
    }),
    'log_money_in',
  );
  const ins = await page.rows('money_in', 'select=*&deleted_at=is.null');
  expect(rowsOf(ins).length).toBeGreaterThan(0);
  for (const r of rowsOf(ins)) expectShape(MoneyInRowSchema, r, 'money_in');

  const period = await page.rpc('money_in_period', { p_today: '2026-10-07' });
  expectShape(MoneyInPeriodSchema, period.body, 'money_in_period');
});

test('공개·관계·설정(mocks/v22-settings): 관리 형태 요청, 분담 제안, 월급 변경, 상대 보기 = 서버 모양', async () => {
  const { page } = await pair('settings');
  const style = await page.rpc('my_manage_style');
  expect(rowsOf(style).length).toBeGreaterThan(0);
  expectShape(MyManageStyleSchema, rowsOf(style)[0], 'my_manage_style');

  const req = await page.rpc('request_mode_change', {
    p_shared_living: true,
    p_shared_saving: true,
    p_manager: 'me',
    p_phrase: 's11f_combine',
  });
  expectShape(ModeChangeResult, req.body, 'request_mode_change');
  const open = await page.rows('mode_change_request', 'select=*&status=eq.open');
  expect(rowsOf(open).length).toBeGreaterThan(0);
  for (const r of rowsOf(open)) expectShape(ModeChangeRequestRowSchema, r, 'mode_change_request');

  ok2xx(
    await page.rpc('propose_split', {
      p_name: '생활비 통장',
      p_monthly_total: 1_000_000,
      p_rule: 'half',
      p_share_mine: null,
    }),
    'propose_split',
  );
  const acc = await page.rows('shared_account');
  expect(rowsOf(acc).length).toBeGreaterThan(0);
  for (const r of rowsOf(acc)) expectShape(SharedAccountRowSchema, r, 'shared_account');

  ok2xx(
    await page.rpc('schedule_salary_change', {
      p_amount: 3_000_000,
      p_from: '2026-11-01',
      p_until: null,
    }),
    'schedule_salary_change',
  );
  const changes = await page.rows('salary_change');
  expect(rowsOf(changes).length).toBeGreaterThan(0);
  for (const r of rowsOf(changes)) expectShape(SalaryChangeRowSchema, r, 'salary_change');

  for (const viewer of [null, YEBIN]) {
    const pv = await page.rpc('partner_plan_view', { p_viewer: viewer });
    expectShape(PartnerPlanViewSchema, pv.body ?? null, `partner_plan_view(${viewer})`);
  }
});

test('홈·자산(mocks/app-db, v22-pay): 홈 띠 상태, 순위, 답 결과 = 서버 모양', async () => {
  const { page, db } = await pair('settings');
  ok2xx(await page.rpc('dismiss_home_task', { p_key: 'push_reask', p_state: 'done' }), 'dismiss');
  const tasks = await page.rows('home_task_state');
  expect(rowsOf(tasks).length).toBeGreaterThan(0);
  for (const r of rowsOf(tasks)) expectShape(HomeTaskStateSchema, r, 'home_task_state');

  db.me.birth_year = 1994;
  const rank = await page.rpc('networth_rank_pair');
  expectShape(RankPairSchema, rank.body, 'networth_rank_pair');

  // 답 결과는 accepted / declined / expired 셋 중 하나
  const yreq = await page.rpc('request_mode_change', {
    p_shared_living: true,
    p_shared_saving: false,
    p_manager: 'partner',
    p_phrase: 's11f_manager',
  });
  expectShape(ModeChangeResult, yreq.body, 'request_mode_change(partner)');
  const id = (
    rowsOf(await page.rows('mode_change_request', 'select=*&status=eq.open'))[0] as
      { id?: string } | undefined
  )?.id;
  expect(id).toBeTruthy();
  if (id) {
    const ans = await page.rpc('answer_mode_change', { p_request: id, p_accept: false });
    expectShape(AnswerResult, ans.body, 'answer_mode_change');
  }
});
