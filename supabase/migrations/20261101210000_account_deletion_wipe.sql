-- 계정 삭제(탈퇴) = 데이터 모두 지움(2026-10-26 결정). 연결된 부부면 연결 해제 확정과 같게:
-- 두 사람 모두 빈 새 공간(혼자 쓰기, 상대는 S-12h → 온보딩 O-11부터), 원래 공간과 같이 쓰던 데이터는 30일 보관 뒤 지움.
-- 삭제를 취소하면 그때부터 30일 안 다시 연결 가능(원래 공간으로 되돌림). 다시 연결은 해제 때와 같은 규칙으로 돌림.

create or replace function public.request_account_deletion()
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  sp public.couple_space;
  other uuid;
  ns uuid;
  x uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if me.id is null then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  if coalesce((select last_sign_in_at from auth.users where id = uid), '-infinity') < now() - interval '10 minutes' then
    raise exception 'reauth_required' using errcode = 'P0001';
  end if;
  select * into sp from public.couple_space where id = me.space_id for update;
  select id into other from public.app_user
    where space_id = sp.id and status = 'active' and id <> uid limit 1;

  if sp.id is not null and other is not null and sp.couple_state in ('connected', 'unlink_pending') then
    -- 연결 해제 확정과 같음: 두 사람 모두 빈 새 공간으로, 원래 공간(같이 쓰던 데이터 전부)은 30일 보관 뒤 지움
    update public.couple_unlink set status = 'cancelled', cancelled_at = now()
      where space_id = sp.id and status = 'pending';
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan, status, how, confirmed_at,
                                      reconnect_until)
      values (sp.id, uid, other, public.kst_today(), 50, '[]'::jsonb, 'confirmed', 'deleted', now(),
              now() + interval '30 days');
    delete from public.notification where space_id = sp.id;
    delete from public.partner_change where space_id = sp.id;
    foreach x in array array[uid, other] loop
      insert into public.couple_space (couple_state, created_by, unlinked_from)
        values ('solo', x, sp.id) returning id into ns;
      update public.app_user set space_id = ns, onboarding_step = 'S-12H' where id = x;
    end loop;
    update public.couple_space set couple_state = 'solo', deleted_at = now() where id = sp.id;
    perform public.notify(other, (select space_id from public.app_user where id = other), 'partner_deleted',
      coalesce(me.nickname, '') || '님이 계정을 삭제했어요', '같이 쓰던 데이터는 지웠어요', '/settings/couple/unlinked',
      'user-minus', null, 'deleted:' || uid || ':' || extract(epoch from now())::bigint);
  elsif sp.id is not null then
    update public.invite set expires_at = now() where space_id = sp.id and used_at is null and expires_at > now();
  end if;

  update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = uid;
  return (now() at time zone 'Asia/Seoul')::date + 30;
end;
$$;

-- 다시 연결: 계정 삭제도 두 사람 모두 해제 공간에 있으니 해제와 같은 규칙
create or replace function public.my_unlink()
returns setof public.couple_unlink
language sql
stable
security definer
set search_path = ''
as $$
  select u.* from public.couple_unlink u
  join public.couple_space s on s.unlinked_from = u.space_id
  join public.app_user me on me.space_id = s.id and me.id = auth.uid()
  where u.status = 'confirmed' and (u.requested_by = me.id or u.partner_id = me.id)
  order by u.confirmed_at desc limit 1;
$$;

create or replace function public.reconnect_ok(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select u.status = 'confirmed' and u.reconnect_until > now()
    and (select count(*) from public.app_user m
         join public.couple_space s on s.id = m.space_id
         where m.id in (u.requested_by, u.partner_id) and m.status = 'active'
           and s.unlinked_from = u.space_id and s.deleted_at is null
           and s.couple_state in ('solo', 'not_joined')
           and (select count(*) from public.app_user o where o.space_id = s.id and o.status = 'active') = 1) = 2
  from public.couple_unlink u where u.id = p_id;
$$;
revoke execute on function public.reconnect_ok(uuid) from public, anon, authenticated;

create or replace function public.answer_reconnect(p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u public.couple_unlink;
  s uuid;
  x uuid;
  n uuid;
  who text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into u from public.couple_unlink where id = (select m.id from public.my_unlink() m) for update;
  if u.id is null or u.reconnect_by is null or u.reconnect_answer is not null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.reconnect_by = uid then
    raise exception 'not_partner' using errcode = '42501';
  end if;
  if not p_accept then
    update public.couple_unlink set reconnect_answer = 'declined' where id = u.id;
    return;
  end if;
  if not coalesce(public.reconnect_ok(u.id), false) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  s := u.space_id;
  foreach x in array array[u.requested_by, u.partner_id] loop
    select space_id into n from public.app_user where id = x;
    update public.app_user
      set space_id = s, onboarding_step = 'O-60', onboarding_done_at = coalesce(onboarding_done_at, now())
      where id = x;
    delete from public.couple_space where id = n and unlinked_from = s;
  end loop;
  update public.couple_space set couple_state = 'connected', deleted_at = null where id = s;
  update public.couple_unlink
    set reconnect_answer = 'accepted', status = 'reconnected', reconnected_at = now()
    where id = u.id;
  select coalesce(nickname, '') into who from public.app_user where id = uid;
  perform public.notify(
    u.reconnect_by, s, 'reconnected', who || '님과 다시 연결됐어요', '해제 전 같이 쓰던 목표와 분배표가 돌아왔어요',
    '/', null, uid, 'reconnect:' || u.id || ':accepted');
end;
$$;
