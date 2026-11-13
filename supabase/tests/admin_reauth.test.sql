-- pgTAP: 어드민 재인증(33 3장)과 최고 관리자 최소 1명(2026-11-06 2명에서 바꿈). boss·boss2(최고), cs01(CS)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'boss2@sweetwo.kr');
insert into public.admin_user (id, email, name, roles) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@sweetwo.kr', '대표', array['super']::public.admin_role[]),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'boss2@sweetwo.kr', '대표2', array['super']::public.admin_role[]);
-- ago초 전에 인증 앱으로 확인한 세션
create function pg_temp.login_as(uid uuid, ago integer) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2',
    'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - ago)))::text, true);
$$;

-- 10분 전 인증: 잠금·승인은 다시 인증해야 함, 보기는 그대로
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002', 600);
set local role authenticated;
select lives_ok($$ select public.admin_users() $$, '보기는 재인증 없이');
select throws_ok($$ select public.admin_set_lock('cs01@sweetwo.kr', true) $$, '42501', 'reauth_required', '잠금은 재인증');
select set_config('test.ap', public.admin_request_user('cs02@sweetwo.kr', 'cs02', array['cs']::public.admin_role[])::text, true);
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000003', 600);
set local role authenticated;
select throws_ok(format($$ select public.admin_decide(%L, 'approve') $$, current_setting('test.ap')), '42501', 'reauth_required', '승인은 재인증');
reset role;

-- 방금 인증: 승인 됨. 최고 관리자가 2명이면 한 명은 잠글 수 있고, 마지막 한 명의 역할은 뺄 수 없음
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000003', 10);
set local role authenticated;
select lives_ok(format($$ select public.admin_decide(%L, 'approve') $$, current_setting('test.ap')), '방금 인증하면 승인');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002', 10);
set local role authenticated;
select lives_ok($$ select public.admin_set_lock('boss2@sweetwo.kr', true) $$, '최고 관리자가 2명이면 한 명 잠금');
select set_config('test.last', public.admin_request_user('boss@sweetwo.kr', '대표', array['ops']::public.admin_role[])::text, true);
select throws_ok(format($$ select public.admin_decide(%L, 'approve') $$, current_setting('test.last')), '22023', 'super_min', '마지막 최고 관리자의 역할은 못 뺌');
select lives_ok($$ select public.admin_set_lock('cs01@sweetwo.kr', true) $$, '다른 관리자는 잠금');
reset role;

-- 대시보드 경보(cs01은 위에서 잠겼으니 대표로): 평균 금리를 90일 넘게 안 고치면
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002', 600);
set local role authenticated;
select is(jsonb_array_length(public.admin_dashboard()->'alerts'), 0, '갱신한 지 얼마 안 되면 경보 없음');
reset role;
update public.loan_rate set updated_at = now() - interval '100 days' where kind = 'credit';
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002', 600);
set local role authenticated;
select is(public.admin_dashboard()->'alerts'->0->>'kind', 'loan_rate_stale', '90일 넘으면 경보');
reset role;

select * from finish();
rollback;
