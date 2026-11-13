-- 기획 검토 2차(2026-11-09 사용자 결정, ADR 0007 고침): docs/spec/20-salary-plan.md ‘저금 항목’, 06 4-1, 08 4장.
-- 스키마는 추가만.
--
-- 1. goal.start_saved: 만들 때만 넣는 ‘이미 모은 돈’(W-11c 선택 칸). 모은 돈 = 시작할 때 모은 돈 + 체크한 저금 합.
--    앱이 바로 고칠 수 없음(grant update 열 목록에 없음). 예전 이미 모은 돈(other_held)은 그대로 안 셈. 옮길 데이터 없음(기본 0)
-- 2. add_saving_item에 p_start(기본 0). 0 아래·상한 위·목표 금액 이상이면 bad_start. 인자가 바뀌어 옛 4개짜리는 지움
-- 3. 각자 모드 파트너 월급 계획은 보기만: save_split이 파트너 월급 계획이면 not_owner(예전 파트너 저금 줄만 잠금 locked_line 대신).
--    체크리스트(check_pay_line)와 저금 항목(goal RLS, saving_item_editable)은 이미 주인만
-- 4. 사용자에게 보이는 말 ‘저금 항목’ → ‘저금’(파트너 변경 알림 제목·본문)

alter table public.goal add column start_saved bigint not null default 0
  check (start_saved between 0 and 99999999999);

create or replace function public.goal_saved(p_goal uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce((select g.start_saved from public.goal g where g.id = p_goal), 0)
    + coalesce((select sum(coalesce(l.actual, l.planned)) from public.pay_check_line l
                where l.goal_id = p_goal and l.kind = 'saving' and l.state = 'checked'), 0))::bigint;
$$;
revoke all on function public.goal_saved(uuid) from public, anon, authenticated;

drop function public.add_saving_item(text, bigint, bigint, date);
create or replace function public.add_saving_item(
  p_name text, p_monthly bigint, p_target bigint default null, p_deadline date default null, p_start bigint default 0)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sp public.couple_space;
  owner uuid;
  split uuid;
  gid uuid;
  nm text := btrim(coalesce(p_name, ''));
  st bigint := coalesce(p_start, 0);
begin
  select c.* into sp from public.couple_space c
    join public.app_user u on u.space_id = c.id where u.id = uid;
  if sp.id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if char_length(nm) < 1 or char_length(nm) > 20 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if p_monthly is null or p_monthly < 0 or p_monthly > 99999999999 or p_monthly % 10000 <> 0 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_target is not null and (p_target < 1 or p_target > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if st < 0 or st > 99999999999 or (p_target is not null and st >= p_target) then
    raise exception 'bad_start' using errcode = '22023';
  end if;
  if p_deadline is not null and (p_target is null
      or p_deadline < date_trunc('month', public.kst_today())::date) then
    raise exception 'bad_deadline' using errcode = '22023';
  end if;
  owner := case when sp.salary_mode = 'joint' then null else uid end;
  select id into split from public.salary_split
    where space_id = sp.id and owner_user_id is not distinct from owner;
  if split is null then
    raise exception 'no_split' using errcode = '22023';
  end if;
  insert into public.goal (space_id, template, name, kind, priority, target_amount, deadline, owner_user_id, created_by, start_saved)
    values (sp.id, 'custom', nm, 'once',
      coalesce((select max(priority) + 1 from public.goal where space_id = sp.id), 1),
      p_target, case when p_deadline is null then null else date_trunc('month', p_deadline)::date end, owner, uid, st)
    returning id into gid;
  if p_monthly > 0 then
    update public.split_line set amount = p_monthly where split_id = split and goal_id = gid;
    perform public.sync_checklist(split);
  end if;
  return gid;
end;
$$;
revoke all on function public.add_saving_item(text, bigint, bigint, date, bigint) from public, anon;
grant execute on function public.add_saving_item(text, bigint, bigint, date, bigint) to authenticated;

-- 3. 각자 모드 파트너 월급 계획은 보기만
create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  mode public.salary_mode;
  split uuid;
  l jsonb;
  i integer := 0;
  customs integer := 0;
  k public.split_line_kind;
  old_lines jsonb;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select salary_mode into mode from public.couple_space where id = sid;
  -- 연결 해제 대기 중에는 분배표를 고칠 수 없음(25 ‘연결 해제, 대기와 혼자 쓰기’ 2번)
  if (select couple_state from public.couple_space where id = sid) = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if mode = 'joint' and p_owner is not null then
    raise exception 'joint_split_has_no_owner' using errcode = '22023';
  end if;
  if mode = 'separate' and (p_owner is null
      or not exists (select 1 from public.app_user where id = p_owner and space_id = sid)) then
    raise exception 'bad_owner' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'bad_lines' using errcode = '22023';
  end if;

  select id into split from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  -- 2026-11-09: 각자 모드 파트너 월급 계획은 보기만(쓰는 돈 줄도 못 고침). 예전 ‘파트너 저금 줄만 잠금’ 대신
  if mode = 'separate' and p_owner <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
      into old_lines from public.split_line where split_id = split;
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g
        where g.id = (l->>'goal_id')::uuid and g.space_id = sid and g.deleted_at is null) then
      raise exception 'bad_goal' using errcode = '22023';
    end if;
    if k = 'allowance' and (l->>'user_id') is not null and not exists (
        select 1 from public.app_user where id = (l->>'user_id')::uuid and space_id = sid) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if k = 'custom' then
      customs := customs + 1;
      if customs > 10 then
        raise exception 'too_many_custom' using errcode = '22023';
      end if;
    end if;
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort)
    values (
      split, sid, k,
      case when k = 'saving' then (l->>'goal_id')::uuid end,
      case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end,
      case when k = 'custom' then btrim(l->>'name') end,
      (l->>'amount')::bigint,
      i
    );
    i := i + 1;
  end loop;
  if old_lines is not null then
    perform public.log_split_changes(split, old_lines);
  end if;
  perform public.sync_checklist(split);
  return split;
end;
$$;


-- 4. 파트너 변경 알림 문구: ‘저금 항목’ → ‘저금’
create or replace function public.partner_change_title(p_topic text, p_noun text, who text)
returns text
language sql
immutable
set search_path = ''
as $$
  select who || '님이 ' || case
    when p_topic = 'split' then '월급 계획을 바꿨어요'
    when p_topic = 'income' then '월급을 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta', 'goal_move') then p_noun || ' 저금을 바꿨어요' -- [확인 필요] 2026-11-09 사용자에게는 ‘저금’
    when p_topic = 'asset' then '우리 자산을 바꿨어요'
    when p_topic = 'care' then '챙길 날을 바꿨어요' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날을 바꿨어요'
    when p_topic = 'couple' then '결혼 정보를 바꿨어요' -- [확인 필요]
    else '바꿨어요' end;
$$;


create or replace function public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic = 'split' then p_noun || ' ' || coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic = 'income' then coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic in ('goal', 'goal_meta') and p_field = 'deleted' then '저금을 지웠어요' -- [확인 필요] 2026-11-09
    when p_topic in ('goal', 'goal_meta') and p_field = 'restored' then '저금을 되살렸어요' -- [확인 필요] 2026-11-09
    when p_topic = 'goal_meta' and p_field = 'added' then '저금을 추가했어요' -- [확인 필요] 2026-11-09
    when p_topic = 'goal_meta' and p_field = 'closed' then
      case when p_after = '0' then '다시 모으기로 했어요' else '그만 모으기로 했어요' end -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'order' then '목표 순서를 바꿨어요' -- (예전 기록)
    when p_topic = 'goal_meta' and p_field = 'photo' then '목표 사진을 바꿨어요' -- (예전 기록)
    when p_topic in ('goal', 'goal_meta') then
      case p_field when 'amount' then '목표 금액' when 'deadline' then '기한' when 'name' then '이름'
        when 'status' then '상태' when 'kind' then '형태' when 'owner' then '종류' else p_field end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음')
    when p_topic = 'goal_move' then coalesce(p_after, '') -- (예전 기록)
    when p_topic = 'asset' and p_field = 'amount_hidden' then '개인 자산 금액이 바뀌었어요'
    when p_topic = 'asset' and p_field = 'amount' then p_noun || ' ' || p_before || ' → ' || p_after
    when p_topic = 'asset' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'deleted' then p_noun || ' 삭제' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'restored' then p_noun || ' 되살림' -- [확인 필요]
    when p_topic = 'care' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'care' then p_noun || ' 메모' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날 ' || p_before || ' → ' || p_after -- [확인 필요]
    when p_topic = 'couple' then
      case p_field when 'marriage' then '결혼 상태' else '결혼한 날' end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음') -- [확인 필요]
    else p_noun
  end;
$$;

