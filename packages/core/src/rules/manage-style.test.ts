import { describe, expect, it } from 'vitest';
import {
  isNonManager,
  manageStyleOf,
  modeChangeNeedsAccept,
  resolveManageStyle,
} from './manage-style';

// 08 v2.2 ‘세 질문 → 엔진 값’ 표 6줄(서버 resolve_manage_style과 같은 예시, pgTAP v22_manage_style)
describe('resolveManageStyle(2-5 표)', () => {
  it.each([
    [true, true, 'me', 'joint', 'me', 'one_manager'],
    [true, null, 'partner', 'joint', 'partner', 'one_manager'],
    [true, false, 'together', 'joint', null, 'together'],
    [true, true, 'each', 'separate', null, 'living_saving'],
    [true, false, 'each', 'separate', null, 'living_only'],
    [false, true, null, 'separate', null, 'saving_only'],
    [false, false, 'me', 'separate', null, 'separate'],
  ] as const)('생활비 %s 저금 %s 관리 %s → %s %s %s', (l, s, m, mode, mgr, style) => {
    expect(resolveManageStyle(l, s, m)).toEqual({ salaryMode: mode, manager: mgr, style });
  });
  it('생활비 ‘네’인데 관리 답이 없으면 need_manager', () => {
    expect(() => resolveManageStyle(true, true, null)).toThrow('need_manager');
  });
});

it('지금 공간 이름(my_manage_style), 옛 공간도 같은 규칙', () => {
  const sp = { shared_living: null, shared_saving: null };
  expect(manageStyleOf({ salary_mode: 'joint', manager_user_id: 'c', ...sp })).toBe('one_manager');
  expect(manageStyleOf({ salary_mode: 'joint', manager_user_id: null, ...sp })).toBe('together');
  expect(manageStyleOf({ salary_mode: 'separate', manager_user_id: null, ...sp })).toBe('separate');
  expect(
    manageStyleOf({
      salary_mode: 'separate',
      manager_user_id: null,
      shared_living: true,
      shared_saving: true,
    }),
  ).toBe('living_saving');
  // 찬우가 관리, 예빈은 관리하지 않는 쪽
  expect(isNonManager({ salary_mode: 'joint', manager_user_id: 'c' }, 'y')).toBe(true);
  expect(isNonManager({ salary_mode: 'joint', manager_user_id: 'c' }, 'c')).toBe(false);
});

it('바꾸기 수락이 필요한 것(D7): 각자 → 합쳐서, 관리하는 사람을 상대로', () => {
  const base = { connected: true, partnerId: 'y', fromManagerId: null, toManagerId: null };
  expect(modeChangeNeedsAccept({ ...base, fromMode: 'separate', toMode: 'joint' })).toBe(true);
  expect(modeChangeNeedsAccept({ ...base, fromMode: 'joint', toMode: 'separate' })).toBe(false);
  // 합쳐서 안에서 나를 관리하는 사람으로: 바로
  expect(
    modeChangeNeedsAccept({ ...base, fromMode: 'joint', toMode: 'joint', toManagerId: 'c' }),
  ).toBe(false);
  // 예빈에게 넘김: 수락
  expect(
    modeChangeNeedsAccept({ ...base, fromMode: 'joint', toMode: 'joint', toManagerId: 'y' }),
  ).toBe(true);
  // 이미 예빈이 관리하는데 그대로면 바로
  expect(
    modeChangeNeedsAccept({
      ...base,
      fromMode: 'joint',
      toMode: 'joint',
      fromManagerId: 'y',
      toManagerId: 'y',
    }),
  ).toBe(false);
  // 합류 전은 늘 바로
  expect(
    modeChangeNeedsAccept({
      ...base,
      connected: false,
      partnerId: null,
      fromMode: 'separate',
      toMode: 'joint',
    }),
  ).toBe(false);
});
