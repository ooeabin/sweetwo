import { describe, expect, it } from 'vitest';
import { joinChapter, joinScreens, movedJoinScreen } from './join-step';

// 합류 화면 순서(18). 2026-11-11 P-03a 출생연도를 뺌(출생연도는 자산 순위 F-08 → S-11i에서)
type D = Parameters<typeof joinScreens>[0];
const st = (o: { waiting?: boolean; resumed?: boolean; step?: string } = {}): D => ({
  waiting: o.waiting ?? false,
  resumed: o.resumed ?? false,
  me: (o.step ? { onboarding_step: o.step } : null) as D['me'],
});

describe('joinScreens', () => {
  it('기본: P-03 → P-04 → P-05 → P-05b(출생연도 없음)', () => {
    expect(joinScreens(st())).toEqual(['p-03', 'p-04', 'p-05', 'p-05b']);
  });
  it('시작한 사람이 아직 온보딩 중: P-03 → P-05 → P-05b', () => {
    expect(joinScreens(st({ waiting: true }))).toEqual(['p-03', 'p-05', 'p-05b']);
  });
  it('진행 막대 4칸', () => {
    expect(joinChapter('p-03').steps).toEqual({ total: 4, done: 1 });
    expect(joinChapter('p-05b').steps).toEqual({ total: 4, done: 4 });
  });
  it('시작한 사람이 아직 온보딩 중이면 3칸, P-05가 2/3(2026-11-11 S3-24)', () => {
    const list = joinScreens(st({ waiting: true }));
    expect(joinChapter('p-05', list).steps).toEqual({ total: 3, done: 2 });
    expect(joinChapter('p-05b', list).fill).toBe(100);
  });
  it('예전 P-06은 막대 끝까지(S3-23)', () => {
    expect(joinChapter('p-06', ['p-06']).fill).toBe(100);
  });
});

describe('movedJoinScreen', () => {
  it('P-03a에 멈춘 사람은 다음 화면으로: 기본 P-04, 시작한 사람이 온보딩 중이면 P-05', () => {
    expect(movedJoinScreen('p-03a', st({ step: 'P-03A' }))).toBe('p-04');
    expect(movedJoinScreen('p-03a', st({ step: 'P-03A', waiting: true }))).toBe('p-05');
  });
  it('뺀 화면이 아니면 null', () => {
    expect(movedJoinScreen('p-04', st())).toBeNull();
  });
});
