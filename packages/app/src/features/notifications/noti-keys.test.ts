import { qk, splitKeys } from '@sweetwo/api';
import { expect, it } from 'vitest';
import { notiKeys } from './noti-keys';

// 새 알림 종류별로 같이 다시 읽을 것(2026-11-11 QA 4구간 S4-02)
it('합류하면 우리 둘 상태·파트너·월급 계획·체크리스트를 다시 읽어 초대 띠가 사라짐', () => {
  const keys = notiKeys('partner_joined');
  expect(keys).not.toBe('all');
  const list = keys === 'all' ? [] : keys;
  for (const k of [qk.space, qk.partner, qk.me, qk.latestInvite, ...splitKeys])
    expect(list).toContainEqual(k);
});

it('첫 월급 계획·체크·월급 계획 바뀜이면 월급 계획과 체크리스트(P-WAIT 대기, 합쳐서 상대 체크)', () => {
  for (const kind of [
    'plan_ready',
    'behalf_checked',
    'partner_done',
    'partner_change',
    'salary_mode',
  ]) {
    const keys = notiKeys(kind);
    expect(keys).not.toBe('all');
    expect(keys === 'all' ? [] : keys).toContainEqual(['pay_checklist']);
    expect(keys === 'all' ? [] : keys).toContainEqual(qk.splits);
  }
});

it('해제 확정·다시 연결은 전부, 해제 요청은 우리 둘 상태, 문의는 문의만, 모르는 종류는 없음', () => {
  expect(notiKeys('unlink_confirmed')).toBe('all');
  expect(notiKeys('reconnected')).toBe('all');
  expect(notiKeys('unlink_requested')).toEqual([qk.space, qk.unlink, qk.partner]);
  expect(notiKeys('reconnect_requested')).toEqual([qk.myUnlink]);
  expect(notiKeys('inquiry_answered')).toEqual([qk.inquiries]);
  expect(notiKeys('weekly_summary')).toEqual([]);
});
