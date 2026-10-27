-- AD-19 항목 이름 목록(27 AD-19, 09 6-2): 자산 추가(F-03a) 세부 항목 칩 중 예금·적금, 청약, 투자, 연금을 앱 배포 없이 고침.
-- 기본 항목은 이름 바꾸기·숨기기(항목마다 한 줄, added = false), 새 칩은 기본 항목 하나(base)의 동작을 그대로 따름(added = true).
-- ‘기타(직접 입력)’는 늘 마지막, 고칠 수 없음. 운영이 바로 저장, 감사 로그에 전·후 값(AD-19 다른 기준 데이터와 같음).
create table public.asset_kind_name (
  id uuid primary key default gen_random_uuid(),
  grp text not null check (grp in ('deposit', 'subscription', 'invest', 'pension')),
  base text not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 20),
  added boolean not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (case grp
    when 'deposit' then base in ('term_deposit', 'saving', 'policy_saving')
    when 'subscription' then base in ('housing_subscription')
    when 'invest' then base in ('stock_kr', 'stock_us', 'etf', 'fund', 'bond', 'isa', 'gold', 'crypto')
    when 'pension' then base in ('pension_saving', 'irp', 'dc', 'pension_insurance')
  end)
);
create unique index asset_kind_name_default_idx on public.asset_kind_name (grp, base) where not added;
alter table public.asset_kind_name enable row level security;
create policy asset_kind_name_select on public.asset_kind_name for select to authenticated using (true);
revoke insert, update, delete on public.asset_kind_name from anon, authenticated;

-- p_id 없으면 새로(새 칩) 또는 기본 항목 한 줄을 만들거나 고침
create or replace function public.admin_save_kind_name(
  p_grp text, p_base text, p_name text, p_added boolean, p_hidden boolean, p_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  old public.asset_kind_name;
  rid uuid;
begin
  if p_id is not null then
    select * into old from public.asset_kind_name where id = p_id for update;
    if old.id is null then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    update public.asset_kind_name set base = p_base, name = btrim(p_name), hidden = coalesce(p_hidden, false),
      updated_at = now(), updated_by = a.id
      where id = p_id returning id into rid;
  elsif p_added then
    insert into public.asset_kind_name (grp, base, name, added, hidden, updated_by)
      values (p_grp, p_base, btrim(p_name), true, coalesce(p_hidden, false), a.id) returning id into rid;
  else
    select * into old from public.asset_kind_name where grp = p_grp and base = p_base and not added;
    insert into public.asset_kind_name (grp, base, name, added, hidden, updated_by)
      values (p_grp, p_base, btrim(p_name), false, coalesce(p_hidden, false), a.id)
      on conflict (grp, base) where not added do update
        set name = excluded.name, hidden = excluded.hidden, updated_at = now(), updated_by = a.id
      returning id into rid;
  end if;
  perform public.admin_log(a, 'edit', 'AD-19', 'kind:' || coalesce(old.grp, p_grp) || '/' || coalesce(old.base, p_base), null,
    jsonb_build_object('before', case when old.id is null then null else jsonb_build_object('name', old.name, 'base', old.base, 'hidden', old.hidden) end,
                       'after', (select jsonb_build_object('name', k.name, 'base', k.base, 'hidden', k.hidden) from public.asset_kind_name k where k.id = rid)));
  return rid;
exception
  when check_violation then
    raise exception 'bad_value' using errcode = '22023';
end;
$$;
revoke execute on function public.admin_save_kind_name(text, text, text, boolean, boolean, uuid) from public, anon;
grant execute on function public.admin_save_kind_name(text, text, text, boolean, boolean, uuid) to authenticated;

-- 지우기: 새 칩은 사라지고, 기본 항목은 처음 이름·보이기로 돌아감
create or replace function public.admin_delete_kind_name(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  old public.asset_kind_name;
begin
  delete from public.asset_kind_name where id = p_id returning * into old;
  if old.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'edit', 'AD-19', 'kind:' || old.grp || '/' || old.base, '지움',
    jsonb_build_object('before', jsonb_build_object('name', old.name, 'base', old.base, 'hidden', old.hidden), 'after', null));
end;
$$;
revoke execute on function public.admin_delete_kind_name(uuid) from public, anon;
grant execute on function public.admin_delete_kind_name(uuid) to authenticated;
