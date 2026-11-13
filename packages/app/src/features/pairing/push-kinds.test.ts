import { describe, expect, it } from 'vitest';
import { pushKindRows } from './push-kinds';

// 18 P-11 표: 예빈(합류한 사람)이 보는 알림 종류
describe('pushKindRows', () => {
  it('각자 계열, 월급 있음: 경조사, 월급날, 다 모았을 때, 진행 소식', () => {
    expect(pushKindRows({ joint: false, nonManager: false, hasPlan: true })).toEqual([
      { kind: 'care', on: true },
      { kind: 'payday', on: true },
      { kind: 'achieved', on: true },
      { kind: 'progress_news', on: true },
    ]);
  });
  it('합쳐서(둘이 같이): 같이 쓰는 걸 바꿨을 때 켬', () => {
    expect(
      pushKindRows({ joint: true, nonManager: false, hasPlan: true }).map((r) => r.kind),
    ).toEqual(['care', 'payday', 'achieved', 'shared_change', 'progress_news']);
  });
  it('관리하지 않는 쪽: 월급날 없음(자동 줄뿐), 같이 쓰는 걸 바꿨을 때 끔, 내 용돈 켬', () => {
    expect(pushKindRows({ joint: true, nonManager: true, hasPlan: true })).toEqual([
      { kind: 'care', on: true },
      { kind: 'achieved', on: true },
      { kind: 'shared_change', on: false },
      { kind: 'my_allowance', on: true },
      { kind: 'progress_news', on: true },
    ]);
  });
  it('월급 없이 합류: 월급날 없음', () => {
    expect(
      pushKindRows({ joint: false, nonManager: false, hasPlan: false }).map((r) => r.kind),
    ).not.toContain('payday');
  });
});
