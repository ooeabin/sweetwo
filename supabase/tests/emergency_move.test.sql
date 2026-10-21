-- pgTAP: 비상금 넣기, 꺼내기. 기록은 RPC로만, 비상금 역할 통장 금액도 같이, 되돌리기
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
insert into public.account (space_id, role, name, start_balance)
  select space_id, 'emergency', '비상금 통장', 1000000 from public.app_user;
select throws_ok($$ insert into public.emergency_move (space_id, kind, amount) select space_id, 'in', 1 from public.app_user $$,
  '42501', null, '직접 못 넣음');
select isnt(public.move_emergency('in', 300000), null, '넣기');
select set_config('test.out', public.move_emergency('out', 500000, 'hospital')::text, true);
select results_eq($$ select kind, amount::int, reason from public.emergency_move order by created_at, kind $$,
  $$ values ('in', 300000, null::text), ('out', 500000, 'hospital') $$, '기록, 꺼내기만 사유');
select is((select amount::int from public.asset where kind = 'role_account'), 800000, '통장 금액 100만 + 30만 − 50만');
select lives_ok(format($$ select public.undo_emergency_move(%L) $$, current_setting('test.out')), '되돌리기');
select is((select amount::int from public.asset where kind = 'role_account'), 1300000, '되돌리면 통장 금액도 되돌림');
reset role;

-- 다른 공간 사람은 못 봄
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is((select count(*)::int from public.emergency_move), 0, '다른 공간 기록은 안 보임');
reset role;
select is((select count(*)::int from public.emergency_move where deleted_at is null), 1, '남은 기록 1개');

select * from finish();
rollback;
