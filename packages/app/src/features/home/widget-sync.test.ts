import type { BundleView, HeroItem } from '@sweetwo/core';
import { describe, expect, it } from 'vitest';
import { widgetNext, widgetSave } from './widget-sync';

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
      to: `/salary/items/${G}`,
    });
    expect(JSON.stringify(s)).not.toMatch(/31,000,000|3,100만|원/);
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
