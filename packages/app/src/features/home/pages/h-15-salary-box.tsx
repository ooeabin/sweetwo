import { monthLineUrgent, type HomeMonthLine } from '@sweetwo/core';
import { HubBox, type HubBoxRow } from '@sweetwo/ui';
import { sharedCopy } from '../../../shared/copy';
import { spoken } from '../../../shared/masked-text';
import { copy } from '../copy';

/**
 * H-15 월급 상자(19 ‘H-15 월급 상자’, 2026-11-17 홈을 메뉴 서랍과 같은 이름·순서로, 2026-11-18 상자 전체가 버튼 하나):
 * 머리 “월급”(글자만) + 정보 줄 둘(꺾쇠 없음) + 맨 아래 오른쪽 “자세히 보기 ›”. 누르면 이번 달 월급 체크(W-02, 날짜 없는 사람은
 * 예전 그 줄이 가던 곳). 월급 계획 템플릿은 W-02 안 링크로 감. 못 불러왔으면 누르면 다시 읽음.
 * 줄 이름은 서랍과 똑같이 “이번 달 월급 체크” “월급 계획 템플릿”. 값은 예전 홈 상자를 짧게 줄인 것:
 * 이번 달 월급 체크 = H-11 이번 달 한 줄(core pickMonthLine, 날짜 없는 사람은 H-13 기간) / 월급 계획 템플릿 = H-07.
 * 확인할 게 있으면(core monthLineUrgent) 첫 줄 값이 굵게
 */
export function H15SalaryBox({
  line,
  won,
  plan,
  go,
  onRetry,
}: {
  line: HomeMonthLine;
  won: (v: number) => string;
  /** H-07 내용: 값(“매달 25일”, 모자라면 “30만 원이 모자라요”)과 보조(“미계획 금액 20만 원”) */
  plan: { value?: string; sub?: string };
  go: (box: 'salary', to: string) => void;
  onRetry: () => void;
}) {
  const month = monthValue(line, won);
  const rows: HubBoxRow[] = [
    { key: 'month', name: copy.rowMonth, ...month, alert: monthLineUrgent(line) },
    { key: 'plan', name: copy.rowPlan, ...plan },
  ];
  const label = spoken(
    [copy.salaryBox, ...rows.map((r) => [r.name, r.value, r.sub].filter(Boolean).join(' '))].join(
      ', ',
    ),
  );
  return (
    <HubBox
      title={copy.salaryBox}
      more={copy.salaryBoxMore}
      rows={rows}
      label={label}
      onClick={line.kind === 'error' ? onRetry : () => go('salary', line.to)}
    />
  );
}

/** 이번 달 월급 체크 줄의 짧은 값(H-11 상태 → 한 마디). 늦은 확인이 있으면 보조로 “지난달 n개 남음” */
export function monthValue(
  line: HomeMonthLine,
  won: (v: number) => string,
): { value: string; sub?: string } {
  const late = 'late' in line && line.late > 0 ? copy.lateShort(line.late) : undefined;
  switch (line.kind) {
    case 'error':
      return { value: sharedCopy.errorTitle, sub: sharedCopy.retry };
    case 'no_salary':
      return { value: copy.noSalaryShort };
    case 'non_manager':
      return { value: copy.nonManagerShort };
    case 'first':
      return { value: copy.firstShort(line.date) };
    case 'review':
    case 'left':
    case 'payday':
      return {
        value: line.left > 0 ? copy.leftShort(line.left) : (late ?? ''),
        sub: line.left > 0 ? late : undefined,
      };
    case 'auto_only':
      return { value: late ?? copy.autoShort };
    case 'done':
      return { value: late ?? copy.doneShort(line.finish) };
    case 'period':
      if (line.display === 'bar')
        return {
          value: copy.periodBarShort(won(line.period.received), won(line.period.needed ?? 0)),
          sub: copy.periodBarSub,
        };
      if (line.display === 'early')
        return { value: copy.periodEarlyShort(won(line.period.received)) };
      if (line.display === 'gap') return { value: copy.periodGapShort(line.period.gapDays ?? 0) };
      return { value: copy.periodNoneShort };
  }
}
