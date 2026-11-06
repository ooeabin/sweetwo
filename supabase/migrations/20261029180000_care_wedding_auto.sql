-- 자동으로 만드는 결혼기념일(24 ‘자동으로 만드는 결혼기념일’). 결혼한 날(O-12 ‘했어요’, S-11h)을 넣으면 챙길 날 하나를 만듦.
-- 공간마다 한 번만(지운 것도 셈 → 지운 뒤에는 다시 만들지 않음). 결혼한 날을 바꾸면 날짜를 옮기되, 사람이 날짜를 직접 고쳤으면 그대로.
-- 자동으로 만들 때는 상대 알림을 따로 보내지 않음(결혼한 날을 바꾼 알림 하나로 충분).

alter table public.care_day add column auto text check (auto in ('wedding')); -- 앱이 자동으로 만든 챙길 날
alter table public.care_day add column auto_moves boolean not null default true; -- 결혼한 날을 바꾸면 날짜도 옮김
create unique index care_day_auto_idx on public.care_day (space_id, auto) where auto is not null;

-- 사람이 자동 챙길 날의 날짜를 고치면 더는 따라 옮기지 않음(자동 맞추기는 sweetwo.care_auto = '1'로 표시)
create or replace function public.care_day_auto_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.auto is not null
     and (new.month, new.day, new.date_rule, new.once_on) is distinct from (old.month, old.day, old.date_rule, old.once_on)
     and coalesce(current_setting('sweetwo.care_auto', true), '') <> '1' then
    new.auto_moves := false;
  end if;
  return new;
end;
$$;
create trigger care_day_auto_guard before update on public.care_day
  for each row execute function public.care_day_auto_guard();

-- 공간의 결혼기념일 챙길 날 맞추기: 결혼했고 결혼한 날이 있으면 만들거나(처음) 날짜를 옮김(자동 날짜 그대로일 때)
create or replace function public.sync_wedding_care(p_space uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sp public.couple_space;
  c public.care_day;
begin
  select * into sp from public.couple_space where id = p_space;
  if sp.id is null or sp.marriage_status is distinct from 'married' or sp.wedding_date is null then
    return;
  end if;
  select * into c from public.care_day where space_id = p_space and auto = 'wedding';
  perform set_config('sweetwo.care_auto', '1', true);
  if c.id is null then
    insert into public.care_day (space_id, category, kind, name, date_rule, month, day, auto)
      values (p_space, 'couple', 'anniversary', '결혼기념일', 'solar_yearly',
              extract(month from sp.wedding_date)::smallint, extract(day from sp.wedding_date)::smallint, 'wedding');
  elsif c.deleted_at is null and c.auto_moves
        and (c.month, c.day) is distinct from (extract(month from sp.wedding_date)::smallint, extract(day from sp.wedding_date)::smallint) then
    update public.care_day
      set month = extract(month from sp.wedding_date)::smallint, day = extract(day from sp.wedding_date)::smallint,
          date_rule = 'solar_yearly', once_on = null
      where id = c.id;
  end if;
  perform set_config('sweetwo.care_auto', '', true);
end;
$$;
revoke all on function public.sync_wedding_care(uuid) from public, anon, authenticated;

create or replace function public.couple_space_wedding_care()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.marriage_status is distinct from old.marriage_status
     or new.wedding_date is distinct from old.wedding_date then
    perform public.sync_wedding_care(new.id);
  end if;
  return null;
end;
$$;
create trigger couple_space_wedding_care after insert or update on public.couple_space
  for each row execute function public.couple_space_wedding_care();

-- 이미 결혼한 날을 넣은 공간도 하나씩 만듦
do $$
declare
  s uuid;
begin
  for s in select id from public.couple_space where marriage_status = 'married' and wedding_date is not null loop
    perform public.sync_wedding_care(s);
  end loop;
end;
$$;
