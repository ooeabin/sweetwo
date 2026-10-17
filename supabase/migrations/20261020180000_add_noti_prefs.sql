-- 알림 설정(25 S-14, S-14a)과 주말·공휴일 앞당기기(S-11 9번).
-- 알림 센터 기록은 설정과 상관없이 늘 남고(14 ‘센터와 푸시·메일’), 이 설정은 OS 알림·메일을 보낼지에만 씀.
-- noti_prefs 모양(앱 core rules/noti-prefs.ts가 기본값을 채움):
--   { "push": bool, "email": bool, "topics": { "<묶음>": { "push": bool, "email": bool } } }
--   묶음: plan, proposal, partner_change, care_30, care_14, care_0, care_7, money, goal, invite
-- 방해 금지 시각은 한국 시간 시(0~23). 기본 밤 10시 ~ 아침 8시.

alter table public.app_user
  add column noti_prefs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(noti_prefs) = 'object' and pg_column_size(noti_prefs) < 4000),
  add column quiet_start smallint not null default 22 check (quiet_start between 0 and 23),
  add column quiet_end smallint not null default 8 check (quiet_end between 0 and 23);
grant update (noti_prefs, quiet_start, quiet_end) on public.app_user to authenticated;

-- 부부 공통 값, 둘 다 바로 바꿈(배분 결정 아님)
grant update (holiday_shift) on public.couple_space to authenticated;

-- 알림 묶음(설정 토글과 맞추는 열). 챙길 날은 시점(dedupe ‘care:{id}:{날짜}:{n}:{사람}’의 n)
alter table public.notification add column topic text generated always as (
  case
    when kind in ('plan_ready', 'payday', 'close_start', 'close_remind') then 'plan'
    when kind like 'proposal\_%' then 'proposal'
    when kind = 'partner_joined' then 'invite'
    when kind = 'care_day' then 'care_' || split_part(dedupe, ':', 4)
    else 'other'
  end
) stored;
