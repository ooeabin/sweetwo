-- 공휴일 받기(29 기술·운영 ‘공휴일’: 공공데이터포털 한국천문연구원 특일 정보). 매주 1회(월 03:00 KST) 올해와 다음 해를 받음.
-- Edge Function fetch-holidays가 받아 save_api_holidays로 저장. 어드민(AD-19)이 넣은 날(source admin)은 덮지 않음.
-- 받은 해에 API가 더는 주지 않는 날(source api)은 지움(임시공휴일 취소 등).
-- kick_holidays(): pg_cron이 부름 → Vault holiday_function_url·holiday_cron_secret으로 pg_net 호출(kick_push와 같은 방식)

create or replace function public.save_api_holidays(p_rows jsonb, p_years integer[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.holiday (date, name, kind, source, fetched_at)
  select (r->>'date')::date, left(btrim(r->>'name'), 30), (r->>'kind')::public.holiday_kind, 'api', now()
  from jsonb_array_elements(p_rows) r
  where (r->>'date') ~ '^\d{4}-\d{2}-\d{2}$' and btrim(coalesce(r->>'name', '')) <> ''
  on conflict (date) do update
    set name = excluded.name, kind = excluded.kind, fetched_at = now()
    where public.holiday.source = 'api';
  get diagnostics n = row_count;
  -- 받은 해에서 빠진 API 날은 지움(받은 것이 하나도 없으면 지우지 않음: API 오류로 다 지우지 않게)
  if jsonb_array_length(p_rows) > 0 then
    delete from public.holiday h
    where h.source = 'api' and extract(year from h.date)::int = any(p_years)
      and not exists (select 1 from jsonb_array_elements(p_rows) r where (r->>'date')::date = h.date);
  end if;
  return n;
end;
$$;
revoke all on function public.save_api_holidays(jsonb, integer[]) from public, anon, authenticated;
grant execute on function public.save_api_holidays(jsonb, integer[]) to service_role;

create or replace function public.kick_holidays()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return false;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into fn_url using 'holiday_function_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into secret using 'holiday_cron_secret';
  if fn_url is null or secret is null then
    return false;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using fn_url, jsonb_build_object('Content-Type', 'application/json', 'x-holiday-secret', secret), '{}'::jsonb;
  return true;
end;
$$;
revoke all on function public.kick_holidays() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- 월요일 03:00 KST = 일요일 18:00 UTC
    perform cron.schedule('kick-holidays', '0 18 * * 0', 'select public.kick_holidays()');
  end if;
end;
$$;
