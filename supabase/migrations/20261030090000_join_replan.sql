-- 배우자 합류 재기획(18, 2026-10-25): P-03 이름 → P-03a 출생연도 → P-04 관리 방식 확인 → P-05 월급 → P-06 분배표.
-- 합류 완료 = P-06 저장(시작한 사람이 아직 온보딩 중이면 P-05 저장). 따로 완료 화면(P-11) 없음.

-- 합류 알림 문구(14)
create or replace function public.notify_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  joiner public.app_user;
begin
  if old.couple_state = 'not_joined' and new.couple_state = 'connected' then
    select * into joiner from public.app_user
      where space_id = new.id and status = 'active' and id <> new.created_by limit 1;
    if joiner.id is null or new.created_by is null then return new; end if;
    perform public.notify(
      new.created_by, new.id, 'partner_joined',
      coalesce(joiner.nickname, new.partner_nickname, '배우자') || '님이 합류했어요',
      '이제 목표와 월급을 같이 봐요', '/', null, joiner.id, 'joined:' || new.id || ':' || joiner.id);
  end if;
  return new;
end;
$$;

-- 합류 중인 사람(초대 코드를 쓴 사람)의 공간. 아니면 오류
create or replace function public.joining_space()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  select space_id into sid from public.app_user where id = uid and status = 'active';
  if sid is null or not exists (select 1 from public.invite i where i.space_id = sid and i.used_by = uid) then
    raise exception 'not_joining' using errcode = '42501';
  end if;
  return sid;
end;
$$;
revoke all on function public.joining_space() from public, anon, authenticated;

-- P-04: 합류 중 관리 방식을 바꾸면 바로 적용(18 P-04). 합류한 사람 분배표·체크리스트는 아직 없음.
-- 각자 → 합쳐서: 시작한 사람 분배표·체크리스트가 공동 것이 됨. 합쳐서 → 각자: 시작한 사람 것으로 남음. 시작한 사람에게 알림
create or replace function public.set_join_salary_mode(p_mode public.salary_mode)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
  sp public.couple_space;
  starter public.app_user;
  me public.app_user;
begin
  select * into sp from public.couple_space where id = sid for update;
  if sp.salary_mode = p_mode then
    return;
  end if;
  select * into starter from public.app_user where id = sp.created_by;
  select * into me from public.app_user where id = uid;
  if p_mode = 'joint' then
    update public.salary_split set owner_user_id = null where space_id = sid and owner_user_id = starter.id;
    update public.pay_checklist set owner_user_id = null where space_id = sid and owner_user_id = starter.id;
    -- 기준일은 joint_cycle_day가 비어 있으면 두 사람 월급날 중 늦은 날(cycle_day)
    update public.couple_space set salary_mode = 'joint' where id = sid;
  else
    update public.salary_split set owner_user_id = starter.id where space_id = sid and owner_user_id is null;
    update public.pay_checklist set owner_user_id = starter.id where space_id = sid and owner_user_id is null;
    update public.couple_space set salary_mode = 'separate' where id = sid;
  end if;
  if starter.id is not null then
    perform public.notify(
      starter.id, sid, 'salary_mode',
      coalesce(me.nickname, '배우자') || '님이 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '합쳐서 같이 관리해요' else '각자 월급을 따로 관리해요' end,
      '/salary/split', null, uid, 'join_mode:' || sid || ':' || uid || ':' || p_mode);
  end if;
end;
$$;
revoke all on function public.set_join_salary_mode(public.salary_mode) from public, anon;
grant execute on function public.set_join_salary_mode(public.salary_mode) to authenticated;

-- 합류 완료. p_lines가 있으면 P-06 분배표 저장(각자 = 내 분배표 + 첫 체크리스트, 합쳐서 = 공동 분배표 고침 + 이번 체크리스트 맞춤),
-- 없으면 대기(시작한 사람이 아직 온보딩 중, P-05 저장 순간). p_version = P-06을 열 때 공동 분배표 버전(바뀌었으면 split_changed)
create or replace function public.complete_join(p_lines jsonb default null, p_version integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
  mode public.salary_mode;
  v integer;
begin
  select salary_mode into mode from public.couple_space where id = sid;
  if p_lines is not null then
    if mode = 'joint' then
      select version into v from public.salary_split where space_id = sid and owner_user_id is null;
      if p_version is not null and v is distinct from p_version then
        raise exception 'split_changed' using errcode = '40001';
      end if;
      perform public.save_split(p_lines, null);
      perform public.start_checklist(null);
    else
      perform public.save_split(p_lines, uid);
      perform public.start_checklist(uid);
    end if;
  end if;
  update public.couple_space set couple_state = 'connected' where id = sid and couple_state = 'not_joined';
  update public.invite set used_at = coalesce(used_at, now()) where space_id = sid and used_by = uid;
  update public.app_user
    set onboarding_step = case when p_lines is null then 'P-WAIT' else 'P-06' end,
        onboarding_done_at = coalesce(onboarding_done_at, now())
    where id = uid;
  -- 시작한 사람이 대신 입력한 내 명의 자산·부채는 내 것으로(P-02b 동의 뒤)
  update public.asset set owner_user_id = uid
    where space_id = sid and owner = 'person' and owner_user_id is null and created_by <> uid;
end;
$$;
revoke all on function public.complete_join(jsonb, integer) from public, anon;
grant execute on function public.complete_join(jsonb, integer) to authenticated;

-- 시작한 사람이 온보딩을 마치면(O-60) 기다리던 배우자에게 “{찬우}님이 첫 목표를 정했어요”(18 ‘시작한 사람이 아직 온보딩 중’ 4번)
create or replace function public.notify_first_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting public.app_user;
begin
  if old.onboarding_done_at is null and new.onboarding_done_at is not null and new.space_id is not null then
    select * into waiting from public.app_user
      where space_id = new.space_id and id <> new.id and status = 'active' and onboarding_step = 'P-WAIT' limit 1;
    if waiting.id is not null then
      perform public.notify(
        waiting.id, new.space_id, 'first_goal',
        coalesce(new.nickname, '배우자') || '님이 첫 목표를 정했어요',
        '이어서 내 분배표를 만들어요', '/join/p-04', null, new.id, 'first_goal:' || new.space_id);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_first_goal() from public, anon, authenticated;
create trigger app_user_first_goal after update of onboarding_done_at on public.app_user
  for each row execute function public.notify_first_goal();

-- P-02b(사전 입력 확인)는 시작한 사람이 대신 입력한 내 명의 자산·부채가 있을 때만(18 P-02b)
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
    onboarding_step = case when exists (
        select 1 from public.asset a where a.space_id = i.space_id and a.owner = 'person'
          and a.owner_user_id is null and a.deleted_at is null and a.created_by <> uid
      ) then 'P-02B' else 'P-03' end,
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

-- P-02b ‘지우고 새로 입력할게요’: 시작한 사람이 대신 입력한 내 명의 자산·부채를 휴지통으로
create or replace function public.discard_prefill()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
begin
  update public.asset set deleted_at = now(), deleted_by = uid
    where space_id = sid and owner = 'person' and owner_user_id is null and created_by <> uid and deleted_at is null;
end;
$$;
revoke all on function public.discard_prefill() from public, anon;
grant execute on function public.discard_prefill() to authenticated;
