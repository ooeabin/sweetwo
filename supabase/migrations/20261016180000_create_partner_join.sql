-- 배우자 합류(docs/spec/18-partner-join.md, 15-login-signup.md A-07)
-- 초대 미리보기(로그인 전) → 합류(공간에 들어감, 코드 예약) → P-03~P-08 → 합류 완료(부부 연결, 코드 사용됨)

-- 잘못 넣은 코드 횟수(5회 오류면 10분 제한)
create table public.invite_attempt (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index invite_attempt_user_idx on public.invite_attempt (user_id, created_at desc);
alter table public.invite_attempt enable row level security; -- 정책 없음: 함수만 읽고 씀
revoke all on public.invite_attempt from authenticated, anon;

-- 초대 미리보기(P-01, A-07): 로그인 전에도 “{나}님이 초대했어요”를 보여 준다. 초대한 사람 호칭과 상태만
create or replace function public.invite_preview(p_code text)
returns table (inviter_nickname text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  i public.invite;
  nick text;
begin
  select * into i from public.invite where code = upper(btrim(p_code));
  if not found then
    return query select null::text, 'invalid'::text;
    return;
  end if;
  select u.nickname into nick from public.app_user u
    where u.id = i.created_by and u.status = 'active' and u.space_id = i.space_id;
  if nick is null then
    return query select null::text, 'unavailable'::text;
  elsif i.used_at is not null then
    return query select nick, 'used'::text;
  elsif i.expires_at <= now() then
    return query select nick, 'expired'::text;
  else
    return query select nick, 'ok'::text;
  end if;
end;
$$;
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- 합류(P-01 ‘합류하기’): 초대 공간에 들어가고 코드를 이 사람 몫으로 잡아 둔다(완료 전 이탈하면 같은 코드로 이어서).
-- 돌려주는 값: joined | resume | invalid | locked | expired | used | unavailable | own_code | already_connected | has_records
create or replace function public.join_space(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  i public.invite;
  s public.couple_space;
  starter public.app_user;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if not found then
    raise exception 'not_signed_up' using errcode = 'P0001';
  end if;
  if (select count(*) from public.invite_attempt a where a.user_id = uid and a.created_at > now() - interval '10 minutes') >= 5 then
    return 'locked';
  end if;
  select * into i from public.invite where code = upper(btrim(p_code)) for update;
  if not found then
    insert into public.invite_attempt (user_id) values (uid);
    return 'invalid';
  end if;
  select * into s from public.couple_space where id = i.space_id;
  select * into starter from public.app_user where id = i.created_by and status = 'active' and space_id = i.space_id;
  if s.id is null or starter.id is null then
    return 'unavailable';
  end if;
  if i.used_by = uid and me.space_id = i.space_id then
    return 'resume'; -- 합류 도중 이탈 뒤 같은 코드
  end if;
  if i.used_at is not null or (i.used_by is not null and i.used_by <> uid) then
    return 'used';
  end if;
  if i.expires_at <= now() then
    return 'expired';
  end if;
  if me.space_id = i.space_id then
    return 'own_code';
  end if;
  if s.couple_state <> 'not_joined' then
    return 'used';
  end if;
  if me.space_id is not null then
    if exists (select 1 from public.couple_space x where x.id = me.space_id and x.couple_state = 'connected') then
      return 'already_connected';
    end if;
    -- 혼자 시작한 기록이 있으면 옮기기(P-02a)를 거쳐야 한다
    if me.onboarding_done_at is not null or exists (
      select 1 from public.goal g where g.space_id = me.space_id and g.deleted_at is null
    ) then
      return 'has_records';
    end if;
  end if;

  update public.invite set used_by = uid where id = i.id;
  update public.app_user set
    space_id = i.space_id,
    side = case starter.side when 'groom' then 'bride'::public.couple_side when 'bride' then 'groom'::public.couple_side else me.side end,
    nickname = coalesce(me.nickname, s.partner_nickname),
    monthly_income = coalesce(me.monthly_income, s.partner_income),
    onboarding_step = case when s.partner_income is not null then 'P-02B' else 'P-03' end,
    onboarding_done_at = null
  where id = uid;
  -- 비어 있던 내 공간은 지운다(다른 사람이 없을 때만)
  if me.space_id is not null and not exists (
    select 1 from public.app_user u where u.space_id = me.space_id and u.id <> uid
  ) then
    delete from public.couple_space where id = me.space_id;
  end if;
  return 'joined';
end;
$$;
revoke execute on function public.join_space(text) from public, anon;
grant execute on function public.join_space(text) to authenticated;

-- 합류 완료(P-11): 부부 연결, 코드 사용됨, 합류한 사람 온보딩 끝
create or replace function public.finish_join()
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
  select space_id into sid from public.app_user where id = uid and status = 'active';
  if sid is null or not exists (
    select 1 from public.invite i where i.space_id = sid and i.used_by = uid
  ) then
    raise exception 'not_joining' using errcode = '42501';
  end if;
  update public.couple_space set couple_state = 'connected' where id = sid and couple_state = 'not_joined';
  update public.invite set used_at = coalesce(used_at, now()) where space_id = sid and used_by = uid;
  update public.app_user set onboarding_step = 'P-11', onboarding_done_at = coalesce(onboarding_done_at, now())
    where id = uid;
end;
$$;
revoke execute on function public.finish_join() from public, anon;
grant execute on function public.finish_join() to authenticated;

-- 배우자 프로필(같은 공간 다른 사람). 분담 계산에 쓰는 값만(수입, 월급날, 용돈은 공개 범위 없음 → 18 P-02a)
create or replace function public.partner_profile()
returns table (
  id uuid,
  nickname text,
  side public.couple_side,
  employment public.employment,
  monthly_income bigint,
  income_variable boolean,
  payday smallint,
  payday_last boolean,
  allowance bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, p.side, p.employment, p.monthly_income, p.income_variable, p.payday, p.payday_last, p.allowance
  from public.app_user me
  join public.app_user p on p.space_id = me.space_id and p.id <> me.id and p.status = 'active'
  where me.id = auth.uid() and me.space_id is not null
  limit 1;
$$;
revoke execute on function public.partner_profile() from public, anon;
grant execute on function public.partner_profile() to authenticated;

-- 합류 뒤 이번 플랜의 안 나눈 줄 분담액만 다시 계산(P-11, 07 1장). 금액과 이미 나눈 줄은 그대로
create or replace function public.update_pending_shares(p_plan_id uuid, p_shares jsonb, p_is_temp boolean)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid;
  n integer := 0;
  x jsonb;
begin
  select space_id into sid from public.app_user where id = auth.uid() and status = 'active';
  if sid is null or not exists (select 1 from public.monthly_plan p where p.id = p_plan_id and p.space_id = sid) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  for x in select * from jsonb_array_elements(p_shares) loop
    update public.plan_line l set
      amount_groom = (x->>'amount_groom')::bigint,
      amount_bride = (x->>'amount_bride')::bigint
    where l.plan_id = p_plan_id and l.target = 'account' and l.state = 'pending' and l.deleted_at is null
      and l.account_role = (x->>'account_role')::public.account_role;
    n := n + 1;
  end loop;
  update public.monthly_plan set is_temp = p_is_temp where id = p_plan_id;
  return n;
end;
$$;
revoke execute on function public.update_pending_shares(uuid, jsonb, boolean) from public, anon;
grant execute on function public.update_pending_shares(uuid, jsonb, boolean) to authenticated;
