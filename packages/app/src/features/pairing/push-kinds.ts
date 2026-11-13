import type { PushKind } from '@sweetwo/core';

/**
 * P-11·S-14 알림 종류 목록(18 P-11 표, 14 v2.2): 보이는 줄과 기본값.
 * care·achieved·progress_news 늘, payday는 확인할 게 있을 때만(손 줄이 있는 사람: 관리하지 않는 쪽·월급 없음이면 없음),
 * shared_change는 같이 계열만(관리하지 않는 쪽은 기본 끔, G9), my_allowance는 관리하지 않는 쪽만
 */
export function pushKindRows(o: {
  joint: boolean;
  nonManager: boolean;
  hasPlan: boolean;
}): { kind: PushKind; on: boolean }[] {
  const rows: { kind: PushKind; on: boolean }[] = [{ kind: 'care', on: true }];
  if (o.hasPlan && !o.nonManager) rows.push({ kind: 'payday', on: true });
  rows.push({ kind: 'achieved', on: true });
  if (o.joint) rows.push({ kind: 'shared_change', on: !o.nonManager });
  if (o.nonManager) rows.push({ kind: 'my_allowance', on: true });
  rows.push({ kind: 'progress_news', on: true });
  return rows;
}
