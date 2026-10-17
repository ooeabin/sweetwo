-- 월말 정리 정산 요약 아래(21 W-04g, 06 4장·7장): 미달·초과 처리 선택, 생활비 예산 보정 제안 답.
-- 계산은 앱 core rules/close-review.ts. 같은 공간 사람만 쓰는 month_close 열이라 정책은 그대로.
--   gap_kind: 미달(short) / 초과(over), gap_amount: 차이(원)
--   gap_choice: 3개월에 나눠 채우기(spread_3m) / 기한 늘리기(extend) / 이번 달만 넘어가기(skip_this_month) / 더 넣을 목표(extra_goal)
--   gap_goal_id: 초과분을 더 넣을 목표, 기한을 늘릴 목표
--   budget_fix: 보정 제안 ‘맞추기’(applied) / ‘그대로 두기’(kept)

alter table public.month_close
  add column gap_kind text check (gap_kind in ('short', 'over')),
  add column gap_amount bigint check (gap_amount between 0 and 99999999999),
  add column gap_choice text check (gap_choice in ('spread_3m', 'extend', 'skip_this_month', 'extra_goal')),
  add column gap_goal_id uuid references public.goal (id) on delete set null,
  add column budget_fix text check (budget_fix in ('applied', 'kept')),
  add constraint month_close_gap_choice check (
    gap_choice is null
    or (gap_kind = 'short' and gap_choice in ('spread_3m', 'extend', 'skip_this_month'))
    or (gap_kind = 'over' and gap_choice = 'extra_goal' and gap_goal_id is not null)
  );
