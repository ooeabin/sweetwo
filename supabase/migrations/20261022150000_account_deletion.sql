-- 계정 삭제(25 S-18·S-18b, 31 보안·개인정보 3-2, 15 A-02 ‘계정 삭제를 취소할까요?’)와 사용 기록 보내기(S-18 8번).
--
-- 삭제 요청: 가입 소셜로 다시 로그인한 지 10분 안에만. 바로 이용 중지(status = deletion_requested, 공간 정책이 막음).
--   미합류·혼자 쓰기: 공간은 그대로 두고 30일 뒤 함께 지움. 쓰지 않은 초대 코드는 만료.
--   연결·해제 대기: 연결 해제처럼 나눔(confirm_unlink, how = 'deleted'). 정리 안 = 공동 항목 전부 상대에게(내 몫 0).
--     상대는 혼자 쓰기로 이어가고 알림 “찬우님이 계정을 삭제했어요” / “이제 혼자 쓰기로 이어져요”. 열린 해제 요청은 취소.
-- 삭제 취소(30일 안 다시 로그인): 이용 재개(혼자 쓰기). 연결돼 있던 배우자가 있으면 그때부터 30일 다시 연결 가능 + 상대 알림.
-- 30일 뒤: 내 공간(혼자면)과 내가 낀 해제 기록·보관 공간, 계정(auth.users)을 지움.

alter table public.couple_unlink drop constraint if exists couple_unlink_how_check;
alter table public.couple_unlink add constraint couple_unlink_how_check
  check (how in ('agreed', 'counter', 'deadline', 'deleted'));

-- S-18 8번 ‘사용 기록 보내기’(analytics_off 반대): 본인이 고침(이미 허용됨)

-- 확정 알림: 계정 삭제로 나눌 때는 상대에게만 다른 문구
create or replace function public.confirm_unlink(p_id uuid, p_plan jsonb, p_how text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u public.couple_unlink;
  nr uuid;
  nq uuid;
  r public.app_user;
  q public.app_user;
begin
  select * into u from public.couple_unlink where id = p_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  select * into r from public.app_user where id = u.requested_by;
  select * into q from public.app_user where id = u.partner_id;
  update public.couple_unlink set status = 'confirmed', confirmed_at = now(), final_plan = p_plan, how = p_how,
    reconnect_until = now() + interval '30 days'
    where id = u.id;
  nr := public.unlink_make_space(u, r.id, true, p_plan);
  if q.id is not null and q.space_id = u.space_id then
    nq := public.unlink_make_space(u, q.id, false, p_plan);
  end if;
  -- 원래 공간: 해제 전 공동 데이터 보관(30일), 구성원 없음
  update public.couple_space set couple_state = 'solo', deleted_at = now() where id = u.space_id;

  if p_how = 'deleted' then
    if nq is not null then
      perform public.notify(q.id, nq, 'partner_deleted',
        coalesce(r.nickname, '') || '님이 계정을 삭제했어요', '이제 혼자 쓰기로 이어져요',
        '/settings/couple', null, r.id, 'unlink:' || u.id || ':deleted:' || q.id);
    end if;
    return;
  end if;
  perform public.notify(r.id, nr, 'unlink_confirmed', '연결이 해제됐어요', '30일 안에 다시 연결할 수 있어요',
    '/settings/couple/unlinked', null, null, 'unlink:' || u.id || ':confirmed:' || r.id);
  if nq is not null then
    perform public.notify(q.id, nq, 'unlink_confirmed', '연결이 해제됐어요', '30일 안에 다시 연결할 수 있어요',
      '/settings/couple/unlinked', null, null, 'unlink:' || u.id || ':confirmed:' || q.id);
  end if;
end;
$$;
revoke execute on function public.confirm_unlink(uuid, jsonb, text) from public, anon, authenticated;

-- S-18b 삭제. 돌려주는 값 = 이 날까지 다시 로그인하면 취소할 수 있는 날(한국 날짜)
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
  old_req public.couple_unlink;
  items jsonb := '[]'::jsonb;
  nid uuid;
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
    -- 열린 해제 요청은 취소하고, 공동 항목 전부 상대에게로 나눔
    select * into old_req from public.couple_unlink where space_id = sp.id and status = 'pending';
    if old_req.id is not null then
      update public.couple_unlink set status = 'cancelled', cancelled_at = now() where id = old_req.id;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
        'asset_id', a.id, 'name', a.name, 'amount', a.amount, 'mine', 0, 'side', a.side)
        order by a.side, a.created_at, a.id), '[]'::jsonb)
      into items
      from public.asset a
      where a.space_id = sp.id and a.owner = 'joint' and a.status = 'held' and a.deleted_at is null and a.amount > 0;
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan)
      values (sp.id, uid, other, public.kst_today(), 0, items)
      returning id into nid;
    perform public.confirm_unlink(nid, items, 'deleted');
  elsif sp.id is not null then
    update public.invite set expires_at = now() where space_id = sp.id and used_at is null and expires_at > now();
  end if;

  update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = uid;
  return (now() at time zone 'Asia/Seoul')::date + 30;
end;
$$;
revoke execute on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- A-02 ‘취소하고 계속 쓰기’
create or replace function public.cancel_account_deletion()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  u public.couple_unlink;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'deletion_requested' for update;
  if me.id is null or me.deletion_requested_at < now() - interval '30 days' then
    raise exception 'not_requested' using errcode = 'P0001';
  end if;
  update public.app_user set status = 'active', deletion_requested_at = null where id = uid;
  -- 연결돼 있던 배우자: 지금부터 30일 다시 연결 가능 + 알림
  select * into u from public.couple_unlink
    where requested_by = uid and how = 'deleted' and status = 'confirmed'
      and confirmed_at >= me.deletion_requested_at - interval '1 minute'
    order by confirmed_at desc limit 1;
  if u.id is not null then
    update public.couple_unlink set reconnect_until = now() + interval '30 days' where id = u.id;
    perform public.notify(u.partner_id, (select space_id from public.app_user where id = u.partner_id),
      'partner_restored', coalesce(me.nickname, '') || '님이 계정 삭제를 취소했어요',
      '30일 안에 다시 연결할 수 있어요', '/settings/couple', null, uid,
      'unlink:' || u.id || ':restored:' || extract(epoch from now())::bigint);
  end if;
end;
$$;
revoke execute on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;

-- 매일: 삭제 요청 30일 지난 계정 지우기
create or replace function public.purge_deleted_accounts()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me public.app_user;
  u public.couple_unlink;
begin
  for me in select * from public.app_user
            where status = 'deletion_requested' and deletion_requested_at < now() - interval '30 days' loop
    -- 내가 낀 해제 기록과 그 보관 공간(구성원이 없을 때)
    for u in select * from public.couple_unlink
             where requested_by = me.id or partner_id = me.id or reconnect_by = me.id loop
      delete from public.couple_space s where s.id = u.space_id and s.deleted_at is not null
        and not exists (select 1 from public.app_user m where m.space_id = s.id);
      delete from public.couple_unlink where id = u.id;
    end loop;
    -- 혼자 있는 내 공간
    if me.space_id is not null and not exists (
        select 1 from public.app_user m where m.space_id = me.space_id and m.id <> me.id) then
      update public.app_user set space_id = null where id = me.id;
      delete from public.couple_space where id = me.space_id;
    end if;
    delete from auth.users where id = me.id;
  end loop;
end;
$$;
revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-deleted-accounts', '15 19 * * *', 'select public.purge_deleted_accounts()');
  end if;
end;
$$;
