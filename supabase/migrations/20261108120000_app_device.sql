-- AD-16 최소 지원 버전 미만 기기 수(27 AD-16). 앱(데스크톱, iOS, Android)이 로그인된 채 켜질 때 기기마다 한 줄:
-- 설치 ID(기기에서 만든 임의 값), 플랫폼, 앱 버전, 마지막 실행. 어드민은 플랫폼별 미만 기기 수 집계만 봄.
-- 90일 안에 켠 기기만 셈, 180일 안 켠 기기는 지움(31 1장 ‘앱 기기 기록’).
create table public.app_device (
  user_id uuid not null references auth.users (id) on delete cascade,
  install_id text not null check (install_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  platform text not null check (platform in ('desktop', 'ios', 'android')),
  app_version text not null check (app_version ~ '^\d+\.\d+\.\d+$'),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, install_id)
);
create index app_device_seen_idx on public.app_device (platform, last_seen_at);
alter table public.app_device enable row level security;
revoke all on public.app_device from anon, authenticated;

-- 버전 비교: 점으로 나눈 숫자 배열(‘1.2’ = 1.2.0보다 짧아서 작음, 최소 버전은 보통 세 자리)
create or replace function public.version_below(p_version text, p_min text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select string_to_array(p_version, '.')::int[] < string_to_array(p_min, '.')::int[];
$$;

create or replace function public.note_device(p_install text, p_platform text, p_version text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into public.app_device (user_id, install_id, platform, app_version)
    values (uid, lower(p_install), p_platform, p_version)
    on conflict (user_id, install_id) do update
      set platform = excluded.platform, app_version = excluded.app_version, last_seen_at = now();
end;
$$;
revoke execute on function public.note_device(text, text, text) from public, anon;
grant execute on function public.note_device(text, text, text) to authenticated;

create or replace function public.admin_app_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
  c public.app_config;
begin
  select * into c from public.app_config where id = 1;
  return to_jsonb(c) - 'flags' - 'kill_switches' || jsonb_build_object('below_min', (
    select jsonb_build_object(
      'desktop', count(*) filter (where d.platform = 'desktop' and public.version_below(d.app_version, c.min_version_desktop)),
      'ios', count(*) filter (where d.platform = 'ios' and public.version_below(d.app_version, c.min_version_ios)),
      'android', count(*) filter (where d.platform = 'android' and public.version_below(d.app_version, c.min_version_android)))
    from public.app_device d where d.last_seen_at > now() - interval '90 days'));
end;
$$;

create or replace function public.purge_app_devices()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.app_device where last_seen_at < now() - interval '180 days';
$$;
revoke execute on function public.purge_app_devices() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-app-devices', '55 19 * * *', 'select public.purge_app_devices()');
  end if;
end;
$$;
