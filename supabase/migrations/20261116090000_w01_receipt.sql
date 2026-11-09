-- W-01 월급 계획 영수증(2026-11-09, docs/spec/20-salary-plan.md W-01, 06 3-4·3-5). 스키마는 추가만.
-- 줄마다 바로 저장(‘저장’ 버튼 없음): 줄 하나 금액·이름 바꾸기, 지출 줄 추가, 줄 지우기, 순서 바꾸기 RPC.
-- 권한(모두 split_editable): 각자 = 주인만(not_owner), 합쳐서 = 두 사람 모두, 연결 해제 대기 중 = 막음(unlink_pending).
-- 이번 달 체크리스트: 체크 안 한 줄만 월급 계획을 따르고 체크한 줄은 그대로(sync_checklist). 저금 줄 지우기 = 그만 모음.
-- save_split(줄 통째로 교체)은 그대로 둠(추천값으로 다시 채우기, O-50, 합류).
--
-- 1. 순서 열: split_line.sort(smallint, 처음부터 있던 열)를 그대로 쓰고 새 열은 만들지 않음(같은 뜻의 열이 둘이 되지 않게).
--    지금 순서 정리(backfill): 월급 계획마다 저금 줄(저금 항목 만든 순서) → 지출 줄(지금 순서)
-- 2. sync_checklist: 줄 id로도 맞춤(이름을 바꾼 줄이 이번 달에 두 번 생기지 않게) + 체크한 줄도 월급 계획 순서로
-- 3. split_editable(내부) + split_line_set / split_line_add / split_line_delete / split_reorder
-- 4. 알림: 파트너 변경 기록(partner_change)에 쌓고 flush_partner_changes가 10분 묶음으로 하나만 보냄(그대로).
--    이름 바꾸기 “이름 생활비 → 장보기”, 순서 바꾸기는 활동 기록에만 “월급 계획 순서를 바꿨어요”. 링크는 /salary?view=plan
-- 5. Realtime: salary_split 변경 신호(RPC마다 updated_at·version을 올림) → 앱이 월급 계획·체크리스트를 다시 읽음

-- 1. 순서 정리
with o as (
  select l.id,
    (row_number() over (
      partition by l.split_id
      order by (l.kind <> 'saving'), case when l.kind = 'saving' then g.created_at end, l.sort, l.id
    ) - 1)::smallint as n
  from public.split_line l
  left join public.goal g on g.id = l.goal_id
)
update public.split_line l set sort = o.n from o where o.id = l.id and l.sort <> o.n;

-- 2. 체크리스트 맞추기
create or replace function public.sync_checklist(p_split uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cl uuid;
  today date := public.kst_today();
begin
  select c.id into cl from public.pay_checklist c
    join public.salary_split s on s.id = p_split
    where c.space_id = s.space_id and c.owner_user_id is not distinct from s.owner_user_id
      and c.cycle_start <= today and c.cycle_end >= today;
  if cl is null then
    return;
  end if;
  delete from public.pay_check_line where checklist_id = cl and state = 'wait';
  insert into public.pay_check_line (checklist_id, space_id, split_line_id, kind, goal_id, user_id, name, planned, sort)
    select cl, l.space_id, l.id, l.kind, l.goal_id, l.user_id, l.name, l.amount, l.sort
    from public.split_line l
    where l.split_id = p_split and l.amount > 0
      and not exists (
        select 1 from public.pay_check_line x
        where x.checklist_id = cl
          and (x.split_line_id = l.id or (x.kind = l.kind
            and x.goal_id is not distinct from l.goal_id
            and x.user_id is not distinct from l.user_id
            and x.name is not distinct from l.name)));
  -- 체크·못 함 줄도 월급 계획 순서로(2026-11-09 W-01 순서 바꾸기)
  update public.pay_check_line x set sort = l.sort
    from public.split_line l
    where x.checklist_id = cl and x.split_line_id = l.id and l.split_id = p_split and x.sort <> l.sort;
  update public.pay_checklist set split_id = p_split,
    state = case when exists (select 1 from public.pay_check_line where checklist_id = cl and state = 'wait') then 'open' else 'done' end
    where id = cl;
end;
$$;
revoke all on function public.sync_checklist(uuid) from public, anon, authenticated;

-- 4. 파트너 변경 기록(save_split과 새 RPC가 같이 씀): 링크만 /salary?view=plan
create or replace function public.log_split_changes(p_split uuid, p_old jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sp public.salary_split;
  r record;
begin
  select * into sp from public.salary_split where id = p_split;
  for r in
    with o as (
      select (x->>'kind')::public.split_line_kind as kind, (x->>'goal_id')::uuid as goal_id, (x->>'user_id')::uuid as user_id,
        x->>'name' as name, sum((x->>'amount')::bigint)::bigint as amount
      from jsonb_array_elements(coalesce(p_old, '[]'::jsonb)) x
      group by 1, 2, 3, 4
    ),
    n as (
      select kind, goal_id, user_id, name, sum(amount)::bigint as amount
      from public.split_line where split_id = p_split group by 1, 2, 3, 4
    )
    select coalesce(n.kind, o.kind) as kind, coalesce(n.goal_id, o.goal_id) as goal_id,
      coalesce(n.user_id, o.user_id) as user_id, coalesce(n.name, o.name) as name,
      o.amount as before_amount, n.amount as after_amount
    from o full join n
      on n.kind = o.kind and n.goal_id is not distinct from o.goal_id
      and n.user_id is not distinct from o.user_id and n.name is not distinct from o.name
  loop
    continue when coalesce(r.before_amount, 0) = coalesce(r.after_amount, 0);
    perform public.log_partner_change(sp.space_id, 'split', p_split,
      r.kind || ':' || coalesce(r.goal_id::text, '') || ':' || coalesce(r.user_id::text, '') || ':' || coalesce(r.name, ''),
      public.pay_line_noun(r.kind, r.goal_id, r.name)
        || case when r.kind = 'allowance' and r.user_id is not null and sp.owner_user_id is null
             then '(' || coalesce((select nickname from public.app_user where id = r.user_id), '') || ')' else '' end,
      public.read_won(coalesce(r.before_amount, 0)), public.read_won(coalesce(r.after_amount, 0)), true, '/salary?view=plan');
  end loop;
end;
$$;
revoke all on function public.log_split_changes(uuid, jsonb) from public, anon, authenticated;

create or replace function public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic = 'split' and p_field = 'order' then '월급 계획 순서를 바꿨어요' -- [확인 필요] 2026-11-09 W-01 편집
    when p_topic = 'split' and p_field like 'name:%' then '이름 ' || coalesce(p_before, '') || ' → ' || coalesce(p_after, '') -- [확인 필요]
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
revoke all on function public.partner_change_line(text, text, text, text, text) from public, anon, authenticated;

-- 3. 고칠 수 있는 월급 계획인지(내부). 각자 = 주인만, 합쳐서 = 공동 월급 계획을 두 사람 모두, 대기 중 = 막음
create or replace function public.split_editable(p_split uuid)
returns public.salary_split
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sp public.salary_split;
  cs record;
begin
  select * into sp from public.salary_split where id = p_split;
  if sp.id is null or auth.uid() is null or not public.is_space_member(sp.space_id) then
    raise exception 'no_split' using errcode = '42501';
  end if;
  select couple_state, salary_mode into cs from public.couple_space where id = sp.space_id;
  if cs.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if (cs.salary_mode = 'separate' and sp.owner_user_id is distinct from auth.uid())
     or (cs.salary_mode = 'joint' and sp.owner_user_id is not null) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return sp;
end;
$$;
revoke all on function public.split_editable(uuid) from public, anon, authenticated;

-- 지금 줄(파트너 변경 기록 비교용). p_line의 금액만 p_amount로 바꿔 넣을 수 있음
create or replace function public.split_lines_json(p_split uuid, p_line uuid default null, p_amount bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name,
    'amount', case when id = p_line then p_amount else amount end)), '[]'::jsonb)
  from public.split_line where split_id = p_split;
$$;
revoke all on function public.split_lines_json(uuid, uuid, bigint) from public, anon, authenticated;

-- 고친 사람·때·버전(Realtime 신호, W-02 ‘상대가 월급 계획을 바꿨어요’ 안내)
create or replace function public.split_touch(p_split uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.salary_split set updated_by = auth.uid(), updated_at = now(), version = version + 1 where id = p_split;
$$;
revoke all on function public.split_touch(uuid) from public, anon, authenticated;

create or replace function public.split_amount_ok(p bigint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null and p between 0 and 99999999999 and p % 10000 = 0;
$$;

-- 줄 하나 금액·이름 바꾸기(W-01 금액 시트 ‘확인’). 이름은 직접 추가한 지출 줄만(1~20자, 같은 이름 없음)
create or replace function public.split_line_set(p_line uuid, p_amount bigint default null, p_name text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.split_line;
  sp public.salary_split;
  nm text := nullif(btrim(p_name), '');
  old jsonb;
begin
  select * into l from public.split_line where id = p_line;
  if l.id is null then
    raise exception 'no_split' using errcode = '42501';
  end if;
  sp := public.split_editable(l.split_id);
  if p_amount is not null and not public.split_amount_ok(p_amount) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_name is not null and (l.kind <> 'custom' or nm is null or char_length(nm) > 20) then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if nm is not null and nm is distinct from l.name and exists (
      select 1 from public.split_line where split_id = sp.id and kind = 'custom' and name = nm and id <> l.id) then
    raise exception 'duplicate_line' using errcode = '22023';
  end if;
  if coalesce(p_amount, l.amount) = l.amount and coalesce(nm, l.name) is not distinct from l.name then
    return;
  end if;
  update public.split_line set amount = coalesce(p_amount, amount), name = coalesce(nm, name) where id = l.id;
  -- 금액 비교는 새 이름 기준(이름만 바꾸면 금액 알림 없음), 이름은 따로 한 줄
  old := public.split_lines_json(sp.id, l.id, l.amount);
  perform public.split_touch(sp.id);
  perform public.log_split_changes(sp.id, old);
  if nm is not null and nm is distinct from l.name then
    perform public.log_partner_change(sp.space_id, 'split', sp.id, 'name:' || l.id, l.name, l.name, nm, true, '/salary?view=plan');
  end if;
  perform public.sync_checklist(sp.id);
end;
$$;
revoke all on function public.split_line_set(uuid, bigint, text) from public, anon;
grant execute on function public.split_line_set(uuid, bigint, text) to authenticated;

-- 지출 줄 추가(W-01 ‘+ 지출 추가’). 직접 추가 줄(custom, 최대 10줄, 같은 이름 없음)이 기본.
-- 고정지출·생활비·용돈은 지운 것을 ‘되돌리기’로 다시 넣을 때(한 월급 계획에 하나씩, 용돈은 사람마다 하나).
-- p_sort: 넣을 자리(없으면 맨 아래). 저금 줄은 add_saving_item으로. 새 줄 id를 돌려줌
create or replace function public.split_line_add(
  p_split uuid, p_kind public.split_line_kind, p_amount bigint,
  p_name text default null, p_user uuid default null, p_sort integer default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sp public.salary_split;
  nm text := nullif(btrim(p_name), '');
  who uuid;
  last integer;
  pos integer;
  old jsonb;
  nid uuid;
begin
  sp := public.split_editable(p_split);
  if p_kind = 'saving' then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if not public.split_amount_ok(p_amount) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_kind = 'custom' then
    if nm is null or char_length(nm) > 20 then
      raise exception 'bad_name' using errcode = '22023';
    end if;
    if (select count(*) from public.split_line where split_id = sp.id and kind = 'custom') >= 10 then
      raise exception 'too_many_custom' using errcode = '22023';
    end if;
    if exists (select 1 from public.split_line where split_id = sp.id and kind = 'custom' and name = nm) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  elsif p_kind in ('fixed', 'living') then
    if exists (select 1 from public.split_line where split_id = sp.id and kind = p_kind) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  elsif p_kind = 'allowance' then
    who := coalesce(p_user, sp.owner_user_id, auth.uid());
    if not exists (select 1 from public.app_user where id = who and space_id = sp.space_id) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if exists (select 1 from public.split_line where split_id = sp.id and kind = 'allowance' and user_id = who) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  end if;
  old := public.split_lines_json(sp.id);
  select coalesce(max(sort), -1) into last from public.split_line where split_id = sp.id;
  pos := case when p_sort is null then last + 1 else greatest(0, least(p_sort, last + 1)) end;
  update public.split_line set sort = sort + 1 where split_id = sp.id and sort >= pos;
  insert into public.split_line (split_id, space_id, kind, user_id, name, amount, sort)
    values (sp.id, sp.space_id, p_kind, case when p_kind = 'allowance' then who end,
      case when p_kind = 'custom' then nm end, p_amount, pos)
    returning id into nid;
  perform public.split_touch(sp.id);
  perform public.log_split_changes(sp.id, old);
  perform public.sync_checklist(sp.id);
  return nid;
end;
$$;
revoke all on function public.split_line_add(uuid, public.split_line_kind, bigint, text, uuid, integer) from public, anon;
grant execute on function public.split_line_add(uuid, public.split_line_kind, bigint, text, uuid, integer) to authenticated;

-- 줄 지우기(W-01 ‘지우기’). 지출 줄(고정지출·생활비·용돈 포함)은 바로 지움, 합쳐서 공동 월급 계획의 용돈 줄은 막음.
-- 저금 줄 = 그만 모음(saving_item_stop: 저금 항목 주인만, 기록은 남고 줄 맞추기가 줄을 뺌).
-- 이번 달: 체크 안 한 그 줄은 빠지고, 이미 체크한 줄은 기록으로 남음(다음 체크리스트부터 없음)
create or replace function public.split_line_delete(p_line uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.split_line;
  sp public.salary_split;
  old jsonb;
begin
  select * into l from public.split_line where id = p_line;
  if l.id is null then
    raise exception 'no_split' using errcode = '42501';
  end if;
  sp := public.split_editable(l.split_id);
  if l.kind = 'saving' then
    perform public.saving_item_stop(l.goal_id);
    perform public.split_touch(sp.id);
    return;
  end if;
  if l.kind = 'allowance' and sp.owner_user_id is null then
    raise exception 'keep_allowance' using errcode = '22023';
  end if;
  old := public.split_lines_json(sp.id);
  delete from public.split_line where id = l.id;
  perform public.split_touch(sp.id);
  perform public.log_split_changes(sp.id, old);
  perform public.sync_checklist(sp.id);
end;
$$;
revoke all on function public.split_line_delete(uuid) from public, anon;
grant execute on function public.split_line_delete(uuid) to authenticated;

-- 순서 바꾸기(W-01 편집 ‘완료’). p_ids = 그 월급 계획의 모든 줄 id를 새 순서로(저금 줄이 지출 줄보다 앞)
create or replace function public.split_reorder(p_split uuid, p_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sp public.salary_split;
  n integer := coalesce(array_length(p_ids, 1), 0);
begin
  sp := public.split_editable(p_split);
  if n <> (select count(*) from public.split_line where split_id = sp.id)
     or n <> (select count(distinct x) from unnest(p_ids) x)
     or exists (select 1 from unnest(p_ids) x
                where not exists (select 1 from public.split_line where id = x and split_id = sp.id)) then
    raise exception 'bad_lines' using errcode = '22023';
  end if;
  if n = 0 then
    return;
  end if;
  -- 묶음 사이로는 못 옮김: 지출 줄 뒤에 저금 줄이 오면 안 됨
  if exists (
    select 1 from unnest(p_ids) with ordinality a(id, i) join public.split_line la on la.id = a.id
    join unnest(p_ids) with ordinality b(id, j) on b.j > a.i join public.split_line lb on lb.id = b.id
    where la.kind <> 'saving' and lb.kind = 'saving') then
    raise exception 'bad_order' using errcode = '22023';
  end if;
  if not exists (
    select 1 from unnest(p_ids) with ordinality o(id, i) join public.split_line l on l.id = o.id
    where l.sort <> o.i - 1) then
    return;
  end if;
  update public.split_line l set sort = (o.i - 1)::smallint
    from unnest(p_ids) with ordinality o(id, i) where l.id = o.id;
  perform public.split_touch(sp.id);
  perform public.log_partner_change(sp.space_id, 'split', sp.id, 'order', '', null, '1', false, '/salary?view=plan');
  perform public.sync_checklist(sp.id);
end;
$$;
revoke all on function public.split_reorder(uuid, uuid[]) from public, anon;
grant execute on function public.split_reorder(uuid, uuid[]) to authenticated;

-- 5. Realtime(로컬·스테이징에 발행이 있을 때만)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salary_split') then
    alter publication supabase_realtime add table public.salary_split;
  end if;
end;
$$;
