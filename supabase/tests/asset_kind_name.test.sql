-- pgTAP: AD-19 항목 이름 목록. 운영만 고침, 앱은 읽기만, 기본 항목은 한 줄, 그룹에 맞는 항목만. 찬우(사용자), ops01
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ops01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'cs01@sweetwo.kr');
insert into public.admin_user (email, name, roles) values
  ('ops01@sweetwo.kr', 'ops01', array['ops']::public.admin_role[]),
  ('cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]);
create function pg_temp.login_as(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002', 'aal2');
set local role authenticated;
select public.admin_me();
select throws_ok($$ select public.admin_save_kind_name('deposit', 'saving', '청년도약계좌', true, false) $$,
  '42501', 'no_permission', '고객 지원은 못 고침');
reset role;

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select public.admin_me();
select set_config('test.k1', public.admin_save_kind_name('deposit', 'policy_saving', '청년도약계좌', true, false)::text, true);
select public.admin_save_kind_name('deposit', 'saving', '자유적금', false, false);
select public.admin_save_kind_name('deposit', 'saving', '적금', false, true);
select throws_ok($$ select public.admin_save_kind_name('deposit', 'etf', 'ETF 적금', true, false) $$,
  '22023', 'bad_value', '그룹에 없는 항목은 못 따름');
select throws_ok($$ select public.admin_save_kind_name('cash', 'bank', '통장', true, false) $$,
  '22023', 'bad_value', '현금성은 고치지 않음');
select lives_ok(format($$ select public.admin_save_kind_name('deposit', 'policy_saving', '청년도약계좌(정책)', true, false, %L) $$,
  current_setting('test.k1')), '새 칩 이름 고침');
reset role;

select results_eq($$ select base, name, added, hidden from public.asset_kind_name order by added, base $$,
  $$ values ('saving'::text, '적금'::text, false, true), ('policy_saving', '청년도약계좌(정책)', true, false) $$,
  '기본 항목은 한 줄(숨김), 새 칩');
select is((select count(*)::int from public.admin_audit where screen = 'AD-19' and action = 'edit'), 4, '고칠 때마다 감사 로그');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.asset_kind_name), 2, '앱은 읽기');
select throws_ok($$ insert into public.asset_kind_name (grp, base, name, added) values ('invest', 'etf', 'x', true) $$,
  '42501', null, '앱은 못 씀');
reset role;

select * from finish();
rollback;
