import type { BundleView, HeroItem } from '@sweetwo/core';
import { describe, expect, it } from 'vitest';
import { widgetHero, widgetLanding, widgetNext, widgetSave } from './widget-sync';

// 홈 화면 위젯 글(26 ‘위젯 v2.2’): 금액 없이 %·이름·기한 달, 다가오는 날은 날짜만
const G = '0b9c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
const goal = (o: Partial<Extract<HeroItem, { kind: 'goal' }>['goal']> = {}): HeroItem => ({
  kind: 'goal',
  goal: {
    id: G,
    name: '결혼 비용',
    status: 'active',
    closed_at: null,
    owner_user_id: null,
    target_amount: 50_000_000,
    deadline: '2027-05-31',
    saved: 0,
    ...o,
  },
});
const bundle = (o: Partial<BundleView> = {}): HeroItem => ({
  kind: 'bundle',
  bundle: {
    id: 'b1',
    name: '신혼집',
    status: 'active',
    deadline: null,
    paused: false,
    percent_only: false,
    show_each: false,
    my_show_each: false,
    my_percent_only: false,
    pct: 40,
    total: 4_000_000,
    target: 10_000_000,
    mine: null,
    partner: null,
    goals: [
      { id: 'g-partner', mine: false, name: '신혼집' },
      { id: 'g-me', mine: true, name: '신혼집' },
    ],
    ...o,
  } as BundleView,
});

describe('WG-01 같이 모으기 글', () => {
  it('저금: % + 기한 달, 금액 없음', () => {
    const s = widgetSave({ hero: goal(), savedOf: () => 31_000_000 });
    expect(s).toEqual({
      name: '결혼 비용',
      big: '62%',
      pct: 62,
      line: '2027년 5월까지',
      done: null,
      amount: null,
      to: `/salary/items/${G}`,
    });
    expect(JSON.stringify(s)).not.toMatch(/31,000,000|3,100만|원/);
  });
  it('금액 보이기를 켜면 모은 금액 한 줄, 끄면 없음(기본)', () => {
    expect(widgetSave({ hero: goal(), savedOf: () => 31_000_000, amounts: true })?.amount).toBe(
      '3,100만 원 모았어요',
    );
    expect(widgetSave({ hero: goal(), savedOf: () => 31_000_000 })?.amount).toBeNull();
  });
  it('묶음은 퍼센트만 보여 주기면 금액을 켜도 금액 없음', () => {
    expect(
      widgetSave({ hero: bundle({ percent_only: true }), savedOf: () => 0, amounts: true })?.amount,
    ).toBeNull();
    expect(widgetSave({ hero: bundle(), savedOf: () => 0, amounts: true })?.amount).toContain(
      '모았어요',
    );
  });
  it('목표 금액이 없으면 “모으는 중”, 막대 없음', () => {
    const s = widgetSave({ hero: goal({ target_amount: null, deadline: null }), savedOf: () => 5 });
    expect(s?.big).toBe('모으는 중');
    expect(s?.pct).toBeNull();
  });
  it('다 모으면 배지, 기한 줄 없음', () => {
    const s = widgetSave({ hero: goal(), savedOf: () => 50_000_000 });
    expect(s?.done).toBe('다 모았어요');
    expect(s?.line).toBeNull();
  });
  it('묶음: 합계 %, 퍼센트만이어도 같은 %, 누르면 내 줄 저금', () => {
    expect(widgetSave({ hero: bundle(), savedOf: () => 0 })).toMatchObject({
      big: '40%',
      to: '/salary/items/g-me',
    });
    expect(
      widgetSave({
        hero: bundle({ percent_only: true, total: null, target: null }),
        savedOf: () => 0,
      }),
    ).toMatchObject({ big: '40%', pct: 40 });
  });
  it('저금이 없으면 null', () => {
    expect(widgetSave({ hero: undefined, savedOf: () => 0 })).toBeNull();
  });
});

describe('WG-04 다가오는 날 글', () => {
  const care = {
    key: 'care-c1',
    kind: 'care' as const,
    date: '2026-11-26',
    name: '어머니 생신',
    dday: 13,
    to: '/calendar/day/c1',
  };
  const note = {
    id: 'n1',
    space_id: 's',
    goal_id: null,
    bundle_id: 'b1',
    name: '스드메 잔금',
    amount: 3_000_000,
    due_on: '2026-11-20',
    paid: false,
    paid_at: null,
    paid_move_id: null,
    created_by: null,
    created_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
  };
  it('가까운 쪽(메모가 먼저면 메모 → W-14), 금액 없음', () => {
    const n = widgetNext({ today: '2026-11-13', care, note });
    expect(n).toEqual({ name: '스드메 잔금', date: '2026-11-20', to: '/salary/bundles/b1/notes' });
  });
  it('경조사가 먼저면 경조사 → Y-05', () => {
    expect(
      widgetNext({ today: '2026-11-13', care, note: { ...note, due_on: '2026-12-01' } }),
    ).toEqual({ name: '어머니 생신', date: '2026-11-26', to: '/calendar/day/c1' });
  });
  it('없으면 null', () => {
    expect(widgetNext({ today: '2026-11-13', care: undefined, note: undefined })).toBeNull();
  });
});

describe('widgetLanding(widget_tapped landing_screen, 32 4-7)', () => {
  it('위젯이 여는 길을 화면 ID로', () => {
    const id = '0e3c6a4e-1b7d-4c58-9a40-1f0d8b1c2d3e';
    expect(widgetLanding('/')).toBe('H-01');
    expect(widgetLanding(`/salary/items/${id}`)).toBe('W-10');
    expect(widgetLanding(`/salary/items/${id}/notes`)).toBe('W-14');
    expect(widgetLanding(`/salary/bundles/${id}/notes`)).toBe('W-14');
    expect(widgetLanding('/calendar')).toBe('Y-04');
    expect(widgetLanding(`/calendar/day/${id}`)).toBe('Y-05');
    expect(widgetLanding('/settings')).toBe('other');
  });
});

describe('S-22 위젯에 보일 저축·투자', () => {
  const first = goal({ id: 'first' });
  const g = (o: Record<string, unknown> = {}) => ({
    id: G,
    name: '결혼 비용',
    target_amount: 50_000_000,
    deleted_at: null,
    closed_at: null,
    bundle_id: null,
    ...o,
  });
  const run = (goals: unknown[], chosenId: string | null) =>
    widgetHero({ first, goals: goals as never, chosenId });
  it('고른 게 없으면 대표 저축·투자', () => {
    expect(run([g()], null)).toBe(first);
  });
  it('고른 항목이 있으면 그것', () => {
    const h = run([g()], G);
    expect(h?.kind === 'goal' && h.goal.id).toBe(G);
  });
  it('지워졌거나 묶음에 들어갔거나 목표 금액이 없으면 대표로 돌아감', () => {
    expect(run([g({ deleted_at: 'x' })], G)).toBe(first);
    expect(run([g({ bundle_id: 'b' })], G)).toBe(first);
    expect(run([g({ target_amount: null })], G)).toBe(first);
    expect(run([], G)).toBe(first);
  });
});
