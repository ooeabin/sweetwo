-- pgTAP: app_config는 누구나 읽고, 앱 쪽 역할은 쓸 수 없다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_table('public', 'app_config', 'app_config 테이블이 있다');
select is((select count(*)::int from public.app_config), 1, '행은 하나');

set local role anon;
select is((select count(*)::int from public.app_config), 1, '익명도 읽을 수 있다');
select throws_ok($$ insert into public.app_config (id) values (1) $$, '42501', null, '익명은 추가할 수 없다');

set local role authenticated;
update public.app_config set flags = '{"x":true}' where id = 1;
reset role;
select is((select flags from public.app_config where id = 1), '{}'::jsonb, '로그인 사용자도 수정할 수 없다(정책 없음)');

select * from finish();
rollback;
