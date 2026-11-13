import { describe, expect, it } from 'vitest';
import { ActiveNotice, NoticeTarget } from './admin';

// 공지 대상 조건(27 AD-10 2번): 서버 notice_target_valid와 같은 모양
describe('NoticeTarget', () => {
  it('빈 객체는 모두', () => {
    expect(NoticeTarget.safeParse({}).success).toBe(true);
  });
  it('커플 상태, 앱 버전, 가입 주차', () => {
    expect(
      NoticeTarget.safeParse({
        couple_states: ['solo', 'connected'],
        version_below: '1.3.0',
        weeks_min: 1,
        weeks_max: 4,
      }).success,
    ).toBe(true);
  });
  it('금액 조건은 없음', () => {
    expect(NoticeTarget.safeParse({ amount: 1000 }).success).toBe(false);
  });
  it('없는 커플 상태, 버전 모양, 주차 순서', () => {
    expect(NoticeTarget.safeParse({ couple_states: ['moon'] }).success).toBe(false);
    expect(NoticeTarget.safeParse({ couple_states: [] }).success).toBe(false);
    expect(NoticeTarget.safeParse({ version_below: '1.3' }).success).toBe(false);
    expect(NoticeTarget.safeParse({ weeks_min: 4, weeks_max: 2 }).success).toBe(false);
  });
});

describe('ActiveNotice', () => {
  it('모르는 중요도는 일반', () => {
    const n = ActiveNotice.parse({
      id: 'n1',
      kind: 'info',
      title: '안내',
      body: '',
      importance: 'x',
      platforms: ['desktop'],
    });
    expect(n.importance).toBe('normal');
  });
});
