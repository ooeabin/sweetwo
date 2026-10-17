-- pgTAP: 투자 원칙 답(O-53). 내 답만 고치고, 배우자 답은 invest_answers()로만 봄
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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
select set_config('test.code', (select code from public.create_invite()), true);
update public.app_user set invest_answer = 'some', invest_answered_at = now()
  where id = '11111111-1111-1111-1111-111111111111';
select results_eq($$ select mine::text, partner::text from public.invest_answers() $$,
  $$ values ('some', null::text) $$, '합류 전: 내 답만');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select results_eq($$ select mine::text, partner::text from public.invest_answers() $$,
  $$ values (null::text, 'some') $$, '배우자 답이 보임');
update public.app_user set invest_answer = 'keep' where id = '11111111-1111-1111-1111-111111111111';
update public.app_user set invest_answer = 'keep' where id = '22222222-2222-2222-2222-222222222222';
select results_eq($$ select mine::text, partner::text from public.invest_answers() $$,
  $$ values ('keep', 'some') $$, '배우자 답은 못 고침, 내 답만');
select throws_ok($$ update public.app_user set status = 'active' $$, '42501', null,
  '허용한 칸 말고는 못 고침');
reset role;

select * from finish();
rollback;
