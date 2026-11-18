import { describe, expect, it, vi } from 'vitest';
import {
  applyPerson,
  gaHash,
  startAnalytics,
  toGaParams,
  type AnalyticsBridge,
} from './analytics-ga';
import { track } from './analytics';
import { resetSessionState } from './session-reset';

const bridge = () => {
  const a = {
    log: vi.fn(async () => undefined),
    screen: vi.fn(async () => undefined),
    setUser: vi.fn(async () => undefined),
    setEnabled: vi.fn(async () => undefined),
  } satisfies AnalyticsBridge;
  return a;
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('toGaParams', () => {
  it('참·거짓은 글자, 배열은 쉼표, null은 뺌', () => {
    expect(toGaParams({ a: true, b: false, c: ['x', 'y'], d: null, e: undefined, f: 3 })).toEqual({
      a: 'true',
      b: 'false',
      c: 'x,y',
      f: 3,
    });
  });
  it('금액처럼 보이는 숫자와 이메일은 보내지 않음(구간은 보냄)', () => {
    expect(
      toGaParams({
        amount: 1_500_000,
        monthly_income: 3_000_000,
        balance: 10,
        amount_band: '100-300',
        note: 'chanwoo@example.com',
        lines_count: 4,
      }),
    ).toEqual({ amount_band: '100-300', lines_count: 4 });
  });
  it('GA 한도: 이름 40자, 글자 100자, 25개', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(toGaParams(many))).toHaveLength(25);
    const out = toGaParams({ ['x'.repeat(50)]: 'y'.repeat(150) });
    expect(Object.keys(out)[0]).toHaveLength(40);
    expect(Object.values(out)[0]).toHaveLength(100);
  });
});

describe('gaHash', () => {
  it('같은 id는 같은 32자 16진수, id가 그대로 들어가지 않음', async () => {
    const id = '0b7c3c1e-1111-4222-8333-444455556666';
    const h = await gaHash(id);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).toBe(await gaHash(id));
    expect(h).not.toContain(id.slice(0, 8));
    expect(await gaHash('other')).not.toBe(h);
  });
});

describe('applyPerson', () => {
  it('분석 수집을 끈 사람은 수집 끔 + 사용자 지움', async () => {
    const a = bridge();
    await applyPerson(a, { id: 'u1', space_id: 's1', analytics_off: true });
    expect(a.setEnabled).toHaveBeenCalledWith(false);
    expect(a.setUser).toHaveBeenCalledWith({ id: null, props: { couple_hash: null } });
  });
  it('켠 사람은 가명 user_id와 couple_hash', async () => {
    const a = bridge();
    await applyPerson(a, { id: 'u1', space_id: 's1', analytics_off: false });
    expect(a.setUser).toHaveBeenCalledWith({
      id: await gaHash('u1'),
      props: { couple_hash: await gaHash('s1') },
    });
  });
});

describe('startAnalytics', () => {
  it('이벤트·화면 ID를 보내고, 끈 사람이면 버림, 로그아웃하면 사용자 지움', async () => {
    const a = bridge();
    type Loc = { location: { pathname: string; search: string } };
    let route: (st: Loc) => void = () => undefined;
    const router = {
      state: { location: { pathname: '/salary/items/abc', search: '' } },
      subscribe: (fn: (st: Loc) => void) => {
        route = fn;
        return () => undefined;
      },
    };
    let setPerson: (
      p: { id: string; space_id: string | null; analytics_off: boolean } | null,
    ) => void = () => undefined;
    const stop = startAnalytics(a, router, (cb) => {
      setPerson = cb;
      cb(null);
      return () => undefined;
    });
    expect(a.screen).toHaveBeenCalledWith('W-10');
    route({ location: { pathname: '/salary/plan', search: '' } });
    expect(a.screen).toHaveBeenLastCalledWith('W-01');
    track('menu_item_tapped', { item: 'salary' });
    expect(a.log).toHaveBeenCalledWith('menu_item_tapped', { item: 'salary' });

    setPerson({ id: 'u1', space_id: null, analytics_off: true });
    await tick();
    track('menu_item_tapped', { item: 'assets' });
    route({ location: { pathname: '/assets', search: '' } });
    expect(a.log).toHaveBeenCalledTimes(1);
    expect(a.screen).toHaveBeenCalledTimes(2);

    resetSessionState();
    await tick();
    expect(a.setUser).toHaveBeenLastCalledWith({ id: null, props: { couple_hash: null } });
    stop();
  });
});
