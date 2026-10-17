-- S-12 부부 정보 ‘새 코드 받기’(docs/spec/25-settings.md S-12 6번): 새 코드를 받으면 이전 코드는 바로 못 씀.
-- 쓸 수 있는 코드를 모두 지금 만료로 바꾸고 create_invite()로 새 코드를 만든다(미합류만, 7일).
create or replace function public.renew_invite()
returns table (code text, expires_at timestamptz)
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
  select u.space_id into sid from public.app_user u where u.id = uid and u.status = 'active';
  if sid is null then
    raise exception 'no_space' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_space s where s.id = sid and s.couple_state <> 'not_joined') then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  update public.invite i set expires_at = now()
  where i.space_id = sid and i.used_at is null and i.expires_at > now();
  return query select c.code, c.expires_at from public.create_invite() c;
end;
$$;

revoke execute on function public.renew_invite() from public, anon;
grant execute on function public.renew_invite() to authenticated;
