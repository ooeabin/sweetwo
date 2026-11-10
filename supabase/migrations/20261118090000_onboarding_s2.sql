-- QA 2구간 온보딩 고침(2026-11-10, docs/spec/16·17·24, ADR 0005)
-- 1) 온보딩 중 추천 월급 계획 다시 만들기(S2-01): 뒤로 가서 월급·월급날·관리 방식을 바꾸면 처음부터 다시 만듦
-- 2) 결혼 상태가 ‘결혼했어요’가 아니게 되면 자동으로 만든 결혼기념일을 지움(S2-09, 손대지 않았고 기록이 없을 때만)
-- 3) 이름(nickname) 한도: 화면은 보이는 글자 10자(이모지 한 개 = 1자), 서버는 코드 포인트 40까지(S2-19)

-- ── 1) onboarding_reset_plan ─────────────────────────────────────────────
-- 온보딩을 마치기 전(onboarding_done_at is null)에만. 내 월급 계획과 공동 월급 계획(owner null), 그 체크리스트를 지움.
-- 체크한 줄이 하나라도 있는 체크리스트가 걸리면 아무것도 지우지 않음(파트너 기록 보호). 지운 뒤 앱이 save_split → start_checklist.
create or replace function public.onboarding_reset_plan()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  done timestamptz;
begin
  select space_id, onboarding_done_at into sid, done from public.app_user where id = uid;
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if done is not null then
    raise exception 'onboarding_done' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.pay_checklist c
    join public.pay_check_line l on l.checklist_id = c.id
    where c.space_id = sid and (c.owner_user_id = uid or c.owner_user_id is null) and l.state <> 'wait'
  ) then
    return;
  end if;
  delete from public.pay_checklist
    where space_id = sid and (owner_user_id = uid or owner_user_id is null);
  delete from public.salary_split
    where space_id = sid and (owner_user_id = uid or owner_user_id is null)
      and not exists (select 1 from public.split_line l where l.split_id = salary_split.id and l.goal_id is not null);
end;
$$;
revoke all on function public.onboarding_reset_plan() from public, anon;
grant execute on function public.onboarding_reset_plan() to authenticated;

-- ── 2) sync_wedding_care: 결혼했어요가 아니면 자동 결혼기념일 지움 ─────────────────
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
  if sp.id is null then
    return;
  end if;
  select * into c from public.care_day where space_id = p_space and auto = 'wedding';
  if sp.marriage_status is distinct from 'married' or sp.wedding_date is null then
    -- 2026-11-10 S2-09: 잘못 고른 ‘결혼했어요’를 바꾸면 자동으로 만든 것도 없앰. 직접 고쳤거나(auto_moves false) 기록이 있으면 그대로
    if c.id is not null and c.deleted_at is null and c.auto_moves
       and not exists (select 1 from public.care_record r where r.care_day_id = c.id) then
      perform set_config('sweetwo.care_auto', '1', true);
      delete from public.care_day where id = c.id;
      perform set_config('sweetwo.care_auto', '', true);
    end if;
    return;
  end if;
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

-- ── 3) nickname 한도 ─────────────────────────────────────────────────────
-- 화면(O-03, P-03, S-11)은 보이는 글자(grapheme) 10자. 커플 이모지 하나가 코드 포인트 6~11개라 서버의 10은 너무 좁음.
-- 넓히기만 함(기존 값은 모두 통과)
alter table public.app_user drop constraint app_user_nickname_check;
alter table public.app_user add constraint app_user_nickname_check check (char_length(nickname) between 1 and 40);
