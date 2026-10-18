-- pgTAP: 함께 모드(W-04a 같이 하기, W-04 끝 확정, 함께 정하기). 찬우(정리자), 예빈(같이 하기)
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우';
update public.couple_space set living_budget = 700000;
select set_config('test.code', (select code from public.create_invite()), true);
select public.start_first_plan('2026-10-01', current_date - 27, current_date + 2, null, false, false, '{}', '[]');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈';
select public.finish_join();
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into public.month_close (space_id, plan_id, started_by, started_at)
  select u.space_id, p.id, u.id, now() from public.app_user u, public.monthly_plan p where u.id = auth.uid();
select set_config('test.c', (select id::text from public.month_close), true);
select throws_ok(format($$ select public.join_close_together(%L) $$, current_setting('test.c')), '22023', 'is_closer', '정리자는 같이 하기 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.join_close_together(current_setting('test.c')::uuid);
select isnt((select together_at from public.month_close), null, '같이 하기 → 함께 모드');
reset role;

-- 함께 모드에서 바꾼 값은 바로 확정
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.propose_in_close(current_setting('test.c')::uuid, 'living_budget', '{"living_budget":750000}', current_date + 10);
select is((select status::text from public.proposal), 'applied', '제안 없이 확정');
select is((select living_budget from public.couple_space), 750000::bigint, '값이 바로 바뀜');
-- 예빈이 나가면 이후는 묶음 제안
select public.leave_close_together(current_setting('test.c')::uuid);
select public.propose_in_close(current_setting('test.c')::uuid, 'living_budget', '{"living_budget":800000}', current_date + 10);
select is((select count(*) from public.proposal where status = 'open'), 1::bigint, '나간 뒤는 제안');
select throws_ok(format($$ select public.confirm_together(%L, (select id from public.proposal where status = 'open')) $$, current_setting('test.c')),
  '22023', 'not_together', '함께 모드가 아니면 확정 못 함');
reset role;

-- 5분 안에 다시 들어오면 재개, 함께 정하기 확정
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('test.at', (select together_at::text from public.month_close), true);
select public.join_close_together(current_setting('test.c')::uuid);
select is((select together_at::text from public.month_close), current_setting('test.at'), '5분 안이면 이어서');
select is((select together_left_at from public.month_close), null, '다시 함께');
select public.confirm_together(current_setting('test.c')::uuid, (select id from public.proposal where status = 'open'));
select is((select living_budget from public.couple_space), 800000::bigint, '이 값으로 정하기 → 확정');
select is((select count(*) from public.proposal where status = 'open'), 0::bigint, '열린 제안 없음');
reset role;

select * from finish();
rollback;
