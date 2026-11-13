import type { PayChecklist } from '@sweetwo/api';
import { canLateCheck, isManual, type BaseDay } from '@sweetwo/core';
import { copy } from '../copy';

// W-02 지난 달 늦은 확인(20 ‘월급 탭 v2.2’ W-02 8번, 07 4장, ADR 0009 결정 3).
// 지난 사이클의 남은 손 줄(다음 기준일 0시에 서버가 ‘건너뜀’으로 닫은 줄, checked_by 없음)은 그다음 사이클이 끝날 때까지
// 체크할 수 있음(check_pay_line·confirm_payday가 late = true로 허용). 그 뒤 읽기 전용. W-02 ‹ 지난 달과 `?cycle=last`가 여기로.

/** 이 지난 사이클을 지금 늦게 확인할 수 있나(서버 late_check_until, core canLateCheck) */
export const lateOpen = (list: PayChecklist, today: string, base: BaseDay | null) =>
  list.cycle_end < today && canLateCheck(today, list.cycle_end, base);

/** 늦게 확인할 수 있는 손 줄(닫을 때 건너뜀이 된 줄 + 아직 대기) */
export const lateLines = (list: PayChecklist) =>
  list.pay_check_line.filter(
    (l) => isManual(l) && (l.state === 'wait' || (l.state === 'skipped' && !l.checked_by)),
  );

/** 머리 아래 회색 한 줄 “다음 월급날 전까지 늦게 확인할 수 있어요” */
export function LastMonthNote() {
  return (
    <p className="hg-q__help" style={{ margin: 0 }}>
      {copy.lateHelp}
    </p>
  );
}
