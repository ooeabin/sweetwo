-- pgTAP: 기준일 바꾸기(S-11d)와 신랑·신부(S-11b). 혼자면 바로, 두 사람이면 제안, 두 월급날만, 사이클 끝 맞춤, 쪽 바꾸면 값도 같이
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select is(public.next_base_after('2026-09-25', 10, false), '2026-10-10'::date, '다음 기준일');
select is(public.next_base_after('2026-01-31', 31, false), '2026-02-28'::date, '없는 날은 말일');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom', payday = 25;
select throws_ok($$ select public.save_base_day('{"base_day":12,"base_day_last":false}') $$, '22023', null,
  '월급날이 아닌 날은 거절');
select public.save_base_day('{"base_day":25,"base_day_last":false}');
select is((select base_day from public.couple_space), 25::smallint, '혼자면 바로');
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', payday = 10;
select public.finish_join();
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
-- 오늘이 든 사이클 플랜(오늘 - 5일 시작, 기준일 25일 기준 한 달)
select public.start_first_plan(date_trunc('month', current_date)::date, current_date - 5, current_date + 25, null, false, false, '{}',
  '[{"target":"account","account_role":"living","amount":870000,"amount_groom":520000,"amount_bride":350000}]');
select throws_ok($$ select public.save_base_day('{"base_day":10,"base_day_last":false}') $$, '22023', null,
  '두 사람이면 바로 저장 없음');
select isnt(public.propose('base_day', '{"base_day":10,"base_day_last":false}', current_date + 30), null, '기준일 제안');
select is((select before->>'base_day' from public.proposal where status = 'open'), '25', '제안 전 값');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.respond_proposal((select id from public.proposal where status = 'open'), 'like')::text, 'applied', '좋아요');
select results_eq(
  $$ select (select base_day from public.couple_space)::int,
            (select cycle_end - cycle_start + 1 >= 15 and extract(day from cycle_end + 1) = 10 from public.monthly_plan) $$,
  $$ values (10, true) $$, '기준일 10일, 사이클 끝 = 새 기준일 전날(15일 이상)');

-- 예빈이 사실 신랑 쪽: 둘 다 바뀌고, 쪽으로 저장한 값도 같이
insert into public.family_member (space_id, side, relation, title)
  select space_id, 'groom', 'parent', '찬우 어머니' from public.app_user;
select public.set_my_side('groom');
reset role;
select results_eq(
  $$ select (select side::text from public.app_user where nickname = '찬우'), (select side::text from public.app_user where nickname = '예빈'),
            (select side::text from public.family_member), (select amount_groom from public.plan_line) $$,
  $$ values ('bride', 'groom', 'bride', 350000::bigint) $$, '쪽과 값이 같이 바뀜');
select is((select title from public.notification where kind = 'proposal_arrived' order by created_at desc limit 1),
  '찬우님이 월급 플랜 날짜를 바꾸자고 제안했어요', '제안 도착 알림 문구');

select * from finish();
rollback;
