-- pgTAP: 목표 제안(금액, 기한, 보류·다시 모으기, 삭제). 22 목표 수정, G-02 ⋯
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
update public.app_user set nickname = '찬우', side = 'groom';
insert into public.goal (space_id, template, name, kind, priority, target_amount, deadline)
  select space_id, 'travel', '여행', 'once', 1, 3000000, '2027-06-01' from public.app_user;
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'emergency', '비상금', 'once', 0, 5000000 from public.app_user;
select set_config('test.code', (select code from public.create_invite()), true);
select set_config('test.travel', (select id::text from public.goal where template = 'travel'), true);
select set_config('test.emergency', (select id::text from public.goal where template = 'emergency'), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select isnt(public.propose('goal_amount', '{"target_amount":4000000}', current_date + 30, current_setting('test.travel')::uuid), null, '목표 금액 제안');
select isnt(public.propose('goal_deadline', '{"deadline":"2027-12-01"}', current_date + 30, current_setting('test.travel')::uuid), null, '같은 목표 다른 항목은 따로');
select throws_ok($$ select public.propose('goal_amount', '{"target_amount":1}', current_date + 30) $$, '22023', null, '목표 항목은 목표가 있어야');
select throws_ok(format($$ select public.propose('goal_delete', '{}', current_date + 30, %L) $$, current_setting('test.emergency')), '22023', null, '비상금은 지우기 없음');
select results_eq(
  $$ select before->>'target_amount', after->>'target_amount' from public.proposal where item = 'goal_amount' $$,
  $$ values ('3000000'::text, '4000000'::text) $$, '전·후 값은 서버가 읽음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.respond_proposal((select id from public.proposal where item = 'goal_amount' and status = 'open'), 'like'), 'applied'::public.proposal_status, '좋아요');
select is((select target_amount from public.goal where template = 'travel'), 4000000::bigint, '목표 금액 적용');
select public.propose('goal_delete', '{}', current_date + 30, current_setting('test.travel')::uuid);
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.respond_proposal((select id from public.proposal where item = 'goal_delete' and status = 'open'), 'like');
select is((select count(*)::int from public.goal where template = 'travel' and deleted_at is null), 0, '삭제 = 휴지통');
select is((select status::text from public.proposal where item = 'goal_deadline'), 'withdrawn', '지운 목표의 다른 제안은 거둠');
reset role;

select * from finish();
rollback;
