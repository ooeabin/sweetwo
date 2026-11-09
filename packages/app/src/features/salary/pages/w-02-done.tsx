import { fetchHolidays, qk } from '@sweetwo/api';
import { businessDayOnOrBefore } from '@sweetwo/core';
import { DoneMark, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMask } from '../../../shared/mask';
import { goalLineName, lineName } from '../check-line';
import { copy } from '../copy';
import {
  doneCount,
  myChecklist,
  useChecklists,
  useGoals,
  useMe,
  usePartner,
  useSpace,
} from '../data';
import { incomeOf, MonthResult } from '../month-parts';

// W-02 끝 다 보냈어요(20, Q7): 큰 체크 + “이번 달 월급 체크를 다 했어요” + 달 결과 카드(2026-11-09, 예전 저금 요약 InfoPlate 대신:
// 제목 “11월 월급”, 실제 보낸 금액, 다른 금액이면 “계획 80만 원”, ‘못 함’, 보낸 금액·여유 자금, 공유하기)
// + 파트너 진행 “예빈님 3개 중 1개”(각자 모드 + 파트너 합류만, 누르면 W-02 그 사람 탭) → 확인 → 홈
export function W02Done() {
  const nav = useNavigate();
  const me = useMe();
  const goals = useGoals();
  const lists = useChecklists();
  const space = useSpace();
  const partner = usePartner();
  const holidays = useQuery({ queryKey: qk.holidays, queryFn: fetchHolidays });
  const { masked } = useMask();
  if (!me.data || !goals.data || !lists.data || !space.data)
    return <QuestionSkeleton onBack={null} fields={2} />;
  const m = me.data;
  const sp = space.data;
  const joint = sp.salary_mode === 'joint';
  const list = myChecklist(lists.data, m.id);
  const p = partner.data;
  const partnerList =
    !joint && sp.couple_state === 'connected' && p
      ? lists.data.find((c) => c.owner_user_id === p.id)
      : undefined;
  const personName = (id: string | null) =>
    id === m.id ? (m.nickname ?? '') : (p?.nickname ?? null);
  const goalName = goalLineName(goals.data, personName, joint);
  const owner = list?.owner_user_id ?? null;
  const people = (owner === null ? [m, p] : [m])
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => ({ id: x.id, name: x.nickname ?? '', starter: x.id === sp.created_by }));
  const holidaySet = new Set((holidays.data ?? []).map((h) => h.date));
  const received = !list
    ? ''
    : sp.holiday_shift === false
      ? list.cycle_start
      : businessDayOnOrBefore(list.cycle_start, holidaySet);
  return (
    <QuestionLayout
      title={copy.doneTitle}
      primary={{ label: copy.ok }}
      onSubmit={() => nav('/', { replace: true })}
      center
      hero={<DoneMark art="celebrate" />}
    >
      {/* 그림 → 제목은 가운데, 달 결과 카드와 파트너 진행은 버튼 바로 위(2026-11-05) */}
      <div className="hg-q__end">
        {list && list.pay_check_line.length > 0 && (
          <MonthResult
            list={list}
            income={incomeOf(owner, m, p)}
            received={received}
            people={people}
            nameOf={(l) => lineName(l, goalName, personName, joint)}
            masked={masked}
            whose={joint ? 'joint' : 'self'}
            screen="done"
          />
        )}
        {partnerList && p && (
          <button
            type="button"
            className="hg-btn hg-btn--link"
            onClick={() => nav(`/salary?who=${p.id}`)}
          >
            {copy.partnerProgress(
              p.nickname ?? '',
              partnerList.pay_check_line.length,
              doneCount(partnerList),
            )}
          </button>
        )}
      </div>
    </QuestionLayout>
  );
}
