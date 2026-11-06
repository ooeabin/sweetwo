-- pgTAP: 앱 기기 기록과 AD-16 최소 지원 버전 미만 기기 수. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ops01@sweetwo.kr');
insert into public.admin_user (email, name, roles) values ('ops01@sweetwo.kr', 'ops01', array['ops']::public.admin_role[]);
create function pg_temp.login_as(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
update public.app_config set min_version_desktop = '1.2.0', min_version_ios = '1.0.0', min_version_android = '1.1.0' where id = 1;

select ok(public.version_below('1.1.9', '1.2.0') and not public.version_below('1.10.0', '1.2.0'), '숫자로 비교');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.note_device('0f0f0f0f-0000-4000-8000-000000000001', 'desktop', '1.1.0') $$, '데스크톱 기록');
select public.note_device('0f0f0f0f-0000-4000-8000-000000000001', 'desktop', '1.2.0');
select public.note_device('0f0f0f0f-0000-4000-8000-000000000002', 'android', '1.0.5');
select throws_ok($$ select * from public.app_device $$, '42501', null, '직접 못 읽음');
select throws_ok($$ select public.note_device('x', 'desktop', '1.0.0') $$, '23514', null, '설치 ID 모양');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.note_device('0f0f0f0f-0000-4000-8000-000000000003', 'desktop', '1.1.3');
select public.note_device('0f0f0f0f-0000-4000-8000-000000000004', 'ios', '1.0.0');
reset role;
select is((select count(*)::int from public.app_device where user_id = '11111111-1111-1111-1111-111111111111'), 2, '같은 설치는 한 줄');
-- 오래된 기기는 세지 않음
insert into public.app_device (user_id, install_id, platform, app_version, last_seen_at)
  values ('22222222-2222-2222-2222-222222222222', '0f0f0f0f-0000-4000-8000-000000000005', 'desktop', '0.9.0', now() - interval '100 days');

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select public.admin_me();
select is(public.admin_app_config()->'below_min', '{"desktop": 1, "ios": 0, "android": 1}'::jsonb, '플랫폼별 미만 기기 수(90일 안)');
reset role;
select public.purge_app_devices();
select is((select count(*)::int from public.app_device), 5, '180일 넘은 것만 지움(100일은 남음)');

select * from finish();
rollback;
