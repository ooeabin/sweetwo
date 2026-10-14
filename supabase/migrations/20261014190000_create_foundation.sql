-- 기반: 공통 함수와 app_config (docs/DEV_GUIDE.md ‘기능 플래그와 최소 버전’, ‘마이그레이션과 RLS 규칙’)

-- 쓰기마다 updated_at과 version을 올리는 공통 트리거 함수. 테이블마다 BEFORE UPDATE로 붙인다.
create or replace function public.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$;

-- 앱 설정: 최소 버전, 기능 플래그, 끄기 스위치. 행은 하나(id = 1)만.
create table public.app_config (
  id smallint primary key default 1 check (id = 1),
  min_version_desktop text not null default '0.0.0',
  min_version_web text not null default '0.0.0',
  flags jsonb not null default '{}'::jsonb,
  kill_switches jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

comment on table public.app_config is '앱 시작과 재연결 때 읽는 설정. 쓰기는 서버(service role)와 어드민 함수만.';

create trigger app_config_touch before update on public.app_config
  for each row execute function public.touch_row();

alter table public.app_config enable row level security;

-- 누구나 읽기(로그인 전에도 최소 버전 확인). 쓰기 정책은 두지 않는다(service role만).
create policy app_config_select on public.app_config
  for select to anon, authenticated using (true);

insert into public.app_config (id) values (1);
