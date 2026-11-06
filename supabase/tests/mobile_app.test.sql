-- pgTAP: 모바일 최소 버전(AD-16 승인 → app_config), 공지 대상 모바일
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is((select min_version_ios || '/' || min_version_android from public.app_config where id = 1), '0.0.0/0.0.0',
  '기본 최소 버전');
insert into public.admin_approval (id, kind, payload, summary, requested_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'app_version',
    '{"min_version_ios": "1.2.0", "min_version_android": "1.1.0"}', '앱 버전', gen_random_uuid());
update public.admin_approval set status = 'approved' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select min_version_ios || '/' || min_version_android from public.app_config where id = 1), '1.2.0/1.1.0',
  '승인되면 모바일 최소 버전 반영');
select throws_ok($$ update public.app_config set min_version_ios = '1.2' where id = 1 $$, '23514', null,
  '버전 형식');
select lives_ok($$ insert into public.notice (kind, title, body, importance, platforms, starts_at, ends_at)
  values ('info', '공지', '', 'normal', array['mobile'], now(), now() + interval '1 day') $$, '공지 대상 모바일');

select * from finish();
rollback;
