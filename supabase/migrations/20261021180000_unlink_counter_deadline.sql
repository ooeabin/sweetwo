-- 연결 해제: 다르게 정리하기(S-12e → 요청자 S-12f), 기한 2일 전 알림, 기한이 되면 기본안 확정.
-- 08 부부·제안·권한 3장, 25 S-12d 7번, 14 알림 ‘연결 해제 기본안 적용 예정’.
--
-- 다르게 정리하기: 받은 사람이 1회. 같은 항목·금액으로 몫만 바꿈(counter의 mine = 요청한 사람 몫, plan과 같은 뜻).
-- 요청한 사람이 S-12f에서 ‘동의해요’면 그 안으로 확정. 거절 버튼은 없음(답하지 않으면 기한에 기본안).
-- 받은 사람이 답한 뒤(다르게 정리하기)에는 요청 취소 불가(‘상대 응답 전’만).
-- 기한: deadline(요청일 + 14일) 오전 9시 작업에서 아직 대기면 기본안(분담 비율, plan 항목 금액 × ratio)으로 확정.

alter table public.couple_unlink
  add column counter jsonb check (counter is null or jsonb_typeof(counter) = 'array'),
  add column counter_at timestamptz;

-- 기본안: plan 항목마다 요청자 몫 = 금액 × 분담 비율(1만 원 단위 반올림)
-- (행 타입을 받으면 PostgREST가 계산 열로 보여서 plan, ratio를 따로 받음)
create or replace function public.unlink_default_plan(p_plan jsonb, p_ratio integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(e || jsonb_build_object('mine', public.unlink_share((e->>'amount')::bigint, p_ratio))), '[]'::jsonb)
  from jsonb_array_elements(p_plan) e;
$$;
revoke execute on function public.unlink_default_plan(jsonb, integer) from public, anon, authenticated;

-- S-12e 보내기(받은 사람, 1회). p_shares = { "<asset_id>": 받은 사람 몫 } (없는 항목은 지금 안 그대로)
create or replace function public.counter_unlink(p_shares jsonb)
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
  items jsonb := '[]'::jsonb;
  e jsonb;
  v jsonb;
  amt bigint;
  theirs bigint;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'object' then
    raise exception 'invalid_shares' using errcode = '22023';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into u from public.couple_unlink where space_id = me.space_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.requested_by = uid then
    raise exception 'not_partner' using errcode = '42501';
  end if;
  if u.counter is not null then
    raise exception 'already_countered' using errcode = 'P0001';
  end if;
  for e in select x from jsonb_array_elements(u.plan) x loop
    amt := (e->>'amount')::bigint;
    v := p_shares -> (e->>'asset_id');
    if v is null or jsonb_typeof(v) = 'null' then
      items := items || jsonb_build_array(e);
    elsif jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^\d+$' then
      raise exception 'invalid_shares' using errcode = '22023';
    else
      theirs := (v #>> '{}')::bigint;
      if theirs > amt then
        raise exception 'invalid_shares' using errcode = '22023';
      end if;
      items := items || jsonb_build_array(e || jsonb_build_object('mine', amt - theirs));
    end if;
  end loop;
  update public.couple_unlink set counter = items, counter_at = now() where id = u.id;
  perform public.notify(
    u.requested_by, u.space_id, 'unlink_countered',
    coalesce(me.nickname, '') || '님이 자산 정리 안을 다르게 정리했어요',
    '동의하면 바로, 아니면 ' || public.md_label(u.deadline) || '에 분담 비율로 정리돼요',
    '/settings/couple/unlink/counter', null, uid, 'unlink:' || u.id || ':countered');
end;
$$;
revoke execute on function public.counter_unlink(jsonb) from public, anon;
grant execute on function public.counter_unlink(jsonb) to authenticated;

-- S-12f ‘동의해요’(요청한 사람) → 다르게 정리한 안으로 확정
create or replace function public.accept_counter_unlink()
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
  select * into me from public.app_user where id = uid and status = 'active';
  select * into u from public.couple_unlink where space_id = me.space_id and status = 'pending';
  if u.id is null or u.counter is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.requested_by <> uid then
    raise exception 'not_requester' using errcode = '42501';
  end if;
  perform public.confirm_unlink(u.id, u.counter, 'counter');
end;
$$;
revoke execute on function public.accept_counter_unlink() from public, anon;
grant execute on function public.accept_counter_unlink() to authenticated;

-- 요청 취소: 받은 사람이 답하기 전(다르게 정리하기 전)만
create or replace function public.cancel_unlink()
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
  other uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into u from public.couple_unlink
    where space_id = me.space_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.requested_by <> uid then
    raise exception 'not_requester' using errcode = '42501';
  end if;
  if u.counter is not null then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  update public.couple_unlink set status = 'cancelled', cancelled_at = now() where id = u.id;
  update public.couple_space set couple_state = 'connected'
    where id = u.space_id and couple_state = 'unlink_pending';
  select id into other from public.app_user
    where space_id = u.space_id and status = 'active' and id <> uid limit 1;
  if other is not null then
    perform public.notify(
      other, u.space_id, 'unlink_cancelled',
      coalesce(me.nickname, '') || '님이 연결 해제 요청을 취소했어요', null,
      '/settings/couple', null, uid, 'unlink:' || u.id || ':cancelled');
  end if;
end;
$$;

-- 매일 오전 9시(한국): 기한 2일 전 알림(둘 다, 1회), 기한이 된 대기 요청은 기본안으로 확정
create or replace function public.run_unlink_deadlines()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u public.couple_unlink;
  today date := public.kst_today();
begin
  for u in select * from public.couple_unlink where status = 'pending' and deadline = today + 2 loop
    perform public.notify(u.requested_by, u.space_id, 'unlink_deadline',
      public.md_label(u.deadline) || '에 분담 비율로 정리돼요', '다르게 정리하려면 지금 확인해 주세요',
      '/settings/couple', null, null, 'unlink:' || u.id || ':deadline:' || u.requested_by);
    if u.partner_id is not null then
      perform public.notify(u.partner_id, u.space_id, 'unlink_deadline',
        public.md_label(u.deadline) || '에 분담 비율로 정리돼요', '다르게 정리하려면 지금 확인해 주세요',
        '/settings/couple/unlink/review', null, null, 'unlink:' || u.id || ':deadline:' || u.partner_id);
    end if;
  end loop;
  for u in select * from public.couple_unlink where status = 'pending' and deadline <= today loop
    perform public.confirm_unlink(u.id, public.unlink_default_plan(u.plan, u.ratio), 'deadline');
  end loop;
end;
$$;
revoke execute on function public.run_unlink_deadlines() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('unlink-deadlines', '0 0 * * *', 'select public.run_unlink_deadlines()');
  end if;
end;
$$;
