import { describe, expect, it } from 'vitest';
import { JoinContextSchema } from './join';

// join_context RPC 응답(18 합류 흐름, 2026-11-11 D1)
describe('JoinContextSchema', () => {
  it('합류 중이 아니면 null', () => {
    expect(JoinContextSchema.parse(null)).toBeNull();
  });
  it('찬우 공간에 예빈이 합류하는 중(합쳐서, 대신 입력 1개)', () => {
    const v = JoinContextSchema.parse({
      space_id: 's1',
      member: false,
      reserved_until: '2026-11-12T09:00:00+00:00',
      starter_id: 'u1',
      starter_nickname: '찬우',
      salary_mode: 'joint',
      has_plan: true,
      prefill: [{ id: 'a1', name: '예빈 적금', amount: 3000000, estimated: false }],
      joint: {
        version: 2,
        lines: [{ kind: 'saving', amount: 950000, goal_id: 'g1', user_id: null, name: null }],
        items: [{ id: 'g1', target: 150000000, deadline: '2031-10-01', saved: 0 }],
      },
    });
    expect(v?.starter_nickname).toBe('찬우');
    expect(v?.joint?.lines[0]?.amount).toBe(950000);
  });
  it('모르는 관리 방식은 거절', () => {
    expect(() =>
      JoinContextSchema.parse({
        space_id: 's1',
        member: false,
        reserved_until: null,
        starter_id: null,
        starter_nickname: null,
        salary_mode: 'x',
        has_plan: false,
        prefill: [],
        joint: null,
      }),
    ).toThrow();
  });
});
