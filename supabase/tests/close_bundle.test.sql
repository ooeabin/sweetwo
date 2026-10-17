-- pgTAP: 월말 정리 제안 묶음(W-04 끝, W-04p). 찬우(정리), 예빈(받음)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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
delete from public.notification;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into public.month_close (space_id, plan_id) select u.space_id, p.id from public.app_user u, public.monthly_plan p;
select is(public.send_close_bundle((select id from public.month_close)), 0, '바꾼 값이 없으면 알림 없음');
select isnt(public.propose_in_close((select id from public.month_close), 'living_budget', '{"living_budget":750000}', current_date + 10), null, '묶음 제안');
select is((select count(*)::int from public.notification), 0, '묶음 제안은 하나씩 알리지 않음');
select is((select month_close_id from public.proposal), (select id from public.month_close), '정리에 묶임');
select is(public.send_close_bundle((select id from public.month_close)), 1, '묶음 1건');
reset role;
select is((select title from public.notification where kind = 'close_bundle'),
  '찬우님이 10월 월급 플랜을 정리했어요', '예빈에게 한 번 알림');

-- 묶음 밖 제안은 그대로 하나씩 알림
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.propose('allowance', '{"allowance":400000}', current_date + 10);
reset role;
select is((select count(*)::int from public.notification where kind = 'proposal_arrived'), 1, '보통 제안은 알림');

select * from finish();
rollback;
