-- 투자 원칙(17 O-53, 09 6-7, 06 8장, 23 F-06). 사람마다 답을 하나씩 저장하고, 허용 비중은 두 답 중 보수적인 쪽(core investLimit).
-- 진단 ‘투자 원칙 합의’: 둘 다 답함 = 양호, 한 명만 = 주의(“{배우자}님 답을 기다려요”), 아무도 = 아직 정하지 않았어요.

create type public.invest_answer as enum ('keep', 'some', 'active', 'unsure');

alter table public.app_user
  add column invest_answer public.invest_answer,
  add column invest_answered_at timestamptz;
grant update (invest_answer, invest_answered_at) on public.app_user to authenticated;

-- 내 답과 배우자 답(배우자 행은 RLS로 못 읽으므로 이 함수로만)
create or replace function public.invest_answers()
returns table (mine public.invest_answer, partner public.invest_answer)
language sql
stable
security definer
set search_path = ''
as $$
  select me.invest_answer, p.invest_answer
  from public.app_user me
  left join public.app_user p
    on p.space_id = me.space_id and p.id <> me.id and p.status = 'active'
  where me.id = auth.uid() and me.status = 'active';
$$;
revoke execute on function public.invest_answers() from public, anon;
grant execute on function public.invest_answers() to authenticated;
