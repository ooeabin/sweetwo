-- 모바일 앱(iOS, Android) 준비(15 A-01, 27 AD-10·AD-16, DEV_GUIDE ‘모바일 세션’).
-- 1) 최소 지원 버전을 iOS·Android 따로(미만이면 업데이트 안내 → 스토어). 웹은 설정 없음(27 AD-16)
-- 2) 공지 대상 플랫폼에 모바일 앱
alter table public.app_config
  add column min_version_ios text not null default '0.0.0' check (min_version_ios ~ '^\d+\.\d+\.\d+$'),
  add column min_version_android text not null default '0.0.0' check (min_version_android ~ '^\d+\.\d+\.\d+$');

create or replace function public.admin_request_app_config(p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
begin
  if exists (select 1 from jsonb_object_keys(p) k where k not in (
      'latest_version_desktop', 'min_version_desktop', 'min_version_web', 'min_version_ios', 'min_version_android',
      'maintenance_starts_at', 'maintenance_ends_at', 'maintenance_message'))
     or (p ? 'maintenance_starts_at' and p->>'maintenance_starts_at' is not null
         and (p->>'maintenance_ends_at') is null)
     or (p ? 'min_version_ios' and coalesce(p->>'min_version_ios', '') !~ '^\d+\.\d+\.\d+$')
     or (p ? 'min_version_android' and coalesce(p->>'min_version_android', '') !~ '^\d+\.\d+\.\d+$') then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  return public.admin_request_approval(a, 'app_version', p, '앱 버전·점검 변경');
end;
$$;
revoke execute on function public.admin_request_app_config(jsonb) from public, anon;
grant execute on function public.admin_request_app_config(jsonb) to authenticated;

-- 승인되면 모바일 최소 버전도 반영(나머지 값은 admin_decide가 이미 반영)
create or replace function public.apply_mobile_min_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'app_version' and new.status = 'approved' and old.status = 'requested' then
    update public.app_config set
      min_version_ios = coalesce(new.payload->>'min_version_ios', min_version_ios),
      min_version_android = coalesce(new.payload->>'min_version_android', min_version_android)
    where id = 1;
  end if;
  return new;
end;
$$;
create trigger admin_approval_mobile_versions after update of status on public.admin_approval
  for each row execute function public.apply_mobile_min_versions();

alter table public.notice drop constraint notice_platforms_check;
alter table public.notice add constraint notice_platforms_check
  check (platforms <@ array['desktop', 'web', 'mobile'] and array_length(platforms, 1) >= 1);
alter table public.notice alter column platforms set default array['desktop', 'mobile'];
