-- 생년월일(O-13, P-04 3열 휠). 출생연도에 월, 일을 더함. 만 18세 확인을 날짜로 정확히, 배우자 생일 미리 채움(Y 서프라이즈).
alter table public.app_user
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day smallint check (birth_day between 1 and 31);
grant update (birth_month, birth_day) on public.app_user to authenticated;

-- O-13, P-04 만 18세 미만: 계정 즉시 삭제(delete_minor_account와 같음, 생일까지 보고 만 나이로 다시 확인)
create or replace function public.delete_underage_account(p_birth_date date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_birth_date <= public.kst_today() - interval '18 years' then
    raise exception 'not_minor' using errcode = 'P0001';
  end if;
  select space_id into sid from public.app_user where id = uid;
  if sid is not null and not exists (
    select 1 from public.app_user where space_id = sid and id <> uid
  ) then
    delete from public.couple_space where id = sid;
  end if;
  delete from auth.users where id = uid; -- app_user, consent는 연쇄 삭제
end;
$$;
revoke execute on function public.delete_underage_account(date) from public, anon;
grant execute on function public.delete_underage_account(date) to authenticated;

-- 배우자 생일(월, 일)만. 캘린더 ‘{배우자}님 생일’ 미리 채움(24 서프라이즈 1번). 출생연도와 다른 정보는 주지 않음
create or replace function public.partner_birthday()
returns table (month smallint, day smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.birth_month, p.birth_day
  from public.app_user me
  join public.app_user p on p.space_id = me.space_id and p.id <> me.id and p.status = 'active'
  where me.id = auth.uid() and me.space_id is not null
    and p.birth_month is not null and p.birth_day is not null
  limit 1;
$$;
revoke execute on function public.partner_birthday() from public, anon;
grant execute on function public.partner_birthday() to authenticated;
