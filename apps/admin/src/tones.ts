import type { StatusTone } from '@sweetwo/ui';

// 상태 값 → 점 색(docs/design/components/Status.md). 손볼 것은 warn, 끝난 것은 ok, 꺼진 것은 off.
export const coupleTone: Record<string, StatusTone> = {
  not_joined: 'off',
  connected: 'ok',
  unlink_pending: 'warn',
  solo: 'off',
};
export const inquiryTone: Record<string, StatusTone> = {
  received: 'warn',
  in_progress: 'info',
  waiting_user: 'off',
  done: 'ok',
};
export const noticeTone: Record<string, StatusTone> = {
  draft: 'off',
  requested: 'warn',
  published: 'ok',
  cancelled: 'off',
};
export const decisionTone: Record<string, StatusTone> = {
  requested: 'warn',
  approved: 'ok',
  rejected: 'bad',
};
