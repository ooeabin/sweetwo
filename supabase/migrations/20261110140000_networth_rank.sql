-- 우리 자산 순위(23 F-08, 계산·배분 7-7, ADR 0006, 2026-11-04): 사람마다 마지막으로 본 순위.
-- rank_month = 본 달(그 달 1일, KST), rank_pct = 상위 n%(1~99), rank_net = 그때 순자산(원).
-- 이번 달에 봤고 순자산이 그대로면 배너에 그 값, 아니면 ‘새로 확인하기’. 계산은 앱(core rankTopPct)이 하고 여기에는 결과만.
-- 내 행만 고침(app_user 기존 RLS: 본인 행만 update)
alter table public.app_user
  add column rank_month date check (rank_month is null or extract(day from rank_month) = 1),
  add column rank_pct smallint check (rank_pct is null or rank_pct between 1 and 99),
  add column rank_net bigint;

grant update (rank_month, rank_pct, rank_net) on public.app_user to authenticated;

-- 연령대 비교(계산·배분 7-7): 두 사람 출생연도 평균으로 연령대를 정하려고 배우자 출생연도만 돌려줌.
-- 같은 부부 공간의 사용 중인 배우자만, 없으면 null(partner_profile과 같은 조건)
create function public.partner_birth_year()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select p.birth_year
  from public.app_user me
  join public.app_user p on p.space_id = me.space_id and p.id <> me.id and p.status = 'active'
  where me.id = auth.uid() and me.space_id is not null
  limit 1;
$$;
revoke execute on function public.partner_birth_year() from public, anon;
grant execute on function public.partner_birth_year() to authenticated;
