import { monthLineUrgent, type HomeMonthLine } from '@sweetwo/core';
import { HubBox, type HubBoxRow } from '@sweetwo/ui';
import { sharedCopy } from '../../../shared/copy';
import { spoken } from '../../../shared/masked-text';
import { copy } from '../copy';

/**
 * H-15 월급 상자(19 ‘H-15 월급 상자’, 2026-11-17 홈을 메뉴 서랍과 같은 이름·순서로): 머리 “월급 ›”(→ 월급 첫 화면)와 줄 둘(2026-11-18 ‘저축·투자’ 줄은 없앰: 저축·투자는 W-01 월급 계획 템플릿 안 묶음, 홈의 모은 금액은 H-10 같이 모으기).
 * 줄 이름은 서랍과 똑같이 “이번 달 월급 체크” “월급 계획 템플릿”. 값은 예전 홈 상자를 짧게 줄인 것:
 * 이번 달 월급 체크 = H-11 이번 달 한 줄(core pickMonthLine, 날짜 없는 사람은 H-13 기간) / 월급 계획 템플릿 = H-07.
 * 확인할 게 있으면(core monthLineUrgent) 첫 줄 값이 굵게
 */
export type SalaryBoxTo = 'salary' | 'salary_month' | 'salary_plan';

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
  go: (box: SalaryBoxTo, to: string) => void;
  onRetry: () => void;
}) {
  const month = monthValue(line, won);
  const row = (
    key: string,
    name: string,
    v: { value?: string; sub?: string; alert?: boolean },
    onClick: () => void,
  ): HubBoxRow => ({
    key,
    name,
    value: v.value,
    sub: v.sub,
    alert: v.alert,
    label: spoken([name, v.value, v.sub].filter(Boolean).join(', ')),
    onClick,
  });
  return (
    <HubBox
      title={copy.salaryBox}
      onHead={() => go('salary', '/salary')}
      rows={[
        row(
          'month',
          copy.rowMonth,
          { ...month, alert: monthLineUrgent(line) },
          line.kind === 'error' ? onRetry : () => go('salary_month', line.to),
        ),
        row('plan', copy.rowPlan, plan, () => go('salary_plan', '/salary/plan')),
      ]}
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
