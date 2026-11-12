-- QA 9구간(캘린더·경조사 Y-01~Y-09, 2026-11-12) 서버 쪽.
-- 1. care_day, care_record를 Realtime 발행에 더함(S9-03): 상대가 경조사를 넣거나 고치거나 기록하면 캘린더·홈이 바로 다시 읽음.
--    읽기 권한은 care_day_select·care_record_select 그대로라 남의 옛 서프라이즈 행은 신호도 안 감
-- 2. 사용자 결정 D2 = A(S9-13): 앱이 바로 쓸 때 서프라이즈(secret = true)와 21자 넘는 이름을 거절(care_day_client_guard).
--    서프라이즈는 재기획으로 없앴고(24 ‘공유 범위’), 이름은 24 Y-07a ‘최대 20자’.
--    지금 있는 행은 그대로 둠: 서프라이즈를 끄는 것(secret false)은 되고, 이미 긴 이름은 이름을 바꿀 때만 검사.
--    그래서 CHECK 대신 트리거(옛 행의 상태·메모 고치기, 기록 record_care가 막히지 않게).
--    함수 안(security definer: 연결 해제 사본, 자동 결혼기념일 등)은 current_user가 함수 주인이라 걸리지 않음
--    (asset_client_guard, goal_owner_guard와 같은 방식)
-- 스키마는 추가만(발행에 표 더함, 트리거 하나)

-- 1. Realtime 발행 ─────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'care_day') then
      alter publication supabase_realtime add table public.care_day;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'care_record') then
      alter publication supabase_realtime add table public.care_record;
    end if;
  end if;
end;
$$;

-- 2. 서프라이즈·이름 길이 거절 ────────────────────────────────────────
create or replace function public.care_day_client_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.secret and (tg_op = 'INSERT' or not old.secret) then
    raise exception 'care_secret_removed' using errcode = '23514';
  end if;
  if (tg_op = 'INSERT' or new.name is distinct from old.name) and char_length(btrim(new.name)) > 20 then
    raise exception 'care_name_too_long' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger care_day_client_guard before insert or update on public.care_day
  for each row execute function public.care_day_client_guard();
