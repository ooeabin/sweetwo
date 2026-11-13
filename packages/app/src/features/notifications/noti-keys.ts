import { manageKeys, qk, salaryChangeKeys, splitAccountKeys, splitKeys } from '@sweetwo/api';

/** 우리 둘·월급 계획이 바뀌는 알림이면 같이 다시 읽을 것(우리 둘 상태, 파트너, 나, 월급 계획, 체크리스트, 저금, 모은 금액) */
const COUPLE_KEYS = [qk.space, qk.partner, qk.me, ...splitKeys] as const;
type Key = readonly unknown[];

/**
 * 새 알림 종류별로 다시 읽을 데이터(2026-11-11 QA 4구간 S4-02). 알림만 새로 읽으면 홈이 그대로라
 * (합류 뒤 초대 띠가 남거나, P-WAIT 대기가 안 넘어가거나) 종류에 맞는 캐시도 같이 지움.
 * 'all' = 공간이 바뀌어 전부
 */
export function notiKeys(kind: string): readonly Key[] | 'all' {
  if (kind === 'unlink_confirmed' || kind === 'reconnected') return 'all';
  // 파트너 합류(시작한 사람에게): 우리 둘 상태·파트너·초대 코드·공동 데이터
  if (kind === 'partner_joined') return [...COUPLE_KEYS, qk.latestInvite, qk.partnerAssetSums];
  if (kind === 'reconnect_requested') return [qk.myUnlink, qk.reconnectRequests];
  // v2.2: 관리 형태 요청·결과(S-11j), 분담 제안·결과(W-01c), 월급이 바뀐 달, 내 용돈(한 사람 관리형)
  if (kind === 'mode_request' || kind === 'mode_result') return manageKeys;
  if (kind === 'split_request' || kind === 'split_result') return splitAccountKeys;
  if (kind === 'salary_changed') return salaryChangeKeys;
  if (kind === 'my_allowance') return splitKeys;
  // 해제 요청·취소·기한: 우리 둘 상태와 해제 기록, 파트너
  if (kind.startsWith('unlink_')) return [qk.space, qk.unlink, qk.partner];
  if (/^(access|inquiry)_/.test(kind)) return [qk.inquiries];
  // 첫 월급 계획(P-WAIT 대기 → P-04), 체크·대신 체크·다 함, 월급 계획·방식·기준일·저금 바뀜
  if (
    kind === 'plan_ready' ||
    kind === 'behalf_checked' ||
    kind === 'partner_done' ||
    kind === 'partner_change' ||
    kind === 'partner_activity' ||
    kind === 'salary_mode' ||
    kind === 'cycle_day' ||
    kind === 'goal_achieved'
  )
    return COUPLE_KEYS;
  return [];
}
